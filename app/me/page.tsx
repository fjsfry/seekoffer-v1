'use client';

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowUp,
  BellRing,
  BookCheck,
  CalendarDays,
  ChevronRight,
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
  Sparkles,
  Square,
  Trash2
} from 'lucide-react';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { LoginRequiredCard } from '@/components/login-required-card';
import { ManualProjectEntryCard } from '@/components/manual-project-entry-card';
import { RecommendationCountdownCard } from '@/components/recommendation-countdown-card';
import { SiteShell } from '@/components/site-shell';
import { useUserSessionState } from '@/hooks/use-user-session';
import {
  deleteUserProject,
  fetchApplicationRows,
  saveUserProfileToWorkspace,
  watchApplicationTable,
  type ApplicationRow
} from '@/lib/cloudbase-data';
import {
  formatNoticeDateOnly,
  getDisplayDepartmentName,
  getDisplayDiscipline,
  getDisplaySchoolName,
  normalizeNoticeTitle
} from '@/lib/notice-display';
import { buildNoticeDetailHref } from '@/lib/notice-links';
import {
  hydrateWorkbenchState,
  saveWorkbenchState,
  type WorkbenchCustomTodo
} from '@/lib/workbench-state';
import { materialChecklistDefinitions } from '@/lib/mock-data';
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

