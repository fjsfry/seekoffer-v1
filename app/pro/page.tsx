'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  Check,
  ClipboardList,
  Crown,
  Download,
  ExternalLink,
  LoaderCircle,
  Lock,
  Mail,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Sparkles,
  WalletCards
} from 'lucide-react';
import { SiteShell } from '@/components/site-shell';
import { useUserSessionState } from '@/hooks/use-user-session';
import {
  createBillingOrder,
  fetchBillingPlans,
  formatPlanPrice,
  type BillingPlan,
  type BillingProvider,
  type CreateBillingOrderResponse
} from '@/lib/billing-api';
import { openAuthModal, writeAuthIntent } from '@/lib/auth-intent';
import { useProEntitlement } from '@/hooks/use-pro-entitlement';

const CONTACT_EMAIL = 'seekoffer@qq.com';
const QQ_GROUP = '1092490793';

const fallbackPlans: BillingPlan[] = [
  {
    id: 'pro_monthly',
    name: 'Pro 月度',
    description: '适合先体验完整申请工作台。',
    price_cents: 1900,
    currency: 'CNY',
    duration_days: 31,
    benefits: ['无限申请项目跟进', '多节点截止提醒', '材料清单进度管理', '申请表导出能力'],
    sort_order: 10,
    is_recommended: false
  },
  {
    id: 'pro_quarter',
    name: 'Pro 季度',
    description: '覆盖夏令营、预推免高峰期，当前推荐方案。',
    price_cents: 4900,
    currency: 'CNY',
    duration_days: 93,
    benefits: ['无限申请项目跟进', '7/3/1 天多节点提醒', '材料清单自动拆解预留', '日历与导出能力', '通知变更提醒预留'],
    sort_order: 20,
    is_recommended: true
  },
  {
    id: 'pro_yearly',
    name: 'Pro 年度',
    description: '适合跨阶段持续管理申请和复盘。',
    price_cents: 12900,
    currency: 'CNY',
    duration_days: 366,
    benefits: ['全年无限申请项目', '多节点提醒', '材料清单与日历', '导出与复盘报告预留', '后续 Pro 新能力优先体验'],
    sort_order: 30,
    is_recommended: false
  }
];

const valueCards = [
  {
    title: '无限申请项目',
    description: '免费版最多跟进 5 个项目，Pro 适合真正进入申请季后的多项目管理。',
    icon: ClipboardList
  },
  {
    title: '多节点截止提醒',
    description: '围绕 7 天、3 天、1 天和临近截止做提醒，减少漏申和临时赶材料。',
    icon: BellRing
  },
  {
    title: '材料清单与日历',
    description: '把每个项目拆成材料进度、截止时间和行动清单，后续支持日历和导出。',
    icon: CalendarDays
  },
  {
    title: '通知变更优先提醒',
    description: '对截止时间、报名入口、附件和考核安排变化做 Pro 优先提醒预留。',
    icon: ShieldCheck
  }
] as const;

const roadmap = [
  '材料清单自动拆解：从通知正文提取成绩单、推荐信、个人陈述、科研证明等材料项。',
  '日历视图：按周/月查看截止、面试、材料节点，并支持导出到系统日历。',
  '申请优先级：结合截止时间、材料复杂度和个人背景，提示今天最值得处理的项目。',
  '通知变更提醒：当官网原文发生变化时，提示字段差异和需要重新确认的内容。'
] as const;

const compliancePaths = [
  {
    title: '推荐路径：办理个体工商户后直连',
    body: '用于正式商业化最稳。拿到主体资质后，申请微信支付商户号和支付宝商家能力，回调自动开通 Pro。',
    tone: 'green'
  },
  {
    title: '过渡路径：小范围内测人工开通',
    body: `当前可以先生成 Pro 意向单，通过 ${CONTACT_EMAIL} 或 QQ 群 ${QQ_GROUP} 人工核对后开通，适合灰度验证价格和需求。`,
    tone: 'blue'
  },
  {
    title: '不建议：免签支付/跑分码/个人收款码聚合',
    body: '这类方案容易触发资金、风控和售后风险，也不利于未来备案、退款、发票和用户信任。',
    tone: 'amber'
  }
] as const;

function getPlanUnit(plan: BillingPlan) {
  if (plan.duration_days >= 360) return '年';
  if (plan.duration_days >= 90) return '季';
  return '月';
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '暂未开通';
  return value.slice(0, 16).replace('T', ' ');
}

