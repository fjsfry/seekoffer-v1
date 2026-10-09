'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CheckCircle2, ChevronRight, LockKeyhole, RefreshCw, X } from 'lucide-react';
import { formatCny } from '@/lib/resource-products';
import { createResourceOrder, createResourcePayment, readResourceOrder, readResourceOrderAccess,
  saveResourceOrderAccess, simulateResourcePayment, type ResourceOrder, type ResourceProduct, ResourceCommerceError } from '@/lib/resource-commerce-client';
import s from './product.module.css';
function readableError(error: unknown) {
  if (!(error instanceof ResourceCommerceError)) return '当前暂时无法完成操作，请稍后再试。';
  const messages: Record<string, string> = {
    RESOURCE_API_NOT_CONFIGURED: '支付暂时无法继续，请稍后再试。',
    PAYMENT_CONFIGURATION_PENDING: '当前暂时无法完成支付，请稍后再试。',
    CHECKOUT_OUTCOME_UNCERTAIN: '支付结果正在确认，请稍后刷新订单状态，避免重复支付。',
    RESOURCE_ORDER_NOT_PAYABLE: '该订单已经过期或已完成，请重新创建订单。',
    ORDER_CONSENT_REQUIRED: '请确认你已阅读资源使用说明。',
    INVALID_CONTACT: '请输入有效的邮箱地址。',
    NEW_PURCHASES_DISABLED: '当前暂时无法购买，已有订单不受影响。'
  };
  return messages[error.code || ''] || '订单操作没有完成，请稍后再试。';
}


