'use client';

import { Suspense, useEffect, useMemo, useRef, useState, type ComponentType, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  BellRing,
  BookOpenText,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal
} from 'lucide-react';
import { ApplicationActionButton } from '@/components/application-action-button';
import { DesktopStateSurface } from '@/components/desktop-state-surface';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { SiteShell } from '@/components/site-shell';
import { DeadlineBadge } from '@/components/status-badge';
import { fetchPublicNotices } from '@/lib/cloudbase-data';
import {
  getDaysUntilDeadline,
  getDeadlineDistanceLabel,
  getDeadlineLevelFromDate,
  getDeadlineTimestamp
} from '@/lib/deadline-display';
import {
  formatNoticeDateOnly,
  getDisplayDiscipline,
  getDisplayNoticeDepartment,
  getDisplayProjectType,
  getDisplaySchoolName,
  getDisplayTags,
  normalizeNoticeTitle
} from '@/lib/notice-display';
import { buildNoticeDetailHref } from '@/lib/notice-links';
import {
  getNoticeRegion,
  getNoticeRegionOptions,
  matchesNoticeKind,
  matchesNoticeType,
  noticeKindFilters,
  noticeTypeFilters
} from '@/lib/notice-analytics';
import { filterMainNoticeProjects } from '@/lib/notice-quality';
import { baseNoticeProjects, inferDisciplineCategory, inferSchoolRange, matchesSchoolRange } from '@/lib/notice-source';
import { resolveNoticeLogoSource } from '@/lib/school-mark-source';
import type { PublicNoticeProject } from '@/lib/mock-data';

type SortOption = 'deadline' | 'publish' | 'updated' | 'school';
type ProgressFilter = '全部' | '报名中' | '未开始' | '已结束';
type RangeFilter = '全部' | '985' | '211' | '双一流' | '其他';
type DeadlineQuickFilter = '全部' | 'today' | 'within3days' | 'within7days';
type FreshFilter = '全部' | 'today';
type SearchParamReader = Pick<URLSearchParams, 'get' | 'toString'>;

const PAGE_SIZE = 16;
const NOTICE_LIST_POSITION_STORAGE_KEY = 'seekoffer.noticeListPosition.v1';
const isDesktopSurface = process.env.NEXT_PUBLIC_SEEKOFFER_SURFACE === 'desktop';
const projectTypeOptions = noticeTypeFilters;
const noticeKindOptions = noticeKindFilters;
const sortOptions: SortOption[] = ['deadline', 'publish', 'updated', 'school'];
const progressOptions: ProgressFilter[] = ['全部', '报名中', '未开始', '已结束'];
const rangeOptions: RangeFilter[] = ['全部', '985', '211', '双一流', '其他'];
const deadlineQuickOptions: DeadlineQuickFilter[] = ['全部', 'today', 'within3days', 'within7days'];
const freshOptions: FreshFilter[] = ['全部', 'today'];
const NOTICE_LOADING_ROWS = [0, 1, 2, 3] as const;
const defaultNoticeListState: NoticeListUrlState = {
  keyword: '',
  schoolName: '',
  region: '全部',
  majorKeyword: '',
  category: '全部',
  discipline: '全部',
  schoolRange: '全部',
  progress: '全部',
  deadlineQuick: '全部',
  fresh: '全部',
  publishDate: '',
  projectType: '全部',
  noticeKind: '全部',
  year: '2026',
  sortBy: 'publish',
  advancedOpen: false,
  page: 1
};
const CITY_TAGS = new Set([
  '北京',
  '上海',
  '广州',
  '深圳',
  '南京',
  '杭州',
  '天津',
  '武汉',
  '成都',
  '西安',
  '合肥',
  '苏州',
  '重庆',
  '长沙',
  '厦门',
  '青岛',
  '哈尔滨',
  '香港',
  '澳门'
]);

function matchesProgress(filter: ProgressFilter, project: PublicNoticeProject) {
  const deadlineLevel = getDeadlineLevelFromDate(project.deadlineDate);
  if (filter === '全部') return true;
  if (filter === '报名中') return deadlineLevel !== 'expired' && (project.status === '报名中' || project.status === '即将截止');
  if (filter === '未开始') return project.status === '未开始';
  return deadlineLevel === 'expired' || project.status === '已截止' || project.status === '已结束' || project.status === '活动中';
}

function getVisiblePages(currentPage: number, totalPages: number) {
  const start = Math.max(1, currentPage - 1);
  const end = Math.min(totalPages, currentPage + 1);
  const pages: number[] = [];

  for (let value = start; value <= end; value += 1) {
    pages.push(value);
  }

  if (!pages.includes(1)) pages.unshift(1);
  if (!pages.includes(totalPages)) pages.push(totalPages);

  return Array.from(new Set(pages));
}

function getNoticeCardTags(project: PublicNoticeProject) {
  const seen = new Set<string>();
  const tags = [getDisplayProjectType(project.projectType), inferSchoolRange(project), ...getDisplayTags(project.tags)]
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || item === '其他' || item === '待分类' || item === '方向待分类') {
        return false;
      }

      return item.length <= 8 && !/[，,、；;]/.test(item);
    })
    .filter((item) => {
      if (seen.has(item)) {
        return false;
      }

      seen.add(item);
      return true;
    });

  return tags.slice(0, 3);
}

function parseDeadline(project: PublicNoticeProject) {
  return getDeadlineTimestamp(project.deadlineDate);
}

function getDaysLeft(project: PublicNoticeProject) {
  return getDaysUntilDeadline(project.deadlineDate);
}

function getBeijingDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';

  return `${value('year')}-${value('month')}-${value('day')}`;
}

function getBeijingTimeString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';

  return `${value('hour')}:${value('minute')}`;
}

