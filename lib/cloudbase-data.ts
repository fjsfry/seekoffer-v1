'use client';

import { cloudflareRequest } from './cloudflare-api';
import { getDeadlineLevelFromDate, getPublicStatusForDeadlineLevel } from './deadline-display';
import { getUserSession, type UserProfile, type UserSession, updateUserProfile } from './user-session';
import {
  materialChecklistDefinitions,
  type DeadlineLevel,
  type MaterialChecklistKey,
  type ProjectType,
  type PublicNoticeProject,
  type UserProjectRecord,
  type UserProjectStatus
} from './mock-data';
import { filterMainNoticeProjects } from './notice-quality';
import { baseNoticeProjects } from './notice-source';
import { mapNoticeRowToProject as mapD1NoticeRowToProject } from './notice-record';
import { canCreateMoreApplications } from './billing-api';
import { createKeyedSyncRetryCoordinator } from './keyed-sync-retry';

const APPLICATION_STORAGE_KEY = 'seekoffer-my-application-table';
const MANUAL_PROJECT_STORAGE_KEY = 'seekoffer-manual-projects';
const APPLICATION_EVENT_NAME = 'seekoffer-applications-updated';
const WORKSPACE_STORAGE_VERSION = 2;
const NOTICE_TARGET_YEAR = 2026;
// Workbench surfaces only need a compact latest/deadline snapshot. The public
// directory itself uses server-side pagination through lib/public-notice-api.
// Keeping this small prevents desktop startup from hydrating the full D1
// catalogue into every browser session.
const PUBLIC_NOTICE_COMPACT_PAGE_SIZE = 32;

export type WorkspaceStorageOwner =
  | {
      kind: 'member';
      userId: string;
    }
  | {
      kind: 'anonymous';
    }
  | {
      kind: 'local';
    };

type StoredPayload<T> = {
  version: typeof WORKSPACE_STORAGE_VERSION;
  owner: WorkspaceStorageOwner;
  updatedAt: string;
  items: T[];
};

type ParsedStoredPayload<T> = {
  version: number | null;
  owner: WorkspaceStorageOwner | null;
  updatedAt: string;
  items: T[];
};

type WorkspaceSessionIdentity = Pick<UserSession, 'loggedIn' | 'authProvider' | 'userId'>;
type RemoteProfile = UserProfile & { id: string; sync_revision: number };

export type ApplicationRow = {
  item: UserProjectRecord;
  project: PublicNoticeProject;
  noticeAvailable: boolean;
  noticeAvailability: 'available' | 'missing' | 'lookup-failed';
};

export type ManualProjectInput = {
  schoolName: string;
  departmentName: string;
  projectName: string;
  projectType: ProjectType;
  discipline: string;
  deadlineDate: string;
  eventStartDate?: string;
  eventEndDate?: string;
  applyLink?: string;
};

export const WORKSPACE_SYNC_NOTICE =
  '当前试用数据只保存在本机浏览器；登录后，申请表、个人资料和手动录入项目会同步到你的个人工作区。';

let hydrateWorkspacePromise: Promise<void> | null = null;
let hydratedWorkspaceUserId = '';
let publicNoticeCachePromise: Promise<PublicNoticeProject[]> | null = null;

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function nowIsoText() {
  return new Date().toISOString();
}

function nowText() {
  return new Date().toISOString().slice(0, 16).replace('T', ' ');
}

function emitApplicationUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(APPLICATION_EVENT_NAME));
  }
}

function normalizeStringArray(input: unknown) {
  return Array.isArray(input)
    ? input.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
}

function normalizeWorkspaceStorageOwner(value: unknown): WorkspaceStorageOwner | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.kind === 'member') {
    const userId = typeof record.userId === 'string' ? record.userId.trim() : '';
    return userId ? { kind: 'member', userId } : null;
  }

  if (record.kind === 'anonymous') {
    return { kind: 'anonymous' };
  }

  if (record.kind === 'local') {
    return { kind: 'local' };
  }

  return null;
}

export function getWorkspaceStorageOwner(
  session: WorkspaceSessionIdentity | null | undefined
): WorkspaceStorageOwner {
  if (session?.loggedIn && session.authProvider === 'anonymous') {
    return { kind: 'anonymous' };
  }

  const userId = typeof session?.userId === 'string' ? session.userId.trim() : '';
  if (session?.loggedIn && session.authProvider !== 'anonymous' && userId) {
    return {
      kind: 'member',
      userId
    };
  }

  return { kind: 'local' };
}

function getWorkspaceStorageSuffix(owner: WorkspaceStorageOwner) {
  return owner.kind === 'member' ? owner.userId : owner.kind;
}

function getWorkspaceStorageKeysForOwner(owner: WorkspaceStorageOwner) {
  const suffix = getWorkspaceStorageSuffix(owner);

  return {
    owner,
    applications: `${APPLICATION_STORAGE_KEY}:${suffix}`,
    manualProjects: `${MANUAL_PROJECT_STORAGE_KEY}:${suffix}`
  };
}

export function getWorkspaceStorageKeys(session: WorkspaceSessionIdentity | null | undefined) {
  return getWorkspaceStorageKeysForOwner(getWorkspaceStorageOwner(session));
}

export function workspaceStorageOwnersMatch(
  left: WorkspaceStorageOwner | null,
  right: WorkspaceStorageOwner
) {
  if (!left || left.kind !== right.kind) {
    return false;
  }

  return left.kind !== 'member' || (right.kind === 'member' && left.userId === right.userId);
}

function getRecordUserIdForOwner(owner: WorkspaceStorageOwner) {
  if (owner.kind === 'member') {
    return owner.userId;
  }

  return owner.kind === 'anonymous' ? 'anonymous-user' : 'local-user';
}

function getCurrentWorkspaceStorageContext() {
  return getWorkspaceStorageKeys(getUserSession());
}

function readStoragePayload<T>(storageKey: string): ParsedStoredPayload<T> | null {
  if (!canUseBrowserStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return {
        version: null,
        owner: null,
        updatedAt: '',
        items: parsed as T[]
      };
    }

    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      if (!Array.isArray(record.items)) {
        return null;
      }

      return {
        version: typeof record.version === 'number' ? record.version : null,
        owner: normalizeWorkspaceStorageOwner(record.owner),
        updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
        items: record.items as T[]
      };
    }
  } catch {
    return null;
  }

  return null;
}

function persistStoragePayload<T>(
  storageKey: string,
  owner: WorkspaceStorageOwner,
  items: T[],
  updatedAt: string
) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(
    storageKey,
    JSON.stringify({
      version: WORKSPACE_STORAGE_VERSION,
      owner,
      updatedAt,
      items
    } satisfies StoredPayload<T>)
  );
}

