import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { aboutOriginParagraphs, aboutPrinciples, aboutVisionParagraphs } from '@/lib/site-content';

export default function AboutPage() {
  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="About Seekoffer"
        title="关于我们"
        subtitle="寻鹿希望成为保研与升学申请过程中的个人作战台，让信息获取、节奏管理和关键决策都更清楚。"
      />

      <section className="surface-card rounded-[34px] p-7">
        <h2 className="text-2xl font-semibold text-ink">我们坚持的三件事</h2>
        <div className="mt-6 grid gap-4">
          {aboutPrinciples.map((item) => (
            <div key={item.title} className="rounded-[28px] bg-slate-50 px-5 py-5">
              <div className="text-lg font-semibold text-ink">{item.title}</div>
              <p className="mt-3 text-sm leading-8 text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-card rounded-[34px] p-7">
        <h2 className="text-2xl font-semibold text-ink">寻鹿想成为怎样的产品</h2>
        <div className="mt-5 grid gap-4 text-sm leading-8 text-slate-600">
          {aboutVisionParagraphs.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </section>

      <section className="surface-card rounded-[34px] p-7">
        <h2 className="text-2xl font-semibold text-ink">寻鹿 Seekoffer 诞生于一个很真实的问题</h2>
        <div className="mt-5 grid gap-4 text-sm leading-8 text-slate-600">
          {aboutOriginParagraphs.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