type ActionTask = {
  id: string;
  title: string;
  detail: string;
  href?: string;
};

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
      ? parsed.filter((item): item is WorkbenchCustomTodo => Boolean(item?.id) && Boolean(item?.text))
      : [];
  } catch {
    return [] as WorkbenchCustomTodo[];
  }
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
          href: project.sourceSite === '用户手动录入' ? '/applications#manual-entry' : buildNoticeDetailHref(project.id)
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
          href: project.sourceSite === '用户手动录入' ? '/applications#manual-entry' : buildNoticeDetailHref(project.id)
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
          href: project.sourceSite === '用户手动录入' ? '/applications#manual-entry' : buildNoticeDetailHref(project.id)
        });
      });

    return tasks.slice(0, 8);
  }, [profileComplete, rows]);

  const todoItems = useMemo(
    () => [
      ...actionTasks.map((task) => ({ id: task.id, text: task.title, detail: task.detail, href: task.href, source: 'system' as const })),
      ...customTodos.map((task) => ({ id: task.id, text: task.text, source: 'custom' as const }))
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
  const applicationPreview = sortedRows.slice(0, 3);
  const urgentRows = sortedRows
    .filter((row) => ['today', 'within3days', 'within7days'].includes(row.project.deadlineLevel))
    .slice(0, 3);
  const todayActionItems = visibleTodoItems.slice(0, 3);

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

  function handleCreateCustomTodo() {
    const nextText = todoDraft.trim();
    if (!nextText) {
      return;
    }

    setCustomTodos((current) => [
      ...current,
      {
        id: `custom-${Date.now()}`,
        text: nextText
      }
    ]);
    setTodoDraft('');
  }

  if (!ready) {
    return (
      <SiteShell>
        <LoginRequiredCard
          title="登录后开启你的申请工作台"
          description="登录后可以保存目标院校、管理申请状态、记录材料进度和维护行动清单。通知库、资源库和院校库仍可直接浏览。"
        />
      </SiteShell>
    );
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
      const merged = await fetchApplicationRows();
      setRows(merged);
    } finally {
      setDeletingProjectId('');
    }
  }

  if (!loggedIn) {
    return (
      <SiteShell>
        <LoginRequiredCard
          title="登录后开启你的工作台"
          description="通知库、资源库和院校库可以直接浏览；申请表、行动清单和收藏功能需要先完成正式账号登录。"
        />
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="relative overflow-hidden rounded-[36px] border border-brand/10 bg-gradient-to-r from-white via-emerald-50/80 to-white px-6 py-8 shadow-soft lg:px-9 lg:py-10">
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[52%] overflow-hidden lg:block">
          <div className="absolute bottom-[-5rem] right-[-3rem] h-72 w-[38rem] rounded-[50%] bg-brand/8" />
          <div className="absolute bottom-[-4rem] right-16 h-52 w-[32rem] rounded-[50%] border-t border-brand/20" />
          <div className="absolute right-28 top-16 text-7xl text-brand/12">鹿</div>
        </div>

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand/8 px-3 py-1 text-xs font-semibold text-brand">
            <BriefcaseIcon />
            申请作战台
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-ink md:text-5xl">
            我的申请作战台 ✦
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
            集中管理你的目标项目、材料与截止时间，高效推进每一步。
          </p>

          <div className="mt-7 flex flex-wrap gap-4">
            <Link
              href="/notices"
              className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-float transition hover:-translate-y-0.5 hover:bg-brand-deep"
            >
              <PlusCircle className="h-4 w-4" />
              从通知库添加项目
            </Link>
            <Link
              href="/ai"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-sm transition hover:border-brand/30 hover:text-brand"
            >
              <Sparkles className="h-4 w-4" />
              AI 帮我定位
            </Link>
            <Link
              href="/deadlines"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-sm transition hover:border-brand/30 hover:text-brand"
            >
              <CalendarDays className="h-4 w-4" />
              查看截止日历
            </Link>
          </div>

          <Link href="#today-actions" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-brand">
            <Clock3 className="h-4 w-4" />
            今天建议优先处理 {Math.min(actionTasks.length, 2)} 个项目
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <RecommendationCountdownCard />

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: '申请中', value: stats.total.toString(), hint: '正在推进的项目', icon: ClipboardList, tone: 'brand' },
          { label: '待补材料', value: stats.materialPending.toString(), hint: '材料待补充/完善', icon: BookCheck, tone: 'orange' },
          { label: '7天内截止', value: stats.upcoming7.toString(), hint: '及时关注，避免错过', icon: Clock3, tone: 'blue' },
          { label: '待结果', value: stats.pendingResults.toString(), hint: '已提交，等待结果', icon: BellRing, tone: 'green' }
        ].map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="surface-card rounded-[34px] p-6">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-ink">我的申请进度</h2>
              <div className="mt-4 flex flex-wrap gap-5 text-sm text-slate-500">
                {[
                  ['全部', rows.length],
                  ['准备中', pipelineSummary.准备材料中 + pipelineSummary.已收藏],
                  ['已提交', pipelineSummary.已提交],
                  ['待结果', pipelineSummary.待考核]
                ].map(([label, count], index) => (
                  <span key={label} className={index === 0 ? 'font-semibold text-brand' : ''}>
                    {label}
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{count}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm">
                按截止时间
                <ChevronRight className="h-4 w-4 rotate-90" />
              </button>
              <Link
                href="/applications"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-brand shadow-sm"
              >
                全部项目
                <ListChecks className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {applicationPreview.length ? (
              applicationPreview.map((row) => (
                <ApplicationProgressCard
                  key={row.item.userProjectId}
                  row={row}
                  isDeleting={deletingProjectId === row.item.userProjectId}
                  onDelete={handleDeleteApplication}
                />
              ))
            ) : (
              <div className="rounded-[28px] border border-dashed border-black/10 px-5 py-12 text-center">
                <div className="text-lg font-semibold text-ink">你的申请表还是空的</div>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
                  从通知库加入一个目标项目，或手动录入正在跟进的院校，工作台会立刻开始为你生成提醒和行动清单。
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <Link href="/notices" className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white">
                    去通知库添加
                  </Link>
                  <Link href="/applications#manual-entry" className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                    手动新增项目
                  </Link>
                </div>
              </div>
            )}
          </div>

          {applicationPreview.length ? (
            <div className="mt-5 text-center">
              <Link href="/applications" className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                查看全部项目
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          ) : null}
        </section>

        <aside className="grid content-start gap-5">
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
                    handleCreateCustomTodo();
                  }
                }}
                placeholder="添加碎片备注，回车保存..."
                className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
              <button
                onClick={handleCreateCustomTodo}
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
                    href={project.sourceSite === '用户手动录入' ? '/applications#manual-entry' : buildNoticeDetailHref(project.id)}
                    className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm"
                  >
                    <span className="rounded-2xl bg-rose-50 px-2 py-2 text-center text-xs font-semibold text-rose-500">
                      {getDaysLeft(project.deadlineDate) ?? '-'}
                      <br />
                      天
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{getDisplaySchoolName(project.schoolName)}</span>
                      <span className="mt-1 block truncate text-xs text-slate-500">{formatNoticeDateOnly(project.deadlineDate)} 截止</span>
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getWorkbenchStatusTone(item.myStatus)}`}>
                      {item.myStatus}
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
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-ink">AI 提醒</h2>
              <Link href="/ai" className="text-sm font-semibold text-slate-400 hover:text-brand">
                更多
              </Link>
            </div>
            <div className="grid gap-3">
              <Link href="/ai" className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">
                    你的背景与 {applicationPreview[0]?.project.schoolName || '目标院校'} 匹配度较高
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">建议优先补充科研经历与竞赛奖项材料</span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </Link>
              <Link href="/notices" className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm">
                  <Search className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">发现 {Math.max(3, stats.materialPending)} 个与你背景高度匹配的新增项目</span>
                  <span className="mt-1 block text-xs text-slate-500">来自 985 高校 AI 方向</span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </Link>
            </div>
          </section>
        </aside>
      </section>

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

      <ManualProjectEntryCard compact />
    </SiteShell>
  );
}

function BriefcaseIcon() {
  return <ClipboardList className="h-4 w-4" />;
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone
}: {
  label: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
}) {
  const toneClass =
    tone === 'orange'
      ? 'bg-orange-50 text-orange-600'
      : tone === 'blue'
        ? 'bg-blue-50 text-blue-600'
        : tone === 'green'
          ? 'bg-emerald-50 text-emerald-600'
          : 'bg-brand/8 text-brand';

  return (
    <div className="product-card rounded-[24px] p-6">
      <div className="flex items-center gap-5">
        <span className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl ${toneClass}`}>
          <Icon className="h-7 w-7" />
        </span>
        <div>
          <div className="text-sm font-semibold text-slate-600">{label}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-ink">{value}</div>
          <div className="mt-2 text-sm text-slate-500">{hint}</div>
        </div>
      </div>
    </div>
  );
}

