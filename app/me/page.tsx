'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  BookCheck,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  Clock3,
  ExternalLink,
  FileCheck2,
  GraduationCap,
  ListChecks,
  MoreHorizontal,
  PencilLine,
  PlusCircle,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2
} from 'lucide-react';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { LoginRequiredCard } from '@/components/login-required-card';
import { ManualProjectEntryCard } from '@/components/manual-project-entry-card';
import { SiteShell } from '@/components/site-shell';
import { useUserSessionState } from '@/hooks/use-user-session';
import {
  deleteUserProject,
  fetchApplicationRows,
  saveUserProfileToWorkspace,
  updateUserProject,
  watchApplicationTable,
  type ApplicationRow
} from '@/lib/cloudbase-data';
import {
  formatNoticeDateOnly,
  getDisplayDiscipline,
  getDisplayNoticeDepartment,
  getDisplayProjectType,
  getDisplaySchoolName,
  normalizeNoticeTitle
} from '@/lib/notice-display';
import { buildNoticeDetailHref } from '@/lib/notice-links';
import { matchesSchoolRange } from '@/lib/notice-source';
import {
  hydrateWorkbenchState,
  saveWorkbenchState,
  type WorkbenchCustomTodo
} from '@/lib/workbench-state';
import {
  materialChecklistDefinitions,
  priorityOptions,
  userStatusOptions,
  type MaterialChecklistKey,
  type UserProjectRecord
} from '@/lib/mock-data';
import { resolveNoticeLogoSource } from '@/lib/school-mark-source';
import { updateUserProfile, type UserProfile } from '@/lib/user-session';

const emptyProfile: UserProfile = {
  nickname: '',
  age: '',
  undergraduateSchool: '',
  major: '',
  grade: '大四',
  targetMajor: '',
  targetRegion: ''
};

const TODO_COMPLETED_STORAGE_KEY = 'seekoffer-workbench-completed-todos';
const TODO_CUSTOM_STORAGE_KEY = 'seekoffer-workbench-custom-todos';
const CONTACTS_STORAGE_KEY = 'seekoffer-workbench-mentor-contacts';

type WorkbenchTypeFilter = '全部' | '夏令营' | '预推免' | '正式推免' | '宣讲会' | '入营名单';
type WorkbenchRangeFilter = '全部' | '985' | '211' | '双一流' | '其他';
type WorkbenchProgressFilter = '全部' | '报名中' | '未开始' | '已结束';
type WorkbenchApplicationStatusFilter = '全部' | '未申请' | '已申请';
type WorkbenchResultFilter = '全部' | '未出结果' | '未入营' | '已入营' | '已优营';
type WorkbenchSortOption = 'deadline' | 'school' | 'status';
type WorkbenchSection = 'applications' | 'schedule' | 'contacts';
type ScheduleTypeFilter = '全部' | '申请截止' | '材料准备' | '套磁' | '笔试' | '面试' | '其他';
type ScheduleDoneFilter = '全部' | '未完成' | '已完成';
type ContactRangeFilter = '全部' | 'C9' | '985' | '211' | '双一流' | '普通高校' | '科研院所' | '其它';
type ContactFeedbackStatus = '未联系' | '已投递' | '已回复' | '已offer' | '需跟进' | '无回复' | '不合适';
type ContactDeliveryStatus = '未投递' | '已投递';
type ContactSortOption = 'updated' | 'school' | 'lastContact';

type ScheduleItem = {
  id: string;
  title: string;
  detail: string;
  date?: string;
  dateLabel: string;
  type: Exclude<ScheduleTypeFilter, '全部'>;
  done: boolean;
  href?: string;
};

type MentorContact = {
  id: string;
  schoolName: string;
  departmentName: string;
  mentorName: string;
  mentorTitle: string;
  schoolRange: Exclude<ContactRangeFilter, '全部'>;
  email: string;
  researchDirection: string;
  homepage: string;
  deliveryStatus: ContactDeliveryStatus;
  feedbackStatus: ContactFeedbackStatus;
  lastContactDate: string;
  contactNotes: string;
  notes: string;
  updatedAt: string;
};

const workbenchTypeFilters: WorkbenchTypeFilter[] = ['全部', '夏令营', '预推免', '正式推免'];
const workbenchRangeFilters: WorkbenchRangeFilter[] = ['全部', '985', '211', '双一流', '其他'];
const workbenchProgressFilters: WorkbenchProgressFilter[] = ['全部', '报名中', '未开始', '已结束'];
const workbenchApplicationStatusFilters: WorkbenchApplicationStatusFilter[] = ['全部', '未申请', '已申请'];
const workbenchResultFilters: WorkbenchResultFilter[] = ['全部', '未出结果', '未入营', '已入营', '已优营'];
const scheduleTypeFilters: ScheduleTypeFilter[] = ['全部', '申请截止', '材料准备', '套磁', '笔试', '面试', '其他'];
const manualScheduleTypes = scheduleTypeFilters.filter((item): item is Exclude<ScheduleTypeFilter, '全部'> => item !== '全部');
const scheduleDoneFilters: ScheduleDoneFilter[] = ['全部', '未完成', '已完成'];
const contactRangeFilters: ContactRangeFilter[] = ['全部', 'C9', '985', '211', '双一流', '普通高校', '科研院所', '其它'];
const contactFeedbackFilters: ('全部' | ContactFeedbackStatus)[] = ['全部', '未联系', '已投递', '已回复', '已offer', '需跟进', '无回复', '不合适'];
const contactDeliveryFilters: ('全部' | ContactDeliveryStatus)[] = ['全部', '未投递', '已投递'];
const BAOYAN_DATE_MONTH = 9;
const BAOYAN_DATE_DAY = 22;

function isProfileComplete(profile: UserProfile) {
  return Boolean(profile.undergraduateSchool && profile.major && profile.targetMajor && profile.targetRegion);
}

function readBrowserArray(key: string) {
  if (typeof window === 'undefined') {
    return [] as string[];
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return [] as string[];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [] as string[];
  }
}

