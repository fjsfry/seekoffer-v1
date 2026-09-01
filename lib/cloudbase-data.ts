'use client';

import { getSupabaseBrowserClient } from './supabase-browser';
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
import { canCreateMoreApplications } from './billing-api';
import { createKeyedSyncRetryCoordinator } from './keyed-sync-retry';
import {
  createStaleWhileRevalidateCache,
  type StaleWhileRevalidateSnapshot
} from './stale-while-revalidate-cache';

const APPLICATION_STORAGE_KEY = 'seekoffer-my-application-table';
const MANUAL_PROJECT_STORAGE_KEY = 'seekoffer-manual-projects';
const APPLICATION_EVENT_NAME = 'seekoffer-applications-updated';
const WORKSPACE_STORAGE_VERSION = 2;
const NOTICE_TARGET_YEAR = 2026;
const PUBLIC_NOTICE_QUERY_LIMIT = 5000;
const PUBLIC_NOTICE_QUERY_PAGE_SIZE = 1000;
export const PUBLIC_NOTICE_CACHE_KEY = 'public-notices:v1:year=2026:published';
export const PUBLIC_NOTICE_CACHE_TTL_MS = 5 * 60_000;
export const PUBLIC_NOTICE_CACHE_RETRY_MS = 15_000;
const PUBLIC_NOTICE_RUNTIME_CACHE_KEY = '__seekofferPublicNoticeCacheV1__';

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

export type ApplicationRow = {
  item: UserProjectRecord;
  project: PublicNoticeProject;
};

