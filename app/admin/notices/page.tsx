'use client';

import Link from 'next/link';
import { Bell, CheckCircle2, Download, ExternalLink, FileSearch, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import {
  AdminButton,
  AdminActionBanner,
  AdminEmptyState,
  AdminFilterSummary,
  AdminInput,
  AdminMetricCard,
  AdminPagination,
  AdminPanel,
  AdminSelect,
  AdminSelectionBar,
  AdminStatusBadge
} from '@/components/admin-ui';
import type { AdminMetric, AdminNoticeRow } from '@/lib/admin-data';
import { getAdminErrorMessage, invokeAdminApi } from '@/lib/admin-api';
import { formatBeijingDateTime } from '@/lib/admin-time';

const noticeIcons = [Bell, CheckCircle2, XCircle, Trash2];

const emptyNoticeMetrics: NoticeMetrics = {
  pending: 0,
  published: 0,
  rejected: 0,
  hidden: 0,
  deleted: 0
};

const defaultFilters = {
  query: '',
  school: '',
  type: '全部类型',
  scope: '当前内容',
  status: '全部状态',
  dateFrom: '',
  dateTo: ''
};

type NoticeFilters = typeof defaultFilters;

export default function AdminNoticesPage() {
  const [rows, setRows] = useState<AdminNoticeRow[]>([]);
  const [metrics, setMetrics] = useState<NoticeMetrics>(emptyNoticeMetrics);
  const [filters, setFilters] = useState<NoticeFilters>(defaultFilters);
  const [sort, setSort] = useState('publish_desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [pending, setPending] = useState('');
  const [message, setMessage] = useState('正在加载通知数据...');
  const [selectedNotice, setSelectedNotice] = useState<AdminNoticeRow | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams(window.location.search).get('query') || '';
      const initialFilters = query.trim() ? { ...defaultFilters, query: query.trim() } : defaultFilters;
      if (query.trim()) {
        setFilters(initialFilters);
      }
      void loadNotices({ page: 1, filters: initialFilters });
    }, 0);

    return () => window.clearTimeout(timer);
    // The notice table loads once on mount; filtering and pagination refresh it explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadNotices(overrides: Partial<{ page: number; pageSize: number; filters: NoticeFilters; sort: string }> = {}) {
    const nextPage = overrides.page ?? page;
    const nextPageSize = overrides.pageSize ?? pageSize;
    const nextFilters = overrides.filters ?? filters;
    const nextSort = overrides.sort ?? sort;

    setPending('load');
    try {
      const data = await invokeAdminApi<{
        notices: NoticeApiRow[];
        total: number;
        page: number;
        pageSize: number;
        metrics: NoticeMetrics;
      }>({
        resource: 'notices',
        action: 'list',
        page: nextPage,
        pageSize: nextPageSize,
        sort: nextSort,
        filters: serializeFilters(nextFilters)
      });

      setRows(data.notices.map(mapNoticeApiRow));
      setTotal(data.total);
      setMetrics(data.metrics || emptyNoticeMetrics);
      setPage(data.page);
      setPageSize(data.pageSize);
      setSort(nextSort);
      setFilters(nextFilters);
      setSelectedIds([]);
      setSelectedNotice((current) => {
        if (!current) return null;
        return data.notices.map(mapNoticeApiRow).find((item) => item.id === current.id) || null;
      });
      setMessage(`已匹配 ${data.total} 条通知，当前第 ${data.page} 页。`);
    } catch (error) {
      setMessage(`通知数据暂时无法更新：${getAdminErrorMessage(error)}`);
    } finally {
      setPending('');
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleAll() {
    const visibleIds = rows.map((item) => item.id);
    setSelectedIds((current) => (visibleIds.every((id) => current.includes(id)) ? [] : visibleIds));
  }

  async function updateNoticeStatus(ids: string[], status: string, note: string) {
    if (!ids.length) {
      setMessage('请先选择需要处理的通知。');
      return;
    }

    const dangerous = status === 'deleted' || status === 'rejected';
    if (dangerous && !window.confirm(`确认要处理 ${ids.length} 条通知吗？该操作会写入后台日志。`)) {
      return;
    }

    setPending(`${status}:${ids.join(',')}`);
    try {
      await invokeAdminApi({
        resource: 'notices',
        action: ids.length > 1 ? 'bulk_update_status' : 'update_status',
        id: ids[0],
        ids,
        status,
        note
      });

      const nextPage = rows.length === ids.length && page > 1 ? page - 1 : page;
      window.localStorage.setItem('seekoffer-admin-notice-version', String(Date.now()));
      setMessage('操作成功：通知展示状态已更新，前台会按最新状态展示。');
      await loadNotices({ page: nextPage });
    } catch (error) {
      setMessage(getAdminErrorMessage(error, '通知操作失败，请稍后重试。'));
    } finally {
      setPending('');
    }
  }

  function applyFilters() {
    void loadNotices({ page: 1, filters });
  }

  function resetFilters() {
    void loadNotices({ page: 1, filters: defaultFilters, sort: 'publish_desc' });
  }

  function updateScope(scope: string) {
    setFilters((current) => ({
      ...current,
      scope,
      status:
        scope === '下架区'
          ? '已下架'
          : scope === '回收站'
            ? '已删除'
            : current.status === '已删除'
              ? '全部状态'
              : current.status
    }));
  }

  function updateStatus(status: string) {
    setFilters((current) => ({
      ...current,
      status,
      scope:
        status === '已下架'
          ? '下架区'
          : status === '已删除'
            ? '回收站'
            : current.scope !== '当前内容'
              ? '当前内容'
              : current.scope
    }));
  }

  const metricCards = buildNoticeMetricCards(metrics);
  const allVisibleSelected = rows.length > 0 && rows.every((item) => selectedIds.includes(item.id));

  function openNoticeDetail(notice: AdminNoticeRow) {
    setSelectedNotice(notice);
    setReviewNote(notice.reviewNote || '');
    setMessage(`已打开《${notice.title}》的审核工作台。`);
  }

  function reviewSelected(status: string, defaultNote: string) {
    if (!selectedNotice) return;
    void updateNoticeStatus([selectedNotice.id], status, reviewNote.trim() || defaultNote);
  }

  function exportCurrentPage() {
    const header = ['标题', '学校', '学院', '类型', '来源链接', '提交人', '提交时间', '状态'];
    const lines = rows.map((notice) =>
      [notice.title, notice.school, notice.department, notice.type, notice.sourceUrl, notice.submitter, notice.submittedAt, notice.status]
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(',')
    );
    const blob = new Blob([`\uFEFF${[header.join(','), ...lines].join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seekoffer-admin-notices-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    setMessage(`已导出当前页 ${rows.length} 条通知。`);
  }

  return (
    <AdminShell title="通知管理" description="审核、发布、下架和删除通知内容；已发布内容才会进入前台首页与通知库。">
      <div className="space-y-6">
        <AdminPanel>
          <div className="grid gap-5 p-5">
            <div
              className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_160px_150px_150px_150px_140px_140px_120px]"
              onKeyDown={(event) => event.key === 'Enter' && applyFilters()}
            >
              <AdminInput
                placeholder="搜索通知标题 / 学校 / 学院"
                value={filters.query}
                onChange={(value) => setFilters((current) => ({ ...current, query: value }))}
              />
              <AdminInput
                placeholder="学校"
                value={filters.school}
                onChange={(value) => setFilters((current) => ({ ...current, school: value }))}
              />
              <AdminSelect
                label=""
                value={filters.type}
                options={['全部类型', '夏令营', '预推免', '九推', '招生通知', '宣讲会', '其他']}
                onChange={(value) => setFilters((current) => ({ ...current, type: value }))}
              />
              <AdminSelect
                label=""
                value={filters.scope}
                options={['当前内容', '下架区', '回收站']}
                onChange={updateScope}
              />
              <AdminSelect
                label=""
                value={filters.status}
                options={['全部状态', '待审核', '已发布', '已驳回', '已下架', '已删除']}
                onChange={updateStatus}
              />
              <AdminInput
                type="date"
                placeholder="开始日期"
                value={filters.dateFrom}
                onChange={(value) => setFilters((current) => ({ ...current, dateFrom: value }))}
              />
              <AdminInput
                type="date"
                placeholder="结束日期"
                value={filters.dateTo}
                onChange={(value) => setFilters((current) => ({ ...current, dateTo: value }))}
              />
              <Link
                href="/admin/notices/new"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                新建通知
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <AdminSelect
                label=""
                value={sort}
                options={[
                  { label: '按发布时间排序', value: 'publish_desc' },
                  { label: '按最近更新排序', value: 'updated_desc' },
                  { label: '按截止时间排序', value: 'deadline_asc' }
                ]}
                onChange={(value) => void loadNotices({ page: 1, sort: value })}
              />
              <div className="flex gap-3">
                <AdminButton onClick={applyFilters} disabled={pending === 'load'}>查询</AdminButton>
                <AdminButton tone="secondary" onClick={resetFilters}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  重置
                </AdminButton>
              </div>
            </div>
            <AdminFilterSummary
              filters={[
                { label: '关键词', value: filters.query },
                { label: '学校', value: filters.school },
                { label: '类型', value: filters.type, mutedValue: '全部类型' },
                { label: '范围', value: filters.scope, mutedValue: '当前内容' },
                { label: '状态', value: filters.status, mutedValue: '全部状态' },
                { label: '开始', value: filters.dateFrom },
                { label: '结束', value: filters.dateTo }
              ]}
              onClear={resetFilters}
            />
            <AdminActionBanner tone={message.includes('失败') || message.includes('无法') ? 'danger' : 'info'}>{message}</AdminActionBanner>
          </div>
        </AdminPanel>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((metric, index) => (
            <AdminMetricCard key={metric.label} metric={metric} icon={noticeIcons[index]} />
          ))}
        </section>

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <AdminPanel
            title="通知列表"
            action={
              <div className="flex flex-wrap gap-2">
                <AdminButton tone="secondary" onClick={exportCurrentPage} disabled={!rows.length}>
                  <Download className="mr-2 h-4 w-4" />
                  导出当前页
                </AdminButton>
                <AdminButton tone="secondary" onClick={() => void loadNotices()} disabled={pending === 'load'}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  刷新列表
                </AdminButton>
              </div>
            }
          >
            <AdminSelectionBar selectedCount={selectedIds.length} totalCount={rows.length} onClear={() => setSelectedIds([])}>
              <AdminButton tone="secondary" disabled={!selectedIds.length || Boolean(pending)} onClick={() => updateNoticeStatus(selectedIds, 'published', '批量发布或重新上架通知')}>
                批量发布/重新上架
              </AdminButton>
              <AdminButton tone="danger" disabled={!selectedIds.length || Boolean(pending)} onClick={() => updateNoticeStatus(selectedIds, 'rejected', '批量驳回通知')}>
                批量驳回
              </AdminButton>
              <AdminButton tone="secondary" disabled={!selectedIds.length || Boolean(pending)} onClick={() => updateNoticeStatus(selectedIds, 'hidden', '批量下架通知')}>
                批量下架
              </AdminButton>
              <AdminButton tone="danger" disabled={!selectedIds.length || Boolean(pending)} onClick={() => updateNoticeStatus(selectedIds, 'deleted', '批量删除通知')}>
                批量删除
              </AdminButton>
            </AdminSelectionBar>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1240px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-5 py-3">
                    <input type="checkbox" aria-label="选择全部通知" checked={allVisibleSelected} onChange={toggleAll} />
                  </th>
                  <th className="px-5 py-3">通知标题</th>
                  <th className="px-5 py-3">学校 / 学院</th>
                  <th className="px-5 py-3">类型</th>
                  <th className="px-5 py-3">来源链接</th>
                  <th className="px-5 py-3">提交人</th>
                  <th className="px-5 py-3">提交时间</th>
                  <th className="px-5 py-3">状态</th>
                  <th className="px-5 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((notice) => (
                  <tr key={notice.id} className="border-t border-slate-100">
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        aria-label={`选择 ${notice.title}`}
                        checked={selectedIds.includes(notice.id)}
                        onChange={() => toggleSelected(notice.id)}
                      />
                    </td>
                    <td className="max-w-[320px] px-5 py-4">
                      <div className="truncate font-medium text-slate-900">{notice.title}</div>
                      <div className="mt-1 text-xs text-slate-500">截止：{notice.deadline}</div>
                    </td>
                    <td className="max-w-[180px] px-5 py-4 text-slate-700">
                      <div className="font-medium">{notice.school}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{notice.department}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">{notice.type}</span>
                    </td>
                    <td className="max-w-[220px] truncate px-5 py-4">
                      <a href={notice.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                        {notice.sourceUrl}
                      </a>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{notice.submitter}</td>
                    <td className="px-5 py-4 text-slate-600">{notice.submittedAt}</td>
                    <td className="px-5 py-4"><AdminStatusBadge status={notice.status} /></td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-3 text-sm font-medium">
                        <button className="text-blue-600 hover:underline" onClick={() => openNoticeDetail(notice)}>查看</button>
                        <button className="text-emerald-600 hover:underline" onClick={() => updateNoticeStatus([notice.id], 'published', notice.status === '已下架' || notice.status === '已删除' ? '重新上架通知' : '审核通过并发布')}>
                          {notice.status === '已下架' || notice.status === '已删除' ? '重新上架' : '发布'}
                        </button>
                        {notice.status !== '已下架' && notice.status !== '已删除' ? (
                          <button className="text-slate-600 hover:underline" onClick={() => updateNoticeStatus([notice.id], 'hidden', '下架通知')}>下架</button>
                        ) : null}
                        {notice.status !== '已删除' ? (
                          <button className="text-rose-600 hover:underline" onClick={() => updateNoticeStatus([notice.id], 'deleted', '删除通知')}>删除</button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>

            {!rows.length ? (
              <AdminEmptyState
                icon={FileSearch}
                title={pending === 'load' ? '正在加载通知' : '没有匹配的通知'}
                description={pending === 'load' ? '系统正在读取最新审核列表，请稍候。' : '可以切换到下架区或回收站查找历史处理记录，也可以重置筛选。'}
                action={
                  pending !== 'load' ? (
                    <AdminButton tone="secondary" onClick={resetFilters}>
                      重置筛选
                    </AdminButton>
                  ) : null
                }
              />
            ) : null}

            <AdminPagination
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={(nextPage) => void loadNotices({ page: nextPage })}
              onPageSizeChange={(nextPageSize) => void loadNotices({ page: 1, pageSize: nextPageSize })}
            />
          </AdminPanel>

          <AdminPanel
            title="通知详情"
            className="2xl:sticky 2xl:top-24 2xl:self-start"
            action={
              selectedNotice ? (
                <button className="text-sm font-semibold text-slate-500 hover:text-slate-900" onClick={() => setSelectedNotice(null)}>
                  关闭
                </button>
              ) : null
            }
          >
            {selectedNotice ? (
              <div className="space-y-5 p-5">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminStatusBadge status={selectedNotice.status} />
                    <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{selectedNotice.type}</span>
                    {selectedNotice.verified ? <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">已核验</span> : null}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold leading-7 text-slate-950">{selectedNotice.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">{selectedNotice.school} · {selectedNotice.department}</p>
                </div>

                <dl className="space-y-3 text-sm">
                  <DetailRow label="提交来源" value={selectedNotice.submitter} />
                  <DetailRow label="发布时间" value={selectedNotice.publishedAt || '-'} />
                  <DetailRow label="截止时间" value={selectedNotice.deadline} />
                  <DetailRow label="最后核验" value={selectedNotice.checkedAt || '-'} />
                  {selectedNotice.reviewedAt ? <DetailRow label="处理时间" value={selectedNotice.reviewedAt} /> : null}
                  {selectedNotice.deletedAt ? <DetailRow label="删除时间" value={selectedNotice.deletedAt} /> : null}
                </dl>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">AI 解析信息</div>
                  <p className="mt-3 line-clamp-5 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                    {selectedNotice.requirements || '暂无正文，建议打开官方原文核验后补充。'}
                  </p>
                </div>

                <div className="grid gap-3">
                  <a
                    href={selectedNotice.sourceUrl || `/notices/${selectedNotice.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    打开官方原文
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <a
                    href={`/notices/${selectedNotice.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    查看前台详情页
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-950">审核备注</div>
                  <textarea
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    className="mt-3 min-h-[140px] w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                    placeholder="记录核验结果、下架原因、驳回原因等，操作会写入日志。"
                  />
                </div>

                <div className="grid gap-3">
                  <AdminButton disabled={Boolean(pending)} onClick={() => reviewSelected('published', selectedNotice.status === '已下架' || selectedNotice.status === '已删除' ? '重新上架并展示' : '审核通过并发布')}>
                    {selectedNotice.status === '已下架' || selectedNotice.status === '已删除' ? '重新上架并展示' : '通过并展示'}
                  </AdminButton>
                  <div className="grid grid-cols-2 gap-3">
                    <AdminButton tone="danger" disabled={Boolean(pending)} onClick={() => reviewSelected('rejected', '内容不符合规范，驳回')}>
                      驳回
                    </AdminButton>
                    {selectedNotice.status !== '已下架' && selectedNotice.status !== '已删除' ? (
                      <AdminButton tone="secondary" disabled={Boolean(pending)} onClick={() => reviewSelected('hidden', '暂时下架，前台不展示')}>
                        下架
                      </AdminButton>
                    ) : (
                      <AdminButton tone="secondary" disabled={Boolean(pending)} onClick={() => reviewSelected('pending', '恢复为待审核')}>
                        转待审核
                      </AdminButton>
                    )}
                  </div>
                  {selectedNotice.status !== '已删除' ? (
                    <AdminButton tone="danger" disabled={Boolean(pending)} onClick={() => reviewSelected('deleted', '逻辑删除，前台不展示')}>
                      删除
                    </AdminButton>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="p-5">
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm leading-7 text-slate-500">
                  从左侧通知列表点击“查看”，这里会展示审核详情、来源入口、审核备注和发布操作。
                </div>
              </div>
            )}
          </AdminPanel>
        </div>
      </div>
    </AdminShell>
  );
}

type NoticeMetrics = {
  pending: number;
  published: number;
  rejected: number;
  hidden: number;
  deleted: number;
};

type NoticeApiRow = {
  id: string;
  school_name: string;
  department_name: string;
  project_name: string;
  project_type: string;
  source_link: string;
  publish_date: string;
  deadline_date: string;
  admin_status?: string;
  is_private?: boolean;
  created_at?: string;
  updated_at_ts?: string;
  apply_link?: string;
  requirements?: string;
  remarks?: string;
  last_checked_at?: string;
  is_verified?: boolean;
  admin_review_note?: string;
  admin_reviewed_by?: string;
  admin_reviewed_at?: string;
  admin_deleted_at?: string;
};

function serializeFilters(filters: NoticeFilters) {
  const scope = noticeScopeToApi(filters.scope);

  return {
    query: filters.query.trim(),
    school: filters.school.trim(),
    type: filters.type === '全部类型' ? 'all' : filters.type,
    scope,
    status: noticeStatusToApi(filters.status, scope),
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo
  };
}

function noticeScopeToApi(scope: string) {
  if (scope === '下架区') return 'hidden';
  if (scope === '回收站') return 'deleted';
  if (scope === '全部含删除') return 'all_with_deleted';
  return 'active';
}

function noticeStatusToApi(status: string, scope = 'active') {
  if (scope === 'hidden') return 'hidden';
  if (scope === 'deleted') return 'deleted';
  if (status === '待审核') return 'pending';
  if (status === '已发布') return 'published';
  if (status === '已驳回') return 'rejected';
  if (status === '已下架') return 'hidden';
  if (status === '已删除') return 'deleted';
  return 'all';
}

function buildNoticeMetricCards(metrics: NoticeMetrics): AdminMetric[] {
  return [
    { label: '待审核', value: String(metrics.pending), hint: '提交后未发布', tone: 'amber' },
    { label: '已发布', value: String(metrics.published), hint: '前台可见', tone: 'green' },
    { label: '已驳回', value: String(metrics.rejected), hint: '不符合规范', tone: 'rose' },
    { label: '已删除', value: String(metrics.deleted), hint: `已下架 ${metrics.hidden} 条`, tone: 'slate' }
  ];
}

function mapNoticeApiRow(row: NoticeApiRow): AdminNoticeRow {
  return {
    id: row.id,
    title: row.project_name || '未命名通知',
    school: row.school_name || '待识别学校',
    department: row.department_name || '待补充学院',
    type: row.project_type || '其他',
    sourceUrl: row.source_link || `/notices/${row.id}`,
    submitter: row.is_private ? '用户提交' : '平台收录',
    submittedAt: formatBeijingDateTime(row.updated_at_ts || row.created_at, row.publish_date || '-'),
    deadline: row.deadline_date || '待确认',
    status: mapNoticeStatus(row.admin_status),
    views: 0,
    saves: 0,
    publishedAt: row.publish_date || '-',
    applyUrl: row.apply_link || '',
    requirements: row.requirements || '',
    remarks: row.remarks || '',
    checkedAt: row.last_checked_at || '-',
    verified: Boolean(row.is_verified),
    reviewNote: row.admin_review_note || '',
    reviewedBy: row.admin_reviewed_by || '',
    reviewedAt: formatBeijingDateTime(row.admin_reviewed_at, ''),
    deletedAt: formatBeijingDateTime(row.admin_deleted_at, '')
  };
}

function mapNoticeStatus(status?: string): AdminNoticeRow['status'] {
  if (status === 'pending') return '待审核';
  if (status === 'rejected') return '已驳回';
  if (status === 'hidden') return '已下架';
  if (status === 'deleted') return '已删除';
  return '已发布';
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-b-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-semibold text-slate-800">{value || '-'}</dd>
    </div>
  );
}