function readCustomTodos() {
  if (typeof window === 'undefined') {
    return [] as WorkbenchCustomTodo[];
  }

  try {
    const raw = window.localStorage.getItem(TODO_CUSTOM_STORAGE_KEY);
    if (!raw) {
      return [] as WorkbenchCustomTodo[];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .filter((item): item is WorkbenchCustomTodo => Boolean(item?.id) && Boolean(item?.text))
          .map((item) => ({
            id: String(item.id),
            text: String(item.text),
            ...(item.date ? { date: String(item.date) } : {}),
            ...(item.type ? { type: String(item.type) } : {}),
            ...(item.note ? { note: String(item.note) } : {}),
            ...(item.createdAt ? { createdAt: String(item.createdAt) } : {})
          }))
      : [];
  } catch {
    return [] as WorkbenchCustomTodo[];
  }
}

function createEmptyContact(): MentorContact {
  return {
    id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    schoolName: '',
    departmentName: '',
    mentorName: '',
    mentorTitle: '',
    schoolRange: '普通高校',
    email: '',
    researchDirection: '',
    homepage: '',
    deliveryStatus: '未投递',
    feedbackStatus: '未联系',
    lastContactDate: '',
    contactNotes: '',
    notes: '',
    updatedAt: new Date().toISOString()
  };
}

function normalizeContact(raw: Partial<MentorContact>): MentorContact {
  const rawSchoolRange = String(raw.schoolRange || '');
  const nextSchoolRange =
    rawSchoolRange && rawSchoolRange !== '全部' && contactRangeFilters.includes(rawSchoolRange as ContactRangeFilter)
      ? rawSchoolRange
      : '普通高校';

  return {
    ...createEmptyContact(),
    ...raw,
    id: raw.id || `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    schoolRange: nextSchoolRange as Exclude<ContactRangeFilter, '全部'>,
    deliveryStatus: raw.deliveryStatus === '已投递' ? '已投递' : '未投递',
    feedbackStatus: contactFeedbackFilters.includes(raw.feedbackStatus as ContactFeedbackStatus)
      ? (raw.feedbackStatus as ContactFeedbackStatus)
      : '未联系',
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
}

function readStoredContacts() {
  if (typeof window === 'undefined') {
    return [] as MentorContact[];
  }

  try {
    const raw = window.localStorage.getItem(CONTACTS_STORAGE_KEY);
    if (!raw) {
      return [] as MentorContact[];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => normalizeContact(item)) : [];
  } catch {
    return [] as MentorContact[];
  }
}

function getContactSearchText(contact: MentorContact) {
  return [
    contact.schoolName,
    contact.departmentName,
    contact.mentorName,
    contact.mentorTitle,
    contact.schoolRange,
    contact.email,
    contact.researchDirection,
    contact.homepage,
    contact.contactNotes,
    contact.notes
  ]
    .join(' ')
    .toLowerCase();
}

function matchesContactRange(contactRange: MentorContact['schoolRange'], filter: ContactRangeFilter) {
  if (filter === '全部') return true;
  if (filter === '985') return contactRange === '985' || contactRange === 'C9';
  return contactRange === filter;
}

function sortContacts(contacts: MentorContact[], sortBy: ContactSortOption) {
  return [...contacts].sort((left, right) => {
    if (sortBy === 'school') {
      return `${left.schoolName}${left.departmentName}`.localeCompare(`${right.schoolName}${right.departmentName}`, 'zh-CN');
    }

    if (sortBy === 'lastContact') {
      return (right.lastContactDate || '').localeCompare(left.lastContactDate || '');
    }

    return (right.updatedAt || '').localeCompare(left.updatedAt || '');
  });
}

const resourceShortcuts = [
  { title: '保研经验', description: '精选学长经验', href: '/resources', icon: GraduationCap, tone: 'brand' },
  { title: '简历模板', description: '专业简历模板', href: '/resources', icon: FileCheck2, tone: 'green' },
  { title: '面试题库', description: '常见面试真题', href: '/resources', icon: BookCheck, tone: 'orange' },
  { title: '科研竞赛', description: '竞赛与项目合集', href: '/resources', icon: Sparkles, tone: 'violet' }
] as const;

function parseDeadlineTimestamp(deadlineDate: string) {
  const timestamp = new Date(`${deadlineDate.replace(' ', 'T')}:00+08:00`).getTime();
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

function getDaysLeft(deadlineDate: string) {
  const timestamp = parseDeadlineTimestamp(deadlineDate);
  if (timestamp === Number.MAX_SAFE_INTEGER) {
    return null;
  }

  return Math.ceil((timestamp - Date.now()) / (1000 * 60 * 60 * 24));
}

function getAnnualCountdownDays(month: number, day: number) {
  const now = new Date();
  let target = new Date(now.getFullYear(), month - 1, day, 0, 0, 0, 0);

  if (target.getTime() < now.getTime()) {
    target = new Date(now.getFullYear() + 1, month - 1, day, 0, 0, 0, 0);
  }

  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function getTodayDateString() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getMonthKey(dateString = getTodayDateString()) {
  return dateString.slice(0, 7);
}

function shiftMonth(monthKey: string, offset: number) {
  const [year, month] = monthKey.split('-').map(Number);
  const next = new Date(year, month - 1 + offset, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthTitle(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return `${year}年${month}月`;
}

function formatManualScheduleDate(date?: string) {
  return date || '待安排';
}

function getDateTimeValue(date?: string) {
  if (!date) {
    return Number.MAX_SAFE_INTEGER;
  }

  const timestamp = new Date(`${date}T00:00:00+08:00`).getTime();
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

function formatScheduleDateTitle(date?: string) {
  if (!date) {
    return '待安排';
  }

  const [, month, day] = date.split('-');
  return `${Number(month)}月${Number(day)}日`;
}

function getScheduleRelativeLabel(date?: string, today = getTodayDateString()) {
  if (!date) {
    return '待安排';
  }

  const dayDiff = Math.round((getDateTimeValue(date) - getDateTimeValue(today)) / (1000 * 60 * 60 * 24));
  if (dayDiff === 0) return '今天';
  if (dayDiff === 1) return '明天';
  if (dayDiff === -1) return '昨天';
  if (dayDiff > 1) return `${dayDiff}天后`;
  return `已过${Math.abs(dayDiff)}天`;
}

function getManualScheduleType(value?: string): Exclude<ScheduleTypeFilter, '全部'> {
  return manualScheduleTypes.includes(value as Exclude<ScheduleTypeFilter, '全部'>)
    ? (value as Exclude<ScheduleTypeFilter, '全部'>)
    : '其他';
}

function getScheduleTypeTone(type: Exclude<ScheduleTypeFilter, '全部'>) {
  if (type === '申请截止') return 'bg-rose-50 text-rose-600';
  if (type === '材料准备') return 'bg-emerald-50 text-brand';
  if (type === '套磁') return 'bg-sky-50 text-sky-600';
  if (type === '笔试') return 'bg-amber-50 text-amber-700';
  if (type === '面试') return 'bg-violet-50 text-violet-600';
  return 'bg-slate-100 text-slate-500';
}

function getScheduleDotTone(type: Exclude<ScheduleTypeFilter, '全部'>) {
  if (type === '申请截止') return 'bg-rose-500';
  if (type === '材料准备') return 'bg-brand';
  if (type === '套磁') return 'bg-sky-500';
  if (type === '笔试') return 'bg-amber-500';
  if (type === '面试') return 'bg-violet-500';
  return 'bg-slate-400';
}

function getCalendarCells(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const leadingEmptyDays = (firstDay + 6) % 7;
  const totalCells = Math.ceil((leadingEmptyDays + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const day = index - leadingEmptyDays + 1;
    if (day < 1 || day > daysInMonth) {
      return null;
    }

    return {
      day,
      date: `${monthKey}-${String(day).padStart(2, '0')}`
    };
  });
}

function getMaterialCompletedCount(progress: number) {
  const total = materialChecklistDefinitions.length;
  return Math.min(total, Math.max(0, Math.round((progress / 100) * total)));
}

function getPriorityTone(priority: string) {
  if (priority === '高') return 'bg-rose-50 text-rose-600';
  if (priority === '低') return 'bg-slate-100 text-slate-500';
  return 'bg-amber-50 text-amber-700';
}

function getWorkbenchStatusTone(status: string) {
  if (status === '已提交' || status === '待考核') return 'bg-blue-50 text-blue-600';
  if (status === '已通过') return 'bg-emerald-50 text-brand';
  if (status === '未通过' || status === '已放弃') return 'bg-slate-100 text-slate-500';
  return 'bg-emerald-50 text-brand';
}

function getResourceToneClass(tone: string) {
  if (tone === 'green') return 'bg-emerald-50 text-emerald-700';
  if (tone === 'orange') return 'bg-orange-50 text-orange-600';
  if (tone === 'violet') return 'bg-violet-50 text-violet-600';
  return 'bg-brand text-white';
}

function getWorkbenchProgressBucket(row: ApplicationRow): Exclude<WorkbenchProgressFilter, '全部'> {
  if (row.project.deadlineLevel === 'expired' || row.project.status === '已截止' || row.project.status === '已结束') {
    return '已结束';
  }

  if (row.project.status === '未开始') {
    return '未开始';
  }

  return '报名中';
}

function getWorkbenchApplicationStatusBucket(row: ApplicationRow): Exclude<WorkbenchApplicationStatusFilter, '全部'> {
  return row.item.myStatus === '已收藏' ? '未申请' : '已申请';
}

function getWorkbenchResultBucket(row: ApplicationRow): Exclude<WorkbenchResultFilter, '全部'> {
  const resultText = `${row.item.resultStatus} ${row.item.myStatus} ${row.item.myNotes}`.toLowerCase();
  if (/优营|优秀营员/.test(resultText)) return '已优营';
  if (row.item.resultStatus === '已通过' || row.item.myStatus === '已通过') return '已入营';
  if (row.item.resultStatus === '未通过' || row.item.myStatus === '未通过' || row.item.myStatus === '已放弃') return '未入营';
  return '未出结果';
}

function matchesWorkbenchType(filter: WorkbenchTypeFilter, row: ApplicationRow) {
  if (filter === '全部') return true;
  if (filter === '正式推免') return ['正式推免', '推免', '九推'].includes(row.project.projectType);
  return row.project.projectType === filter;
}

function getWorkbenchSearchText(row: ApplicationRow) {
  return [row.project.schoolName, getDisplaySchoolName(row.project.schoolName)]
    .join(' ')
    .toLowerCase();
}

function sortWorkbenchRows(rows: ApplicationRow[], sortBy: WorkbenchSortOption) {
  return [...rows].sort((left, right) => {
    if (sortBy === 'school') {
      return getDisplaySchoolName(left.project.schoolName).localeCompare(getDisplaySchoolName(right.project.schoolName), 'zh-CN');
    }

    if (sortBy === 'status') {
      return left.item.myStatus.localeCompare(right.item.myStatus, 'zh-CN');
    }

    return parseDeadlineTimestamp(left.project.deadlineDate) - parseDeadlineTimestamp(right.project.deadlineDate);
  });
}

export default function MePage() {
  const { session, ready, loggedIn } = useUserSessionState();
  const sessionProfile = session?.profile || emptyProfile;
  const profileOwnerId = session?.userId || session?.email || session?.phone || 'guest';
  const [draftFormState, setDraftFormState] = useState<{ ownerId: string; value: UserProfile }>({
    ownerId: '',
    value: emptyProfile
  });
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [saveMessageState, setSaveMessageState] = useState<{ ownerId: string; value: string }>({
    ownerId: '',
    value: ''
  });
  const [profileExpandedState, setProfileExpandedState] = useState<{ ownerId: string; value: boolean }>({
    ownerId: '',
    value: true
  });
  const [completedTodoIds, setCompletedTodoIds] = useState<string[]>(() => readBrowserArray(TODO_COMPLETED_STORAGE_KEY));
  const [customTodos, setCustomTodos] = useState<WorkbenchCustomTodo[]>(() => readCustomTodos());
  const [todoSyncOwnerId, setTodoSyncOwnerId] = useState('');
  const [todoSyncReady, setTodoSyncReady] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState('');
  const [activeSection, setActiveSection] = useState<WorkbenchSection>('applications');
  const [applicationTypeFilter, setApplicationTypeFilter] = useState<WorkbenchTypeFilter>('全部');
  const [schoolRangeFilter, setSchoolRangeFilter] = useState<WorkbenchRangeFilter>('全部');
  const [progressFilter, setProgressFilter] = useState<WorkbenchProgressFilter>('全部');
  const [applicationStatusFilter, setApplicationStatusFilter] = useState<WorkbenchApplicationStatusFilter>('全部');
  const [resultFilter, setResultFilter] = useState<WorkbenchResultFilter>('全部');
  const [applicationKeyword, setApplicationKeyword] = useState('');
  const [applicationSort, setApplicationSort] = useState<WorkbenchSortOption>('deadline');
  const [openChecklistId, setOpenChecklistId] = useState('');
  const [scheduleTypeFilter, setScheduleTypeFilter] = useState<ScheduleTypeFilter>('全部');
  const [scheduleDoneFilter, setScheduleDoneFilter] = useState<ScheduleDoneFilter>('全部');
  const [scheduleKeyword, setScheduleKeyword] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => getMonthKey());
  const [contacts, setContacts] = useState<MentorContact[]>(() => readStoredContacts());
  const [contactRangeFilter, setContactRangeFilter] = useState<ContactRangeFilter>('全部');
  const [contactFeedbackFilter, setContactFeedbackFilter] = useState<'全部' | ContactFeedbackStatus>('全部');
  const [contactDeliveryFilter, setContactDeliveryFilter] = useState<'全部' | ContactDeliveryStatus>('全部');
  const [contactKeyword, setContactKeyword] = useState('');
  const [contactSort, setContactSort] = useState<ContactSortOption>('updated');
  const form = draftFormState.ownerId === profileOwnerId ? draftFormState.value : sessionProfile;
  const saveMessage = saveMessageState.ownerId === profileOwnerId ? saveMessageState.value : '';
  const profileExpanded =
    profileExpandedState.ownerId === profileOwnerId
      ? profileExpandedState.value
      : !isProfileComplete(sessionProfile);
  const syncableUserId =
    session?.loggedIn && session.authProvider !== 'anonymous' && session.userId ? session.userId : '';

  function setSaveMessage(value: string) {
    setSaveMessageState({
      ownerId: profileOwnerId,
      value
    });
  }

  useEffect(() => {
    if (!loggedIn) {
      return () => undefined;
    }

    let active = true;

    const load = async () => {
      const merged = await fetchApplicationRows();
      if (active) {
        setRows(merged);
      }
    };

    void load();
    const dispose = watchApplicationTable(load);

    return () => {
      active = false;
      dispose();
    };
  }, [loggedIn]);

  useEffect(() => {
    if (!syncableUserId) {
      return () => undefined;
    }

    let active = true;

    const hydrateRemoteTodos = async () => {
      try {
        const mergedState = await hydrateWorkbenchState(syncableUserId, {
          completedTodoIds: readBrowserArray(TODO_COMPLETED_STORAGE_KEY),
          customTodos: readCustomTodos()
        });

        if (!active) {
          return;
        }

        setCompletedTodoIds(mergedState.completedTodoIds);
        setCustomTodos(mergedState.customTodos);
      } catch (error) {
        console.error('[Seekoffer][workbench] hydrate workbench state failed', error);
      } finally {
        if (active) {
          setTodoSyncOwnerId(syncableUserId);
          setTodoSyncReady(true);
        }
      }
    };

    void hydrateRemoteTodos();

    return () => {
      active = false;
    };
  }, [syncableUserId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TODO_COMPLETED_STORAGE_KEY, JSON.stringify(completedTodoIds));
    }
  }, [completedTodoIds]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TODO_CUSTOM_STORAGE_KEY, JSON.stringify(customTodos));
    }
  }, [customTodos]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
    }
  }, [contacts]);

  useEffect(() => {
    if (!todoSyncReady || !syncableUserId || todoSyncOwnerId !== syncableUserId) {
      return () => undefined;
    }

    let cancelled = false;
    const persistRemoteTodos = async () => {
      try {
        await saveWorkbenchState(syncableUserId, {
          completedTodoIds,
          customTodos
        });
      } catch (error) {
        if (!cancelled) {
          console.error('[Seekoffer][workbench] save workbench state failed', error);
        }
      }
    };

    void persistRemoteTodos();

    return () => {
      cancelled = true;
    };
  }, [completedTodoIds, customTodos, syncableUserId, todoSyncOwnerId, todoSyncReady]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      materialPending: rows.filter((row) => row.item.materialsProgress < 100).length
    }),
    [rows]
  );

  const filteredApplicationRows = useMemo(() => {
    const keyword = applicationKeyword.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (!matchesWorkbenchType(applicationTypeFilter, row)) return false;
      if (schoolRangeFilter !== '全部' && !matchesSchoolRange(row.project, schoolRangeFilter)) return false;
      if (progressFilter !== '全部' && getWorkbenchProgressBucket(row) !== progressFilter) return false;
      if (applicationStatusFilter !== '全部' && getWorkbenchApplicationStatusBucket(row) !== applicationStatusFilter) return false;
      if (resultFilter !== '全部' && getWorkbenchResultBucket(row) !== resultFilter) return false;
      if (keyword && !getWorkbenchSearchText(row).includes(keyword)) return false;
      return true;
    });

    return sortWorkbenchRows(filtered, applicationSort);
  }, [
    applicationKeyword,
    applicationSort,
    applicationStatusFilter,
    applicationTypeFilter,
    progressFilter,
    resultFilter,
    rows,
    schoolRangeFilter
  ]);
  const applicationPreview = filteredApplicationRows;
  const scheduleItems = useMemo<ScheduleItem[]>(() => {
    return customTodos
      .map((task) => ({
        id: task.id,
        title: task.text,
        detail: task.note || '手动添加的工作台事项',
        date: task.date,
        dateLabel: formatManualScheduleDate(task.date),
        type: getManualScheduleType(task.type),
        done: completedTodoIds.includes(task.id)
      }))
      .sort((left, right) => {
        const dateCompare = (left.date || '9999-12-31').localeCompare(right.date || '9999-12-31');
        if (dateCompare !== 0) return dateCompare;
        return left.title.localeCompare(right.title, 'zh-CN');
      });
  }, [completedTodoIds, customTodos]);

  const filteredScheduleItems = useMemo(() => {
    const keyword = scheduleKeyword.trim().toLowerCase();

    return scheduleItems.filter((item) => {
      if (scheduleTypeFilter !== '全部' && item.type !== scheduleTypeFilter) return false;
      if (scheduleDoneFilter === '未完成' && item.done) return false;
      if (scheduleDoneFilter === '已完成' && !item.done) return false;
      if (keyword && !`${item.title} ${item.detail} ${item.dateLabel}`.toLowerCase().includes(keyword)) return false;
      return true;
    });
  }, [scheduleDoneFilter, scheduleItems, scheduleKeyword, scheduleTypeFilter]);

  const contactSummary = useMemo(
    () => ({
      total: contacts.length,
      delivered: contacts.filter((item) => item.deliveryStatus === '已投递').length,
      replied: contacts.filter((item) => item.feedbackStatus === '已回复' || item.feedbackStatus === '已offer').length,
      followUp: contacts.filter((item) => item.feedbackStatus === '需跟进' || item.feedbackStatus === '无回复').length
    }),
    [contacts]
  );

  const filteredContacts = useMemo(() => {
    const keyword = contactKeyword.trim().toLowerCase();
    const filtered = contacts.filter((contact) => {
      if (!matchesContactRange(contact.schoolRange, contactRangeFilter)) return false;
      if (contactFeedbackFilter !== '全部' && contact.feedbackStatus !== contactFeedbackFilter) return false;
      if (contactDeliveryFilter !== '全部' && contact.deliveryStatus !== contactDeliveryFilter) return false;
      if (keyword && !getContactSearchText(contact).includes(keyword)) return false;
      return true;
    });

    return sortContacts(filtered, contactSort);
  }, [contactDeliveryFilter, contactFeedbackFilter, contactKeyword, contactRangeFilter, contactSort, contacts]);

  function handleProfileChange<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setDraftFormState({
      ownerId: profileOwnerId,
      value: {
        ...form,
        [key]: value
      }
    });
  }

  async function handleSaveProfile() {
    updateUserProfile(form);
    const synced = await saveUserProfileToWorkspace(form);
    setSaveMessage(synced ? '基本信息已保存并同步。' : '基本信息已保存。');

    if (isProfileComplete(form)) {
      setProfileExpandedState({
        ownerId: profileOwnerId,
        value: false
      });
    }
  }

  function handleScheduleDoneChange(id: string, done: boolean) {
    setCompletedTodoIds((current) => {
      if (done) {
        return current.includes(id) ? current : [...current, id];
      }

      return current.filter((item) => item !== id);
    });
  }

  function handleClearCompleted() {
    const customTodoIds = new Set(customTodos.map((item) => item.id));
    setCustomTodos((current) => current.filter((item) => !completedTodoIds.includes(item.id)));
    setCompletedTodoIds((current) => current.filter((id) => !customTodoIds.has(id)));
  }

  function createCustomTodo(payload: Pick<WorkbenchCustomTodo, 'text'> & Partial<Omit<WorkbenchCustomTodo, 'id' | 'text'>>) {
    const nextText = payload.text.trim();
    if (!nextText) {
      return '';
    }

    const nextId = `custom-${Date.now()}`;
    setCustomTodos((current) => [
      ...current,
      {
        id: nextId,
        text: nextText,
        ...(payload.date ? { date: payload.date } : {}),
        ...(payload.type ? { type: payload.type } : {}),
        ...(payload.note ? { note: payload.note } : {}),
        createdAt: new Date().toISOString()
      }
    ]);

    return nextId;
  }

  function handleCreateScheduleTodo(payload: Pick<WorkbenchCustomTodo, 'text'> & Partial<Omit<WorkbenchCustomTodo, 'id' | 'text'>>) {
    return createCustomTodo(payload);
  }

  function handleUpdateScheduleTodo(id: string, patch: Partial<Omit<WorkbenchCustomTodo, 'id'>>) {
    setCustomTodos((current) =>
      current.map((todo) => {
        if (todo.id !== id) {
          return todo;
        }

        const nextTodo: WorkbenchCustomTodo = {
          ...todo,
          ...(patch.text !== undefined ? { text: patch.text.trim() || todo.text } : {})
        };

        if (patch.date !== undefined) {
          const nextDate = patch.date.trim();
          if (nextDate) {
            nextTodo.date = nextDate;
          } else {
            delete nextTodo.date;
          }
        }

        if (patch.type !== undefined) {
          const nextType = getManualScheduleType(patch.type);
          nextTodo.type = nextType;
        }

        if (patch.note !== undefined) {
          const nextNote = patch.note.trim();
          if (nextNote) {
            nextTodo.note = nextNote;
          } else {
            delete nextTodo.note;
          }
        }

        return nextTodo;
      })
    );
  }

  function handleDeleteScheduleTodo(id: string) {
    setCustomTodos((current) => current.filter((todo) => todo.id !== id));
    setCompletedTodoIds((current) => current.filter((item) => item !== id));
  }

  function handleAddContact() {
    const nextContact = createEmptyContact();
    setContacts((current) => [nextContact, ...current]);
    setContactRangeFilter('全部');
    setContactFeedbackFilter('全部');
    setContactDeliveryFilter('全部');
    setContactKeyword('');
    setContactSort('updated');
    setActiveSection('contacts');
    return nextContact.id;
  }

  function handleContactChange<K extends keyof MentorContact>(id: string, key: K, value: MentorContact[K]) {
    setContacts((current) =>
      current.map((contact) =>
        contact.id === id
          ? {
              ...contact,
              [key]: value,
              updatedAt: new Date().toISOString()
            }
          : contact
      )
    );
  }

  function handleDeleteContact(id: string) {
    setContacts((current) => current.filter((contact) => contact.id !== id));
  }

  if (!ready) {
    return (
      <SiteShell>
        <LoginRequiredCard
          title="别再用 Excel 追保研截止了"
          description="免费创建申请表，保存目标院校、申请状态和材料进度。通知库、资源库和院校库仍可直接浏览。"
        />
      </SiteShell>
    );
  }

  async function refreshApplicationRows() {
    const merged = await fetchApplicationRows();
    setRows(merged);
  }

  async function handleDeleteApplication(row: ApplicationRow) {
    const schoolName = getDisplaySchoolName(row.project.schoolName);
    const confirmed = window.confirm(`确定要从申请表删除「${schoolName}」吗？相关待办和材料进度也会一并移除。`);
    if (!confirmed) {
      return;
    }

    setDeletingProjectId(row.item.userProjectId);
    try {
      await deleteUserProject(row.item.userProjectId);
      await refreshApplicationRows();
      if (openChecklistId === row.item.userProjectId) {
        setOpenChecklistId('');
      }
    } finally {
      setDeletingProjectId('');
    }
  }

  const baoYanCountdownDays = getAnnualCountdownDays(BAOYAN_DATE_MONTH, BAOYAN_DATE_DAY);

  async function handleRecordChange(userProjectId: string, patch: Partial<UserProjectRecord>) {
    await updateUserProject(userProjectId, patch);
    await refreshApplicationRows();
  }

  async function handleToggleChecklist(userProjectId: string, field: MaterialChecklistKey, currentValue: boolean) {
    await handleRecordChange(userProjectId, { [field]: !currentValue } as Partial<UserProjectRecord>);
  }

  if (!loggedIn) {
    return (
      <SiteShell>
        <LoginRequiredCard
          title="别再用 Excel 追保研截止了"
          description="登录后可以保存目标项目、管理申请状态、记录材料进度，并集中维护申请清单。"
        />
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="page-hero grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:px-8">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">我的申请</h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            集中管理申请清单、日程和导师联系，把每个目标项目推进到下一步。
          </p>
        </div>

        <div className="mx-auto grid w-full max-w-[520px] grid-cols-1 gap-3 sm:grid-cols-3 lg:mx-0 lg:justify-self-center">
          {[
            { label: '申请项目', value: stats.total.toString(), icon: ClipboardList },
            { label: '待补材料', value: stats.materialPending.toString(), icon: BookCheck },
            { label: '保研倒计时', value: `${baoYanCountdownDays}天`, hint: '距 9.22', icon: CalendarDays, featured: true }
          ].map((item) => {
            const Icon = item.icon;
            const featured = 'featured' in item && item.featured;

            return (
              <div
                key={item.label}
                className={`rounded-[28px] px-4 py-4 ${
                  featured ? 'bg-brand text-white shadow-float ring-1 ring-white/30' : 'soft-stat-pill'
                }`}
              >
                <div className="flex items-center justify-center gap-3 text-center">
                  <span
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${
                      featured ? 'bg-white/15 text-white' : 'bg-brand/8 text-brand'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className={`whitespace-nowrap text-xs ${featured ? 'text-white/75' : 'text-slate-500'}`}>{item.label}</div>
                    <div className={`whitespace-nowrap font-semibold ${featured ? 'text-2xl text-white' : 'text-xl text-ink'}`}>
                      {item.value}
                    </div>
                    {featured ? <div className="whitespace-nowrap text-[11px] font-semibold text-white/70">{item.hint}</div> : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4">
        <section className="product-card rounded-[30px] p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { id: 'applications' as const, label: '申请清单', detail: `${stats.total} 个项目`, icon: ClipboardList },
              { id: 'schedule' as const, label: '我的日程', detail: `${filteredScheduleItems.length} 条日程`, icon: CalendarDays },
              { id: 'contacts' as const, label: '我的联系', detail: `${contactSummary.total} 位联系人`, icon: ListChecks }
            ].map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-3 rounded-[24px] px-4 py-4 text-left transition ${
                    active ? 'bg-brand text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-brand'
                  }`}
                >
                  <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${active ? 'bg-white/15' : 'bg-brand/8 text-brand'}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className={`mt-1 block text-xs ${active ? 'text-white/75' : 'text-slate-400'}`}>{item.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </section>

      {activeSection === 'applications' ? (
        <section id="application-board" className="grid gap-5">
            <section className="product-card rounded-[30px] p-5 lg:p-6">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-ink">目标项目筛选</h2>
                  <p className="mt-1 text-sm text-slate-500">先按类型和关键状态缩小范围，再维护材料和申请结果。</p>
                </div>
                <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm lg:w-[320px]">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={applicationKeyword}
                    onChange={(event) => setApplicationKeyword(event.target.value)}
                    placeholder="搜索学校名称"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {workbenchTypeFilters.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setApplicationTypeFilter((current) => (item === '全部' || current === item ? '全部' : item))}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                      applicationTypeFilter === item ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-brand/8 hover:text-brand'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-4 text-sm">
                <ApplicationFilterRow
                  label="学校范围"
                  values={workbenchRangeFilters}
                  active={schoolRangeFilter}
                  onChange={(item) => setSchoolRangeFilter((current) => (item === '全部' || current === item ? '全部' : item))}
                />
                <ApplicationFilterRow
                  label="进行状态"
                  values={workbenchProgressFilters}
                  active={progressFilter}
                  onChange={(item) => setProgressFilter((current) => (item === '全部' || current === item ? '全部' : item))}
                />
                <ApplicationFilterRow
                  label="申请状态"
                  values={workbenchApplicationStatusFilters}
                  active={applicationStatusFilter}
                  onChange={(item) => setApplicationStatusFilter((current) => (item === '全部' || current === item ? '全部' : item))}
                />
                <ApplicationFilterRow
                  label="申请结果"
                  values={workbenchResultFilters}
                  active={resultFilter}
                  onChange={(item) => setResultFilter((current) => (item === '全部' || current === item ? '全部' : item))}
                />
              </div>
            </section>

            <section className="product-card rounded-[30px] p-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div>
                  <h2 className="text-xl font-semibold text-ink">申请进度</h2>
                  <p className="mt-1 text-sm text-slate-500">当前筛选出 {filteredApplicationRows.length} 个项目，所有状态、优先级和材料清单都在这里维护。</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['deadline', '按截止排序'],
                    ['school', '按学校排序']
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setApplicationSort(value as WorkbenchSortOption)}
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                        applicationSort === value ? 'bg-brand/8 text-brand' : 'bg-slate-100 text-slate-600 hover:text-brand'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  <Link href="/notices" className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white">
                    <PlusCircle className="h-4 w-4" />
                    添加项目
                  </Link>
                </div>
              </div>

              <details id="manual-entry" className="mt-5 rounded-[24px] border border-brand/10 bg-brand/5 p-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-brand">
                  手动新增一个未收录项目
                </summary>
                <div className="mt-4">
                  <ManualProjectEntryCard compact onCreated={refreshApplicationRows} />
                </div>
              </details>

              <div className="mt-5 grid gap-3">
                {applicationPreview.length ? (
                  applicationPreview.map((row) => (
                    <ApplicationProgressCard
                      key={row.item.userProjectId}
                      row={row}
                      openChecklistId={openChecklistId}
                      setOpenChecklistId={setOpenChecklistId}
                      isDeleting={deletingProjectId === row.item.userProjectId}
                      onChange={handleRecordChange}
                      onToggleChecklist={handleToggleChecklist}
                      onDelete={handleDeleteApplication}
                    />
                  ))
                ) : (
                  <div className="rounded-[28px] border border-dashed border-black/10 px-5 py-12 text-center">
                    <div className="text-lg font-semibold text-ink">{rows.length ? '没有匹配的申请项目' : '你的申请表还是空的'}</div>
                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
                      {rows.length
                        ? '调整筛选条件或关键词后再试，所有项目都在当前工作台内维护。'
                        : '从通知库加入一个目标项目，或手动录入正在跟进的院校，工作台会立刻开始维护申请状态和材料清单。'}
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                      <Link href="/notices" className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white">
                        去通知库添加
                      </Link>
                      <a href="#manual-entry" className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                        手动新增项目
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {filteredApplicationRows.length ? (
                <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  共 {filteredApplicationRows.length} 个项目。状态、优先级、材料清单和备注修改后会自动同步到你的工作区。
                </div>
              ) : null}
            </section>
        </section>
      ) : null}

      {activeSection === 'schedule' ? (
        <ScheduleWorkspace
          items={filteredScheduleItems}
          totalCount={scheduleItems.length}
          typeFilter={scheduleTypeFilter}
          doneFilter={scheduleDoneFilter}
          keyword={scheduleKeyword}
          onTypeFilterChange={setScheduleTypeFilter}
          onDoneFilterChange={setScheduleDoneFilter}
          onKeywordChange={setScheduleKeyword}
          calendarMonth={calendarMonth}
          onCalendarMonthChange={setCalendarMonth}
          onCreateTodo={handleCreateScheduleTodo}
          onUpdateTodo={handleUpdateScheduleTodo}
          onDeleteTodo={handleDeleteScheduleTodo}
          onDoneChange={handleScheduleDoneChange}
          onClearCompleted={handleClearCompleted}
        />
      ) : null}

      {activeSection === 'contacts' ? (
        <ContactsWorkspace
          contacts={filteredContacts}
          totalCount={contacts.length}
          summary={contactSummary}
          rangeFilter={contactRangeFilter}
          feedbackFilter={contactFeedbackFilter}
          deliveryFilter={contactDeliveryFilter}
          keyword={contactKeyword}
          sort={contactSort}
          onRangeFilterChange={setContactRangeFilter}
          onFeedbackFilterChange={setContactFeedbackFilter}
          onDeliveryFilterChange={setContactDeliveryFilter}
          onKeywordChange={setContactKeyword}
          onSortChange={setContactSort}
          onResetFilters={() => {
            setContactRangeFilter('全部');
            setContactFeedbackFilter('全部');
            setContactDeliveryFilter('全部');
            setContactKeyword('');
            setContactSort('updated');
          }}
          onAddContact={handleAddContact}
          onContactChange={handleContactChange}
          onDeleteContact={handleDeleteContact}
        />
      ) : null}

      {activeSection === 'applications' ? (
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <section id="profile-form" className="surface-card rounded-[30px] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-xl font-semibold text-ink">
              <Settings2 className="h-5 w-5 text-brand" />
              我的背景档案
            </div>
            <button
              onClick={() =>
                setProfileExpandedState({
                  ownerId: profileOwnerId,
                  value: !profileExpanded
                })
              }
              className="inline-flex items-center gap-2 rounded-2xl border border-brand/25 bg-white px-4 py-2.5 text-sm font-semibold text-brand shadow-sm"
            >
              <PencilLine className="h-4 w-4" />
              {profileExpanded ? '收起档案' : '编辑档案'}
            </button>
          </div>

          {profileExpanded ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <CompactField label="昵称">
                <input value={form.nickname} onChange={(event) => handleProfileChange('nickname', event.target.value)} placeholder="例如 张同学" className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none" />
              </CompactField>
              <CompactField label="当前年级">
                <input value={form.grade} onChange={(event) => handleProfileChange('grade', event.target.value)} placeholder="例如 大三" className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none" />
              </CompactField>
              <CompactField label="本科院校">
                <input value={form.undergraduateSchool} onChange={(event) => handleProfileChange('undergraduateSchool', event.target.value)} placeholder="例如 华东师范大学" className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none" />
              </CompactField>
              <CompactField label="本科专业">
                <input value={form.major} onChange={(event) => handleProfileChange('major', event.target.value)} placeholder="例如 计算机科学与技术" className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none" />
              </CompactField>
              <CompactField label="目标专业方向">
                <input value={form.targetMajor} onChange={(event) => handleProfileChange('targetMajor', event.target.value)} placeholder="例如 人工智能 / 机器学习" className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none" />
              </CompactField>
              <CompactField label="目标地区">
                <input value={form.targetRegion} onChange={(event) => handleProfileChange('targetRegion', event.target.value)} placeholder="例如 北京 / 上海 / 杭州" className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none" />
              </CompactField>
              <div className="md:col-span-2">
                <button onClick={handleSaveProfile} className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white">
                  <Save className="h-4 w-4" />
                  保存基本信息
                </button>
                {saveMessage ? <span className="ml-3 text-xs text-slate-500">{saveMessage}</span> : null}
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['本科院校', form.undergraduateSchool || '待完善'],
                ['专业', form.major || '待完善'],
                ['年级', form.grade || '待完善'],
                ['目标方向', form.targetMajor || '待完善']
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="text-xs font-semibold text-slate-400">{label}</div>
                  <div className="mt-2 text-sm font-semibold text-ink">{value}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="surface-card rounded-[30px] p-5">
          <h2 className="text-xl font-semibold text-ink">常用资源</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {resourceShortcuts.map((item) => {
              const Icon = item.icon;

              return (
                <Link key={item.title} href={item.href} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
                  <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${getResourceToneClass(item.tone)}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">{item.title}</span>
                    <span className="mt-1 block text-xs text-slate-500">{item.description}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </section>
      ) : null}

    </SiteShell>
  );
}

function ApplicationFilterRow<T extends string>({
  label,
  values,
  active,
  onChange,
  trailing
}: {
  label: string;
  values: readonly T[];
  active: T;
  onChange: (value: T) => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-[104px_minmax(0,1fr)_minmax(0,360px)] xl:items-center">
      <div className="inline-flex w-fit items-center whitespace-nowrap rounded-xl bg-brand/8 px-3 py-2 font-semibold text-brand">
        {label}
      </div>
      <div className="flex flex-wrap gap-x-7 gap-y-3">
        {values.map((item) => {
          const selected = active === item;

          return (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              className={`inline-flex items-center gap-2 text-sm font-medium transition ${
                selected ? 'text-brand' : 'text-slate-600 hover:text-brand'
              }`}
            >
              <span
                className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                  selected ? 'border-brand' : 'border-slate-400'
                }`}
              >
                {selected ? <span className="h-2 w-2 rounded-full bg-brand" /> : null}
              </span>
              {item}
            </button>
          );
        })}
      </div>
      {trailing ? <div className="xl:justify-self-start">{trailing}</div> : null}
    </div>
  );
}

function ScheduleWorkspace({
  items,
  totalCount,
  typeFilter,
  doneFilter,
  keyword,
  onTypeFilterChange,
  onDoneFilterChange,
  onKeywordChange,
  calendarMonth,
  onCalendarMonthChange,
  onCreateTodo,
  onUpdateTodo,
  onDeleteTodo,
  onDoneChange,
  onClearCompleted
}: {
  items: ScheduleItem[];
  totalCount: number;
  typeFilter: ScheduleTypeFilter;
  doneFilter: ScheduleDoneFilter;
  keyword: string;
  onTypeFilterChange: (value: ScheduleTypeFilter) => void;
  onDoneFilterChange: (value: ScheduleDoneFilter) => void;
  onKeywordChange: (value: string) => void;
  calendarMonth: string;
  onCalendarMonthChange: (value: string) => void;
  onCreateTodo: (payload: Pick<WorkbenchCustomTodo, 'text'> & Partial<Omit<WorkbenchCustomTodo, 'id' | 'text'>>) => string;
  onUpdateTodo: (id: string, patch: Partial<Omit<WorkbenchCustomTodo, 'id'>>) => void;
  onDeleteTodo: (id: string) => void;
  onDoneChange: (id: string, done: boolean) => void;
  onClearCompleted: () => void;
}) {
  const [expandedScheduleId, setExpandedScheduleId] = useState('');
  const today = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDate, setDraftDate] = useState(today);
  const [draftType, setDraftType] = useState<Exclude<ScheduleTypeFilter, '全部'>>('其他');
  const [draftNote, setDraftNote] = useState('');
  const calendarCells = getCalendarCells(calendarMonth);
  const itemsByDate = items.reduce<Record<string, ScheduleItem[]>>((grouped, item) => {
    if (!item.date) {
      return grouped;
    }

    grouped[item.date] = [...(grouped[item.date] || []), item];
    return grouped;
  }, {});
  const monthItems = items.filter((item) => item.date?.startsWith(calendarMonth));
  const todayItems = items.filter((item) => item.date === today);
  const selectedDateItems = items.filter((item) => item.date === selectedDate);
  const unfinishedItems = items.filter((item) => !item.done);
  const unplannedItems = items.filter((item) => !item.date);
  const upcomingItems = items
    .filter((item) => !item.done && item.date && item.date >= today)
    .sort((left, right) => (left.date || '').localeCompare(right.date || ''))
    .slice(0, 4);
  const groupedItems = items.reduce<Record<string, ScheduleItem[]>>((grouped, item) => {
    const key = item.date || 'unplanned';
    grouped[key] = [...(grouped[key] || []), item];
    return grouped;
  }, {});
  const groupKeys = Object.keys(groupedItems).sort((left, right) => {
    if (left === 'unplanned') return 1;
    if (right === 'unplanned') return -1;
    return left.localeCompare(right);
  });
  const activeFilterCount = [typeFilter !== '全部', doneFilter !== '全部', Boolean(keyword.trim())].filter(Boolean).length;

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setDraftDate(date);
  }

  function handleCalendarMonthChange(nextMonth: string) {
    onCalendarMonthChange(nextMonth);
    const nextSelectedDate = nextMonth === getMonthKey(today) ? today : `${nextMonth}-01`;
    setSelectedDate(nextSelectedDate);
    setDraftDate(nextSelectedDate);
  }

  function handleSubmitSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draftTitle.trim();
    if (!text) {
      return;
    }

    const nextId = onCreateTodo({
      text,
      date: draftDate.trim(),
      type: draftType,
      note: draftNote.trim()
    });
    if (nextId) {
      setExpandedScheduleId(nextId);
      if (draftDate) {
        setSelectedDate(draftDate);
        onCalendarMonthChange(getMonthKey(draftDate));
      }
    }
    setDraftTitle('');
    setDraftNote('');
  }

  return (
    <section id="schedule-board" className="grid gap-4">
      <section className="product-card rounded-[30px] p-5 lg:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-ink">我的日程</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
              日程由你自己维护。把申请截止、材料准备、导师联系、笔试面试等关键安排放进月历里。
            </p>
          </div>
          <button onClick={onClearCompleted} className="inline-flex items-center justify-center rounded-2xl border border-brand/20 bg-white px-4 py-2.5 text-sm font-semibold text-brand shadow-sm">
            清理已完成
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            { label: '本月日程', value: monthItems.length, detail: formatMonthTitle(calendarMonth), icon: CalendarDays },
            { label: '今天', value: todayItems.length, detail: todayItems.length ? '当天事项' : '暂无安排', icon: Clock3 },
            { label: '未完成', value: unfinishedItems.length, detail: '需要继续推进', icon: Target },
            { label: '待安排', value: unplannedItems.length, detail: '还没有日期', icon: ListChecks }
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.label} className="rounded-[24px] border border-slate-100 bg-white px-4 py-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/8 text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-right">
                    <span className="block text-xs font-semibold text-slate-400">{item.label}</span>
                    <span className="mt-1 block text-2xl font-semibold text-ink">{item.value}</span>
                  </span>
                </div>
                <div className="mt-3 truncate text-xs font-semibold text-slate-500">{item.detail}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="rounded-[28px] bg-slate-50/80 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCalendarMonthChange(shiftMonth(calendarMonth, -1))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition hover:text-brand"
                  aria-label="上个月"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="min-w-[8rem] rounded-full bg-white px-4 py-2 text-center text-sm font-semibold text-brand shadow-sm">
                  {formatMonthTitle(calendarMonth)}
                </div>
                <button
                  type="button"
                  onClick={() => handleCalendarMonthChange(shiftMonth(calendarMonth, 1))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition hover:text-brand"
                  aria-label="下个月"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleCalendarMonthChange(getMonthKey())}
                className="w-fit rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-500 shadow-sm transition hover:text-brand"
              >
                回到本月
              </button>
            </div>

            <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-400">
              {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-2">
              {calendarCells.map((cell, index) => {
                const dayItems = cell ? itemsByDate[cell.date] || [] : [];
                const isToday = cell?.date === today;
                const isSelected = cell?.date === selectedDate;

                return (
                  <button
                    key={cell?.date || `blank-${index}`}
                    type="button"
                    disabled={!cell}
                    onClick={() => (cell ? handleSelectDate(cell.date) : undefined)}
                    className={`min-h-[92px] rounded-2xl border p-2 text-left transition ${
                      cell
                        ? isSelected
                          ? 'border-brand/35 bg-white shadow-sm ring-4 ring-brand/5'
                          : isToday
                            ? 'border-brand/20 bg-white shadow-sm'
                            : 'border-white bg-white/75 hover:border-brand/20 hover:bg-white'
                        : 'border-transparent bg-transparent'
                    }`}
                  >
                    {cell ? (
                      <>
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-sm font-semibold ${isToday || isSelected ? 'text-brand' : 'text-slate-600'}`}>{cell.day}</span>
                          {dayItems.length ? (
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{dayItems.length}</span>
                          ) : null}
                        </div>
                        <div className="mt-2 grid gap-1">
                          {dayItems.slice(0, 3).map((item) => (
                            <span key={item.id} className="flex min-w-0 items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${getScheduleDotTone(item.type)}`} />
                              <span className="truncate">{item.title}</span>
                            </span>
                          ))}
                          {dayItems.length > 3 ? (
                            <div className="px-2 text-[11px] font-semibold text-slate-400">+{dayItems.length - 3}</div>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="grid content-start gap-3">
            <section className="rounded-[26px] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-400">选中日期</div>
                  <div className="mt-1 text-2xl font-semibold text-ink">{formatScheduleDateTitle(selectedDate)}</div>
                  <div className="mt-1 text-xs font-semibold text-brand">{getScheduleRelativeLabel(selectedDate, today)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDraftDate(selectedDate);
                    setDraftTitle('');
                  }}
                  className="rounded-full bg-brand/8 px-3 py-2 text-xs font-semibold text-brand"
                >
                  添加到这天
                </button>
              </div>
              <div className="mt-4 grid gap-2">
                {selectedDateItems.length ? (
                  selectedDateItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setExpandedScheduleId(item.id)}
                      className="flex min-w-0 items-start gap-3 rounded-2xl bg-slate-50 px-3 py-3 text-left transition hover:bg-brand/5"
                    >
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${getScheduleDotTone(item.type)}`} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{item.title}</span>
                        <span className="mt-1 block truncate text-xs text-slate-500">{item.type} · {item.done ? '已完成' : '未完成'}</span>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm leading-7 text-slate-500">
                    当天暂无安排。选中日期后可以直接新增一条日程。
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[26px] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-ink">下一步</h3>
                <span className="text-xs font-semibold text-slate-400">{unfinishedItems.length} 未完成</span>
              </div>
              <div className="mt-3 grid gap-2">
                {upcomingItems.length ? (
                  upcomingItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setExpandedScheduleId(item.id)}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3 text-left transition hover:bg-brand/5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{item.title}</span>
                        <span className="mt-1 block text-xs text-slate-500">{formatScheduleDateTitle(item.date)} · {getScheduleRelativeLabel(item.date, today)}</span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getScheduleTypeTone(item.type)}`}>{item.type}</span>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-7 text-sm leading-7 text-slate-500">
                    暂无未来待办。可以先补充材料准备、联系导师或笔面试安排。
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>

        <form onSubmit={handleSubmitSchedule} className="mt-5 rounded-[28px] border border-brand/10 bg-brand/5 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-ink">快速新增</h3>
              <p className="mt-1 text-sm text-slate-500">像日程软件一样先把事情记下来，再补日期、类型和备注。</p>
            </div>
            {draftDate ? (
              <div className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm">
                默认日期：{formatScheduleDateTitle(draftDate)}
              </div>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px_150px]">
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="输入日程，例如 复旦材料提交 / 联系导师 / 面试复盘"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand/30"
            />
            <input
              value={draftDate}
              onChange={(event) => setDraftDate(event.target.value)}
              type="date"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm outline-none transition focus:border-brand/30"
            />
            <select
              value={draftType}
              onChange={(event) => setDraftType(getManualScheduleType(event.target.value))}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm outline-none transition focus:border-brand/30"
            >
              {manualScheduleTypes.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] xl:pr-28">
            <input
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
              placeholder="备注，例如 个人陈述、成绩单、推荐信或下一步动作"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand/30"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5"
            >
              <PlusCircle className="h-4 w-4" />
              新增日程
            </button>
          </div>
        </form>

        <div className="mt-5 grid gap-4 rounded-[28px] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={keyword}
                onChange={(event) => onKeywordChange(event.target.value)}
                placeholder="搜索日程标题或备注"
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </label>
            {activeFilterCount ? (
              <button
                type="button"
                onClick={() => {
                  onTypeFilterChange('全部');
                  onDoneFilterChange('全部');
                  onKeywordChange('');
                }}
                className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-500 transition hover:text-brand"
              >
                清空筛选
              </button>
            ) : null}
          </div>
          <div className="grid gap-3 text-sm">
            <div className="grid gap-2 lg:grid-cols-[84px_minmax(0,1fr)] lg:items-center">
              <div className="font-semibold text-slate-500">日程类型</div>
              <div className="flex flex-wrap gap-2">
                {scheduleTypeFilters.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onTypeFilterChange(item === '全部' || typeFilter === item ? '全部' : item)}
                    className={`rounded-full px-3 py-1.5 font-semibold transition ${
                      typeFilter === item ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500 hover:bg-brand/8 hover:text-brand'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 lg:grid-cols-[84px_minmax(0,1fr)] lg:items-center">
              <div className="font-semibold text-slate-500">完成状态</div>
              <div className="flex flex-wrap gap-2">
                {scheduleDoneFilters.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onDoneFilterChange(item === '全部' || doneFilter === item ? '全部' : item)}
                    className={`rounded-full px-3 py-1.5 font-semibold transition ${
                      doneFilter === item ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500 hover:bg-brand/8 hover:text-brand'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="surface-card rounded-[30px] p-5">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ink">日程列表</h2>
            <p className="mt-1 text-sm text-slate-500">当前显示 {items.length} / {totalCount} 个事项。</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1">未完成 {unfinishedItems.length}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1">待安排 {unplannedItems.length}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1">本月 {monthItems.length}</span>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {items.length ? (
            groupKeys.map((groupKey) => (
              <div key={groupKey} className="grid gap-2">
                <div className="flex items-center justify-between px-1 text-xs font-semibold text-slate-400">
                  <span>{groupKey === 'unplanned' ? '待安排' : `${formatScheduleDateTitle(groupKey)} · ${getScheduleRelativeLabel(groupKey, today)}`}</span>
                  <span>{groupedItems[groupKey].length} 项</span>
                </div>
                {groupedItems[groupKey].map((item) => {
                  const expanded = expandedScheduleId === item.id;

                  return (
                    <article key={item.id} className={`rounded-[24px] border bg-white shadow-sm transition ${expanded ? 'border-brand/20 ring-4 ring-brand/5' : 'border-slate-100 hover:border-brand/20'}`}>
                      <div className="grid gap-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                        <button
                          type="button"
                          onClick={() => onDoneChange(item.id, !item.done)}
                          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            item.done ? 'bg-brand text-white' : 'bg-slate-50 text-slate-300 hover:text-brand'
                          }`}
                          aria-label={item.done ? `恢复日程：${item.title}` : `完成日程：${item.title}`}
                        >
                          {item.done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => setExpandedScheduleId(expanded ? '' : item.id)}
                          className="min-w-0 text-left"
                        >
                          <span className="flex flex-wrap items-center gap-2">
                            <span className={`line-clamp-1 text-base font-semibold ${item.done ? 'text-slate-400 line-through' : 'text-ink'}`}>{item.title}</span>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getScheduleTypeTone(item.type)}`}>{item.type}</span>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.done ? 'bg-emerald-50 text-brand' : 'bg-amber-50 text-amber-700'}`}>
                              {item.done ? '已完成' : '未完成'}
                            </span>
                          </span>
                          <span className="mt-1 block line-clamp-2 text-sm leading-6 text-slate-500">{item.detail}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setExpandedScheduleId(expanded ? '' : item.id)}
                          className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 text-left sm:min-w-[170px]"
                        >
                          <span>
                            <span className="block text-xs font-semibold text-slate-400">{getScheduleRelativeLabel(item.date, today)}</span>
                            <span className="mt-1 block text-sm font-semibold text-ink">{item.dateLabel}</span>
                          </span>
                          <ChevronRight className={`h-4 w-4 text-slate-400 transition ${expanded ? 'rotate-90 text-brand' : ''}`} />
                        </button>
                      </div>

                      {expanded ? (
                        <ScheduleEditor
                          item={item}
                          onSave={(patch) => {
                            onUpdateTodo(item.id, patch);
                            if (patch.date) {
                              setSelectedDate(patch.date);
                              onCalendarMonthChange(getMonthKey(patch.date));
                            }
                            setExpandedScheduleId('');
                          }}
                          onDelete={() => {
                            onDeleteTodo(item.id);
                            setExpandedScheduleId('');
                          }}
                          onDoneChange={(done) => onDoneChange(item.id, done)}
                        />
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ))
          ) : (
            <div className="rounded-[28px] border border-dashed border-slate-200 px-5 py-14 text-center">
              <div className="text-lg font-semibold text-ink">当前条件下暂无日程</div>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
                调整筛选条件，或在上方手动新增一条日程，日期、类型和备注都由你自己填写。
              </p>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}

function ScheduleEditor({
  item,
  onSave,
  onDelete,
  onDoneChange
}: {
  item: ScheduleItem;
  onSave: (patch: Pick<WorkbenchCustomTodo, 'text'> & Partial<Omit<WorkbenchCustomTodo, 'id' | 'text'>>) => void;
  onDelete: () => void;
  onDoneChange: (done: boolean) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [date, setDate] = useState(item.date || '');
  const [type, setType] = useState<Exclude<ScheduleTypeFilter, '全部'>>(item.type);
  const [note, setNote] = useState(item.detail === '手动添加的工作台事项' ? '' : item.detail);
  const [done, setDone] = useState(item.done);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) {
      return;
    }

    onSave({
      text: nextTitle,
      date,
      type,
      note
    });
    onDoneChange(done);
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-slate-100 px-4 pb-4 pt-4">
      <div className="mb-4 flex flex-col gap-3 rounded-[22px] bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-ink">编辑日程</div>
          <div className="mt-1 text-xs text-slate-500">修改标题、日期、类型和备注，保存后会回到一行摘要。</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-500 transition hover:bg-rose-100"
          >
            <Trash2 className="h-4 w-4" />
            删除
          </button>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep"
          >
            保存并收起
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_150px_150px]">
        <CompactField label="日程标题">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如 北大材料提交"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand/40"
          />
        </CompactField>
        <CompactField label="日期">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand/40"
          />
        </CompactField>
        <CompactField label="类型">
          <select
            value={type}
            onChange={(event) => setType(getManualScheduleType(event.target.value))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand/40"
          >
            {manualScheduleTypes.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </CompactField>
        <CompactField label="完成状态">
          <select
            value={done ? '已完成' : '未完成'}
            onChange={(event) => setDone(event.target.value === '已完成')}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand/40"
          >
            <option value="未完成">未完成</option>
            <option value="已完成">已完成</option>
          </select>
        </CompactField>
      </div>

      <div className="mt-3">
        <CompactField label="备注">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="补充材料、链接、联系人或下一步动作"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand/40"
          />
        </CompactField>
      </div>
    </form>
  );
}

function ContactsWorkspace({
  contacts,
  totalCount,
  summary,
  rangeFilter,
  feedbackFilter,
  deliveryFilter,
  keyword,
  sort,
  onRangeFilterChange,
  onFeedbackFilterChange,
  onDeliveryFilterChange,
  onKeywordChange,
  onSortChange,
  onResetFilters,
  onAddContact,
  onContactChange,
  onDeleteContact
}: {
  contacts: MentorContact[];
  totalCount: number;
  summary: { total: number; delivered: number; replied: number; followUp: number };
  rangeFilter: ContactRangeFilter;
  feedbackFilter: '全部' | ContactFeedbackStatus;
  deliveryFilter: '全部' | ContactDeliveryStatus;
  keyword: string;
  sort: ContactSortOption;
  onRangeFilterChange: (value: ContactRangeFilter) => void;
  onFeedbackFilterChange: (value: '全部' | ContactFeedbackStatus) => void;
  onDeliveryFilterChange: (value: '全部' | ContactDeliveryStatus) => void;
  onKeywordChange: (value: string) => void;
  onSortChange: (value: ContactSortOption) => void;
  onResetFilters: () => void;
  onAddContact: () => string;
  onContactChange: <K extends keyof MentorContact>(id: string, key: K, value: MentorContact[K]) => void;
  onDeleteContact: (id: string) => void;
}) {
  const [expandedContactId, setExpandedContactId] = useState('');
  const hasActiveFilters = rangeFilter !== '全部' || feedbackFilter !== '全部' || deliveryFilter !== '全部' || keyword.trim().length > 0;
  const handleAddContact = () => {
    setExpandedContactId(onAddContact());
  };

  return (
    <section id="contacts-board" className="grid gap-4">
      <section className="product-card rounded-[30px] p-5 lg:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-ink">我的联系</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
              维护导师信息、投递状态和联系反馈，避免邮箱、方向、跟进备注分散在多个表格里。
            </p>
          </div>
          <button onClick={handleAddContact} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep">
            <PlusCircle className="h-4 w-4" />
            添加导师
          </button>
        </div>

        <div className="mt-5 grid gap-3 text-sm">
          <ContactFilterRow label="学院层次" values={contactRangeFilters} active={rangeFilter} onChange={onRangeFilterChange} />
          <ContactFilterRow label="联系反馈" values={contactFeedbackFilters} active={feedbackFilter} onChange={onFeedbackFilterChange} />
          <ContactFilterRow label="投递状态" values={contactDeliveryFilters} active={deliveryFilter} onChange={onDeliveryFilterChange} />
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px]">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => onKeywordChange(event.target.value)}
              placeholder="搜索高校、学院、导师、方向或邮箱"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </label>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as ContactSortOption)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm outline-none"
          >
            <option value="updated">按更新时间</option>
            <option value="school">按高校</option>
            <option value="lastContact">按最近联系</option>
          </select>
        </div>

        {hasActiveFilters || sort !== 'updated' ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
              {rangeFilter !== '全部' ? <span className="rounded-full bg-white px-2.5 py-1">层次：{rangeFilter}</span> : null}
              {feedbackFilter !== '全部' ? <span className="rounded-full bg-white px-2.5 py-1">反馈：{feedbackFilter}</span> : null}
              {deliveryFilter !== '全部' ? <span className="rounded-full bg-white px-2.5 py-1">投递：{deliveryFilter}</span> : null}
              {keyword.trim() ? <span className="rounded-full bg-white px-2.5 py-1">关键词：{keyword.trim()}</span> : null}
              {sort !== 'updated' ? <span className="rounded-full bg-white px-2.5 py-1">排序：{sort === 'school' ? '按高校' : '按最近联系'}</span> : null}
            </div>
            <button type="button" onClick={onResetFilters} className="text-sm font-semibold text-brand hover:text-brand-deep">
              清空筛选
            </button>
          </div>
        ) : null}
      </section>

      <section className="surface-card rounded-[30px] p-5">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ink">联系对象</h2>
            <p className="mt-1 text-sm text-slate-500">
              当前显示 {contacts.length} / {totalCount} 位联系人，新增后会出现在列表顶部，修改内容会自动保存。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
              <span className="rounded-full bg-slate-100 px-2.5 py-1">总计 {summary.total}</span>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-600">已投递 {summary.delivered}</span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-brand">已回复 {summary.replied}</span>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">需跟进 {summary.followUp}</span>
            </div>
            <button
              type="button"
              onClick={handleAddContact}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep"
            >
              <PlusCircle className="h-4 w-4" />
              添加导师
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {contacts.length ? (
            contacts.map((contact) => {
              const expanded = expandedContactId === contact.id;
              const title = contact.mentorName || contact.schoolName || '新导师联系人';
              const subtitle =
                [contact.schoolName, contact.departmentName, contact.researchDirection].filter(Boolean).join(' · ') ||
                '保存后会以这一行摘要展示，点击即可继续编辑。';

              return (
                <article key={contact.id} className={`rounded-[26px] border bg-white shadow-sm transition ${expanded ? 'border-brand/20 ring-4 ring-brand/5' : 'border-slate-100 hover:border-brand/20'}`}>
                  <button
                    type="button"
                    onClick={() => setExpandedContactId(expanded ? '' : contact.id)}
                    className="grid w-full gap-3 px-4 py-4 text-left sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/8 text-sm font-semibold text-brand">
                        {(contact.mentorName || contact.schoolName || '导').slice(0, 1)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-base font-semibold text-ink">{title}</span>
                        <span className="mt-1 block truncate text-sm text-slate-500">{subtitle}</span>
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs font-semibold sm:justify-end">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">{contact.schoolRange}</span>
                      <span className={contact.deliveryStatus === '已投递' ? 'rounded-full bg-blue-50 px-2.5 py-1 text-blue-600' : 'rounded-full bg-slate-100 px-2.5 py-1 text-slate-500'}>
                        {contact.deliveryStatus}
                      </span>
                      <span className={contact.feedbackStatus === '已回复' || contact.feedbackStatus === '已offer' ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-brand' : 'rounded-full bg-amber-50 px-2.5 py-1 text-amber-700'}>
                        {contact.feedbackStatus}
                      </span>
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                        <ChevronRight className={`h-4 w-4 transition ${expanded ? 'rotate-90 text-brand' : ''}`} />
                      </span>
                    </span>
                  </button>

                  {expanded ? (
                    <div className="border-t border-slate-100 px-4 pb-4 pt-4">
                      <div className="mb-4 flex flex-col gap-3 rounded-[22px] bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-ink">编辑导师信息</div>
                          <div className="mt-1 text-xs text-slate-500">内容会自动保存，确认无误后可以收起成一行摘要。</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExpandedContactId('')}
                          className="inline-flex items-center justify-center rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep"
                        >
                          保存并收起
                        </button>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-[1.05fr_1fr_0.85fr_0.8fr_auto] lg:items-end">
                        <CompactField label="所在高校">
                          <input value={contact.schoolName} onChange={(event) => onContactChange(contact.id, 'schoolName', event.target.value)} placeholder="例如 清华大学" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand/40" />
                        </CompactField>
                        <CompactField label="所在学院">
                          <input value={contact.departmentName} onChange={(event) => onContactChange(contact.id, 'departmentName', event.target.value)} placeholder="例如 计算机学院" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand/40" />
                        </CompactField>
                        <CompactField label="导师名字">
                          <input value={contact.mentorName} onChange={(event) => onContactChange(contact.id, 'mentorName', event.target.value)} placeholder="导师名字" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand/40" />
                        </CompactField>
                        <CompactField label="导师职称">
                          <input value={contact.mentorTitle} onChange={(event) => onContactChange(contact.id, 'mentorTitle', event.target.value)} placeholder="教授 / 副教授" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand/40" />
                        </CompactField>
                        <button type="button" onClick={() => onDeleteContact(contact.id)} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 transition hover:bg-rose-100" aria-label="删除联系人">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-3 grid gap-3 lg:grid-cols-[0.9fr_1fr_1.3fr_1.3fr]">
                        <CompactField label="学院层次">
                          <select value={contact.schoolRange} onChange={(event) => onContactChange(contact.id, 'schoolRange', event.target.value as MentorContact['schoolRange'])} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand/40">
                            {contactRangeFilters.filter((item) => item !== '全部').map((item) => (
                              <option key={item} value={item}>{item}</option>
                            ))}
                          </select>
                        </CompactField>
                        <CompactField label="导师邮箱">
                          <input value={contact.email} onChange={(event) => onContactChange(contact.id, 'email', event.target.value)} placeholder="mentor@example.com" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand/40" />
                        </CompactField>
                        <CompactField label="导师方向">
                          <input value={contact.researchDirection} onChange={(event) => onContactChange(contact.id, 'researchDirection', event.target.value)} placeholder="研究方向或关键词" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand/40" />
                        </CompactField>
                        <CompactField label="导师主页">
                          <input value={contact.homepage} onChange={(event) => onContactChange(contact.id, 'homepage', event.target.value)} placeholder="https://..." className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand/40" />
                        </CompactField>
                      </div>

                      <div className="mt-3 grid gap-3 lg:grid-cols-[0.85fr_0.85fr_1fr]">
                        <CompactField label="投递状态">
                          <select value={contact.deliveryStatus} onChange={(event) => onContactChange(contact.id, 'deliveryStatus', event.target.value as ContactDeliveryStatus)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand/40">
                            {contactDeliveryFilters.filter((item) => item !== '全部').map((item) => (
                              <option key={item} value={item}>{item}</option>
                            ))}
                          </select>
                        </CompactField>
                        <CompactField label="联系反馈">
                          <select value={contact.feedbackStatus} onChange={(event) => onContactChange(contact.id, 'feedbackStatus', event.target.value as ContactFeedbackStatus)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand/40">
                            {contactFeedbackFilters.filter((item) => item !== '全部').map((item) => (
                              <option key={item} value={item}>{item}</option>
                            ))}
                          </select>
                        </CompactField>
                        <CompactField label="最近联系">
                          <input type="date" value={contact.lastContactDate} onChange={(event) => onContactChange(contact.id, 'lastContactDate', event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand/40" />
                        </CompactField>
                      </div>

                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        <CompactField label="导师特点">
                          <textarea value={contact.contactNotes} onChange={(event) => onContactChange(contact.id, 'contactNotes', event.target.value)} rows={3} placeholder="职称、团队情况、招生倾向、沟通印象等" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand/40" />
                        </CompactField>
                        <CompactField label="备注">
                          <textarea value={contact.notes} onChange={(event) => onContactChange(contact.id, 'notes', event.target.value)} rows={3} placeholder="补充信息、下次跟进动作或材料说明" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand/40" />
                        </CompactField>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="rounded-[28px] border border-dashed border-slate-200 px-5 py-14 text-center">
              <div className="text-lg font-semibold text-ink">{totalCount ? '没有匹配的联系人' : '还没有联系对象'}</div>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
                {totalCount && hasActiveFilters
                  ? '当前筛选条件把联系人隐藏了。添加新导师会自动回到全部联系人，也可以手动清空筛选后再查看。'
                  : '先新增导师联系人，再记录邮箱、方向、投递状态和反馈。'}
              </p>
              <button onClick={handleAddContact} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white">
                <PlusCircle className="h-4 w-4" />
                添加导师
              </button>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}

function ContactFilterRow<T extends string>({
  label,
  values,
  active,
  onChange
}: {
  label: string;
  values: readonly T[];
  active: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-2 lg:grid-cols-[84px_minmax(0,1fr)] lg:items-center">
      <div className="font-semibold text-slate-500">{label}</div>
      <div className="flex flex-wrap gap-2">
        {values.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item === '全部' || active === item ? ('全部' as T) : item)}
            className={`rounded-full px-3 py-1.5 font-semibold transition ${
              active === item ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500 hover:bg-brand/8 hover:text-brand'
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function ApplicationProgressCard({
  row,
  openChecklistId,
  setOpenChecklistId,
  isDeleting,
  onChange,
  onToggleChecklist,
  onDelete
}: {
  row: ApplicationRow;
  openChecklistId: string;
  setOpenChecklistId: (id: string) => void;
  isDeleting: boolean;
  onChange: (userProjectId: string, patch: Partial<UserProjectRecord>) => Promise<void>;
  onToggleChecklist: (userProjectId: string, field: MaterialChecklistKey, currentValue: boolean) => Promise<void>;
  onDelete: (row: ApplicationRow) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { item, project } = row;
  const checklistOpen = openChecklistId === item.userProjectId;
  const completed = getMaterialCompletedCount(item.materialsProgress);
  const total = materialChecklistDefinitions.length;
  const missing = total - completed;
  const daysLeft = getDaysLeft(project.deadlineDate);
  const href = project.sourceSite === '用户手动录入' ? '#manual-entry' : buildNoticeDetailHref(project.id);

  return (
    <article className="rounded-[28px] border border-slate-100 bg-white px-5 py-5 shadow-sm transition hover:border-brand/20 hover:shadow-soft md:px-7">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.82fr)] lg:items-start">
        <div className="flex min-w-0 items-start gap-5">
          <WorkbenchApplicationMark project={project} />
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h3 className="max-w-full truncate text-xl font-semibold leading-tight text-ink">{getDisplaySchoolName(project.schoolName)}</h3>
              <span className="text-sm font-semibold text-slate-500">· {getDisplayNoticeDepartment(project)}</span>
            </div>
            <p className="mt-2 line-clamp-2 max-w-2xl text-base leading-7 text-slate-600">{normalizeNoticeTitle(project.projectName, 72)}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-brand">{getDisplayProjectType(project.projectType)}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">{getDisplayDiscipline(project.discipline)}</span>
              {project.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1">{tag}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50/80 px-4 py-3 text-sm">
            <div className="text-xs font-semibold text-slate-400">截止时间</div>
            <div className={project.deadlineLevel === 'expired' || project.deadlineLevel === 'today' ? 'mt-2 font-semibold text-rose-500' : 'mt-2 font-semibold text-brand'}>
              {formatNoticeDateOnly(project.deadlineDate)}
            </div>
            <div className="mt-1 text-xs text-slate-500">{daysLeft === null ? '待补充' : daysLeft < 0 ? `超期 ${Math.abs(daysLeft)} 天` : `剩余 ${daysLeft} 天`}</div>
          </div>

          <div className="rounded-2xl bg-slate-50/80 px-4 py-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-400">材料进度</span>
              <span className={missing ? 'font-semibold text-orange-500' : 'font-semibold text-brand'}>
                {missing ? `待补 ${missing}` : '已完成'}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand" style={{ width: `${item.materialsProgress}%` }} />
            </div>
            <div className="mt-1 text-xs font-semibold text-ink">{completed} / {total}</div>
          </div>

          <div className="rounded-2xl bg-slate-50/80 px-4 py-3">
            <div className="mb-2 text-xs font-semibold text-slate-400">优先级</div>
            <select
              value={item.priorityLevel}
              onChange={(event) =>
                onChange(item.userProjectId, {
                  priorityLevel: event.target.value as UserProjectRecord['priorityLevel']
                })
              }
              className={`w-full rounded-xl border border-transparent px-3 py-2 text-xs font-semibold outline-none ${getPriorityTone(item.priorityLevel)}`}
            >
              {priorityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl bg-slate-50/80 px-4 py-3">
            <div className="mb-2 text-xs font-semibold text-slate-400">状态</div>
            <select
              value={item.myStatus}
              onChange={(event) =>
                onChange(item.userProjectId, {
                  myStatus: event.target.value as UserProjectRecord['myStatus']
                })
              }
              className={`w-full rounded-xl border border-transparent px-3 py-2 text-xs font-semibold outline-none ${getWorkbenchStatusTone(item.myStatus)}`}
            >
              {userStatusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-4 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500">
        <Link href={href} className="inline-flex items-center gap-1 hover:text-brand">
          <ExternalLink className="h-3.5 w-3.5" />
          {project.sourceSite === '用户手动录入' ? '查看录入' : '查看通知'}
        </Link>
        <button
          type="button"
          onClick={() => setOpenChecklistId(checklistOpen ? '' : item.userProjectId)}
          className="inline-flex items-center gap-1 hover:text-brand"
        >
          <ListChecks className="h-3.5 w-3.5" />
          {checklistOpen ? '收起材料' : '材料清单'}
        </button>
        <button
          type="button"
          onClick={() => setOpenChecklistId(item.userProjectId)}
          className="inline-flex items-center gap-1 hover:text-brand"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          编辑备注
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-brand"
            aria-label="更多操作"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div className="absolute bottom-10 right-0 z-20 w-44 rounded-2xl border border-black/5 bg-white p-2 text-left shadow-float">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(row);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? '删除中...' : '从申请表删除'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {checklistOpen ? (
        <div className="mt-4 rounded-[24px] border border-slate-100 bg-slate-50/75 p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {materialChecklistDefinitions.map((field) => (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => onToggleChecklist(item.userProjectId, field.key, item[field.key])}
                  className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                    item[field.key] ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-slate-500 shadow-sm'
                  }`}
                >
                  {item[field.key] ? '已完成' : '待完成'} · {field.label}
                </button>
              ))}
            </div>
            <textarea
              rows={4}
              defaultValue={item.myNotes}
              onBlur={(event) => {
                if (event.currentTarget.value !== item.myNotes) {
                  void onChange(item.userProjectId, { myNotes: event.currentTarget.value });
                }
              }}
              placeholder="记录导师反馈、材料缺口、投递账号或提交备注..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand/40"
            />
          </div>
        </div>
      ) : null}
    </article>
  );
}

function WorkbenchApplicationMark({ project }: { project: ApplicationRow['project'] }) {
  const label = getDisplaySchoolName(project.schoolName);

  return (
    <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-[1.35rem] bg-white shadow-sm ring-1 ring-slate-200">
      <ExternalSiteMark source={resolveNoticeLogoSource(project)} label={label} size="xl" rounded="full" variant="image" />
    </div>
  );
}

function CompactField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      {children}
    </label>
  );
}

