'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SiteShell } from '@/components/site-shell';
import { useProCatalog } from '@/hooks/use-pro-catalog';
import { useBillingResource } from '@/hooks/use-billing-resource';
import { billingOwnerKey, BillingApiError, createBillingOrder, fetchBillingOrder, formatBillingDate, formatPlanPrice, orderStatusLabel, type BillingProvider, type BillingOrder } from '@/lib/billing-api';
import { readCheckoutOperation, saveCheckoutOperation, clearCheckoutOperation, type CheckoutOperation } from '@/lib/pro-checkout-intent';
import { PageHead, ResourceState, SupportNote } from '@/components/pro/billing-ui';
import s from '@/components/pro/pro.module.css';

function PaymentResult({ order, refresh, available }: { order: BillingOrder; refresh: () => Promise<void>; available: boolean }) {
  const [qr, setQr] = useState('');
  const canPay = available && order.canPay && order.status === 'pending' && Boolean(order.expiresAt && Date.parse(order.expiresAt) > Date.now());
  useEffect(() => {
    let active = true;
    if (canPay && order.qrCode) void import('qrcode').then(qrcode => qrcode.toDataURL(order.qrCode!, { width: 240 })).then(value => { if (active) setQr(value); });
    return () => { active = false; };
  }, [canPay, order.qrCode]);
  const copy = order.status === 'fulfilled' ? '本订单的会员权益已发放，当前有效期请在“我的会员”查看。'
    : order.status === 'paid' || order.status === 'confirming' ? '请勿重复付款。你可以刷新确认进度，或携订单号联系支持。'
    : order.status === 'expired' ? '本订单已超过付款期限，请勿使用旧付款码。若已扣款，请刷新订单或联系支持。'
    : order.status === 'refunded' ? '这笔订单已退款，当前会员权益请在“我的会员”查看。'
    : !available ? '当前暂停购买。你仍可查看这笔订单；若已付款，请勿重复支付。'
    : '请核对订单金额与有效期，付款后等待订单确认。';
  return <div className={s.payState} aria-live="polite"><h2>{orderStatusLabel(order)}</h2><p className={s.muted}>{copy}</p>
    {order.status === 'fulfilled' && order.membershipExpiresAt ? <p>本次开通后的有效期：{formatBillingDate(order.membershipExpiresAt)}（北京时间）</p> : null}
    {canPay && order.checkoutUrl ? <a className={s.primary} href={order.checkoutUrl} target="_blank" rel="noopener noreferrer">前往支付平台</a> : null}
    {canPay && qr && !order.checkoutUrl ? <><Image className={s.qr} src={qr} alt="本订单的付款二维码" width={200} height={200} /><p className={s.small}>请在电脑显示二维码，使用手机支付应用扫码。请勿使用已经过期的二维码。</p></> : null}
    <div className={s.actions}><button className={s.secondary} onClick={() => void refresh()}>刷新订单状态</button><Link className={s.quiet} href="/me/membership/">我的会员 →</Link></div><p className={s.supportId}>订单号：{order.supportNumber}</p><SupportNote orderNumber={order.supportNumber} /></div>;
}
function CheckoutContent() {
  const query = useSearchParams(), router = useRouter(), catalog = useProCatalog();
  const orderId = query.get('order'), planId = query.get('plan');
  const detail = useBillingResource((ownerKey, signal) => orderId ? fetchBillingOrder(orderId, { ownerKey, signal }) : Promise.resolve(null), orderId ?? 'new');
  const [provider, setProvider] = useState<BillingProvider>('wechat');
  const [consentedVersion, setConsentedVersion] = useState('');
  const [pending, setPending] = useState(false), [message, setMessage] = useState('');
  const [operation, setOperation] = useState<{ owner: string; value: CheckoutOperation } | null>(null);
  const lock = useRef(false), refreshRef = useRef(detail.refresh); refreshRef.current = detail.refresh;
  const selected = catalog.data?.plans.find(p => p.id === planId);
  const order = detail.data, available = catalog.data?.saleState === 'available';
  const saved = operation?.owner === detail.ownerKey ? operation.value : null;
  const confirmVersion = selected && catalog.data ? JSON.stringify([selected.id, selected.price_cents, selected.duration_days, catalog.data.catalogVersion, catalog.data.termsVersion]) : '';
  useEffect(() => {
    if (!detail.ownerKey) return;
    const value = readCheckoutOperation(window.sessionStorage, detail.ownerKey);
    setOperation(value ? { owner: detail.ownerKey, value } : null);
    setProvider(value?.provider ?? 'wechat');
    setConsentedVersion('');
    setMessage(''); setPending(false);
  }, [detail.ownerKey]);
  useEffect(() => {
    if (!orderId || !detail.ownerKey) return;
    let timer: ReturnType<typeof setTimeout> | undefined, attempts = 0, stopped = false;
    const schedule = () => {
      if (stopped || document.hidden || attempts >= 12) return;
      timer = setTimeout(async () => { attempts++; await refreshRef.current(); schedule(); }, Math.min(30000, 5000 * (attempts + 1)));
    };
    const visibility = () => { clearTimeout(timer); if (!document.hidden) { void refreshRef.current(); schedule(); } };
    schedule(); document.addEventListener('visibilitychange', visibility);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', visibility); };
  }, [orderId, detail.ownerKey]);
  async function submit() {
    const owner = detail.ownerKey;
    if (lock.current || !owner || billingOwnerKey() !== owner || !selected || !catalog.data || !available || consentedVersion !== confirmVersion || !catalog.data.providers[provider].available) return;
    if (saved?.orderId) { router.replace('/checkout/?order=' + encodeURIComponent(saved.orderId)); return; }
    if (saved && (saved.planId !== selected.id || saved.catalogVersion !== catalog.data.catalogVersion || saved.provider !== provider)) { setMessage('你还有一笔结果待确认的操作，请先查看已有订单或联系支持。'); return; }
    lock.current = true; setPending(true); setMessage('');
    const op: CheckoutOperation = saved ?? { requestId: crypto.randomUUID(), planId: selected.id, provider, catalogVersion: catalog.data.catalogVersion, termsVersion: catalog.data.termsVersion, outcome: 'prepared' };
    let requestStarted = false;
    try {
      // Persist before the first request. If storage is unavailable, do not create a non-recoverable charge.
      saveCheckoutOperation(window.sessionStorage, owner, op); setOperation({ owner, value: op });
      requestStarted = true;
      const created = await createBillingOrder(op.planId, op.provider, { ownerKey: owner, requestId: op.requestId, catalogVersion: op.catalogVersion, termsVersion: op.termsVersion });
      if (billingOwnerKey() !== owner) return;
      const known = { ...op, orderId: created.id, outcome: 'known' as const };
      saveCheckoutOperation(window.sessionStorage, owner, known); setOperation({ owner, value: known });
      router.replace('/checkout/?order=' + encodeURIComponent(created.id));
    } catch (error) {
      if (billingOwnerKey() !== owner) return;
      if (!requestStarted) { setMessage('浏览器暂时无法保存订单恢复信息，请允许本站使用会话存储后重试。尚未发起订单。'); return; }
      if (error instanceof BillingApiError && ['CATALOG_CHANGED','PURCHASES_PAUSED','PAYMENT_CONFIGURATION_PENDING'].includes(error.code)) {
        clearCheckoutOperation(window.sessionStorage, owner); setOperation(null); setConsentedVersion(''); await catalog.refresh(); setMessage(error.message);
      } else {
        const unknown = { ...op, outcome: 'unknown' as const };
        try { saveCheckoutOperation(window.sessionStorage, owner, unknown); } catch { /* No additional payment request. */ }
        setOperation({ owner, value: unknown }); setMessage('订单结果正在确认，请勿重复付款。可恢复同一次操作，或在“我的订单”查看。');
      }
    } finally { lock.current = false; if (billingOwnerKey() === owner) setPending(false); }
  }
  const returnTo = '/checkout/?' + (orderId ? 'order=' + encodeURIComponent(orderId) : 'plan=' + encodeURIComponent(planId ?? ''));
  return <div className={s.page}><PageHead title={orderId ? '订单详情' : '确认 Pro 方案'} subtitle="一次性购买，不自动续费。付款确认与会员开通分别显示进度。" /><ResourceState resource={detail} noun="订单信息" returnTo={returnTo}>
    <div className={s.checkout}><section className={s.card}><h2>{order ? order.planName : selected?.name ?? '方案信息'}</h2>
      {order || selected ? <><div className={s.bill}><span>有效天数</span><strong>{order ? order.durationDays === null ? '历史记录未注明' : order.durationDays + ' 天' : selected?.duration_days + ' 天'}</strong></div><div className={s.bill}><span>商品范围</span><strong>网站 Pro</strong></div><div className={s.bill}><span>生效方式</span><strong>付款确认并完成开通后生效</strong></div><div className={s.bill + ' ' + s.total}><span>{order ? '订单金额' : '应付金额'}</span><strong>{formatPlanPrice(order?.amountCents ?? selected!.price_cents)}</strong></div>{order?.expiresAt ? <p className={s.small}>原付款期限：{formatBillingDate(order.expiresAt)}（北京时间）</p> : null}<p className={s.small}>本套餐不包含其他闪填产品或资料商品。已有会员的延长按订单生效时的有效期计算。</p></> : <p className={s.notice}>{catalog.state === 'loading' ? '正在读取方案…' : '所选方案暂不可用，请返回重新选择。'}</p>}
      <div className={s.actions}><Link className={s.quiet} href="/pro/#plans">← 返回方案</Link><Link className={s.quiet} href="/me/orders/">我的订单</Link><Link className={s.quiet} href="/pro/service/">服务说明</Link></div></section>
      <section className={s.card}>{order ? <PaymentResult order={order} refresh={detail.refresh} available={available} /> : <>
        <h2>核对与付款</h2>{catalog.state === 'error' ? <div className={s.notice}>方案读取失败。<button className={s.quiet} onClick={() => void catalog.refresh()}>重新读取</button></div> : !available ? <div className={s.notice}>暂时无法购买 Pro，你仍可使用现有功能。</div> : null}
        {saved?.orderId ? <div className={s.notice}>你已有一笔订单。<Link className={s.quiet} href={'/checkout/?order=' + encodeURIComponent(saved.orderId)}>恢复已有订单 →</Link></div> : null}
        <fieldset className={s.payOptions} disabled={!available || Boolean(saved)}><legend className={s.small}>支付方式</legend>{(['wechat','alipay'] as const).map(id => <label key={id}><input type="radio" name="payment-method" checked={provider === id} disabled={!catalog.data?.providers[id].available} onChange={() => setProvider(id)} />{id === 'wechat' ? '微信支付' : '支付宝'}{catalog.data?.providers[id].available ? '' : ' · 暂不可用'}</label>)}</fieldset>
        <label className={s.terms}><input type="checkbox" checked={Boolean(confirmVersion && consentedVersion === confirmVersion)} disabled={!available} onChange={event => setConsentedVersion(event.target.checked ? confirmVersion : '')} /><span>我已核对金额、有效期，并阅读<Link href="/pro/service/" target="_blank"> Pro 服务说明</Link>。</span></label>
        <button className={s.primary} disabled={!available || !selected || pending || consentedVersion !== confirmVersion || !catalog.data?.providers[provider].available || Boolean(saved?.orderId)} onClick={() => void submit()}>{!available ? '暂时无法购买' : pending ? '正在确认订单…' : saved?.outcome === 'unknown' ? '恢复同一次操作' : '确认方案并继续'}</button>
        {saved?.outcome === 'unknown' ? <p className={s.notice}>此前操作的结果尚未确认，请勿另行付款。支持编号：{saved.requestId}</p> : null}
        <p role="status" aria-live="polite" className={s.small}>{message}</p><div className={s.actions}><Link className={s.quiet} href="/me/">打开工作台</Link><Link className={s.quiet} href="/me/orders/">查看已有订单</Link></div><SupportNote />
      </>}</section></div>
  </ResourceState></div>;
}
export default function CheckoutPage() { return <SiteShell><Suspense fallback={<div className={s.skeleton}>正在读取订单…</div>}><CheckoutContent /></Suspense></SiteShell>; }
