'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Filter,
  Flame,
  RotateCcw,
  Search,
  Trophy,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { SiteShell } from '@/components/site-shell';
import {
  competitionItems,
  competitionLevelOptions,
  getCompetitionCategories,
  getCompetitionLevelCount,
  type CompetitionItem
} from '@/lib/competitions';

type LevelFilter = (typeof competitionLevelOptions)[number];

type CompetitionFilters = {
  level: LevelFilter;
  category: string;
  keyword: string;
};

const CATEGORY_PREVIEW_LIMIT = 18;
const PAGE_SIZE = 18;

export default function CompetitionsPage() {
  const [level, setLevel] = useState<LevelFilter>('全部');
  const [category, setCategory] = useState('全部');
  const [keyword, setKeyword] = useState('');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const categories = useMemo(() => getCompetitionCategories(), []);
  const filters = useMemo<CompetitionFilters>(
    () => ({ level, category, keyword }),
    [category, keyword, level]
  );
  const pageStats = useMemo(
    () => [
      { label: '总赛事', value: competitionItems.length, icon: Trophy },
      { label: 'A类官方', value: getCompetitionLevelCount('A类'), icon: CheckCircle2 },
      { label: '热门赛事', value: getCompetitionLevelCount('热门'), icon: Flame }
    ],
    []
  );
  const filteredItems = useMemo(
    () => competitionItems.filter((item) => matchesCompetitionFilters(item, filters)),
    [filters]
  );
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pageItems = useMemo(
    () => filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, filteredItems]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [category, keyword, level]);

  useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [currentPage, pageCount]);
  const levelCounts = useMemo(
    () => buildFilterCounts(competitionLevelOptions, filters, 'level'),
    [filters]
  );
  const categoryCounts = useMemo(
    () => buildFilterCounts(categories, filters, 'category'),
    [categories, filters]
  );
  const orderedCategories = useMemo(() => {
    const [allOption, ...restOptions] = categories;

    return [
      allOption,
      ...restOptions.sort((left, right) => {
        const countDelta = (categoryCounts.get(right) ?? 0) - (categoryCounts.get(left) ?? 0);
        return countDelta || left.localeCompare(right, 'zh-CN');
      })
    ];
  }, [categories, categoryCounts]);
  const categoryPreviewOptions = useMemo(() => {
    if (showAllCategories) return orderedCategories;

    const preview = orderedCategories.slice(0, CATEGORY_PREVIEW_LIMIT);
    if (category !== '全部' && !preview.includes(category)) {
      return [...preview, category];
    }

    return preview;
  }, [category, orderedCategories, showAllCategories]);
  const activeFilterLabels = useMemo(
    () =>
      [
        level !== '全部' ? `级别：${level}` : '',
        category !== '全部' ? `类别：${category}` : '',
        keyword.trim() ? `关键词：${keyword.trim()}` : ''
      ].filter(Boolean),
    [category, keyword, level]
  );
  const hasActiveFilters = activeFilterLabels.length > 0;
  const hiddenCategoryCount = Math.max(orderedCategories.length - CATEGORY_PREVIEW_LIMIT, 0);

  const resetFilters = () => {
    setLevel('全部');
    setCategory('全部');
    setKeyword('');
    setShowAllCategories(false);
  };

  return (
    <SiteShell>
      <section className="page-hero grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:px-8">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">
            全国大学生赛事一览
          </h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            覆盖 CAHE A 类、B 类和热门高人气赛事，按级别、类别和关键词快速筛选。
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

      <section className="surface-card overflow-hidden rounded-[32px] p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/8 text-brand">
              <Filter className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-ink">筛选竞赛</h2>
              <p className="mt-1 text-sm text-slate-500">支持赛事级别、专业类别和关键词搜索。</p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
            className="inline-flex w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-brand/30 hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RotateCcw className="h-4 w-4" />
            重置筛选
          </button>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索赛事名称、简称、类别或主办方"
              className="h-12 w-full rounded-2xl border border-slate-100 bg-white pl-12 pr-4 text-sm font-semibold text-ink outline-none transition placeholder:text-slate-400 focus:border-brand/35 focus:ring-4 focus:ring-brand/8"
            />
          </label>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm font-semibold text-slate-600">
            当前显示 <span className="text-brand">{filteredItems.length}</span>
            <span className="mx-1 text-slate-300">/</span>
            {competitionItems.length} 个赛事
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-slate-100 bg-slate-50/60 p-4">
          <div className="grid gap-4">
            <FilterChips
              label="级别"
              options={competitionLevelOptions}
              value={level}
              counts={levelCounts}
              onChange={(value) =>
                setLevel((current) => (current === value && value !== '全部' ? '全部' : (value as LevelFilter)))
              }
            />
            <FilterChips
              label="专业类别"
              options={categoryPreviewOptions}
              value={category}
              counts={categoryCounts}
              onChange={(value) => setCategory((current) => (current === value && value !== '全部' ? '全部' : value))}
            />
            {hiddenCategoryCount > 0 ? (
              <button
                type="button"
                onClick={() => setShowAllCategories((current) => !current)}
                className="inline-flex w-fit items-center gap-1 rounded-2xl bg-white px-3.5 py-2 text-xs font-semibold text-brand shadow-sm ring-1 ring-slate-100 transition hover:ring-brand/20"
              >
                {showAllCategories ? '收起类别' : `展开全部类别（还有 ${hiddenCategoryCount} 个）`}
                <ChevronDown className={`h-3.5 w-3.5 transition ${showAllCategories ? 'rotate-180' : ''}`} />
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 px-1 lg:px-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
          <span>
            当前显示 <span className="text-brand">{filteredItems.length}</span> 个赛事
          </span>
          {activeFilterLabels.map((item) => (
            <span key={item} className="rounded-full bg-white/85 px-3 py-1 text-xs text-brand shadow-sm ring-1 ring-slate-100">
              {item}
            </span>
          ))}
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
          pageItems.map((item) => <CompetitionCard key={item.id} item={item} />)
        ) : (
          <div className="surface-card rounded-[28px] px-6 py-12 text-center md:col-span-2 xl:col-span-3">
            <Trophy className="mx-auto h-9 w-9 text-slate-300" />
            <h3 className="mt-4 text-lg font-semibold text-ink">没有匹配的竞赛</h3>
            <p className="mt-2 text-sm leading-7 text-slate-500">可以清空关键词，或放宽级别、类别筛选。</p>
          </div>
        )}
      </section>

      {filteredItems.length > PAGE_SIZE ? (
        <nav className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-white/80 bg-white/90 px-4 py-3 shadow-soft" aria-label="竞赛列表分页">
          <div className="text-sm text-slate-500">
            第 {currentPage} / {pageCount} 页，当前显示 {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredItems.length)} 条
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />上一页
            </button>
            <button type="button" disabled={currentPage === pageCount} onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} className="inline-flex h-10 items-center gap-1 rounded-xl bg-brand px-3 text-sm font-semibold text-white disabled:opacity-40">
              下一页<ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </nav>
      ) : null}
    </SiteShell>
  );
}