export default function ProductCheckout({ product, pricePending, catalogLoading, catalogNotice, open, onOpenChange, returnFocus }: {
  product: ResourceProduct; pricePending: boolean; catalogLoading: boolean; catalogNotice: string;
  open: boolean; onOpenChange: (value: boolean) => void; returnFocus: HTMLElement | null;
}) {
  const router = useRouter();
  const [contactValue, setContactValue] = useState('');
  const [payMethod, setPayMethod] = useState<'wx' | 'alipay'>('wx');
  const [order, setOrder] = useState<ResourceOrder | null>(null);
  const [accessToken, setAccessToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refreshOrder = useCallback(async () => {
    if (!order || !accessToken) return;
    try {
      const next = await readResourceOrder(order.orderNo, accessToken);
      setOrder(next);
      if (next.status === 'fulfilled') setNotice('支付已确认，资源已经解锁。');
    } catch (refreshError) {
      setError(readableError(refreshError));
    }
  }, [accessToken, order]);

  useEffect(() => {
    if (!order || !accessToken || ['fulfilled', 'refunded', 'expired'].includes(order.status)) return;
    const timer = window.setInterval(() => void refreshOrder(), 5000);
    return () => window.clearInterval(timer);
  }, [accessToken, order, refreshOrder]);

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || pricePending || catalogLoading || catalogNotice) return;
    setBusy(true);
    setError('');
    setNotice('正在创建订单…');
    try {
      const created = await createResourceOrder({ productSlug: product.slug, contactValue: contactValue.trim() });
      saveResourceOrderAccess(created.order.orderNo, created.accessToken);
      setAccessToken(created.accessToken);
      setOrder(created.order);
      setNotice('订单已创建，正在准备支付…');
      const paid = await createResourcePayment(created.order.orderNo, created.accessToken, payMethod);
      setOrder(paid.order);
      const payUrl = paid.order.payment?.payUrl;
      if (paid.order.payment?.payQrcodeUrl) {
        setNotice('请使用微信扫描下方二维码完成支付。');
      } else if (payUrl?.startsWith('/')) {
        setNotice('支付已准备好，请继续完成支付。');
      } else if (payUrl) {
        const opened = window.open(payUrl, '_blank', 'noopener,noreferrer');
        setNotice(opened ? '简付收银台已打开，完成支付后回到此页即可。' : '浏览器拦截了支付窗口，请点击下方按钮继续。');
      } else {
        setNotice('支付单已创建，等待支付状态确认。');
      }
    } catch (checkoutError) {
      setError(readableError(checkoutError));
      setNotice('');
    } finally {
      setBusy(false);
    }
  }

  async function simulatePayment() {
    if (!order || !accessToken || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await simulateResourcePayment(order.orderNo, accessToken);
      setOrder(result.order);
      setNotice('支付已完成，正在打开资源交付页。');
      router.push(`/resources/order-success?order=${encodeURIComponent(order.orderNo)}&payment=local`);
    } catch (paymentError) {
      setError(readableError(paymentError));
    } finally {
      setBusy(false);
    }
  }

  async function retryPayment() {
    if (!order || !accessToken || busy) return;
    setBusy(true);
    setError('');
    try {
      const method = order.payment?.payMethod === 'alipay' ? 'alipay' : 'wx';
      const result = await createResourcePayment(order.orderNo, accessToken, method);
      setOrder(result.order);
      setNotice(result.order.payment?.payQrcodeUrl ? '请使用微信扫描下方二维码完成支付。' : '支付已重新准备好，请继续完成支付。');
    } catch (paymentError) {
      setError(readableError(paymentError));
    } finally {
      setBusy(false);
    }
  }

  const localPayment = Boolean(order?.payment?.payUrl?.startsWith('/'));
  const hasOrder = Boolean(order && accessToken);
  const currentAccess = useMemo(() => (order ? readResourceOrderAccess(order.orderNo) : null), [order]);
  const orderStatus = order?.status === 'fulfilled' ? '已完成' : order?.status === 'expired' ? '已过期' : order?.payment?.status === 'pending' ? '等待支付' : '处理中';

  const checkoutPanel = (
    <section className={s.checkoutBody}>
      {catalogNotice ? <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800" role="status">{catalogNotice}</div> : null}
      {error ? <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700" role="alert">{error}</div> : null}
      {notice ? <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800" role="status">{notice}</div> : null}

      {!hasOrder ? (
        pricePending ? (
          <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
            商品价格和正式文件清单确认后，这里会开启站内支付与下载交付。
          </div>
        ) : (
        <form className="mt-6 space-y-4" onSubmit={submitCheckout}>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">接收订单的邮箱</span>
            <input value={contactValue} onChange={event => setContactValue(event.target.value)} type="email" autoComplete="email" required placeholder="you@example.com" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand/40 focus:ring-4 focus:ring-brand/10" />
            <span className="mt-2 block text-xs leading-5 text-slate-400">用于接收订单通知和售后联系，购买过程在 Seekoffer 内完成。</span>
          </label>
          <fieldset>
            <legend className="text-sm font-semibold text-slate-700">支付方式</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {([['wx', '微信支付'], ['alipay', '支付宝']] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={payMethod === value} onClick={() => setPayMethod(value)} className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${payMethod === value ? 'border-brand bg-brand/5 text-brand ring-2 ring-brand/10' : 'border-slate-200 bg-white text-slate-600 hover:border-brand/30'}`}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-start gap-2 text-xs leading-5 text-slate-500">
            <input type="checkbox" required className="mt-1 accent-brand" />
            <span>我已了解数字资料的使用范围，并同意订单信息用于支付确认和资源交付。</span>
          </label>
          <button type="submit" disabled={busy || catalogLoading || Boolean(catalogNotice)} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3.5 text-sm font-semibold text-white shadow-float transition hover:-translate-y-0.5 hover:bg-brand-deep disabled:cursor-wait disabled:opacity-60">
            {busy ? '正在准备订单…' : `购买并继续 · ${formatCny(product.amountCents)}`}
            <ChevronRight className="h-4 w-4" />
          </button>
        </form>
        )
      ) : (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">订单编号</span><span className="font-mono font-semibold text-ink">{order?.orderNo}</span></div>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">当前状态</span><span className="font-semibold text-brand">{orderStatus}</span></div>
          </div>
          {order?.payment?.payQrcodeUrl && order.payment.status === 'pending' ? (
            <div className="rounded-2xl border border-brand/15 bg-white p-4 text-center">
              <div className="text-sm font-semibold text-ink">微信扫码支付</div>
              <Image src={order.payment.payQrcodeUrl} alt="简付微信支付二维码" width={260} height={260} className="mx-auto mt-4 h-[260px] w-[260px] rounded-xl border border-slate-100 bg-white p-2" />
              <p className="mt-3 text-xs leading-5 text-slate-500">请使用微信扫一扫完成付款，付款后回到本页刷新订单状态。</p>
            </div>
          ) : null}
          {order?.payment?.payUrl && !localPayment ? <a href={order.payment.payUrl} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3.5 text-sm font-semibold text-white shadow-float transition hover:bg-brand-deep">打开简付收银台 <ChevronRight className="h-4 w-4" /></a> : null}
          {order?.status === 'pending' && order.payment?.status === 'failed' ? <button type="button" disabled={busy} onClick={() => void retryPayment()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3.5 text-sm font-semibold text-white shadow-float transition hover:bg-brand-deep disabled:opacity-60">重新生成支付二维码 <RefreshCw className="h-4 w-4" /></button> : null}
          {order?.status === 'expired' ? <button type="button" onClick={() => { setOrder(null); setAccessToken(''); setError(''); setNotice(''); }} className="inline-flex w-full items-center justify-center rounded-2xl bg-brand px-4 py-3.5 text-sm font-semibold text-white shadow-float transition hover:bg-brand-deep">重新下单</button> : null}
          {localPayment ? <button type="button" disabled={busy} onClick={() => void simulatePayment()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3.5 text-sm font-semibold text-white shadow-float transition hover:bg-brand-deep disabled:opacity-60">确认支付 <CheckCircle2 className="h-4 w-4" /></button> : null}
          <button type="button" disabled={busy} onClick={() => void refreshOrder()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand disabled:opacity-60"><RefreshCw className="h-4 w-4" />刷新订单状态</button>
          <Link href={`/resources/order-success?order=${encodeURIComponent(order?.orderNo || '')}`} className="inline-flex w-full items-center justify-center gap-2 text-sm font-semibold text-brand">打开订单交付页 <ChevronRight className="h-4 w-4" /></Link>
          {currentAccess ? <p className="text-center text-xs leading-5 text-slate-400">购买记录中会保留这笔订单入口。</p> : null}
        </div>
      )}

      <div className="mt-6 flex items-start gap-3 border-t border-slate-100 pt-5 text-xs leading-5 text-slate-500">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        支付完成后，系统会自动核对订单并解锁资源。
      </div>
    </section>
  );


  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className={s.checkoutOverlay} />
      <Dialog.Content className={s.checkoutDialog} onCloseAutoFocus={event => { event.preventDefault(); returnFocus?.focus(); }}>
        <Dialog.Close className={s.checkoutClose} aria-label="关闭购买窗口"><X size={21} /></Dialog.Close>
        <div className={s.checkoutHeading}>
          <Dialog.Title>确认购买</Dialog.Title>
          <Dialog.Description>填写接收订单的邮箱，支付确认后即可在订单页获取资料。</Dialog.Description>
        </div>
        <div className={s.checkoutProduct}>
          <Image src="/resources/application-kit/main-01-thumb.webp" alt="" width={58} height={58} />
          <div><strong>{product.title}</strong><span>电子版 · 一次购买 · {formatCny(product.amountCents)}</span></div>
        </div>
        {checkoutPanel}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
