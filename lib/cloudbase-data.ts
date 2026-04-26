'use client';

import { getSupabaseBrowserClient } from './supabase-browser';
import { getUserSession, type UserProfile, updateUserProfile } from './user-session';
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

const APPLICATION_STORAGE_KEY = 'seekoffer-my-application-table';
const MANUAL_PROJECT_STORAGE_KEY = 'seekoffer-manual-projects';
const APPLICATION_EVENT_NAME = 'seekoffer-applications-updated';
const NOTICE_TARGET_YEAR = 2026;
const PUBLIC_NOTICE_QUERY_LIMIT = 1500;

type StoredPayload<T> = {
  updatedAt: string;
  items: T[];
};

export type AiWaitlistNeed = '申请风险评估' | '材料短板提示' | '提炼简章要求';

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
  '当前已切换到 Supabase 账号体系。试用态只保存在当前浏览器；完成正式登录后，申请表、个人资料和手动录入项目会自动同步到你的个人工作区。';

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

function readStoragePayload<T>(storageKey: string): StoredPayload<T> | null {
  if (!canUseBrowserStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredPayload<T> | T[];
    if (Array.isArray(parsed)) {
      return {
        updatedAt: '',
        items: parsed
      };
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
  if (level === 'today' || level === 'within3days' || level === 'within7days') return '即将截止';
  return '报名中';
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
    return resolvePublicStatus(deadlineLevel);
  }

  return status || resolvePublicStatus(deadlineLevel);
}

export function calculateMaterialsProgress(record: Pick<UserProjectRecord, MaterialChecklistKey>) {
  const total = materialChecklistDefinitions.length;
  const completed = materialChecklistDefinitions.filter(({ key }) => record[key]).length;
  return Math.round((completed / total) * 100);
}

function normalizeManualProject(project: Partial<PublicNoticeProject>) {
  const deadlineDate = String(project.deadlineDate || '').trim();
  const deadlineLevel = resolveDeadlineLevel(deadlineDate);
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
    requirements: String(project.requirements || '').trim() || '以原文通知要求为准',
    materialsRequired: normalizeStringArray(project.materialsRequired),
    examInterviewInfo: String(project.examInterviewInfo || '').trim(),
    contactInfo: String(project.contactInfo || '').trim(),
    remarks: String(project.remarks || '').trim(),
    tags: normalizeStringArray(project.tags),
    status: normalizeProjectStatus(project.status as PublicNoticeProject['status'] | undefined, deadlineLevel),
    year: Number(project.year || NOTICE_TARGET_YEAR),
    deadlineLevel,
    sourceSite: String(project.sourceSite || '').trim() || '保研通知网',
    collectedAt: String(project.collectedAt || '').trim() || nowText(),
    updatedAt: String(project.updatedAt || '').trim() || nowText(),
    lastCheckedAt: String(project.lastCheckedAt || '').trim() || nowText(),
    isVerified: Boolean(project.isVerified),
    changeLog: Array.isArray(project.changeLog) ? project.changeLog : [],
    historyRecords: Array.isArray(project.historyRecords) ? project.historyRecords : []
  } satisfies PublicNoticeProject;
}

