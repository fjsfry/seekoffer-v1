'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, FileText, LoaderCircle, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { SiteShell } from '@/components/site-shell';
import { createResourcePayment, downloadResourceFile, readResourceOrder, readResourceOrderAccess, simulateResourcePayment, type ResourceOrder, ResourceCommerceError } from '@/lib/resource-commerce-client';
import { formatCny } from '@/lib/resource-products';

function readableError(error: unknown) {
  if (error instanceof ResourceCommerceError && error.code === 'RESOURCE_API_NOT_CONFIGURED') return '订单暂时无法更新，请稍后再试。';
  if (error instanceof ResourceCommerceError && error.code === 'RESOURCE_ORDER_NOT_FOUND') return '订单入口已失效或已过期，请从购买记录重新进入。';
  if (error instanceof ResourceCommerceError && error.code === 'RESOURCE_ORDER_NOT_PAYABLE') return '这笔订单已过期，请返回资料中心重新下单。';
  if (error instanceof ResourceCommerceError && error.code === 'PAYMENT_PROVIDER_REJECTED') return '支付服务暂时拒绝了请求，请稍后重新生成支付二维码。';
  if (error instanceof ResourceCommerceError && error.code === 'CHECKOUT_OUTCOME_UNCERTAIN') return '支付请求正在确认，请刷新订单状态后再继续。';
  return '暂时无法更新订单状态，请稍后刷新。';
}