function buildManualMailHref(checkout: CreateBillingOrderResponse | null, plan: BillingPlan) {
  const subject = encodeURIComponent('Seekoffer Pro 内测开通');
  const body = encodeURIComponent(
    [
      '你好，我想开通 Seekoffer Pro。',
      '',
      `套餐：${plan.name}`,
      `金额：${formatPlanPrice(plan.price_cents)}`,
      checkout ? `订单号：${checkout.order.out_trade_no}` : '订单号：尚未生成',
      '',
      '我的登录邮箱：',
      '付款/开通备注：'
    ].join('\n')
  );

  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

export default function ProPage() {
  const { loggedIn, isMember } = useUserSessionState();
  const entitlement = useProEntitlement();
  const [plans, setPlans] = useState<BillingPlan[]>(fallbackPlans);
  const [selectedPlanId, setSelectedPlanId] = useState('pro_quarter');
  const [provider, setProvider] = useState<BillingProvider>('wechat');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [checkout, setCheckout] = useState<CreateBillingOrderResponse | null>(null);

  useEffect(() => {
    let active = true;
    async function loadPlans() {
      try {
        const response = await fetchBillingPlans();
        if (active && response.plans.length) {
          setPlans(response.plans);
          const recommended = response.plans.find((plan) => plan.is_recommended) || response.plans[0];
          setSelectedPlanId(recommended.id);
        }
      } catch {
        if (active) {
          setPlans(fallbackPlans);
        }
      }
    }

    void loadPlans();
    return () => {
      active = false;
    };
  }, []);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) || plans[0] || fallbackPlans[1],
    [plans, selectedPlanId]
  );

  const isPro = Boolean(entitlement.data?.isPro);
  const applicationCount = entitlement.data?.applicationCount ?? 0;
  const freeLimit = entitlement.data?.freeLimit ?? 5;

  async function handleCreateOrder() {
    setMessage('');
    setCheckout(null);

    if (!loggedIn || !isMember) {
      const intent = {
        type: 'open-workspace' as const,
        returnTo: '/pro',
        reason: 'pro-upgrade',
        requiredAuth: 'member' as const
      };
      writeAuthIntent(intent);
      openAuthModal(intent);
      return;
    }

    setCreating(true);
    try {
      const response = await createBillingOrder(selectedPlan.id, provider);
      setCheckout(response);
      setMessage(
        response.payment.configured
          ? response.payment.message
          : '当前自动支付通道还在资质接入中，已为你生成内测开通意向单。请通过邮箱或 QQ 群联系运营核对后开通。'
      );
      await entitlement.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '订单创建失败，请稍后重试。');
    } finally {
      setCreating(false);
    }
  }

  return (
    <SiteShell>
      <section className="relative overflow-hidden rounded-[38px] border border-brand/10 bg-[radial-gradient(circle_at_12%_12%,rgba(20,91,87,0.12),transparent_32%),linear-gradient(135deg,#ffffff_0%,#f3fbf7_45%,#ffffff_100%)] px-6 py-10 shadow-soft lg:px-10 lg:py-12">
        <div className="absolute right-10 top-10 hidden h-52 w-52 rounded-full bg-brand/10 blur-3xl lg:block" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_380px] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">
              <Crown className="h-4 w-4" />
              Seekoffer Pro
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-ink md:text-6xl">
              把保研申请从信息收藏升级成执行系统
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
              免费查通知，Pro 管申请。解锁无限申请项目、多节点提醒、材料清单、日历与导出能力，让你的申请季不再散落在 Excel、群聊和备忘录里。
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(20,91,87,0.22)]"
              >
                查看 Pro 方案
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                href="/applications"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-brand"
              >
                先看我的申请表
              </Link>
            </div>
          </div>

          <div className="rounded-[30px] border border-white/80 bg-white/86 p-6 shadow-soft backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-500">当前权益</div>
                <div className="mt-2 text-3xl font-semibold text-ink">{isPro ? 'Pro 已开通' : 'Free 免费版'}</div>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white">
                {isPro ? <Crown className="h-7 w-7" /> : <Lock className="h-7 w-7" />}
              </div>
            </div>
            <div className="mt-6 grid gap-3 rounded-3xl bg-slate-50 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">申请项目</span>
                <span className="font-semibold text-ink">
                  {applicationCount} / {isPro ? '无限' : freeLimit}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{
                    width: `${Math.min(100, Math.round((applicationCount / Math.max(1, freeLimit)) * 100))}%`
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">到期时间</span>
                <span className="font-semibold text-ink">{formatDateTime(entitlement.data?.entitlement.expires_at)}</span>
              </div>
            </div>
            {entitlement.error ? <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">{entitlement.error}</div> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {valueCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-soft">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-ink">{card.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">{card.description}</p>
            </article>
          );
        })}
      </section>

      <section id="pricing" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="rounded-[34px] border border-slate-200/80 bg-white p-6 shadow-soft lg:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">
                <WalletCards className="h-4 w-4" />
                Pricing
              </div>
              <h2 className="mt-4 text-3xl font-semibold text-ink">选择适合申请季的 Pro 方案</h2>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-brand">
              免费版保留：通知检索、院校库、资源库、最多 {freeLimit} 个申请项目
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => {
              const active = selectedPlan.id === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`relative rounded-[28px] border p-5 text-left transition ${
                    active
                      ? 'border-brand bg-brand/[0.04] shadow-[0_18px_42px_rgba(20,91,87,0.12)]'
                      : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-brand/30'
                  }`}
                >
                  {plan.is_recommended ? (
                    <span className="absolute right-4 top-4 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">
                      推荐
                    </span>
                  ) : null}
                  <div className="text-lg font-semibold text-ink">{plan.name}</div>
                  <div className="mt-3 flex items-end gap-1">
                    <span className="text-4xl font-semibold text-ink">{formatPlanPrice(plan.price_cents)}</span>
                    <span className="pb-1 text-sm text-slate-500">/ {getPlanUnit(plan)}</span>
                  </div>
                  <p className="mt-3 min-h-[44px] text-sm leading-6 text-slate-500">{plan.description}</p>
                  <div className="mt-4 grid gap-2">
                    {plan.benefits.slice(0, 4).map((benefit) => (
                      <span key={benefit} className="inline-flex items-start gap-2 text-sm leading-6 text-slate-600">
                        <Check className="mt-1 h-4 w-4 shrink-0 text-brand" />
                        {benefit}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-[34px] border border-slate-200/80 bg-white p-6 shadow-soft lg:p-7">
          <div className="text-sm font-semibold text-brand">支付与开通</div>
          <div className="mt-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            正式微信/支付宝支付需要商户资质。当前可以先生成内测意向单，由运营人工核对并开通；正式商户号配置完成后，会自动切换为扫码支付。
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { value: 'wechat' as const, label: '微信支付' },
              { value: 'alipay' as const, label: '支付宝' }
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setProvider(item.value)}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  provider === item.value ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-3xl bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">已选择</span>
              <span className="text-sm font-semibold text-ink">{selectedPlan.name}</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-slate-500">应付金额</span>
              <span className="text-3xl font-semibold text-ink">{formatPlanPrice(selectedPlan.price_cents)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateOrder}
            disabled={creating}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-4 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(20,91,87,0.18)] disabled:opacity-60"
          >
            {creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            {creating ? '正在创建订单...' : loggedIn && isMember ? '创建 Pro 开通单' : '登录后升级 Pro'}
          </button>

          {message ? (
            <div
              className={`mt-4 rounded-2xl px-4 py-3 text-sm leading-6 ${
                checkout?.payment.configured ? 'bg-emerald-50 text-brand' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {message}
            </div>
          ) : null}

          {checkout ? (
            <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              <div className="font-semibold text-ink">订单号</div>
              <div className="mt-1 break-all font-mono text-xs">{checkout.order.out_trade_no}</div>
              {checkout.payment.codeUrl ? (
                <div className="mt-4">
                  <div className="font-semibold text-ink">支付二维码内容</div>
                  <textarea
                    readOnly
                    value={checkout.payment.codeUrl}
                    className="mt-2 h-24 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none"
                  />
                  <div className="mt-2 text-xs leading-5 text-slate-500">
                    商户号配置完成后，这里会渲染正式扫码二维码，并通过异步回调自动开通权益。
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                  当前没有正式支付二维码。请通过下方联系方式提交订单号，运营核对后人工开通。
                </div>
              )}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3">
            <a
              href={buildManualMailHref(checkout, selectedPlan)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-brand hover:border-brand/40"
            >
              <Mail className="h-4 w-4" />
              邮件联系开通
            </a>
            <div className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              <MessageCircle className="h-4 w-4 text-brand" />
              QQ 交流群：{QQ_GROUP}
            </div>
          </div>
        </aside>
      </section>

      <section className="rounded-[34px] border border-slate-200/80 bg-white p-6 shadow-soft lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">
              <ShieldCheck className="h-4 w-4" />
              Payment Readiness
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-ink">没有营业执照时，先这样稳妥推进</h2>
          </div>
          <a
            href="https://pay.weixin.qq.com/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:text-brand"
          >
            查看商户平台
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {compliancePaths.map((item) => (
            <article
              key={item.title}
              className={`rounded-[26px] border p-5 ${
                item.tone === 'green'
                  ? 'border-emerald-200 bg-emerald-50'
                  : item.tone === 'blue'
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-amber-200 bg-amber-50'
              }`}
            >
              <h3 className="text-lg font-semibold text-ink">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[34px] border border-slate-200/80 bg-white p-6 shadow-soft lg:p-8">
        <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">
              <Sparkles className="h-4 w-4" />
              Roadmap
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-ink">Pro 不只是收费入口，而是申请工作流升级</h2>
            <p className="mt-4 text-sm leading-7 text-slate-500">
              我们会先把“无限跟进 + 高级提醒 + 材料清单”跑稳，再逐步上线 AI 优先级、通知 Diff 和申请复盘。
            </p>
          </div>
          <div className="grid gap-3">
            {roadmap.map((item, index) => (
              <div key={item} className="flex gap-4 rounded-3xl bg-slate-50 p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <p className="text-sm leading-7 text-slate-600">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <ProSmallCard icon={Download} title="导出与备份" body="后续 Pro 支持导出 Excel、日历和申请计划，方便离线备份与复盘。" />
        <ProSmallCard icon={BellRing} title="高级提醒" body="围绕截止、材料、面试和结果确认做多节点提醒，减少临门一脚的混乱。" />
        <ProSmallCard icon={ShieldCheck} title="可信数据" body="Pro 不会替代官网原文，所有通知与截止时间仍以官方来源为准，平台负责整理和提醒。" />
      </section>
    </SiteShell>
  );
}

function ProSmallCard({
  icon: Icon,
  title,
  body
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-soft">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-brand">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-500">{body}</p>
    </article>
  );
}
