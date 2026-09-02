import { getDeadlineLevelFromDate, getPublicStatusForDeadlineLevel } from './deadline-display';
import { getDisplayNoticeDepartment } from './notice-display';
import type {
  DeadlineLevel,
  ProjectType,
  PublicNoticeProject,
  PublicProjectStatus
} from './mock-data';

export const NOTICE_TARGET_YEAR = 2026;

export const NOTICE_CATALOG_COLUMNS = [
  'id',
  'school_name',
  'department_name',
  'project_name',
  'project_type',
  'discipline',
  'publish_date',
  'deadline_date',
  'deadline_level',
  'tags',
  'status',
  'year',
  'source_site',
  'source_link',
  'apply_link',
  'collected_at',
  'updated_at',
  'updated_at_ts',
  'last_checked_at',
  'is_verified'
].join(',');

export const NOTICE_DETAIL_COLUMNS = [
  'id',
  'school_name',
  'department_name',
  'project_name',
  'project_type',
  'discipline',
  'publish_date',
  'deadline_date',
  'event_start_date',
  'event_end_date',
  'apply_link',
  'source_link',
  'requirements',
  'materials_required',
  'exam_interview_info',
  'contact_info',
  'remarks',
  'tags',
  'status',
  'year',
  'deadline_level',
  'source_site',
  'collected_at',
  'updated_at',
  'updated_at_ts',
  'last_checked_at',
  'is_verified',
  'change_log',
  'history_records'
].join(',');

export const NOTICE_MANUAL_PROJECT_COLUMNS = [
  'id',
  'school_name',
  'department_name',
  'project_name',
  'project_type',
  'discipline',
  'publish_date',
  'deadline_date',
  'event_start_date',
  'event_end_date',
  'apply_link',
  'source_link',
  'tags',
  'status',
  'year',
  'deadline_level',
  'source_site',
  'collected_at',
  'updated_at',
  'updated_at_ts',
  'last_checked_at',
  'is_verified'
].join(',');

export const NOTICE_DEADLINE_COLUMNS = [
  'id',
  'school_name',
  'department_name',
  'project_name',
  'project_type',
  'discipline',
  'publish_date',
  'deadline_date',
  'deadline_level',
  'status',
  'tags',
  'source_link',
  'apply_link',
  'source_site',
  'collected_at',
  'updated_at',
  'updated_at_ts',
  'is_verified'
].join(',');

export type NoticeListItem = Pick<
  PublicNoticeProject,
  | 'id'
  | 'schoolName'
  | 'departmentName'
  | 'projectName'
  | 'projectType'
  | 'discipline'
  | 'publishDate'
  | 'deadlineDate'
  | 'deadlineLevel'
  | 'tags'
  | 'status'
  | 'year'
  | 'sourceSite'
  | 'sourceLink'
  | 'applyLink'
  | 'collectedAt'
  | 'updatedAt'
  | 'isVerified'
>;

function normalizeStringArray(input: unknown) {
  return Array.isArray(input)
    ? input.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
}

function normalizeProjectStatus(value: unknown, deadlineLevel: DeadlineLevel): PublicProjectStatus {
  if (deadlineLevel !== 'future') {
    return getPublicStatusForDeadlineLevel(deadlineLevel);
  }

  const status = String(value || '').trim() as PublicProjectStatus;
  return status || getPublicStatusForDeadlineLevel(deadlineLevel);
}

export function mapNoticeRowToProject(row: Record<string, unknown>): PublicNoticeProject | null {
  const id = String(row.id || '').trim();
  if (!id) {
    return null;
  }

  const deadlineDate = String(row.deadline_date || row.deadlineDate || '').trim();
  const deadlineLevel = getDeadlineLevelFromDate(deadlineDate);

  return {
    id,
    schoolName: String(row.school_name || row.schoolName || '').trim(),
    departmentName: String(row.department_name || row.departmentName || '').trim() || '待补充',
    projectName: String(row.project_name || row.projectName || '').trim(),
    projectType: String(row.project_type || row.projectType || '夏令营') as ProjectType,
    discipline: String(row.discipline || '').trim() || '待补充',
    publishDate: String(row.publish_date || row.publishDate || '').trim(),
    deadlineDate,
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
    status: normalizeProjectStatus(row.status, deadlineLevel),
    year: Number(row.year || NOTICE_TARGET_YEAR),
    deadlineLevel,
    sourceSite: String(row.source_site || row.sourceSite || '').trim() || '寻鹿整理',
    collectedAt: String(row.collected_at || row.collectedAt || '').trim(),
    updatedAt: String(row.updated_at_ts || row.updated_at || row.updatedAt || '').trim(),
    lastCheckedAt: String(row.last_checked_at || row.lastCheckedAt || '').trim(),
    isVerified: Boolean(row.is_verified ?? row.isVerified),
    changeLog: (Array.isArray(row.change_log) ? row.change_log : row.changeLog || []) as PublicNoticeProject['changeLog'],
    historyRecords: (Array.isArray(row.history_records) ? row.history_records : row.historyRecords || []) as PublicNoticeProject['historyRecords']
  };
}

export function toNoticeListItem(project: PublicNoticeProject): NoticeListItem {
  return {
    id: project.id,
    schoolName: project.schoolName,
    departmentName: getDisplayNoticeDepartment(project),
    projectName: project.projectName,
    projectType: project.projectType,
    discipline: project.discipline,
    publishDate: project.publishDate,
    deadlineDate: project.deadlineDate,
    deadlineLevel: project.deadlineLevel,
    tags: project.tags,
    status: project.status,
    year: project.year,
    sourceSite: project.sourceSite,
    sourceLink: project.sourceLink,
    applyLink: project.applyLink,
    collectedAt: project.collectedAt,
    updatedAt: project.updatedAt,
    isVerified: project.isVerified
  };
}

export function noticeListItemToProject(item: NoticeListItem): PublicNoticeProject {
  return {
    ...item,
    eventStartDate: '',
    eventEndDate: '',
    requirements: '',
    materialsRequired: [],
    examInterviewInfo: '',
    contactInfo: '',
    remarks: '',
    lastCheckedAt: '',
    changeLog: [],
    historyRecords: []
  };
}
