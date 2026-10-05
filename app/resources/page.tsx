import {
  ArrowUpRight,
  BellRing,
  BookOpenText,
  Calculator,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  FolderOpen,
  Landmark,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wrench
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { SiteShell } from '@/components/site-shell';
import { officialResourceSections } from '@/lib/portal-data';
import { resourceProductSeeds } from '@/lib/resource-products';

const sectionIcons = {
  高频学术工具: BookOpenText,
  官方入口: Landmark,
  常用服务: Wrench
} as const;

const applicationTools = {
  title: 'GPA 与材料工具',
  description: '把申请期反复计算、整理和检查的事情工具化，和资料模板一起完成准备。',
  items: [
    { title: 'GPA 换算', badge: '成绩换算', description: '快速完成不同成绩口径的换算整理。', href: '/gpa', icon: Calculator },
    { title: '材料进度', badge: '准备清单', description: '把申请材料按阶段拆开，随时查看完成情况。', href: '/applications', icon: ClipboardList },
    { title: '截止提醒', badge: '时间管理', description: '集中记录申请节点，减少错过截止时间的风险。', href: '/deadlines', icon: BellRing }
  ]
};

const applicationKits = [
  {
    title: resourceProductSeeds[0].title,
    description: '整合推免申请中高频使用的核心材料，帮助你更高效地准备简历、个人陈述、推荐信等申请内容。',
    tags: [
      { label: '简历模板', icon: FileText },
      { label: '个人陈述模板', icon: UserRound },
      { label: '推荐信模板', icon: Mail },
      { label: '成绩与证明材料', icon: FolderOpen }
    ],
    icon: FileText,
    href: `/resources/${resourceProductSeeds[0].slug}`,
    priceStatus: resourceProductSeeds[0].priceStatus
  }
];

const autofillResource = {
  title: '寻鹿闪填',
  subtitle: '保研报名页信息填充助手',
  description: '复用已整理的申请信息，按“识别—核对—选择—填入”完成报名页准备，不读取验证码，也不自动提交。',
  href: '/resources/xunlu-autofill',
  features: ['Chrome / Edge 可用', '已有内容保护', '逐项确认后填入', '不自动提交']
} as const;

const resourceSectionStyles = [
  {
    panel: 'bg-emerald-50/70',
    icon: 'bg-white text-brand shadow-sm shadow-emerald-100',
    pill: 'bg-white/80 text-brand ring-1 ring-emerald-100'
  },
  {
    panel: 'bg-sky-50/70',
    icon: 'bg-white text-sky-600 shadow-sm shadow-sky-100',
    pill: 'bg-white/80 text-sky-700 ring-1 ring-sky-100'
  },
  {
    panel: 'bg-amber-50/70',
    icon: 'bg-white text-amber-700 shadow-sm shadow-amber-100',
    pill: 'bg-white/80 text-amber-800 ring-1 ring-amber-100'
  }
] as const;

function AutofillFeaturedCard() {
  return (
    <section id="xunlu-autofill" className="surface-card scroll-mt-6 overflow-hidden rounded-[34px] p-0">
      <Link
        href={autofillResource.href}
        className="group block focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15"
        aria-labelledby="xunlu-autofill-title"
      >
        <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="flex min-w-0 flex-col justify-center p-6 sm:p-8 lg:p-9">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-xl bg-brand/8 px-3 py-2 text-xs font-semibold text-brand">
                <Sparkles className="h-4 w-4" />
                寻鹿自研工具
              </span>
              <span className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">独立板块</span>
            </div>
            <h2 id="xunlu-autofill-title" className="mt-5 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              {autofillResource.title}
            </h2>
            <p className="mt-2 text-lg font-semibold leading-7 text-emerald-700">{autofillResource.subtitle}</p>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">{autofillResource.description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {autofillResource.features.map(feature => (
                <span key={feature} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {feature}
                </span>
              ))}
            </div>
            <span className="mt-6 inline-flex w-fit items-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(20,91,87,0.18)] transition group-hover:-translate-y-0.5">
              了解产品能力与使用方式
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>

          <div className="relative min-h-[18rem] overflow-hidden border-t border-slate-100 bg-[linear-gradient(135deg,#f8fbfb_0%,#f2faf7_100%)] p-4 sm:min-h-[20rem] sm:p-6 lg:min-h-0 lg:border-l lg:border-t-0">
            <Image
              src="/illustrations/xunlu-autofill-resource-image2-v1.webp"
              alt="寻鹿闪填的报名页信息填充流程预览"
              fill
              sizes="(max-width: 1023px) 100vw, 55vw"
              className="object-cover object-left transition duration-500 group-hover:scale-[1.012]"
            />
            <div className="absolute bottom-5 right-5 hidden w-52 rounded-2xl border border-white/80 bg-white/95 p-4 shadow-[0_20px_45px_rgba(23,73,77,0.14)] backdrop-blur sm:block">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <div className="text-sm font-semibold text-ink">安全填入流程</div>
                  <div className="mt-1 text-[10px] text-slate-400">识别 → 核对 → 选择 → 填入</div>
                </div>
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-600">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                已有内容保护，保存与提交由你完成
              </div>
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}