function ApplicationProgressCard({
  row,
  isDeleting,
  onDelete
}: {
  row: ApplicationRow;
  isDeleting: boolean;
  onDelete: (row: ApplicationRow) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { item, project } = row;
  const completed = getMaterialCompletedCount(item.materialsProgress);
  const total = materialChecklistDefinitions.length;
  const daysLeft = getDaysLeft(project.deadlineDate);
  const href = project.sourceSite === '用户手动录入' ? '/applications#manual-entry' : buildNoticeDetailHref(project.id);

  return (
    <article className="rounded-[26px] border border-slate-100 bg-white px-5 py-5 shadow-sm">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_130px_150px_96px_96px] lg:items-center">
        <div className="flex min-w-0 items-start gap-4">
          <ExternalSiteMark source={resolveNoticeLogoSource(project)} label={getDisplaySchoolName(project.schoolName)} size="lg" rounded="full" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-semibold text-ink">{getDisplaySchoolName(project.schoolName)}</h3>
              <span className="text-sm font-semibold text-slate-500">· {getDisplayDepartmentName(project.departmentName)}</span>
            </div>
            <p className="mt-2 line-clamp-1 text-sm text-slate-600">{normalizeNoticeTitle(project.projectName, 62)}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
              <span className="rounded-full bg-slate-100 px-2.5 py-1">{getDisplayDiscipline(project.discipline)}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">{getDisplaySchoolName(project.schoolName).includes('大学') ? '高校项目' : '目标项目'}</span>
            </div>
          </div>
        </div>

        <div className="text-sm">
          <div className="text-xs font-semibold text-slate-400">截止时间</div>
          <div className={project.deadlineLevel === 'expired' || project.deadlineLevel === 'today' ? 'mt-2 font-semibold text-rose-500' : 'mt-2 font-semibold text-brand'}>
            {formatNoticeDateOnly(project.deadlineDate)}
          </div>
          <div className="mt-1 text-xs text-slate-500">{daysLeft === null ? '待补充' : daysLeft < 0 ? `超期 ${Math.abs(daysLeft)} 天` : `剩余 ${daysLeft} 天`}</div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-400">材料进度</span>
            <span className="font-semibold text-ink">{completed} / {total}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand" style={{ width: `${item.materialsProgress}%` }} />
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold text-slate-400">优先级</div>
          <span className={`rounded-xl px-3 py-2 text-xs font-semibold ${getPriorityTone(item.priorityLevel)}`}>
            {item.priorityLevel}
          </span>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold text-slate-400">状态</div>
          <span className={`rounded-xl px-3 py-2 text-xs font-semibold ${getWorkbenchStatusTone(item.myStatus)}`}>
            {item.myStatus}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-4 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500">
        <Link href={href} className="inline-flex items-center gap-1 hover:text-brand">
          <ExternalLink className="h-3.5 w-3.5" />
          查看通知
        </Link>
        <Link href="/applications" className="inline-flex items-center gap-1 hover:text-brand">
          <Clock3 className="h-3.5 w-3.5" />
          更新状态
        </Link>
        <Link href="/applications" className="inline-flex items-center gap-1 hover:text-brand">
          <ListChecks className="h-3.5 w-3.5" />
          材料清单
        </Link>
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
    </article>
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

