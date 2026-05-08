'use client';

import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { PageSectionTitle } from '@/components/page-section-title';
import { ProductHeroVisual } from '@/components/product-hero-visual';
import { SiteShell } from '@/components/site-shell';
import { collegeDirectory } from '@/lib/college-directory';

const PAGE_SIZE = 16;
const allCityLabel = '全部城市';
const allGroupLabel = '全部标签';
const cityOptions = [allCityLabel, ...Array.from(new Set(collegeDirectory.map((item) => item.city)))];
const groupOptions = [allGroupLabel, '985', '211', '双一流', 'C9', '华五', '国防七子'];
const hotCities = ['北京', '上海', '南京', '武汉', '广州', '西安', '成都'];
type SortOption = 'default' | 'name' | 'city';
const sortOptions: Array<{ label: string; value: SortOption }> = [
  { label: '默认排序', value: 'default' },
  { label: '按校名排序', value: 'name' },
  { label: '按城市排序', value: 'city' }
];

function getVisiblePages(currentPage: number, totalPages: number) {
  const start = Math.max(1, currentPage - 1);
  const end = Math.min(totalPages, currentPage + 1);
  const pages: number[] = [];

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (!pages.includes(1)) {
    pages.unshift(1);
  }

  if (!pages.includes(totalPages)) {
    pages.push(totalPages);
  }

  return Array.from(new Set(pages));
}

