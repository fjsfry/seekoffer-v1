'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BadgeCheck,
  Edit3,
  FileText,
  Flag,
  Flame,
  Heart,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  University
} from 'lucide-react';
import { SiteShell } from '@/components/site-shell';
import {
  fetchPublicOffers,
  formatOfferTime,
  getOfferAuthorLabel,
  getOfferAvatar,
  offerResultTypes,
  reportOfferPost,
  type OfferResultType,
  type PublicOffer
} from '@/lib/offers';
import { useUserSessionState } from '@/hooks/use-user-session';

const tabs = ['全部', ...offerResultTypes] as const;

const resultTone: Record<OfferResultType, string> = {
  录取: 'bg-emerald-50 text-brand',
  放弃: 'bg-rose-50 text-rose-600',
  候补: 'bg-amber-50 text-amber-700',
  补录传闻: 'bg-orange-50 text-orange-700',
  官方确认: 'bg-blue-50 text-blue-700'
};

export default function OffersPage() {
  const { session } = useUserSessionState();
  const [keyword, setKeyword] = useState('');
  const [tab, setTab] = useState<(typeof tabs)[number]>('全部');
  const [offers, setOffers] = useState<PublicOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('正在连接 Supabase Offer 池...');
  const [reportingId, setReportingId] = useState<string | null>(null);

  useEffect(() => {
    void loadOffers();
  }, []);

  async function loadOffers() {
    setLoading(true);
    setMessage('正在读取已审核通过的真实 Offer 动态...');

    try {
      const data = await fetchPublicOffers();
      setOffers(data);
      setMessage(data.length ? `已展示 ${data.length} 条审核通过的 Offer 动态。` : '当前还没有审核通过的 Offer 动态。');
    } catch (error) {
      setOffers([]);
      setMessage(error instanceof Error ? error.message : 'Offer 池读取失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }

  const filteredOffers = useMemo(() => {
    const query = keyword.trim().toLowerCase();

    return offers.filter((item) => {
      const matchesQuery = query
        ? [item.authorName, item.schoolName, item.major, item.projectType, item.result, item.undergraduateBackground, item.content]
            .join(' ')
            .toLowerCase()
            .includes(query)
        : true;
      const matchesTab = tab === '全部' ? true : item.result === tab;

      return matchesQuery && matchesTab;
    });
  }, [keyword, offers, tab]);

  const hotSchools = useMemo(() => {
    const counter = new Map<string, number>();

    offers.forEach((item) => {
      if (item.schoolName) {
        counter.set(item.schoolName, (counter.get(item.schoolName) || 0) + 1);
      }
    });

    return Array.from(counter.entries())
      .map(([school, count]) => ({ school, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5);
  }, [offers]);

  const hotKeywords = useMemo(() => {
    const words = new Set<string>();

    offers.slice(0, 20).forEach((item) => {
      if (item.schoolName) words.add(item.schoolName);
      if (item.major) words.add(item.major);
      if (item.projectType) words.add(item.projectType);
    });

    return Array.from(words).slice(0, 8);
  }, [offers]);

  const metrics = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentCount = offers.filter((item) => new Date(item.createdAt).getTime() >= weekAgo).length;
    const schoolCount = new Set(offers.map((item) => item.schoolName).filter(Boolean)).size;

    return [
      { label: '公开动态', value: String(offers.length), hint: '仅展示后台审核通过内容', icon: FileText },
      { label: '近 7 天新增', value: String(recentCount), hint: '按发布时间统计', icon: Flame },
      { label: '覆盖院校', value: String(schoolCount), hint: '来自用户真实提交', icon: University }
    ];
  }, [offers]);

  async function handleReport(offer: PublicOffer) {
    const reason = window.prompt('请说明举报原因，例如：疑似虚假、泄露隐私、联系方式引流或内容误导。');
    if (!reason) {
      return;
    }

    setReportingId(offer.id);
    setMessage('正在提交举报...');

    try {
      await reportOfferPost(offer.id, reason, session?.userId);
      setMessage('举报已提交，后台会在 Offer 审核工作台中处理。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '举报提交失败，请稍后重试。');
    } finally {
      setReportingId(null);
    }
  }

  return (
    <SiteShell>
      <section className="page-hero grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center lg:px-8">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">Offer池</h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            用低噪音、可纠错的方式分享录取、放弃、候补和补录动态。内容提交后先进入后台审核，通过后才会公开展示。
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

      <section className="grid gap-5 lg:grid-cols-3">
        {metrics.map((item) => {
          const Icon = item.icon || TrendingUp;

          return (
            <div key={item.label} className="product-card rounded-[26px] p-6">
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
        <div className="product-card rounded-[30px] p-6">
          <div className="flex flex-col gap-5 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {tabs.map((item) => (
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
                placeholder="搜索学校、专业或背景"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 lg:w-52"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {hotKeywords.map((item) => (
              <button
                key={item}
                onClick={() => setKeyword(item)}
                className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-brand/8 hover:text-brand"
              >
                {item}
              </button>
            ))}
            <button
              onClick={() => void loadOffers()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 transition hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-500">{message}</div>

          <div className="mt-5 grid gap-4">
            {loading ? <OfferListSkeleton /> : null}

            {!loading && filteredOffers.map((offer) => <OfferCard key={offer.id} offer={offer} reportingId={reportingId} onReport={handleReport} />)}

            {!loading && !filteredOffers.length ? (
              <div className="rounded-[20px] border border-dashed border-slate-200 px-6 py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/8 text-brand">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-ink">暂无匹配的 Offer 动态</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500">
                  你可以换个关键词，或者发布一条真实动态。提交后会先进入后台审核，通过后展示在这里。
                </p>
                <Link href="/publish" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white">
                  去发布
                  <Edit3 className="h-4 w-4" />
                </Link>
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
              {hotSchools.length ? (
                hotSchools.map((item, index) => (
                  <button key={item.school} onClick={() => setKeyword(item.school)} className="flex items-center justify-between gap-4 text-left text-sm">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="w-4 text-slate-400">{index + 1}</span>
                      <span className="truncate font-semibold text-slate-700">{item.school}</span>
                    </span>
                    <span className="text-slate-500">{item.count}</span>
                  </button>
                ))
              ) : (
                <p className="text-sm leading-7 text-slate-500">审核通过的动态累积后，这里会自动展示被提及最多的院校。</p>
              )}
            </div>
          </div>

          <div className="product-card rounded-[22px] p-6">
            <h2 className="text-lg font-semibold text-ink">社区说明</h2>
            <div className="mt-5 grid gap-5">
              {[
                ['真实有价值', '分享自己的录取、放弃、候补和补录观察，避免夸张标题和二手传闻。'],
                ['隐私先行', '不要发布身份证、手机号、微信号、导师私人信息或可识别他人的材料截图。'],
                ['可纠错', '发现疑似虚假、误导或引流内容时直接举报，后台会留痕处理。']
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
            </Link>
          </div>
        </aside>
      </section>
    </SiteShell>
  );
}

function OfferCard({ offer, reportingId, onReport }: { offer: PublicOffer; reportingId: string | null; onReport: (offer: PublicOffer) => void }) {
  const authorLabel = getOfferAuthorLabel(offer);

  return (
    <article className="relative overflow-hidden rounded-[24px] border border-slate-100 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand/15 hover:shadow-soft">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-semibold text-white">
          {getOfferAvatar(authorLabel)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">{authorLabel}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-brand">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  已审核
                </span>
                {offer.isAnonymous ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">匿名展示</span>
                ) : null}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {offer.major} · {offer.projectType}
              </div>
            </div>
            <button
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={reportingId === offer.id}
              onClick={() => onReport(offer)}
            >
              {reportingId === offer.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
              举报
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${resultTone[offer.result]}`}>
              {offer.result}
            </span>
            <span className="text-base font-semibold text-ink">{offer.schoolName}</span>
          </div>

          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600">
            <span className="font-semibold text-slate-700">本科背景：</span>
            {offer.undergraduateBackground}
          </div>

          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">{offer.content}</p>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
            <span>{formatOfferTime(offer.createdAt)}</span>
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                <ShieldCheck className="h-4 w-4 text-brand" />
                后台审核后公开
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 font-semibold text-brand">
                <Heart className="h-4 w-4" />
                {offer.reportsCount ? `举报 ${offer.reportsCount}` : '可纠错'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function OfferListSkeleton() {
  return (
    <>
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-[24px] border border-slate-100 bg-white p-5">
          <div className="flex gap-4">
            <div className="h-14 w-14 rounded-full bg-slate-100" />
            <div className="flex-1 space-y-4">
              <div className="h-4 w-48 rounded bg-slate-100" />
              <div className="h-8 w-64 rounded bg-slate-100" />
              <div className="h-16 rounded-xl bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
