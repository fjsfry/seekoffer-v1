'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react';
import Link from 'next/link';
import {
  ArrowSync20Regular,
  BuildingBank20Regular,
  Checkmark20Regular,
  Filter20Regular,
  Warning20Regular
} from '@fluentui/react-icons';
import {
  BellRing,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  MapPin,
  Search
} from 'lucide-react';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { DesktopStateSurface } from '@/components/desktop-state-surface';
import { SiteShell } from '@/components/site-shell';
import { getPublicNoticeSnapshot, loadPublicNotices } from '@/lib/cloudbase-data';
import { collegeDirectory } from '@/lib/college-directory';
import { buildCollegeNoticeStats } from '@/lib/notice-analytics';
import { filterMainNoticeProjects } from '@/lib/notice-quality';
import { baseNoticeProjects } from '@/lib/notice-source';
import type { PublicNoticeProject } from '@/lib/mock-data';
import styles from './colleges.module.css';

const PAGE_SIZE = 16;
const COLLEGE_VIEW_STORAGE_KEY = 'seekoffer.desktop.colleges.view.v1';
const isDesktopSurface = process.env.NEXT_PUBLIC_SEEKOFFER_SURFACE === 'desktop';
const allCityLabel = '全部城市';
const allGroupLabel = '全部标签';
const cityOptions = [allCityLabel, ...Array.from(new Set(collegeDirectory.map((item) => item.city)))];
const groupOptions = [allGroupLabel, '985', '211', '双一流', 'C9', '华五', '国防七子'];
const hotCities = ['北京', '上海', '南京', '武汉', '广州', '西安', '成都'];
type SortOption = 'active' | 'notices' | 'updated' | 'name' | 'city';
type CollegeNoticeSyncStatus = 'loading' | 'online' | 'stale' | 'fallback';
type StoredCollegeView = {
  keyword: string;
  city: string;
  group: string;
  page: number;
  sortBy: SortOption;
  showAllCities: boolean;
  scrollTop: number;
};
const sortOptions: Array<{ label: string; value: SortOption }> = [
  { label: '报名中最多', value: 'active' },
  { label: '通知最多', value: 'notices' },
  { label: '最近更新', value: 'updated' },
  { label: '按校名排序', value: 'name' },
  { label: '按城市排序', value: 'city' }
];

function readStoredCollegeView(): StoredCollegeView | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(COLLEGE_VIEW_STORAGE_KEY) || 'null') as Partial<StoredCollegeView> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    const nextSort = sortOptions.some((option) => option.value === parsed.sortBy) ? parsed.sortBy : 'active';
    return {
      keyword: typeof parsed.keyword === 'string' ? parsed.keyword.slice(0, 120) : '',
      city: typeof parsed.city === 'string' && cityOptions.includes(parsed.city) ? parsed.city : allCityLabel,
      group: typeof parsed.group === 'string' && groupOptions.includes(parsed.group) ? parsed.group : allGroupLabel,
      page: typeof parsed.page === 'number' && Number.isInteger(parsed.page) && parsed.page > 0 ? parsed.page : 1,
      sortBy: nextSort || 'active',
      showAllCities: parsed.showAllCities === true,
      scrollTop: typeof parsed.scrollTop === 'number' && parsed.scrollTop >= 0 ? parsed.scrollTop : 0
    };
  } catch {
    return null;
  }
}