export default function ResourcesPage() {
  const totalResourceLinks = officialResourceSections.reduce((total, section) => total + section.links.length, 0);

  return (
    <SiteShell>
      <section className="page-hero grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:px-8">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">资源库</h1>
          <p className="mt-4 text-base leading-8 text-slate-600">申请材料、学术工具和官方入口，一页直达。</p>
        </div>

        <div className="mx-auto grid w-full max-w-[520px] grid-cols-1 gap-3 sm:grid-cols-3 lg:mx-0 lg:justify-self-center">
          {[
            { label: '资源入口', value: `${totalResourceLinks}`, icon: BookOpenText },
            { label: '资源分类', value: `${officialResourceSections.length}`, icon: Landmark },
            { label: '申请工具', value: '4', icon: ClipboardList }
          ].map(item => {
            const Icon = item.icon;

            return (
              <div key={item.label} className="soft-stat-pill rounded-[28px] px-4 py-4">
                <div className="flex items-center justify-center gap-3 text-center">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/8 text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="whitespace-nowrap text-xs text-slate-500">{item.label}</div>
                    <div className="whitespace-nowrap text-xl font-semibold text-ink">{item.value}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="application-products" className="surface-card relative isolate overflow-hidden !bg-white scroll-mt-6 rounded-[34px] p-6 lg:p-8">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand/8 text-brand">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">申请资料中心</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">为你的推免申请提供专业、系统的资料支持</p>
            </div>
          </div>
          <Link href="/resources/purchases" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand transition hover:text-brand-deep">
            查看购买记录
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6">
          {applicationKits.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                href={item.href}
                className="group relative z-10 block rounded-[30px] border border-emerald-100/80 bg-[linear-gradient(110deg,rgba(239,250,246,0.95),rgba(250,253,252,0.98))] p-5 transition hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-[0_18px_44px_rgba(20,91,87,0.08)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15 sm:p-6"
              >
                <div className="flex min-w-0 flex-col gap-5 md:flex-row md:items-center md:gap-6">
                  <div className="relative inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] bg-emerald-100/90 text-brand shadow-[0_12px_26px_rgba(62,173,143,0.12)]">
                    <span className="absolute bottom-[-6px] left-5 h-6 w-14 rounded-xl bg-emerald-100/90" />
                    <Icon className="relative z-10 h-12 w-12 transition group-hover:scale-105" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="min-w-0 text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">{item.title}</h3>
                      <span className="rounded-full bg-emerald-100/90 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                        {item.priceStatus === 'pending' ? '即将上线' : '站内购买'}
                      </span>
                    </div>
                    <p className="mt-3 max-w-[50rem] text-sm leading-7 text-slate-500 sm:text-base">{item.description}</p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2 md:max-w-[39rem] md:border-l md:border-emerald-100/80 md:pl-6">
                    {item.tags.map(entry => {
                      const TagIcon = entry.icon;
                      return (
                        <span key={entry.label} className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-emerald-100/80 transition group-hover:text-brand">
                          <TagIcon className="h-4 w-4 text-brand" />
                          {entry.label}
                        </span>
                      );
                    })}
                  </div>

                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-[0_10px_22px_rgba(20,91,87,0.18)] transition group-hover:translate-x-0.5">
                    <ArrowUpRight className="h-5 w-5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <AutofillFeaturedCard />

      <section className="surface-card relative isolate overflow-hidden !bg-white rounded-[34px] p-0">
        <div className="grid lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="flex flex-col justify-between bg-amber-50/70 p-6 lg:p-7">
            <div>
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-[20px] bg-white text-amber-700 shadow-sm shadow-amber-100">
                <Calculator className="h-7 w-7" />
              </span>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink">{applicationTools.title}</h2>
              <p className="mt-3 max-w-[16rem] text-sm leading-6 text-slate-600">{applicationTools.description}</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-100">{applicationTools.items.length} 个常用工具</span>
            </div>
          </div>

          <div className="p-4 lg:p-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {applicationTools.items.map(item => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="group relative flex min-h-[10.5rem] flex-col rounded-[22px] border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15 lg:p-5"
                  >
                    <span className="flex items-start gap-3">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-amber-50 text-amber-700 shadow-inner shadow-amber-100/60 transition group-hover:bg-amber-100">
                        <Icon className="h-6 w-6" />
                      </span>
                      <span className="min-w-0 flex-1 pt-0.5">
                        <span className="block whitespace-nowrap text-lg font-bold leading-6 text-slate-950">{item.title}</span>
                        <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition group-hover:bg-brand/8 group-hover:text-brand">{item.badge}</span>
                      </span>
                      <span className="absolute right-4 top-4 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 text-brand transition group-hover:bg-brand group-hover:text-white lg:right-5 lg:top-5">
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                    </span>
                    <span className="mt-4 block text-sm leading-6 text-slate-500">{item.description}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6">
        {officialResourceSections.map((section, sectionIndex) => {
          const Icon = sectionIcons[section.title as keyof typeof sectionIcons];
          const style = resourceSectionStyles[sectionIndex % resourceSectionStyles.length];

          return (
            <div key={section.title} className="surface-card overflow-hidden rounded-[34px] p-0">
              <div className="grid lg:grid-cols-[17rem_minmax(0,1fr)]">
                <div className={`flex flex-col justify-between p-6 lg:p-7 ${style.panel}`}>
                  <div>
                    <span className={`inline-flex h-14 w-14 items-center justify-center rounded-[22px] ${style.icon}`}>
                      <Icon className="h-7 w-7" />
                    </span>
                    <h2 className="mt-5 text-2xl font-semibold tracking-tight text-ink">{section.title}</h2>
                    <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600">{section.description}</p>
                  </div>
                  <div className="mt-7 flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${style.pill}`}>
                      {section.links.length} 个常用入口
                    </span>
                  </div>
                </div>

                <div className="p-5 lg:p-6">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {section.links.map(item => (
                      <a
                        key={item.title}
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex min-h-[7.25rem] items-center gap-4 rounded-[24px] border border-slate-100 bg-white px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15"
                      >
                        <span className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-[24px] bg-slate-50 shadow-inner shadow-slate-200/50 transition group-hover:bg-brand/5">
                          <ExternalSiteMark source={item.href} label={item.title} size="xl" layout="square" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-base font-bold leading-6 text-slate-950">{item.title}</span>
                          <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition group-hover:bg-brand/8 group-hover:text-brand">
                            {item.badge}
                          </span>
                          <span className="mt-2 block truncate text-xs leading-5 text-slate-500">{item.description}</span>
                        </span>
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 text-brand transition group-hover:bg-brand group-hover:text-white">
                          <ExternalLink className="h-4 w-4" />
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="page-hero grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:px-8">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/8 text-brand"><ClipboardList className="h-5 w-5" /></span>
            <span className="text-sm font-semibold text-brand">继续完善你的申请准备</span>
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-4xl">从资料，到行动，再到提交。</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">申请过程中需要反复回访的工具和官方入口，我们也按使用场景继续整理。</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:justify-self-end">
          {[
            { label: '资源入口', value: `${totalResourceLinks}`, icon: BookOpenText },
            { label: '资源分类', value: `${officialResourceSections.length}`, icon: Landmark },
            { label: '申请资料', value: `${resourceProductSeeds.length}`, icon: ClipboardList }
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="soft-stat-pill rounded-[28px] px-4 py-4">
                <div className="flex items-center justify-center gap-3 text-center">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/8 text-brand"><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <div className="whitespace-nowrap text-xs text-slate-500">{item.label}</div>
                    <div className="whitespace-nowrap text-xl font-semibold text-ink">{item.value}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </SiteShell>
  );
}
