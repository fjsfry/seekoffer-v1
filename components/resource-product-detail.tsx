'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards
} from 'lucide-react';
import { ResourceProductArt } from '@/components/resource-product-art';
import { SiteShell } from '@/components/site-shell';
import { formatCny, resourceProductSeed, type ResourceProductSeed } from '@/lib/resource-products';
import {
  createResourceOrder,
  createResourcePayment,
  readResourceOrder,
  readResourceOrderAccess,
  readResourceProduct,
  saveResourceOrderAccess,
  simulateResourcePayment,
  type ResourceOrder,
  type ResourceProduct,
  ResourceCommerceError
} from '@/lib/resource-commerce-client';

function seedAsProduct(seed: ResourceProductSeed): ResourceProduct {
  return {
    id: seed.slug,
    slug: seed.slug,
    title: seed.title,
    summary: seed.summary,
    description: seed.description,
    coverUrl: null,
    amountCents: seed.amountCents,
    currency: 'CNY',
    version: 1,
    features: seed.features,
    files: [],
    fileCount: 0
  };
}

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

function accent(seed: ResourceProductSeed) {
  return {
    emerald: { panel: 'from-emerald-100 via-white to-white', icon: 'bg-emerald-50 text-brand', chip: 'bg-emerald-50 text-brand' },
    sky: { panel: 'from-sky-100 via-white to-white', icon: 'bg-sky-50 text-sky-600', chip: 'bg-sky-50 text-sky-700' },
    cyan: { panel: 'from-cyan-100 via-white to-white', icon: 'bg-cyan-50 text-cyan-600', chip: 'bg-cyan-50 text-cyan-700' }
  }[seed.accent];
}