function formatSyncTime(value: Date | null) {
  if (!value) return '刚刚';
  return value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

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

type CollegeEntry = (typeof collegeDirectory)[number];
type CollegeStats = ReturnType<typeof buildCollegeNoticeStats>;

function formatDesktopCollegeDate(value?: string) {
  if (!value) return '更新时间待补充';
  const match = value.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return match ? `${Number(match[1])}月${Number(match[2])}日更新` : `${value} 更新`;
}

function toggleCollegePopover(trigger: HTMLElement, surface: HTMLElement) {
  if (surface.matches(':popover-open')) {
    surface.hidePopover();
    return;
  }
  const rect = trigger.getBoundingClientRect();
  const gutter = 12;
  const width = Math.min(420, window.innerWidth - gutter * 2);
  const estimatedHeight = 470;
  const left = Math.max(gutter, Math.min(rect.right - width, window.innerWidth - width - gutter));
  const below = rect.bottom + 6;
  const top = below + estimatedHeight <= window.innerHeight - gutter
    ? below
    : Math.max(gutter, rect.top - estimatedHeight - 6);
  surface.style.setProperty('--college-popover-left', `${left}px`);
  surface.style.setProperty('--college-popover-top', `${top}px`);
  surface.style.setProperty('--college-popover-width', `${width}px`);
  surface.showPopover();
}

function closeCollegePopover(surface: HTMLElement | null, trigger?: HTMLElement | null) {
  if (surface?.matches(':popover-open')) surface.hidePopover();
  window.requestAnimationFrame(() => trigger?.focus());
}

function useDismissCollegePopover(surfaceRef: RefObject<HTMLElement | null>, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const dismiss = (event?: Event) => {
      if (event?.type === 'scroll' && event.target instanceof Node && surfaceRef.current?.contains(event.target)) return;
      if (surfaceRef.current?.matches(':popover-open')) surfaceRef.current.hidePopover();
    };
    document.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      document.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [open, surfaceRef]);
}