export default function CollegesPage() {
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState(allCityLabel);
  const [group, setGroup] = useState(allGroupLabel);
  const [pageState, setPageState] = useState({ page: 1, filterKey: '' });
  const [jumpPage, setJumpPage] = useState('');
  const [showAllCities, setShowAllCities] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const filterKey = `${keyword.trim().toLowerCase()}|${city}|${group}|${sortBy}`;

  const filteredColleges = useMemo(() => {
    const query = keyword.trim().toLowerCase();

    const rows = collegeDirectory.filter((item) => {
      const matchesKeyword = !query
        ? true
        : [item.name, item.city, item.focus, item.domain, item.groups.join(' ')]
            .join(' ')
            .toLowerCase()
            .includes(query);
      const matchesCity = city === allCityLabel ? true : item.city === city;
      const matchesGroup = group === allGroupLabel ? true : item.groups.includes(group);

      return matchesKeyword && matchesCity && matchesGroup;
    });

    return [...rows].sort((current, next) => {
      if (sortBy === 'name') {
        return current.name.localeCompare(next.name, 'zh-CN');
      }

      if (sortBy === 'city') {
        return (
          current.city.localeCompare(next.city, 'zh-CN') ||
          current.name.localeCompare(next.name, 'zh-CN')
        );
      }

      return 0;
    });
  }, [keyword, city, group, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredColleges.length / PAGE_SIZE));
  const requestedPage = pageState.filterKey === filterKey ? pageState.page : 1;
  const currentPage = Math.min(requestedPage, totalPages);
  const pagedColleges = filteredColleges.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visiblePages = getVisiblePages(currentPage, totalPages);
  const hasActiveFilters =
    Boolean(keyword.trim()) || city !== allCityLabel || group !== allGroupLabel || sortBy !== 'default';
  const activeFilterItems = [
    keyword.trim()
      ? {
          key: 'keyword',
          label: `关键词：${keyword.trim()}`,
          onClear: () => setKeyword('')
        }
      : null,
    city !== allCityLabel
      ? {
          key: 'city',
          label: `城市：${city}`,
          onClear: () => setCity(allCityLabel)
        }
      : null,
    group !== allGroupLabel
      ? {
          key: 'group',
          label: `标签：${group}`,
          onClear: () => setGroup(allGroupLabel)
        }
      : null,
    sortBy !== 'default'
      ? {
          key: 'sort',
          label: `排序：${sortOptions.find((item) => item.value === sortBy)?.label ?? '自定义'}`,
          onClear: () => setSortBy('default')
        }
      : null
  ].filter(Boolean) as Array<{ key: string; label: string; onClear: () => void }>;

  function updatePage(nextPage: number | ((currentPage: number) => number)) {
    setPageState((current) => {
      const basePage = current.filterKey === filterKey ? current.page : 1;
      const resolvedPage = typeof nextPage === 'function' ? nextPage(basePage) : nextPage;

      return {
        filterKey,
        page: resolvedPage
      };
    });
  }

  function handleJumpPage() {
    const parsed = Number(jumpPage);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      updatePage(parsed);
    }
  }

  function resetFilters() {
    setKeyword('');
    setCity(allCityLabel);
    setGroup(allGroupLabel);
    setSortBy('default');
    setJumpPage('');
    setPageState({ page: 1, filterKey: '' });
  }

  return (
    <SiteShell>
      <section className="grid gap-8 py-5 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-center">
        <PageSectionTitle
          eyebrow="College Directory"
          title="院校库"
          subtitle="高频目标院校一页直达。按城市、层次和关键词快速筛选，找到学校后直接回到官网核对。"
        />
        <ProductHeroVisual variant="college" compact />
      </section>

      <section className="surface-card rounded-[34px] p-5 shadow-[0_28px_80px_rgba(15,75,72,0.08)] lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-brand">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              College Finder
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">快速定位目标院校</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              先输入学校、城市或官网域名，再用城市与标签收窄范围。筛选结果会即时刷新，方便你快速回到官网核验。
            </p>
          </div>

          <div className="grid grid-cols-3 overflow-hidden rounded-3xl border border-slate-100 bg-slate-50 text-center text-sm shadow-inner">
            <div className="min-w-24 px-4 py-3">
              <div className="text-xl font-semibold text-brand">{filteredColleges.length}</div>
              <div className="mt-1 text-xs text-slate-400">匹配院校</div>
            </div>
            <div className="min-w-24 border-x border-white px-4 py-3">
              <div className="text-xl font-semibold text-ink">{city === allCityLabel ? '不限' : city}</div>
              <div className="mt-1 text-xs text-slate-400">当前城市</div>
            </div>
            <div className="min-w-24 px-4 py-3">
              <div className="text-xl font-semibold text-ink">{group === allGroupLabel ? '不限' : group}</div>
              <div className="mt-1 text-xs text-slate-400">院校标签</div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_180px]">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 transition focus-within:border-brand/35 focus-within:bg-white focus-within:shadow-soft">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索学校、城市、官网域名或标签"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              aria-label="搜索院校"
            />
          </label>

          <label className="relative">
            <select
              value={group}
              onChange={(event) => setGroup(event.target.value)}
              className="h-full w-full appearance-none rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 pr-10 text-sm font-semibold text-slate-700 outline-none transition hover:border-brand/20 focus:border-brand/35"
              aria-label="选择院校标签"
            >
              {groupOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </label>

          <label className="relative">
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
              className="h-full w-full appearance-none rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 pr-10 text-sm font-semibold text-slate-700 outline-none transition hover:border-brand/20 focus:border-brand/35"
              aria-label="选择排序方式"
            >
              {sortOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand/5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
              <Filter className="h-3.5 w-3.5" />
              已选条件
            </span>
            {activeFilterItems.length ? (
              activeFilterItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClear}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-100 transition hover:text-brand"
                >
                  {item.label}
                  <X className="h-3.5 w-3.5" />
                </button>
              ))
            ) : (
              <span className="text-xs font-medium text-slate-400">未设置筛选，展示全部院校。</span>
            )}
          </div>

          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
            className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-slate-500 ring-1 ring-slate-100 transition hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重置筛选
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <div className="mb-3 text-xs font-semibold text-slate-400">热门城市</div>
            <div className="flex flex-wrap gap-2">
              {[allCityLabel, ...hotCities].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCity(item)}
                  className={`rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                    city === item ? 'bg-brand text-white shadow-soft' : 'bg-slate-100 text-slate-600 hover:bg-brand/10 hover:text-brand'
                  }`}
                >
                  {item === allCityLabel ? '全部城市' : item}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowAllCities((current) => !current)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-500 transition hover:border-brand hover:text-brand"
              >
                更多城市
                <ChevronDown className={`h-4 w-4 transition ${showAllCities ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          <div>
            <div className="mb-3 text-xs font-semibold text-slate-400">院校标签</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setGroup(allGroupLabel)}
                className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                  group === allGroupLabel ? 'bg-brand text-white shadow-soft' : 'bg-slate-100 text-slate-600 hover:bg-brand/10 hover:text-brand'
                }`}
              >
                全部标签
              </button>
              {groupOptions.slice(1).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setGroup(item)}
                  className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                    group === item ? 'bg-brand text-white shadow-soft' : 'bg-slate-100 text-slate-600 hover:bg-brand/10 hover:text-brand'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        {showAllCities ? (
          <div className="mt-4 flex max-h-44 flex-wrap gap-2 overflow-auto rounded-3xl border border-slate-100 bg-slate-50 p-3">
            {cityOptions
              .filter((item) => item !== allCityLabel && !hotCities.includes(item))
              .map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCity(item)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    city === item ? 'bg-brand text-white' : 'bg-white text-slate-500 hover:text-brand'
                  }`}
                >
                  {item}
                </button>
              ))}
          </div>
        ) : null}
      </section>

      <section className="hidden">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_220px]">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索学校、城市、官网域名或标签"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <select
            value={group}
            onChange={(event) => setGroup(event.target.value)}
            className="rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
          >
            {groupOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6">
          <div className="mb-3 text-xs font-semibold text-slate-400">热门城市</div>
          <div className="flex flex-wrap gap-2">
            {[allCityLabel, ...hotCities].map((item) => (
              <button
                key={item}
                onClick={() => setCity(item)}
                className={`rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                  city === item ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-brand/8 hover:text-brand'
                }`}
              >
                {item === allCityLabel ? '全部城市' : item}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowAllCities((current) => !current)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-500 hover:border-brand hover:text-brand"
            >
              更多城市
              <ChevronDown className={`h-4 w-4 transition ${showAllCities ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {showAllCities ? (
            <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-auto rounded-2xl bg-slate-50 p-3">
              {cityOptions
                .filter((item) => item !== allCityLabel && !hotCities.includes(item))
                .map((item) => (
                  <button
                    key={item}
                    onClick={() => setCity(item)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      city === item ? 'bg-brand text-white' : 'bg-white text-slate-500 hover:text-brand'
                    }`}
                  >
                    {item}
                  </button>
                ))}
            </div>
          ) : null}
        </div>

        <div className="mt-6">
          <div className="mb-3 text-xs font-semibold text-slate-400">院校标签</div>
          <div className="flex flex-wrap gap-2">
            {groupOptions.slice(1).map((item) => (
              <button
                key={item}
                onClick={() => setGroup(item)}
                className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                  group === item ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {item}
              </button>
            ))}
            <button
              onClick={() => setGroup(allGroupLabel)}
              className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                group === allGroupLabel ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              全部标签
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {pagedColleges.map((item) => (
          <article
            key={item.name}
            className="surface-card rounded-[26px] p-5 transition hover:-translate-y-1 hover:border-brand/15 hover:shadow-soft"
          >
            <div className="flex items-start gap-4">
              <ExternalSiteMark source={item.website} label={item.name} size="lg" rounded="full" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-brand">
                    <MapPin className="h-3.5 w-3.5" />
                    {item.city}
                  </span>
                  {item.groups.slice(0, 4).map((entry) => (
                    <span key={entry} className="rounded-full bg-brand/10 px-3 py-1 text-brand">
                      {entry}
                    </span>
                  ))}
                </div>
                <div className="mt-4 text-2xl font-semibold tracking-tight text-ink">{item.name}</div>
                <div className="mt-5">
                  <a
                    href={item.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-brand/25 bg-white px-4 py-2.5 text-sm font-semibold text-brand transition hover:border-brand"
                  >
                    打开学校官网
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>

      {!pagedColleges.length ? (
        <section className="surface-card rounded-[30px] px-6 py-12 text-center text-sm text-slate-500">
          当前筛选条件下没有匹配院校，换一个城市、标签或关键词试试看。
        </section>
      ) : null}

      {filteredColleges.length ? (
        <section className="rounded-[30px] bg-white px-5 py-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => updatePage((current) => Math.max(1, current - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </button>

            {visiblePages.map((pageNumber) => (
              <button
                key={pageNumber}
                onClick={() => updatePage(pageNumber)}
                className={`h-12 min-w-12 rounded-2xl px-4 text-sm font-semibold ${
                  currentPage === pageNumber ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {pageNumber}
              </button>
            ))}

            <button
              onClick={() => updatePage((current) => Math.min(totalPages, current + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-45"
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </button>

            <input
              value={jumpPage}
              onChange={(event) => setJumpPage(event.target.value.replace(/[^\d]/g, ''))}
              placeholder="页码"
              className="h-12 w-28 rounded-2xl border border-black/5 px-4 text-center text-sm outline-none"
            />
            <button onClick={handleJumpPage} className="h-12 rounded-2xl bg-brand px-5 text-sm font-semibold text-white">
              跳转
            </button>
          </div>
        </section>
      ) : null}
    </SiteShell>
  );
}
