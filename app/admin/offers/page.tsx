'use client';

import {
  CheckCircle2,
  Download,
  EyeOff,
  FileSearch,
  MessageSquareText,
  ShieldCheck
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import {
  AdminActionBanner,
  AdminButton,
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
import { getAdminErrorMessage, invokeAdminApi } from '@/lib/admin-api';
import type { AdminMetric, AdminOfferRow } from '@/lib/admin-data';
import { formatBeijingDateTime } from '@/lib/admin-time';

const metricIcons = [ShieldCheck, CheckCircle2, MessageSquareText, EyeOff];

const defaultFilters = {
  contentType: '全部内容',
  status: '全部状态',
  category: '全部分类',
  query: ''
};

const discussionCategories = [
  '全部分类',
  '选校定位',
  '材料准备',
  '导师联系',
  '面试经验',
  'Offer选择',
  '候补动态',
  '其他'
];

type OfferFilters = typeof defaultFilters;

export default function AdminOffersPage() {
  const [rows, setRows] = useState<AdminOfferRow[]>([]);
  const [metrics, setMetrics] = useState<OfferMetrics>({
    pending: 0,
    approved: 0,
    hidden: 0,
    rejected: 0,
    deleted: 0,
    offerPosts: 0,
    discussions: 0
  });
  const [filters, setFilters] = useState<OfferFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState('');
  const [selectedPost, setSelectedPost] = useState<AdminOfferRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPosts({ page: 1 });
    }, 0);

    return () => window.clearTimeout(timer);
    // The moderation queue loads once; filters and pagination refresh it explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPosts(overrides: Partial<{ page: number; pageSize: number; filters: OfferFilters }> = {}) {
    const nextPage = overrides.page ?? page;
    const nextPageSize = overrides.pageSize ?? pageSize;
    const nextFilters = overrides.filters ?? filters;

    setPending('load');
    try {
      const data = await invokeAdminApi<{
        offers: OfferApiRow[];
        total: number;
        page: number;
        pageSize: number;
        metrics: OfferMetrics;
      }>({
        resource: 'offers',
        action: 'list',
        page: nextPage,
        pageSize: nextPageSize,
        filters: serializeFilters(nextFilters)
      });
      const mappedRows = data.offers.map(mapOfferApiRow);
      setRows(mappedRows);
      setTotal(data.total);
      setPage(data.page);
      setPageSize(data.pageSize);
      setMetrics(data.metrics);
      setFilters(nextFilters);
      setSelectedIds([]);
      setMessage('');
      setSelectedPost((current) => {
        if (!current) return null;
        return mappedRows.find((item) => item.id === current.id) || null;
      });
    } catch (error) {
      setRows([]);
      setMessage(getAdminErrorMessage(error, 'Offer 圈数据暂时无法更新，请稍后重试。'));
    } finally {
      setPending('');
    }
  }

  async function updatePostStatus(id: string, status: string, note: string) {
    if ((status === 'deleted' || status === 'hidden') && !window.confirm('确认执行该操作吗？')) {
      return;
    }

    setPending(`${status}:${id}`);
    try {
      await invokeAdminApi({ resource: 'offers', action: 'update_status', id, status, note });
      await loadPosts();
      setMessage('内容状态已更新。');
    } catch (error) {
      setMessage(getAdminErrorMessage(error, '内容处理失败，请稍后重试。'));
    } finally {
      setPending('');
    }
  }

  async function updateSelectedPosts(status: string, note: string) {
    if (!selectedIds.length) {
      setMessage('请先选择需要处理的内容。');
      return;
    }

    if ((status === 'deleted' || status === 'hidden') && !window.confirm(`确认处理 ${selectedIds.length} 条内容吗？`)) {
      return;
    }

    setPending(`bulk:${status}`);
    try {
      await Promise.all(
        selectedIds.map((id) =>
          invokeAdminApi({ resource: 'offers', action: 'update_status', id, status, note })
        )
      );
      await loadPosts();
      setMessage(`已完成 ${selectedIds.length} 条内容的批量处理。`);
    } catch (error) {
      setMessage(getAdminErrorMessage(error, '批量处理失败，请稍后重试。'));
    } finally {
      setPending('');
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function toggleAll() {
    const visibleIds = rows.map((item) => item.id);
    setSelectedIds((current) =>
      visibleIds.every((id) => current.includes(id)) ? [] : visibleIds
    );
  }

  function resetFilters() {
    void loadPosts({ page: 1, filters: defaultFilters });
  }

  function exportCurrentPage() {
    if (!rows.length) return;
    const headers = ['内容类型', '标题或结果', '作者', '学校', '专业', '分类', '状态', '评论', '关注', '举报', '提交时间'];
    const csvRows = rows.map((row) => [
      row.contentType === 'discussion' ? '社区讨论' : 'Offer动态',
      row.title || row.result,
      row.user,
      row.school,
      row.major,
      row.category || row.projectType,
      row.status,
      row.comments,
      row.follows,
      row.reports,
      row.submittedAt
    ]);
    const csv = [headers, ...csvRows]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `seekoffer-community-page-${page}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
  const metricCards = useMemo(() => buildMetrics(metrics), [metrics]);
  const isError = /失败|无法|异常/.test(message);

  return (
    <AdminShell
      title="Offer 圈管理"
      description="统一审核 Offer 动态与社区讨论，重点检查隐私、广告引流、真实性和交流质量。"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric, index) => (
          <AdminMetricCard key={metric.label} metric={metric} icon={metricIcons[index]} />
        ))}
      </div>

      {message ? (
        <div className="mt-5">
          <AdminActionBanner tone={isError ? 'danger' : 'info'}>
            {message}
          </AdminActionBanner>
        </div>
      ) : null}

      <AdminPanel
        className="mt-5"
        title="筛选审核内容"
        description="先按内容类型缩小范围，再通过状态、讨论分类或关键词定位记录。"
      >
        <form
          className="grid gap-3 p-5 lg:grid-cols-[minmax(260px,1fr)_180px_180px_180px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void loadPosts({ page: 1 });
          }}
        >
          <AdminInput
            placeholder="搜索标题、正文、学校、专业或作者"
            value={filters.query}
            onChange={(query) => setFilters((current) => ({ ...current, query }))}
          />
          <AdminSelect
            value={filters.contentType}
            options={['全部内容', 'Offer动态', '社区讨论']}
            onChange={(contentType) =>
              setFilters((current) => ({
                ...current,
                contentType,
                category: contentType === 'Offer动态' ? '全部分类' : current.category
              }))
            }
          />
          <AdminSelect
            value={filters.status}
            options={['全部状态', '待审核', '已通过', '已驳回', '已隐藏', '已删除']}
            onChange={(status) => setFilters((current) => ({ ...current, status }))}
          />
          <AdminSelect
            value={filters.category}
            options={discussionCategories}
            onChange={(category) => setFilters((current) => ({ ...current, category }))}
          />
          <AdminButton type="submit" disabled={pending === 'load'}>
            {pending === 'load' ? '查询中' : '查询'}
          </AdminButton>
        </form>
        <div className="border-t border-slate-100 px-5 py-3">
          <AdminFilterSummary
            filters={[
              { label: '内容类型', value: filters.contentType, mutedValue: '全部内容' },
              { label: '审核状态', value: filters.status, mutedValue: '全部状态' },
              { label: '讨论分类', value: filters.category, mutedValue: '全部分类' },
              { label: '关键词', value: filters.query }
            ]}
            onClear={resetFilters}
          />
        </div>
      </AdminPanel>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <AdminPanel
          title="内容审核队列"
          description={`当前页显示 ${rows.length} 条，共匹配 ${total} 条。`}
          action={
            <AdminButton tone="secondary" disabled={!rows.length} onClick={exportCurrentPage}>
              <Download className="mr-2 h-4 w-4" />
              导出当前页
            </AdminButton>
          }
        >
          <AdminSelectionBar
            selectedCount={selectedIds.length}
            totalCount={rows.length}
            onClear={() => setSelectedIds([])}
          >
            <AdminButton
              tone="secondary"
              disabled={!selectedIds.length || Boolean(pending)}
              onClick={() => updateSelectedPosts('approved', '批量审核通过社区内容')}
            >
              批量通过
            </AdminButton>
            <AdminButton
              tone="secondary"
              disabled={!selectedIds.length || Boolean(pending)}
              onClick={() => updateSelectedPosts('hidden', '批量隐藏社区内容')}
            >
              批量隐藏
            </AdminButton>
            <AdminButton
              tone="danger"
              disabled={!selectedIds.length || Boolean(pending)}
              onClick={() => updateSelectedPosts('deleted', '批量删除社区内容')}
            >
              批量删除
            </AdminButton>
          </AdminSelectionBar>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="w-12 px-5 py-3">
                    <input
                      type="checkbox"
                      aria-label="选择本页全部内容"
                      checked={allVisibleSelected}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="px-5 py-3">内容</th>
                  <th className="px-5 py-3">作者</th>
                  <th className="px-5 py-3">关联信息</th>
                  <th className="px-5 py-3">互动与风险</th>
                  <th className="px-5 py-3">提交时间</th>
                  <th className="px-5 py-3">状态</th>
                  <th className="px-5 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((post) => (
                  <tr key={post.id} className="border-t border-slate-100 align-top hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        aria-label={`选择 ${post.title || post.school}`}
                        checked={selectedIds.includes(post.id)}
                        onChange={() => toggleSelected(post.id)}
                      />
                    </td>
                    <td className="max-w-[360px] px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <ContentTypeBadge type={post.contentType} />
                        {post.official ? (
                          <span className="rounded-md bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-700 ring-1 ring-teal-100">
                            官方整理
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="mt-2 block max-w-full text-left font-semibold text-slate-950 hover:text-teal-700"
                        onClick={() => setSelectedPost(post)}
                      >
                        <span className="line-clamp-2">{post.title || `${post.school} · ${post.result}`}</span>
                      </button>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{post.content || '未填写正文'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                          {post.avatar}
                        </span>
                        <div>
                          <div className="font-medium text-slate-800">{post.user}</div>
                          <div className="mt-0.5 text-xs text-slate-400">{post.anonymous ? '匿名展示' : '公开昵称'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[190px] px-5 py-4 text-slate-600">
                      {post.contentType === 'discussion' ? (
                        <>
                          <div className="font-medium text-slate-800">{post.category || '其他讨论'}</div>
                          <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{post.school} · {post.major}</div>
                        </>
                      ) : (
                        <>
                          <div className="font-medium text-slate-800">{post.school}</div>
                          <div className="mt-1 text-xs text-slate-500">{post.major} · {post.projectType}</div>
                        </>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs leading-6 text-slate-500">
                      <div>评论 {post.comments} · 关注 {post.follows}</div>
                      <div className={post.reports > 0 ? 'font-semibold text-rose-600' : ''}>举报 {post.reports}</div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">{post.submittedAt}</td>
                    <td className="px-5 py-4"><AdminStatusBadge status={post.status} /></td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-x-3 gap-y-2 text-xs font-semibold">
                        <button className="text-blue-700" onClick={() => setSelectedPost(post)}>查看</button>
                        <button className="text-emerald-700" disabled={Boolean(pending)} onClick={() => updatePostStatus(post.id, 'approved', '审核通过社区内容')}>通过</button>
                        <button className="text-slate-600" disabled={Boolean(pending)} onClick={() => updatePostStatus(post.id, 'hidden', '后台隐藏社区内容')}>隐藏</button>
                        <button className="text-rose-600" disabled={Boolean(pending)} onClick={() => updatePostStatus(post.id, 'deleted', '删除社区内容')}>删除</button>
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
              title={pending === 'load' ? '正在加载审核队列' : '没有匹配的内容'}
              description={pending === 'load' ? '正在读取最新内容，请稍候。' : '可以清空筛选条件，或确认前台发布入口是否开启。'}
              action={pending !== 'load' ? <AdminButton tone="secondary" onClick={resetFilters}>重置筛选</AdminButton> : null}
            />
          ) : null}

          <AdminPagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={(nextPage) => void loadPosts({ page: nextPage })}
            onPageSizeChange={(nextPageSize) => void loadPosts({ page: 1, pageSize: nextPageSize })}
          />
        </AdminPanel>

        <AdminPanel title="审核详情" description="查看完整内容后再决定是否公开展示。" className="xl:sticky xl:top-24">
          <div className="space-y-5 p-5 text-sm leading-7 text-slate-600">
            {selectedPost ? (
              <>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <ContentTypeBadge type={selectedPost.contentType} />
                      {selectedPost.official ? <span className="text-xs font-semibold text-teal-700">官方整理</span> : null}
                    </div>
                    <AdminStatusBadge status={selectedPost.status} />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold leading-7 text-slate-950">
                    {selectedPost.title || `${selectedPost.school} · ${selectedPost.result}`}
                  </h3>
                  <p className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm leading-7 text-slate-600 ring-1 ring-slate-200">
                    {selectedPost.content || '未填写正文'}
                  </p>
                  <div className="mt-4 grid gap-2">
                    <DetailItem label="提交用户" value={selectedPost.user} />
                    <DetailItem label="学校 / 场景" value={selectedPost.school} />
                    <DetailItem label="专业 / 方向" value={selectedPost.major} />
                    <DetailItem label="分类" value={selectedPost.category || selectedPost.projectType} />
                    {selectedPost.contentType === 'offer' ? <DetailItem label="结果" value={selectedPost.result} /> : null}
                    {selectedPost.contentType === 'offer' ? <DetailItem label="本科背景" value={selectedPost.background} /> : null}
                    <DetailItem label="匿名展示" value={selectedPost.anonymous ? '是' : '否'} />
                    <DetailItem label="互动" value={`评论 ${selectedPost.comments} · 关注 ${selectedPost.follows}`} />
                    <DetailItem label="举报数" value={`${selectedPost.reports}`} />
                    <DetailItem label="提交时间" value={selectedPost.submittedAt} />
                  </div>
                </div>
                <div className="grid gap-3">
                  <AdminButton disabled={Boolean(pending)} onClick={() => updatePostStatus(selectedPost.id, 'approved', '审核通过社区内容')}>
                    通过并展示
                  </AdminButton>
                  <AdminButton tone="secondary" disabled={Boolean(pending)} onClick={() => updatePostStatus(selectedPost.id, 'hidden', '隐藏社区内容')}>
                    隐藏内容
                  </AdminButton>
                  <AdminButton tone="danger" disabled={Boolean(pending)} onClick={() => updatePostStatus(selectedPost.id, 'deleted', '删除社区内容')}>
                    删除内容
                  </AdminButton>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
                从左侧列表选择一条内容，完整正文与审核操作会显示在这里。
              </div>
            )}
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800 ring-1 ring-amber-100">
              审核原则：不公开手机号、微信号等个人信息；不放行广告引流、冒充官方或无法判断真实性的结论。
            </div>
          </div>
        </AdminPanel>
      </div>
    </AdminShell>
  );
}

type OfferMetrics = {
  pending: number;
  approved: number;
  hidden: number;
  rejected: number;
  deleted: number;
  offerPosts: number;
  discussions: number;
};

type OfferApiRow = {
  id: string;
  author_name: string | null;
  school_name: string | null;
  major: string | null;
  project_type: string | null;
  result: string | null;
  undergraduate_background: string | null;
  content: string | null;
  is_anonymous: boolean | null;
  review_status: string | null;
  reports_count: number | null;
  created_at: string;
  content_type: string | null;
  title: string | null;
  category: string | null;
  is_official: boolean | null;
  source_label: string | null;
  comments_count: number | null;
  follows_count: number | null;
};

function serializeFilters(filters: OfferFilters) {
  return {
    query: filters.query.trim(),
    contentType:
      filters.contentType === 'Offer动态'
        ? 'offer'
        : filters.contentType === '社区讨论'
          ? 'discussion'
          : 'all',
    category: filters.category === '全部分类' ? 'all' : filters.category,
    status: statusToApi(filters.status)
  };
}

function statusToApi(status: string) {
  if (status === '待审核') return 'pending';
  if (status === '已通过') return 'approved';
  if (status === '已驳回') return 'rejected';
  if (status === '已隐藏') return 'hidden';
  if (status === '已删除') return 'deleted';
  return 'all';
}

function buildMetrics(metrics: OfferMetrics): AdminMetric[] {
  return [
    { label: '待审核', value: String(metrics.pending), hint: '需要运营确认的内容', tone: 'purple' },
    { label: '已公开', value: String(metrics.approved), hint: `Offer ${metrics.offerPosts} · 讨论 ${metrics.discussions}`, tone: 'green' },
    { label: '社区讨论', value: String(metrics.discussions), hint: '问题、经验与选择交流', tone: 'blue' },
    { label: '已隐藏', value: String(metrics.hidden), hint: `已驳回 ${metrics.rejected} · 已删除 ${metrics.deleted}`, tone: 'amber' }
  ];
}

function mapOfferApiRow(row: OfferApiRow): AdminOfferRow {
  const contentType = row.content_type === 'discussion' ? 'discussion' : 'offer';
  const author = row.author_name?.trim() || '匿名用户';
  return {
    id: row.id,
    user: author,
    avatar: author.slice(0, 1),
    contentType,
    title: row.title?.trim() || '',
    category: row.category?.trim() || '',
    content: row.content?.trim() || '',
    official: Boolean(row.is_official),
    sourceLabel: row.source_label?.trim() || '',
    school: row.school_name?.trim() || (contentType === 'discussion' ? '通用讨论' : '待补充学校'),
    major: row.major?.trim() || (contentType === 'discussion' ? '申请规划' : '待补充专业'),
    projectType: row.project_type?.trim() || '其他',
    result: row.result?.trim() || '待确认',
    background: row.undergraduate_background?.trim() || '未填写',
    anonymous: row.is_anonymous !== false,
    submittedAt: formatBeijingDateTime(row.created_at),
    status: mapStatus(row.review_status || ''),
    reports: row.reports_count || 0,
    comments: row.comments_count || 0,
    follows: row.follows_count || 0
  };
}

function mapStatus(status: string): AdminOfferRow['status'] {
  if (status === 'approved') return '已通过';
  if (status === 'rejected') return '已驳回';
  if (status === 'hidden') return '已隐藏';
  if (status === 'deleted') return '已删除';
  return '待审核';
}

function ContentTypeBadge({ type }: { type: AdminOfferRow['contentType'] }) {
  return (
    <span className={type === 'discussion'
      ? 'rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-100'
      : 'rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100'}
    >
      {type === 'discussion' ? '社区讨论' : 'Offer动态'}
    </span>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[190px] text-right font-semibold text-slate-800">{value || '-'}</span>
    </div>
  );
}