export function canMigrateLegacyApplicationItems(items: unknown[], userId: string) {
  const expectedUserId = userId.trim();
  if (!expectedUserId || items.length === 0) {
    return false;
  }

  return items.every((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const itemUserId = (item as Record<string, unknown>).userId;
    return typeof itemUserId === 'string' && itemUserId.trim() === expectedUserId;
  });
}

export function canMigrateLegacyManualProjectItems(
  manualItems: unknown[],
  applicationItems: unknown[],
  userId: string
) {
  if (
    manualItems.length === 0 ||
    !canMigrateLegacyApplicationItems(applicationItems, userId)
  ) {
    return false;
  }

  return manualProjectItemsAreReferenced(manualItems, applicationItems);
}

function manualProjectItemsAreReferenced(manualItems: unknown[], applicationItems: unknown[]) {
  const applicationProjectIds = new Set(
    applicationItems
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item) => (typeof item.projectId === 'string' ? item.projectId.trim() : ''))
      .filter(Boolean)
  );

  return manualItems.every((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const projectId = (item as Record<string, unknown>).id;
    return (
      typeof projectId === 'string' &&
      Boolean(projectId.trim()) &&
      applicationProjectIds.has(projectId.trim())
    );
  });
}

function normalizeProjectStatus(
  status: PublicNoticeProject['status'] | undefined,
  deadlineLevel: DeadlineLevel
): PublicNoticeProject['status'] {
  if (
    deadlineLevel === 'expired' ||
    deadlineLevel === 'today' ||
    deadlineLevel === 'within3days' ||
    deadlineLevel === 'within7days'
  ) {
    return getPublicStatusForDeadlineLevel(deadlineLevel);
  }

  return status || getPublicStatusForDeadlineLevel(deadlineLevel);
}

export function calculateMaterialsProgress(record: Pick<UserProjectRecord, MaterialChecklistKey>) {
  const total = materialChecklistDefinitions.length;
  const completed = materialChecklistDefinitions.filter(({ key }) => record[key]).length;
  return Math.round((completed / total) * 100);
}

function hasMaterialChecklistPatch(patch: Partial<UserProjectRecord>) {
  return materialChecklistDefinitions.some(({ key }) => Object.prototype.hasOwnProperty.call(patch, key));
}

function normalizeManualProject(project: Partial<PublicNoticeProject>) {
  const deadlineDate = String(project.deadlineDate || '').trim();
  const deadlineLevel = getDeadlineLevelFromDate(deadlineDate);
  const publishDate = String(project.publishDate || '').trim() || nowText().slice(0, 10);

  return {
    id: String(project.id || '').trim(),
    schoolName: String(project.schoolName || '').trim(),
    departmentName: String(project.departmentName || '').trim() || '待补充',
    projectName: String(project.projectName || '').trim(),
    projectType: (project.projectType || '夏令营') as ProjectType,
    discipline: String(project.discipline || '').trim() || '待补充',
    publishDate,
    deadlineDate,
    eventStartDate: String(project.eventStartDate || '').trim(),
    eventEndDate: String(project.eventEndDate || '').trim(),
    applyLink: String(project.applyLink || '').trim(),
    sourceLink: String(project.sourceLink || '').trim(),
    requirements: String(project.requirements || '').trim() || '以学校页面和报名系统要求为准',
    materialsRequired: normalizeStringArray(project.materialsRequired),
    examInterviewInfo: String(project.examInterviewInfo || '').trim(),
    contactInfo: String(project.contactInfo || '').trim(),
    remarks: String(project.remarks || '').trim(),
    tags: normalizeStringArray(project.tags),
    status: normalizeProjectStatus(project.status as PublicNoticeProject['status'] | undefined, deadlineLevel),
    year: Number(project.year || NOTICE_TARGET_YEAR),
    deadlineLevel,
    sourceSite: String(project.sourceSite || '').trim() || '寻鹿整理',
    collectedAt: String(project.collectedAt || '').trim() || nowText(),
    updatedAt: String(project.updatedAt || '').trim() || nowText(),
    lastCheckedAt: String(project.lastCheckedAt || '').trim() || nowText(),
    isVerified: Boolean(project.isVerified),
    changeLog: Array.isArray(project.changeLog) ? project.changeLog : [],
    historyRecords: Array.isArray(project.historyRecords) ? project.historyRecords : []
  } satisfies PublicNoticeProject;
}

function buildDefaultRecord(
  projectId: string,
  userId = getRecordUserIdForOwner(getCurrentWorkspaceStorageContext().owner)
) {
  const base: UserProjectRecord = {
    userProjectId: `user-${projectId}`,
    userId,
    projectId,
    isFavorited: true,
    myStatus: '已收藏',
    priorityLevel: '中',
    materialsProgress: 0,
    cvReady: false,
    transcriptReady: false,
    rankingProofReady: false,
    recommendationReady: false,
    personalStatementReady: false,
    contactSupervisorDone: false,
    submittedAt: '',
    interviewTime: '',
    resultStatus: '未出结果',
    myNotes: '',
    customReminderEnabled: true
  };

  return {
    ...base,
    materialsProgress: calculateMaterialsProgress(base)
  };
}

function normalizeRecord(
  record: Partial<UserProjectRecord>,
  fallbackUserId = getRecordUserIdForOwner(getCurrentWorkspaceStorageContext().owner)
) {
  const base = {
    ...buildDefaultRecord(String(record.projectId || ''), fallbackUserId),
    ...record
  } as UserProjectRecord;

  const normalized: UserProjectRecord = {
    ...base,
    userProjectId: String(base.userProjectId || `user-${base.projectId}`),
    userId: String(base.userId || fallbackUserId),
    projectId: String(base.projectId || ''),
    isFavorited: Boolean(base.isFavorited),
    myStatus: (base.myStatus || '已收藏') as UserProjectStatus,
    priorityLevel: (base.priorityLevel || '中') as UserProjectRecord['priorityLevel'],
    cvReady: Boolean(base.cvReady),
    transcriptReady: Boolean(base.transcriptReady),
    rankingProofReady: Boolean(base.rankingProofReady),
    recommendationReady: Boolean(base.recommendationReady),
    personalStatementReady: Boolean(base.personalStatementReady),
    contactSupervisorDone: Boolean(base.contactSupervisorDone),
    submittedAt: String(base.submittedAt || ''),
    interviewTime: String(base.interviewTime || ''),
    resultStatus: (base.resultStatus || '未出结果') as UserProjectRecord['resultStatus'],
    myNotes: String(base.myNotes || ''),
    customReminderEnabled: Boolean(base.customReminderEnabled)
  };

  normalized.materialsProgress =
    Number.isFinite(Number(base.materialsProgress)) && Number(base.materialsProgress) > 0
      ? Number(base.materialsProgress)
      : calculateMaterialsProgress(normalized);

  return normalized;
}

function getProjectFreshness(project: Pick<PublicNoticeProject, 'updatedAt' | 'lastCheckedAt' | 'publishDate'>) {
  return project.updatedAt || project.lastCheckedAt || project.publishDate || '';
}

