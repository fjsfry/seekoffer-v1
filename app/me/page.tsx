'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowUp,
  BookCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileText,
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
  Square,
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

type ActionTask = {
  id: string;
  title: string;
  detail: string;
  href?: string;
};

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

function getManualScheduleType(value?: string): Exclude<ScheduleTypeFilter, '全部'> {
  return manualScheduleTypes.includes(value as Exclude<ScheduleTypeFilter, '全部'>)
    ? (value as Exclude<ScheduleTypeFilter, '全部'>)
    : '其他';
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
  const [todoDraft, setTodoDraft] = useState('');
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

  const profileComplete = isProfileComplete(form);

  const stats = useMemo(
    () => ({
      total: rows.length,
      submitted: rows.filter((row) => row.item.myStatus === '已提交').length,
      highRisk: rows.filter((row) => row.project.deadlineLevel === 'today' || row.project.deadlineLevel === 'within3days')
        .length,
      upcoming7: rows.filter((row) =>
        ['today', 'within3days', 'within7days'].includes(row.project.deadlineLevel)
      ).length,
      materialPending: rows.filter((row) => row.item.materialsProgress < 100).length,
      pendingResults: rows.filter((row) => row.item.myStatus === '已提交' || row.item.myStatus === '待考核').length,
      actionCount: rows.filter((row) => row.item.materialsProgress < 100 || row.item.myStatus === '待考核').length
    }),
    [rows]
  );

  const pipelineSummary = useMemo(() => {
    const finishedStatuses = ['已通过', '未通过', '已放弃'];

    return {
      已收藏: rows.filter((row) => row.item.myStatus === '已收藏').length,
      准备材料中: rows.filter((row) => row.item.myStatus === '准备材料中').length,
      已提交: rows.filter((row) => row.item.myStatus === '已提交').length,
      待考核: rows.filter((row) => row.item.myStatus === '待考核').length,
      已结束: rows.filter((row) => finishedStatuses.includes(row.item.myStatus)).length
    };
  }, [rows]);

  const actionTasks = useMemo<ActionTask[]>(() => {
    const tasks: ActionTask[] = [];

    if (!profileComplete) {
      tasks.push({
        id: 'profile',
        title: '补齐个人资料',
        detail: '完善本科院校、专业、目标方向和地区，工作台提醒会更准确。',
        href: '#profile-form'
      });
    }

    rows
      .filter((row) => row.project.deadlineLevel === 'today' && row.item.myStatus !== '已提交')
      .slice(0, 2)
      .forEach(({ item, project }) => {
        tasks.push({
          id: `today-${item.userProjectId}`,
          title: `今天处理 ${project.schoolName}`,
          detail: `${project.projectName} 今天截止，优先检查材料并完成提交。`,
          href: project.sourceSite === '用户手动录入' ? '#manual-entry' : buildNoticeDetailHref(project.id)
        });
      });

    rows
      .filter(
        (row) =>
          (row.project.deadlineLevel === 'within3days' || row.project.deadlineLevel === 'within7days') &&
          row.item.myStatus !== '已提交'
      )
      .slice(0, 3)
      .forEach(({ item, project }) => {
        tasks.push({
          id: `deadline-${item.userProjectId}`,
          title: `本周推进 ${project.schoolName}`,
          detail: `${project.projectName} 即将截止，建议尽快补齐关键材料。`,
          href: project.sourceSite === '用户手动录入' ? '#manual-entry' : buildNoticeDetailHref(project.id)
        });
      });

    rows
      .filter((row) => row.item.materialsProgress < 100)
      .slice(0, 3)
      .forEach(({ item, project }) => {
        tasks.push({
          id: `material-${item.userProjectId}`,
          title: `补齐 ${project.schoolName} 的材料`,
          detail: `当前材料完成度 ${item.materialsProgress}%，还需要继续推进。`,
          href: project.sourceSite === '用户手动录入' ? '#manual-entry' : buildNoticeDetailHref(project.id)
        });
      });

    return tasks.slice(0, 8);
  }, [profileComplete, rows]);

  const todoItems = useMemo(
    () => [
      ...actionTasks.map((task) => ({ id: task.id, text: task.title, detail: task.detail, href: task.href, source: 'system' as const })),
      ...customTodos.map((task) => ({ id: task.id, text: task.text, detail: task.note, source: 'custom' as const }))
    ],
    [actionTasks, customTodos]
  );

  const visibleTodoItems = useMemo(
    () => todoItems.filter((item) => !completedTodoIds.includes(item.id)),
    [todoItems, completedTodoIds]
  );

  const sortedRows = useMemo(
    () => [...rows].sort((left, right) => parseDeadlineTimestamp(left.project.deadlineDate) - parseDeadlineTimestamp(right.project.deadlineDate)),
    [rows]
  );
  const nearestDeadlineRow =
    sortedRows.find((row) => {
      const daysLeft = getDaysLeft(row.project.deadlineDate);
      return daysLeft !== null && daysLeft >= 0;
    }) ?? null;
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
  const urgentRows = sortedRows
    .filter((row) => ['today', 'within3days', 'within7days'].includes(row.project.deadlineLevel))
    .slice(0, 3);
  const todayActionItems = visibleTodoItems.slice(0, 3);
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
      if (contactRangeFilter !== '全部' && contact.schoolRange !== contactRangeFilter) return false;
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

  function handleCompleteTodo(id: string) {
    setCompletedTodoIds((current) => (current.includes(id) ? current : [...current, id]));
  }

  function handleClearCompleted() {
    const customTodoIds = new Set(customTodos.map((item) => item.id));
    setCustomTodos((current) => current.filter((item) => !completedTodoIds.includes(item.id)));
    setCompletedTodoIds((current) => current.filter((id) => !customTodoIds.has(id)));
  }

  function createCustomTodo(payload: Pick<WorkbenchCustomTodo, 'text'> & Partial<Omit<WorkbenchCustomTodo, 'id' | 'text'>>) {
    const nextText = payload.text.trim();
    if (!nextText) {
      return;
    }

    setCustomTodos((current) => [
      ...current,
      {
        id: `custom-${Date.now()}`,
        text: nextText,
        ...(payload.date ? { date: payload.date } : {}),
        ...(payload.type ? { type: payload.type } : {}),
        ...(payload.note ? { note: payload.note } : {}),
        createdAt: new Date().toISOString()
      }
    ]);
  }

  function handleCreateQuickTodo() {
    createCustomTodo({
      text: todoDraft
    });
    setTodoDraft('');
  }

  function handleCreateScheduleTodo(payload: Pick<WorkbenchCustomTodo, 'text'> & Partial<Omit<WorkbenchCustomTodo, 'id' | 'text'>>) {
    createCustomTodo(payload);
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
          description="免费创建申请表，保存目标院校、材料进度、今日待办和截止提醒。通知库、资源库和院校库仍可直接浏览。"
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

  const nearestDeadlineDays = nearestDeadlineRow ? getDaysLeft(nearestDeadlineRow.project.deadlineDate) : null;
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
          description="登录后可以保存目标项目、管理申请状态、记录材料进度，并把临近截止自动变成行动清单。"
        />
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="page-hero overflow-hidden px-6 py-7 lg:px-8">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-brand/8 px-3 py-1.5 text-xs font-semibold text-brand">
              <Sparkles className="h-3.5 w-3.5" />
              申请工作台
            </div>
            <h1 className="mt-4 text-4xl font-semibold text-ink md:text-5xl">把申请推进到下一步</h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
              这里不是简单的项目列表，而是围绕目标、截止、材料和沟通进展搭起来的个人申请控制台。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/notices" className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep">
                <PlusCircle className="h-4 w-4" />
                添加目标项目
              </Link>
              <button
                type="button"
                onClick={() => setActiveSection('schedule')}
                className="inline-flex items-center gap-2 rounded-2xl border border-brand/15 bg-white px-5 py-3 text-sm font-semibold text-brand shadow-sm transition hover:-translate-y-0.5"
              >
                <CalendarDays className="h-4 w-4" />
                管理日程
              </button>
            </div>
          </div>

          <div className="rounded-[30px] bg-white/88 p-4 shadow-soft ring-1 ring-black/5">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: '申请项目', value: stats.total.toString(), hint: '目标总数', icon: ClipboardList },
                { label: '7天内截止', value: stats.upcoming7.toString(), hint: '需要优先处理', icon: Clock3 },
                { label: '待补材料', value: stats.materialPending.toString(), hint: '仍有缺口', icon: BookCheck },
                { label: '保研倒计时', value: baoYanCountdownDays.toString(), hint: '距离 9.22', icon: CalendarDays }
              ].map((item, index) => {
                const Icon = item.icon;
                const strong = index === 3;

                return (
                  <div key={item.label} className={`rounded-[24px] px-4 py-4 ${strong ? 'bg-brand text-white' : 'bg-slate-50 text-ink'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${strong ? 'bg-white/15 text-white' : 'bg-white text-brand shadow-sm'}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className={`text-xs font-semibold ${strong ? 'text-white/75' : 'text-slate-500'}`}>{item.hint}</span>
                    </div>
                    <div className="mt-4 text-sm font-semibold">{item.label}</div>
                    <div className="mt-1 text-3xl font-semibold">
                      {item.value}
                      <span className="ml-1 text-sm font-semibold">{item.label === '保研倒计时' ? '天' : ''}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
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

        <Link
          href={nearestDeadlineRow ? (nearestDeadlineRow.project.sourceSite === '用户手动录入' ? '#manual-entry' : buildNoticeDetailHref(nearestDeadlineRow.project.id)) : '/notices'}
          className="product-card flex items-center justify-between rounded-[30px] px-5 py-4 transition hover:-translate-y-0.5 hover:shadow-soft"
        >
          <span>
            <span className="block text-xs font-semibold text-slate-500">最近截止</span>
            <span className="mt-1 block text-3xl font-semibold text-ink">
              {nearestDeadlineDays === null ? '-' : Math.max(0, nearestDeadlineDays)}
              <span className="ml-1 text-base font-semibold">天</span>
            </span>
            <span className="mt-1 block max-w-[210px] truncate text-xs text-slate-500">
              {nearestDeadlineRow ? getDisplaySchoolName(nearestDeadlineRow.project.schoolName) : '从通知库添加目标项目'}
            </span>
          </span>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand/8 text-brand">
            <ChevronRight className="h-5 w-5" />
          </span>
        </Link>
      </section>

      {activeSection === 'applications' ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main id="application-board" className="grid gap-5">
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
                        : '从通知库加入一个目标项目，或手动录入正在跟进的院校，工作台会立刻开始生成提醒和行动清单。'}
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
          </main>

          <aside className="grid content-start gap-5">
            <section className="surface-card rounded-[30px] p-5">
              <h2 className="text-xl font-semibold text-ink">申请阶段</h2>
              <div className="mt-5 grid gap-4">
                {[
                  ['准备中', pipelineSummary.准备材料中 + pipelineSummary.已收藏],
                  ['已提交', pipelineSummary.已提交],
                  ['待考核', pipelineSummary.待考核],
                  ['已结束', pipelineSummary.已结束]
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-600">{label}</span>
                      <span className="font-semibold text-ink">{value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${stats.total ? Math.round((Number(value) / stats.total) * 100) : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section id="today-actions" className="surface-card rounded-[30px] p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-ink">今日行动</h2>
                <button onClick={handleClearCompleted} className="text-sm font-semibold text-slate-400 hover:text-brand">
                  清理完成
                </button>
              </div>

              <div className="mt-5 grid gap-3">
                {todayActionItems.length ? (
                  todayActionItems.map((task) => (
                    <div key={task.id} className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
                      <button
                        onClick={() => handleCompleteTodo(task.id)}
                        className="mt-0.5 text-slate-300 transition hover:text-brand"
                        aria-label={`完成任务：${task.text}`}
                      >
                        <Square className="h-5 w-5" />
                      </button>
                      <div className="min-w-0 flex-1">
                        {'href' in task && task.href ? (
                          <Link href={task.href} className="line-clamp-1 text-sm font-semibold text-ink hover:text-brand">
                            {task.text}
                          </Link>
                        ) : (
                          <div className="line-clamp-1 text-sm font-semibold text-ink">{task.text}</div>
                        )}
                        {'detail' in task && task.detail ? (
                          <div className="mt-1 line-clamp-1 text-xs text-slate-500">{task.detail}</div>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm leading-7 text-slate-500">
                    当前没有需要立刻处理的任务。加入项目后，这里会自动生成真正的行动清单。
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-[18px] border border-black/5 bg-slate-50 px-3 py-2">
                <input
                  value={todoDraft}
                  onChange={(event) => setTodoDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleCreateQuickTodo();
                    }
                  }}
                  placeholder="添加碎片备注，回车保存..."
                  className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
                <button
                  onClick={handleCreateQuickTodo}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand shadow-sm"
                  aria-label="添加任务"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </section>

            <section className="surface-card rounded-[30px] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-ink">临近截止</h2>
                <Link href="/deadlines" className="text-sm font-semibold text-slate-400 hover:text-brand">
                  更多
                </Link>
              </div>
              <div className="grid gap-3">
                {urgentRows.length ? (
                  urgentRows.map(({ item, project }) => (
                    <Link
                      key={item.userProjectId}
                      href={project.sourceSite === '用户手动录入' ? '#manual-entry' : buildNoticeDetailHref(project.id)}
                      className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm"
                    >
                      <span className="rounded-2xl bg-rose-50 px-2 py-2 text-center text-xs font-semibold text-rose-500">
                        {getDaysLeft(project.deadlineDate) ?? '-'}
                        <br />
                        天
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{getDisplaySchoolName(project.schoolName)}</span>
                        <span className="mt-1 block truncate text-xs text-slate-500">{formatNoticeDateOnly(project.deadlineDate)} 截止 · {item.myStatus}</span>
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
                    暂无 7 天内截止项目。
                  </div>
                )}
              </div>
            </section>

            <section className="surface-card rounded-[30px] p-5">
              <h2 className="text-xl font-semibold text-ink">申请提醒</h2>
              <div className="mt-5 grid gap-3">
                <Link href="/resources" className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand shadow-sm">
                    <FileText className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      检查 {applicationPreview[0]?.project.schoolName || '目标院校'} 的材料准备
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">建议优先补齐简历、个人陈述和证明材料</span>
                  </span>
                </Link>
                <Link href="/notices" className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm">
                    <Search className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">继续补充目标项目</span>
                    <span className="mt-1 block text-xs text-slate-500">可按学校、学院和专业关键词继续筛选</span>
                  </span>
                </Link>
              </div>
            </section>
          </aside>
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
          onCompleteTodo={handleCompleteTodo}
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
  onCompleteTodo,
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
  onCreateTodo: (payload: Pick<WorkbenchCustomTodo, 'text'> & Partial<Omit<WorkbenchCustomTodo, 'id' | 'text'>>) => void;
  onCompleteTodo: (id: string) => void;
  onClearCompleted: () => void;
}) {
  const calendarCells = getCalendarCells(calendarMonth);
  const itemsByDate = items.reduce<Record<string, ScheduleItem[]>>((grouped, item) => {
    if (!item.date) {
      return grouped;
    }

    grouped[item.date] = [...(grouped[item.date] || []), item];
    return grouped;
  }, {});
  const today = getTodayDateString();

  function handleSubmitSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const text = String(formData.get('title') || '').trim();
    if (!text) {
      return;
    }

    onCreateTodo({
      text,
      date: String(formData.get('date') || '').trim(),
      type: getManualScheduleType(String(formData.get('type') || '')),
      note: String(formData.get('note') || '').trim()
    });
    form.reset();
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

        <div className="mt-5 rounded-[28px] bg-slate-50/80 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => onCalendarMonthChange(shiftMonth(calendarMonth, -1))}
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
                onClick={() => onCalendarMonthChange(shiftMonth(calendarMonth, 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition hover:text-brand"
                aria-label="下个月"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => onCalendarMonthChange(getMonthKey())}
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

              return (
                <div
                  key={cell?.date || `blank-${index}`}
                  className={`min-h-[86px] rounded-2xl border p-2 transition ${
                    cell
                      ? isToday
                        ? 'border-brand/25 bg-white shadow-sm'
                        : 'border-white bg-white/75'
                      : 'border-transparent bg-transparent'
                  }`}
                >
                  {cell ? (
                    <>
                      <div className={`text-sm font-semibold ${isToday ? 'text-brand' : 'text-slate-600'}`}>{cell.day}</div>
                      <div className="mt-2 grid gap-1">
                        {dayItems.slice(0, 2).map((item) => (
                          <div key={item.id} className="truncate rounded-full bg-brand/8 px-2 py-1 text-[11px] font-semibold text-brand">
                            {item.title}
                          </div>
                        ))}
                        {dayItems.length > 2 ? (
                          <div className="px-2 text-[11px] font-semibold text-slate-400">+{dayItems.length - 2}</div>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid gap-3 text-sm">
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

        <div className="mt-5 grid gap-3">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => onKeywordChange(event.target.value)}
              placeholder="搜索日程标题或备注"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </label>
        </div>

        <form onSubmit={handleSubmitSchedule} className="mt-3 grid gap-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_180px_150px]">
            <input
              name="title"
              placeholder="日程标题，例如 北大材料提交"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand/30"
            />
            <input
              name="date"
              type="date"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm outline-none transition focus:border-brand/30"
            />
            <select
              name="type"
              defaultValue="其他"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm outline-none transition focus:border-brand/30"
            >
              {manualScheduleTypes.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <input
              name="note"
              placeholder="备注，例如 个人陈述、成绩单、推荐信"
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
      </section>

      <section className="surface-card rounded-[30px] p-5">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ink">日程列表</h2>
            <p className="mt-1 text-sm text-slate-500">当前显示 {items.length} / {totalCount} 个事项。</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
            {scheduleTypeFilters.slice(1, 5).map((item) => (
              <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1">{item}</span>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {items.length ? (
            items.map((item) => {
              const body = (
                <>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      onCompleteTodo(item.id);
                    }}
                    className={`mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                      item.done ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-300 hover:border-brand hover:text-brand'
                    }`}
                    aria-label={`完成日程：${item.title}`}
                  >
                    <Square className="h-3.5 w-3.5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="line-clamp-1 text-base font-semibold text-ink">{item.title}</span>
                      <span className="rounded-full bg-brand/8 px-2.5 py-1 text-xs font-semibold text-brand">{item.type}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{item.detail}</p>
                  </div>
                  <div className="shrink-0 rounded-2xl bg-slate-50 px-4 py-3 text-right">
                    <div className="text-xs font-semibold text-slate-400">时间</div>
                    <div className="mt-1 text-sm font-semibold text-ink">{item.dateLabel}</div>
                  </div>
                </>
              );

              return item.href ? (
                <Link key={item.id} href={item.href} className="grid gap-4 rounded-[24px] bg-white px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft sm:grid-cols-[auto_minmax(0,1fr)_150px] sm:items-start">
                  {body}
                </Link>
              ) : (
                <div key={item.id} className="grid gap-4 rounded-[24px] bg-white px-4 py-4 shadow-sm sm:grid-cols-[auto_minmax(0,1fr)_150px] sm:items-start">
                  {body}
                </div>
              );
            })
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

