import { ArrowUpRight, BookOpenText, Landmark, Wrench } from 'lucide-react';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { officialResourceSections } from '@/lib/portal-data';

const sectionIcons = {
  高频学术工具: BookOpenText,
  官方入口: Landmark,
  常用服务: Wrench
} as const;

export default function ResourcesPage() {
  const heroLinks = officialResourceSections.flatMap((section) => section.links).slice(0, 6);

  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="Resource Toolbox"
        title="资源库"
        subtitle="把高频学术工具、官方入口和常用服务整理成一个可持续回访的保研工具箱。"
      />

      <section className="surface-card rounded-[34px] p-7 lg:p-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div>
            <div className="eyebrow">Stable Toolbox</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink">少一点重复搜索，多一点直接行动。</h2>
            <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600">
              资源库不追求花哨，而是优先整理那些会在申请期被反复打开的网站。你可以把它当成稳定回访的工具层。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {heroLinks.map((item) => (
              <a
                key={item.title}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-[26px] bg-slate-50 px-4 py-4 transition hover:bg-slate-100"
              >
                <div className="flex items-center gap-3">
                  <ExternalSiteMark source={item.href} label={item.title} size="lg" variant="badge" />
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
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{section.description}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {section.links.map((item) => (
                  <a
                    key={item.title}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[28px] border border-black/5 bg-slate-50 p-5 transition hover:-translate-y-1 hover:bg-white hover:shadow-soft"
                  >
                    <div className="flex items-start gap-4">
                      <ExternalSiteMark source={item.href} label={item.title} size="xl" variant="badge" />
                      <div className="min-w-0 flex-1">
                        <div className="text-lg font-semibold text-ink">{item.title}</div>
                        <div className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand shadow-sm">
                          {item.badge}
                        </div>
                        <p className="mt-4 text-sm leading-7 text-slate-600">{item.description}</p>
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