function sortProjectsByFreshness(projects: PublicNoticeProject[]) {
  return [...projects].sort((left, right) => getProjectFreshness(right).localeCompare(getProjectFreshness(left)));
}

function createEmptyWorkspacePayload<T>(owner: WorkspaceStorageOwner): StoredPayload<T> {
  return {
    version: WORKSPACE_STORAGE_VERSION,
    owner,
    updatedAt: '',
    items: []
  };
}

function canMigrateLegacyApplicationPayload(
  payload: ParsedStoredPayload<Partial<UserProjectRecord>>,
  owner: WorkspaceStorageOwner
) {
  if (payload.owner) {
    if (!workspaceStorageOwnersMatch(payload.owner, owner)) {
      return false;
    }

    return (
      owner.kind !== 'member' ||
      payload.items.every((item) => {
        if (!item || typeof item !== 'object') {
          return false;
        }

        const itemUserId = (item as Record<string, unknown>).userId;
        return (
          typeof itemUserId !== 'string' ||
          !itemUserId.trim() ||
          itemUserId.trim() === owner.userId
        );
      })
    );
  }

  return (
    owner.kind === 'member' &&
    canMigrateLegacyApplicationItems(payload.items, owner.userId)
  );
}

function canMigrateLegacyManualProjectPayload(
  payload: ParsedStoredPayload<Partial<PublicNoticeProject>>,
  owner: WorkspaceStorageOwner
) {
  if (payload.owner && !workspaceStorageOwnersMatch(payload.owner, owner)) {
    return false;
  }

  if (owner.kind !== 'member') {
    return Boolean(payload.owner);
  }

  const applicationPayload = readStoragePayload<Partial<UserProjectRecord>>(APPLICATION_STORAGE_KEY);
  if (!applicationPayload) {
    return false;
  }

  const applicationOwnerMatches =
    (!applicationPayload.owner ||
      workspaceStorageOwnersMatch(applicationPayload.owner, owner)) &&
    canMigrateLegacyApplicationItems(applicationPayload.items, owner.userId);

  return (
    applicationOwnerMatches &&
    manualProjectItemsAreReferenced(payload.items, applicationPayload.items)
  );
}

function readStoredManualProjectsPayload(
  owner = getCurrentWorkspaceStorageContext().owner
) {
  const context = getWorkspaceStorageKeysForOwner(owner);
  const scopedPayload = readStoragePayload<Partial<PublicNoticeProject>>(context.manualProjects);
  let payload = scopedPayload;

  if (scopedPayload && !workspaceStorageOwnersMatch(scopedPayload.owner, context.owner)) {
    return createEmptyWorkspacePayload<PublicNoticeProject>(context.owner);
  }

  if (!payload) {
    const legacyPayload = readStoragePayload<Partial<PublicNoticeProject>>(MANUAL_PROJECT_STORAGE_KEY);
    if (legacyPayload && canMigrateLegacyManualProjectPayload(legacyPayload, context.owner)) {
      payload = legacyPayload;
    }
  }

  if (!payload) {
    return createEmptyWorkspacePayload<PublicNoticeProject>(context.owner);
  }

  const normalizedItems = payload.items
      .filter((item): item is Partial<PublicNoticeProject> => Boolean(item && typeof item === 'object'))
      .map((item) => normalizeManualProject(item));

  if (!scopedPayload) {
    persistStoragePayload(
      context.manualProjects,
      context.owner,
      normalizedItems,
      payload.updatedAt || nowIsoText()
    );
  }

  return {
    version: WORKSPACE_STORAGE_VERSION,
    owner: context.owner,
    updatedAt: payload.updatedAt,
    items: normalizedItems
  };
}

function persistStoredManualProjects(
  projects: PublicNoticeProject[],
  updatedAt = nowIsoText(),
  emit = true,
  owner = getCurrentWorkspaceStorageContext().owner
) {
  const context = getWorkspaceStorageKeysForOwner(owner);
  persistStoragePayload(context.manualProjects, context.owner, projects, updatedAt);

  if (emit) {
    emitApplicationUpdate();
  }
}

function readStoredManualProjects(owner = getCurrentWorkspaceStorageContext().owner) {
  return readStoredManualProjectsPayload(owner).items;
}

function readStoredRecordsPayload(owner = getCurrentWorkspaceStorageContext().owner) {
  const context = getWorkspaceStorageKeysForOwner(owner);
  const scopedPayload = readStoragePayload<Partial<UserProjectRecord>>(context.applications);
  let payload = scopedPayload;

  if (scopedPayload && !workspaceStorageOwnersMatch(scopedPayload.owner, context.owner)) {
    return createEmptyWorkspacePayload<UserProjectRecord>(context.owner);
  }

  if (!payload) {
    const legacyPayload = readStoragePayload<Partial<UserProjectRecord>>(APPLICATION_STORAGE_KEY);
    if (legacyPayload && canMigrateLegacyApplicationPayload(legacyPayload, context.owner)) {
      payload = legacyPayload;
    }
  }

  if (!payload) {
    return createEmptyWorkspacePayload<UserProjectRecord>(context.owner);
  }

  const expectedUserId = getRecordUserIdForOwner(context.owner);
  const normalizedItems = payload.items
      .filter((item): item is Partial<UserProjectRecord> => Boolean(item && typeof item === 'object'))
      .map((item) => normalizeRecord(item, expectedUserId))
      .filter((item) => item.userId === expectedUserId);

  if (!scopedPayload) {
    persistStoragePayload(
      context.applications,
      context.owner,
      normalizedItems,
      payload.updatedAt || nowIsoText()
    );
  }

  return {
    version: WORKSPACE_STORAGE_VERSION,
    owner: context.owner,
    updatedAt: payload.updatedAt,
    items: normalizedItems
  };
}

function persistStoredRecords(
  records: UserProjectRecord[],
  updatedAt = nowIsoText(),
  emit = true,
  owner = getCurrentWorkspaceStorageContext().owner
) {
  const context = getWorkspaceStorageKeysForOwner(owner);
  const expectedUserId = getRecordUserIdForOwner(context.owner);
  const ownedRecords = records
    .map((record) => normalizeRecord(record, expectedUserId))
    .filter((record) => record.userId === expectedUserId);
  persistStoragePayload(context.applications, context.owner, ownedRecords, updatedAt);

  if (emit) {
    emitApplicationUpdate();
  }
}

function readStoredRecords(owner = getCurrentWorkspaceStorageContext().owner) {
  return readStoredRecordsPayload(owner).items;
}