function sortProjects(rows: PublicNoticeProject[], sortBy: SortOption) {
  return rows.sort((left, right) => {
    if (sortBy === 'deadline') {
      const leftExpired = getDeadlineLevelFromDate(left.deadlineDate) === 'expired' ? 1 : 0;
      const rightExpired = getDeadlineLevelFromDate(right.deadlineDate) === 'expired' ? 1 : 0;

      if (leftExpired !== rightExpired) {
        return leftExpired - rightExpired;
      }

      return parseDeadline(left) - parseDeadline(right);
    }

    if (sortBy === 'school') {
      return left.schoolName.localeCompare(right.schoolName, 'zh-CN');
    }

    if (sortBy === 'updated') {
      const leftValue = left.updatedAt || left.collectedAt || left.publishDate;
      const rightValue = right.updatedAt || right.collectedAt || right.publishDate;
      return rightValue.localeCompare(leftValue);
    }

    return right.publishDate.localeCompare(left.publishDate);
  });
}

function getCityTag(project: PublicNoticeProject) {
  return (project.tags || []).map((tag) => tag.trim()).find((tag) => CITY_TAGS.has(tag));
}

type NoticeListFilterValues = {
  keyword: string;
  schoolName: string;
  region: string;
  majorKeyword: string;
  category: string;
  discipline: string;
  schoolRange: RangeFilter;
  progress: ProgressFilter;
  deadlineQuick: DeadlineQuickFilter;
  fresh: FreshFilter;
  publishDate: string;
  projectType: string;
  noticeKind: string;
  year: string;
  sortBy: SortOption;
};

type NoticeListUrlState = NoticeListFilterValues & {
  advancedOpen: boolean;
  page: number;
};

type NoticeListPositionSnapshot = {
  href: string;
  filterKey: string;
  noticeId: string;
  page: number;
  savedAt: number;
  scrollY: number;
};
type NoticeListPositionDraft = Omit<NoticeListPositionSnapshot, 'savedAt'>;

function readFirstSearchParam(params: SearchParamReader, ...keys: string[]) {
  for (const key of keys) {
    const value = params.get(key);

    if (value !== null) {
      return value;
    }
  }

  return '';
}

function pickAllowedValue<T extends string>(value: string, allowed: readonly T[], fallback: T) {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function parseNoticePage(value: string | null) {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function buildNoticeFilterKey(values: NoticeListFilterValues) {
  return [
    values.keyword.trim().toLowerCase(),
    values.schoolName.trim().toLowerCase(),
    values.region,
    values.majorKeyword.trim().toLowerCase(),
    values.category,
    values.discipline,
    values.schoolRange,
    values.progress,
    values.deadlineQuick,
    values.fresh,
    values.publishDate,
    values.projectType,
    values.noticeKind,
    values.year,
    values.sortBy
  ].join('|');
}

function parseNoticeListUrlState(params: SearchParamReader) {
  if (!params.toString()) {
    return null;
  }

  return {
    keyword: readFirstSearchParam(params, 'q', 'keyword'),
    schoolName: readFirstSearchParam(params, 'school'),
    region: readFirstSearchParam(params, 'region', 'province') || '全部',
    majorKeyword: readFirstSearchParam(params, 'major'),
    category: readFirstSearchParam(params, 'category') || '全部',
    discipline: readFirstSearchParam(params, 'discipline') || '全部',
    schoolRange: pickAllowedValue(readFirstSearchParam(params, 'range'), rangeOptions, '全部'),
    progress: pickAllowedValue(readFirstSearchParam(params, 'status', 'progress'), progressOptions, '全部'),
    deadlineQuick: pickAllowedValue(readFirstSearchParam(params, 'deadline'), deadlineQuickOptions, '全部'),
    fresh: pickAllowedValue(readFirstSearchParam(params, 'fresh', 'new'), freshOptions, '全部'),
    publishDate: readFirstSearchParam(params, 'date', 'publishDate'),
    projectType: pickAllowedValue(readFirstSearchParam(params, 'type'), projectTypeOptions, '全部'),
    noticeKind: pickAllowedValue(readFirstSearchParam(params, 'kind', 'noticeKind'), noticeKindOptions, '全部'),
    year: readFirstSearchParam(params, 'year') || '2026',
    sortBy: pickAllowedValue(readFirstSearchParam(params, 'sort'), sortOptions, 'publish'),
    advancedOpen: readFirstSearchParam(params, 'advanced') === '1',
    page: parseNoticePage(params.get('page'))
  } satisfies NoticeListUrlState;
}

function appendSearchParam(params: URLSearchParams, key: string, value: string, fallback = '') {
  const normalizedValue = value.trim();

  if (normalizedValue && normalizedValue !== fallback) {
    params.set(key, normalizedValue);
  }
}

function buildNoticeListHref(values: NoticeListFilterValues, page: number, advancedOpen: boolean, anchorId?: string) {
  const params = new URLSearchParams();

  appendSearchParam(params, 'q', values.keyword);
  appendSearchParam(params, 'school', values.schoolName);
  appendSearchParam(params, 'region', values.region, '全部');
  appendSearchParam(params, 'major', values.majorKeyword);
  appendSearchParam(params, 'category', values.category, '全部');
  appendSearchParam(params, 'discipline', values.discipline, '全部');
  appendSearchParam(params, 'range', values.schoolRange, '全部');
  appendSearchParam(params, 'status', values.progress, '全部');
  appendSearchParam(params, 'deadline', values.deadlineQuick, '全部');
  appendSearchParam(params, 'fresh', values.fresh, '全部');
  appendSearchParam(params, 'date', values.publishDate);
  appendSearchParam(params, 'type', values.projectType, '全部');
  appendSearchParam(params, 'kind', values.noticeKind, '全部');
  appendSearchParam(params, 'year', values.year, '2026');
  appendSearchParam(params, 'sort', values.sortBy, 'publish');

  if (advancedOpen) {
    params.set('advanced', '1');
  }

  if (page > 1) {
    params.set('page', String(page));
  }

  const query = params.toString();
  const hash = anchorId ? `#notice-${encodeURIComponent(anchorId)}` : '';

  return `/notices${query ? `?${query}` : ''}${hash}`;
}

function getNoticeDomId(id: string) {
  return `notice-${id}`;
}

function getUrlWithoutHash(href: string) {
  return href.split('#')[0];
}

function replaceNoticeHistory(href: string) {
  window.history.replaceState(window.history.state, '', href);
}

function getNoticeScrollOwner() {
  return (
    document.querySelector<HTMLElement>('.desktop-route-content') ||
    (document.scrollingElement as HTMLElement | null)
  );
}

function writeNoticeListPosition(snapshot: NoticeListPositionDraft) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(
      NOTICE_LIST_POSITION_STORAGE_KEY,
      JSON.stringify({
        ...snapshot,
        savedAt: Date.now()
      } satisfies NoticeListPositionSnapshot)
    );
  } catch {
    // sessionStorage can be unavailable in strict privacy contexts; URL fallback still preserves the page.
  }
}

