'use client';

import { AlertTriangle, CheckCircle2, CreditCard, RefreshCw, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { AdminActionBanner, AdminMetricCard, AdminPanel, AdminStatusBadge, adminClassNames } from '@/components/admin-ui';
import { getAdminErrorMessage, invokeAdminApi } from '@/lib/admin-api';

type PaymentMonitor = {
  checkedAt: string;
  window: { from: string; to: string };
  provider: { name: string; configured: boolean; callbackPath: string };
  orders: { total: number; pending: number; fulfilled: number; expired: number; refunded: number; lastCreatedAt: string | null };
  payments: { total: number; creating: number; createUnknown: number; pending: number; succeeded: number; failed: number; closed: number; needsReview: number; terminalOther: number; succeededAmountCents: number; lastUpdatedAt: string | null };
  callbacks: { total: number; successful: number; stateChanged: number; needsReview: number; lastAt: string | null; lastSuccessAt: string | null; lastReviewAt: string | null };
  alerts: Array<{ code: string; severity: 'info' | 'warning' | 'critical'; message: string }>;
};

function formatTime(value: string | null) {
  if (!value) return '暂无记录';
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatMoney(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`;
}

export default function AdminPaymentsPage() {
  const [data, setData] = useState<PaymentMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    try {
      const result = await invokeAdminApi<PaymentMonitor>({ resource: 'payment_monitor', action: 'snapshot' });
      setData(result);
      setMessage('');
    } catch (error) {
      setMessage(getAdminErrorMessage(error, '支付状态暂时无法更新。'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const critical = data?.alerts.some((item) => item.severity === 'critical');
  const warning = data?.alerts.some((item) => item.severity === 'warning');

  return (
    <AdminShell title="支付监控" description="查看近 24 小时订单、支付回调和待复核事项。">
      <div className="space-y-5">
        {message ? <AdminActionBanner tone="danger">{message}</AdminActionBanner> : null}
        <AdminActionBanner tone={critical ? 'danger' : warning ? 'warning' : 'success'} action={<button type="button" onClick={() => void load()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-current/20 px-3 text-sm font-semibold"><RefreshCw className={adminClassNames('h-4 w-4', loading && 'animate-spin')} />刷新</button>}>
          {loading ? '正在读取支付状态…' : critical ? '支付链路存在需要处理的事项。' : warning ? '支付链路基本可用，但有事项需要关注。' : '近 24 小时支付链路运行正常。'}
        </AdminActionBanner>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard metric={{ label: '近 24 小时订单', value: String(data?.orders.total ?? 0), hint: `已完成 ${data?.orders.fulfilled ?? 0} 笔`, tone: 'blue' }} icon={CreditCard} />
          <AdminMetricCard metric={{ label: '支付成功', value: String(data?.payments.succeeded ?? 0), hint: `金额 ${formatMoney(data?.payments.succeededAmountCents ?? 0)}`, tone: 'green' }} icon={CheckCircle2} />
          <AdminMetricCard metric={{ label: '待复核支付', value: String(data?.payments.needsReview ?? 0), hint: '异常履约或状态不一致', tone: 'rose' }} icon={ShieldAlert} />
          <AdminMetricCard metric={{ label: '支付回调', value: String(data?.callbacks.total ?? 0), hint: `成功 ${data?.callbacks.successful ?? 0} 次`, tone: 'amber' }} icon={RefreshCw} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <AdminPanel title="异常与处理建议" action={<span className="text-xs text-slate-500">{data ? `检查于 ${formatTime(data.checkedAt)}` : '等待数据'}</span>}>
            <div className="divide-y divide-slate-100">
              {(data?.alerts ?? []).map((alert) => (
                <div key={alert.code} className="flex items-start gap-3 px-5 py-4">
                  <span className={adminClassNames('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', alert.severity === 'critical' ? 'bg-rose-50 text-rose-600' : alert.severity === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600')}>
                    {alert.severity === 'info' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-800">{alert.message}</span><AdminStatusBadge status={alert.severity === 'critical' ? '失败' : alert.severity === 'warning' ? '处理中' : '正常'} /></div><p className="mt-1 text-sm text-slate-500">{alert.code === 'payments_need_review' ? '先核对订单、支付平台状态和履约记录，再决定是否补发权益。' : alert.code === 'callback_not_seen' ? '可先等待回调；若订单已在支付平台完成，使用订单页的状态核对流程。' : alert.message}</p></div>
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
              <div className="border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">状态检查只读取近 24 小时聚合数据，不会发起订单、扣款或修改支付状态。</div>
            </div>
          </AdminPanel>
        </div>

        <AdminPanel title="状态分布">
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['待支付', data?.payments.pending ?? 0],
              ['创建中', data?.payments.creating ?? 0],
              ['结果未知', data?.payments.createUnknown ?? 0],
              ['失败/关闭', (data?.payments.failed ?? 0) + (data?.payments.closed ?? 0)]
            ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div></div>)}
          </div>
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
