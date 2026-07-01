import {
  ArrowUpRight,
  BookOpenText,
  Calculator,
  ClipboardList,
  FileText,
  Landmark,
  Mail,
  Wrench
} from 'lucide-react';
import Link from 'next/link';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { SiteShell } from '@/components/site-shell';
import { taobaoTemplatePackHref } from '@/lib/external-links';
import { officialResourceSections } from '@/lib/portal-data';

const sectionIcons = {
  高频学术工具: BookOpenText,
  官方入口: Landmark,
  常用服务: Wrench
} as const;

const applicationKits = [
  {
    title: '简历模板',
    description: '适合夏令营、预推免和正式推免投递，突出成绩、科研、竞赛和项目经历。',
    items: ['一页简历', '科研经历', '项目表达'],
    icon: FileText,
    href: taobaoTemplatePackHref,
    external: true
  },
  {
    title: '个人陈述模板',
    description: '按个人背景、科研经历、目标方向和未来规划组织内容，减少空泛表达。',
    items: ['结构模板', '常见问题', '修改提示'],
    icon: BookOpenText,
    href: taobaoTemplatePackHref,
    external: true
  },
  {
    title: '推荐信模板',
    description: '整理推荐信写作结构、常见表述和提交注意事项，方便提前沟通老师。',
    items: ['推荐信结构', '老师沟通', '提交提醒'],
    icon: Mail,
    href: taobaoTemplatePackHref,
    external: true
  },
  {
    title: 'GPA 与材料工具',
    description: '把申请期反复计算和检查的事情工具化，减少低价值重复劳动。',
    items: ['GPA 换算', '材料进度', '截止提醒'],
    icon: Calculator,
    href: '/gpa'
  }
];

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
            { label: '申请工具', value: `${applicationKits.length}`, icon: ClipboardList }
          ].map((item) => {
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

      <section className="surface-card rounded-[34px] p-6 lg:p-8">
        <div className="flex items-start gap-3">
          <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand/8 text-brand">
            <ClipboardList className="h-5 w-5" />
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">申请资料中心</h2>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {applicationKits.map((item, index) => {
            const Icon = item.icon;
            const cardClassName =
              'group rounded-[24px] border border-slate-100 bg-white/95 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/15 hover:shadow-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15';
            const cardContent = (
              <div className="flex h-full min-h-[15rem] flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div
                    className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] ${
                      index === 0
                        ? 'bg-emerald-50 text-brand'
                        : index === 1
                          ? 'bg-sky-50 text-sky-500'
                          : index === 2
                            ? 'bg-cyan-50 text-cyan-500'
                            : 'bg-teal-50 text-brand'
                      }`}
                  >
                    <Icon className="h-7 w-7 transition group-hover:scale-105" />
                  </div>
                  <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-400">
                    {index < 3 ? '模板' : '工具'}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-ink">{item.title}</h3>
                <div className="mt-5 flex min-h-[3rem] flex-wrap content-start gap-2">
                  {item.items.map((entry) => (
                    <span key={entry} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 transition group-hover:bg-brand/8 group-hover:text-brand">
                      {entry}
                    </span>
                  ))}
                </div>
                {item.href ? (
                  <span className="mt-auto inline-flex w-fit items-center gap-2 rounded-full bg-brand/8 px-3.5 py-2 text-sm font-semibold text-brand transition group-hover:bg-brand group-hover:text-white">
                    {item.external ? '打开链接' : '打开工具'}
                    <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                ) : null}
              </div>
            );

            if (item.external && item.href) {
              return (
                <a key={item.title} href={item.href} target="_blank" rel="noreferrer" className={cardClassName}>
                  {cardContent}
                </a>
              );
            }

            if (item.href) {
              return (
                <Link key={item.title} href={item.href} className={cardClassName}>
                  {cardContent}
                </Link>
              );
            }

            return (
              <article key={item.title} className={cardClassName}>
                {cardContent}
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-7">
        {officialResourceSections.map((section) => {
          const Icon = sectionIcons[section.title as keyof typeof sectionIcons];

          return (
            <div key={section.title} className="surface-card rounded-[34px] p-6 lg:p-8">
              <div className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand/8 text-brand">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">{section.title}</h2>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {section.links.map((item) => (
                  <a
                    key={item.title}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group min-h-[116px] rounded-[22px] border border-slate-100 bg-white/95 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/15 hover:shadow-soft"
                  >
                    <div className="grid h-full grid-cols-[4rem_minmax(0,1fr)] items-center gap-4">
                      <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-slate-50">
                        <ExternalSiteMark
                          source={item.href}
                          label={item.title}
                          size="lg"
                          layout="square"
                        />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-ink">{item.title}</div>
                        <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand">
                          打开入口
                          <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </SiteShell>
  );
}
