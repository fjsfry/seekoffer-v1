'use client';

import { CheckCircle2, EyeOff, ShieldCheck, Trash2 } from 'lucide-react';
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
import type { AdminMetric, AdminOfferRow } from '@/lib/admin-data';
import { invokeAdminApi } from '@/lib/admin-api';
import { formatBeijingDateTime } from '@/lib/admin-time';

const offerIcons = [ShieldCheck, CheckCircle2, EyeOff, Trash2];

const defaultFilters = {
  school: '',
  major: '',
  result: '全部结果',
  status: '全部状态',
  query: ''
};

type OfferFilters = typeof defaultFilters;

export default function AdminOffersPage() {
  const [rows, setRows] = useState<AdminOfferRow[]>([]);
  const [metrics, setMetrics] = useState<OfferMetrics>({ pending: 0, approved: 0, hidden: 0, rejected: 0, deleted: 0 });
  const [filters, setFilters] = useState<OfferFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState('正在连接后台真实 Offer 数据...');
  const [pending, setPending] = useState('');
  const [selectedOffer, setSelectedOffer] = useState<AdminOfferRow | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOffers({ page: 1 });
    }, 0);

    return () => window.clearTimeout(timer);
    // The Offer table loads once on mount; filters and pagination refresh it explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadOffers(overrides: Partial<{ page: number; pageSize: number; filters: OfferFilters }> = {}) {
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
        filters: serializeOfferFilters(nextFilters)
      });
      setRows(data.offers.map(mapOfferApiRow));
      setTotal(data.total);
      setPage(data.page);
      setPageSize(data.pageSize);
      setMetrics(data.metrics);
      setFilters(nextFilters);
      setMessage(`已连接 Supabase，共匹配 ${data.total} 条 Offer。`);
      setSelectedOffer((current) => {
        if (!current) return null;
        return data.offers.map(mapOfferApiRow).find((item) => item.id === current.id) || null;
      });
    } catch (error) {
      setRows([]);
      setMessage(error instanceof Error ? `真实 API 暂不可用：${error.message}` : '真实 API 暂不可用，请稍后重试。');
    } finally {
      setPending('');
    }
  }

  async function updateOfferStatus(id: string, status: string, note: string) {
    if ((status === 'deleted' || status === 'hidden') && !window.confirm('确认执行该操作吗？该操作会写入后台日志。')) {
      return;
    }

    setPending(`${status}:${id}`);
    try {
      await invokeAdminApi({
        resource: 'offers',
        action: 'update_status',
        id,
        status,
        note
      });
      setMessage('操作成功，已写入 Supabase 并记录日志。');
      await loadOffers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Offer 操作失败，请稍后重试。');
    } finally {
      setPending('');
    }
  }

  function previewOffer(offer: AdminOfferRow) {
    setSelectedOffer(offer);
    setMessage(`已打开 ${offer.school} · ${offer.major} 的 Offer 审核预览。`);
  }

  return (
    <AdminShell title="Offer池管理" description="审核用户贡献的 Offer 动态，优先排查隐私、引流和明显虚假内容。">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <AdminPanel>
            <div className="grid gap-5 p-5">
              <div className="grid gap-4 xl:grid-cols-5">
                <AdminInput placeholder="学校" value={filters.school} onChange={(value) => setFilters((current) => ({ ...current, school: value }))} />
                <AdminInput placeholder="专业" value={filters.major} onChange={(value) => setFilters((current) => ({ ...current, major: value }))} />
                <AdminSelect
                  label="结果"
                  value={filters.result}
                  options={['全部结果', '录取', '放弃', '候补', '补录传闻']}
                  onChange={(value) => setFilters((current) => ({ ...current, result: value }))}
                />
                <AdminSelect
                  label="审核状态"
                  value={filters.status}
                  options={['全部状态', '待审核', '已通过', '已驳回', '已隐藏', '已删除']}
                  onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
                />
                <AdminInput placeholder="搜索学校、专业、用户昵称等" value={filters.query} onChange={(value) => setFilters((current) => ({ ...current, query: value }))} />
              </div>
              <div className="flex justify-end gap-3">
                <AdminButton onClick={() => loadOffers({ page: 1 })} disabled={pending === 'load'}>查询</AdminButton>
                <AdminButton
                  tone="secondary"
                  onClick={() => {
                    void loadOffers({ page: 1, filters: defaultFilters });
                    setMessage('Offer 筛选条件已重置，并重新加载真实 Offer 列表。');
                  }}
                >
                  重置
                </AdminButton>
              </div>
              <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div>
            </div>
          </AdminPanel>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {buildOfferMetrics(metrics).map((metric, index) => (
              <AdminMetricCard key={metric.label} metric={metric} icon={offerIcons[index]} />
            ))}
          </section>

          <AdminPanel title="Offer列表">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-5 py-3"><input type="checkbox" aria-label="选择全部 Offer" /></th>
                    <th className="px-5 py-3">提交用户</th>
                    <th className="px-5 py-3">申请学校</th>
                    <th className="px-5 py-3">申请专业</th>
                    <th className="px-5 py-3">项目类型</th>
                    <th className="px-5 py-3">录取结果</th>
                    <th className="px-5 py-3">本科背景</th>
                    <th className="px-5 py-3">是否匿名</th>
                    <th className="px-5 py-3">提交时间</th>
                    <th className="px-5 py-3">审核状态</th>
                    <th className="px-5 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((offer, index) => (
                    <tr key={`${offer.id}-${index}`} className="border-t border-slate-100">
                      <td className="px-5 py-4"><input type="checkbox" aria-label={`选择 ${offer.user}`} /></td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                            {offer.avatar}
                          </div>
                          <span className="font-medium text-slate-900">{offer.user}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-700">{offer.school}</td>
                      <td className="px-5 py-4 text-slate-700">{offer.major}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">{offer.projectType}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">{offer.result}</span>
                      </td>
                      <td className="px-5 py-4 text-slate-700">{offer.background}</td>
                      <td className="px-5 py-4 text-slate-700">{offer.anonymous ? '是' : '否'}</td>
                      <td className="px-5 py-4 text-slate-600">{offer.submittedAt}</td>
                      <td className="px-5 py-4"><AdminStatusBadge status={offer.status} /></td>
                      <td className="px-5 py-4">
                        <div className="flex gap-3 font-medium">
                          <button className="text-blue-600" onClick={() => previewOffer(offer)}>查看</button>
                          <button className="text-emerald-600" disabled={Boolean(pending)} onClick={() => updateOfferStatus(offer.id, 'approved', '审核通过 Offer')}>通过</button>
                          <button className="text-slate-600" disabled={Boolean(pending)} onClick={() => updateOfferStatus(offer.id, 'hidden', '后台隐藏 Offer')}>隐藏</button>
                          <button className="text-rose-600" disabled={Boolean(pending)} onClick={() => updateOfferStatus(offer.id, 'deleted', '后台删除 Offer')}>删除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!rows.length ? <div className="border-t border-slate-100 px-5 py-12 text-center text-sm text-slate-500">当前没有匹配的 Offer 动态。</div> : null}

            <AdminPagination
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={(nextPage) => void loadOffers({ page: nextPage })}
              onPageSizeChange={(nextPageSize) => void loadOffers({ page: 1, pageSize: nextPageSize })}
            />
          </AdminPanel>
        </div>

        <AdminPanel title="Offer审核工作台">
          <div className="space-y-5 p-5 text-sm leading-7 text-slate-600">
            {selectedOffer ? (
              <>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-slate-950">{selectedOffer.school}</div>
                      <div className="mt-1 text-slate-500">{selectedOffer.major} · {selectedOffer.projectType}</div>
                    </div>
                    <AdminStatusBadge status={selectedOffer.status} />
                  </div>
                  <div className="mt-4 grid gap-2">
                    <DetailItem label="提交用户" value={selectedOffer.user} />
                    <DetailItem label="录取结果" value={selectedOffer.result} />
                    <DetailItem label="本科背景" value={selectedOffer.background} />
                    <DetailItem label="匿名展示" value={selectedOffer.anonymous ? '是' : '否'} />
                    <DetailItem label="举报数" value={`${selectedOffer.reports}`} />
                    <DetailItem label="提交时间" value={selectedOffer.submittedAt} />
                  </div>
                </div>
                <div className="grid gap-3">
                  <AdminButton disabled={Boolean(pending)} onClick={() => updateOfferStatus(selectedOffer.id, 'approved', '审核通过 Offer')}>
                    通过并展示
                  </AdminButton>
                  <AdminButton tone="secondary" disabled={Boolean(pending)} onClick={() => updateOfferStatus(selectedOffer.id, 'hidden', '后台隐藏 Offer')}>
                    隐藏
                  </AdminButton>
                  <AdminButton tone="danger" disabled={Boolean(pending)} onClick={() => updateOfferStatus(selectedOffer.id, 'deleted', '后台删除 Offer')}>
                    删除
                  </AdminButton>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
                请选择一条 Offer 查看完整审核信息。
              </div>
            )}
            <ReviewTip title="检查隐私信息" body="确认内容中是否包含姓名、邮箱、电话、地址、身份证号、学号等个人隐私信息。" />
            <ReviewTip title="检查广告引流" body="确认内容中是否存在引导添加微信、QQ群、外链、二维码等广告引流信息。" />
            <ReviewTip title="检查内容真实性" body="确认内容真实克制，无明显夸大或误导，维护社区可信度。" />
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
};

