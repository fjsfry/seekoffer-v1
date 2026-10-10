'use client';

import {AlertTriangle, CheckCircle2, ChevronRight, CreditCard, Eye, RefreshCw, Search, ShieldAlert, X} from 'lucide-react';
import {FormEvent, useCallback, useEffect, useState} from 'react';
import {AdminShell} from '@/components/admin-shell';
import {AdminActionBanner, AdminEmptyState, AdminInput, AdminMetricCard, AdminPagination, AdminPanel, AdminSelect, AdminStatusBadge, adminClassNames} from '@/components/admin-ui';
import {getAdminErrorMessage, invokeAdminApi} from '@/lib/admin-api';

type PaymentOrder = {
  id: string;
  orderNo: string;
  title: string;
  amountCents: number;
  currency: string;
  contactType: string;
  contactMasked: string;
  userId: string | null;
  status: string;
  provider: string;
  paymentReference: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  updatedAt: string;
  payment: {
    id: string;
    merchantOrderNo: string;
    providerOrderId: string | null;
    payMethod: string;
    status: string;
    providerStatus: number | null;
    failureCode: string | null;
    paidAt: string | null;
    lastQueriedAt: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  callbackCount: number;
  lastCallbackAt: string | null;
};

type PaymentMonitor = {
  checkedAt: string;
  window: {from: string; to: string};
  provider: {name: string; configured: boolean; callbackPath: string};
  orders: {total: number; pending: number; stalePending: number; fulfilled: number; expired: number; refunded: number; lastCreatedAt: string | null};
  payments: {total: number; creating: number; staleCreating: number; createUnknown: number; staleCreateUnknown: number; pending: number; stalePending: number; succeeded: number; failed: number; closed: number; needsReview: number; terminalOther: number; succeededAmountCents: number; lastUpdatedAt: string | null};
  callbacks: {total: number; successful: number; stateChanged: number; needsReview: number; lastAt: string | null; lastSuccessAt: string | null; lastReviewAt: string | null};
  alerts: Array<{code: string; severity: 'info' | 'warning' | 'critical'; message: string}>;
  orderList: {items: PaymentOrder[]; total: number; page: number; pageSize: number; pages: number; window: {from: string | null; to: string}; filters: {query: string; status: string; windowDays: number}};
};

type PaymentDetail = {order: PaymentOrder; events: Array<{id: string; source: string; eventType: string; providerStatus: number | null; createdAt: string}>};

const orderStatusOptions = [
  {label: '全部订单', value: 'all'},
  {label: '待支付', value: 'pending'},
  {label: '已支付', value: 'paid'},
  {label: '已履约', value: 'fulfilled'},
  {label: '已取消', value: 'canceled'},
  {label: '已过期', value: 'expired'},
  {label: '已退款', value: 'refunded'}
];

const windowOptions = [
  {label: '近 24 小时', value: '1'},
  {label: '近 7 天', value: '7'},
  {label: '近 30 天', value: '30'},
  {label: '近 90 天', value: '90'},
  {label: '全部时间', value: '0'}
];

function formatTime(value: string | null) {
  if (!value) return '暂无记录';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '时间异常';
  return new Intl.DateTimeFormat('zh-CN', {timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'}).format(date);
}

function formatMoney(cents: number, currency = 'CNY') {
  return `${currency === 'CNY' ? '¥' : currency}${(cents / 100).toFixed(2)}`;
}

function orderStatus(status: string) {
  return ({pending: '待支付', paid: '已支付', fulfilled: '已履约', canceled: '已取消', expired: '已过期', refunded: '已退款'} as Record<string, string>)[status] || status || '未知';
}

function paymentStatus(status?: string) {
  return ({creating: '创建中', create_unknown: '结果未知', pending: '待支付', succeeded: '支付成功', failed: '支付失败', closed: '已关闭', needs_review: '待复核', duplicate_succeeded: '重复成功', refunding: '退款中', refunded: '已退款'} as Record<string, string>)[status || ''] || '无支付记录';
}

function eventLabel(eventType: string) {
  return ({payment_prepared: '准备支付', payment_created: '创建支付', payment_create_unknown: '创建结果未知', payment_create_failed: '创建失败', payment_state_changed: '支付状态变更', payment_succeeded: '支付成功', payment_needs_review: '进入人工复核', duplicate_payment: '重复支付', refund_prepared: '准备退款', refund_state_changed: '退款状态变更'} as Record<string, string>)[eventType] || eventType;
}

export default function AdminPaymentsPage() {
  const [data, setData] = useState<PaymentMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [windowDays, setWindowDays] = useState('30');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detail, setDetail] = useState<PaymentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invokeAdminApi<PaymentMonitor>({resource: 'payment_monitor', action: 'snapshot', page, pageSize, filters: {query: appliedQuery, status, windowDays: Number(windowDays)}});
      setData(result);
      setMessage('');
    } catch (error) {
      setMessage(getAdminErrorMessage(error, '支付状态暂时无法更新。'));
    } finally {
      setLoading(false);
    }
  }, [appliedQuery, page, pageSize, status, windowDays]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function openDetail(id: string) {
    setDetailLoading(true);
    try {
      const result = await invokeAdminApi<PaymentDetail>({resource: 'payment_monitor', action: 'detail', id});
      setDetail(result);
    } catch (error) {
      setMessage(getAdminErrorMessage(error, '订单详情暂时无法读取。'));
    } finally {
      setDetailLoading(false);
    }
  }

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedQuery(query.trim());
  }

  const critical = data?.alerts.some((item) => item.severity === 'critical');
  const warning = data?.alerts.some((item) => item.severity === 'warning');
  const orders = data?.orderList.items || [];

  return (
    <AdminShell title="支付监控" description="每一笔订单都可追溯，集中查看支付状态、回调和履约结果。">
      <div className="space-y-5">
        {message ? <AdminActionBanner tone="danger" action={<button type="button" onClick={() => void load()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-current/20 px-3 text-sm font-semibold"><RefreshCw className={adminClassNames('h-4 w-4', loading && 'animate-spin')} />重试</button>}>{message}</AdminActionBanner> : null}
        <AdminActionBanner tone={critical ? 'danger' : warning ? 'warning' : 'success'} action={<button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-current/20 px-3 text-sm font-semibold disabled:opacity-50"><RefreshCw className={adminClassNames('h-4 w-4', loading && 'animate-spin')} />{loading ? '更新中' : '刷新'}</button>}>
          {loading && !data ? '正在读取支付状态…' : critical ? '支付链路存在需要处理的事项。' : warning ? '支付链路基本可用，但有事项需要关注。' : '近 24 小时支付链路运行正常。'}
          {data ? <span className="ml-2 text-xs opacity-70">检查于 {formatTime(data.checkedAt)}</span> : null}
        </AdminActionBanner>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard metric={{label: '近 24 小时订单', value: String(data?.orders.total ?? 0), hint: `已履约 ${data?.orders.fulfilled ?? 0} 笔`, tone: 'blue'}} icon={CreditCard} />
          <AdminMetricCard metric={{label: '支付成功', value: String(data?.payments.succeeded ?? 0), hint: `金额 ${formatMoney(data?.payments.succeededAmountCents ?? 0)}`, tone: 'green'}} icon={CheckCircle2} />
          <AdminMetricCard metric={{label: '待复核支付', value: String(data?.payments.needsReview ?? 0), hint: '异常履约或状态不一致', tone: 'rose'}} icon={ShieldAlert} />
          <AdminMetricCard metric={{label: '支付回调', value: String(data?.callbacks.total ?? 0), hint: `成功 ${data?.callbacks.successful ?? 0} 次`, tone: 'amber'}} icon={RefreshCw} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <AdminPanel title="异常与处理建议" action={<span className="text-xs text-slate-500">仅提示，不会自动改订单</span>}>
            <div className="divide-y divide-slate-100">
              {(data?.alerts ?? []).map((alert) => (
                <div key={alert.code} className="flex items-start gap-3 px-5 py-4">
                  <span className={adminClassNames('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', alert.severity === 'critical' ? 'bg-rose-50 text-rose-600' : alert.severity === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600')}>
                    {alert.severity === 'info' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-800">{alert.message}</span><AdminStatusBadge status={alert.severity === 'critical' ? '失败' : alert.severity === 'warning' ? '处理中' : '正常'} /></div><p className="mt-1 text-sm text-slate-500">{alert.code === 'payments_need_review' || alert.code === 'payment_create_unknown' ? '核对订单、支付平台状态和履约记录，再决定是否补发权益。' : alert.code === 'callback_not_seen' ? '检查 JianPay 回调可达性和商户配置，再核对支付平台订单状态。' : alert.code === 'payment_create_stuck' || alert.code === 'payment_pending_stale' ? '确认未支付后再关闭订单，确认已支付则进入人工复核。' : alert.message}</p></div>
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel title="渠道与回调">
            <div className="space-y-4 px-5 py-5 text-sm">
              <div className="flex items-center justify-between"><span className="text-slate-500">支付渠道</span><span className="font-semibold text-slate-800">JianPay</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">配置状态</span><AdminStatusBadge status={data?.provider.configured ? '正常' : '失败'} /></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">最近回调</span><span className="font-semibold text-slate-800">{formatTime(data?.callbacks.lastAt ?? null)}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">最近成功</span><span className="font-semibold text-slate-800">{formatTime(data?.callbacks.lastSuccessAt ?? null)}</span></div>
              <div className="border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">状态检查只读取已落库的订单和事件，不会发起订单、扣款或修改支付状态。</div>
            </div>
          </AdminPanel>
        </div>

        <AdminPanel title="订单流水" action={<span className="text-xs text-slate-500">共 {data?.orderList.total.toLocaleString('zh-CN') || 0} 笔</span>}>
          <form onSubmit={submitFilters} className="grid gap-3 border-b border-slate-100 bg-slate-50/60 p-4 md:grid-cols-[minmax(260px,1fr)_160px_160px_auto] md:items-end">
            <label className="grid gap-2"><span className="text-xs font-semibold text-slate-500">搜索订单</span><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><AdminInput placeholder="订单号、商品、支付单号" value={query} onChange={setQuery} className="pl-9" /></div></label>
            <AdminSelect label="订单状态" options={orderStatusOptions} value={status} onChange={(value) => {setStatus(value);setPage(1);}} />
            <AdminSelect label="时间范围" options={windowOptions} value={windowDays} onChange={(value) => {setWindowDays(value);setPage(1);}} />
            <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800"><Search className="h-4 w-4" />查询</button>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="px-5 py-3">订单</th><th className="px-4 py-3">商品 / 买家</th><th className="px-4 py-3">金额</th><th className="px-4 py-3">订单状态</th><th className="px-4 py-3">支付状态</th><th className="px-4 py-3">回调</th><th className="px-4 py-3">创建时间</th><th className="px-5 py-3 text-right">操作</th></tr></thead>
              <tbody>
                {orders.map((order, index) => (
                  <tr key={order.id} className={adminClassNames('border-t border-slate-100 transition hover:bg-emerald-50/30', index % 2 === 1 && 'bg-slate-50/30')}>
                    <td className="px-5 py-4"><div className="font-semibold text-slate-900">{order.orderNo}</div><div className="mt-1 text-xs text-slate-400">{order.provider || '未指定渠道'}</div></td>
                    <td className="max-w-[260px] px-4 py-4"><div className="truncate font-medium text-slate-800" title={order.title}>{order.title}</div><div className="mt-1 truncate text-xs text-slate-500">{order.contactMasked || '未填写联系方式'}</div></td>
                    <td className="whitespace-nowrap px-4 py-4 font-semibold tabular-nums text-slate-900">{formatMoney(order.amountCents, order.currency)}</td>
                    <td className="px-4 py-4"><AdminStatusBadge status={orderStatus(order.status)} /></td>
                    <td className="px-4 py-4"><AdminStatusBadge status={paymentStatus(order.payment?.status)} />{order.payment?.failureCode ? <div className="mt-1 max-w-28 truncate text-xs text-rose-600" title={order.payment.failureCode}>{order.payment.failureCode}</div> : null}</td>
                    <td className="px-4 py-4"><div className="font-semibold text-slate-800">{order.callbackCount} 次</div><div className="mt-1 text-xs text-slate-400">{formatTime(order.lastCallbackAt)}</div></td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">{formatTime(order.createdAt)}</td>
                    <td className="px-5 py-4 text-right"><button type="button" onClick={() => void openDetail(order.id)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-emerald-50 hover:text-teal-800"><Eye className="h-3.5 w-3.5" />详情<ChevronRight className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && !orders.length ? <AdminEmptyState title="暂无订单记录" description="当前筛选范围内没有已落库订单。" icon={CreditCard} /> : null}
          {data ? <AdminPagination total={data.orderList.total} pages={data.orderList.pages} page={data.orderList.page} pageSize={data.orderList.pageSize} onPageChange={setPage} onPageSizeChange={(value) => {setPageSize(value);setPage(1);}} /> : null}
        </AdminPanel>

        <AdminPanel title="状态分布">
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-4">
            {[['待支付', data?.payments.pending ?? 0], ['创建中', data?.payments.creating ?? 0], ['结果未知', data?.payments.createUnknown ?? 0], ['失败/关闭', (data?.payments.failed ?? 0) + (data?.payments.closed ?? 0)], ['超时待支付', data?.payments.stalePending ?? 0], ['超时创建中', data?.payments.staleCreating ?? 0], ['超时结果未知', data?.payments.staleCreateUnknown ?? 0]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div></div>)}
          </div>
        </AdminPanel>
      </div>

      {detail || detailLoading ? <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="订单详情"><button type="button" aria-label="关闭订单详情" className="absolute inset-0 cursor-default" onClick={() => setDetail(null)} /><aside className="relative z-10 flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">订单详情</div><h2 className="mt-1 text-lg font-semibold text-slate-950">{detail?.order.orderNo || '正在读取…'}</h2></div><button type="button" onClick={() => setDetail(null)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="关闭"><X className="h-4 w-4" /></button></div>{detail ? <div className="flex-1 overflow-y-auto p-5"><div className="grid gap-3 sm:grid-cols-2"><Info label="商品" value={detail.order.title} /><Info label="订单金额" value={formatMoney(detail.order.amountCents, detail.order.currency)} /><Info label="订单状态" value={orderStatus(detail.order.status)} /><Info label="支付状态" value={paymentStatus(detail.order.payment?.status)} /><Info label="联系方式" value={detail.order.contactMasked || '未填写'} /><Info label="创建时间" value={formatTime(detail.order.createdAt)} /><Info label="支付单号" value={detail.order.payment?.merchantOrderNo || '暂无'} /><Info label="渠道订单号" value={detail.order.payment?.providerOrderId || '暂无'} /></div><div className="mt-6"><h3 className="text-sm font-semibold text-slate-900">支付事件时间线</h3><div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">{detail.events.length ? detail.events.map((event) => <div key={event.id} className="flex gap-3 px-4 py-3"><span className="mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full bg-teal-600 ring-4 ring-teal-50" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-slate-800">{eventLabel(event.eventType)}</span><span className="text-xs text-slate-400">{formatTime(event.createdAt)}</span></div><div className="mt-1 text-xs text-slate-500">来源：{event.source} · 上游状态：{event.providerStatus ?? '未提供'}</div></div></div>) : <div className="px-4 py-8 text-center text-sm text-slate-500">暂无支付事件记录。</div>}</div></div></div> : <div className="p-5 text-sm text-slate-500">正在读取订单详情…</div>}</aside></div> : null}
    </AdminShell>
  );
}

function Info({label, value}: {label: string; value: string}) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 break-all text-sm font-semibold text-slate-800">{value}</div></div>;
}
