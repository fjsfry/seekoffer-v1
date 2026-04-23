'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUp,
  BookCheck,
  CheckSquare2,
  ClipboardList,
  PencilLine,
  Save,
  Settings2,
  Square,
  UserRound
} from 'lucide-react';
import { LoginRequiredCard } from '@/components/login-required-card';
import { ManualProjectEntryCard } from '@/components/manual-project-entry-card';
import { SiteShell } from '@/components/site-shell';
import { DeadlineBadge } from '@/components/status-badge';
import { useUserSessionState } from '@/hooks/use-user-session';
import {
  fetchApplicationRows,
  saveUserProfileToWorkspace,
  watchApplicationTable,
  type ApplicationRow
} from '@/lib/cloudbase-data';
import { buildNoticeDetailHref } from '@/lib/notice-links';
import {
  hydrateWorkbenchState,
  saveWorkbenchState,
  type WorkbenchCustomTodo
} from '@/lib/workbench-state';
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

const pipelineStages = [
  { key: '已收藏', label: '已收藏' },
  { key: '准备材料中', label: '准备中' },
  { key: '已提交', label: '已提交' },
  { key: '待考核', label: '待结果' },
  { key: '已结束', label: '已结束' }
] as const;

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

  const displayName = form.nickname || '我的';
  const profileComplete = isProfileComplete(form);

  const stats = useMemo(
    () => ({
      total: rows.length,
      submitted: rows.filter((row) => row.item.myStatus === '已提交').length,
      highRisk: rows.filter((row) => row.project.deadlineLevel === 'today' || row.project.deadlineLevel === 'within3days')
        .length,
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

  const applicationPreview = rows.slice(0, 6);
  const layoutClass = profileExpanded
    ? 'grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_320px]'
    : 'grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]';

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
        <section className="surface-card rounded-[34px] px-6 py-10 text-sm text-slate-500">正在加载工作台...</section>
      </SiteShell>
    );
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
      <section className="surface-card rounded-[32px] px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <UserRound className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-ink">{displayName}的工作台</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span>{form.undergraduateSchool || '待完善本科院校'}</span>
                <span className="text-slate-300">|</span>
                <span>{form.major || '待完善本科专业'}</span>
                <span className="text-slate-300">|</span>
                <span>{form.targetMajor || '待完善目标方向'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {profileComplete ? (
              <button
                onClick={() =>
                  setProfileExpandedState({
                    ownerId: profileOwnerId,
                    value: !profileExpanded
                  })
                }
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                <PencilLine className="h-4 w-4" />
                {profileExpanded ? '收起资料' : '编辑资料'}
              </button>
            ) : null}
            <StatPill label="申请项目数" value={stats.total.toString()} />
            <StatPill label="已提交" value={stats.submitted.toString()} />
            <StatPill label="高风险项目" value={stats.highRisk.toString()} />
            <StatPill label="行动清单" value={stats.actionCount.toString()} />
          </div>
        </div>
      </section>

      <section className={layoutClass}>
        {profileExpanded ? (
          <div className="space-y-6">
            <section id="profile-form" className="surface-card rounded-[30px] p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-brand">
                <Settings2 className="h-4 w-4" />
                个人基本信息
              </div>

              <div className="grid gap-3">
                <CompactField label="昵称">
                  <input
                    value={form.nickname}
                    onChange={(event) => handleProfileChange('nickname', event.target.value)}
                    placeholder="例如 张同学"
                    className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
                  />
                </CompactField>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <CompactField label="当前年级">
                    <input
                      value={form.grade}
                      onChange={(event) => handleProfileChange('grade', event.target.value)}
                      placeholder="例如 大四"
                      className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
                    />
                  </CompactField>
                  <CompactField label="年龄">
                    <input
                      value={form.age}
                      onChange={(event) => handleProfileChange('age', event.target.value)}
                      placeholder="例如 21"
                      className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
                    />
                  </CompactField>
                </div>

                <CompactField label="本科院校">
                  <input
                    value={form.undergraduateSchool}
                    onChange={(event) => handleProfileChange('undergraduateSchool', event.target.value)}
                    placeholder="例如 同济大学"
                    className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
                  />
                </CompactField>

                <CompactField label="本科专业">
                  <input
                    value={form.major}
                    onChange={(event) => handleProfileChange('major', event.target.value)}
                    placeholder="例如 计算机科学与技术"
                    className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
                  />
                </CompactField>

                <CompactField label="目标专业方向">
                  <input
                    value={form.targetMajor}
                    onChange={(event) => handleProfileChange('targetMajor', event.target.value)}
                    placeholder="例如 人工智能 / 计算机"
                    className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
                  />
                </CompactField>

                <CompactField label="目标地区">
                  <input
                    value={form.targetRegion}
                    onChange={(event) => handleProfileChange('targetRegion', event.target.value)}
                    placeholder="例如 北京 / 上海 / 杭州"
                    className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
                  />
                </CompactField>
              </div>

              <div className="mt-4 flex flex-col items-start gap-2">
                <button
                  onClick={handleSaveProfile}
                  className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white"
                >
                  <Save className="h-4 w-4" />
                  保存基本信息
                </button>
                {saveMessage ? <div className="text-xs text-slate-500">{saveMessage}</div> : null}
              </div>
            </section>

            <ManualProjectEntryCard compact />
          </div>
        ) : null}

        <div className="space-y-6">
          <section className="surface-card rounded-[32px] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                  <BookCheck className="h-4 w-4" />
                  我的申请表
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  在一张表里统一管理项目状态、材料进度、优先级、备注和提醒。
                </p>
              </div>
              <Link href="/applications" className="text-sm font-semibold text-brand">
                查看完整申请表
              </Link>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-5">
              {pipelineStages.map((stage) => (
                <div key={stage.key} className="rounded-[22px] bg-slate-50 px-4 py-4">
                  <div className="text-sm font-semibold text-ink">{stage.label}</div>
                  <div className="mt-3 text-2xl font-semibold text-brand">{pipelineSummary[stage.key]}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3">
              {applicationPreview.length ? (
                applicationPreview.map(({ item, project }) => (
                  <div key={item.userProjectId} className="rounded-[26px] bg-slate-50 px-5 py-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-semibold text-ink">{project.schoolName}</div>
                          <DeadlineBadge level={project.deadlineLevel} />
                        </div>
                        <div className="mt-2 text-sm leading-7 text-slate-600">{project.projectName}</div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-white px-3 py-1 shadow-sm">状态：{item.myStatus}</span>
                          <span className="rounded-full bg-white px-3 py-1 shadow-sm">材料：{item.materialsProgress}%</span>
                          <span className="rounded-full bg-white px-3 py-1 shadow-sm">优先级：{item.priorityLevel}</span>
                        </div>
                      </div>
                      <Link
                        href={project.sourceSite === '用户手动录入' ? '/applications#manual-entry' : buildNoticeDetailHref(project.id)}
                        className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
                      >
                        查看项目
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[28px] border border-dashed border-black/10 px-5 py-12 text-center">
                  <div className="text-lg font-semibold text-ink">你的申请表还是空的</div>
                  <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
                    从通知库加入一个目标项目，或手动录入正在跟进的院校，工作台会立刻开始为你生成提醒和行动清单。
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    <Link
                      href="/notices"
                      className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white"
                    >
                      立即前往通知库，记录我的第一个目标院校
                    </Link>
                    <Link
                      href="/applications#manual-entry"
                      className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm"
                    >
                      手动新增项目
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </section>

          {!profileExpanded ? <ManualProjectEntryCard compact /> : null}
        </div>

        <section className="surface-card rounded-[32px] p-5">
          <div className="flex items-center justify-between gap-3 border-b border-black/5 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 text-base font-semibold text-ink">
                <ClipboardList className="h-4 w-4 text-brand" />
                行动清单 (To-Do)
              </div>
              <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">My Tasks</div>
            </div>
            <button onClick={handleClearCompleted} className="text-xs font-semibold text-slate-400 transition hover:text-brand">
              清理完成
            </button>
          </div>

          <div className="mt-4 flex min-h-[460px] flex-col">
            <div className="space-y-3">
              {visibleTodoItems.length ? (
                visibleTodoItems.map((task) => (
                  <div key={task.id} className="rounded-[20px] border border-black/5 bg-white px-4 py-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleCompleteTodo(task.id)}
                        className="mt-0.5 text-slate-300 transition hover:text-brand"
                        aria-label={`完成任务：${task.text}`}
                      >
                        {completedTodoIds.includes(task.id) ? (
                          <CheckSquare2 className="h-5 w-5" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        {'href' in task && task.href ? (
                          <Link href={task.href} className="text-sm font-semibold leading-6 text-ink hover:text-brand">
                            {task.text}
                          </Link>
                        ) : (
                          <div className="text-sm font-semibold leading-6 text-ink">{task.text}</div>
                        )}
                        {'detail' in task && task.detail ? (
                          <div className="mt-1 text-xs leading-6 text-slate-500">{task.detail}</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-black/10 px-4 py-10 text-sm text-slate-500">
                  当前没有需要立刻处理的任务。等你从通知库加入项目后，这里会自动生成真正的 To-Do。
                </div>
              )}
            </div>

            <div className="mt-auto pt-4">
              <div className="flex items-center gap-2 rounded-[18px] border border-black/5 bg-slate-50 px-3 py-2">
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
            </div>
          </div>
        </section>
      </section>
    </SiteShell>
  );
}

function CompactField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      {children}
    </label>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full bg-slate-50 px-4 py-3 text-center shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}
