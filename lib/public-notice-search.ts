import { getDeadlineLevelFromDate } from './deadline-display';
import {
  getDisplayDiscipline,
  getDisplaySchoolName
} from './notice-display';
import {
  getNoticeRegion,
  getNoticeRegionOptions,
  getTopCollegeNoticeStats,
  type CollegeNoticeStats
} from './notice-analytics';
import {
  filterAndSortNotices,
  getBeijingDateString,
  sortNotices,
  type NoticeSearchFilters
} from './notice-query';
import { toNoticeListItem, type NoticeListItem } from './notice-record';
import { inferDisciplineCategory } from './notice-taxonomy';
import type { PublicNoticeProject } from './mock-data';

export type PublicNoticeDataSource = 'supabase' | 'bundled';

export type PublicNoticeSearchResponse = {
  items: NoticeListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  stats: {
    total2026: number;
    todayUpdates: number;
    deadlineWithin3Days: number;
  };
  sideData: {
    urgentProjects: NoticeListItem[];
    latestProjects: NoticeListItem[];
    todaySchoolUpdates: {
      date: string;
      hasTodayRows: boolean;
      rows: Array<[string, number]>;
    };
    latestPublishDate: string;
    topColleges: CollegeNoticeStats[];
  };
  facets: {
    regions: string[];
    schools: string[];
    categories: string[];
    disciplines: string[];
    collegeStats: CollegeNoticeStats[];
  };
  source: PublicNoticeDataSource;
  servedAt: string;
};

type BuildSearchResultOptions = {
  page: number;
  pageSize: number;
  source: PublicNoticeDataSource;
  now?: Date;
};

export function clampNoticePageSize(value: number) {
  if (!Number.isFinite(value)) return 16;
  return Math.min(Math.max(Math.floor(value), 1), 40);
}

export function clampNoticePage(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(Math.floor(value), 1);
}

function getLatestPublishDate(notices: PublicNoticeProject[]) {
  return notices.reduce(
    (latest, item) => (item.publishDate > latest ? item.publishDate : latest),
    ''
  );
}

function getTodaySchoolUpdates(
  notices: PublicNoticeProject[],
  today: string,
  latestPublishDate: string
) {
  const todayRows = notices.filter((item) => item.publishDate === today);
  const fallbackRows = latestPublishDate
    ? notices.filter((item) => item.publishDate === latestPublishDate)
    : [];
  const rows = todayRows.length ? todayRows : fallbackRows;
  const counts = new Map<string, number>();

  rows.forEach((item) => {
    const school = getDisplaySchoolName(item.schoolName);
    counts.set(school, (counts.get(school) || 0) + 1);
  });

  return {
    date: todayRows.length ? today : latestPublishDate,
    hasTodayRows: todayRows.length > 0,
    rows: Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5) as Array<[string, number]>
  };
}

export function buildPublicNoticeSearchResult(
  catalog: PublicNoticeProject[],
  filters: NoticeSearchFilters,
  options: BuildSearchResultOptions
): PublicNoticeSearchResponse {
  const now = options.now || new Date();
  const pageSize = clampNoticePageSize(options.pageSize);
  const requestedPage = clampNoticePage(options.page);
  const filtered = filterAndSortNotices(catalog, filters, now);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * pageSize;
  const today = getBeijingDateString(now);
  const latestPublishDate = getLatestPublishDate(catalog);
  const activeCatalog = catalog.filter(
    (item) => getDeadlineLevelFromDate(item.deadlineDate, now.getTime()) !== 'expired'
  );
  const urgentProjects = sortNotices(
    activeCatalog.filter((item) =>
      ['today', 'within3days', 'within7days'].includes(
        getDeadlineLevelFromDate(item.deadlineDate, now.getTime())
      )
    ),
    'deadline'
  ).slice(0, 5);
  const latestProjects = sortNotices(activeCatalog, 'publish').slice(0, 5);
  const categories = Array.from(
    new Set(catalog.map((item) => inferDisciplineCategory(item.discipline)))
  );
  const disciplineRows =
    filters.category === '全部'
      ? catalog
      : catalog.filter(
          (item) => inferDisciplineCategory(item.discipline) === filters.category
        );
  const disciplines = Array.from(
    new Set(
      disciplineRows
        .map((item) => getDisplayDiscipline(item.discipline))
        .filter(Boolean)
    )
  );
  const schoolRows =
    filters.region === '全部'
      ? catalog
      : catalog.filter(
          (item) =>
            getNoticeRegion(item) === filters.region ||
            (item.tags || []).includes(filters.region)
        );
  const schools = Array.from(
    new Set(
      schoolRows
        .map((item) => getDisplaySchoolName(item.schoolName))
        .filter((item) => item && item !== '待识别院校')
    )
  ).sort((left, right) => left.localeCompare(right, 'zh-CN'));
  const collegeStats = getTopCollegeNoticeStats(catalog, Number.MAX_SAFE_INTEGER);

  return {
    items: filtered.slice(start, start + pageSize).map(toNoticeListItem),
    pagination: {
      page,
      pageSize,
      total,
      totalPages
    },
    stats: {
      total2026: catalog.filter((item) => Number(item.year) === 2026).length,
      todayUpdates: catalog.filter((item) => item.publishDate === today).length,
      deadlineWithin3Days: catalog.filter((item) => {
        const level = getDeadlineLevelFromDate(item.deadlineDate, now.getTime());
        return level === 'today' || level === 'within3days';
      }).length
    },
    sideData: {
      urgentProjects: urgentProjects.map(toNoticeListItem),
      latestProjects: latestProjects.map(toNoticeListItem),
      todaySchoolUpdates: getTodaySchoolUpdates(catalog, today, latestPublishDate),
      latestPublishDate,
      topColleges: collegeStats.slice(0, 6)
    },
    facets: {
      regions: getNoticeRegionOptions(catalog),
      schools,
      categories,
      disciplines,
      collegeStats
    },
    source: options.source,
    servedAt: now.toISOString()
  };
}
