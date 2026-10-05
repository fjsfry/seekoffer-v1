'use client';

import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  CreditCard,
  Crown,
  Download,
  ExternalLink,
  FileCheck2,
  Infinity as InfinityIcon,
  LoaderCircle,
  LockKeyhole,
  MessageCircleQuestion,
  Puzzle,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Star
} from 'lucide-react';
import { SiteShell } from '@/components/site-shell';
import { useProEntitlement } from '@/hooks/use-pro-entitlement';
import { useUserSessionState } from '@/hooks/use-user-session';
import { openAuthModal, writeAuthIntent } from '@/lib/auth-intent';
import {
  BillingApiError,
  createBillingOrder,
  fetchBillingOrder,
  fetchBillingOrders,
  fetchBillingPlans,
  formatPlanPrice,
  type BillingOrder,
  type BillingPlan,
  type BillingProvider,
  type BillingProviderReadiness,
  type CreateBillingOrderResponse
} from '@/lib/billing-api';

const fallbackPlans: BillingPlan[] = [
  {
    id: 'pro_monthly',
    name: 'Pro 月度',
    description: '适合短期集中申请，完整使用填报助手与申请管理。',
    price_cents: 1900,
    currency: 'CNY',
    duration_days: 31,
    benefits: ['填报助手无限次发送', '无限申请项目跟进', '多节点截止提醒', '材料清单与进度管理'],
    sort_order: 10,
    is_recommended: false
  },
  {
    id: 'pro_quarter',
    name: 'Pro 季度',
    description: '覆盖夏令营与预推免高峰期，当前推荐方案。',
    price_cents: 4900,
    currency: 'CNY',
    duration_days: 93,
    benefits: ['填报助手无限次发送', '无限申请项目跟进', '7/3/1 天多节点提醒', '材料清单与进度管理', '优先适配新增报名网站'],
    sort_order: 20,
    is_recommended: true
  },
  {
    id: 'pro_yearly',
    name: 'Pro 年度',
    description: '适合跨阶段准备、申请与复盘的全年使用。',
    price_cents: 12900,
    currency: 'CNY',
    duration_days: 366,
    benefits: ['全年填报助手无限次发送', '全年无限申请项目', '多节点提醒与材料管理', '新增报名网站优先适配', 'Pro 新功能优先体验'],
    sort_order: 30,
    is_recommended: false
  }
];

const unavailableProviders: BillingProviderReadiness = {
  wechat: { available: false, label: '微信支付' },
  alipay: { available: false, label: '支付宝' }
};

const extensionDownloadHref = '/downloads/seekoffer-fill-assistant.zip';

const valueCards = [
  {
    icon: InfinityIcon,
    title: '填报助手不限次数',
    body: '免费版每月可发送 3 组字段；Pro 不限次数。识别、预览和未完成填入的重试不计次。'
  },
  {
    icon: FileCheck2,
    title: '无限申请项目',
    body: '免费版最多跟进 5 个项目；Pro 可持续管理夏令营、预推免和正式推免申请。'
  },
  {
    icon: ShieldCheck,
    title: '边界清楚的自动填入',
    body: '默认保护已有内容，不读取验证码，不点击提交，低置信和歧义字段交给你确认。'
  },
  {
    icon: Star,
    title: '新增网站优先适配',
    body: '遇到无法识别的报名系统，可提交页面结构和问题描述，Pro 用户会优先获得适配帮助。'
  }
] as const;

const sectionNavItems = [
  { href: '#account-benefits', label: '账户权益', icon: BadgeCheck },
  { href: '#install-extension', label: '插件助手', icon: Puzzle },
  { href: '#plans', label: '订阅方案', icon: CreditCard },
  { href: '#account-support', label: '订单支持', icon: MessageCircleQuestion }
] as const;