function FilterChips({
  label,
  options,
  value,
  counts,
  onChange,
  getLabel = (option) => option
}: {
  label: string;
  options: readonly string[];
  value: string;
  counts: Map<string, number>;
  onChange: (value: string) => void;
  getLabel?: (value: string) => string;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-[72px_minmax(0,1fr)] md:items-start">
      <div className="pt-2 text-xs font-semibold text-slate-500">{label}</div>
      <div className="flex min-w-0 flex-wrap gap-2">
        {options.map((option) => {
          const active = value === option;
          const count = counts.get(option) ?? 0;
          const disabled = option !== '全部' && count === 0 && !active;

          return (
            <button
              key={option}
              type="button"
              onClick={() => {
                if (!disabled) onChange(option);
              }}
              disabled={disabled}
              aria-pressed={active}
              className={`inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-semibold transition ${
                active
                  ? 'border-brand/25 bg-brand text-white shadow-sm'
                  : disabled
                    ? 'cursor-not-allowed border-slate-100 bg-white/60 text-slate-300'
                    : 'border-slate-100 bg-white text-slate-600 hover:border-brand/20 hover:text-brand'
              }`}
            >
              <span>{getLabel(option)}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? 'bg-white/18 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function buildFilterCounts<T extends string>(
  options: readonly T[],
  filters: CompetitionFilters,
  key: keyof CompetitionFilters
) {
  const counts = new Map<string, number>();

  for (const option of options) {
    counts.set(
      option,
      competitionItems.filter((item) => matchesCompetitionFilters(item, { ...filters, [key]: option })).length
    );
  }

  return counts;
}

function matchesCompetitionFilters(item: CompetitionItem, filters: CompetitionFilters) {
  const normalizedKeyword = filters.keyword.trim().toLowerCase();
  const matchesKeyword =
    !normalizedKeyword ||
    [item.title, item.shortName, item.category, item.organizer]
      .join(' ')
      .toLowerCase()
      .includes(normalizedKeyword);
  const matchesLevel = filters.level === '全部' || item.level === filters.level;
  const matchesCategory = filters.category === '全部' || getItemCategories(item).includes(filters.category);

  return matchesKeyword && matchesLevel && matchesCategory;
}

function getItemCategories(item: CompetitionItem) {
  return item.category
    .split('/')
    .map((entry) => entry.trim())
    .filter(Boolean);
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