function readNoticeListPosition() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(NOTICE_LIST_POSITION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<NoticeListPositionSnapshot>;
    if (!parsed.href || !parsed.href.startsWith('/notices') || typeof parsed.scrollY !== 'number') {
      return null;
    }

    if (!parsed.savedAt || Date.now() - parsed.savedAt > 30 * 60 * 1000) {
      return null;
    }

    return {
      href: parsed.href,
      filterKey: parsed.filterKey || '',
      noticeId: parsed.noticeId || '',
      page: typeof parsed.page === 'number' ? parsed.page : 1,
      savedAt: parsed.savedAt,
      scrollY: parsed.scrollY
    } satisfies NoticeListPositionSnapshot;
  } catch {
    return null;
  }
}

function clearNoticeListPosition() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(NOTICE_LIST_POSITION_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures; they should not block browsing.
  }
}

export default function NoticesPage() {
  return (
    <Suspense fallback={<NoticesPageFallback />}>
      <NoticesPageContent />
    </Suspense>
  );
}

function NoticesPageFallback() {
  return (
    <SiteShell>
      <div className="desktop-notice-library">
        <section className={isDesktopSurface
          ? 'desktop-core-page-header desktop-page-header desktop-page-header--directory desktop-notice-hero page-hero'
          : 'desktop-notice-hero page-hero px-6 py-7 lg:px-8'}>
          <div className={isDesktopSurface ? 'desktop-page-header-copy' : undefined}>
            {isDesktopSurface ? <div className="desktop-page-header-title-row">
              <h1 className={isDesktopSurface ? 'desktop-page-header-title' : 'text-4xl font-semibold tracking-tight text-ink md:text-5xl'}>通知库</h1>
            </div> : <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">通知库</h1>}
            <p className={isDesktopSurface ? 'desktop-page-header-subtitle' : 'mt-4 text-base leading-8 text-slate-600'}>正在恢复你的浏览位置，请稍等。</p>
          </div>
        </section>
        <NoticeLoadingState />
      </div>
    </SiteShell>
  );
}

function NoticesPageContent() {
  const searchParams = useSearchParams();
  const initialUrlState = useMemo(() => parseNoticeListUrlState(searchParams), [searchParams]);
  const initialNoticeState = initialUrlState || defaultNoticeListState;
  const [projects, setProjects] = useState<PublicNoticeProject[]>(() =>
    filterMainNoticeProjects(baseNoticeProjects).filter((item) => String(item.year) === '2026')
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [lastLoadedAt, setLastLoadedAt] = useState('');
  const [loadError, setLoadError] = useState('');
  const hasOnlineSnapshotRef = useRef(false);
  const [keyword, setKeyword] = useState(initialNoticeState.keyword);
  const [schoolName, setSchoolName] = useState(initialNoticeState.schoolName);
  const [region, setRegion] = useState(initialNoticeState.region);
  const [majorKeyword, setMajorKeyword] = useState(initialNoticeState.majorKeyword);
  const [category, setCategory] = useState(initialNoticeState.category);
  const [discipline, setDiscipline] = useState(initialNoticeState.discipline);
  const [schoolRange, setSchoolRange] = useState<RangeFilter>(initialNoticeState.schoolRange);
  const [progress, setProgress] = useState<ProgressFilter>(initialNoticeState.progress);
  const [deadlineQuick, setDeadlineQuick] = useState<DeadlineQuickFilter>(initialNoticeState.deadlineQuick);
  const [fresh, setFresh] = useState<FreshFilter>(initialNoticeState.fresh);
  const [publishDate, setPublishDate] = useState(initialNoticeState.publishDate);
  const [projectType, setProjectType] = useState(initialNoticeState.projectType);
  const [noticeKind, setNoticeKind] = useState(initialNoticeState.noticeKind);
  const [year, setYear] = useState(initialNoticeState.year);
  const [sortBy, setSortBy] = useState<SortOption>(initialNoticeState.sortBy);
  const [advancedOpen, setAdvancedOpen] = useState(initialNoticeState.advancedOpen);
  const [pageState, setPageState] = useState(() => ({
    page: initialNoticeState.page,
    filterKey: buildNoticeFilterKey(initialNoticeState)
  }));
  const filterValues = useMemo<NoticeListFilterValues>(
    () => ({
      keyword,
      schoolName,
      region,
      majorKeyword,
      category,
      discipline,
      schoolRange,
      progress,
      deadlineQuick,
      fresh,
      publishDate,
      projectType,
      noticeKind,
      year,
      sortBy
    }),
    [
      keyword,
      schoolName,
      region,
      majorKeyword,
      category,
      discipline,
      schoolRange,
      progress,
      deadlineQuick,
      fresh,
      publishDate,
      projectType,
      noticeKind,
      year,
      sortBy
    ]
  );
  const filterKey = buildNoticeFilterKey(filterValues);
  const activeFilterCount = useMemo(
    () =>
      [
        keyword.trim(),
        schoolName.trim(),
        region !== defaultNoticeListState.region,
        majorKeyword.trim(),
        category !== defaultNoticeListState.category,
        discipline !== defaultNoticeListState.discipline,
        schoolRange !== defaultNoticeListState.schoolRange,
        progress !== defaultNoticeListState.progress,
        deadlineQuick !== defaultNoticeListState.deadlineQuick,
        fresh !== defaultNoticeListState.fresh,
        publishDate,
        projectType !== defaultNoticeListState.projectType,
        noticeKind !== defaultNoticeListState.noticeKind,
        year !== defaultNoticeListState.year,
        sortBy !== defaultNoticeListState.sortBy
      ].filter(Boolean).length,
    [
      category,
      deadlineQuick,
      discipline,
      fresh,
      keyword,
      majorKeyword,
      noticeKind,
      progress,
      projectType,
      publishDate,
      region,
      schoolName,
      schoolRange,
      sortBy,
      year
    ]
  );

  useEffect(() => {
    let active = true;

    async function loadPublicNotices() {
      setIsLoading(true);
      setLoadError('');

      try {
        const rows = await fetchPublicNotices({ refresh: reloadToken > 0 });
        if (active) {
          setProjects(rows.filter((item) => String(item.year) === '2026'));
          hasOnlineSnapshotRef.current = true;
          setLastLoadedAt(getBeijingTimeString());
        }
      } catch {
        if (active) {
          if (hasOnlineSnapshotRef.current) {
            setLoadError('本次刷新失败，继续展示上次同步成功的通知。');
          } else {
            setProjects(filterMainNoticeProjects(baseNoticeProjects).filter((item) => String(item.year) === '2026'));
            setLoadError('通知同步暂时不可用，已展示本地兜底数据。');
          }
        }
      } finally {
        if (active) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    void loadPublicNotices();

    return () => {
      active = false;
    };
  }, [reloadToken]);

  const categoryOptions = useMemo(
    () => ['全部', ...Array.from(new Set(projects.map((item) => inferDisciplineCategory(item.discipline))))],
    [projects]
  );

  const disciplineOptions = useMemo(() => {
    const rows =
      category === '全部'
        ? projects
        : projects.filter((item) => inferDisciplineCategory(item.discipline) === category);

    return ['全部', ...Array.from(new Set(rows.map((item) => getDisplayDiscipline(item.discipline)).filter(Boolean)))];
  }, [projects, category]);

  const regionOptions = useMemo(() => ['全部', ...getNoticeRegionOptions(projects)], [projects]);

  const schoolOptions = useMemo(() => {
    const rows = region === '全部' ? projects : projects.filter((item) => getNoticeRegion(item) === region);
    const schools = Array.from(new Set(rows.map((item) => getDisplaySchoolName(item.schoolName)).filter((item) => item && item !== '待识别院校')));

    return ['全部', ...schools.sort((left, right) => left.localeCompare(right, 'zh-CN'))];
  }, [projects, region]);

  const todayInBeijing = getBeijingDateString();

  const filteredProjects = useMemo(() => {
    const noticeKeyword = keyword.trim().toLowerCase();
    const schoolKeyword = schoolName.trim().toLowerCase();
    const majorText = majorKeyword.trim().toLowerCase();

    const rows = projects.filter((item) => {
      const displaySchool = getDisplaySchoolName(item.schoolName);
      const displayDepartment = getDisplayNoticeDepartment(item);
      const displayTitle = normalizeNoticeTitle(item.projectName, 160);
      const primaryKeywordText = [displaySchool, displayDepartment, displayTitle].join(' ').toLowerCase();
      const secondaryKeywordText = [
        getDisplayDiscipline(item.discipline),
        getNoticeCardTags(item).join(' ')
      ]
        .join(' ')
        .toLowerCase();
      const canUseBroadKeyword = noticeKeyword.length >= 4 || /[a-z0-9]/i.test(noticeKeyword);
      const matchesType = matchesNoticeType(item, projectType);
      const matchesKind = matchesNoticeKind(item, noticeKind);
      const matchesRange = matchesSchoolRange(item, schoolRange);
      const matchesRegion = region === '全部' ? true : getNoticeRegion(item) === region || (item.tags || []).includes(region);
      const matchesSchool =
        schoolName === '全部' ||
        !schoolKeyword ||
        [displaySchool, displayDepartment].join(' ').toLowerCase().includes(schoolKeyword);
      const matchesCategory = category === '全部' ? true : inferDisciplineCategory(item.discipline) === category;
      const matchesDiscipline = discipline === '全部' ? true : getDisplayDiscipline(item.discipline) === discipline;
      const matchesMajor =
        !majorText ||
        [getDisplayDiscipline(item.discipline), displayDepartment, displayTitle, getNoticeCardTags(item).join(' ')]
          .join(' ')
          .toLowerCase()
          .includes(majorText);
      const matchesProgressState = matchesProgress(progress, item);
      const matchesDeadlineQuick =
        deadlineQuick === '全部'
          ? true
          : deadlineQuick === 'today'
            ? getDeadlineLevelFromDate(item.deadlineDate) === 'today'
            : deadlineQuick === 'within3days'
              ? ['today', 'within3days'].includes(getDeadlineLevelFromDate(item.deadlineDate))
              : ['today', 'within3days', 'within7days'].includes(getDeadlineLevelFromDate(item.deadlineDate));
      const matchesFresh = fresh === '全部' ? true : item.publishDate === todayInBeijing;
      const matchesPublishDate = publishDate ? item.publishDate === publishDate : true;
      const matchesYear = year === '全部' ? true : String(item.year) === year;
      const matchesKeyword =
        !noticeKeyword ||
        primaryKeywordText.includes(noticeKeyword) ||
        (canUseBroadKeyword && secondaryKeywordText.includes(noticeKeyword));

      return (
        matchesType &&
        matchesKind &&
        matchesRange &&
        matchesRegion &&
        matchesSchool &&
        matchesCategory &&
        matchesDiscipline &&
        matchesMajor &&
        matchesProgressState &&
        matchesDeadlineQuick &&
        matchesFresh &&
        matchesPublishDate &&
        matchesYear &&
        matchesKeyword
      );
    });

    return sortProjects(rows, sortBy);
  }, [
    projects,
    keyword,
    schoolName,
    region,
    majorKeyword,
    category,
    discipline,
    schoolRange,
    progress,
    deadlineQuick,
    fresh,
    publishDate,
    projectType,
    noticeKind,
    year,
    sortBy,
    todayInBeijing
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const requestedPage = pageState.filterKey === filterKey ? pageState.page : 1;
  const currentPage = Math.min(requestedPage, totalPages);
  const pagedProjects = filteredProjects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visiblePages = getVisiblePages(currentPage, totalPages);
  const isNoticeLoading = isLoading && projects.length === 0;
  const latestPublishDate = projects.reduce((latest, item) => (item.publishDate > latest ? item.publishDate : latest), '');

  useEffect(() => {
    const preservedHash = window.location.hash.startsWith('#notice-') ? window.location.hash : '';
    const nextHref = `${buildNoticeListHref(filterValues, currentPage, advancedOpen)}${preservedHash}`;
    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (currentHref !== nextHref) {
      replaceNoticeHistory(nextHref);
    }
  }, [filterValues, currentPage, advancedOpen]);

  useEffect(() => {
    if (isNoticeLoading || !pagedProjects.length || typeof window === 'undefined') {
      return;
    }

    const snapshot = readNoticeListPosition();
    const currentPathWithSearch = `${window.location.pathname}${window.location.search}`;
    const expectedLocationHref = `${currentPathWithSearch}${window.location.hash}`;
    const restoreHref = buildNoticeListHref(filterValues, currentPage, advancedOpen);
    let cancelled = false;
    let firstRestoreFrame: number | null = null;
    let secondRestoreFrame: number | null = null;
    const isCurrentNoticeRestore = () =>
      !cancelled &&
      `${window.location.pathname}${window.location.search}${window.location.hash}` ===
        expectedLocationHref;
    const cancelNoticeRestore = () => {
      cancelled = true;
      if (firstRestoreFrame !== null) {
        window.cancelAnimationFrame(firstRestoreFrame);
      }
      if (secondRestoreFrame !== null) {
        window.cancelAnimationFrame(secondRestoreFrame);
      }
    };

    if (
      snapshot &&
      getUrlWithoutHash(snapshot.href) === currentPathWithSearch &&
      snapshot.filterKey === filterKey &&
      snapshot.page === currentPage
    ) {
      firstRestoreFrame = window.requestAnimationFrame(() => {
        if (!isCurrentNoticeRestore()) return;

        if (snapshot.noticeId) {
          document.getElementById(getNoticeDomId(snapshot.noticeId))?.scrollIntoView({
            block: 'center'
          });
        }

        secondRestoreFrame = window.requestAnimationFrame(() => {
          if (!isCurrentNoticeRestore()) return;

          getNoticeScrollOwner()?.scrollTo({
            top: Math.max(0, snapshot.scrollY),
            behavior: 'auto'
          });
          replaceNoticeHistory(restoreHref);
          clearNoticeListPosition();
        });
      });
      return cancelNoticeRestore;
    }

    if (snapshot && getUrlWithoutHash(snapshot.href) !== currentPathWithSearch) {
      clearNoticeListPosition();
    }

    const hash = window.location.hash;
    if (!hash.startsWith('#notice-')) {
      return;
    }

    firstRestoreFrame = window.requestAnimationFrame(() => {
      if (!isCurrentNoticeRestore()) return;

      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({
        block: 'center'
      });
      replaceNoticeHistory(restoreHref);
    });
    return cancelNoticeRestore;
  }, [isNoticeLoading, currentPage, filterKey, pagedProjects.length, filterValues, advancedOpen]);

  const urgentProjects = useMemo(
    () =>
      sortProjects(
        projects.filter((item) => ['today', 'within3days', 'within7days'].includes(getDeadlineLevelFromDate(item.deadlineDate))),
        'deadline'
      ).slice(0, 5),
    [projects]
  );

  const todayUpdates = useMemo(() => {
    const counts = new Map<string, number>();
    const todayRows = projects.filter((item) => item.publishDate === todayInBeijing);
    const fallbackRows = latestPublishDate ? projects.filter((item) => item.publishDate === latestPublishDate) : [];
    const rows = todayRows.length ? todayRows : fallbackRows;

    rows.forEach((item) => {
      const school = getDisplaySchoolName(item.schoolName);
      counts.set(school, (counts.get(school) || 0) + 1);
    });

    return {
      date: todayRows.length ? todayInBeijing : latestPublishDate,
      hasTodayRows: todayRows.length > 0,
      rows: Array.from(counts.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
    };
  }, [projects, todayInBeijing, latestPublishDate]);

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

  function rememberNoticeListPosition(event: MouseEvent<HTMLAnchorElement>, noticeId: string, returnHref: string) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    writeNoticeListPosition({
      href: returnHref,
      filterKey,
      noticeId,
      page: currentPage,
      scrollY: getNoticeScrollOwner()?.scrollTop || 0
    });
    replaceNoticeHistory(returnHref);
  }

  function resetFilters() {
    setKeyword(defaultNoticeListState.keyword);
    setSchoolName(defaultNoticeListState.schoolName);
    setRegion(defaultNoticeListState.region);
    setMajorKeyword(defaultNoticeListState.majorKeyword);
    setCategory(defaultNoticeListState.category);
    setDiscipline(defaultNoticeListState.discipline);
    setSchoolRange(defaultNoticeListState.schoolRange);
    setProgress(defaultNoticeListState.progress);
    setDeadlineQuick(defaultNoticeListState.deadlineQuick);
    setFresh(defaultNoticeListState.fresh);
    setPublishDate(defaultNoticeListState.publishDate);
    setProjectType(defaultNoticeListState.projectType);
    setNoticeKind(defaultNoticeListState.noticeKind);
    setYear(defaultNoticeListState.year);
    setSortBy(defaultNoticeListState.sortBy);
    setAdvancedOpen(defaultNoticeListState.advancedOpen);
    setPageState({
      page: 1,
      filterKey: buildNoticeFilterKey(defaultNoticeListState)
    });
  }

  function refreshLatestNotices() {
    if (isLoading || isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setReloadToken((value) => value + 1);
  }

  const noticeResultsToolbar = (
    <div className="desktop-notice-toolbar flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-semibold text-ink">
          {isNoticeLoading ? '正在加载通知...' : `共 ${filteredProjects.length.toLocaleString('zh-CN')} 条结果`}
        </span>
        {!isDesktopSurface && lastLoadedAt ? <span className="text-slate-400">已同步 {lastLoadedAt}</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={refreshLatestNotices}
          disabled={isLoading || isRefreshing}
          className="desktop-notice-toolbar-action inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? '刷新中' : '刷新最新'}
        </button>
        <button onClick={resetFilters} className="desktop-notice-toolbar-action inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand">
          <RefreshCw className="h-4 w-4" />
          重置筛选
        </button>
      </div>
    </div>
  );

  return (
    <SiteShell>
      <div className="desktop-core-page desktop-core-page--scroll desktop-notice-library">
      <section className={`desktop-core-page-header desktop-notice-hero page-hero${
        isDesktopSurface ? ' desktop-page-header desktop-page-header--directory' : ''
      }`}>
        <div className={isDesktopSurface ? 'desktop-page-header-copy' : undefined}>
          {isDesktopSurface ? <div className="desktop-page-header-title-row">
            <h1 className="desktop-page-header-title">通知库</h1>
          </div> : <h1>通知库</h1>}
          <p className={isDesktopSurface ? 'desktop-page-header-subtitle' : undefined}>持续同步公开保研通知，优先展示可报名项目与关键截止时间。</p>
        </div>
      </section>

      <section className="desktop-notice-filters product-card rounded-[30px] p-5 lg:p-6">
        <div className="desktop-notice-search-row grid gap-3 xl:grid-cols-[minmax(280px,1fr)_150px_170px_180px_148px]">
          <label className="desktop-notice-search-field flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4">
            <span className="sr-only">搜索通知</span>
            <Search className="h-5 w-5 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索学校 / 学院 / 专业关键词"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </label>
          <CompactFilterSelect label="申请状态" value={progress} onChange={(value) => setProgress(value as ProgressFilter)}>
            {(['全部', '报名中', '未开始', '已结束'] as ProgressFilter[]).map((item) => (
              <option key={item} value={item}>{item === '全部' ? '全部状态' : item}</option>
            ))}
          </CompactFilterSelect>
          <CompactFilterSelect label="截止范围" value={deadlineQuick} onChange={(value) => setDeadlineQuick(value as DeadlineQuickFilter)}>
            <option value="全部">全部截止时间</option>
            <option value="today">今天截止</option>
            <option value="within3days">3天内截止</option>
            <option value="within7days">7天内截止</option>
          </CompactFilterSelect>
          <CompactFilterSelect label="排序方式" value={sortBy} onChange={(value) => setSortBy(value as SortOption)}>
            <option value="publish">最新发布优先</option>
            <option value="updated">最近更新优先</option>
            <option value="deadline">最近截止优先</option>
            <option value="school">按学校名称</option>
          </CompactFilterSelect>
          <button
            type="button"
            onClick={() => setAdvancedOpen((current) => !current)}
            aria-expanded={advancedOpen}
            className="desktop-notice-filter-toggle inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-brand hover:text-brand"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {advancedOpen ? '收起筛选' : '更多筛选'}
            {activeFilterCount > 0 ? <span className="desktop-notice-filter-count">{activeFilterCount}</span> : null}
          </button>
        </div>

        {!isDesktopSurface && activeFilterCount > 0 ? (
          <div className="desktop-notice-active-filters mt-3 flex items-center gap-3 text-sm text-slate-500" role="status">
            <span>已应用 {activeFilterCount} 项筛选</span>
            <button type="button" onClick={resetFilters} className="font-semibold text-brand hover:text-brand-deep">
              清除全部
            </button>
          </div>
        ) : null}

        {advancedOpen ? (
          <div className="desktop-notice-advanced-filters mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-3 xl:grid-cols-4">
            <FilterSelect label="年份" value={year} onChange={setYear}>
              <option value="2026">2026</option>
              <option value="全部">全部</option>
            </FilterSelect>
            <FilterSelect label="申请阶段" value={projectType} onChange={setProjectType}>
              {projectTypeOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="通知性质" value={noticeKind} onChange={setNoticeKind}>
              {noticeKindOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="学校层次" value={schoolRange} onChange={(value) => setSchoolRange(value as RangeFilter)}>
              {(['全部', '985', '211', '双一流', '其他'] as RangeFilter[]).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="省份 / 地区"
              value={region}
              onChange={(value) => {
                setRegion(value);
                setSchoolName('');
              }}
            >
              {regionOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="学校"
              value={schoolName || '全部'}
              onChange={(value) => setSchoolName(value === '全部' ? '' : value)}
            >
              {schoolName && !schoolOptions.includes(schoolName) ? <option value={schoolName}>{schoolName}</option> : null}
              {schoolOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="学科"
              value={category}
              onChange={(value) => {
                setCategory(value);
                setDiscipline('全部');
              }}
            >
              {categoryOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="新增" value={fresh} onChange={(value) => setFresh(value as FreshFilter)}>
              <option value="全部">不限</option>
              <option value="today">今日新增</option>
            </FilterSelect>
            <FilterInput label="专业关键词" value={majorKeyword} onChange={setMajorKeyword} placeholder="例如 人工智能" />
            <FilterSelect label="细分专业" value={discipline} onChange={setDiscipline}>
              {disciplineOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </FilterSelect>
          </div>
        ) : null}
        {loadError ? (
          <div className="desktop-notice-filter-error mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700" role="alert">
            {loadError}
          </div>
        ) : null}
      </section>

      <section
        className="desktop-notice-results grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_330px]"
        aria-busy={isNoticeLoading}
      >
        {isDesktopSurface ? noticeResultsToolbar : null}
        <div className="desktop-notice-main-column grid content-start gap-4">
          {!isDesktopSurface ? noticeResultsToolbar : null}

          <div className="desktop-notice-list">
            {isNoticeLoading ? (
              <NoticeLoadingState />
            ) : (
              pagedProjects.map((project, index) => {
              const daysLeft = getDaysLeft(project);
              const city = getCityTag(project);
              const deadlineLevel = getDeadlineLevelFromDate(project.deadlineDate);
              const highlighted = currentPage === 1 && index === 0 && deadlineLevel !== 'expired';
              const returnHref = buildNoticeListHref(filterValues, currentPage, advancedOpen, project.id);
              const detailHref = buildNoticeDetailHref(project.id, returnHref);

              return (
                <article
                  id={getNoticeDomId(project.id)}
                  key={project.id}
                  className={`desktop-notice-card relative min-h-[210px] overflow-hidden rounded-[26px] border bg-white p-5 transition sm:min-h-[210px] ${
                    isDesktopSurface ? 'desktop-notice-card--reference ' : ''
                  }${
                    highlighted ? 'desktop-notice-card--highlighted' : ''
                  }`}
                >
                  <div className="desktop-notice-card-layout grid h-full gap-5 sm:grid-cols-[70px_minmax(0,1fr)_176px]">
                    <ExternalSiteMark
                      source={resolveNoticeLogoSource(project)}
                      label={getDisplaySchoolName(project.schoolName)}
                      size="lg"
                      rounded="full"
                    />

                    <div className="desktop-notice-card-copy flex h-full min-w-0 flex-col overflow-hidden">
                      <div className="desktop-notice-card-heading flex min-w-0 flex-wrap items-center gap-2">
                        <h2 className="shrink-0 text-lg font-semibold text-ink">{getDisplaySchoolName(project.schoolName)}</h2>
                        <span className="desktop-notice-card-status shrink-0">
                          <DeadlineBadge level={deadlineLevel} />
                        </span>
                      </div>
                      <Link
                        href={detailHref}
                        onClick={(event) => rememberNoticeListPosition(event, project.id, returnHref)}
                        className="desktop-notice-card-title mt-2 line-clamp-2 min-h-[3.35rem] text-lg font-semibold leading-7 text-slate-800 hover:text-brand"
                        title={normalizeNoticeTitle(project.projectName, 160)}
                      >
                        {normalizeNoticeTitle(project.projectName, 86)}
                      </Link>
                      <div className="desktop-notice-card-meta mt-3 flex h-5 items-center gap-3 overflow-hidden text-xs text-slate-500">
                        <span className="desktop-notice-card-department inline-flex min-w-0 items-center gap-1.5 truncate">
                          {isDesktopSurface ? (
                            <CalendarDays className="h-4 w-4 shrink-0" />
                          ) : (
                            <BookOpenText className="h-4 w-4 shrink-0" />
                          )}
                          {getDisplayNoticeDepartment(project)}
                        </span>
                        <span className="desktop-notice-card-published inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
                          <Clock3 className="h-4 w-4" />
                          发布于 {formatNoticeDateOnly(project.publishDate)}
                        </span>
                        {city ? (
                          <span className="desktop-notice-card-city inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
                            <MapPin className="h-3.5 w-3.5" />
                            {city}
                          </span>
                        ) : null}
                      </div>
                      <div className="desktop-notice-card-tags mt-3 flex h-7 flex-nowrap gap-2 overflow-hidden">
                        {getNoticeCardTags(project).map((item) => (
                          <span
                            key={item}
                            className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                      <div className="desktop-notice-card-source mt-auto pt-3 text-xs font-semibold text-brand">提交前请核对院校原文</div>
                    </div>

                    <div className="desktop-notice-card-actions grid gap-3 sm:h-full sm:justify-items-end">
                      <div className="desktop-notice-card-deadline text-right text-sm">
                        <div className="font-semibold text-brand">截止 {formatNoticeDateOnly(project.deadlineDate)}</div>
                        <div className="mt-1 text-slate-500">
                          {daysLeft === null ? '时间待补充' : getDeadlineDistanceLabel(project.deadlineDate)}
                        </div>
                      </div>
                      <div
                        className={`desktop-notice-card-buttons grid w-full gap-2 sm:w-[150px]${
                          deadlineLevel === 'expired' ? ' desktop-notice-card-buttons--expired' : ''
                        }`}
                      >
                        <Link
                          href={detailHref}
                          onClick={(event) => rememberNoticeListPosition(event, project.id, returnHref)}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-brand/20 bg-white px-4 text-sm font-semibold text-brand transition hover:border-brand"
                        >
                          查看详情
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                        {deadlineLevel === 'expired' ? null : (
                          <ApplicationActionButton projectId={project.id} variant="secondary" label="加入申请" />
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
              })
            )}

            {!isNoticeLoading && !pagedProjects.length ? (
              <DesktopStateSurface
                variant="section"
                icon={<BookOpenText />}
                title="没有找到匹配通知"
                detail="可以减少筛选条件、换一个关键词，或清除当前筛选重新查看。"
                action={(
                  <button type="button" className="desktop-setting-secondary-button" onClick={resetFilters}>
                    清除筛选
                  </button>
                )}
              />
            ) : null}
          </div>

          {!isNoticeLoading && filteredProjects.length && totalPages > 1 ? (
            <nav
              aria-label="通知分页"
              className="flex flex-wrap items-center justify-center gap-3 rounded-[22px] bg-white px-5 py-5 shadow-sm"
            >
              <button
                type="button"
                aria-label="上一页"
                onClick={() => updatePage((current) => Math.max(1, current - 1))}
                disabled={currentPage === 1}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {visiblePages.map((pageNumber, index) => (
                <button
                  key={`${pageNumber}-${index}`}
                  type="button"
                  aria-label={`第 ${pageNumber} 页`}
                  aria-current={currentPage === pageNumber ? 'page' : undefined}
                  onClick={() => updatePage(pageNumber)}
                  className={`h-11 min-w-11 rounded-xl px-4 text-sm font-semibold ${
                    currentPage === pageNumber ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {pageNumber}
                </button>
              ))}

              <button
                type="button"
                aria-label="下一页"
                onClick={() => updatePage((current) => Math.min(totalPages, current + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          ) : null}
        </div>

        <aside className="desktop-notice-sidebar grid content-start gap-5">
          <SideCard title="截止提醒" icon={BellRing}>
            <div className="desktop-notice-deadline-list grid gap-4">
              {isNoticeLoading ? (
                <SideLoadingState icon={Clock3} label="正在整理截止提醒" />
              ) : urgentProjects.length ? (
                urgentProjects.map((project) => {
                  const daysLeft = getDaysLeft(project);
                  const returnHref = buildNoticeListHref(filterValues, currentPage, advancedOpen);

                  return (
                    <Link
                      key={project.id}
                      href={buildNoticeDetailHref(project.id, returnHref)}
                      onClick={(event) => rememberNoticeListPosition(event, project.id, returnHref)}
                      className="desktop-notice-deadline-item grid gap-1 rounded-xl p-2 hover:bg-slate-50"
                    >
                      <div className="desktop-notice-deadline-row flex items-center justify-between gap-3 text-sm">
                        <span className="desktop-notice-deadline-school font-semibold text-slate-700">
                          {getDisplaySchoolName(project.schoolName)}
                        </span>
                        <span className="desktop-notice-deadline-distance font-semibold text-rose-500">
                          {daysLeft === null ? '-' : getDeadlineDistanceLabel(project.deadlineDate)}
                        </span>
                      </div>
                      <div className="desktop-notice-deadline-summary line-clamp-1 text-xs text-slate-500">
                        {normalizeNoticeTitle(project.projectName, 34)}
                      </div>
                      <div className="desktop-notice-deadline-date text-xs text-slate-400">
                        {formatNoticeDateOnly(project.deadlineDate)} 截止
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">暂无 7 天内截止通知。</div>
              )}
            </div>
          </SideCard>

          <SideCard title="今日更新" icon={RefreshCw}>
            <div className="desktop-notice-today-list grid gap-3">
              {!todayUpdates.hasTodayRows && todayUpdates.date ? (
                <div className="desktop-notice-today-fallback rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">
                  暂无今日新增，以下显示最近同步日 {todayUpdates.date} 的更新。
                </div>
              ) : null}
              {isNoticeLoading ? (
                <SideLoadingState icon={BookOpenText} label="正在汇总今日更新" />
              ) : todayUpdates.rows.length ? (
                todayUpdates.rows.map(([school, count]) => (
                  <div key={school} className="desktop-notice-today-row flex items-center justify-between gap-3 text-sm">
                    <span className="desktop-notice-today-school text-slate-700">{school}</span>
                    <span className="desktop-notice-today-count font-semibold text-slate-500">{count} 条</span>
                  </div>
                ))
              ) : (
                <p className="desktop-notice-side-empty">暂无更新记录。</p>
              )}
            </div>
          </SideCard>

        </aside>
      </section>

      </div>
    </SiteShell>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="soft-input h-12 w-full rounded-xl px-4 text-sm text-slate-700 outline-none placeholder:text-slate-400"
      />
    </label>
  );
}

function CompactFilterSelect({
  label,
  value,
  onChange,
  children
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="desktop-notice-compact-filter">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-brand"
      >
        {children}
      </select>
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="soft-input h-12 w-full rounded-xl px-4 text-sm font-semibold text-slate-700 outline-none"
      >
        {children}
      </select>
    </label>
  );
}

function SideCard({
  title,
  icon: Icon,
  children
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <div className="desktop-notice-sidecard product-card rounded-[22px] p-6">
      <div className="desktop-notice-sidecard-header mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="desktop-notice-sidecard-icon inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/8 text-brand">
            <Icon className="h-5 w-5" />
          </span>
          <h2 className="desktop-notice-sidecard-title text-lg font-semibold text-ink">{title}</h2>
        </div>
      </div>
      {children}
    </div>
  );
}

function NoticeLoadingState() {
  return (
    <div
      className="desktop-notice-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="desktop-notice-loading-heading">
        <span className="desktop-notice-loading-icon">
          <RefreshCw className="motion-safe:animate-spin" aria-hidden="true" />
        </span>
        <span>
          <strong>正在同步通知</strong>
          <small>
            {isDesktopSurface
              ? '正在获取最新院校通知，当前筛选会保留。'
              : '正在同步最新院校通知、报名截止与更新信息。完成后会保留当前筛选条件'}
          </small>
        </span>
      </div>
      <div className="desktop-notice-loading-rows" aria-hidden="true">
        {NOTICE_LOADING_ROWS.map((index) => (
          <span className="desktop-notice-loading-row" key={index}>
            <i />
            <span>
              <b />
              <em />
              <small />
            </span>
            <span>
              <b />
              <small />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SideLoadingState({
  icon: Icon,
  label
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  label: string;
}) {
  return (
    <div
      className="desktop-notice-side-loading flex min-h-24 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-4"
      aria-hidden="true"
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand shadow-sm">
        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">加载完成后显示</p>
      </div>
    </div>
  );
}