function mergeByKey<T>(remoteItems: T[], localItems: T[], getKey: (item: T) => string) {
  const merged = new Map<string, T>();

  const getUpdatedTimestamp = (item: T) => {
    if (!item || typeof item !== 'object') {
      return 0;
    }

    const record = item as Record<string, unknown>;
    const value = record.updatedAt || record.updated_at_ts || record.updated_at || record.createdAt || record.created_at;
    const timestamp = typeof value === 'string' ? Date.parse(value) : Number.NaN;
    return Number.isFinite(timestamp) ? timestamp : 0;
  };

  for (const item of remoteItems) {
    const key = getKey(item);
    if (key) {
      merged.set(key, item);
    }
  }

  // Prefer the newest version. If both versions do not carry a timestamp,
  // the cloud record remains canonical for a signed-in workspace.
  for (const item of localItems) {
    const key = getKey(item);
    const remote = key ? merged.get(key) : undefined;
    if (key && (!remote || getUpdatedTimestamp(item) > getUpdatedTimestamp(remote))) {
      merged.set(key, item);
    }
  }

  return Array.from(merged.values());
}

function logWorkspaceSyncWarning(action: string, error: unknown) {
  console.warn(`[Seekoffer][workspace] ${action} failed`, error);
}

function getCloudflareMemberContext() {
  const session = getUserSession();
  if (!session || session.authProvider === 'anonymous' || !session.userId) {
    return null;
  }

  return {
    userId: session.userId,
    session
  };
}

function isActiveWorkspaceMember(userId: string) {
  return getCloudflareMemberContext()?.userId === userId;
}

function releaseStaleWorkspaceHydration(userId: string) {
  if (hydratedWorkspaceUserId === userId) {
    hydratedWorkspaceUserId = '';
    hydrateWorkspacePromise = null;
  }
}

function mapApplicationRowToRecord(row: Record<string, unknown>) {
  return normalizeRecord({
    userProjectId: String(row.id || `user-${row.project_id || row.projectId}`),
    userId: String(row.user_id || row.userId || ''),
    projectId: String(row.project_id || row.projectId || ''),
    isFavorited: Boolean(row.is_favorited ?? row.isFavorited ?? true),
    myStatus: String(row.my_status || row.myStatus || '已收藏') as UserProjectStatus,
    priorityLevel: String(row.priority_level || row.priorityLevel || '中') as UserProjectRecord['priorityLevel'],
    materialsProgress: Number(row.materials_progress ?? row.materialsProgress ?? 0),
    cvReady: Boolean(row.cv_ready ?? row.cvReady),
    transcriptReady: Boolean(row.transcript_ready ?? row.transcriptReady),
    rankingProofReady: Boolean(row.ranking_proof_ready ?? row.rankingProofReady),
    recommendationReady: Boolean(row.recommendation_ready ?? row.recommendationReady),
    personalStatementReady: Boolean(row.personal_statement_ready ?? row.personalStatementReady),
    contactSupervisorDone: Boolean(row.contact_supervisor_done ?? row.contactSupervisorDone),
    submittedAt: String(row.submitted_at || row.submittedAt || ''),
    interviewTime: String(row.interview_time || row.interviewTime || ''),
    resultStatus: String(row.result_status || row.resultStatus || '未出结果') as UserProjectRecord['resultStatus'],
    myNotes: String(row.my_notes || row.myNotes || ''),
    customReminderEnabled: Boolean(row.custom_reminder_enabled ?? row.customReminderEnabled ?? true)
  });
}

function profileHasMeaningfulContent(profile: UserProfile | null | undefined) {
  if (!profile) {
    return false;
  }

  return Object.values(profile).some((value) => String(value || '').trim());
}

async function upsertRemoteManualProjects(
  projects: PublicNoticeProject[],
  sourceOwner: WorkspaceStorageOwner
) {
  // D1 deliberately exposes manual-project creation as an idempotent command,
  // while it does not expose a bulk replacement endpoint. Existing manual
  // entries remain durable in the account-scoped local snapshot until their
  // create command is submitted from the add-entry flow.
  void projects;
  void sourceOwner;
}

