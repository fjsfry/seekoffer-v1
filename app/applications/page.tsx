'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Columns3,
  FileText,
  FolderPlus,
  LayoutList,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { LoginRequiredCard } from '@/components/login-required-card';
import { ManualProjectEntryCard } from '@/components/manual-project-entry-card';
import { SiteShell } from '@/components/site-shell';
import { DeadlineBadge } from '@/components/status-badge';
import { useUserSessionState } from '@/hooks/use-user-session';
import {
  WORKSPACE_SYNC_NOTICE,
  deleteUserProject,
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
import {
  formatNoticeDateOnly,
  getDisplayDepartmentName,
  getDisplayDiscipline,
  getDisplayProjectType,
  getDisplaySchoolName,
  normalizeNoticeTitle
} from '@/lib/notice-display';
import { buildNoticeDetailHref } from '@/lib/notice-links';
import { resolveNoticeLogoSource } from '@/lib/school-mark-source';

type ViewMode = 'table' | 'board';
type StatusFilter = '全部' | UserProjectRecord['myStatus'];

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

function getStatusTone(status: string) {
  if (status === '已提交' || status === '待考核') return 'bg-blue-50 text-blue-600';
  if (status === '已通过') return 'bg-emerald-50 text-brand';
  if (status === '未通过' || status === '已放弃') return 'bg-slate-100 text-slate-500';
  return 'bg-emerald-50 text-brand';
}

function getProjectHref(row: ApplicationRow) {
  return row.project.sourceSite === '用户手动录入' ? '/applications#manual-entry' : buildNoticeDetailHref(row.project.id);
}

function getProjectDeadlineLabel(deadlineDate: string) {
  const daysLeft = getDaysLeft(deadlineDate);
  if (daysLeft === null) return '时间待补充';
  if (daysLeft < 0) return `已超期 ${Math.abs(daysLeft)} 天`;
  if (daysLeft === 0) return '今天截止';
  return `剩余 ${daysLeft} 天`;
}

function rowMatchesSearch(row: ApplicationRow, keyword: string) {
  const text = [
    row.project.schoolName,
    row.project.departmentName,
    row.project.projectName,
    row.project.projectType,
    row.project.discipline,
    row.item.myStatus,
    row.item.priorityLevel
  ]
    .join(' ')
    .toLowerCase();

  return text.includes(keyword.toLowerCase());
}

export default function ApplicationsPage() {
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('全部');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [openChecklistId, setOpenChecklistId] = useState('');
  const [deletingProjectId, setDeletingProjectId] = useState('');
  const { ready, loggedIn } = useUserSessionState();

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

  const sortedRows = useMemo(
    () => [...rows].sort((left, right) => parseDeadlineTimestamp(left.project.deadlineDate) - parseDeadlineTimestamp(right.project.deadlineDate)),
    [rows]
  );

  const filteredRows = useMemo(() => {
    return sortedRows.filter((row) => {
      const statusMatched = statusFilter === '全部' || row.item.myStatus === statusFilter;
      const keywordMatched = searchKeyword.trim() ? rowMatchesSearch(row, searchKeyword.trim()) : true;
      return statusMatched && keywordMatched;
    });
  }, [searchKeyword, sortedRows, statusFilter]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      submitted: rows.filter((row) => row.item.myStatus === '已提交').length,
      upcoming7: rows.filter((row) =>
        ['today', 'within3days', 'within7days'].includes(row.project.deadlineLevel)
      ).length,
      materialPending: rows.filter((row) => row.item.materialsProgress < 100).length
    }),
    [rows]
  );

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    userStatusOptions.forEach((status) => counts.set(status, 0));
    rows.forEach((row) => counts.set(row.item.myStatus, (counts.get(row.item.myStatus) || 0) + 1));
    return counts;
  }, [rows]);

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

  async function handleDeleteRow(row: ApplicationRow) {
    const schoolName = getDisplaySchoolName(row.project.schoolName);
    const confirmed = window.confirm(`确定要从申请表删除「${schoolName}」吗？这会同步移除该项目的材料进度和备注。`);
    if (!confirmed) {
      return;
    }

    setDeletingProjectId(row.item.userProjectId);
    try {
      await deleteUserProject(row.item.userProjectId);
      await refreshRows();
      if (openChecklistId === row.item.userProjectId) {
        setOpenChecklistId('');
      }
    } finally {
      setDeletingProjectId('');
    }
  }

  if (!ready) {
    return (
      <SiteShell>
        <LoginRequiredCard
          title="登录后即可启用申请表"
          description="申请表会统一保存目标项目、材料进度、状态、备注和截止提醒。"
        />
      </SiteShell>
    );
  }

  if (!loggedIn) {
    return (
      <SiteShell>
        <LoginRequiredCard
          title="登录后管理你的申请表"
          description="你可以先浏览通知库；当准备保存项目、同步申请进度或设置提醒时，再登录创建自己的申请表。"
        />
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="relative overflow-hidden rounded-[36px] border border-brand/10 bg-gradient-to-r from-white via-emerald-50/70 to-white px-6 py-8 shadow-soft lg:px-9 lg:py-10">
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[44%] overflow-hidden lg:block">
          <div className="absolute bottom-[-5rem] right-[-4rem] h-72 w-[36rem] rounded-[50%] bg-brand/8" />
          <div className="absolute bottom-[-4rem] right-20 h-52 w-[30rem] rounded-[50%] border-t border-brand/20" />
          <div className="absolute right-32 top-16 text-7xl text-brand/12">鹿</div>
        </div>
        <div className="relative z-10">
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">我的申请表</h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
            集中管理你的申请项目、材料与截止时间，高效推进每一步。
          </p>
        </div>
      </section>

      <section className="rounded-[28px] border border-brand/15 bg-emerald-50/60 px-5 py-4 text-sm text-brand shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">同步说明</div>
              <div className="mt-1 leading-7 text-brand/80">{WORKSPACE_SYNC_NOTICE}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={refreshRows}
            className="inline-flex w-fit items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-brand shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
            立即同步
          </button>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <ApplicationStatCard label="已收藏项目" value={stats.total} hint="全部项目总数" icon={FolderPlus} tone="green" />
        <ApplicationStatCard label="已提交项目" value={stats.submitted} hint="已递交申请的项目数" icon={CheckCircle2} tone="blue" />
        <ApplicationStatCard label="7天内截止" value={stats.upcoming7} hint="即将截止的项目" icon={CalendarDays} tone="orange" />
        <ApplicationStatCard label="待补材料" value={stats.materialPending} hint="需要补齐的材料项" icon={BellRing} tone="violet" />
      </section>

      <ManualProjectEntryCard onCreated={refreshRows} />

      <section className="overflow-hidden rounded-[30px] border border-black/5 bg-white shadow-soft">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <label className="relative min-w-[240px] flex-1 lg:max-w-[320px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                placeholder="搜索学校或项目关键词"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-brand/40"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter('全部')}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  statusFilter === '全部' ? 'bg-brand text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                全部 <span className="ml-1">{rows.length}</span>
              </button>
              {userStatusOptions.slice(1, 5).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    statusFilter === status ? 'bg-brand text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {status} <span className="ml-1">{statusCounts.get(status) || 0}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600"
            >
              排序：截止时间
              <ChevronDown className="h-4 w-4" />
            </button>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 outline-none"
            >
              <option value="全部">状态：全部</option>
              {userStatusOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <div className="inline-flex rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                  viewMode === 'table' ? 'bg-white text-brand shadow-sm' : 'text-slate-500'
                }`}
              >
                <LayoutList className="h-4 w-4" />
                表格视图
              </button>
              <button
                type="button"
                onClick={() => setViewMode('board')}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                  viewMode === 'board' ? 'bg-white text-brand shadow-sm' : 'text-slate-500'
                }`}
              >
                <Columns3 className="h-4 w-4" />
                看板视图
              </button>
            </div>
          </div>
        </div>

        {!filteredRows.length ? (
          <EmptyApplicationsState />
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <div className="min-w-[1180px]">
              <div className="grid grid-cols-[1.25fr_0.75fr_0.85fr_0.7fr_0.65fr_0.85fr_0.95fr] gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-4 text-sm font-semibold text-slate-500">
                <div>学校 / 项目</div>
                <div>项目类型</div>
                <div>截止时间</div>
                <div>状态</div>
                <div>优先级</div>
                <div>材料进度</div>
                <div>操作</div>
              </div>
              <div className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <ApplicationTableRow
                    key={row.item.userProjectId}
                    row={row}
                    openChecklistId={openChecklistId}
                    setOpenChecklistId={setOpenChecklistId}
                    isDeleting={deletingProjectId === row.item.userProjectId}
                    onChange={handleRecordChange}
                    onToggleChecklist={toggleChecklist}
                    onDelete={handleDeleteRow}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
                <span>共 {filteredRows.length} 条记录</span>
                <div className="flex items-center gap-2">
                  <button className="rounded-xl border border-slate-200 px-3 py-2 text-slate-400" type="button">‹</button>
                  <button className="rounded-xl bg-brand px-3 py-2 font-semibold text-white" type="button">1</button>
                  <button className="rounded-xl border border-slate-200 px-3 py-2 text-slate-400" type="button">›</button>
                  <span className="ml-3 rounded-xl border border-slate-200 px-3 py-2">10 条/页</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 p-5 lg:grid-cols-3">
            {userStatusOptions.map((status) => (
              <div key={status} className="rounded-[26px] border border-slate-100 bg-slate-50/70 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="text-lg font-semibold text-ink">{status}</div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
                    {filteredRows.filter((row) => row.item.myStatus === status).length}
                  </div>
                </div>
                <div className="grid gap-3">
                  {filteredRows
                    .filter((row) => row.item.myStatus === status)
                    .map((row) => (
                      <ApplicationBoardCard
                        key={row.item.userProjectId}
                        row={row}
                        isDeleting={deletingProjectId === row.item.userProjectId}
                        onDelete={handleDeleteRow}
                      />
                    ))}

                  {!filteredRows.some((row) => row.item.myStatus === status) ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                      当前没有项目处于这个状态。
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </SiteShell>
  );
}

function ApplicationStatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone
}: {
  label: string;
  value: number;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  tone: 'green' | 'blue' | 'orange' | 'violet';
}) {
  const toneClass = {
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    violet: 'bg-violet-50 text-violet-600'
  }[tone];

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

function ApplicationTableRow({
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
  const { item, project } = row;
  const checklistOpen = openChecklistId === item.userProjectId;
  const completed = getMaterialCompletedCount(item.materialsProgress);
  const missing = materialChecklistDefinitions.length - completed;

  return (
    <div>
      <div className="grid grid-cols-[1.25fr_0.75fr_0.85fr_0.7fr_0.65fr_0.85fr_0.95fr] gap-4 px-5 py-5 text-sm">
        <div className="flex min-w-0 items-center gap-4">
          <ExternalSiteMark source={resolveNoticeLogoSource(project)} label={getDisplaySchoolName(project.schoolName)} size="lg" rounded="full" />
          <div className="min-w-0">
            <div className="text-lg font-semibold text-ink">{getDisplaySchoolName(project.schoolName)}</div>
            <div className="mt-1 truncate text-slate-500">{getDisplayDepartmentName(project.departmentName)}</div>
            <div className="mt-1 line-clamp-1 font-semibold text-slate-700">{normalizeNoticeTitle(project.projectName, 54)}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-2.5 py-1">{getDisplayDiscipline(project.discipline)}</span>
              {project.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1">{tag}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center">
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-brand">
            {getDisplayProjectType(project.projectType)}
          </span>
        </div>

        <div className="flex flex-col justify-center gap-2">
          <div className={project.deadlineLevel === 'expired' || project.deadlineLevel === 'today' ? 'font-semibold text-rose-500' : 'font-semibold text-ink'}>
            {formatNoticeDateOnly(project.deadlineDate)}
          </div>
          <span className="w-fit rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-500">
            {getProjectDeadlineLabel(project.deadlineDate)}
          </span>
        </div>

        <div className="flex items-center">
          <select
            value={item.myStatus}
            onChange={(event) =>
              onChange(item.userProjectId, {
                myStatus: event.target.value as UserProjectRecord['myStatus']
              })
            }
            className={`w-full rounded-xl border border-transparent px-3 py-2 text-xs font-semibold outline-none ${getStatusTone(item.myStatus)}`}
          >
            {userStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center">
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

        <div className="flex flex-col justify-center">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-ink">{completed} / {materialChecklistDefinitions.length}</span>
            <span className={missing ? 'text-orange-500' : 'text-brand'}>{missing ? `待补 ${missing} 项` : '已完成'}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand" style={{ width: `${item.materialsProgress}%` }} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Link href={getProjectHref(row)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-brand" title="查看通知">
            <FileText className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => setOpenChecklistId(checklistOpen ? '' : item.userProjectId)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-brand"
            title="材料清单"
          >
            <ShieldCheck className="h-4 w-4" />
          </button>
          <RowActionsMenu row={row} isDeleting={isDeleting} onDelete={onDelete} />
        </div>
      </div>

      {checklistOpen ? (
        <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4">
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
              value={item.myNotes}
              onChange={(event) => onChange(item.userProjectId, { myNotes: event.target.value })}
              placeholder="记录导师反馈、材料缺口或提交备注..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ApplicationBoardCard({
  row,
  isDeleting,
  onDelete
}: {
  row: ApplicationRow;
  isDeleting: boolean;
  onDelete: (row: ApplicationRow) => void;
}) {
  const completed = getMaterialCompletedCount(row.item.materialsProgress);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <ExternalSiteMark source={resolveNoticeLogoSource(row.project)} label={getDisplaySchoolName(row.project.schoolName)} size="md" rounded="full" />
          <div className="min-w-0">
            <div className="font-semibold text-ink">{getDisplaySchoolName(row.project.schoolName)}</div>
            <div className="mt-1 line-clamp-2 text-sm text-slate-500">{normalizeNoticeTitle(row.project.projectName, 48)}</div>
          </div>
        </div>
        <RowActionsMenu row={row} isDeleting={isDeleting} onDelete={onDelete} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs">
        <DeadlineBadge level={row.project.deadlineLevel} />
        <span className="font-semibold text-slate-500">{completed} / {materialChecklistDefinitions.length} 材料</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand" style={{ width: `${row.item.materialsProgress}%` }} />
      </div>
    </div>
  );
}

function RowActionsMenu({
  row,
  isDeleting,
  onDelete
}: {
  row: ApplicationRow;
  isDeleting: boolean;
  onDelete: (row: ApplicationRow) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-brand"
        aria-label="更多操作"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-20 w-44 rounded-2xl border border-black/5 bg-white p-2 shadow-float">
          <Link
            href={getProjectHref(row)}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-brand"
          >
            <ArrowRight className="h-4 w-4" />
            查看详情
          </Link>
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => {
              setOpen(false);
              onDelete(row);
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? '删除中...' : '删除申请'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function EmptyApplicationsState() {
  return (
    <section className="px-6 py-14 text-center">
      <h3 className="text-xl font-semibold text-ink">你的申请表还是空的</h3>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
        先去通知库挑选一个目标项目，或者手动录入正在跟进的院校。只要开始记录，截止提醒、材料进度和待办就能自动运转起来。
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link href="/notices" className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white">
          去通知库添加
          <ArrowRight className="h-4 w-4" />
        </Link>
        <a href="#manual-entry" className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
          先手动录入项目
        </a>
      </div>
    </section>
  );
}
