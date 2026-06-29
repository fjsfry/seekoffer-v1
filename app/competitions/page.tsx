'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Filter,
  Flame,
  Search,
  Trophy
} from 'lucide-react';
import { SiteShell } from '@/components/site-shell';
import {
  competitionDeadlineOptions,
  competitionItems,
  competitionLevelOptions,
  getCompetitionCategories,
  getCompetitionLevelCount,
  type CompetitionItem
} from '@/lib/competitions';

type LevelFilter = (typeof competitionLevelOptions)[number];
type DeadlineFilter = (typeof competitionDeadlineOptions)[number];

export default function CompetitionsPage() {
  const [level, setLevel] = useState<LevelFilter>('全部');
  const [category, setCategory] = useState('全部');
  const [deadline, setDeadline] = useState<DeadlineFilter>('全部');
  const [keyword, setKeyword] = useState('');
  const categories = useMemo(() => getCompetitionCategories(), []);
  const pageStats = useMemo(
    () => [
      { label: '总赛事', value: competitionItems.length, icon: Trophy },
      { label: 'A类官方', value: getCompetitionLevelCount('A类'), icon: CheckCircle2 },
      { label: '热门赛事', value: getCompetitionLevelCount('热门'), icon: Flame }
    ],
    []
  );
  const filteredItems = useMemo(
    () =>
      competitionItems.filter((item) => {
        const normalizedKeyword = keyword.trim().toLowerCase();
        const matchesKeyword =
          !normalizedKeyword ||
          [item.title, item.shortName, item.category, item.organizer]
            .join(' ')
            .toLowerCase()
            .includes(normalizedKeyword);
        const matchesLevel = level === '全部' || item.level === level;
        const matchesCategory =
          category === '全部' ||
          item.category
            .split('/')
            .map((entry) => entry.trim())
            .includes(category);
        const matchesDeadline = matchesDeadlineFilter(item, deadline);

        return matchesKeyword && matchesLevel && matchesCategory && matchesDeadline;
      }),
    [category, deadline, keyword, level]
  );

  return (
    <SiteShell>
      <section className="page-hero grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:px-8">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">
            全国大学生赛事一览
          </h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            覆盖 CAHE A 类、B 类和热门高人气赛事，按级别、类别和报名节点快速筛选。
          </p>
        </div>

        <div className="mx-auto grid w-full max-w-[520px] grid-cols-1 gap-3 sm:grid-cols-3 lg:mx-0 lg:justify-self-center">
          {pageStats.map((item) => {
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

      <section className="surface-card rounded-[32px] p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/8 text-brand">
              <Filter className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-ink">筛选竞赛</h2>
              <p className="mt-1 text-sm text-slate-500">支持赛事级别、专业类别、报名节点和关键词搜索。</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setLevel('全部');
              setCategory('全部');
              setDeadline('全部');
              setKeyword('');
            }}
            className="inline-flex w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-brand/30 hover:text-brand"
          >
            重置筛选
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索赛事名称、简称、类别或主办方"
              className="h-12 w-full rounded-2xl border border-slate-100 bg-white pl-12 pr-4 text-sm font-semibold text-ink outline-none transition placeholder:text-slate-400 focus:border-brand/35 focus:ring-4 focus:ring-brand/8"
            />
          </label>
          <select
            value={deadline}
            onChange={(event) => setDeadline(event.target.value as DeadlineFilter)}
            className="h-12 rounded-2xl border border-slate-100 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-brand/35 focus:ring-4 focus:ring-brand/8"
          >
            {competitionDeadlineOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5 grid gap-4">
          <FilterChips
            label="级别"
            options={competitionLevelOptions}
            value={level}
            onChange={(value) => setLevel(value as LevelFilter)}
          />
          <FilterChips label="类别" options={categories} value={category} onChange={setCategory} />
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 px-1 lg:px-2">
        <div className="text-sm font-semibold text-slate-500">
          当前显示 <span className="text-brand">{filteredItems.length}</span> 个赛事
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs leading-6 text-slate-400">
          <a href="https://www.cahe.edu.cn/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand hover:text-brand-deep">
            CAHE 信息
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
          <Link href="/resources" className="inline-flex items-center gap-1 font-semibold text-brand hover:text-brand-deep">
            资源库材料
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <span>报名和决赛时间每年会变动，最终以赛事官网和学校通知为准。</span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredItems.length ? (
          filteredItems.map((item) => <CompetitionCard key={item.id} item={item} />)
        ) : (
          <div className="surface-card rounded-[28px] px-6 py-12 text-center md:col-span-2 xl:col-span-3">
            <Trophy className="mx-auto h-9 w-9 text-slate-300" />
            <h3 className="mt-4 text-lg font-semibold text-ink">没有匹配的竞赛</h3>
            <p className="mt-2 text-sm leading-7 text-slate-500">可以清空关键词，或放宽级别、类别和截止时间筛选。</p>
          </div>
        )}
      </section>
    </SiteShell>
  );
}

function FilterChips({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none]">
        {options.map((option) => {
          const active = value === option;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`shrink-0 rounded-2xl border px-3.5 py-2 text-sm font-semibold transition ${
                active
                  ? 'border-brand/25 bg-brand text-white shadow-sm'
                  : 'border-slate-100 bg-white text-slate-600 hover:border-brand/20 hover:text-brand'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CompetitionCard({ item }: { item: CompetitionItem }) {
  const deadline = getDateMeta(item);
  const levelTone =
    item.level === 'A类'
      ? 'bg-amber-50 text-amber-700'
      : item.level === 'B类'
        ? 'bg-sky-50 text-sky-600'
        : 'bg-rose-50 text-rose-500';

  return (
    <article className="group relative flex min-h-[270px] flex-col overflow-hidden rounded-[18px] border border-slate-200/70 bg-gradient-to-br from-white via-white to-slate-50/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/15 hover:shadow-soft">
      <Trophy className="pointer-events-none absolute -right-7 top-10 h-36 w-36 text-slate-900/[0.035] transition group-hover:text-brand/[0.055]" />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${levelTone}`}>{item.level}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{item.category}</span>
        </div>
        {item.level === '热门' ? <Flame className="h-5 w-5 shrink-0 text-rose-400" /> : null}
      </div>

      <div className="relative z-10 mt-5 min-w-0">
        <div className="text-sm font-semibold text-brand">{item.shortName || '赛事'}</div>
        <h3 className="mt-2 line-clamp-2 text-xl font-semibold leading-snug text-ink">{item.title}</h3>
      </div>

      <div className="relative z-10 mt-4 grid gap-2 text-sm text-slate-600">
        <div className="flex items-start gap-2">
          <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <span className="line-clamp-2">主办：{item.organizer || '以官网公布为准'}</span>
        </div>
        <div className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <span>{deadline.label}</span>
        </div>
      </div>

      <a
        href={item.officialUrl || '#'}
        target="_blank"
        rel="noreferrer"
        className={`relative z-10 mt-auto inline-flex w-fit items-center gap-2 pt-5 text-sm font-semibold ${
          item.officialUrl ? 'text-brand hover:text-brand-deep' : 'pointer-events-none text-slate-300'
        }`}
      >
        {item.officialUrl ? '前往官网' : '官网待补充'}
        <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </a>
    </article>
  );
}

function matchesDeadlineFilter(item: CompetitionItem, filter: DeadlineFilter) {
  const days = getDaysUntil(item.signupEnd);
  if (filter === '全部') return true;
  if (filter === '有截止时间') return Boolean(item.signupEnd);
  if (filter === '长期准备') return !item.signupEnd && !item.eventStart && !item.eventEnd;
  if (filter === '已过期') return days !== null && days < 0;
  return days !== null && days >= 0 && days <= 30;
}

function getDateMeta(item: CompetitionItem) {
  const days = getDaysUntil(item.signupEnd);

  if (item.signupEnd) {
    if (days !== null && days >= 0) {
      return { label: `报名截止：${item.signupEnd}（剩余 ${days} 天）` };
    }

    return { label: `报名截止：${item.signupEnd}` };
  }

  if (item.eventStart) {
    return { label: `赛事时间：${item.eventStart}${item.eventEnd ? ` 至 ${item.eventEnd}` : ''}` };
  }

  return { label: '长期准备：关注官网年度通知' };
}

function getDaysUntil(value: string) {
  if (!value) return null;
  const timestamp = new Date(`${value}T23:59:59+08:00`).getTime();
  if (Number.isNaN(timestamp)) return null;
  return Math.ceil((timestamp - Date.now()) / 86400000);
}