export type PublicNoticeLoadSnapshot = {
  rows: PublicNoticeProject[];
  source: 'remote' | 'stale' | 'fallback';
  syncedAt: number | null;
  attemptedAt: number | null;
  error: unknown | null;
  isFresh: boolean;
  isRevalidating: boolean;
  shouldRevalidate: boolean;
  revalidated: boolean;
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
const publicNoticeFallbackProjects = filterMainNoticeProjects(baseNoticeProjects);

function createPublicNoticeCache() {
  return createStaleWhileRevalidateCache<PublicNoticeProject[]>({
    ttlMs: PUBLIC_NOTICE_CACHE_TTL_MS,
    retryAfterMs: PUBLIC_NOTICE_CACHE_RETRY_MS,
    fallback: () => publicNoticeFallbackProjects
  });
}

type PublicNoticeCacheController = ReturnType<typeof createPublicNoticeCache>;
type PublicNoticeRuntimeScope = typeof globalThis & {
  [PUBLIC_NOTICE_RUNTIME_CACHE_KEY]?: PublicNoticeCacheController;
};

const publicNoticeRuntimeScope = globalThis as PublicNoticeRuntimeScope;
const publicNoticeCache =
  publicNoticeRuntimeScope[PUBLIC_NOTICE_RUNTIME_CACHE_KEY] ?? createPublicNoticeCache();
publicNoticeRuntimeScope[PUBLIC_NOTICE_RUNTIME_CACHE_KEY] = publicNoticeCache;

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

function getSupabaseMemberContext() {
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
  return getSupabaseMemberContext()?.userId === userId;
}

function releaseStaleWorkspaceHydration(userId: string) {
  if (hydratedWorkspaceUserId === userId) {
    hydratedWorkspaceUserId = '';
    hydrateWorkspacePromise = null;
  }
}

function mapNoticeRowToProject(row: Record<string, unknown>) {
  if (!row) {
    return null;
  }

  return normalizeManualProject({
    id: String(row.id || '').trim(),
    schoolName: String(row.school_name || row.schoolName || '').trim(),
    departmentName: String(row.department_name || row.departmentName || '').trim(),
    projectName: String(row.project_name || row.projectName || '').trim(),
    projectType: String(row.project_type || row.projectType || '夏令营') as ProjectType,
    discipline: String(row.discipline || '').trim(),
    publishDate: String(row.publish_date || row.publishDate || '').trim(),
    deadlineDate: String(row.deadline_date || row.deadlineDate || '').trim(),
    eventStartDate: String(row.event_start_date || row.eventStartDate || '').trim(),
    eventEndDate: String(row.event_end_date || row.eventEndDate || '').trim(),
    applyLink: String(row.apply_link || row.applyLink || '').trim(),
    sourceLink: String(row.source_link || row.sourceLink || '').trim(),
    requirements: String(row.requirements || '').trim(),
    materialsRequired: normalizeStringArray(row.materials_required || row.materialsRequired),
    examInterviewInfo: String(row.exam_interview_info || row.examInterviewInfo || '').trim(),
    contactInfo: String(row.contact_info || row.contactInfo || '').trim(),
    remarks: String(row.remarks || '').trim(),
    tags: normalizeStringArray(row.tags),
    status: String(row.status || '') as PublicNoticeProject['status'],
    year: Number(row.year || NOTICE_TARGET_YEAR),
    deadlineLevel: String(row.deadline_level || row.deadlineLevel || 'future') as DeadlineLevel,
    sourceSite: String(row.source_site || row.sourceSite || '').trim(),
    collectedAt: String(row.collected_at || row.collectedAt || '').trim(),
    updatedAt: String(row.updated_at || row.updatedAt || '').trim(),
    lastCheckedAt: String(row.last_checked_at || row.lastCheckedAt || '').trim(),
    isVerified: Boolean(row.is_verified ?? row.isVerified),
    changeLog: (Array.isArray(row.change_log) ? row.change_log : row.changeLog || []) as PublicNoticeProject['changeLog'],
    historyRecords: (Array.isArray(row.history_records) ? row.history_records : row.historyRecords || []) as PublicNoticeProject['historyRecords']
  });
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

function mapProjectToNoticeUpsert(project: PublicNoticeProject, userId: string, isPrivate: boolean) {
  return {
    id: project.id,
    school_name: project.schoolName,
    department_name: project.departmentName,
    project_name: project.projectName,
    project_type: project.projectType,
    discipline: project.discipline,
    publish_date: project.publishDate,
    deadline_date: project.deadlineDate,
    event_start_date: project.eventStartDate,
    event_end_date: project.eventEndDate,
    apply_link: project.applyLink,
    source_link: project.sourceLink,
    requirements: project.requirements,
    materials_required: project.materialsRequired,
    exam_interview_info: project.examInterviewInfo,
    contact_info: project.contactInfo,
    remarks: project.remarks,
    tags: project.tags,
    status: project.status,
    year: project.year,
    deadline_level: project.deadlineLevel,
    source_site: project.sourceSite,
    is_private: isPrivate,
    collected_at: project.collectedAt,
    updated_at: project.updatedAt,
    last_checked_at: project.lastCheckedAt,
    is_verified: project.isVerified,
    change_log: project.changeLog,
    history_records: project.historyRecords,
    created_by: userId
  };
}

function mapRecordToApplicationUpsert(record: UserProjectRecord, userId: string) {
  return {
    user_id: userId,
    project_id: record.projectId,
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
  const context = getSupabaseMemberContext();
  if (
    !context ||
    sourceOwner.kind !== 'member' ||
    sourceOwner.userId !== context.userId ||
    !projects.length
  ) {
    return;
  }

  const supabase = getSupabaseBrowserClient();
  const payload = projects.map((project) => mapProjectToNoticeUpsert(project, context.userId, true));

  const { error } = await supabase.from('notices').upsert(payload, {
    onConflict: 'id'
  });

  if (error) {
    throw error;
  }
}

async function upsertRemoteApplications(
  records: UserProjectRecord[],
  sourceOwner: WorkspaceStorageOwner
) {
  const context = getSupabaseMemberContext();
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

  const supabase = getSupabaseBrowserClient();
  const payload = ownedRecords.map((record) => mapRecordToApplicationUpsert(record, context.userId));
  const { error } = await supabase.from('applications').upsert(payload, {
    onConflict: 'user_id,project_id'
  });

  if (error) {
    throw error;
  }
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
  const context = getSupabaseMemberContext();
  if (
    !context ||
    sourceOwner.kind !== 'member' ||
    sourceOwner.userId !== context.userId ||
    !projectId
  ) {
    return;
  }

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from('applications')
    .delete()
    .eq('user_id', context.userId)
    .eq('project_id', projectId);

  if (error) {
    throw error;
  }
}

async function deleteRemoteManualProject(projectId: string, sourceOwner: WorkspaceStorageOwner) {
  const context = getSupabaseMemberContext();
  if (
    !context ||
    sourceOwner.kind !== 'member' ||
    sourceOwner.userId !== context.userId ||
    !projectId
  ) {
    return;
  }

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from('notices')
    .delete()
    .eq('id', projectId)
    .eq('created_by', context.userId)
    .eq('is_private', true);

  if (error) {
    throw error;
  }
}

async function upsertRemoteProfile(profile: UserProfile | null | undefined) {
  const context = getSupabaseMemberContext();
  if (!context || !profileHasMeaningfulContent(profile)) {
    return;
  }

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from('profiles').upsert(
    {
      id: context.userId,
      nickname: profile?.nickname || '',
      age: profile?.age || '',
      undergraduate_school: profile?.undergraduateSchool || '',
      major: profile?.major || '',
      grade: profile?.grade || '大四',
      target_major: profile?.targetMajor || '',
      target_region: profile?.targetRegion || ''
    },
    {
      onConflict: 'id'
    }
  );

  if (error) {
    throw error;
  }
}

async function fetchRemoteManualProjects(expectedUserId?: string) {
  const context = getSupabaseMemberContext();
  if (!context || (expectedUserId && context.userId !== expectedUserId)) {
    return [] as PublicNoticeProject[];
  }

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('notices')
    .select('*')
    .eq('created_by', context.userId)
    .eq('is_private', true)
    .order('updated_at_ts', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => mapNoticeRowToProject(row)).filter(Boolean) as PublicNoticeProject[];
}

async function fetchRemoteApplications(expectedUserId?: string) {
  const context = getSupabaseMemberContext();
  if (!context || (expectedUserId && context.userId !== expectedUserId)) {
    return [] as UserProjectRecord[];
  }

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('user_id', context.userId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => mapApplicationRowToRecord(row));
}

async function fetchRemoteProfile(expectedUserId?: string) {
  const context = getSupabaseMemberContext();
  if (!context || (expectedUserId && context.userId !== expectedUserId)) {
    return null;
  }

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', context.userId).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    nickname: String(data.nickname || ''),
    age: String(data.age || ''),
    undergraduateSchool: String(data.undergraduate_school || ''),
    major: String(data.major || ''),
    grade: String(data.grade || '大四'),
    targetMajor: String(data.target_major || ''),
    targetRegion: String(data.target_region || '')
  } satisfies UserProfile;
}

async function hydrateWorkspaceFromSupabase() {
  const context = getSupabaseMemberContext();
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
  const context = getSupabaseMemberContext();
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
  const supabase = getSupabaseBrowserClient();
  const rows: Record<string, unknown>[] = [];

  for (let from = 0; from < PUBLIC_NOTICE_QUERY_LIMIT; from += PUBLIC_NOTICE_QUERY_PAGE_SIZE) {
    const to = Math.min(from + PUBLIC_NOTICE_QUERY_PAGE_SIZE - 1, PUBLIC_NOTICE_QUERY_LIMIT - 1);
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .eq('year', NOTICE_TARGET_YEAR)
      .eq('is_private', false)
      .eq('admin_status', 'published')
      .is('admin_deleted_at', null)
      .order('publish_date', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    const pageRows = (data || []) as Record<string, unknown>[];
    rows.push(...pageRows);

    if (pageRows.length < PUBLIC_NOTICE_QUERY_PAGE_SIZE) {
      break;
    }
  }

  return rows.map((row) => mapNoticeRowToProject(row)).filter(Boolean) as PublicNoticeProject[];
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

function mapPublicNoticeSnapshot(
  snapshot: StaleWhileRevalidateSnapshot<PublicNoticeProject[]>
): PublicNoticeLoadSnapshot {
  return {
    rows: snapshot.value,
    source: snapshot.source,
    syncedAt: snapshot.syncedAt,
    attemptedAt: snapshot.attemptedAt,
    error: snapshot.error,
    isFresh: snapshot.isFresh,
    isRevalidating: snapshot.isRevalidating,
    shouldRevalidate: snapshot.shouldRevalidate,
    revalidated: snapshot.revalidated
  };
}

export function getPublicNoticeSnapshot() {
  return mapPublicNoticeSnapshot(publicNoticeCache.getSnapshot());
}

export async function loadPublicNotices(options: { refresh?: boolean } = {}) {
  const snapshot = await publicNoticeCache.request(
    async () => {
      const remoteProjects = await readRemotePublicNotices();

      // Supabase moderation is authoritative after a successful request. An
      // empty result is therefore a valid snapshot, not a reason to restore
      // bundled notices that may have since been hidden or deleted.
      return sortProjectsByFreshness(filterMainNoticeProjects(remoteProjects));
    },
    { force: options.refresh === true }
  );

  return mapPublicNoticeSnapshot(snapshot);
}

export async function fetchPublicNotices(options: { refresh?: boolean } = {}) {
  return (await loadPublicNotices(options)).rows;
}

async function getAllProjectsAsync(owner = getCurrentWorkspaceStorageContext().owner) {
  const noticeProjects = await fetchPublicNotices();
  const manualProjects = readStoredManualProjects(owner);
  const projectMap = new Map<string, PublicNoticeProject>();

  [...noticeProjects, ...manualProjects].forEach((project) => {
    projectMap.set(project.id, project);
  });

  return Array.from(projectMap.values());
}

export async function fetchNoticeById(id: string) {
  const source = await getAllProjectsAsync();
  return source.find((item) => item.id === id) || null;
}

export async function fetchDeadlineNotices() {
  const projects = await fetchPublicNotices();
  return projects.filter((item) => getDeadlineLevelFromDate(item.deadlineDate) !== 'future');
}

export async function fetchUserProjects() {
  await hydrateWorkspaceFromSupabase();
  return readStoredRecords();
}

export async function fetchApplicationRows(expectedUserId?: string) {
  const owner: WorkspaceStorageOwner = expectedUserId
    ? { kind: 'member', userId: expectedUserId }
    : getCurrentWorkspaceStorageContext().owner;
  await hydrateWorkspaceFromSupabase();
  const records = readStoredRecords(owner);
  const projects = await getAllProjectsAsync(owner);
  const projectMap = new Map(projects.map((project) => [project.id, project]));

  const rows = records.reduce<ApplicationRow[]>((list, item) => {
    const project = projectMap.get(item.projectId);
    if (project) {
      list.push({ item, project });
    }
    return list;
  }, []);

  return rows.sort((left, right) => left.project.deadlineDate.localeCompare(right.project.deadlineDate));
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
      if (project) rows.push({ item, project });
      return rows;
    }, [])
    .sort((left, right) => left.project.deadlineDate.localeCompare(right.project.deadlineDate));
}

export async function addProjectToApplicationTable(projectId: string) {
  await hydrateWorkspaceFromSupabase();
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
  const context = getSupabaseMemberContext();
  if (!context) {
    return false;
  }

  await upsertRemoteProfile(profile);
  return true;
}

export async function updateUserProject(userProjectId: string, patch: Partial<UserProjectRecord>) {
  await hydrateWorkspaceFromSupabase();
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
  await hydrateWorkspaceFromSupabase();

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