function OrderSuccessContent() {
  const params = useSearchParams();
  const orderNo = params.get('order') || '';
  const isLocal = params.get('payment') === 'local';
  const access = useMemo(() => (orderNo ? readResourceOrderAccess(orderNo) : null), [orderNo]);
  const [order, setOrder] = useState<ResourceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deliveryUrl, setDeliveryUrl] = useState('');
  const autoOpenedDeliveryRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!orderNo || !access) {
      setLoading(false);
      return;
    }
    try {
      const result = await readResourceOrder(orderNo, access.accessToken);
      setOrder(result);
      setError('');
    } catch (refreshError) {
      setError(readableError(refreshError));
    } finally {
      setLoading(false);
    }
  }, [access, orderNo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!order || !access || ['fulfilled', 'refunded', 'expired'].includes(order.status)) return;
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [access, order, refresh]);

  async function completeLocalPayment() {
    if (!order || !access || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await simulateResourcePayment(order.orderNo, access.accessToken);
      setOrder(result.order);
      setNotice('支付已确认，资源已经解锁。');
    } catch (paymentError) {
      setError(readableError(paymentError));
    } finally {
      setBusy(false);
    }
  }

  async function retryPayment() {
    if (!order || !access || busy) return;
    setBusy(true);
    setError('');
    try {
      const method = order.payment?.payMethod === 'alipay' ? 'alipay' : 'wx';
      const result = await createResourcePayment(order.orderNo, access.accessToken, method);
      setOrder(result.order);
      setNotice(result.order.payment?.payQrcodeUrl ? '请使用微信扫描下方二维码完成支付。' : '支付已重新准备好，请继续完成支付。');
    } catch (paymentError) {
      setError(readableError(paymentError));
    } finally {
      setBusy(false);
    }
  }

  const download = useCallback(async (file: { id: string; filename: string }) => {
    if (!access || downloading) return;
    setDownloading(file.id);
    setError('');
    try {
      const delivery = await downloadResourceFile(file.id, access.accessToken);
      if (delivery.kind === 'external_link') {
        setDeliveryUrl(delivery.url);
        const opened = window.open(delivery.url, '_blank', 'noopener,noreferrer');
        if (!opened) {
          setNotice('浏览器未允许新窗口，正在当前页面打开资料链接。');
          window.location.assign(delivery.url);
        } else {
          setNotice('资料链接已自动打开，按页面提示获取“寻鹿保研资料包”。');
        }
      } else {
        const url = URL.createObjectURL(delivery.blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      }
    } catch (downloadError) {
      setError(readableError(downloadError));
    } finally {
      setDownloading('');
    }
  }, [access, downloading]);

  useEffect(() => {
    autoOpenedDeliveryRef.current = false;
    setDeliveryUrl('');
  }, [orderNo]);

  useEffect(() => {
    if (!order || order.status !== 'fulfilled' || !access || autoOpenedDeliveryRef.current) return;
    const file = order.delivery?.files.find(item => item.deliveryType === 'external_link');
    if (!file) return;
    autoOpenedDeliveryRef.current = true;
    void download(file);
  }, [access, download, order]);

  const fulfilled = order?.status === 'fulfilled';
  const expired = order?.status === 'expired';
  const pageTitle = fulfilled ? '资源已解锁' : expired ? '订单已过期' : '正在确认订单';
  const pageDescription = fulfilled
    ? '支付确认已经完成，下面可以直接下载已购买的资源。'
    : expired
      ? '这笔订单已经失效，请返回资料中心重新下单。'
      : '正在确认支付结果，页面会自动更新。';

  return (
    <SiteShell>
      <section className="page-hero px-6 py-8 lg:px-10">
        <div className="mx-auto w-full max-w-4xl text-center">
          <span className={`mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl ${fulfilled ? 'bg-emerald-50 text-brand' : expired ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
            {fulfilled ? <CheckCircle2 className="h-7 w-7" /> : expired ? <TriangleAlert className="h-7 w-7" /> : <LoaderCircle className="h-7 w-7 animate-spin" />}
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-ink md:text-4xl">{pageTitle}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600">{pageDescription}</p>
          {orderNo ? <div className="mt-4 font-mono text-xs text-slate-400">订单：{orderNo}</div> : null}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="surface-card rounded-[34px] p-6 lg:p-8">
          {loading ? <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">正在确认订单…</div> : null}
          {!loading && !access ? (
            <div className="rounded-2xl bg-amber-50 px-4 py-6 text-center text-sm leading-7 text-amber-800"><TriangleAlert className="mx-auto h-5 w-5" /><p className="mt-2">暂时找不到这笔订单，请从购买记录重新进入。</p><Link href="/resources/purchases" className="mt-3 inline-flex font-semibold underline underline-offset-4">打开购买记录</Link></div>
          ) : null}
          {error ? <div className="mb-5 rounded-2xl bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700" role="alert">{error}</div> : null}
          {notice ? <div className="mb-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800" role="status">{notice}</div> : null}
          {order ? (
            <>
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-400">购买商品</div>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">{order.title}</h2>
                </div>
                <div className="text-left sm:text-right"><div className="text-xs text-slate-400">订单金额</div><div className="mt-1 text-2xl font-semibold text-brand">{formatCny(order.amountCents)}</div></div>
              </div>
              {fulfilled ? (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-brand"><ShieldCheck className="h-4 w-4" />这笔订单已解锁购买权益</div>
                  {deliveryUrl ? <a href={deliveryUrl} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-float transition hover:bg-brand-deep"><Download className="h-4 w-4" />再次打开资料链接</a> : null}
                  {order.delivery?.files.map(file => <div key={file.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-4"><FileText className="h-5 w-5 text-brand" /><span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{file.filename}</span><button type="button" disabled={Boolean(downloading)} onClick={() => void download(file)} className="inline-flex items-center gap-2 rounded-xl bg-brand/8 px-3 py-2 text-xs font-semibold text-brand transition hover:bg-brand hover:text-white disabled:opacity-50"><Download className="h-4 w-4" />{downloading === file.id ? '准备中' : file.deliveryType === 'external_link' ? '打开网盘' : '下载'}</button></div>)}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-600">当前状态：<strong className="text-ink">{order.payment?.status === 'pending' ? '等待支付' : order.status === 'expired' ? '已过期' : order.status}</strong>。{expired ? '请返回资料中心重新下单。' : '支付完成后请回到此页，页面会自动更新。'}</div>
              )}
              {!fulfilled && order.payment?.payQrcodeUrl && order.payment.status === 'pending' ? (
                <div className="mt-6 rounded-2xl border border-brand/15 bg-white p-4 text-center">
                  <div className="text-sm font-semibold text-ink">微信扫码支付</div>
                  <img src={order.payment.payQrcodeUrl} alt="简付微信支付二维码" width={260} height={260} className="mx-auto mt-4 h-[260px] w-[260px] rounded-xl border border-slate-100 bg-white p-2" />
                  <p className="mt-3 text-xs leading-5 text-slate-500">请使用微信扫一扫完成付款，付款后回到本页刷新订单状态。</p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <aside className="surface-card h-fit rounded-[30px] p-6">
          <h2 className="text-lg font-semibold text-ink">订单操作</h2>
          <div className="mt-4 space-y-3">
            {isLocal && order && !fulfilled ? <button type="button" disabled={busy} onClick={() => void completeLocalPayment()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-float transition hover:bg-brand-deep disabled:opacity-60">{busy ? '确认中…' : '确认支付'} <CheckCircle2 className="h-4 w-4" /></button> : null}
            {order && !fulfilled && order.status === 'pending' && order.payment?.status === 'failed' ? <button type="button" disabled={busy} onClick={() => void retryPayment()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-float transition hover:bg-brand-deep disabled:opacity-60">重新生成支付二维码 <RefreshCw className="h-4 w-4" /></button> : null}
            {order && !fulfilled && order.status === 'expired' ? <Link href={order.productSlug ? `/resources/${encodeURIComponent(order.productSlug)}#checkout` : '/resources'} className="inline-flex w-full items-center justify-center rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-float transition hover:bg-brand-deep">返回资料中心重新下单</Link> : null}
            <button type="button" onClick={() => void refresh()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"><RefreshCw className="h-4 w-4" />刷新订单状态</button>
            <Link href="/resources/purchases" className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand">查看购买记录</Link>
            <Link href="/resources" className="inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-brand">返回资源库</Link>
          </div>
          <p className="mt-5 border-t border-slate-100 pt-5 text-xs leading-5 text-slate-500">支付完成后，系统会自动确认订单并解锁文件。</p>
        </aside>
      </section>
    </SiteShell>
  );
}

export default function ResourceOrderSuccessPage() {
  return <Suspense fallback={<SiteShell><main className="surface-card rounded-[34px] p-8 text-center text-sm text-slate-500">正在加载订单…</main></SiteShell>}><OrderSuccessContent /></Suspense>;
}
