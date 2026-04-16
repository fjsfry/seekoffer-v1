'use client';

import { getCloudbaseApp } from './cloudbase-web';
import { getUserSession, type UserProfile } from './user-session';
import {
  materialChecklistDefinitions,
  sampleUserProjects,
  type DeadlineLevel,
  type ProjectType,
  type MaterialChecklistKey,
  type PublicNoticeProject,
  type UserProjectRecord,
  type UserProjectStatus
} from './mock-data';
import { baseNoticeProjects } from './notice-source';

const APPLICATION_STORAGE_KEY = 'seekoffer-my-application-table';
const MANUAL_PROJECT_STORAGE_KEY = 'seekoffer-manual-projects';
const APPLICATION_EVENT_NAME = 'seekoffer-applications-updated';
const CLOUD_WORKSPACE_COLLECTION = 'web_user_workspace';
const NOTICE_COLLECTION_CANDIDATES = ['project_notices', 'calendar_notices'];
const WORKSPACE_SCHEMA_VERSION = 1;

type StoredPayload<T> = {
  updatedAt: string;
  items: T[];
};

type CloudWorkspaceDocument = {
  _id: string;
  userId: string;
  schemaVersion: number;
  updatedAt: string;
  applicationUpdatedAt?: string;
  applications?: UserProjectRecord[];
  manualProjectsUpdatedAt?: string;
  manualProjects?: PublicNoticeProject[];
  profileUpdatedAt?: string;
  profile?: UserProfile;
  aiWaitlistUpdatedAt?: string;
  aiWaitlistLead?: AiWaitlistLead;
};

export type AiWaitlistNeed = '测算胜率' | '精修申请表' | '提炼简章要求';

export type AiWaitlistLead = {
  wechatId: string;
  primaryNeed: AiWaitlistNeed;
  details: string;
  submittedAt: string;
  source: string;
};

export type ApplicationRow = {
  item: UserProjectRecord;
  project: PublicNoticeProject;
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
  '当前为体验版微信登录。申请表会同步到当前浏览器绑定的云端工作区，正式微信登录上线后将开放稳定的跨设备同步。';

let cloudCollectionChecked = false;
let cloudCollectionAvailable = false;
let hydrateWorkspacePromise: Promise<void> | null = null;

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function nowIsoText() {
  return new Date().toISOString();
}

function readStoragePayload<T>(storageKey: string): StoredPayload<T> | null {
  if (!canUseBrowserStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as T[] | StoredPayload<T>;
    if (Array.isArray(parsed)) {
      return { updatedAt: '', items: parsed };
    }

    if (parsed && Array.isArray(parsed.items)) {
      return {
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
        items: parsed.items
      };
    }
  } catch {
    return null;
  }

  return null;
}

function mapCloudNoticeDocument(document: Record<string, any>): PublicNoticeProject | null {
  const id = String(document.id || document._id || '').trim();
  const schoolName = String(document.school_name || document.schoolName || '').trim();
  const projectName = String(document.project_name || document.projectName || '').trim();

  if (!id || !schoolName || !projectName) {
    return null;
  }

  const project = normalizeManualProject({
    id,
    schoolName,
    departmentName: String(document.department_name || document.departmentName || '').trim() || '待补充',
    projectName,
    projectType: document.project_type || document.projectType || '夏令营',
    discipline: String(document.discipline || '').trim() || '待补充',
    publishDate: String(document.publish_date || document.publishDate || '').trim(),
    deadlineDate: String(document.deadline_date || document.deadlineDate || '').trim(),
    eventStartDate: String(document.event_start_date || document.eventStartDate || '').trim(),
    eventEndDate: String(document.event_end_date || document.eventEndDate || '').trim(),
    applyLink: String(document.apply_link || document.applyLink || '').trim(),
    sourceLink: String(document.source_link || document.sourceLink || '').trim(),
    requirements: String(document.requirements || '').trim(),
    materialsRequired: Array.isArray(document.materials_required)
      ? document.materials_required
      : Array.isArray(document.materialsRequired)
        ? document.materialsRequired
        : undefined,
    examInterviewInfo: String(document.exam_interview_info || document.examInterviewInfo || '').trim(),
    contactInfo: String(document.contact_info || document.contactInfo || '').trim(),
    remarks: String(document.remarks || '').trim(),
    tags: Array.isArray(document.tags) ? document.tags : undefined,
    status: document.status,
    year: Number(document.year || 2026),
    deadlineLevel: document.deadline_level || document.deadlineLevel,
    sourceSite: String(document.source_site || document.sourceSite || '').trim() || '保研通知网',
    collectedAt: String(document.created_at || document.collectedAt || '').trim(),
    updatedAt: String(document.updated_at || document.updatedAt || '').trim(),
    lastCheckedAt: String(document.last_checked_at || document.lastCheckedAt || '').trim(),
    isVerified: Boolean(document.is_verified ?? document.isVerified),
    changeLog: Array.isArray(document.change_log)
      ? document.change_log
      : Array.isArray(document.changeLog)
        ? document.changeLog
        : undefined,
    historyRecords: Array.isArray(document.history_records)
      ? document.history_records
      : Array.isArray(document.historyRecords)
        ? document.historyRecords
        : undefined
  });

  return project.year === 2026 ? project : null;
}

async function readCloudNoticeProjects() {
  if (!canUseBrowserStorage()) {
    return [] as PublicNoticeProject[];
  }

  try {
    const app = await getCloudbaseApp();
    const db = app.database();

    for (const collectionName of NOTICE_COLLECTION_CANDIDATES) {
      try {
        const result = await db.collection(collectionName).limit(500).get();
        const rows = Array.isArray(result.data) ? result.data : [];
        const mapped = rows
          .map((item: unknown) =>
            item && typeof item === 'object' ? mapCloudNoticeDocument(item as Record<string, any>) : null
          )
          .filter((item: PublicNoticeProject | null): item is PublicNoticeProject => Boolean(item))
          .sort((left: PublicNoticeProject, right: PublicNoticeProject) =>
            right.publishDate.localeCompare(left.publishDate)
          );

        if (mapped.length) {
          return mapped;
        }
      } catch {
        continue;
      }
    }
  } catch {
    return [];
  }

  return [];
}

function emitApplicationUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(APPLICATION_EVENT_NAME));
  }
}