const comparisonRows = [
  ['申请项目', '最多 5 个', '不限数量'],
  ['填报字段发送', '每月 3 组', '不限次数'],
  ['报名页识别与预览', '包含', '包含'],
  ['已有内容保护与歧义停止', '包含', '包含'],
  ['新增网站适配优先级', '标准', '优先'],
  ['自动续费', '无', '无，一次性购买']
] as const;

function formatDateTime(value?: string | null) {
  if (!value) return '未开通';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未开通';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

function planPeriodLabel(plan: BillingPlan) {
  if (plan.duration_days >= 360) return '年';
  if (plan.duration_days >= 90) return '季';
  return '月';
}

function monthlyEquivalent(plan: BillingPlan) {
  const months = plan.duration_days / 30.5;
  return Math.round(plan.price_cents / Math.max(months, 1));
}

function orderStatusLabel(status: BillingOrder['status']) {
  const labels: Record<BillingOrder['status'], string> = {
    pending: '等待支付',
    paid: '已支付',
    failed: '创建失败',
    closed: '已关闭',
    refunded: '已退款',
    expired: '已过期'
  };
  return labels[status];
}

function orderStatusTone(status: BillingOrder['status']) {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700';
  if (status === 'pending') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

function availableProviderList(readiness: BillingProviderReadiness) {
  return (Object.entries(readiness) as Array<[BillingProvider, BillingProviderReadiness[BillingProvider]]>)
    .filter(([, item]) => item.available);
}

export default function ProPage() {
  const { loggedIn, isMember } = useUserSessionState();
  const entitlement = useProEntitlement();
  const entitlementRefreshRef = useRef(entitlement.refresh);
  entitlementRefreshRef.current = entitlement.refresh;
  const [plans, setPlans] = useState<BillingPlan[]>(fallbackPlans);
  const [providers, setProviders] = useState<BillingProviderReadiness>(unavailableProviders);
  const [selectedPlanId, setSelectedPlanId] = useState('pro_quarter');
  const [provider, setProvider] = useState<BillingProvider>('wechat');
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'info' | 'success' | 'warning'>('info');
  const [checkout, setCheckout] = useState<CreateBillingOrderResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [orders, setOrders] = useState<BillingOrder[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [extensionPrivacyAccepted, setExtensionPrivacyAccepted] = useState(false);

  useEffect(() => {
    let active = true;

    void fetchBillingPlans()
      .then((response) => {
        if (!active) return;
        if (response.plans.length) {
          setPlans(response.plans);
          const recommended = response.plans.find((plan) => plan.is_recommended) || response.plans[0];
          setSelectedPlanId(recommended.id);
        }
        setProviders(response.providers || unavailableProviders);
        const firstAvailable = availableProviderList(response.providers || unavailableProviders)[0]?.[0];
        if (firstAvailable) setProvider(firstAvailable);
      })
      .catch(() => {
        if (!active) return;
        setMessage('套餐信息暂时无法更新，请稍后再试。');
        setMessageTone('warning');
      })
      .finally(() => {
        if (active) setLoadingPlans(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isMember) {
      setOrders([]);
      return;
    }
    let active = true;
    void fetchBillingOrders()
      .then((items) => {
        if (active) setOrders(items);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isMember]);

  useEffect(() => {
    const codeUrl = checkout?.payment.codeUrl || '';
    if (!codeUrl) {
      setQrDataUrl('');
      return;
    }
    let active = true;
    void import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(codeUrl, {
        width: 360,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#123b35', light: '#ffffff' }
      }))
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (!active) return;
        setQrDataUrl('');
        setMessage('支付二维码暂时无法生成，请稍后再试。');
        setMessageTone('warning');
      });
    return () => {
      active = false;
    };
  }, [checkout?.payment.codeUrl]);

  useEffect(() => {
    const orderId = checkout?.order.id;
    const status = checkout?.order.status;
    if (!orderId || status !== 'pending') return;

    let disposed = false;
    let running = false;
    const poll = async () => {
      if (running || disposed) return;
      running = true;
      try {
        const order = await fetchBillingOrder(orderId);
        if (!order || disposed) return;
        setCheckout((current) => (current ? { ...current, order } : current));
        setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)].slice(0, 10));
        if (order.status === 'paid') {
          setMessage('支付已确认，SeekOffer Pro 权益已经开通。');
          setMessageTone('success');
          await entitlementRefreshRef.current();
        } else if (order.status === 'expired') {
          setMessage('该二维码已过期，请重新创建订单。');
          setMessageTone('warning');
        } else if (order.status === 'failed') {
          setMessage('订单没有创建成功，请重新试一次。');
          setMessageTone('warning');
        }
      } catch (error) {
        if (!disposed && error instanceof BillingApiError && error.status >= 500) {
          setMessage('支付结果正在确认，请稍后刷新订单，避免重复支付。');
          setMessageTone('info');
        }
      } finally {
        running = false;
      }
    };

    void poll();
    const interval = window.setInterval(() => void poll(), 3_000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [checkout?.order.id, checkout?.order.status]);

  useEffect(() => {
    if (checkout?.order.status !== 'pending') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [checkout?.order.status]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) || plans[0] || fallbackPlans[1],
    [plans, selectedPlanId]
  );
  const availableProviders = availableProviderList(providers);
  const selectedProviderAvailable = Boolean(providers[provider]?.available);
  const isPro = Boolean(entitlement.data?.isPro);
  const expiresAt = entitlement.data?.entitlement.expires_at;
  const fillUsage = entitlement.data?.fillUsage;
  const applicationCount = entitlement.data?.applicationCount ?? 0;
  const freeLimit = entitlement.data?.freeLimit ?? 5;
  const orderRemainingSeconds = checkout
    ? Math.max(0, Math.ceil((new Date(checkout.order.expires_at).getTime() - now) / 1000))
    : 0;

  function requestMemberLogin() {
    const intent = {
      type: 'open-workspace' as const,
      returnTo: '/pro',
      reason: 'pro-upgrade',
      requiredAuth: 'member' as const
    };
    writeAuthIntent(intent);
    openAuthModal(intent);
  }

  async function createOrder() {
    setMessage('');
    setCheckout(null);
    setQrDataUrl('');

    if (!loggedIn || !isMember) {
      requestMemberLogin();
      return;
    }
    if (!selectedProviderAvailable) {
      setMessage('当前支付方式暂不可用，请稍后再试。');
      setMessageTone('warning');
      return;
    }

    setCreating(true);
    try {
      const response = await createBillingOrder(selectedPlan.id, provider);
      setCheckout(response);
      setOrders((current) => [response.order, ...current.filter((item) => item.id !== response.order.id)].slice(0, 10));
      setMessage(response.payment.message);
      setMessageTone('info');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '订单创建失败，请稍后重试。');
      setMessageTone('warning');
    } finally {
      setCreating(false);
    }
  }

  async function copyOrderNumber() {
    if (!checkout?.order.out_trade_no) return;
    try {
      await navigator.clipboard.writeText(checkout.order.out_trade_no);
      setMessage('订单号已复制。');
      setMessageTone('success');
    } catch {
      setMessage('浏览器未允许复制，请手动选择订单号。');
      setMessageTone('warning');
    }
  }

  async function refreshCurrentOrder() {
    if (!checkout?.order.id) return;
    setMessage('正在更新订单状态…');
    setMessageTone('info');
    try {
      const order = await fetchBillingOrder(checkout.order.id);
      if (!order) throw new Error('没有找到该订单。');
      setCheckout((current) => (current ? { ...current, order } : current));
      if (order.status === 'paid') {
        setMessage('支付已确认，SeekOffer Pro 权益已经开通。');
        setMessageTone('success');
        await entitlement.refresh();
      } else {
        setMessage(`订单状态：${orderStatusLabel(order.status)}。`);
        setMessageTone(order.status === 'pending' ? 'info' : 'warning');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '暂时无法更新订单状态，请稍后重试。');
      setMessageTone('warning');
    }
  }

  return (
    <SiteShell>
      <div className="desktop-pro-page">
      <div className="desktop-pro-account-pane">
      <section className="page-hero desktop-pro-hero relative overflow-hidden px-6 py-7 lg:px-8">
        <div className="desktop-pro-hero-grid relative grid gap-6 lg:items-center">
          <div className="desktop-pro-hero-copy">
            <div className="desktop-pro-eyebrow inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-brand">
              <Crown className="h-4 w-4" /> SeekOffer Pro
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-ink md:text-6xl">
              订阅与插件
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">
              查看当前账户权益、安装填报助手、选择申请周期方案并管理订单。所有填入仍由你确认，插件不会自动提交。
            </p>
            <div className="desktop-pro-hero-actions mt-7 flex flex-wrap gap-3">
              <a href="#plans" className="inline-flex h-12 items-center gap-2 rounded-2xl bg-brand px-5 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(20,91,87,0.22)]">
                查看方案 <ArrowRight className="h-4 w-4" />
              </a>
              <Link href="/me" className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-brand">
                先体验填报助手
              </Link>
            </div>
          </div>

          <aside className="desktop-pro-entitlement rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-soft backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-500">当前账号权益</div>
                <div className="mt-2 text-3xl font-semibold text-ink">{isPro ? 'Pro 已开通' : 'Free 免费版'}</div>
              </div>
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${isPro ? 'bg-amber-100 text-amber-800' : 'bg-brand/10 text-brand'}`}>
                {isPro ? <Crown className="h-6 w-6" /> : <LockKeyhole className="h-6 w-6" />}
              </span>
            </div>
            <dl className="mt-6 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">申请项目</dt><dd className="font-semibold text-ink">{applicationCount} / {isPro ? '不限' : freeLimit}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">本月填报发送</dt><dd className="font-semibold text-ink">{isPro ? '不限' : `${fillUsage?.used ?? 0} / ${fillUsage?.limit ?? 3}`}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">权益到期</dt><dd className="text-right font-semibold text-ink">{formatDateTime(expiresAt)}</dd></div>
            </dl>
            {entitlement.error ? <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{entitlement.error}</p> : null}
          </aside>
        </div>
      </section>

      <nav className="desktop-pro-section-nav" aria-label="订阅与插件页面导航">
        {sectionNavItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <a key={item.href} href={item.href} className={index === 0 ? 'desktop-pro-section-nav-link--active' : undefined}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

      <section id="account-benefits" className="desktop-pro-benefits grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Pro 权益概览">
        {valueCards.map((card) => (
          <ValueCard key={card.title} {...card} />
        ))}
      </section>

      <section id="install-extension" className="desktop-pro-extension grid scroll-mt-28 gap-6 rounded-[30px] border border-brand/15 bg-[linear-gradient(135deg,rgba(236,250,244,0.96),rgba(255,255,255,0.98))] p-6 shadow-soft lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.92fr)] lg:p-8">
        <div className="desktop-pro-extension-copy">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand ring-1 ring-brand/10">
            <Download className="h-3.5 w-3.5" /> Chrome / Edge · v1.0.0
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-ink">三步安装插件，开始高效申请</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            在申请页面使用寻鹿填报助手，先识别、再核对，最后由你确认填入。安装完成后即可在支持的报名页面中快速整理重复字段。
          </p>
          <ol className="desktop-pro-extension-steps mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
            {['下载并解压 ZIP', '加载到浏览器', '登录并开始使用'].map((step, index) => (
              <li key={step} className="flex items-center gap-3 rounded-2xl bg-white/85 px-4 py-3 ring-1 ring-brand/10">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{index + 1}</span>
                <span className="font-semibold text-ink">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="desktop-pro-extension-side">
          <div className="desktop-pro-extension-visual" aria-hidden="true">
            <Image
              src="/illustrations/xunlu-autofill-resource-image2-v1.webp"
              alt=""
              fill
              sizes="(max-width: 960px) 100vw, 45vw"
              className="object-cover"
            />
            <span className="desktop-pro-extension-visual-badge absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-xs font-semibold text-brand shadow-sm">
              <CheckCircle2 className="h-4 w-4" /> 已准备好，逐项确认填入
            </span>
          </div>

          <div className="desktop-pro-extension-download mt-4 rounded-[24px] border border-white bg-white/90 p-5 shadow-sm">
            <div className="text-sm font-semibold text-ink">安装前确认</div>
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 px-3 py-3 text-xs leading-6 text-slate-600">
              <input
                type="checkbox"
                checked={extensionPrivacyAccepted}
                onChange={(event) => setExtensionPrivacyAccepted(event.target.checked)}
                className="mt-1 h-4 w-4 accent-brand"
              />
              <span>
                我了解：插件不读取密码、验证码或文件，也不会自动提交。已阅读
                <Link href="/privacy" className="mx-1 font-semibold text-brand underline underline-offset-2">隐私政策</Link>
                和<Link href="/terms" className="ml-1 font-semibold text-brand underline underline-offset-2">用户协议</Link>。
              </span>
            </label>
            {extensionPrivacyAccepted ? (
              <a
                href={extensionDownloadHref}
                download
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white"
              >
                <Download className="h-4 w-4" /> 下载填报助手 v1.0.0
              </a>
            ) : (
              <button type="button" disabled className="mt-4 inline-flex h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 text-sm font-semibold text-slate-500">
                <Download className="h-4 w-4" /> 确认后下载
              </button>
            )}
            <p className="desktop-pro-extension-note mt-3 text-center text-[11px] leading-5 text-slate-600">支持 Chrome 与 Edge，下载后按页面提示完成安装。</p>
          </div>
        </div>
      </section>

      <section id="plans" className="desktop-pro-plans grid scroll-mt-28 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="desktop-pro-plans-main rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-soft lg:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Plans</div>
              <h2 className="mt-2 text-3xl font-semibold text-ink">选择适合你的寻鹿 Pro 方案</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">按你的申请节奏选择使用周期，支付成功后立即开通。</p>
            </div>
            <span className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">一次性购买 · 不自动续费</span>
          </div>

          <div className="desktop-pro-plan-list mt-6 grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => {
              const active = selectedPlan.id === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`desktop-pro-plan-row relative flex min-h-[24rem] flex-col rounded-[24px] border p-5 text-left transition ${active ? 'desktop-pro-plan-row--active border-brand bg-brand/[0.04] shadow-[0_16px_38px_rgba(20,91,87,0.12)]' : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-brand/30'}`}
                  aria-pressed={active}
                >
                  {plan.is_recommended ? <span className="absolute right-4 top-4 rounded-full bg-brand px-2.5 py-1 text-[10px] font-semibold text-white">推荐</span> : null}
                  <div className="text-lg font-semibold text-ink">{plan.name}</div>
                  <div className="mt-3 flex items-end gap-1">
                    <span className="text-4xl font-semibold text-ink">{formatPlanPrice(plan.price_cents)}</span>
                    <span className="pb-1 text-sm text-slate-600">/ {planPeriodLabel(plan)}</span>
                  </div>
                  {plan.duration_days >= 90 ? <div className="mt-1 text-xs text-slate-600">约 {formatPlanPrice(monthlyEquivalent(plan))} / 月</div> : null}
                  <p className="mt-3 min-h-[48px] text-sm leading-6 text-slate-600">{plan.description}</p>
                  <div className="mt-4 grid gap-2">
                    {plan.benefits.slice(0, 5).map((benefit) => (
                      <span key={benefit} className="flex items-start gap-2 text-xs leading-5 text-slate-600">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" /> {benefit}
                      </span>
                    ))}
                  </div>
                  <span className={`desktop-pro-plan-cta mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold ${active ? 'bg-brand text-white' : 'border border-slate-200 bg-white text-brand'}`}>
                    立即订阅 <ArrowRight className="h-4 w-4" />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="desktop-pro-comparison mt-7 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr><th className="px-4 py-3 font-semibold">能力</th><th className="px-4 py-3 font-semibold">Free</th><th className="px-4 py-3 font-semibold text-brand">Pro</th></tr>
              </thead>
              <tbody>
                {comparisonRows.map(([feature, free, pro]) => (
                  <tr key={feature} className="border-t border-slate-100"><th className="px-4 py-3 font-medium text-ink">{feature}</th><td className="px-4 py-3 text-slate-500">{free}</td><td className="px-4 py-3 font-semibold text-brand">{pro}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="desktop-pro-checkout h-fit rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-soft lg:p-7 xl:sticky xl:top-24">
          <div className="flex items-center justify-between gap-4">
            <div><div className="text-sm font-semibold text-brand">支付与开通</div><div className="mt-1 text-lg font-semibold text-ink">{selectedPlan.name}</div></div>
            <div className="text-right"><div className="text-xs text-slate-600">应付</div><div className="text-3xl font-semibold text-ink">{formatPlanPrice(selectedPlan.price_cents)}</div></div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {(Object.entries(providers) as Array<[BillingProvider, BillingProviderReadiness[BillingProvider]]>).map(([value, item]) => (
              <button
                key={value}
                type="button"
                onClick={() => item.available && setProvider(value)}
                disabled={!item.available}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${provider === value && item.available ? 'border-brand bg-brand text-white' : item.available ? 'border-slate-200 text-slate-600 hover:border-brand/30' : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'}`}
              >
                {item.label}{item.available ? '' : ' · 暂不可用'}
              </button>
            ))}
          </div>

          {!loadingPlans && availableProviders.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              当前暂时无法购买，请稍后再试。
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void createOrder()}
            disabled={creating || loadingPlans || !selectedProviderAvailable}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand px-5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(20,91,87,0.18)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            {creating ? '正在准备订单' : !selectedProviderAvailable ? '暂不可购买' : !isMember ? '登录后购买 Pro' : isPro ? '购买并延长 Pro' : '创建扫码支付订单'}
          </button>

          {message ? <div role="status" aria-live="polite" className={`mt-4 rounded-2xl px-4 py-3 text-sm leading-6 ${messageTone === 'success' ? 'bg-emerald-50 text-emerald-700' : messageTone === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-brand/5 text-brand'}`}>{message}</div> : null}

          {checkout ? (
            <div className="mt-5 rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${orderStatusTone(checkout.order.status)}`}>{orderStatusLabel(checkout.order.status)}</span>
                {checkout.order.status === 'pending' ? <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" /> {Math.floor(orderRemainingSeconds / 60)}:{String(orderRemainingSeconds % 60).padStart(2, '0')}</span> : null}
              </div>

              {checkout.order.status === 'pending' && qrDataUrl ? (
                <div className="mt-4 text-center">
                  <div className="mx-auto w-fit rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                    <Image src={qrDataUrl} alt={`${providers[checkout.payment.provider]?.label || '支付'}二维码`} width={260} height={260} unoptimized className="h-[260px] w-[260px]" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-ink">请使用{providers[checkout.payment.provider]?.label || '支付应用'}扫码</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">付款前请核对套餐与金额。页面会自动确认，请不要重复付款。</p>
                </div>
              ) : null}

              {checkout.order.status === 'paid' ? (
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-700">
                  <CheckCircle2 className="h-6 w-6 shrink-0" />
                  <div><div className="font-semibold">权益已开通</div><div className="mt-1 text-xs">可返回全部申请继续使用填报助手。</div></div>
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span className="min-w-0 truncate font-mono" title={checkout.order.out_trade_no}>{checkout.order.out_trade_no}</span>
                <button type="button" onClick={() => void copyOrderNumber()} className="inline-flex shrink-0 items-center gap-1 font-semibold text-brand"><ClipboardCopy className="h-3.5 w-3.5" />复制</button>
              </div>
              {checkout.order.status === 'pending' ? (
                <button type="button" onClick={() => void refreshCurrentOrder()} className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:text-brand"><RefreshCw className="h-3.5 w-3.5" />刷新支付状态</button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 grid gap-2 text-xs leading-5 text-slate-500">
            <span className="inline-flex items-start gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />支付完成后，系统会自动核对订单与金额并开通权益。</span>
            <span className="inline-flex items-start gap-2"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />寻鹿不保存支付密码或银行卡号，且当前没有自动续费。</span>
          </div>
        </aside>
      </section>

      {isMember && orders.length ? (
        <section id="account-orders" className="desktop-pro-orders rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-soft lg:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><div className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Orders</div><h2 className="mt-2 text-2xl font-semibold text-ink">最近订单</h2></div>
            <span className="text-xs text-slate-400">仅当前账号可见</span>
          </div>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[720px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">订单号</th><th className="px-4 py-3">套餐</th><th className="px-4 py-3">金额</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">创建时间</th></tr></thead>
              <tbody>
                {orders.slice(0, 5).map((order) => (
                  <tr key={order.id} className="border-t border-slate-100"><td className="max-w-[240px] truncate px-4 py-3 font-mono text-xs text-slate-500" title={order.out_trade_no}>{order.out_trade_no}</td><td className="px-4 py-3 font-medium text-ink">{plans.find((plan) => plan.id === order.plan_id)?.name || order.plan_id}</td><td className="px-4 py-3 font-semibold text-ink">{formatPlanPrice(order.amount_cents)}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${orderStatusTone(order.status)}`}>{orderStatusLabel(order.status)}</span></td><td className="px-4 py-3 text-slate-500">{formatDateTime(order.created_at)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section id="account-support" className="desktop-pro-support grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="desktop-pro-support-primary rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-soft">
          <div className="flex items-center gap-3"><MessageCircleQuestion className="h-6 w-6 text-brand" /><h2 className="text-xl font-semibold text-ink">订单、退款或适配问题</h2></div>
          <p className="mt-3 text-sm leading-7 text-slate-600">发生重复支付、支付成功未开通、金额异常或报名网站无法识别时，请保留寻鹿订单号或页面问题描述，通过客服邮箱联系。我们会根据订单信息协助处理，不要求你提供支付密码。</p>
          <a href="mailto:seekoffer@qq.com?subject=SeekOffer%20Pro%20%E8%AE%A2%E5%8D%95%E6%88%96%E5%A1%AB%E6%8A%A5%E5%8A%A9%E6%89%8B%E9%97%AE%E9%A2%98" className="desktop-pro-support-contact mt-4 inline-flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-brand">seekoffer@qq.com <ExternalLink className="h-4 w-4" /></a>
        </div>
        <div className="desktop-pro-support-secondary rounded-[28px] border border-brand/10 bg-brand/[0.04] p-6">
          <div className="flex items-center gap-3"><FileCheck2 className="h-5 w-5 text-brand" /><h2 className="text-lg font-semibold text-ink">购买前请确认</h2></div>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-600">
            <li className="flex items-start gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-brand" />套餐为一次性购买，支付成功后立即开通。</li>
            <li className="flex items-start gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-brand" />不自动续费，插件支持 Chrome 与 Edge 浏览器。</li>
            <li className="flex items-start gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-brand" />退款、数据处理和功能边界以相关说明为准。</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-brand"><Link href="/terms">用户协议</Link><Link href="/privacy">隐私政策</Link><Link href="/">返回全部申请</Link></div>
        </div>
      </section>
      </div>
      </div>
    </SiteShell>
  );
}

function ValueCard({ icon: Icon, title, body }: { icon: ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <article className="desktop-pro-benefit-row rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-soft">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand"><Icon className="h-5 w-5" /></span>
      <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-slate-500">{body}</p>
    </article>
  );
}
