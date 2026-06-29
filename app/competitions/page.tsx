'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Filter,
  Flame,
  GraduationCap,
  Layers3,
  Sparkles,
  Trophy
} from 'lucide-react';
import { SiteShell } from '@/components/site-shell';
import {
  competitionDeadlineOptions,
  competitionItems,
  competitionLevelOptions,
  getCompetitionCategories
} from '@/lib/competitions';

type LevelFilter = (typeof competitionLevelOptions)[number];
type DeadlineFilter = (typeof competitionDeadlineOptions)[number];

export default function CompetitionsPage() {
  const [level, setLevel] = useState<LevelFilter>('全部');
  const [category, setCategory] = useState('全部');
  const [deadline, setDeadline] = useState<DeadlineFilter>('全部');
  const [hotOnly, setHotOnly] = useState(false);
  const categories = useMemo(() => getCompetitionCategories(), []);
  const filteredItems = useMemo(
    () =>
      competitionItems.filter((item) => {
        const matchesLevel = level === '全部' || item.level === level;
        const matchesCategory = category === '全部' || item.category === category;
        const matchesDeadline = deadline === '全部' || item.deadlineWindow === deadline;
        const matchesHot = hotOnly ? item.hot : true;

        return matchesLevel && matchesCategory && matchesDeadline && matchesHot;
      }),
    [category, deadline, hotOnly, level]
  );

  return (
    <SiteShell>
      <section className="page-hero grid gap-7 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:px-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
            <Trophy className="h-4 w-4" />
            背景提升入口
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-ink md:text-5xl">竞赛库</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            先把保研常见竞赛结构化：A 类、B 类、热门、专业类别和准备节点。这里不做社区内容，先帮助你判断哪些经历值得投入。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/resources" className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-float transition hover:bg-brand-deep">
              去资源库准备材料
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/majors" className="inline-flex items-center gap-2 rounded-2xl border border-brand/20 bg-white px-5 py-3 text-sm font-semibold text-brand shadow-sm transition hover:border-brand/40">
              按专业找机会
              <GraduationCap className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {[
            { label: '结构化竞赛', value: competitionItems.length, icon: Layers3 },
            { label: '热门入口', value: competitionItems.filter((item) => item.hot).length, icon: Flame },
            { label: '专业类别', value: categories.length - 1, icon: Sparkles }
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.label} className="soft-stat-pill rounded-[28px] px-5 py-4">
                <div className="flex items-center gap-4">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/8 text-brand">
                    <Icon className="h-6 w-6" />
                  </span>
                  <div>
                    <div className="text-sm text-slate-500">{item.label}</div>
                    <div className="mt-1 text-2xl font-semibold text-ink">{item.value}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="surface-card rounded-[32px] p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/8 text-brand">
              <Filter className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-ink">筛选竞赛</h2>
              <p className="mt-1 text-sm text-slate-500">按保研材料价值和准备节奏先做初筛。</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setLevel('全部');
              setCategory('全部');
              setDeadline('全部');
              setHotOnly(false);
            }}
            className="inline-flex w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-brand/30 hover:text-brand"
          >
            重置筛选
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-4">
          <FilterGroup title="竞赛等级" options={competitionLevelOptions} value={level} onChange={(value) => setLevel(value as LevelFilter)} />
          <FilterGroup title="专业类别" options={categories} value={category} onChange={setCategory} />
          <FilterGroup title="截止节点" options={competitionDeadlineOptions} value={deadline} onChange={(value) => setDeadline(value as DeadlineFilter)} />
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-500">热门</div>
            <button
              type="button"
              onClick={() => setHotOnly((current) => !current)}
              className={`inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition ${
                hotOnly ? 'border-amber-200 bg-amber-50 text-amber-700 shadow-sm' : 'border-slate-100 bg-white text-slate-600 hover:border-brand/20 hover:text-brand'
              }`}
            >
              <Flame className="h-4 w-4" />
              只看热门
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredItems.map((item) => (
          <CompetitionCard key={item.id} item={item} />
        ))}
      </section>
    </SiteShell>
  );
}

function FilterGroup({
  title,
  options,
  value,
  onChange
}: {
  title: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold text-slate-500">{title}</div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[46px] w-full rounded-2xl border border-slate-100 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-brand/35 focus:ring-4 focus:ring-brand/8"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function CompetitionCard({ item }: { item: (typeof competitionItems)[number] }) {
  return (
    <article className="group flex min-h-[390px] flex-col rounded-[28px] border border-slate-100 bg-white/95 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/15 hover:shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.level === 'A类' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-600'}`}>
          {item.level}
        </span>
        {item.hot ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-500">
            <Flame className="h-3.5 w-3.5" />
            热门
          </span>
        ) : null}
      </div>
      <h3 className="mt-5 text-xl font-semibold leading-snug text-ink">{item.title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-500">{item.summary}</p>

      <div className="mt-4 grid gap-2 text-sm">
        <div className="flex items-start gap-2 text-slate-600">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <span>准备节点：{item.deadlineWindow}，具体截止以学校或主办方当年通知为准。</span>
        </div>
        <div className="flex items-start gap-2 text-slate-600">
          <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <span>{item.organizer}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from(new Set([item.category, ...item.fitFor])).slice(0, 4).map((tag) => (
          <span key={tag} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-5 rounded-[22px] bg-slate-50/80 p-4">
        <div className="text-xs font-semibold text-slate-500">申请材料里怎么用</div>
        <div className="mt-3 grid gap-2">
          {item.preparation.map((entry) => (
            <div key={entry} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <CheckCircle2 className="h-4 w-4 text-brand" />
              {entry}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-auto pt-5 text-sm leading-7 text-slate-600">{item.nextAction}</p>
    </article>
  );
}