function isCloudSyncEnabled() {
  return canUseBrowserStorage() && Boolean(getUserSession());
}

function parseDeadline(deadlineDate: string) {
  const normalized = deadlineDate.includes('T') ? deadlineDate : deadlineDate.replace(' ', 'T');
  const value = new Date(`${normalized}:00+08:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function resolveDeadlineLevel(deadlineDate: string): DeadlineLevel {
  const value = parseDeadline(deadlineDate);
  if (!value) return 'future';

  const diff = value.getTime() - Date.now();
  const day = 1000 * 60 * 60 * 24;

  if (diff <= 0) return 'expired';
  if (diff <= day) return 'today';
  if (diff <= day * 3) return 'within3days';
  if (diff <= day * 7) return 'within7days';
  return 'future';
}

function resolvePublicStatus(level: DeadlineLevel): PublicNoticeProject['status'] {
  if (level === 'expired') return '已截止';
  if (level === 'today' || level === 'within3days') return '即将截止';
  return '报名中';
}

export function calculateMaterialsProgress(record: Pick<UserProjectRecord, MaterialChecklistKey>) {
  const total = materialChecklistDefinitions.length;
  const completed = materialChecklistDefinitions.filter(({ key }) => record[key]).length;
  return Math.round((completed / total) * 100);
}

function buildDefaultRecord(projectId: string): UserProjectRecord {
  const base: UserProjectRecord = {
    userProjectId: `user-${projectId}`,
    userId: 'demo-user',
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

function normalizeManualProject(project: Partial<PublicNoticeProject>) {
  const deadlineDate = project.deadlineDate || '';
  const deadlineLevel = resolveDeadlineLevel(deadlineDate);
  const today = new Date().toISOString().slice(0, 10);

  return {
    id: project.id || `custom-${Date.now()}`,
    schoolName: project.schoolName || '手动录入项目',
    departmentName: project.departmentName || '待补充',
    projectName: project.projectName || '未命名项目',
    projectType: project.projectType || '夏令营',
    discipline: project.discipline || '待补充',
    publishDate: project.publishDate || today,
    deadlineDate,
    eventStartDate: project.eventStartDate || '',
    eventEndDate: project.eventEndDate || '',
    applyLink: project.applyLink || '',
    sourceLink: project.sourceLink || '',
    requirements: project.requirements || '用户手动录入，后续可在备注中继续补充要求。',
    materialsRequired: project.materialsRequired || ['简历', '成绩单'],
    examInterviewInfo: project.examInterviewInfo || '待补充',
    contactInfo: project.contactInfo || '待补充',
    remarks: project.remarks || '用户手动录入项目',
    tags: project.tags || ['手动录入'],
    status: project.status || resolvePublicStatus(deadlineLevel),
    year: project.year || new Date().getFullYear(),
    deadlineLevel,
    sourceSite: project.sourceSite || '用户手动录入',
    collectedAt: project.collectedAt || '',
    updatedAt: project.updatedAt || '',
    lastCheckedAt: project.lastCheckedAt || '',
    isVerified: project.isVerified || false,
    changeLog: project.changeLog || [],
    historyRecords: project.historyRecords || []
  } satisfies PublicNoticeProject;
}

function normalizeRecord(record: Partial<UserProjectRecord>) {
  const base = buildDefaultRecord(record.projectId || '');
  const merged = {
    ...base,
    ...record
  } as UserProjectRecord;

  return {
    ...merged,
    materialsProgress: calculateMaterialsProgress(merged)
  };
}

function isNewerTimestamp(left: string, right: string) {
  const leftValue = left ? new Date(left).getTime() : 0;
  const rightValue = right ? new Date(right).getTime() : 0;
  return leftValue > rightValue;
}

async function getCloudWorkspaceContext() {
  if (!isCloudSyncEnabled()) {
    return null;
  }

  return getBrowserCloudWorkspaceContext();
}

async function getBrowserCloudWorkspaceContext() {
  if (!canUseBrowserStorage()) {
    return null;
  }

  try {
    const app = await getCloudbaseApp();
    const auth = app.auth({ persistence: 'local' });
    const loginState = await auth.getLoginState();
    const uid = loginState?.user?.uid;

    if (!uid) {
      return null;
    }

    return {
      uid,
      docId: `workspace-${uid}`,
      db: app.database()
    };
  } catch {
    return null;
  }
}

async function ensureCloudWorkspaceCollection(options: { allowAnonymous?: boolean } = {}) {
  const context = options.allowAnonymous ? await getBrowserCloudWorkspaceContext() : await getCloudWorkspaceContext();
  if (!context) {
    return null;
  }

  if (!cloudCollectionChecked) {
    cloudCollectionChecked = true;

    try {
      await context.db.collection(CLOUD_WORKSPACE_COLLECTION).limit(1).get();
      cloudCollectionAvailable = true;
    } catch {
      try {
        await context.db.createCollection(CLOUD_WORKSPACE_COLLECTION);
        cloudCollectionAvailable = true;
      } catch {
        cloudCollectionAvailable = false;
      }
    }
  }

  return cloudCollectionAvailable ? context : null;
}

async function readCloudWorkspace(options: { allowAnonymous?: boolean } = {}) {
  const context = await ensureCloudWorkspaceCollection(options);
  if (!context) {
    return null;
  }

  try {
    const result = await context.db.collection(CLOUD_WORKSPACE_COLLECTION).doc(context.docId).get();
    const document = Array.isArray(result.data) ? result.data[0] : null;
    return document as CloudWorkspaceDocument | null;
  } catch {
    return null;
  }
}

async function writeCloudWorkspace(
  patch: Partial<CloudWorkspaceDocument> = {},
  options: { allowAnonymous?: boolean } = {}
) {
  const context = await ensureCloudWorkspaceCollection(options);
  if (!context) {
    return false;
  }

  const existing = await readCloudWorkspace(options);
  const shouldIncludeLocalWorkspace = !options.allowAnonymous || Boolean(getUserSession());
  const applicationPayload = shouldIncludeLocalWorkspace ? readStoredRecordsPayload() : null;
  const manualPayload = shouldIncludeLocalWorkspace ? readStoredManualProjectsPayload() : null;

  const payload: CloudWorkspaceDocument = {
    ...(existing || {}),
    _id: context.docId,
    userId: context.uid,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    updatedAt: nowIsoText(),
    ...(applicationPayload
      ? {
          applicationUpdatedAt: applicationPayload.updatedAt,
          applications: applicationPayload.items
        }
      : {}),
    ...(manualPayload
      ? {
          manualProjectsUpdatedAt: manualPayload.updatedAt,
          manualProjects: manualPayload.items
        }
      : {}),
    ...patch
  };

  try {
    await context.db.collection(CLOUD_WORKSPACE_COLLECTION).doc(context.docId).set(payload);
    return true;
  } catch {
    // Silent fallback keeps the site usable when collection permissions are not ready.
    return false;
  }
}

async function hydrateWorkspaceFromCloud() {
  if (!isCloudSyncEnabled()) {
    return;
  }

  if (!hydrateWorkspacePromise) {
    hydrateWorkspacePromise = (async () => {
      const cloudWorkspace = await readCloudWorkspace();
      if (!cloudWorkspace) {
        return;
      }

      const localApplications = readStoredRecordsPayload();
      const localManualProjects = readStoredManualProjectsPayload();

      if (isNewerTimestamp(cloudWorkspace.applicationUpdatedAt || '', localApplications.updatedAt)) {
        persistStoredRecords(
          (cloudWorkspace.applications || []).map((item: UserProjectRecord) => normalizeRecord(item)),
          cloudWorkspace.applicationUpdatedAt || '',
          false
        );
      }

      if (isNewerTimestamp(cloudWorkspace.manualProjectsUpdatedAt || '', localManualProjects.updatedAt)) {
        persistStoredManualProjects(
          (cloudWorkspace.manualProjects || []).map((item: PublicNoticeProject) => normalizeManualProject(item)),
          cloudWorkspace.manualProjectsUpdatedAt || '',
          false
        );
      }
    })().finally(() => {
      hydrateWorkspacePromise = null;
    });
  }

  await hydrateWorkspacePromise;
}

function readStoredManualProjectsPayload() {
  if (!canUseBrowserStorage()) {
    return {
      updatedAt: '',
      items: [] as PublicNoticeProject[]
    };
  }

  const payload = readStoragePayload<Partial<PublicNoticeProject>>(MANUAL_PROJECT_STORAGE_KEY);
  if (!payload) {
    return {
      updatedAt: '',
      items: [] as PublicNoticeProject[]
    };
  }

  return {
    updatedAt: payload.updatedAt,
    items: payload.items
      .filter((item): item is Partial<PublicNoticeProject> => Boolean(item && typeof item === 'object'))
      .map((item: Partial<PublicNoticeProject>) => normalizeManualProject(item))
  };
}

function persistStoredManualProjects(projects: PublicNoticeProject[], updatedAt = nowIsoText(), syncCloud = true) {
  if (!canUseBrowserStorage()) {
    return;
  }

  const payload: StoredPayload<PublicNoticeProject> = {
    updatedAt,
    items: projects
  };

  window.localStorage.setItem(MANUAL_PROJECT_STORAGE_KEY, JSON.stringify(payload));
  emitApplicationUpdate();

  if (syncCloud) {
    void writeCloudWorkspace();
  }
}

function readStoredManualProjects() {
  return readStoredManualProjectsPayload().items;
}

function writeStoredManualProjects(projects: PublicNoticeProject[]) {
  persistStoredManualProjects(projects);
}

function getAllProjects() {
  return [...baseNoticeProjects, ...readStoredManualProjects()];
}

function readStoredRecordsPayload() {
  const seeded = sampleUserProjects.map((item: UserProjectRecord) => normalizeRecord(item));

  if (!canUseBrowserStorage()) {
    return {
      updatedAt: '',
      items: seeded
    };
  }

  const payload = readStoragePayload<Partial<UserProjectRecord>>(APPLICATION_STORAGE_KEY);
  if (!payload) {
    persistStoredRecords(seeded, nowIsoText(), false);
    return {
      updatedAt: nowIsoText(),
      items: seeded
    };
  }

  return {
    updatedAt: payload.updatedAt,
    items: payload.items
      .filter((item): item is Partial<UserProjectRecord> => Boolean(item && typeof item === 'object'))
      .map((item: Partial<UserProjectRecord>) => normalizeRecord(item))
  };
}

function persistStoredRecords(records: UserProjectRecord[], updatedAt = nowIsoText(), syncCloud = true) {
  if (!canUseBrowserStorage()) {
    return;
  }

  const payload: StoredPayload<UserProjectRecord> = {
    updatedAt,
    items: records
  };

  window.localStorage.setItem(APPLICATION_STORAGE_KEY, JSON.stringify(payload));
  emitApplicationUpdate();

  if (syncCloud) {
    void writeCloudWorkspace();
  }
}

function readStoredRecords() {
  return readStoredRecordsPayload().items;
}

function writeStoredRecords(records: UserProjectRecord[]) {
  persistStoredRecords(records);
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

export async function fetchPublicNotices() {
  const cloudProjects = await readCloudNoticeProjects();
  return cloudProjects.length ? cloudProjects : baseNoticeProjects;
}

async function getAllProjectsAsync() {
  const noticeProjects = await fetchPublicNotices();
  const manualProjects = readStoredManualProjects();
  const projectMap = new Map<string, PublicNoticeProject>();

  [...noticeProjects, ...manualProjects].forEach((project: PublicNoticeProject) => {
    projectMap.set(project.id, project);
  });

  return Array.from(projectMap.values());
}

export async function fetchNoticeById(id: string) {
  const source = await getAllProjectsAsync();
  return source.find((item: PublicNoticeProject) => item.id === id) || null;
}

export async function fetchDeadlineNotices() {
  const projects = await fetchPublicNotices();
  return projects.filter((item: PublicNoticeProject) => item.deadlineLevel !== 'future');
}

export async function fetchUserProjects() {
  await hydrateWorkspaceFromCloud();
  return readStoredRecords();
}

export async function fetchApplicationRows() {
  await hydrateWorkspaceFromCloud();
  const records = readStoredRecords();
  const projects = await getAllProjectsAsync();
  const rows = records.reduce<ApplicationRow[]>((list, item) => {
    const project = projects.find((notice) => notice.id === item.projectId);
    if (project) {
      list.push({ item, project });
    }
    return list;
  }, []);

  return rows.sort((left: ApplicationRow, right: ApplicationRow) =>
    left.project.deadlineDate.localeCompare(right.project.deadlineDate)
  );
}

export async function addProjectToApplicationTable(projectId: string) {
  await hydrateWorkspaceFromCloud();
  const current = readStoredRecords();
  const existing = current.find((item: UserProjectRecord) => item.projectId === projectId);

  if (existing) {
    return existing;
  }

  const created = buildDefaultRecord(projectId);
  writeStoredRecords([...current, created]);
  return created;
}

export async function createManualApplicationEntry(input: ManualProjectInput) {
  await hydrateWorkspaceFromCloud();
  const manualProjects = readStoredManualProjects();
  const projectId = `custom-${Date.now()}`;
  const nowText = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const project = normalizeManualProject({
    id: projectId,
    schoolName: input.schoolName.trim(),
    departmentName: input.departmentName.trim() || '待补充',
    projectName: input.projectName.trim(),
    projectType: input.projectType,
    discipline: input.discipline.trim() || '待补充',
    publishDate: nowText.slice(0, 10),
    deadlineDate: input.deadlineDate.trim(),
    eventStartDate: input.eventStartDate?.trim() || '',
    eventEndDate: input.eventEndDate?.trim() || '',
    applyLink: input.applyLink?.trim() || '',
    sourceLink: input.applyLink?.trim() || '',
    remarks: '用户手动录入项目',
    sourceSite: '用户手动录入',
    collectedAt: nowText,
    updatedAt: nowText,
    lastCheckedAt: nowText,
    tags: ['手动录入']
  });

  writeStoredManualProjects([...manualProjects, project]);

  const current = readStoredRecords();
  const record = normalizeRecord({
    ...buildDefaultRecord(project.id),
    projectId: project.id
  });
  writeStoredRecords([...current, record]);
  return { item: record, project };
}

export async function saveUserProfileToWorkspace(profile: UserProfile) {
  if (!getUserSession()) {
    return false;
  }

  return writeCloudWorkspace({
    profile,
    profileUpdatedAt: nowIsoText()
  });
}

export async function submitAiWaitlistLead(input: {
  wechatId: string;
  primaryNeed: AiWaitlistNeed;
  details?: string;
}) {
  const lead: AiWaitlistLead = {
    wechatId: input.wechatId.trim(),
    primaryNeed: input.primaryNeed,
    details: input.details?.trim() || '',
    submittedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    source: 'ai-page'
  };

  const ok = await writeCloudWorkspace(
    {
      aiWaitlistLead: lead,
      aiWaitlistUpdatedAt: nowIsoText()
    },
    { allowAnonymous: true }
  );

  if (canUseBrowserStorage()) {
    window.localStorage.setItem('seekoffer-ai-waitlist-lead', JSON.stringify(lead));
  }

  return {
    ok,
    lead
  };
}

export async function updateUserProject(userProjectId: string, patch: Partial<UserProjectRecord>) {
  await hydrateWorkspaceFromCloud();
  const current = readStoredRecords();
  const next = current.map((item: UserProjectRecord) => {
    if (item.userProjectId !== userProjectId) {
      return item;
    }

    const merged = normalizeRecord({ ...item, ...patch });

    if (patch.myStatus === '已提交' && !merged.submittedAt) {
      return {
        ...merged,
        submittedAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
      };
    }

    return merged;
  });

  writeStoredRecords(next);
  return next.find((item: UserProjectRecord) => item.userProjectId === userProjectId) || null;
}

export async function updateUserProjectStatus(userProjectId: string, myStatus: UserProjectStatus) {
  return updateUserProject(userProjectId, { myStatus });
}

export function getApplicationProject(projectId: string): PublicNoticeProject | null {
  return getAllProjects().find((item: PublicNoticeProject) => item.id === projectId) || null;
}
