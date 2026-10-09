'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, CheckCircle2, Download, FileText, LoaderCircle, ReceiptText, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { SiteShell } from '@/components/site-shell';
import { createResourcePayment, downloadResourceFile, readResourceOrder, readResourceOrderAccess, simulateResourcePayment, type ResourceOrder, ResourceCommerceError } from '@/lib/resource-commerce-client';
import { formatCny } from '@/lib/resource-products';
import { resourceDeliveryError } from '@/lib/resource-delivery';

function readableError(error: unknown) {
  if (error instanceof ResourceCommerceError && error.code === 'RESOURCE_ORDER_NOT_FOUND') return '订单入口已失效或已过期，请从购买记录重新进入。';
  if (error instanceof ResourceCommerceError && error.code === 'RESOURCE_ORDER_NOT_PAYABLE') return '这笔订单已过期，请返回资料中心重新下单。';
  if (error instanceof ResourceCommerceError && error.code === 'PAYMENT_PROVIDER_REJECTED') return '支付服务暂时拒绝了请求，请稍后重新生成支付二维码。';
  if (error instanceof ResourceCommerceError && error.code === 'CHECKOUT_OUTCOME_UNCERTAIN') return '支付请求正在确认，请刷新订单状态后再继续。';
  return '暂时无法更新订单状态，请稍后刷新。';
}

const primaryButton = 'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-deep disabled:opacity-60';
const secondaryButton = 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand disabled:opacity-60';

