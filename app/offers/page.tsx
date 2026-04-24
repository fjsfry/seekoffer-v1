'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Flame, Heart, Search, TrendingUp } from 'lucide-react';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { hotKeywords, offerFeedItems, offerMetrics } from '@/lib/portal-data';

export default function OffersPage() {
  const [keyword, setKeyword] = useState('');

  const filteredOffers = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) {
      return offerFeedItems;
    }

    return offerFeedItems.filter((item) =>
      [item.author, item.giveUp, item.goTo, item.message, item.tags.join(' '), item.school]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [keyword]);

  const hotSchools = useMemo(() => {
    const counter = new Map<string, number>();

    offerFeedItems.forEach((item) => {
      counter.set(item.school, (counter.get(item.school) || 0) + item.heat);
    });

    return Array.from(counter.entries())
      .map(([school, heat]) => ({ school, heat }))
      .sort((left, right) => right.heat - left.heat)
      .slice(0, 6);
  }, []);

  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="Offer Flow"
        title="Offer 池"
        subtitle="公开内测阶段先演示 Offer 流动的产品形态；真实发布会接入账号记录、审核、举报与匿名展示。"
      />

      <section className="rounded-[30px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-7 text-amber-900 shadow-soft">
        当前页面为演示数据，用来展示未来 Offer 池的信息结构。请勿将演示内容作为真实补录依据；真实 Offer 发布通道开放前，会先补齐审核、举报和删除机制。
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {offerMetrics.map((item) => (
          <div key={item.label} className="surface-card rounded-[30px] p-5">
            <div className="text-sm text-slate-500">{item.label}</div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-ink">{item.value}</div>
            <div className="mt-2 text-sm leading-6 text-slate-500">{item.hint}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="surface-card rounded-[34px] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                <TrendingUp className="h-4 w-4" />
                热度搜索
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                先搜索学校、方向或补录关键词，再判断是否值得持续跟进。
              </p>
            </div>
            <Link
              href="/publish"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white"
            >
              发布释放 Offer
            </Link>
          </div>

          <div className="mt-5 rounded-[28px] bg-slate-50 p-4">
            <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索学校、专业、去向或留言关键词"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {hotKeywords.map((item) => (
                <button
                  key={item}
                  onClick={() => setKeyword(item)}
                  className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {filteredOffers.map((offer) => (
              <article key={offer.id} className="rounded-[30px] bg-slate-50 p-5">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-sm font-semibold text-white">
                        {offer.avatar}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink">{offer.author}</span>
                          {offer.verified ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              核验样式演示
                            </span>
                          ) : null}
                          <span className="text-xs text-slate-400">{offer.time}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                          {offer.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-white px-3 py-1 shadow-sm">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">放弃：{offer.giveUp}</div>
                      <div className="rounded-2xl bg-brand/10 px-4 py-3 text-sm text-brand">去向：{offer.goTo}</div>
                    </div>

                    <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600">{offer.message}</p>
                  </div>

                  <div className="flex flex-col items-start gap-3 xl:items-end">
                    <span className="inline-flex items-center gap-2 rounded-full bg-brand-cream px-3 py-1 text-xs font-semibold text-brand">
                      <Flame className="h-3.5 w-3.5" />
                      热度 {offer.heat}
                    </span>
                    <button className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
                      <Heart className="h-4 w-4 text-rose-500" />
                      接好运 {offer.likes}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="surface-card rounded-[34px] p-6">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <Flame className="h-4 w-4" />
              热门院校聚合
            </div>
            <div className="mt-5 grid gap-3">
              {hotSchools.map((item, index) => (
                <div key={item.school} className="rounded-[24px] bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-ink">
                        {index + 1}. {item.school}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">近期讨论热度持续上升</div>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand shadow-sm">
                      热度 {item.heat}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-card rounded-[34px] p-6">
            <div className="text-lg font-semibold text-ink">使用建议</div>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Offer 池适合观察候补流动与去向变化。正式版本会标注已核验、未核验和举报状态；涉及报名、截止时间和材料要求时，仍必须核对学校官网。
            </p>
          </div>
        </aside>
      </section>
    </SiteShell>
  );
}