async function upsertRemoteApplications(
  records: UserProjectRecord[],
  sourceOwner: WorkspaceStorageOwner
) {
  const context = getCloudflareMemberContext();
  if (
    !context ||
    sourceOwner.kind !== 'member' ||
    sourceOwner.userId !== context.userId ||
    !records.length
  ) {
    return;
  }

  const ownedRecords = records.filter((record) => record.userId === context.userId);
  if (!ownedRecords.length) {
    return;
  }

  const remoteRecords = await fetchRemoteApplications(context.userId);
  const remoteByProject = new Map(remoteRecords.map((record) => [record.projectId, record]));

  for (const record of ownedRecords) {
    let remote = remoteByProject.get(record.projectId);
    if (!remote) {
      try {
        const created = await cloudflareRequest<{ id?: string; sync_revision?: number }>(
          '/v1/me/applications',
          { method: 'POST', body: JSON.stringify({ projectId: record.projectId }) },
          true
        );
        remote = {
          ...record,
          userProjectId: String(created.id || ''),
          syncRevision: Number(created.sync_revision || 1)
        } as UserProjectRecord & { syncRevision?: number };
      } catch (error) {
        // A manual project may still be local-only. It will be retried after
        // the explicit D1 manual-project create flow has produced its ID.
        if (String((error as { code?: unknown })?.code || '') === 'NOTICE_UNAVAILABLE') continue;
        throw error;
      }
    }

    const remoteRevision = Number((remote as UserProjectRecord & { syncRevision?: number }).syncRevision || 1);
    await cloudflareRequest(
      `/v1/me/applications/${encodeURIComponent(String(remote.userProjectId))}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          expectedRevision: remoteRevision,
          patch: mapRecordToApplicationPatch(record)
        })
      },
      true
    );
  }
}
function mapRecordToApplicationPatch(record: UserProjectRecord) {
  return {
    is_favorited: record.isFavorited,
    my_status: record.myStatus,
    priority_level: record.priorityLevel,
    materials_progress: record.materialsProgress,
    cv_ready: record.cvReady,
    transcript_ready: record.transcriptReady,
    ranking_proof_ready: record.rankingProofReady,
    recommendation_ready: record.recommendationReady,
    personal_statement_ready: record.personalStatementReady,
    contact_supervisor_done: record.contactSupervisorDone,
    submitted_at: record.submittedAt,
    interview_time: record.interviewTime,
    result_status: record.resultStatus,
    my_notes: record.myNotes,
    custom_reminder_enabled: record.customReminderEnabled
  };
}

const manualApplicationSyncCoordinator = createKeyedSyncRetryCoordinator({
  execute: async (userId) => {
    if (!isActiveWorkspaceMember(userId)) {
      return;
    }

    const storageOwner: WorkspaceStorageOwner = { kind: 'member', userId };

    // Always read the latest durable snapshots at attempt time. This covers a
    // second local write that lands while the previous request is in flight and
    // also makes retry safe after transient network or RLS failures.
    const manualProjects = readStoredManualProjects(storageOwner);
    const records = readStoredRecords(storageOwner).filter(
      (record) => record.userId === userId
    );

    if (!isActiveWorkspaceMember(userId)) {
      return;
    }

    await Promise.all([
      upsertRemoteManualProjects(manualProjects, storageOwner),
      upsertRemoteApplications(records, storageOwner)
    ]);
  },
  isEligible: (userId) => isActiveWorkspaceMember(userId),
  retryDelaysMs: [2_000, 10_000, 30_000, 120_000],
  // A prolonged service incident must not strand a locally durable change.
  // After the responsive retry window, keep one low-frequency wake-up per
  // account; an `online` event still retries immediately.
  exhaustedRetryDelayMs: 10 * 60_000,
  onError: (_userId, error) => {
    // Local storage remains authoritative for the pending mutation. The
    // coordinator retries from those snapshots instead of retaining stale
    // in-memory request payloads.
    logWorkspaceSyncWarning('manual-application-add-sync', error);
  },
  onSuccess: () => {
    emitApplicationUpdate();
  }
});

let manualApplicationOnlineListenerAttached = false;

function scheduleManualApplicationWorkspaceSync(owner: WorkspaceStorageOwner) {
  if (owner.kind !== 'member' || !isActiveWorkspaceMember(owner.userId)) {
    return;
  }

  if (typeof window !== 'undefined' && !manualApplicationOnlineListenerAttached) {
    window.addEventListener('online', () => {
      manualApplicationSyncCoordinator.notifyOnline();
    });
    manualApplicationOnlineListenerAttached = true;
  }

  manualApplicationSyncCoordinator.request(owner.userId);
}

async function assertApplicationQuota(currentCount: number) {
  const quota = await canCreateMoreApplications(currentCount);
  if (!quota.allowed) {
    throw new Error(
      `免费版最多可跟进 ${quota.freeLimit} 个申请项目。升级 Pro 后可以无限加入申请、使用高级提醒和后续导出能力。`
    );
  }
}

async function deleteRemoteApplication(projectId: string, sourceOwner: WorkspaceStorageOwner) {
  const context = getCloudflareMemberContext();
  if (
    !context ||
    sourceOwner.kind !== 'member' ||
    sourceOwner.userId !== context.userId ||
    !projectId
  ) {
    return;
  }

  const remote = (await fetchRemoteApplications(context.userId)).find((record) => record.projectId === projectId);
  if (!remote) return;
  const revision = Number((remote as UserProjectRecord & { syncRevision?: number }).syncRevision || 1);
  await cloudflareRequest(
    `/v1/me/applications/${encodeURIComponent(remote.userProjectId)}`,
    { method: 'DELETE', body: JSON.stringify({ expectedRevision: revision }) },
    true
  );
}

async function deleteRemoteManualProject(projectId: string, sourceOwner: WorkspaceStorageOwner) {
  void projectId;
  void sourceOwner;
}

async function upsertRemoteProfile(profile: UserProfile | null | undefined) {
  const context = getCloudflareMemberContext();
  if (!context || !profileHasMeaningfulContent(profile)) {
    return;
  }
  const remote = await fetchRemoteProfile(context.userId);
  const expectedRevision = Number(remote?.sync_revision || 1);
  await cloudflareRequest(
    '/v1/me/profile',
    {
      method: 'PUT',
      body: JSON.stringify({
        expectedRevision,
        patch: {
          nickname: profile?.nickname || '',
          age: profile?.age || '',
          undergraduate_school: profile?.undergraduateSchool || '',
          major: profile?.major || '',
          grade: profile?.grade || '大四',
          target_major: profile?.targetMajor || '',
          target_region: profile?.targetRegion || ''
        }
      })
    },
    true
  );
}

async function fetchRemoteManualProjects(expectedUserId?: string) {
  void expectedUserId;
  return [] as PublicNoticeProject[];
}

async function fetchRemoteApplications(expectedUserId?: string) {
  const context = getCloudflareMemberContext();
  if (!context || (expectedUserId && context.userId !== expectedUserId)) {
    return [] as UserProjectRecord[];
  }

  const rows: Record<string, unknown>[] = [];
  let cursor = '';
  do {
    const suffix = cursor ? `?after=${encodeURIComponent(cursor)}` : '';
    const result = await cloudflareRequest<{
      items?: Record<string, unknown>[];
      nextCursor?: string | null;
    }>(`/v1/me/applications${suffix}`, {}, true);
    const items = Array.isArray(result.items) ? result.items : [];
    rows.push(...items);
    cursor = String(result.nextCursor || '');
    if (!items.length) break;
  } while (cursor);
  return rows.map((row) => ({ ...mapApplicationRowToRecord(row), syncRevision: Number(row.sync_revision || 1) } as UserProjectRecord));
}

async function fetchRemoteProfile(expectedUserId?: string) {
  const context = getCloudflareMemberContext();
  if (!context || (expectedUserId && context.userId !== expectedUserId)) {
    return null;
  }

  const row = await cloudflareRequest<({
    id?: string;
    nickname?: string;
    age?: string | number;
    undergraduate_school?: string;
    major?: string;
    grade?: string;
    target_major?: string;
    target_region?: string;
    sync_revision?: number;
  }) | null>('/v1/me/profile', {}, true);
  if (!row?.id) return null;
  return {
    id: row.id,
    nickname: String(row.nickname || ''),
    age: String(row.age || ''),
    undergraduateSchool: String(row.undergraduate_school || ''),
    major: String(row.major || ''),
    grade: String(row.grade || '大四'),
    targetMajor: String(row.target_major || ''),
    targetRegion: String(row.target_region || ''),
    sync_revision: Number(row.sync_revision || 1)
  } satisfies RemoteProfile;
}

async function hydrateWorkspaceFromCloudflare() {
  const context = getCloudflareMemberContext();
  if (!context) {
    hydratedWorkspaceUserId = '';
    hydrateWorkspacePromise = null;
    return;
  }

  if (hydratedWorkspaceUserId !== context.userId) {
    hydratedWorkspaceUserId = context.userId;
    hydrateWorkspacePromise = null;
  }

  if (!hydrateWorkspacePromise) {
    hydrateWorkspacePromise = (async () => {
      const storageOwner: WorkspaceStorageOwner = {
        kind: 'member',
        userId: context.userId
      };
      const localManualPayload = readStoredManualProjectsPayload(storageOwner);
      const localApplicationPayload = readStoredRecordsPayload(storageOwner);
      const localManualProjects = localManualPayload.items;
      const localApplications = localApplicationPayload.items.filter(
        (record) => record.userId === context.userId
      );
      const localProfile = getUserSession()?.profile;

      if (!isActiveWorkspaceMember(context.userId)) {
        releaseStaleWorkspaceHydration(context.userId);
        return;
      }

      const pushResults = await Promise.allSettled([
        upsertRemoteManualProjects(localManualProjects, localManualPayload.owner),
        upsertRemoteApplications(localApplications, localApplicationPayload.owner),
        upsertRemoteProfile(localProfile)
      ]);

      pushResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          logWorkspaceSyncWarning(['manual-project-push', 'application-push', 'profile-push'][index], result.reason);
        }
      });

      if (!isActiveWorkspaceMember(context.userId)) {
        releaseStaleWorkspaceHydration(context.userId);
        return;
      }

      const [manualProjectsResult, applicationsResult, profileResult] = await Promise.allSettled([
        fetchRemoteManualProjects(context.userId),
        fetchRemoteApplications(context.userId),
        fetchRemoteProfile(context.userId)
      ]);

      if (manualProjectsResult.status === 'rejected') {
        logWorkspaceSyncWarning('manual-project-fetch', manualProjectsResult.reason);
      }

      if (applicationsResult.status === 'rejected') {
        logWorkspaceSyncWarning('application-fetch', applicationsResult.reason);
      }

      if (profileResult.status === 'rejected') {
        logWorkspaceSyncWarning('profile-fetch', profileResult.reason);
      }

      const remoteManualProjects = manualProjectsResult.status === 'fulfilled' ? manualProjectsResult.value : [];
      const remoteApplications =
        applicationsResult.status === 'fulfilled'
          ? applicationsResult.value.filter((record) => record.userId === context.userId)
          : [];
      const remoteProfile = profileResult.status === 'fulfilled' ? profileResult.value : null;

      if (!isActiveWorkspaceMember(context.userId)) {
        releaseStaleWorkspaceHydration(context.userId);
        return;
      }

      persistStoredManualProjects(
        mergeByKey(remoteManualProjects, localManualProjects, (project) => project.id),
        nowIsoText(),
        false,
        storageOwner
      );
      persistStoredRecords(
        mergeByKey(remoteApplications, localApplications, (record) => record.projectId),
        nowIsoText(),
        false,
        storageOwner
      );

      if (remoteProfile && profileHasMeaningfulContent(remoteProfile)) {
        updateUserProfile(remoteProfile);
      }
    })();
  }

  await hydrateWorkspacePromise;
}

/**
 * Performs an explicit, account-scoped round trip for the desktop "Sync now"
 * action. The regular hydration path is intentionally tolerant so the product
 * can keep working offline; this strict path instead rejects when any required
 * application-workspace operation fails so Settings can report an honest
 * success or error state without navigating to the workbench.
 */
export async function synchronizeApplicationWorkspace(expectedUserId: string) {
  const userId = expectedUserId.trim();
  const context = getCloudflareMemberContext();
  if (!userId || !context || context.userId !== userId || !isActiveWorkspaceMember(userId)) {
    throw new Error('The active workspace account changed before synchronization started.');
  }

  const storageOwner: WorkspaceStorageOwner = { kind: 'member', userId };
  const localManualPayload = readStoredManualProjectsPayload(storageOwner);
  const localApplicationPayload = readStoredRecordsPayload(storageOwner);
  const localManualProjects = localManualPayload.items;
  const localApplications = localApplicationPayload.items.filter(
    (record) => record.userId === userId
  );
  const localProfile = getUserSession()?.profile;

  await Promise.all([
    upsertRemoteManualProjects(localManualProjects, localManualPayload.owner),
    upsertRemoteApplications(localApplications, localApplicationPayload.owner),
    upsertRemoteProfile(localProfile)
  ]);

  if (!isActiveWorkspaceMember(userId)) {
    throw new Error('The active workspace account changed during synchronization.');
  }

  const [remoteManualProjects, remoteApplications, remoteProfile] = await Promise.all([
    fetchRemoteManualProjects(userId),
    fetchRemoteApplications(userId),
    fetchRemoteProfile(userId)
  ]);

  if (!isActiveWorkspaceMember(userId)) {
    throw new Error('The active workspace account changed during synchronization.');
  }

  persistStoredManualProjects(
    mergeByKey(remoteManualProjects, localManualProjects, (project) => project.id),
    nowIsoText(),
    false,
    storageOwner
  );
  persistStoredRecords(
    mergeByKey(
      remoteApplications.filter((record) => record.userId === userId),
      localApplications,
      (record) => record.projectId
    ),
    nowIsoText(),
    false,
    storageOwner
  );

  if (remoteProfile && profileHasMeaningfulContent(remoteProfile)) {
    updateUserProfile(remoteProfile);
  }

  hydratedWorkspaceUserId = userId;
  hydrateWorkspacePromise = Promise.resolve();
  emitApplicationUpdate();
}

async function readRemotePublicNotices() {
  const [latest, deadlines] = await Promise.all([
    cloudflareRequest<{ items?: Record<string, unknown>[] }>(
      `/v1/notices?page=1&pageSize=${PUBLIC_NOTICE_COMPACT_PAGE_SIZE}&year=${NOTICE_TARGET_YEAR}&sort=publish`
    ),
    cloudflareRequest<{ items?: Record<string, unknown>[] }>(
      `/v1/notices?page=1&pageSize=${PUBLIC_NOTICE_COMPACT_PAGE_SIZE}&year=${NOTICE_TARGET_YEAR}&status=报名中&deadline=within7days&sort=deadline`
    )
  ]);
  const byId = new Map<string, Record<string, unknown>>();
  [...(latest.items || []), ...(deadlines.items || [])].forEach((row) => {
    const id = String(row.id || '').trim();
    if (id) byId.set(id, row);
  });

  return [...byId.values()]
    .map((row) => mapD1NoticeRowToProject(row))
    .filter(Boolean) as PublicNoticeProject[];
}

export function watchApplicationTable(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handler = () => callback();
  window.addEventListener(APPLICATION_EVENT_NAME, handler);
  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener(APPLICATION_EVENT_NAME, handler);
    window.removeEventListener('storage', handler);
  };
}

export async function fetchPublicNotices(options: { refresh?: boolean } = {}) {
  if (options.refresh) {
    publicNoticeCachePromise = null;
  }

  if (!publicNoticeCachePromise) {
    publicNoticeCachePromise = (async () => {
      try {
        const remoteProjects = await readRemotePublicNotices();
        if (!remoteProjects.length) {
          return filterMainNoticeProjects(baseNoticeProjects);
        }

        // Once Cloudflare D1 has data, it becomes the moderation source of truth.
        // Local JSON is only a disaster-recovery fallback; otherwise admin hide/delete
        // actions would be reintroduced by the bundled static seed data.
        return sortProjectsByFreshness(filterMainNoticeProjects(remoteProjects));
      } catch {
        return filterMainNoticeProjects(baseNoticeProjects);
      }
    })();
  }

  return publicNoticeCachePromise;
}

export async function fetchNoticeById(id: string) {
  const normalizedId = id.trim();
  if (!normalizedId) return null;
  const owner = getCurrentWorkspaceStorageContext().owner;
  const manual = readStoredManualProjects(owner).find((item) => item.id === normalizedId);
  if (manual) return manual;

  try {
    const row = await cloudflareRequest<Record<string, unknown>>(
      `/v1/notices/${encodeURIComponent(normalizedId)}`
    );
    return mapD1NoticeRowToProject(row);
  } catch {
    return baseNoticeProjects.find((item) => item.id === normalizedId) || null;
  }
}

function buildUnavailableNoticeProject(projectId: string): PublicNoticeProject {
  return {
    id: projectId,
    schoolName: '原通知暂不可用',
    departmentName: '你的申请记录仍已保留',
    projectName: '这条通知可能已下架、删除或暂时无法访问',
    projectType: '正式推免',
    discipline: '原通知信息暂不可用',
    publishDate: '',
    deadlineDate: '',
    eventStartDate: '',
    eventEndDate: '',
    applyLink: '',
    sourceLink: '',
    requirements: '',
    materialsRequired: [],
    examInterviewInfo: '',
    contactInfo: '',
    remarks: '',
    tags: ['申请记录已保留'],
    status: '报名中',
    year: NOTICE_TARGET_YEAR,
    deadlineLevel: 'future',
    sourceSite: '通知暂不可用',
    collectedAt: '',
    updatedAt: '',
    lastCheckedAt: '',
    isVerified: false,
    changeLog: [],
    historyRecords: []
  };
}

export async function fetchDeadlineNotices() {
  const projects = await fetchPublicNotices();
  return projects.filter((item) => getDeadlineLevelFromDate(item.deadlineDate) !== 'future');
}

export async function fetchUserProjects() {
  await hydrateWorkspaceFromCloudflare();
  return readStoredRecords();
}

export async function fetchApplicationRows(expectedUserId?: string) {
  const owner: WorkspaceStorageOwner = expectedUserId
    ? { kind: 'member', userId: expectedUserId }
    : getCurrentWorkspaceStorageContext().owner;
  await hydrateWorkspaceFromCloudflare();
  const records = readStoredRecords(owner);
  const manualProjects = readStoredManualProjects(owner);
  const projectMap = new Map<string, PublicNoticeProject>(
    [...baseNoticeProjects, ...manualProjects].map((project) => [project.id, project])
  );

  const projectIds = records.map((record) => record.projectId).filter(Boolean);
  if (projectIds.length) {
    const context = getCloudflareMemberContext();
    try {
      const result =
        owner.kind === 'member' && context?.userId === owner.userId
          ? await cloudflareRequest<{ items?: Record<string, unknown>[] }>(
              '/v1/me/notices/by-ids',
              { method: 'POST', body: JSON.stringify({ ids: projectIds }) },
              true
            )
          : await cloudflareRequest<{ items?: Record<string, unknown>[] }>(
              '/v1/notices/by-ids',
              { method: 'POST', body: JSON.stringify({ ids: projectIds }) }
            );
      (result.items || [])
        .map((row) => mapD1NoticeRowToProject(row))
        .filter(Boolean)
        .forEach((project) => projectMap.set(project!.id, project!));
    } catch {
      // Local seed data remains available when the public API is rate limited
      // or temporarily unavailable. The row stays visible with its original
      // project id if neither source contains the project.
    }
  }

  const rows = records.reduce<ApplicationRow[]>((list, item) => {
    const project = projectMap.get(item.projectId);
    list.push({
      item,
      project: project || buildUnavailableNoticeProject(item.projectId),
      noticeAvailable: Boolean(project),
      noticeAvailability: project ? 'available' : 'lookup-failed'
    });
    return list;
  }, []);

  return rows.sort((left, right) => {
    if (left.noticeAvailable !== right.noticeAvailable) return left.noticeAvailable ? -1 : 1;
    return left.project.deadlineDate.localeCompare(right.project.deadlineDate);
  });
}

/**
 * Reads the account-scoped workspace without waiting for the network hydration
 * pass. The desktop shell uses this as its cold-start snapshot, then performs a
 * bounded background revalidation through `fetchApplicationRows`.
 */
export function readLocalApplicationRows(expectedUserId: string) {
  const normalizedUserId = expectedUserId.trim();
  if (!normalizedUserId) return [];

  const owner: WorkspaceStorageOwner = { kind: 'member', userId: normalizedUserId };
  const records = readStoredRecords(owner);
  const projectMap = new Map<string, PublicNoticeProject>();

  [...baseNoticeProjects, ...readStoredManualProjects(owner)].forEach((project) => {
    projectMap.set(project.id, project);
  });

  return records
    .reduce<ApplicationRow[]>((rows, item) => {
      const project = projectMap.get(item.projectId);
      rows.push({
        item,
        project: project || buildUnavailableNoticeProject(item.projectId),
        noticeAvailable: Boolean(project),
        noticeAvailability: project ? 'available' : 'lookup-failed'
      });
      return rows;
    }, [])
    .sort((left, right) => {
      if (left.noticeAvailable !== right.noticeAvailable) return left.noticeAvailable ? -1 : 1;
      return left.project.deadlineDate.localeCompare(right.project.deadlineDate);
    });
}

export async function addProjectToApplicationTable(projectId: string) {
  await hydrateWorkspaceFromCloudflare();
  const storageOwner = getCurrentWorkspaceStorageContext().owner;
  const current = readStoredRecords(storageOwner);
  const existing = current.find((item) => item.projectId === projectId);

  if (existing) {
    return existing;
  }

  await assertApplicationQuota(current.length);

  const created = buildDefaultRecord(projectId, getRecordUserIdForOwner(storageOwner));
  const nextRecords = [...current, created];
  persistStoredRecords(nextRecords, nowIsoText(), true, storageOwner);

  try {
    await upsertRemoteApplications(nextRecords, storageOwner);
  } catch (error) {
    // Keep the user action locally even if the remote sync is temporarily
    // blocked by stale notice mirrors, network issues, or RLS changes.
    logWorkspaceSyncWarning('application-add-sync', error);
  }

  return created;
}

function assertManualApplicationMemberOwner(
  owner: WorkspaceStorageOwner,
  expectedUserId?: string
): asserts owner is Extract<WorkspaceStorageOwner, { kind: 'member' }> {
  const normalizedExpectedUserId = expectedUserId?.trim() || '';
  const ownerMatchesExpected =
    !normalizedExpectedUserId ||
    (owner.kind === 'member' && owner.userId === normalizedExpectedUserId);

  if (
    owner.kind !== 'member' ||
    !ownerMatchesExpected ||
    !isActiveWorkspaceMember(owner.userId)
  ) {
    throw new Error('登录账号已发生变化，请重新打开添加窗口后再试。');
  }
}

function persistManualApplicationWorkspaceAtomically(
  owner: Extract<WorkspaceStorageOwner, { kind: 'member' }>,
  manualProjects: PublicNoticeProject[],
  records: UserProjectRecord[]
) {
  if (!canUseBrowserStorage()) {
    throw new Error('当前设备无法使用本地存储，请检查系统权限后再试。');
  }

  const storageKeys = getWorkspaceStorageKeysForOwner(owner);
  const snapshots = [storageKeys.manualProjects, storageKeys.applications].map((key) => ({
    key,
    value: window.localStorage.getItem(key)
  }));
  const updatedAt = nowIsoText();

  try {
    persistStoredManualProjects(manualProjects, updatedAt, false, owner);
    persistStoredRecords(records, updatedAt, false, owner);
  } catch (error) {
    // localStorage has no multi-key transaction. Restore the exact serialized
    // payloads (including owner/version/timestamps) so observers can never see
    // a half-created manual application.
    for (const snapshot of snapshots) {
      try {
        if (snapshot.value === null) {
          window.localStorage.removeItem(snapshot.key);
        } else {
          window.localStorage.setItem(snapshot.key, snapshot.value);
        }
      } catch (rollbackError) {
        logWorkspaceSyncWarning('manual-application-local-rollback', rollbackError);
      }
    }

    throw error;
  }

  emitApplicationUpdate();
}

export async function createManualApplicationEntry(
  input: ManualProjectInput,
  expectedUserId?: string
) {
  // Capture and verify the account before any quota/network await. Manual
  // entries are never allowed to fall back to anonymous/local workspace keys.
  const storageOwner = getCurrentWorkspaceStorageContext().owner;
  assertManualApplicationMemberOwner(storageOwner, expectedUserId);
  const recordsAtQuotaCheck = readStoredRecords(storageOwner);
  await assertApplicationQuota(recordsAtQuotaCheck.length);

  // The user may sign out or switch accounts while quota is being checked.
  // Re-read the active owner and both durable lists before creating either
  // scoped payload. A hydration or another local edit may have completed while
  // the quota request was in flight; using the pre-await snapshot would erase
  // that newer data.
  const activeOwner = getCurrentWorkspaceStorageContext().owner;
  assertManualApplicationMemberOwner(activeOwner, storageOwner.userId);
  const manualProjects = readStoredManualProjects(storageOwner);
  const existingRecords = readStoredRecords(storageOwner);

  const projectId = `custom-${Date.now()}`;
  const timestamp = nowText();
  const project = normalizeManualProject({
    id: projectId,
    schoolName: input.schoolName.trim(),
    departmentName: input.departmentName.trim() || '待补充',
    projectName: input.projectName.trim(),
    projectType: input.projectType,
    discipline: input.discipline.trim() || '待补充',
    publishDate: timestamp.slice(0, 10),
    deadlineDate: input.deadlineDate.trim(),
    eventStartDate: input.eventStartDate?.trim() || '',
    eventEndDate: input.eventEndDate?.trim() || '',
    applyLink: input.applyLink?.trim() || '',
    sourceLink: input.applyLink?.trim() || '',
    remarks: '用户手动录入项目',
    sourceSite: '用户手动录入',
    collectedAt: timestamp,
    updatedAt: timestamp,
    lastCheckedAt: timestamp,
    tags: ['手动录入']
  });

  const recordUserId = getRecordUserIdForOwner(storageOwner);
  const record = normalizeRecord(
    {
      ...buildDefaultRecord(project.id, recordUserId),
      projectId: project.id
    },
    recordUserId
  );

  const nextManualProjects = [...manualProjects, project];
  const nextRecords = [...existingRecords, record];
  persistManualApplicationWorkspaceAtomically(
    storageOwner,
    nextManualProjects,
    nextRecords
  );

  // Return as soon as the account-scoped local transaction is durable. Remote
  // synchronization is deliberately detached from the user's submit latency.
  scheduleManualApplicationWorkspaceSync(storageOwner);

  return {
    item: record,
    project,
    ownerUserId: storageOwner.userId,
    synced: false,
    syncPending: true
  };
}

export async function saveUserProfileToWorkspace(profile: UserProfile) {
  const context = getCloudflareMemberContext();
  if (!context) {
    return false;
  }

  await upsertRemoteProfile(profile);
  return true;
}

export async function updateUserProject(userProjectId: string, patch: Partial<UserProjectRecord>) {
  await hydrateWorkspaceFromCloudflare();
  const storageOwner = getCurrentWorkspaceStorageContext().owner;
  const recordUserId = getRecordUserIdForOwner(storageOwner);
  const current = readStoredRecords(storageOwner);
  const next = current.map((item) => {
    if (item.userProjectId !== userProjectId) {
      return item;
    }

    let merged = normalizeRecord({ ...item, ...patch, userId: recordUserId }, recordUserId);

    if (hasMaterialChecklistPatch(patch)) {
      merged = {
        ...merged,
        materialsProgress: calculateMaterialsProgress(merged)
      };
    }

    if (patch.myStatus === '已提交' && !merged.submittedAt) {
      return {
        ...merged,
        submittedAt: nowText()
      };
    }

    return merged;
  });

  persistStoredRecords(next, nowIsoText(), true, storageOwner);
  try {
    await upsertRemoteApplications(next, storageOwner);
  } catch (error) {
    // An edit is an explicit user action. If the authoritative account write
    // fails, restore the exact previous local snapshot as well so the UI,
    // cache, and next launch cannot falsely claim that the edit was saved.
    persistStoredRecords(current, nowIsoText(), true, storageOwner);
    throw error;
  }

  return next.find((item) => item.userProjectId === userProjectId) || null;
}

export async function deleteUserProject(userProjectId: string) {
  await hydrateWorkspaceFromCloudflare();

  const storageOwner = getCurrentWorkspaceStorageContext().owner;
  const currentRecords = readStoredRecords(storageOwner);
  const target = currentRecords.find((item) => item.userProjectId === userProjectId);
  if (!target) {
    return false;
  }

  const nextRecords = currentRecords.filter((item) => item.userProjectId !== userProjectId);
  const manualProjects = readStoredManualProjects(storageOwner);
  const isManualProject = manualProjects.some((project) => project.id === target.projectId);
  const nextManualProjects = isManualProject
    ? manualProjects.filter((project) => project.id !== target.projectId)
    : manualProjects;

  persistStoredRecords(nextRecords, nowIsoText(), true, storageOwner);
  if (isManualProject) {
    persistStoredManualProjects(nextManualProjects, nowIsoText(), true, storageOwner);
  }

  await deleteRemoteApplication(target.projectId, storageOwner);
  if (isManualProject) {
    await deleteRemoteManualProject(target.projectId, storageOwner);
  }

  return true;
}

export async function updateUserProjectStatus(userProjectId: string, myStatus: UserProjectStatus) {
  return updateUserProject(userProjectId, { myStatus });
}

export function getApplicationProject(projectId: string): PublicNoticeProject | null {
  const manualProject = readStoredManualProjects().find((item) => item.id === projectId);
  if (manualProject) {
    return manualProject;
  }

  return baseNoticeProjects.find((item) => item.id === projectId) || null;
}
