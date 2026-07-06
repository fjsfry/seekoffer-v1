import type { Metadata } from 'next';
import { ArrowRight, HelpCircle, MessageCircle, Search, ShieldCheck } from 'lucide-react';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { QQ_GROUP_NUMBER, QQ_GROUP_URL } from '@/lib/contact';
import { faqGroups } from '@/lib/help-content';
import { absoluteUrl, jsonLdScript } from '@/lib/seo';

export const metadata: Metadata = {
  title: '常见问题 - Seekoffer',
  description: 'Seekoffer 常见问题：新手使用、通知数据、账号工作台、功能说明与反馈渠道说明。',
  alternates: {
    canonical: '/faq'
  },
  openGraph: {
    title: 'Seekoffer 常见问题',
  description: '保研通知、申请工作台、通知整理和反馈方式常见问题。',
    url: '/faq',
    siteName: '寻鹿 Seekoffer',
    images: ['/logo.png'],
    locale: 'zh_CN',
    type: 'website'
  }
};

export default function FaqPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqGroups.flatMap((group) =>
      group.items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer
        }
      }))
    ),
    url: absoluteUrl('/faq')
  };

  return (
    <SiteShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(faqJsonLd)} />
      <section className="page-hero grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:px-8">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">常见问题</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">集中说明通知整理、报名入口、工作台保存和反馈方式。</p>
        </div>

        <div className="mx-auto grid w-full max-w-[520px] grid-cols-1 gap-3 sm:grid-cols-3 lg:mx-0 lg:justify-self-center">
          {[
            ['新手使用', HelpCircle],
            ['数据说明', Search],
            ['反馈渠道', MessageCircle]
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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-6">
          {faqGroups.map((group) => (
            <section key={group.id} id={group.id} className="surface-card scroll-mt-28 rounded-[34px] p-6 md:p-8">
              <PageSectionTitle eyebrow="问题分类" title={group.title} subtitle={group.description} />
              <div className="grid gap-4">
                {group.items.map((item) => (
                  <div key={item.question} className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-cream text-brand">
                        <HelpCircle className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="text-lg font-semibold text-ink">{item.question}</div>
                        <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="grid content-start gap-6">
          <section className="surface-card rounded-[34px] p-6">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <Search className="h-4 w-4" />
              推荐排查顺序
            </div>
            <div className="mt-5 grid gap-3 text-sm leading-7 text-slate-600">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">先确认是否已经登录，工作台和加入申请表都需要账号状态。</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">再确认完整通知与报名入口是否为同一个页面，部分院校会分开设置。</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">最后通过 QQ 群或反馈入口提交截图，方便我们复现问题。</div>
            </div>
          </section>

          <section className="surface-card rounded-[34px] p-6">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <ShieldCheck className="h-4 w-4" />
              重要提醒
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Seekoffer 会持续整理公开通知，但正式报名、材料要求和截止时间，仍建议在提交前核对学校页面与报名系统。
            </p>
          </section>

          <section className="surface-card rounded-[34px] p-6">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <MessageCircle className="h-4 w-4" />
              仍然没解决？
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              加入 QQ 群 {QQ_GROUP_NUMBER}，说明你在哪个页面、点击了哪个按钮、出现了什么结果。
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
    </SiteShell>
  );
}