export function ResourceProductDetail({ slug }: { slug: string }) {
  const router = useRouter();
  const seed = resourceProductSeed(slug);
  const styles = accent(seed);
  const pricePending = seed.priceStatus === 'pending';
  const [product, setProduct] = useState<ResourceProduct>(() => seedAsProduct(seed));
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogNotice, setCatalogNotice] = useState('');
  const [contactValue, setContactValue] = useState('');
  const [payMethod, setPayMethod] = useState<'wx' | 'alipay'>('wx');
  const [order, setOrder] = useState<ResourceOrder | null>(null);
  const [accessToken, setAccessToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    setCatalogLoading(true);
    void readResourceProduct(slug)
      .then(result => {
        if (!active) return;
        setProduct(result.product);
        setCatalogNotice('');
      })
      .catch(() => {
        if (active) setCatalogNotice('商品信息暂时无法更新，下面展示的是已发布的商品内容。');
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

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
    if (busy || pricePending) return;
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
    <section id="checkout" className="mt-7 rounded-[30px] border border-slate-100 bg-white p-5 shadow-soft lg:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">READY TO START</div>
          <h2 className="mt-2 text-xl font-semibold text-ink">{pricePending ? '即将上线' : '立即获取'}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{pricePending ? '资料包上线后，可直接在 Seekoffer 内完成支付和下载。' : '支付、订单和资源交付都在 Seekoffer 内完成。'}</p>
        </div>
        <WalletCards className="h-6 w-6 text-brand" />
      </div>

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
            <input value={contactValue} onChange={event => setContactValue(event.target.value)} type="email" required placeholder="you@example.com" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand/40 focus:ring-4 focus:ring-brand/10" />
            <span className="mt-2 block text-xs leading-5 text-slate-400">用于接收订单通知和售后联系，购买过程在 Seekoffer 内完成。</span>
          </label>
          <fieldset>
            <legend className="text-sm font-semibold text-slate-700">支付方式</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {([['wx', '微信支付'], ['alipay', '支付宝']] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setPayMethod(value)} className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${payMethod === value ? 'border-brand bg-brand/5 text-brand ring-2 ring-brand/10' : 'border-slate-200 bg-white text-slate-600 hover:border-brand/30'}`}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-start gap-2 text-xs leading-5 text-slate-500">
            <input type="checkbox" required className="mt-1 accent-brand" />
            <span>我已了解数字资料的使用范围，并同意订单信息用于支付确认和资源交付。</span>
          </label>
          <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3.5 text-sm font-semibold text-white shadow-float transition hover:-translate-y-0.5 hover:bg-brand-deep disabled:cursor-wait disabled:opacity-60">
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
              <img src={order.payment.payQrcodeUrl} alt="简付微信支付二维码" width={260} height={260} className="mx-auto mt-4 h-[260px] w-[260px] rounded-xl border border-slate-100 bg-white p-2" />
              <p className="mt-3 text-xs leading-5 text-slate-500">请使用微信扫一扫完成付款，付款后回到本页刷新订单状态。</p>
            </div>
          ) : null}
          {order?.payment?.payUrl && !localPayment ? <a href={order.payment.payUrl} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3.5 text-sm font-semibold text-white shadow-float transition hover:bg-brand-deep">打开简付收银台 <ChevronRight className="h-4 w-4" /></a> : null}
          {order?.status === 'pending' && order.payment?.status === 'failed' ? <button type="button" disabled={busy} onClick={() => void retryPayment()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3.5 text-sm font-semibold text-white shadow-float transition hover:bg-brand-deep disabled:opacity-60">重新生成支付二维码 <RefreshCw className="h-4 w-4" /></button> : null}
          {order?.status === 'expired' ? <Link href={`/resources/${slug}#checkout`} className="inline-flex w-full items-center justify-center rounded-2xl bg-brand px-4 py-3.5 text-sm font-semibold text-white shadow-float transition hover:bg-brand-deep">返回资料中心重新下单</Link> : null}
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

  return (
    <SiteShell>
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
        <Link href="/resources" className="font-semibold text-brand transition hover:text-brand-deep">资源库</Link>
        <ChevronRight className="h-4 w-4" />
        <span>申请资料中心</span>
        <ChevronRight className="h-4 w-4" />
        <span className="max-w-[14rem] truncate text-slate-500">{product.title}</span>
      </div>

      <section className={`overflow-hidden rounded-[38px] bg-gradient-to-br ${styles.panel} shadow-soft`}>
        <div className="grid lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)]">
          <div className="p-5 sm:p-7 lg:p-10">
            <Link href="/resources" className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-brand-deep">
              <ArrowLeft className="h-4 w-4" />
              返回申请资料中心
            </Link>
            <div className="mt-7">
              <ResourceProductArt product={seed} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { icon: FileText, title: '数字资料', value: '支付后交付' },
                { icon: Clock3, title: `版本 V${product.version}`, value: '详情页可查' },
                { icon: Download, title: '订单下载', value: '购买记录可回访' }
              ].map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-white/90 bg-white/70 px-3 py-3">
                    <Icon className="h-4 w-4 text-brand" />
                    <div className="mt-2 text-xs font-semibold text-ink">{item.title}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{item.value}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-white/70 bg-white/70 p-5 backdrop-blur sm:p-7 lg:border-l lg:border-t-0 lg:p-10">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${styles.chip}`}>
              <Sparkles className="h-3.5 w-3.5" />
              {seed.categoryLabel}
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-ink md:text-5xl">{product.title}</h1>
            <p className="mt-4 text-base leading-8 text-slate-600">{product.summary}</p>

            <div className="mt-6 grid gap-2">
              {seed.audience.slice(0, 3).map(item => (
                <div key={item} className="flex items-start gap-2.5 text-sm leading-6 text-slate-600">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-brand" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-7 flex items-end justify-between gap-4 border-t border-slate-200/70 pt-6">
              <div>
                <div className="text-xs font-semibold text-slate-400">一次购买 · {seed.badge}</div>
                <div className="mt-1 text-4xl font-semibold tracking-tight text-brand">{pricePending ? '即将上线' : formatCny(product.amountCents)}</div>
              </div>
              <a href="#checkout" className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-float transition hover:bg-brand-deep">
                {pricePending ? '查看获取方式' : '立即获取'}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            {checkoutPanel}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-6">
          <section className="surface-card rounded-[34px] p-6 lg:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="eyebrow">WHY THIS KIT</span>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink md:text-3xl">这份资料解决什么问题</h2>
              </div>
              <Users className="h-6 w-6 text-brand" />
            </div>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">{product.description}</p>
            <div className="mt-7 grid gap-3 md:grid-cols-3">
              {seed.detailSections.map((section, index) => (
                <div key={section.title} className="rounded-3xl border border-slate-100 bg-slate-50/80 p-5">
                  <div className="text-xs font-bold tracking-[0.16em] text-brand">0{index + 1}</div>
                  <h3 className="mt-4 text-base font-semibold text-ink">{section.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{section.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-card rounded-[34px] p-6 lg:p-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <span className="eyebrow">WHAT YOU GET</span>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink md:text-3xl">购买后可以拿到什么</h2>
              </div>
              <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-brand sm:inline-flex">按清单交付</span>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {seed.includes.map((item, index) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/8 text-brand"><Check className="h-4 w-4" /></span>
                  <div>
                    <div className="text-sm font-semibold text-ink">{item}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">第 {index + 1} 项交付内容</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-card rounded-[34px] p-6 lg:p-8">
            <span className="eyebrow">HOW TO USE</span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink md:text-3xl">建议使用流程</h2>
            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {seed.steps.map(step => (
                <div key={step.label} className="relative rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${styles.icon} text-sm font-bold`}>{step.label}</div>
                  <h3 className="mt-5 text-base font-semibold text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{step.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-card rounded-[34px] p-6 lg:p-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <span className="eyebrow">DELIVERY</span>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink md:text-3xl">交付内容</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">{catalogLoading ? '加载中' : product.fileCount ? `${product.fileCount} 个文件` : '资料清单'}</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-500">支付确认后解锁下载权限，文件名称和版本信息会在订单交付页显示。</p>
            <div className="mt-5 space-y-3">
              {product.files.length ? product.files.map(file => (
                <div key={file.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-4">
                  <FileText className="h-5 w-5 text-brand" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{file.filename}</span>
                  <span className="text-xs text-slate-400">{file.deliveryType === 'external_link' ? '支付后打开网盘' : '支付后下载'}</span>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-sm leading-7 text-slate-500">资料清单将在商品上线后展示。</div>
              )}
            </div>
          </section>

          <section className="surface-card rounded-[34px] p-6 lg:p-8">
            <span className="eyebrow">FAQ</span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink md:text-3xl">常见问题</h2>
            <div className="mt-6 divide-y divide-slate-100 rounded-3xl border border-slate-100 bg-white px-5">
              {seed.faq.map(item => (
                <details key={item.question} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-5">
          <div className="surface-card rounded-[30px] p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/8 text-brand"><ShieldCheck className="h-5 w-5" /></span>
              <h2 className="text-lg font-semibold text-ink">购买须知</h2>
            </div>
            <div className="mt-5 grid gap-4">
              {[
                ['数字资料', '支付确认后按订单解锁下载'],
                ['一次购买', '同一订单可从购买记录继续访问'],
                ['订单可查', '订单号可用于查询购买记录和售后进度'],
                ['按需使用', '请结合目标项目要求修改材料']
              ].map(([title, description]) => (
                <div key={title} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <div>
                    <div className="text-sm font-semibold text-ink">{title}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] bg-brand p-6 text-white shadow-float">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/65">MORE APPLICATION KITS</div>
            <h2 className="mt-3 text-xl font-semibold">还在准备其他材料？</h2>
            <p className="mt-3 text-sm leading-6 text-white/75">回到申请资料中心，按材料类型继续选择。</p>
            <Link href="/resources#application-products" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-brand transition hover:bg-brand-cream">
              浏览全部资料
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </aside>
      </section>
    </SiteShell>
  );
}