type OfferApiRow = {
  id: string;
  author_name: string;
  school_name: string;
  major: string;
  project_type: string;
  result: string;
  undergraduate_background: string;
  is_anonymous: boolean;
  review_status: string;
  reports_count: number;
  created_at: string;
};

function serializeOfferFilters(filters: OfferFilters) {
  return {
    school: filters.school.trim(),
    major: filters.major.trim(),
    query: filters.query.trim() || (filters.result === '全部结果' ? '' : filters.result),
    status: offerStatusToApi(filters.status)
  };
}

function offerStatusToApi(status: string) {
  if (status === '待审核') return 'pending';
  if (status === '已通过') return 'approved';
  if (status === '已驳回') return 'rejected';
  if (status === '已隐藏') return 'hidden';
  if (status === '已删除') return 'deleted';
  return 'all';
}

function buildOfferMetrics(metrics: OfferMetrics): AdminMetric[] {
  return [
    { label: '待审核', value: String(metrics.pending), hint: '新提交动态', tone: 'purple' },
    { label: '已通过', value: String(metrics.approved), hint: '前台可见', tone: 'green' },
    { label: '已隐藏', value: String(metrics.hidden), hint: `已驳回 ${metrics.rejected} 条`, tone: 'amber' },
    { label: '已删除', value: String(metrics.deleted), hint: '逻辑删除', tone: 'rose' }
  ];
}

function mapOfferApiRow(row: OfferApiRow): AdminOfferRow {
  return {
    id: row.id,
    user: row.author_name || '匿名用户',
    avatar: (row.author_name || '匿').slice(0, 1),
    school: row.school_name || '待补充学校',
    major: row.major || '待补充专业',
    projectType: row.project_type || '其他',
    result: row.result || '待确认',
    background: row.undergraduate_background || '未填写',
    anonymous: row.is_anonymous,
    submittedAt: formatBeijingDateTime(row.created_at),
    status: mapOfferStatus(row.review_status),
    reports: row.reports_count || 0
  };
}

function mapOfferStatus(status: string): AdminOfferRow['status'] {
  if (status === 'approved') return '已通过';
  if (status === 'rejected') return '已驳回';
  if (status === 'hidden') return '已隐藏';
  if (status === 'deleted') return '已删除';
  return '待审核';
}

function ReviewTip({ title, body }: { title: string; body: string }) {
  return (
    <div className="relative pl-5">
      <span className="absolute left-0 top-2 h-2 w-2 rounded-full bg-blue-600" />
      <div className="font-semibold text-slate-950">{title}</div>
      <p className="mt-2">{body}</p>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-800">{value || '-'}</span>
    </div>
  );
}
