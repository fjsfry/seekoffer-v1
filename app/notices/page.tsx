'use client';

import { Suspense, useEffect, useMemo, useState, type ComponentType, type MouseEvent, type ReactNode } from 'react';
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
  GraduationCap,
  Lightbulb,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react';
import { ApplicationActionButton } from '@/components/application-action-button';
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
  noticeTypeFilters,
  type NoticeKindFilter
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
const projectTypeOptions = noticeTypeFilters;
const noticeKindOptions = noticeKindFilters;
const sortOptions: SortOption[] = ['deadline', 'publish', 'updated', 'school'];
const progressOptions: ProgressFilter[] = ['全部', '报名中', '未开始', '已结束'];
const rangeOptions: RangeFilter[] = ['全部', '985', '211', '双一流', '其他'];
const deadlineQuickOptions: DeadlineQuickFilter[] = ['全部', 'today', 'within3days', 'within7days'];
const freshOptions: FreshFilter[] = ['全部', 'today'];
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

const quickFilters = [
  { label: '今日新增', kind: 'fresh', value: 'today' },
  { label: '报名中', kind: 'progress', value: '报名中' },
  { label: '3天内截止', kind: 'deadline', value: 'within3days' },
  { label: '7天内截止', kind: 'deadline', value: 'within7days' },
  { label: '985', kind: 'range', value: '985' },
  { label: '211', kind: 'range', value: '211' },
  { label: '双一流', kind: 'range', value: '双一流' },
  { label: '宣讲会', kind: 'noticeKind', value: '宣讲会' },
  { label: '入营名单', kind: 'noticeKind', value: '入营名单' }
] as const;

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
      <section className="page-hero px-6 py-7 lg:px-8">
        <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">通知库</h1>
        <p className="mt-4 text-base leading-8 text-slate-600">正在恢复你的浏览位置，请稍等。</p>
      </section>
      <NoticeListSkeleton />
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
      projectType,
      noticeKind,
      year,
      sortBy
    ]
  );
  const filterKey = buildNoticeFilterKey(filterValues);

  useEffect(() => {
    let active = true;

    async function loadPublicNotices() {
      setIsLoading(true);
      setLoadError('');

      try {
        const rows = await fetchPublicNotices({ refresh: reloadToken > 0 });
        if (active) {
          setProjects(rows.filter((item) => String(item.year) === '2026'));
          setLastLoadedAt(getBeijingTimeString());
        }
      } catch {
        if (active) {
          setProjects(filterMainNoticeProjects(baseNoticeProjects).filter((item) => String(item.year) === '2026'));
          setLoadError('通知同步暂时不可用，已展示本地兜底数据。');
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
  const todayUpdateCount = projects.filter((item) => item.publishDate === todayInBeijing).length;
  const latestPublishDate = projects.reduce((latest, item) => (item.publishDate > latest ? item.publishDate : latest), '');

  useEffect(() => {
    const preservedHash = window.location.hash.startsWith('#notice-') ? window.location.hash : '';
    const nextHref = `${buildNoticeListHref(filterValues, currentPage, advancedOpen)}${preservedHash}`;
    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (currentHref !== nextHref) {
      window.history.replaceState(null, '', nextHref);
    }
  }, [filterValues, currentPage, advancedOpen]);

  useEffect(() => {
    if (isNoticeLoading || !pagedProjects.length || typeof window === 'undefined') {
      return;
    }

    const snapshot = readNoticeListPosition();
    const currentPathWithSearch = `${window.location.pathname}${window.location.search}`;
    if (
      snapshot &&
      getUrlWithoutHash(snapshot.href) === currentPathWithSearch &&
      snapshot.filterKey === filterKey &&
      snapshot.page === currentPage
    ) {
      window.requestAnimationFrame(() => {
        if (snapshot.noticeId) {
          document.getElementById(getNoticeDomId(snapshot.noticeId))?.scrollIntoView({
            block: 'center'
          });
        }

        window.requestAnimationFrame(() => {
          window.scrollTo({
            top: Math.max(0, snapshot.scrollY),
            behavior: 'auto'
          });
          window.history.replaceState(null, '', buildNoticeListHref(filterValues, currentPage, advancedOpen));
          clearNoticeListPosition();
        });
      });
      return;
    }

    if (snapshot && getUrlWithoutHash(snapshot.href) !== currentPathWithSearch) {
      clearNoticeListPosition();
    }

    const hash = window.location.hash;
    if (!hash.startsWith('#notice-')) {
      return;
    }

    window.requestAnimationFrame(() => {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({
        block: 'center'
      });
      window.history.replaceState(null, '', buildNoticeListHref(filterValues, currentPage, advancedOpen));
    });
  }, [isNoticeLoading, currentPage, filterKey, pagedProjects.length, filterValues, advancedOpen]);

  const pageStats = [
    { label: '2026通知', value: isNoticeLoading ? '加载中' : `${projects.length}+`, icon: BellRing },
    { label: '今日更新', value: isNoticeLoading ? '加载中' : `${todayUpdateCount}`, icon: BookOpenText },
    {
      label: '3天内截止',
      value: isNoticeLoading
        ? '加载中'
        : `${
            projects.filter((item) => {
              const level = getDeadlineLevelFromDate(item.deadlineDate);
              return level === 'today' || level === 'within3days';
            }).length
          }`,
      icon: Clock3
    }
  ];

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
      scrollY: window.scrollY
    });
    window.history.replaceState(null, '', returnHref);
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

  function applyQuickFilter(filter: (typeof quickFilters)[number]) {
    if (filter.kind === 'fresh') {
      if (fresh === filter.value) {
        setFresh('全部');
        setSortBy((current) => (current === 'updated' ? defaultNoticeListState.sortBy : current));
        return;
      }

      setFresh(filter.value as FreshFilter);
      setSortBy('updated');
      return;
    }

    if (filter.kind === 'progress') {
      setProgress((current) => (current === filter.value ? '全部' : (filter.value as ProgressFilter)));
      return;
    }

    if (filter.kind === 'deadline') {
      const nextDeadline = filter.value as DeadlineQuickFilter;
      if (deadlineQuick === nextDeadline) {
        setDeadlineQuick('全部');
        setProgress((current) => (current === '报名中' ? '全部' : current));
        setSortBy((current) => (current === 'deadline' ? defaultNoticeListState.sortBy : current));
        return;
      }

      setProgress('报名中');
      setDeadlineQuick(nextDeadline);
      setSortBy('deadline');
      return;
    }

    if (filter.kind === 'range') {
      setSchoolRange((current) => (current === filter.value ? '全部' : (filter.value as RangeFilter)));
      return;
    }

    if (filter.kind === 'noticeKind') {
      setNoticeKind((current) => (current === filter.value ? '全部' : (filter.value as NoticeKindFilter)));
    }
  }

  function isQuickFilterActive(filter: (typeof quickFilters)[number]) {
    if (filter.kind === 'fresh') return fresh === filter.value;
    if (filter.kind === 'progress') return progress === filter.value;
    if (filter.kind === 'deadline') return deadlineQuick === filter.value;
    if (filter.kind === 'range') return schoolRange === filter.value;
    return noticeKind === filter.value;
  }

  return (
    <SiteShell>
      <section className="page-hero grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:px-8">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">通知库</h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            持续同步公开保研通知，优先展示可报名项目与关键截止时间。
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

      <section className="product-card rounded-[30px] p-5 lg:p-6">
        <div className="flex flex-wrap gap-4 border-b border-slate-100 pb-5">
          {projectTypeOptions.map((item) => (
            <button
              key={item}
              onClick={() => setProjectType((current) => (item === '全部' || current === item ? '全部' : item))}
              className={`relative px-4 py-2 text-sm font-semibold transition ${
                projectType === item ? 'text-brand' : 'text-slate-500 hover:text-brand'
              }`}
            >
              {item}
              <span
                className={`absolute inset-x-3 -bottom-5 h-0.5 rounded-full bg-brand transition ${
                  projectType === item ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_160px]">
          <label className="flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
            <Search className="h-5 w-5 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索学校 / 学院 / 专业关键词"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </label>
          <button
            type="button"
            onClick={() => setAdvancedOpen((current) => !current)}
            className="inline-flex h-14 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-brand px-5 text-sm font-semibold text-white shadow-float transition hover:-translate-y-0.5 hover:bg-brand-deep"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {advancedOpen ? '收起筛选' : '高级筛选'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold text-slate-400">快捷筛选</span>
          {quickFilters.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => applyQuickFilter(item)}
              aria-pressed={isQuickFilterActive(item)}
              className={`rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                isQuickFilterActive(item) ? 'bg-brand text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-brand/8 hover:text-brand'
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={resetFilters}
            className="ml-auto rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-brand hover:text-brand"
          >
            重置
          </button>
        </div>

        {advancedOpen ? (
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-3 xl:grid-cols-4">
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
            <FilterSelect label="状态" value={progress} onChange={(value) => setProgress(value as ProgressFilter)}>
              {(['全部', '报名中', '未开始', '已结束'] as ProgressFilter[]).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="新增" value={fresh} onChange={(value) => setFresh(value as FreshFilter)}>
              <option value="全部">不限</option>
              <option value="today">今日新增</option>
            </FilterSelect>
            <FilterSelect label="截止范围" value={deadlineQuick} onChange={(value) => setDeadlineQuick(value as DeadlineQuickFilter)}>
              <option value="全部">不限</option>
              <option value="today">今天截止</option>
              <option value="within3days">3天内截止</option>
              <option value="within7days">7天内截止</option>
            </FilterSelect>
            <FilterInput label="专业关键词" value={majorKeyword} onChange={setMajorKeyword} placeholder="例如 人工智能" />
            <FilterSelect label="细分专业" value={discipline} onChange={setDiscipline}>
              {disciplineOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="排序" value={sortBy} onChange={(value) => setSortBy(value as SortOption)}>
              <option value="publish">按发布时间排序</option>
              <option value="updated">按最新更新排序</option>
              <option value="deadline">按截止时间排序</option>
              <option value="school">按学校名称排序</option>
            </FilterSelect>
          </div>
        ) : null}
        {loadError ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {loadError}
          </div>
        ) : null}
      </section>

      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="grid content-start gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="font-semibold text-ink">
                {isNoticeLoading ? '正在加载通知...' : `共 ${filteredProjects.length.toLocaleString('zh-CN')} 条结果`}
              </span>
              <span className="text-slate-400">|</span>
              <button
                onClick={() => setSortBy('publish')}
                className={sortBy === 'publish' ? 'font-semibold text-brand' : 'text-slate-500 hover:text-brand'}
              >
                按发布时间排序
              </button>
              <button
                onClick={() => setSortBy('updated')}
                className={sortBy === 'updated' ? 'font-semibold text-brand' : 'text-slate-500 hover:text-brand'}
              >
                按最新更新排序
              </button>
              <button
                onClick={() => setSortBy('deadline')}
                className={sortBy === 'deadline' ? 'font-semibold text-brand' : 'text-slate-500 hover:text-brand'}
              >
                按截止时间排序
              </button>
              {lastLoadedAt ? <span className="text-slate-400">已同步 {lastLoadedAt}</span> : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={refreshLatestNotices}
                disabled={isLoading || isRefreshing}
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? '刷新中' : '刷新最新'}
              </button>
              <button onClick={resetFilters} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand">
                <RefreshCw className="h-4 w-4" />
                重置筛选
              </button>
            </div>
          </div>

          {isNoticeLoading ? (
            <NoticeListSkeleton />
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
                  className={`relative min-h-[210px] overflow-hidden rounded-[26px] border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft sm:min-h-[210px] ${
                    highlighted ? 'border-emerald-300 bg-emerald-50/35' : 'border-slate-200'
                  }`}
                >
                  {highlighted ? (
                    <div className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-br-2xl bg-emerald-500 text-sm font-bold text-white shadow-sm">
                      急
                    </div>
                  ) : null}

                  <div className="grid h-full gap-5 sm:grid-cols-[70px_minmax(0,1fr)_176px]">
                    <ExternalSiteMark
                      source={resolveNoticeLogoSource(project)}
                      label={getDisplaySchoolName(project.schoolName)}
                      size="lg"
                      rounded="full"
                    />

                    <div className="flex h-full min-w-0 flex-col overflow-hidden">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h2 className="shrink-0 text-lg font-semibold text-ink">{getDisplaySchoolName(project.schoolName)}</h2>
                        <span className="shrink-0">
                          <DeadlineBadge level={deadlineLevel} />
                        </span>
                      </div>
                      <Link
                        href={detailHref}
                        onClick={(event) => rememberNoticeListPosition(event, project.id, returnHref)}
                        className="mt-2 line-clamp-2 min-h-[3.35rem] text-lg font-semibold leading-7 text-slate-800 hover:text-brand"
                        title={normalizeNoticeTitle(project.projectName, 160)}
                      >
                        {normalizeNoticeTitle(project.projectName, 86)}
                      </Link>
                      <div className="mt-3 flex h-5 items-center gap-3 overflow-hidden text-xs text-slate-500">
                        <span className="min-w-0 truncate">{getDisplayNoticeDepartment(project)}</span>
                        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
                          <CalendarDays className="h-3.5 w-3.5" />
                          发布于 {formatNoticeDateOnly(project.publishDate)}
                        </span>
                        {city ? (
                          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
                            <MapPin className="h-3.5 w-3.5" />
                            {city}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 flex h-7 flex-nowrap gap-2 overflow-hidden">
                        {getNoticeCardTags(project).map((item) => (
                          <span
                            key={item}
                            className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                      <div className="mt-auto pt-3 text-xs font-semibold text-brand">寻鹿整理 · 关键信息已提取</div>
                    </div>

                    <div className="grid gap-3 sm:h-full sm:justify-items-end">
                      <div className="text-right text-sm">
                        <div className="font-semibold text-brand">截止 {formatNoticeDateOnly(project.deadlineDate)}</div>
                        <div className="mt-1 text-slate-500">
                          {daysLeft === null ? '时间待补充' : getDeadlineDistanceLabel(project.deadlineDate)}
                        </div>
                      </div>
                      <div className="grid w-full gap-2 sm:w-[150px]">
                        <Link
                          href={detailHref}
                          onClick={(event) => rememberNoticeListPosition(event, project.id, returnHref)}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-brand/20 bg-white px-4 text-sm font-semibold text-brand transition hover:border-brand"
                        >
                          查看详情
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                        <ApplicationActionButton projectId={project.id} variant="secondary" label="加入申请表" />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}

          {!isNoticeLoading && !pagedProjects.length ? (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">
              当前筛选条件下没有匹配通知，建议减少筛选条件或换一个关键词。
            </div>
          ) : null}

          {!isNoticeLoading && filteredProjects.length && totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-center gap-3 rounded-[22px] bg-white px-5 py-5 shadow-sm">
              <button
                onClick={() => updatePage((current) => Math.max(1, current - 1))}
                disabled={currentPage === 1}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {visiblePages.map((pageNumber, index) => (
                <button
                  key={`${pageNumber}-${index}`}
                  onClick={() => updatePage(pageNumber)}
                  className={`h-11 min-w-11 rounded-xl px-4 text-sm font-semibold ${
                    currentPage === pageNumber ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {pageNumber}
                </button>
              ))}

              <button
                onClick={() => updatePage((current) => Math.min(totalPages, current + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>

        <aside className="grid content-start gap-5">
          <SideCard title="截止提醒" icon={BellRing}>
            <div className="grid gap-4">
              {isNoticeLoading ? (
                <SideLoadingRows />
              ) : urgentProjects.length ? (
                urgentProjects.map((project) => {
                  const daysLeft = getDaysLeft(project);
                  const returnHref = buildNoticeListHref(filterValues, currentPage, advancedOpen);

                  return (
                    <Link
                      key={project.id}
                      href={buildNoticeDetailHref(project.id, returnHref)}
                      onClick={(event) => rememberNoticeListPosition(event, project.id, returnHref)}
                      className="grid gap-1 rounded-xl p-2 hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold text-slate-700">{getDisplaySchoolName(project.schoolName)}</span>
                        <span className="font-semibold text-rose-500">
                          {daysLeft === null ? '-' : getDeadlineDistanceLabel(project.deadlineDate)}
                        </span>
                      </div>
                      <div className="line-clamp-1 text-xs text-slate-500">{normalizeNoticeTitle(project.projectName, 34)}</div>
                      <div className="text-xs text-slate-400">{formatNoticeDateOnly(project.deadlineDate)} 截止</div>
                    </Link>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">暂无 7 天内截止通知。</div>
              )}
            </div>
          </SideCard>

          <SideCard title="今日更新" icon={RefreshCw}>
            <div className="grid gap-3">
              {!todayUpdates.hasTodayRows && todayUpdates.date ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">
                  暂无今日新增，以下显示最近同步日 {todayUpdates.date} 的更新。
                </div>
              ) : null}
              {isNoticeLoading ? (
                <SideLoadingRows />
              ) : todayUpdates.rows.length ? (
                todayUpdates.rows.map(([school, count]) => (
                  <div key={school} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-700">{school}</span>
                    <span className="font-semibold text-slate-500">{count} 条</span>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">暂无更新记录。</div>
              )}
            </div>
          </SideCard>

          <SideCard title="整理说明" icon={Lightbulb}>
            <p className="text-sm leading-7 text-slate-600">
              寻鹿会持续整理保研通知，提取学校、学院、项目阶段、截止时间和报名入口，帮助你更快判断下一步。
            </p>
            <Link href="/disclaimer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand">
              了解更多
              <ArrowRight className="h-4 w-4" />
            </Link>
          </SideCard>

          <SideCard title="使用提醒" icon={ShieldCheck}>
            <div className="grid gap-3 text-sm leading-7 text-slate-600">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <span className="font-semibold text-ink">先看重点：</span>
                优先关注院校、学院、通知标题、发布时间和截止时间。
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <span className="font-semibold text-ink">再做确认：</span>
                正式提交前，请再次核对学校页面与报名系统里的具体要求。
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <span className="font-semibold text-ink">发现问题：</span>
                可以加入 QQ 群 1092490793 告诉我们。
              </div>
            </div>
          </SideCard>
        </aside>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <PromoCard title="院校库" description="院校信息、专业设置及推免政策查询" href="/colleges" icon={GraduationCap} />
        <PromoCard title="资源库" description="汇集面试经验与文书模板，助力申请" href="/resources" icon={BookOpenText} />
        <PromoCard title="竞赛库" description="按 A/B/热门赛事整理背景提升机会" href="/competitions" icon={Sparkles} />
      </section>
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
    <div className="product-card rounded-[22px] p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/8 text-brand">
            <Icon className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
        </div>
        <Link href="/notices" className="text-xs font-semibold text-slate-400 hover:text-brand">
          更多
        </Link>
      </div>
      {children}
    </div>
  );
}

function NoticeListSkeleton() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="min-h-[210px] overflow-hidden rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid h-full gap-5 sm:grid-cols-[70px_minmax(0,1fr)_176px]">
            <div className="h-14 w-14 animate-pulse rounded-full bg-slate-100" />
            <div className="min-w-0">
              <div className="h-5 w-44 animate-pulse rounded-full bg-slate-100" />
              <div className="mt-4 h-6 w-full animate-pulse rounded-full bg-slate-100" />
              <div className="mt-3 h-6 w-3/4 animate-pulse rounded-full bg-slate-100" />
              <div className="mt-5 flex gap-2">
                <span className="h-7 w-16 animate-pulse rounded-full bg-slate-100" />
                <span className="h-7 w-20 animate-pulse rounded-full bg-slate-100" />
                <span className="h-7 w-14 animate-pulse rounded-full bg-slate-100" />
              </div>
            </div>
            <div className="grid content-between gap-3 sm:justify-items-end">
              <div className="h-5 w-28 animate-pulse rounded-full bg-slate-100" />
              <div className="grid w-full gap-2 sm:w-[150px]">
                <span className="h-11 animate-pulse rounded-xl bg-slate-100" />
                <span className="h-11 animate-pulse rounded-xl bg-slate-100" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SideLoadingRows() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-xl p-2">
          <div className="h-4 w-4/5 animate-pulse rounded-full bg-slate-100" />
          <div className="mt-2 h-3 w-2/3 animate-pulse rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function PromoCard({
  title,
  description,
  href,
  icon: Icon
}: {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href} className="product-card group relative overflow-hidden rounded-[22px] p-6">
      <div className="relative z-10">
        <div className="text-xl font-semibold text-ink">{title}</div>
        <p className="mt-3 text-sm leading-7 text-slate-500">{description}</p>
        <span className="mt-6 inline-flex items-center gap-2 rounded-xl border border-brand/25 bg-white px-4 py-2.5 text-sm font-semibold text-brand">
          进入{title}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
      <div className="absolute right-5 top-1/2 flex h-24 w-24 -translate-y-1/2 items-center justify-center rounded-[26px] bg-brand/8 text-brand">
        <Icon className="h-12 w-12" />
      </div>
    </Link>
  );
}
