import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, HelpCircle, MessageCircle, Search, ShieldCheck } from 'lucide-react';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { QQ_GROUP_NUMBER, QQ_GROUP_URL } from '@/lib/contact';
import { faqGroups } from '@/lib/help-content';

export const metadata: Metadata = {
  title: '常见问题 - Seekoffer',
  description: 'Seekoffer 常见问题：新手使用、通知数据、账号工作台、内测功能与反馈渠道说明。'
};

export default function FaqPage() {
  return (
    <SiteShell>
      <section className="page-hero px-6 py-8 md:px-10 md:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div>
            <div className="eyebrow w-fit">常见问题</div>
            <h1 className="title-balance mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-ink md:text-5xl">
              使用中遇到疑问，先看这里
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-9 text-slate-600">
              这里把新用户最容易困惑的问题集中说明，包括通知来源、报名入口、工作台保存、内测功能和反馈方式。
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/guide"
                className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-float transition hover:-translate-y-0.5 hover:bg-brand-deep"
              >
                查看使用指南
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={QQ_GROUP_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-brand shadow-sm transition hover:-translate-y-0.5"
              >
                加入 QQ 群
              </a>
            </div>
          </div>

          <div className="rounded-[30px] border border-brand/10 bg-white/88 p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white">
                <HelpCircle className="h-6 w-6" />
              </div>
              <div>
                <div className="font-semibold text-ink">快速定位问题</div>
                <div className="mt-1 text-sm text-slate-500">按场景分类，先解决最常见的使用阻塞</div>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              {faqGroups.map((group) => (
                <a
                  key={group.title}
                  href={`#${group.id}`}
                  className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-brand-cream hover:text-brand"
                >
                  {group.title}
                  <ArrowRight className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
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
              <div className="rounded-2xl bg-slate-50 px-4 py-3">再确认原文通知与报名入口是否为同一个页面，部分院校会分开设置。</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">最后通过 QQ 群或反馈入口提交截图，方便我们复现问题。</div>
            </div>
          </section>

          <section className="surface-card rounded-[34px] p-6">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <ShieldCheck className="h-4 w-4" />
              重要提醒
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Seekoffer 会持续整理公开通知，但正式报名、材料要求和截止时间，仍以院校官方原文为准。
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
