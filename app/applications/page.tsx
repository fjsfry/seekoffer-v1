'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Columns3, LayoutList, Smartphone, TriangleAlert } from 'lucide-react';
import { LoginRequiredCard } from '@/components/login-required-card';
import { ManualProjectEntryCard } from '@/components/manual-project-entry-card';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { DeadlineBadge } from '@/components/status-badge';
import { useUserSessionState } from '@/hooks/use-user-session';
import {
  WORKSPACE_SYNC_NOTICE,
  fetchApplicationRows,
  updateUserProject,
  watchApplicationTable,
  type ApplicationRow
} from '@/lib/cloudbase-data';
import {
  materialChecklistDefinitions,
  priorityOptions,
  userStatusOptions,
  type MaterialChecklistKey,
  type UserProjectRecord
} from '@/lib/mock-data';
import { buildNoticeDetailHref } from '@/lib/notice-links';

type ViewMode = 'table' | 'board';
type StatusFilter = '全部状态' | UserProjectRecord['myStatus'];

export default function ApplicationsPage() {
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('全部状态');
  const [isMobile, setIsMobile] = useState(false);
  const { ready, loggedIn } = useUserSessionState();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => undefined;
    }

    const media = window.matchMedia('(max-width: 767px)');

    const applyMode = () => {
      const mobile = media.matches;
      setIsMobile(mobile);
      setViewMode(mobile ? 'board' : 'table');
    };

    applyMode();

    const onChange = () => applyMode();
    media.addEventListener?.('change', onChange);

    return () => media.removeEventListener?.('change', onChange);
  }, []);

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

    load();
    const dispose = watchApplicationTable(load);

    return () => {
      active = false;
      dispose();
    };
  }, [loggedIn]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => (statusFilter === '全部状态' ? true : row.item.myStatus === statusFilter));
  }, [rows, statusFilter]);

  const stats = useMemo(
    () => ({
      favorited: rows.filter((row) => row.item.isFavorited).length,
      submitted: rows.filter((row) => row.item.myStatus === '已提交').length,
      upcoming: rows.filter((row) => row.project.deadlineLevel === 'today' || row.project.deadlineLevel === 'within3days').length,
      todos: rows.filter(
        (row) =>
          row.item.materialsProgress < 100 ||
          (row.project.tags.includes('导师联系') && !row.item.contactSupervisorDone) ||
          row.item.resultStatus === '待确认'
      ).length
    }),
    [rows]
  );

  async function refreshRows() {
    const merged = await fetchApplicationRows();
    setRows(merged);
  }

  async function handleRecordChange(userProjectId: string, patch: Partial<UserProjectRecord>) {
    await updateUserProject(userProjectId, patch);
    await refreshRows();
  }

  async function toggleChecklist(userProjectId: string, field: MaterialChecklistKey, currentValue: boolean) {
    await handleRecordChange(userProjectId, { [field]: !currentValue } as Partial<UserProjectRecord>);
  }

  if (!ready) {
    return (
      <SiteShell>
        <PageSectionTitle
          eyebrow="Application Table"
          title="我的申请表"
          subtitle="告别繁杂的本地表格，统一管理目标院校、材料进度与高危截止日期。"
        />
        <section className="rounded-[30px] border border-black/5 bg-white px-6 py-10 text-sm text-slate-500 shadow-soft">
          正在检查登录状态，请稍等。
        </section>
      </SiteShell>
    );
  }

  if (!loggedIn) {
    return (
      <SiteShell>
        <PageSectionTitle
          eyebrow="Application Table"
          title="我的申请表"
          subtitle="告别繁杂的本地表格，统一管理目标院校、材料进度与高危截止日期。"
        />
        <LoginRequiredCard
          title="登录后即可启用申请管理"
          description="登录后可加入项目、记录材料完成度、设置优先级与提醒，并在待办页自动生成今天最该处理的事项。"
        />
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="Application Table"
        title="我的申请表"
        subtitle="告别繁杂的本地 Excel，云端整理你的目标院校、材料进度、优先级与高危截止日期。"
      />

      <section className="mb-6 rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">同步说明</div>
            <div className="mt-1 leading-7">{WORKSPACE_SYNC_NOTICE}</div>
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-4 xl:grid-cols-4">
        {[
          ['已收藏项目数', stats.favorited.toString(), '已经纳入跟进范围的项目'],
          ['已提交项目数', stats.submitted.toString(), '已经完成材料提交，等待后续反馈'],
          ['本周高风险项目', stats.upcoming.toString(), '今日截止和 3 天内截止项目'],
          ['待完成事项数', stats.todos.toString(), '材料、导师联系与确认事项自动汇总']
        ].map(([label, value, note]) => (
          <div key={label} className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-3 text-3xl font-semibold text-ink">{value}</div>
            <div className="mt-3 text-sm leading-6 text-slate-500">{note}</div>
          </div>
        ))}
      </section>

      <ManualProjectEntryCard onCreated={refreshRows} />

      <section className="mb-8 mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {!isMobile ? (
            <>
              <button
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                  viewMode === 'table' ? 'bg-brand text-white' : 'bg-white text-slate-700 shadow-sm'
                }`}
              >
                <LayoutList className="h-4 w-4" />
                表格视图
              </button>
              <button
                onClick={() => setViewMode('board')}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                  viewMode === 'board' ? 'bg-brand text-white' : 'bg-white text-slate-700 shadow-sm'
                }`}
              >
                <Columns3 className="h-4 w-4" />
                看板视图
              </button>
            </>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
              <Smartphone className="h-4 w-4" />
              手机端默认使用看板视图
            </div>
          )}
        </div>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          className="rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none"
        >
          <option value="全部状态">全部状态</option>
          {userStatusOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </section>

      {!filteredRows.length ? (
        <section className="rounded-[30px] border border-dashed border-black/10 bg-white px-6 py-12 text-center shadow-soft">
          <h3 className="text-xl font-semibold text-ink">你的申请表还是空的</h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
            先去通知库挑选一个目标项目，或者手动录入正在跟进的院校。只要开始记录，截止提醒、材料进度和待办就能自动运转起来。
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/notices"
              className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white"
            >
              立即前往通知库，选择我的第一个目标项目
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#manual-entry"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700"
            >
              先手动录入项目
            </a>
          </div>
        </section>
      ) : !isMobile && viewMode === 'table' ? (
        <section className="overflow-hidden rounded-[30px] border border-black/5 bg-white shadow-soft">
          <div className="overflow-x-auto">
            <div className="grid min-w-[1220px] grid-cols-[1.2fr_0.75fr_0.9fr_1.1fr_0.7fr_1fr_0.95fr] gap-4 border-b border-black/5 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-500">
              <div>项目</div>
              <div>项目类型</div>
              <div>截止时间</div>
              <div>我的状态</div>
              <div>优先级</div>
              <div>材料清单 / 完成度</div>
              <div>备注</div>
            </div>

            <div className="divide-y divide-black/5">
              {filteredRows.map(({ item, project }) => (
                <div
                  key={item.userProjectId}
                  className="grid min-w-[1220px] grid-cols-[1.2fr_0.75fr_0.9fr_1.1fr_0.7fr_1fr_0.95fr] gap-4 px-5 py-5 text-sm"
                >
                  <div>
                    <div className="font-semibold text-ink">{project.schoolName}</div>
                    <div className="mt-1 text-slate-500">{project.departmentName}</div>
                    <div className="mt-2 text-slate-700">{project.projectName}</div>
                    {project.sourceSite === '用户手动录入' ? (
                      <div className="mt-2 text-xs font-semibold text-slate-400">手动录入项目</div>
                    ) : (
                      <Link href={buildNoticeDetailHref(project.id)} className="mt-2 inline-flex text-xs font-semibold text-brand">
                        查看详情
                      </Link>
                    )}
                  </div>

                  <div>
                    <div className="font-semibold text-ink">{project.projectType}</div>
                    <div className="mt-2 text-slate-500">{project.discipline}</div>
                  </div>

                  <div>
                    <div className="font-semibold text-ink">{project.deadlineDate}</div>
                    <div className="mt-2">
                      <DeadlineBadge level={project.deadlineLevel} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <select
                      value={item.myStatus}
                      onChange={(event) =>
                        handleRecordChange(item.userProjectId, {
                          myStatus: event.target.value as UserProjectRecord['myStatus']
                        })
                      }
                      className="w-full rounded-2xl border border-black/5 bg-slate-50 px-3 py-2 outline-none"
                    >
                      {userStatusOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={item.customReminderEnabled}
                        onChange={(event) =>
                          handleRecordChange(item.userProjectId, { customReminderEnabled: event.target.checked })
                        }
                      />
                      开启 7 天 / 3 天 / 当天提醒
                    </label>
                  </div>

                  <div>
                    <select
                      value={item.priorityLevel}
                      onChange={(event) =>
                        handleRecordChange(item.userProjectId, {
                          priorityLevel: event.target.value as UserProjectRecord['priorityLevel']
                        })
                      }
                      className="w-full rounded-2xl border border-black/5 bg-slate-50 px-3 py-2 outline-none"
                    >
                      {priorityOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="font-semibold text-ink">已完成 {item.materialsProgress}%</span>
                        <span className="text-xs text-slate-500">{materialChecklistDefinitions.length} 项检查</span>
                      </div>
                      <div className="grid gap-2">
                        {materialChecklistDefinitions.map((field) => (
                          <button
                            key={field.key}
                            onClick={() => toggleChecklist(item.userProjectId, field.key, item[field.key])}
                            className={`rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                              item[field.key]
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-white text-slate-500 shadow-sm'
                            }`}
                          >
                            {item[field.key] ? '已完成' : '待完成'} · {field.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <textarea
                      rows={5}
                      value={item.myNotes}
                      onChange={(event) => handleRecordChange(item.userProjectId, { myNotes: event.target.value })}
                      className="w-full rounded-2xl border border-black/5 bg-slate-50 px-3 py-3 text-sm outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-3">
          {userStatusOptions.map((status) => (
            <div key={status} className="rounded-[30px] border border-black/5 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-lg font-semibold text-ink">{status}</div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                  {filteredRows.filter((row) => row.item.myStatus === status).length}
                </div>
              </div>
              <div className="grid gap-3">
                {filteredRows
                  .filter((row) => row.item.myStatus === status)
                  .map(({ item, project }) => (
                    <div key={item.userProjectId} className="rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="font-semibold text-ink">{project.schoolName}</div>
                      <div className="mt-1 text-sm text-slate-600">{project.projectName}</div>
                      <div className="mt-2 text-xs text-slate-400">
                        {project.sourceSite === '用户手动录入' ? '手动录入项目' : project.departmentName}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                        <span>材料完成度 {item.materialsProgress}%</span>
                        <DeadlineBadge level={project.deadlineLevel} />
                      </div>
                    </div>
                  ))}

                {!filteredRows.some((row) => row.item.myStatus === status) ? (
                  <div className="rounded-2xl border border-dashed border-black/10 px-4 py-4 text-sm text-slate-500">
                    当前没有项目处于这个状态。
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </section>
      )}
    </SiteShell>
  );
}