function DesktopCollegeFilters({
  city,
  group,
  sortBy,
  onCityChange,
  onGroupChange,
  onSortChange,
  onReset
}: {
  city: string;
  group: string;
  sortBy: SortOption;
  onCityChange: (value: string) => void;
  onGroupChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
  onReset: () => void;
}) {
  const popoverId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const activeCount = Number(city !== allCityLabel) + Number(group !== allGroupLabel) + Number(sortBy !== 'active');
  useDismissCollegePopover(surfaceRef, open);

  return (
    <div className={styles.filterAnchor}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.filterTrigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => {
          if (triggerRef.current && surfaceRef.current) toggleCollegePopover(triggerRef.current, surfaceRef.current);
        }}
      >
        <Filter20Regular aria-hidden="true" />
        筛选
        {activeCount ? <span>{activeCount}</span> : null}
        <ChevronDown aria-hidden="true" />
      </button>
      <div
        ref={surfaceRef}
        id={popoverId}
        popover="auto"
        role="dialog"
        aria-modal="false"
        aria-label="筛选院校"
        className={styles.filterPopover}
        onToggle={(event) => setOpen(event.currentTarget.matches(':popover-open'))}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          closeCollegePopover(surfaceRef.current, triggerRef.current);
        }}
      >
        <header>
          <strong>筛选院校</strong>
          <span>按城市和院校层次缩小范围。</span>
        </header>
        <div className={styles.filterPopoverBody}>
          <fieldset>
            <legend>城市</legend>
            <div className={styles.cityOptionGrid}>
              {cityOptions.map((item) => (
                <button key={item} type="button" aria-pressed={city === item} onClick={() => onCityChange(item)}>
                  {item}
                  {city === item ? <Checkmark20Regular aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>院校标签</legend>
            <div className={styles.groupOptionGrid}>
              {groupOptions.map((item) => (
                <button key={item} type="button" aria-pressed={group === item} onClick={() => onGroupChange(item)}>
                  {item === allGroupLabel ? '全部' : item}
                  {group === item ? <Checkmark20Regular aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>排序方式</legend>
            <div className={styles.sortOptionGrid}>
              {sortOptions.map((item) => (
                <button key={item.value} type="button" aria-pressed={sortBy === item.value} onClick={() => onSortChange(item.value)}>
                  {item.label}
                  {sortBy === item.value ? <Checkmark20Regular aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <footer>
          <button type="button" onClick={onReset}>清除筛选</button>
          <button type="button" onClick={() => closeCollegePopover(surfaceRef.current, triggerRef.current)}>完成</button>
        </footer>
      </div>
    </div>
  );
}

function DesktopCollegeCard({ item, stats }: { item: CollegeEntry; stats: CollegeStats }) {
  const hasActiveNotices = stats.active > 0;
  const hasSchoolNotices = stats.total > 0;
  const noticeHref = hasSchoolNotices ? `/notices?school=${encodeURIComponent(item.name)}` : '/notices';
  const noticeActionLabel = hasActiveNotices
    ? '查看报名通知'
    : hasSchoolNotices
      ? '查看历史通知'
      : '查看全部通知';

  return (
    <article className={styles.collegeCard}>
      <div className={styles.collegeLogo}>
        <ExternalSiteMark source={item.website} label={item.name} size="2xl" rounded="full" />
      </div>
      <div className={styles.collegeIdentity}>
        <div className={styles.collegeTitleLine}>
          <h2 title={item.name}>{item.name}</h2>
          <span className={styles.cityBadge}><MapPin aria-hidden="true" />{item.city}</span>
          {item.groups.slice(0, 2).map((entry) => <span key={entry} className={styles.groupBadge}>{entry}</span>)}
        </div>
        <time dateTime={stats.latestPublishDate || undefined}>
          <Clock3 aria-hidden="true" />
          {formatDesktopCollegeDate(stats.latestPublishDate)}
        </time>
      </div>
      <div className={styles.collegeStats} data-active={hasActiveNotices ? 'true' : 'false'} aria-label={`${item.name}通知统计`}>
        <span className={styles.noticeLabel}><BellRing aria-hidden="true" />报名通知</span>
        <div className={styles.noticePrimary}>
          <strong>{stats.active}</strong>
          <span>条正在报名</span>
        </div>
        <div className={styles.noticeSecondary}>
          <span>共 {stats.total} 条</span>
        </div>
      </div>
      <div className={`${styles.collegeActions} desktop-college-card-actions-final`}>
        <Link className={styles.noticeAction} data-active={hasActiveNotices ? 'true' : 'false'} href={noticeHref}>
          {noticeActionLabel}
          <BellRing aria-hidden="true" />
        </Link>
        <a href={item.website} target="_blank" rel="noreferrer">
          学校官网
          <ExternalLink aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

function DesktopCollegePagination({
  currentPage,
  totalPages,
  visiblePages,
  jumpPage,
  onPageChange,
  onJumpPageChange,
  onJump
}: {
  currentPage: number;
  totalPages: number;
  visiblePages: number[];
  jumpPage: string;
  onPageChange: (page: number | ((current: number) => number)) => void;
  onJumpPageChange: (value: string) => void;
  onJump: () => void;
}) {
  return (
    <nav className={styles.pagination} aria-label="院校库分页">
      <span>第 {currentPage} / {totalPages} 页</span>
      <div>
        <button type="button" onClick={() => onPageChange((current) => Math.max(1, current - 1))} disabled={currentPage === 1} aria-label="上一页">
          <ChevronLeft aria-hidden="true" />
        </button>
        {visiblePages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            aria-current={currentPage === pageNumber ? 'page' : undefined}
            onClick={() => onPageChange(pageNumber)}
          >
            {pageNumber}
          </button>
        ))}
        <button type="button" onClick={() => onPageChange((current) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages} aria-label="下一页">
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
      <label>
        <span className={styles.visuallyHidden}>跳转页码</span>
        <input
          value={jumpPage}
          onChange={(event) => onJumpPageChange(event.target.value.replace(/[^\d]/g, ''))}
          placeholder="页码"
          inputMode="numeric"
        />
        <button type="button" onClick={onJump}>跳转</button>
      </label>
    </nav>
  );
}

export default function CollegesPage() {
  const [initialPublicNoticeSnapshot] = useState(() => getPublicNoticeSnapshot());
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState(allCityLabel);
  const [group, setGroup] = useState(allGroupLabel);
  const [pageState, setPageState] = useState({ page: 1, filterKey: '' });
  const [jumpPage, setJumpPage] = useState('');
  const [showAllCities, setShowAllCities] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('active');
  const [viewRestored, setViewRestored] = useState(false);
  const [noticeSyncStatus, setNoticeSyncStatus] = useState<CollegeNoticeSyncStatus>(() => {
    if (initialPublicNoticeSnapshot.error) {
      return initialPublicNoticeSnapshot.source === 'stale' ? 'stale' : 'fallback';
    }
    return initialPublicNoticeSnapshot.syncedAt === null ? 'loading' : 'online';
  });
  const [noticeSyncAttemptedAt, setNoticeSyncAttemptedAt] = useState<Date | null>(() =>
    initialPublicNoticeSnapshot.attemptedAt
      ? new Date(initialPublicNoticeSnapshot.attemptedAt)
      : null
  );
  const [projects, setProjects] = useState<PublicNoticeProject[]>(() =>
    initialPublicNoticeSnapshot.rows.filter((item) => String(item.year) === '2026')
  );
  const pageRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);
  const requestSequenceRef = useRef(0);
  const hasOnlineSnapshotRef = useRef(initialPublicNoticeSnapshot.syncedAt !== null);
  const filterKey = `${keyword.trim().toLowerCase()}|${city}|${group}|${sortBy}`;

  const loadProjects = useCallback(async (options: { force?: boolean } = {}) => {
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    const cachedSnapshot = getPublicNoticeSnapshot();
    if (cachedSnapshot.rows.length > 0 || cachedSnapshot.syncedAt !== null) {
      setProjects(cachedSnapshot.rows.filter((item) => String(item.year) === '2026'));
    }
    if (cachedSnapshot.syncedAt === null && !cachedSnapshot.error) {
      setNoticeSyncStatus('loading');
    }
    try {
      const result = await loadPublicNotices({ refresh: options.force === true });
      if (requestSequenceRef.current !== requestSequence) return;
      setProjects(result.rows.filter((item) => String(item.year) === '2026'));
      setNoticeSyncAttemptedAt(result.attemptedAt ? new Date(result.attemptedAt) : null);
      hasOnlineSnapshotRef.current = result.syncedAt !== null;
      if (result.error) {
        setNoticeSyncStatus(result.source === 'stale' ? 'stale' : 'fallback');
      } else {
        setNoticeSyncStatus(result.syncedAt === null ? 'fallback' : 'online');
      }
    } catch {
      if (requestSequenceRef.current !== requestSequence) return;
      if (hasOnlineSnapshotRef.current) {
        setNoticeSyncStatus('stale');
      } else {
        setProjects(filterMainNoticeProjects(baseNoticeProjects).filter((item) => String(item.year) === '2026'));
        setNoticeSyncStatus('fallback');
      }
    }
  }, []);

  useEffect(() => {
    void loadProjects();
    return () => {
      requestSequenceRef.current += 1;
    };
  }, [loadProjects]);

  useEffect(() => {
    const stored = readStoredCollegeView();
    if (stored) {
      setKeyword(stored.keyword);
      setCity(stored.city);
      setGroup(stored.group);
      setSortBy(stored.sortBy);
      setShowAllCities(stored.showAllCities);
      setPageState({
        page: stored.page,
        filterKey: `${stored.keyword.trim().toLowerCase()}|${stored.city}|${stored.group}|${stored.sortBy}`
      });
      scrollTopRef.current = stored.scrollTop;
    }
    setViewRestored(true);
  }, []);

  useEffect(() => {
    if (!viewRestored) return;
    const scrollContainer = pageRef.current?.closest<HTMLElement>('.desktop-route-content');
    if (!scrollContainer) return;
    const frame = window.requestAnimationFrame(() => {
      scrollContainer.scrollTop = scrollTopRef.current;
    });
    const handleScroll = () => {
      scrollTopRef.current = scrollContainer.scrollTop;
      try {
        window.sessionStorage.setItem(
          COLLEGE_VIEW_STORAGE_KEY,
          JSON.stringify({
            keyword,
            city,
            group,
            page: pageState.filterKey === filterKey ? pageState.page : 1,
            sortBy,
            showAllCities,
            scrollTop: scrollTopRef.current
          } satisfies StoredCollegeView)
        );
      } catch {
        // View restoration is an enhancement; browsing remains available if storage is unavailable.
      }
    };
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      handleScroll();
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [city, filterKey, group, keyword, pageState, showAllCities, sortBy, viewRestored]);

  const collegeStats = useMemo(() => {
    return new Map(collegeDirectory.map((item) => [item.name, buildCollegeNoticeStats(projects, item.name)]));
  }, [projects]);

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
      const currentStats = collegeStats.get(current.name);
      const nextStats = collegeStats.get(next.name);

      if (sortBy === 'active') {
        return (
          (nextStats?.active || 0) - (currentStats?.active || 0) ||
          (nextStats?.total || 0) - (currentStats?.total || 0) ||
          current.name.localeCompare(next.name, 'zh-CN')
        );
      }

      if (sortBy === 'notices') {
        return (
          (nextStats?.total || 0) - (currentStats?.total || 0) ||
          (nextStats?.active || 0) - (currentStats?.active || 0) ||
          current.name.localeCompare(next.name, 'zh-CN')
        );
      }

      if (sortBy === 'updated') {
        return (
          (nextStats?.latestPublishDate || '').localeCompare(currentStats?.latestPublishDate || '') ||
          current.name.localeCompare(next.name, 'zh-CN')
        );
      }

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
  }, [keyword, city, group, sortBy, collegeStats]);

  const totalPages = Math.max(1, Math.ceil(filteredColleges.length / PAGE_SIZE));
  const requestedPage = pageState.filterKey === filterKey ? pageState.page : 1;
  const currentPage = Math.min(requestedPage, totalPages);
  const pagedColleges = filteredColleges.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visiblePages = getVisiblePages(currentPage, totalPages);
  const hasActiveFilters =
    Boolean(keyword.trim()) || city !== allCityLabel || group !== allGroupLabel || sortBy !== 'active';

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
    setSortBy('active');
    setJumpPage('');
    setPageState({ page: 1, filterKey: '' });
  }

  return (
    <SiteShell>
      <div
        ref={pageRef}
        className={`desktop-core-page desktop-core-page--scroll ${isDesktopSurface ? styles.page : 'desktop-college-page'}`}
      >
      {isDesktopSurface ? (
        <>
        <header className={`${styles.pageHeader} desktop-core-page-header desktop-page-header desktop-page-header--directory`}>
          <div className={`${styles.headerIdentity} desktop-page-header-copy`}>
            <div className="desktop-page-header-title-row">
              <h1 className="desktop-page-header-title">院校库</h1>
              <span className="desktop-page-header-count" aria-live="polite">共 {filteredColleges.length} 所院校</span>
            </div>
            <p className="desktop-page-header-subtitle">按城市、院校层次和关键词快速筛选。</p>
          </div>
        </header>
        <section className={`${styles.toolbar} desktop-college-page-toolbar`} aria-label="搜索与筛选院校">
          <div className={`${styles.headerControls} desktop-college-page-toolbar-controls`}>
            <label className={`${styles.searchBox} desktop-college-search`}>
              <Search aria-hidden="true" />
              <span className={styles.visuallyHidden}>搜索院校</span>
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索院校名称"
              />
            </label>
            <DesktopCollegeFilters
              city={city}
              group={group}
              sortBy={sortBy}
              onCityChange={setCity}
              onGroupChange={setGroup}
              onSortChange={setSortBy}
              onReset={resetFilters}
            />
          </div>
        </section>
        </>
      ) : (
        <section className="desktop-core-page-header desktop-college-hero page-hero">
          <div>
            <h1>院校库</h1>
            <p>高频目标院校一页直达，按城市、层次和关键词快速筛选，找到学校后直接回到官网核对。</p>
          </div>
        </section>
      )}

      {!isDesktopSurface ? (
      <section className="desktop-college-toolbar product-card rounded-[30px] p-5 lg:p-6">
        <div className="desktop-college-toolbar-header mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="text-sm font-semibold text-slate-600">
            {!isDesktopSurface ? '共 ' : null}<span className="text-brand">{filteredColleges.length}</span> 所院校
          </div>
          <div className="desktop-college-toolbar-actions flex flex-wrap items-center gap-3">
            <label className="relative">
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
                className="h-10 appearance-none rounded-full border border-slate-200 bg-white px-4 pr-9 text-sm font-semibold text-slate-600 outline-none transition hover:border-brand hover:text-brand"
                aria-label="院校库排序"
              >
                {sortOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </label>
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
            >
              重置
            </button>
          </div>
        </div>
        <div>
          <div className="desktop-college-search flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索学校、城市、官网域名或标签"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              aria-label="搜索院校"
            />
          </div>

        </div>

        <div className="desktop-college-filter-group mt-6">
          <div className="desktop-college-filter-label mb-3 text-xs font-semibold text-slate-400">热门城市</div>
          <div className="desktop-college-filter-options flex flex-wrap gap-2">
            {[allCityLabel, ...hotCities].map((item) => (
              <button
                key={item}
                onClick={() => setCity(item)}
                aria-pressed={city === item}
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
              aria-expanded={showAllCities}
              aria-controls="desktop-college-more-cities"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-500 hover:border-brand hover:text-brand"
            >
              更多城市
              <ChevronDown className={`h-4 w-4 transition ${showAllCities ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {showAllCities ? (
            <div id="desktop-college-more-cities" className="desktop-college-more-cities mt-3 flex max-h-40 flex-wrap gap-2 overflow-auto rounded-2xl bg-slate-50 p-3">
              {cityOptions
                .filter((item) => item !== allCityLabel && !hotCities.includes(item))
                .map((item) => (
                  <button
                    key={item}
                    onClick={() => setCity(item)}
                    aria-pressed={city === item}
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

        <div className="desktop-college-filter-group mt-6">
          <div className="desktop-college-filter-label mb-3 text-xs font-semibold text-slate-400">院校标签</div>
          <div className="desktop-college-filter-options flex flex-wrap gap-2">
            {groupOptions.slice(1).map((item) => (
              <button
                key={item}
                onClick={() => setGroup(item)}
                aria-pressed={group === item}
                className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                  group === item ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {item}
              </button>
            ))}
            <button
              onClick={() => setGroup(allGroupLabel)}
              aria-pressed={group === allGroupLabel}
              className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                group === allGroupLabel ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              全部标签
            </button>
          </div>
        </div>
      </section>
      ) : null}

      {!isDesktopSurface && noticeSyncStatus === 'loading' ? (
        <DesktopStateSurface
          variant="inline"
          loading
          ariaBusy
          icon={<ArrowSync20Regular />}
          title="正在同步院校通知"
          detail="列表保持可用，最新统计同步完成后会自动更新。"
        />
      ) : noticeSyncStatus === 'stale' || noticeSyncStatus === 'fallback' ? (
        <DesktopStateSurface
          variant="inline"
          tone="stale"
          icon={<Warning20Regular />}
          title={noticeSyncStatus === 'stale' ? '本次刷新失败' : '当前显示本地院校数据'}
          detail={noticeSyncStatus === 'stale'
            ? `继续展示上次同步成功的院校统计。上次尝试 ${formatSyncTime(noticeSyncAttemptedAt)}。`
            : `在线通知暂时不可用；本地数据可以继续浏览。上次尝试 ${formatSyncTime(noticeSyncAttemptedAt)}。`}
          action={(
            <button type="button" className="desktop-setting-secondary-button" onClick={() => void loadProjects({ force: true })}>
              重新同步
            </button>
          )}
        />
      ) : null}

      {isDesktopSurface ? (
        <section className={styles.collegeGrid} aria-label="院校筛选结果">
          {pagedColleges.map((item) => (
            <DesktopCollegeCard
              key={item.name}
              item={item}
              stats={collegeStats.get(item.name) || buildCollegeNoticeStats(projects, item.name)}
            />
          ))}
        </section>
      ) : (
      <section className="desktop-college-grid grid gap-4 xl:grid-cols-2" aria-label="院校筛选结果">
        {pagedColleges.map((item) => {
          const stats = collegeStats.get(item.name) || buildCollegeNoticeStats(projects, item.name);

          return (
            <article
              key={item.name}
              className="desktop-college-card surface-card rounded-[26px] p-5 transition"
            >
              <div className="flex items-start gap-4">
                <ExternalSiteMark source={item.website} label={item.name} size="lg" rounded="full" />
                <div className="min-w-0 flex-1">
                  <div className="desktop-college-card-tags flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-brand">
                      <MapPin className="h-3.5 w-3.5" />
                      {item.city}
                    </span>
                    {item.groups.slice(0, 1).map((entry) => (
                      <span key={entry} className="rounded-full bg-brand/10 px-3 py-1 text-brand">
                        {entry}
                      </span>
                    ))}
                    {stats.latestPublishDate ? (
                      <small>最近更新 {stats.latestPublishDate}</small>
                    ) : null}
                  </div>
                  <div className="desktop-college-card-title">{item.name}</div>
                  <div className="desktop-college-card-summary" aria-label={`${item.name}通知摘要`}>
                    <span><strong>{stats.active}</strong> 报名中</span>
                    <span><strong>{stats.total}</strong> 条通知</span>
                    <span><strong>{stats.nearDeadline}</strong> 条近 7 天截止</span>
                  </div>
                  <div className="desktop-college-card-actions">
                    <Link
                      href={`/notices?school=${encodeURIComponent(item.name)}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-deep"
                    >
                      查看保研通知
                      <BellRing className="h-4 w-4" />
                    </Link>
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
          );
        })}
      </section>
      )}

      {!pagedColleges.length ? (
        isDesktopSurface ? (
        <div className={styles.emptyResult}>
          <DesktopStateSurface
            variant="section"
            icon={<BuildingBank20Regular />}
            title="没有找到匹配院校"
            detail="可以换一个城市、院校标签或关键词，也可以清除当前筛选。"
            action={hasActiveFilters ? (
              <button type="button" className="desktop-setting-secondary-button" onClick={resetFilters}>
                清除筛选
              </button>
            ) : undefined}
          />
        </div>
        ) : (
          <DesktopStateSurface
            variant="section"
            icon={<BuildingBank20Regular />}
            title="没有找到匹配院校"
            detail="可以换一个城市、院校标签或关键词，也可以清除当前筛选。"
            action={hasActiveFilters ? (
              <button type="button" className="desktop-setting-secondary-button" onClick={resetFilters}>
                清除筛选
              </button>
            ) : undefined}
          />
        )
      ) : null}

      {filteredColleges.length ? (
        isDesktopSurface ? (
          <DesktopCollegePagination
            currentPage={currentPage}
            totalPages={totalPages}
            visiblePages={visiblePages}
            jumpPage={jumpPage}
            onPageChange={updatePage}
            onJumpPageChange={setJumpPage}
            onJump={handleJumpPage}
          />
        ) : (
        <section className="desktop-route-pagination rounded-[30px] bg-white px-5 py-6 shadow-soft">
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
              inputMode="numeric"
              aria-label="跳转页码"
              className="h-12 w-28 rounded-2xl border border-black/5 px-4 text-center text-sm outline-none"
            />
            <button onClick={handleJumpPage} className="h-12 rounded-2xl bg-brand px-5 text-sm font-semibold text-white">
              跳转
            </button>
          </div>
        </section>
        )
      ) : null}
      </div>
    </SiteShell>
  );
}
