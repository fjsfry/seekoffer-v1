import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  BookOpen,
  ClipboardList,
  ExternalLink,
  FileCheck2,
  Flag,
  LayoutDashboard,
  MessageCircle,
  Search,
  ShieldCheck,
  Trophy
} from 'lucide-react';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { QQ_GROUP_NUMBER, QQ_GROUP_URL } from '@/lib/contact';
import { applicationColumnPresets, statusDefinitions } from '@/lib/mock-data';

export const metadata: Metadata = {
  title: '使用指南 - Seekoffer',
  description: '5 分钟上手 Seekoffer：从通知库筛选项目、查看原文、加入申请表到使用工作台管理材料和截止时间。',
  alternates: {
    canonical: '/guide'
  },
  openGraph: {
    title: 'Seekoffer 使用指南',
    description: '从查保研通知、看原文到加入申请工作台的完整使用路径。',
    url: '/guide',
    siteName: '寻鹿 Seekoffer',
    images: ['/logo.png'],
    locale: 'zh_CN',
    type: 'website'
  }
};

const onboardingSteps = [
  {
    step: '01',
    title: '先查通知',
    description: '进入通知库，用学校、学院、专业关键词、项目类型和截止时间筛选你真正关心的项目。',
    action: '进入通知库',
    href: '/notices',
    icon: Search
  },
  {
    step: '02',
    title: '看详情和原文',
    description: '打开通知详情页，先看截止时间、学院、材料要求，再点击原文通知核对官方页面。',
    action: '了解数据说明',
    href: '/data-quality',
    icon: ExternalLink
  },
  {
    step: '03',
    title: '加入申请表',
    description: '对感兴趣的项目点击“加入申请表”。登录后，这条通知会进入你的个人工作台。',
    action: '打开工作台',
    href: '/me',
    icon: ClipboardList
  },
  {
    step: '04',
    title: '在工作台推进',
    description: '统一维护申请状态、优先级、材料进度、备注和截止提醒，避免遗漏关键节点。',
    action: '查看工作台',
    href: '/me',
    icon: LayoutDashboard
  },
  {
    step: '05',
    title: '发现问题及时反馈',
    description: '如果链接、截止时间、学院信息或材料要求有误，请通过反馈入口或 QQ 群告诉我们。',
    action: '加入 QQ 群',
    href: QQ_GROUP_URL,
    external: true,
    icon: MessageCircle
  }
] as const;

const pageGuides = [
  {
    title: '通知库',
    status: '已上线',
    description: '用来找项目、筛选截止时间、查看详情和加入申请表。建议先从这里开始。',
    tips: ['优先看 7 天内截止', '提交前核对原文', '感兴趣就加入申请表'],
    href: '/notices',
    icon: Bell
  },
  {
    title: '通知详情',
    status: '已上线',
    description: '用来确认学校、学院、截止时间、原文通知和报名入口。原文与报名入口会分开展示。',
    tips: ['原文是最终依据', '报名入口可能是问卷', '发现错误请反馈'],
    href: '/notices',
    icon: FileCheck2
  },
  {
    title: '申请工作台',
    status: '登录可用',
    description: '用来保存目标项目、记录状态、材料进度和优先级，替代零散 Excel 与备忘录。',
    tips: ['统一状态口径', '材料拆项勾选', '按截止时间推进'],
    href: '/me',
    icon: ClipboardList
  },
  {
    title: '院校库',
    status: '已上线',
    description: '用来快速回到学校官网和官方入口，适合核对院校背景与长期关注目标院校。',
    tips: ['按城市筛选', '按院校标签筛选', '从官网继续核对'],
    href: '/colleges',
    icon: Flag
  },
  {
    title: '资源库',
    status: '已上线',
    description: '整理常用学术工具、官方平台和申请材料模板入口，减少重复搜索。',
    tips: ['找论文工具', '找官方入口', '准备材料清单'],
    href: '/resources',
    icon: BookOpen
  },
  {
    title: '竞赛库',
    status: '已上线',
    description: '按 A 类、B 类、热门和专业类别整理竞赛入口，适合作为背景提升清单。',
    tips: ['按类别筛选', '核对官网报名', '记录成果材料'],
    href: '/competitions',
    icon: Trophy
  }
] as const;

const productStatus = [
  ['通知库', '已上线', '支持搜索、筛选、详情页、原文核对和加入工作台。'],
  ['申请工作台', '登录可用', '支持保存项目、状态管理、优先级和材料进度维护。'],
  ['院校库 / 资源库', '已上线', '作为高频入口和辅助工具，帮助你快速回访官方页面。'],
  ['Offer 圈', '核验开放', '登录用户可提交动态和申请讨论，核验通过后公开展示，并支持举报纠错。'],
  ['竞赛库', '已上线', '按赛事等级、专业类别和截止节点整理背景提升入口。'],
  ['自动提醒', '逐步完善', '当前先展示截止风险，后续会继续完善更主动的提醒机制。']
] as const;

