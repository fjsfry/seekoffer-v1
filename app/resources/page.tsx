import { ArrowUpRight, BookOpenText, Calculator, CheckCircle2, ClipboardList, FileText, Landmark, Mail, Wrench } from 'lucide-react';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { PageSectionTitle } from '@/components/page-section-title';
import { ProductHeroVisual } from '@/components/product-hero-visual';
import { SiteShell } from '@/components/site-shell';
import { officialResourceSections } from '@/lib/portal-data';

const squareMarkDomains = new Set([
  'cas.cn',
  'chsi.com.cn',
  'daoshipingjia.net',
  'deepl.com',
  'grammarly.com',
  'notion.so',
  'obsidian.md',
  'overleaf.com',
  'xmind.app'
]);

function getResourceMarkLayout(source: string) {
  try {
    const domain = new URL(source).hostname.replace(/^www\./, '');
    return squareMarkDomains.has(domain) ? 'square' : 'landscape';
  } catch {
    return 'landscape';
  }
}

const sectionIcons = {
  高频学术工具: BookOpenText,
  官方入口: Landmark,
  常用服务: Wrench
} as const;

const applicationKits = [
  {
    title: '夏令营材料清单',
    description: '简历、成绩单、排名证明、推荐信请求和个人陈述，一次性检查。',
    items: ['材料 Checklist', '命名规范', '提交前自查'],
    icon: ClipboardList
  },
  {
    title: '个人陈述模板',
    description: '按科研经历、项目经历、目标方向和未来规划组织内容。',
    items: ['结构模板', '常见问题', '修改提示'],
    icon: FileText
  },
  {
    title: '导师邮件模板',
    description: '覆盖初次联系、补充材料、礼貌跟进和面试后感谢。',
    items: ['首封邮件', '跟进邮件', '附件清单'],
    icon: Mail
  },
  {
    title: 'GPA 与材料工具',
    description: '把申请期反复计算和检查的事情工具化，减少低价值重复劳动。',
    items: ['GPA 换算', '材料进度', '截止提醒'],
    icon: Calculator
  }
];

export default function ResourcesPage() {
  const heroLinks = officialResourceSections.flatMap((section) => section.links).slice(0, 6);

  return (
    <SiteShell>
      <section className="grid gap-8 py-5 lg:grid-cols-[minmax(0,1fr)_410px] lg:items-center">
        <PageSectionTitle
          eyebrow="Resource Toolbox"
          title="资源库"
          subtitle="常用学术工具、官方入口和申请服务，一页直达。"
        />
        <ProductHeroVisual variant="resource" compact />
      </section>

      <section className="surface-card rounded-[34px] p-7 lg:p-8">
        <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
          <div>
            <div className="eyebrow">Quick Access</div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink">高频入口</h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">把申请期反复打开的网站放在最前面。</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {heroLinks.map((item) => (
              <a
                key={item.title}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/15 hover:shadow-soft"
              >
                <div className="flex items-center gap-3">
                  <ExternalSiteMark
                    source={item.href}
                    label={item.title}
                    size="lg"
                    layout={getResourceMarkLayout(item.href)}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{item.title}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">{item.badge}</div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="surface-card rounded-[34px] p-7 lg:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow">Application Center</div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink">申请资料中心</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
              资源库不只做网址导航，也会逐步沉淀模板、清单和工具，让每次准备材料都少走一步弯路。
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-cream px-4 py-2 text-xs font-semibold text-brand">
            <CheckCircle2 className="h-4 w-4" />
            内测中，持续补齐
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {applicationKits.map((item) => {
            const Icon = item.icon;

            return (
              <article key={item.title} className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/8 text-brand">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-ink">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">{item.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.items.map((entry) => (
                    <span key={entry} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                      {entry}
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-8">
        {officialResourceSections.map((section) => {
          const Icon = sectionIcons[section.title as keyof typeof sectionIcons];

          return (
            <div key={section.title} className="surface-card rounded-[34px] p-6 lg:p-7">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                    <Icon className="h-4 w-4" />
                    {section.title}
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold text-ink">{section.title}</h3>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {section.links.map((item) => (
                  <a
                    key={item.title}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-brand/15 hover:shadow-soft"
                  >
                    <div className="flex items-start gap-4">
                      <ExternalSiteMark
                        source={item.href}
                        label={item.title}
                        size="xl"
                        layout={getResourceMarkLayout(item.href)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-lg font-semibold text-ink">{item.title}</div>
                        <div className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand shadow-sm">
                          {item.badge}
                        </div>
                        <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand">
                          打开入口
                          <ArrowUpRight className="h-4 w-4" />
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
