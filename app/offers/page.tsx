'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Edit3,
  FileText,
  Flame,
  Heart,
  MoreVertical,
  Search,
  ShieldCheck,
  TrendingUp,
  University
} from 'lucide-react';
import { SiteShell } from '@/components/site-shell';
import { hotKeywords, offerFeedItems, offerMetrics } from '@/lib/portal-data';

export default function OffersPage() {
  const [keyword, setKeyword] = useState('');
  const [tab, setTab] = useState('全部');

  const filteredOffers = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return offerFeedItems.filter((item) => {
      const matchesQuery = query
        ? [item.author, item.giveUp, item.goTo, item.message, item.tags.join(' '), item.school]
            .join(' ')
            .toLowerCase()
            .includes(query)
        : true;
      const matchesTab = tab === '全部' ? true : item.type === tab;

      return matchesQuery && matchesTab;
    });
  }, [keyword, tab]);

  const hotSchools = useMemo(() => {
    const counter = new Map<string, number>();

    offerFeedItems.forEach((item) => {
      counter.set(item.school, (counter.get(item.school) || 0) + item.heat);
    });

    return Array.from(counter.entries())
      .map(([school, heat]) => ({ school, heat }))
      .sort((left, right) => right.heat - left.heat)
      .slice(0, 5);
  }, []);

  const metricIcons = [FileText, Flame, University];

  return (
    <SiteShell>
      <section className="grid gap-6 py-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">Offer池</h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            分享你的录取、放弃、补录动态，帮助更多同学少走弯路。
          </p>
        </div>
        <Link
          href="/publish"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-4 text-sm font-semibold text-white shadow-float transition hover:-translate-y-0.5 hover:bg-brand-deep"
        >
          <Edit3 className="h-5 w-5" />
          发布动态
        </Link>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-7 text-amber-900">
        本信息仅供参考，请结合自身情况理性决策。涉及个人隐私、联系方式或敏感账户内容将进行审核处理。
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {offerMetrics.map((item, index) => {
          const Icon = metricIcons[index] || TrendingUp;

          return (
            <div key={item.label} className="product-card rounded-[22px] p-6">
              <div className="flex items-center gap-5">
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand/8 text-brand">
                  <Icon className="h-7 w-7" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-600">{item.label}</div>
                  <div className="mt-2 text-3xl font-semibold text-ink">{item.value}</div>
                  <div className="mt-2 text-sm text-slate-500">{item.hint}</div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="product-card rounded-[24px] p-6">
          <div className="flex flex-col gap-5 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {['全部', '录取', '放弃', '补录'].map((item) => (
                <button
                  key={item}
                  onClick={() => setTab(item)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    tab === item ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索学校、专业或去向"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 lg:w-52"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {hotKeywords.map((item) => (
              <button
                key={item}
                onClick={() => setKeyword(item)}
                className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-brand/8 hover:text-brand"
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4">
            {filteredOffers.map((offer) => (
              <article key={offer.id} className="rounded-[20px] border border-slate-100 bg-white p-5 transition hover:shadow-soft">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-semibold text-white">
                    {offer.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink">{offer.author}</span>
                          {offer.verified ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-brand">
                              <BadgeCheck className="h-3.5 w-3.5" />
                              已实名
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">{offer.major} · 硕士</div>
                      </div>
                      <button className="text-slate-400 transition hover:text-brand" aria-label="更多操作">
                        <MoreVertical className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                          offer.type === '放弃'
                            ? 'bg-rose-50 text-rose-600'
                            : offer.type === '补录'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-emerald-50 text-brand'
                        }`}
                      >
                        {offer.type}
                      </span>
                      <span className="text-base font-semibold text-ink">{offer.type === '放弃' ? offer.giveUp : offer.goTo}</span>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      研究方向：{offer.field} | 2025 秋季入学 | 硕士
                    </div>

                    <p className="mt-4 text-sm leading-7 text-slate-600">{offer.message}</p>

                    <div className="mt-5 flex items-center justify-between gap-4 text-sm text-slate-500">
                      <span>{offer.time}</span>
                      <div className="flex items-center gap-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                          <Flame className="h-4 w-4 text-brand" />
                          关注 {offer.heat}
                        </span>
                        <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 font-semibold text-brand">
                          <Heart className="h-4 w-4" />
                          我也关注
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}

            {!filteredOffers.length ? (
              <div className="rounded-[20px] border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">
                暂无匹配动态，换个关键词试试。
              </div>
            ) : null}
          </div>
        </div>

        <aside className="grid content-start gap-5">
          <div className="product-card rounded-[22px] p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">热门院校</h2>
              <Link href="/colleges" className="text-sm font-semibold text-slate-500 hover:text-brand">
                更多
              </Link>
            </div>
            <div className="grid gap-4">
              {hotSchools.map((item, index) => (
                <div key={item.school} className="flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-4 text-slate-400">{index + 1}</span>
                    <span className="font-semibold text-slate-700">{item.school}</span>
                  </div>
                  <span className="text-slate-500">{item.heat}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="product-card rounded-[22px] p-6">
            <h2 className="text-lg font-semibold text-ink">社区说明</h2>
            <div className="mt-5 grid gap-5">
              {[
                ['真实有价值', '鼓励分享真实录取、放弃与补录信息，帮助彼此比较。'],
                ['尊重与友善', '请保持善意交流，禁止人身攻击与负面造谣。'],
                ['隐私保护', '请勿发布个人隐私、联系方式等敏感信息，违规将被处理。']
              ].map(([title, text]) => (
                <div key={title} className="flex gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/8 text-brand">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-ink">{title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/community" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand">
              查看完整社区规范
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </aside>
      </section>
    </SiteShell>
  );
}