function buildDefaultRecord(projectId: string) {
  const base: UserProjectRecord = {
    userProjectId: `user-${projectId}`,
    userId: getUserSession()?.userId || 'local-user',
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

function normalizeRecord(record: Partial<UserProjectRecord>) {
  const base = {
    ...buildDefaultRecord(String(record.projectId || '')),
    ...record
  } as UserProjectRecord;

  const normalized: UserProjectRecord = {
    ...base,
    userProjectId: String(base.userProjectId || `user-${base.projectId}`),
    userId: String(base.userId || getUserSession()?.userId || 'local-user'),
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

function readStoredManualProjectsPayload() {
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
      .map((item) => normalizeManualProject(item))
  };
}

function persistStoredManualProjects(projects: PublicNoticeProject[], updatedAt = nowIsoText(), emit = true) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(
    MANUAL_PROJECT_STORAGE_KEY,
    JSON.stringify({
      updatedAt,
      items: projects
    } satisfies StoredPayload<PublicNoticeProject>)
  );

  if (emit) {
    emitApplicationUpdate();
  }
}

function readStoredManualProjects() {
  return readStoredManualProjectsPayload().items;
}

function readStoredRecordsPayload() {
  const payload = readStoragePayload<Partial<UserProjectRecord>>(APPLICATION_STORAGE_KEY);
  if (!payload) {
    return {
      updatedAt: '',
      items: [] as UserProjectRecord[]
    };
  }

  return {
    updatedAt: payload.updatedAt,
    items: payload.items
      .filter((item): item is Partial<UserProjectRecord> => Boolean(item && typeof item === 'object'))
      .map((item) => normalizeRecord(item))
  };
}

function persistStoredRecords(records: UserProjectRecord[], updatedAt = nowIsoText(), emit = true) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(
    APPLICATION_STORAGE_KEY,
    JSON.stringify({
      updatedAt,
      items: records
    } satisfies StoredPayload<UserProjectRecord>)
  );

  if (emit) {
    emitApplicationUpdate();
  }
}

function readStoredRecords() {
  return readStoredRecordsPayload().items;
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

async function upsertRemoteManualProjects(projects: PublicNoticeProject[]) {
  const context = getSupabaseMemberContext();
  if (!context || !projects.length) {
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

async function upsertRemoteApplications(records: UserProjectRecord[]) {
  const context = getSupabaseMemberContext();
  if (!context || !records.length) {
    return;
  }

  const supabase = getSupabaseBrowserClient();
  const payload = records.map((record) => mapRecordToApplicationUpsert(record, context.userId));
  const { error } = await supabase.from('applications').upsert(payload, {
    onConflict: 'user_id,project_id'
  });

  if (error) {
    throw error;
  }
}

async function deleteRemoteApplication(projectId: string) {
  const context = getSupabaseMemberContext();
  if (!context || !projectId) {
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

async function deleteRemoteManualProject(projectId: string) {
  const context = getSupabaseMemberContext();
  if (!context || !projectId) {
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

async function fetchRemoteManualProjects() {
  const context = getSupabaseMemberContext();
  if (!context) {
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

async function fetchRemoteApplications() {
  const context = getSupabaseMemberContext();
  if (!context) {
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

async function fetchRemoteProfile() {
  const context = getSupabaseMemberContext();
  if (!context) {
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
      const localManualProjects = readStoredManualProjectsPayload().items;
      const localApplications = readStoredRecordsPayload().items;
      const localProfile = getUserSession()?.profile;

      await Promise.all([
        upsertRemoteManualProjects(localManualProjects),
        upsertRemoteApplications(localApplications),
        upsertRemoteProfile(localProfile)
      ]);

      const [remoteManualProjects, remoteApplications, remoteProfile] = await Promise.all([
        fetchRemoteManualProjects(),
        fetchRemoteApplications(),
        fetchRemoteProfile()
      ]);

      persistStoredManualProjects(remoteManualProjects, nowIsoText(), false);
      persistStoredRecords(remoteApplications, nowIsoText(), false);

      if (remoteProfile && profileHasMeaningfulContent(remoteProfile)) {
        updateUserProfile(remoteProfile);
      }
    })();
  }

  await hydrateWorkspacePromise;
}

async function readRemotePublicNotices() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('notices')
    .select('*')
    .eq('year', NOTICE_TARGET_YEAR)
    .eq('is_private', false)
    .range(0, PUBLIC_NOTICE_QUERY_LIMIT - 1);

  if (error) {
    throw error;
  }

  return (data || []).map((row) => mapNoticeRowToProject(row)).filter(Boolean) as PublicNoticeProject[];
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
  if (!publicNoticeCachePromise) {
    publicNoticeCachePromise = (async () => {
      try {
        const remoteProjects = await readRemotePublicNotices();
        if (!remoteProjects.length) {
          return filterMainNoticeProjects(baseNoticeProjects);
        }

        const merged = new Map<string, PublicNoticeProject>();
        baseNoticeProjects.forEach((project) => {
          merged.set(project.id, project);
        });
        remoteProjects.forEach((project) => {
          merged.set(project.id, project);
        });

        return sortProjectsByFreshness(filterMainNoticeProjects(Array.from(merged.values())));
      } catch {
        return filterMainNoticeProjects(baseNoticeProjects);
      }
    })();
  }

  return publicNoticeCachePromise;
}

async function getAllProjectsAsync() {
  const noticeProjects = await fetchPublicNotices();
  const manualProjects = readStoredManualProjects();
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
  return projects.filter((item) => item.deadlineLevel !== 'future');
}

export async function fetchUserProjects() {
  await hydrateWorkspaceFromSupabase();
  return readStoredRecords();
}

export async function fetchApplicationRows() {
  await hydrateWorkspaceFromSupabase();
  const records = readStoredRecords();
  const projects = await getAllProjectsAsync();
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

export async function addProjectToApplicationTable(projectId: string) {
  await hydrateWorkspaceFromSupabase();
  const current = readStoredRecords();
  const existing = current.find((item) => item.projectId === projectId);

  if (existing) {
    return existing;
  }

  const created = buildDefaultRecord(projectId);
  persistStoredRecords([...current, created]);
  await upsertRemoteApplications([...current, created]);
  return created;
}

export async function createManualApplicationEntry(input: ManualProjectInput) {
  await hydrateWorkspaceFromSupabase();
  const manualProjects = readStoredManualProjects();
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

  const record = normalizeRecord({
    ...buildDefaultRecord(project.id),
    projectId: project.id
  });

  const nextManualProjects = [...manualProjects, project];
  const nextRecords = [...readStoredRecords(), record];
  persistStoredManualProjects(nextManualProjects);
  persistStoredRecords(nextRecords);

  await Promise.all([upsertRemoteManualProjects(nextManualProjects), upsertRemoteApplications(nextRecords)]);

  return { item: record, project };
}

export async function saveUserProfileToWorkspace(profile: UserProfile) {
  const context = getSupabaseMemberContext();
  if (!context) {
    return false;
  }

  await upsertRemoteProfile(profile);
  return true;
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
    submittedAt: nowText(),
    source: 'ai-page'
  };

  let ok = false;

  try {
    const supabase = getSupabaseBrowserClient();
    const session = getUserSession();
    const { error } = await supabase.from('ai_waitlist_leads').insert({
      user_id: session?.authProvider === 'anonymous' ? null : session?.userId || null,
      wechat_id: lead.wechatId,
      primary_need: lead.primaryNeed,
      details: lead.details,
      submitted_at_text: lead.submittedAt,
      source: lead.source
    });

    if (!error) {
      ok = true;
    }
  } catch {
    ok = false;
  }

  if (canUseBrowserStorage()) {
    window.localStorage.setItem('seekoffer-ai-waitlist-lead', JSON.stringify(lead));
  }

  return {
    ok,
    lead
  };
}

export async function updateUserProject(userProjectId: string, patch: Partial<UserProjectRecord>) {
  await hydrateWorkspaceFromSupabase();
  const current = readStoredRecords();
  const next = current.map((item) => {
    if (item.userProjectId !== userProjectId) {
      return item;
    }

    const merged = normalizeRecord({ ...item, ...patch });

    if (patch.myStatus === '已提交' && !merged.submittedAt) {
      return {
        ...merged,
        submittedAt: nowText()
      };
    }

    return merged;
  });

  persistStoredRecords(next);
  await upsertRemoteApplications(next);

  return next.find((item) => item.userProjectId === userProjectId) || null;
}

export async function deleteUserProject(userProjectId: string) {
  await hydrateWorkspaceFromSupabase();

  const currentRecords = readStoredRecords();
  const target = currentRecords.find((item) => item.userProjectId === userProjectId);
  if (!target) {
    return false;
  }

  const nextRecords = currentRecords.filter((item) => item.userProjectId !== userProjectId);
  const manualProjects = readStoredManualProjects();
  const isManualProject = manualProjects.some((project) => project.id === target.projectId);
  const nextManualProjects = isManualProject
    ? manualProjects.filter((project) => project.id !== target.projectId)
    : manualProjects;

  persistStoredRecords(nextRecords);
  if (isManualProject) {
    persistStoredManualProjects(nextManualProjects);
  }

  await deleteRemoteApplication(target.projectId);
  if (isManualProject) {
    await deleteRemoteManualProject(target.projectId);
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