function OrderSuccessContent() {
  const params = useSearchParams();
  const orderNo = params.get('order') || '';
  const isLocal = params.get('payment') === 'local';
  const [access, setAccess] = useState<ReturnType<typeof readResourceOrderAccess>>(null);
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [order, setOrder] = useState<ResourceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState('');
  const [error, setError] = useState('');
  const [deliveryError, setDeliveryError] = useState('');
  const [notice, setNotice] = useState('');
  const [deliveryUrls, setDeliveryUrls] = useState<Record<string, string>>({});
  const refreshInFlight = useRef(false);
  const downloadInFlight = useRef(false);

  useEffect(() => {
    setAccess(orderNo ? readResourceOrderAccess(orderNo) : null);
    setAccessLoaded(true);
  }, [orderNo]);

  const refresh = useCallback(async () => {
    if (!accessLoaded || refreshInFlight.current) return;
    if (!orderNo || !access) { setLoading(false); return; }
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      const result = await readResourceOrder(orderNo, access.accessToken);
      setOrder(result);
      setError('');
      if (result.status !== 'fulfilled') setDeliveryUrls({});
    } catch (refreshError) {
      setError(readableError(refreshError));
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
      setLoading(false);
    }
  }, [access, accessLoaded, orderNo]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!order || !access || !['pending', 'paid'].includes(order.status)) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [access, order, refresh]);

  async function pay(local: boolean) {
    if (!order || !access || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = local
        ? await simulateResourcePayment(order.orderNo, access.accessToken)
        : await createResourcePayment(order.orderNo, access.accessToken, order.payment?.payMethod === 'alipay' ? 'alipay' : 'wx');
      setOrder(result.order);
    } catch (paymentError) {
      setError(readableError(paymentError));
    } finally { setBusy(false); }
  }

  async function download(file: { id: string; filename: string; deliveryType: string }) {
    if (!access || downloadInFlight.current) return;
    downloadInFlight.current = true;
    // Open during the user gesture; an asynchronous window.open may be blocked.
    const opened = file.deliveryType === 'external_link' ? window.open('about:blank', '_blank') : null;
    if (opened) opened.opener = null;
    setDownloading(file.id);
    setDeliveryError('');
    setNotice('');
    try {
      const delivery = await downloadResourceFile(file.id, access.accessToken);
      if (delivery.kind === 'external_link') {
        setDeliveryUrls(current => ({ ...current, [file.id]: delivery.url }));
        if (opened && !opened.closed) {
          opened.location.replace(delivery.url);
          setNotice('资料已在新窗口打开，你也可以随时从本页再次打开。');
        } else {
          setNotice('资料链接已准备好，请点击“打开网盘”继续。');
        }
      } else {
        opened?.close();
        const url = URL.createObjectURL(delivery.blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
        setNotice('文件下载已开始。');
      }
    } catch (downloadError) {
      opened?.close();
      setDeliveryError(resourceDeliveryError(downloadError));
    } finally {
      downloadInFlight.current = false;
      setDownloading('');
    }
  }

  const fulfilled = order?.status === 'fulfilled';
  const expired = order?.status === 'expired';
  const refunded = order?.status === 'refunded';
  const unavailable = !loading && !order;
  const terminal = expired || refunded || unavailable;
  const pageTitle = fulfilled ? '资源已解锁' : refunded ? '订单已退款' : expired ? '订单已过期' : unavailable ? '订单暂不可用' : '正在确认订单';
  const pageDescription = fulfilled ? '支付已完成，你可以随时打开或下载已购资料。'
    : refunded ? '这笔订单已退款，购买权益已结束。'
    : expired ? '这笔订单已经失效，请返回资料中心重新下单。'
    : unavailable ? '请刷新重试，或从购买记录重新进入。' : '正在确认支付结果，页面会自动更新。';

  return (
    <SiteShell>
      <section className="page-hero px-6 py-8 lg:px-10">
        <div className="mx-auto w-full max-w-4xl text-center">
          <span className={'mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl ' + (fulfilled ? 'bg-emerald-50 text-brand' : terminal ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500')}>
            {fulfilled ? <CheckCircle2 className="h-7 w-7" /> : terminal ? <TriangleAlert className="h-7 w-7" /> : <LoaderCircle className="h-7 w-7 animate-spin" />}
          </span>
          <h1 className="mt-5 text-3xl font-semibold text-ink md:text-4xl">{pageTitle}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600">{pageDescription}</p>
          {orderNo ? <div className="mt-4 break-all font-mono text-xs text-slate-500">订单：{orderNo}</div> : null}
        </div>
      </section>

      <section data-testid="order-content" className="grid w-full items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="surface-card min-w-0 rounded-[30px] p-5 sm:p-6 lg:p-8">
          {loading ? <div className="py-8 text-center text-sm text-slate-500" role="status">正在确认订单…</div> : null}
          {!loading && !access ? <div className="rounded-xl bg-amber-50 px-4 py-6 text-center text-sm leading-7 text-amber-800"><TriangleAlert className="mx-auto h-5 w-5" /><p className="mt-2">暂时找不到这笔订单，请从购买记录重新进入。</p><Link href="/resources/purchases" className="mt-3 inline-flex font-semibold underline underline-offset-4">打开购买记录</Link></div> : null}
          {error ? <div className="mb-5 rounded-xl bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700" role="alert">{error}</div> : null}
          {order ? <>
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0"><div className="text-xs font-semibold text-slate-500">购买商品</div><h2 className="mt-2 break-words text-xl font-semibold leading-8 text-ink sm:text-2xl">{order.title}</h2></div>
              <div className="shrink-0 text-left sm:text-right"><div className="text-xs text-slate-500">{fulfilled ? '实付金额' : '订单金额'}</div><div className="mt-1 text-2xl font-semibold tabular-nums text-brand">{formatCny(order.amountCents)}</div></div>
            </div>
            {fulfilled ? <div className="mt-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand"><ShieldCheck className="h-4 w-4 shrink-0" />这笔订单已解锁购买权益</div>
              <div className="mt-1 divide-y divide-slate-100">
                {order.delivery?.files.map(file => <div key={file.id} className="flex flex-wrap items-center gap-4 py-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-brand"><FileText className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1 basis-36"><h3 className="break-words text-sm font-semibold leading-6 text-ink">{file.filename}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{file.deliveryType === 'external_link' ? '百度网盘 · 已购资源' : '文件下载 · 已购资源'}</p></div>
                  {deliveryUrls[file.id]
                    ? <a href={deliveryUrls[file.id]} target="_blank" rel="noopener noreferrer" className={primaryButton}>打开网盘<ArrowUpRight className="h-4 w-4" /></a>
                    : <button type="button" disabled={Boolean(downloading)} aria-busy={downloading === file.id} onClick={() => void download(file)} className={primaryButton}>{downloading === file.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{downloading === file.id ? '准备中' : file.deliveryType === 'external_link' ? '打开网盘' : '下载文件'}</button>}
                </div>)}
              </div>
              {!order.delivery?.files.length ? <p className="py-5 text-sm leading-6 text-slate-600">资料正在准备，请稍后刷新。购买权益已保留。</p> : null}
              {deliveryError ? <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">{deliveryError}</div> : null}
              {notice ? <p role="status" className="mb-4 text-sm leading-6 text-brand">{notice}</p> : null}
              <p className="border-t border-slate-100 pt-4 text-xs leading-6 text-slate-500">购买记录将保留此资源入口，无需重复付款。</p>
            </div> : <div className="mt-6 text-sm leading-7 text-slate-600">{refunded ? '订单已退款。' : expired ? '订单已过期。' : '支付完成后请回到此页，页面会自动更新。'}</div>}
            {!terminal && !fulfilled && order.payment?.payQrcodeUrl && order.payment.status === 'pending' ? <div className="mt-6 border-t border-slate-100 pt-6 text-center">
              <div className="text-sm font-semibold text-ink">{order.payment.payMethod === 'alipay' ? '支付宝扫码支付' : '微信扫码支付'}</div>
              <img src={order.payment.payQrcodeUrl} alt="支付二维码" width={260} height={260} className="mx-auto mt-4 aspect-square h-auto w-full max-w-[260px] rounded-xl border border-slate-100 bg-white p-2" />
            </div> : null}
          </> : null}
        </div>

        <aside className="surface-card flex min-w-0 flex-col rounded-[30px] p-6">
          <h2 className="text-lg font-semibold text-ink">订单操作</h2>
          <div className="mb-6 mt-4 space-y-3">
            {isLocal && order?.status === 'pending' ? <button type="button" disabled={busy} onClick={() => void pay(true)} className={primaryButton + ' w-full'}><CheckCircle2 className="h-4 w-4" />{busy ? '确认中…' : '确认支付'}</button> : null}
            {order?.status === 'pending' && order.payment?.status === 'failed' ? <button type="button" disabled={busy} onClick={() => void pay(false)} className={primaryButton + ' w-full'}><RefreshCw className="h-4 w-4" />重新生成支付二维码</button> : null}
            {expired ? <Link href={order?.productSlug ? '/resources/' + encodeURIComponent(order.productSlug) + '#checkout' : '/resources'} className={primaryButton + ' w-full'}>返回资料中心重新下单</Link> : null}
            <button type="button" disabled={refreshing || !access} aria-busy={refreshing} onClick={() => void refresh()} className={secondaryButton}><RefreshCw className={'h-4 w-4 ' + (refreshing ? 'animate-spin' : '')} />{refreshing ? '正在刷新' : '刷新订单状态'}</button>
            <Link href="/resources/purchases" className={secondaryButton}><ReceiptText className="h-4 w-4" />查看购买记录</Link>
            <Link href="/resources" className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-brand"><ArrowLeft className="h-4 w-4" />返回资源库</Link>
          </div>
          <p className="mt-auto border-t border-slate-100 pt-5 text-xs leading-6 text-slate-500">{fulfilled ? '资源无法打开？可稍后重试，或通过页面右侧的反馈入口联系我们。' : '支付完成后，系统会自动确认订单并解锁文件。'}</p>
        </aside>
      </section>
    </SiteShell>
  );
}

function OrderRoute() {
  const params = useSearchParams();
  return <OrderSuccessContent key={params.get('order') || ''} />;
}

export default function ResourceOrderSuccessPage() {
  return <Suspense fallback={<SiteShell><div className="py-8 text-center text-sm text-slate-500">正在加载订单…</div></SiteShell>}><OrderRoute /></Suspense>;
}
