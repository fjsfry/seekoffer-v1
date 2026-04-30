'use client';

import Link from 'next/link';
import { Bell, CheckCircle2, ExternalLink, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import {
  AdminButton,
  AdminInput,
  AdminMetricCard,
  AdminPagination,
  AdminPanel,
  AdminSelect,
  AdminStatusBadge
} from '@/components/admin-ui';
import type { AdminMetric, AdminNoticeRow } from '@/lib/admin-data';
import { invokeAdminApi } from '@/lib/admin-api';

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
  const [message, setMessage] = useState('正在连接后台真实数据...');
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
      setMessage(`已连接 Supabase，共匹配 ${data.total} 条通知，当前第 ${data.page} 页。`);
    } catch (error) {
      setMessage(error instanceof Error ? `真实 API 暂不可用：${error.message}` : '真实 API 暂不可用，请稍后重试。');
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
      setMessage('操作成功：状态已写入 Supabase。线上前台会通过实时公开接口隐藏/展示，下一次构建也会同步静态兜底数据。');
      await loadNotices({ page: nextPage });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '通知操作失败，请稍后重试。');
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

  return (
    <AdminShell title="通知管理" description="审核、发布、下架和删除通知内容；已发布内容才会进入前台首页与通知库。">
      <div className="space-y-6">
        <AdminPanel>
          <div className="grid gap-5 p-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px_180px_180px_160px_160px_120px]">
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
                value={filters.status}
                options={['全部状态', '待审核', '已发布', '已驳回', '已下架', '已删除']}
                onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
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
            <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div>
          </div>
        </AdminPanel>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((metric, index) => (
            <AdminMetricCard key={metric.label} metric={metric} icon={noticeIcons[index]} />
          ))}
        </section>

        <AdminPanel
          title="通知列表"
          action={
            <AdminButton tone="secondary" onClick={() => void loadNotices()} disabled={pending === 'load'}>
              <RotateCcw className="mr-2 h-4 w-4" />
              刷新列表
            </AdminButton>
          }
        >
          <div className="flex flex-wrap gap-3 px-5 py-4">
            <AdminButton tone="secondary" disabled={!selectedIds.length || Boolean(pending)} onClick={() => updateNoticeStatus(selectedIds, 'published', '批量通过通知')}>
              批量通过
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
          </div>

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
                        <button className="text-emerald-600 hover:underline" onClick={() => updateNoticeStatus([notice.id], 'published', '后台审核通过并发布')}>发布</button>
                        <button className="text-slate-600 hover:underline" onClick={() => updateNoticeStatus([notice.id], 'hidden', '后台下架通知')}>下架</button>
                        <button className="text-rose-600 hover:underline" onClick={() => updateNoticeStatus([notice.id], 'deleted', '后台删除通知')}>删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!rows.length ? (
            <div className="border-t border-slate-100 px-5 py-12 text-center text-sm text-slate-500">
              当前筛选条件下没有通知。可以重置筛选，或新建一条待审核通知。
            </div>
          ) : null}

          <AdminPagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={(nextPage) => void loadNotices({ page: nextPage })}
            onPageSizeChange={(nextPageSize) => void loadNotices({ page: 1, pageSize: nextPageSize })}
          />
        </AdminPanel>

        {selectedNotice ? (
          <AdminPanel
            title="通知审核工作台"
            action={
              <button className="text-sm font-semibold text-slate-500 hover:text-slate-900" onClick={() => setSelectedNotice(null)}>
                关闭
              </button>
            }
          >
            <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminStatusBadge status={selectedNotice.status} />
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{selectedNotice.type}</span>
                    {selectedNotice.verified ? <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">已核验</span> : null}
                  </div>
                  <h3 className="mt-3 text-xl font-semibold leading-8 text-slate-950">{selectedNotice.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">{selectedNotice.school} · {selectedNotice.department}</p>
                </div>
                <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-2">
                  <span>发布时间：{selectedNotice.publishedAt}</span>
                  <span>截止时间：{selectedNotice.deadline}</span>
                  <span>最后核验：{selectedNotice.checkedAt}</span>
                  <span>提交来源：{selectedNotice.submitter}</span>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">通知正文 / 材料要求</div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{selectedNotice.requirements || '暂无正文，建议打开官方原文核验后补充。'}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={selectedNotice.sourceUrl || `/notices/${selectedNotice.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    官方原文
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <a
                    href={`/notices/${selectedNotice.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    前台详情页
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-950">审核备注</div>
                <textarea
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  className="mt-3 min-h-[150px] w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  placeholder="记录核验结果、下架原因、驳回原因等，操作会写入日志。"
                />
                <div className="mt-4 grid gap-3">
                  <AdminButton disabled={Boolean(pending)} onClick={() => reviewSelected('published', '审核通过并发布')}>
                    通过并同步前台
                  </AdminButton>
                  <AdminButton tone="danger" disabled={Boolean(pending)} onClick={() => reviewSelected('rejected', '内容不符合规范，驳回')}>
                    驳回
                  </AdminButton>
                  <AdminButton tone="secondary" disabled={Boolean(pending)} onClick={() => reviewSelected('hidden', '暂时下架，前台不展示')}>
                    下架
                  </AdminButton>
                  <AdminButton tone="danger" disabled={Boolean(pending)} onClick={() => reviewSelected('deleted', '逻辑删除，前台不展示')}>
                    删除
                  </AdminButton>
                </div>
                <div className="mt-4 rounded-lg bg-blue-50 p-3 text-xs leading-6 text-blue-700">
                  发布会设置为公开可见；驳回、下架、删除会从前台首页和通知库隐藏。所有动作会记录管理员、时间和备注。
                </div>
              </div>
            </div>
          </AdminPanel>
        ) : null}
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
};

function serializeFilters(filters: NoticeFilters) {
  return {
    query: filters.query.trim(),
    school: filters.school.trim(),
    type: filters.type === '全部类型' ? 'all' : filters.type,
    status: noticeStatusToApi(filters.status),
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo
  };
}

function noticeStatusToApi(status: string) {
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
    submitter: row.is_private ? '用户提交' : '系统同步',
    submittedAt: row.updated_at_ts?.slice(0, 16).replace('T', ' ') || row.created_at?.slice(0, 16).replace('T', ' ') || row.publish_date || '-',
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
    reviewedAt: row.admin_reviewed_at?.slice(0, 16).replace('T', ' ') || ''
  };
}

function mapNoticeStatus(status?: string): AdminNoticeRow['status'] {
  if (status === 'pending') return '待审核';
  if (status === 'rejected') return '已驳回';
  if (status === 'hidden') return '已下架';
  if (status === 'deleted') return '已删除';
  return '已发布';
}