export default function GuidePage() {
  return (
    <SiteShell>
      <section className="page-hero grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:px-8">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">使用指南</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">从通知筛选、原文核对到加入工作台，按步骤完成核心流程。</p>
        </div>

        <div className="mx-auto grid w-full max-w-[520px] grid-cols-1 gap-3 sm:grid-cols-3 lg:mx-0 lg:justify-self-center">
          {[
            ['查通知', Search],
            ['看原文', ExternalLink],
            ['管进度', LayoutDashboard]
          ].map(([label, Icon]) => (
            <div key={label as string} className="soft-stat-pill rounded-[28px] px-4 py-4">
              <div className="flex items-center justify-center gap-3 text-center">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/8 text-brand">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="whitespace-nowrap text-sm font-semibold text-ink">{label as string}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-card rounded-[34px] p-6 md:p-8">
        <PageSectionTitle
          eyebrow="新手路径"
          title="第一次使用，按这 5 步走"
          subtitle="这套流程覆盖 Seekoffer 当前最核心的使用场景，也能避免你把功能入口理解错。"
        />
        <div className="grid gap-4 lg:grid-cols-5">
          {onboardingSteps.map((item) => {
            const Icon = item.icon;
            const content = (
              <div className="group h-full rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-brand">{item.step}</span>
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-cream text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-5 text-lg font-semibold text-ink">{item.title}</div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
                <div className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand">
                  {item.action}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </div>
            );

            return 'external' in item && item.external ? (
              <a key={item.title} href={item.href} target="_blank" rel="noreferrer">
                {content}
              </a>
            ) : (
              <Link key={item.title} href={item.href}>
                {content}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="surface-card rounded-[34px] p-6 md:p-8">
          <PageSectionTitle
            eyebrow="页面说明"
            title="每个页面应该怎么用"
            subtitle="如果你不确定一个入口的作用，可以先看这里。已上线、登录可用和规划中的功能会分开说明。"
          />
          <div className="grid gap-4 md:grid-cols-2">
            {pageGuides.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-brand/20 hover:shadow-soft"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-cream text-brand">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{item.status}</span>
                  </div>
                  <div className="mt-4 text-xl font-semibold text-ink">{item.title}</div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.tips.map((tip) => (
                      <span key={tip} className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                        {tip}
                      </span>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <aside className="grid gap-6">
          <section className="surface-card rounded-[34px] p-6">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <ShieldCheck className="h-4 w-4" />
              使用前请记住
            </div>
            <div className="mt-5 grid gap-3 text-sm leading-7 text-slate-600">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">正式报名、材料要求和截止时间，请以院校官网原文为最终依据。</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">“原文通知”和“报名入口”是两个不同按钮，报名入口可能是问卷或系统。</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">工作台需要登录后使用，未登录时只能浏览公开内容。</div>
            </div>
          </section>

          <section className="surface-card rounded-[34px] p-6">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <MessageCircle className="h-4 w-4" />
              需要帮助？
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              使用中遇到数据错误、入口打不开、项目无法加入申请表等问题，可以加入 QQ 群 {QQ_GROUP_NUMBER} 反馈。
            </p>
            <a
              href={QQ_GROUP_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white"
            >
              加入 QQ 群
              <ArrowRight className="h-4 w-4" />
            </a>
          </section>
        </aside>
      </section>

      <section className="surface-card rounded-[34px] p-6 md:p-8">
        <PageSectionTitle
          eyebrow="功能状态"
          title="功能状态说明"
          subtitle="哪些已经可以用，哪些需要登录或继续完善，这里直接说明，避免你误以为功能坏了。"
        />
        <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white">
          <div className="grid grid-cols-[1fr_0.8fr_2fr] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-500">
            <div>功能</div>
            <div>状态</div>
            <div>说明</div>
          </div>
          <div className="divide-y divide-slate-100">
            {productStatus.map(([name, status, description]) => (
              <div key={name} className="grid grid-cols-[1fr_0.8fr_2fr] gap-4 px-5 py-4 text-sm">
                <div className="font-semibold text-ink">{name}</div>
                <div>
                  <span className="rounded-full bg-brand-cream px-3 py-1 text-xs font-semibold text-brand">{status}</span>
                </div>
                <div className="leading-7 text-slate-600">{description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="surface-card rounded-[34px] p-6 md:p-8">
          <PageSectionTitle
            eyebrow="工作台"
            title="工作台字段怎么填"
            subtitle="如果你已经把通知加入申请表，可以按下面这些字段维护。字段越统一，后续筛选、提醒和复盘越清楚。"
          />
          <div className="grid gap-3">
            {applicationColumnPresets.slice(0, 7).map((column) => (
              <div key={column.key} className="rounded-2xl bg-white px-4 py-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-semibold text-ink">{column.label}</div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                    {column.required ? '建议必填' : '可选维护'}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-600">{column.description}</p>
                <div className="mt-2 text-xs text-slate-500">示例：{column.sample}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card rounded-[34px] p-6 md:p-8">
          <PageSectionTitle
            eyebrow="状态口径"
            title="申请状态怎么理解"
            subtitle="统一状态可以避免工作台变成又一个杂乱备忘录。建议只在关键节点更新状态。"
          />
          <div className="grid gap-3">
            {statusDefinitions.map((item) => (
              <div key={item.label} className="rounded-2xl bg-white px-4 py-4 shadow-sm">
                <div className="font-semibold text-ink">{item.label}</div>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.meaning}</p>
                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">{item.nextAction}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </SiteShell>
  );
}
