import {
  getDeadlineLevelFromDate,
  getDeadlineTimestamp
} from './deadline-display';
import {
  getDisplayDiscipline,
  getDisplayNoticeDepartment,
  getDisplayProjectType,
  getDisplaySchoolName,
  getDisplayTags,
  normalizeNoticeTitle
} from './notice-display';
import {
  getNoticeRegion,
  matchesNoticeKind,
  matchesNoticeType
} from './notice-analytics';
import {
  inferDisciplineCategory,
  inferSchoolRange,
  matchesSchoolRange,
  type SchoolRangeFilter
} from './notice-taxonomy';
import type { PublicNoticeProject } from './mock-data';

export const noticeSortOptions = ['deadline', 'publish', 'updated', 'school'] as const;
export const noticeProgressOptions = ['全部', '报名中', '未开始', '已结束'] as const;
export const noticeRangeOptions = ['全部', '985', '211', '双一流', '其他'] as const;
export const noticeDeadlineOptions = ['全部', 'today', 'within3days', 'within7days'] as const;
export const noticeFreshOptions = ['全部', 'today'] as const;

export type NoticeSortOption = (typeof noticeSortOptions)[number];
export type NoticeProgressFilter = (typeof noticeProgressOptions)[number];
export type NoticeRangeFilter = (typeof noticeRangeOptions)[number];
export type NoticeDeadlineFilter = (typeof noticeDeadlineOptions)[number];
export type NoticeFreshFilter = (typeof noticeFreshOptions)[number];

export type NoticeSearchFilters = {
  keyword: string;
  schoolName: string;
  region: string;
  majorKeyword: string;
  category: string;
  discipline: string;
  schoolRange: NoticeRangeFilter;
  progress: NoticeProgressFilter;
  deadlineQuick: NoticeDeadlineFilter;
  fresh: NoticeFreshFilter;
  publishDate: string;
  projectType: string;
  noticeKind: string;
  year: string;
  sortBy: NoticeSortOption;
};

type NoticeCardFields = Pick<PublicNoticeProject, 'projectType' | 'schoolName' | 'tags'>;

type SortableNotice = Pick<
  PublicNoticeProject,
  'deadlineDate' | 'schoolName' | 'updatedAt' | 'collectedAt' | 'publishDate'
>;

export function getBeijingDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || '';

  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function matchesNoticeProgress(filter: NoticeProgressFilter, project: PublicNoticeProject) {
  const deadlineLevel = getDeadlineLevelFromDate(project.deadlineDate);
  if (filter === '全部') return true;
  if (filter === '报名中') {
    return (
      deadlineLevel !== 'expired' &&
      (project.status === '报名中' || project.status === '即将截止')
    );
  }
  if (filter === '未开始') return project.status === '未开始';
  return (
    deadlineLevel === 'expired' ||
    project.status === '已截止' ||
    project.status === '已结束' ||
    project.status === '活动中'
  );
}

export function sortNotices<T extends SortableNotice>(rows: T[], sortBy: NoticeSortOption) {
  return [...rows].sort((left, right) => {
    if (sortBy === 'deadline') {
      const leftExpired = getDeadlineLevelFromDate(left.deadlineDate) === 'expired' ? 1 : 0;
      const rightExpired = getDeadlineLevelFromDate(right.deadlineDate) === 'expired' ? 1 : 0;

      if (leftExpired !== rightExpired) {
        return leftExpired - rightExpired;
      }

      return getDeadlineTimestamp(left.deadlineDate) - getDeadlineTimestamp(right.deadlineDate);
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

export function getNoticeCardTags(project: NoticeCardFields) {
  const seen = new Set<string>();
  const tags = [
    getDisplayProjectType(project.projectType),
    inferSchoolRange(project),
    ...getDisplayTags(project.tags)
  ]
    .map((item) => item.trim())
    .filter(
      (item) =>
        item &&
        item !== '其他' &&
        item !== '待分类' &&
        item !== '方向待分类' &&
        item.length <= 8 &&
        !/[，,、；;]/.test(item)
    )
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });

  return tags.slice(0, 3);
}

export function getNoticeCityTag(project: Pick<PublicNoticeProject, 'tags'>) {
  const cityTags = new Set([
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

  return (project.tags || []).map((tag) => tag.trim()).find((tag) => cityTags.has(tag));
}

export function filterAndSortNotices(
  notices: PublicNoticeProject[],
  filters: NoticeSearchFilters,
  now = new Date()
) {
  const noticeKeyword = filters.keyword.trim().toLowerCase();
  const schoolKeyword = filters.schoolName.trim().toLowerCase();
  const majorText = filters.majorKeyword.trim().toLowerCase();
  const todayInBeijing = getBeijingDateString(now);

  const rows = notices.filter((item) => {
    const displaySchool = getDisplaySchoolName(item.schoolName);
    const displayDepartment = getDisplayNoticeDepartment(item);
    const displayTitle = normalizeNoticeTitle(item.projectName, 160);
    const primaryKeywordText = [displaySchool, displayDepartment, displayTitle]
      .join(' ')
      .toLowerCase();
    const secondaryKeywordText = [
      getDisplayDiscipline(item.discipline),
      getNoticeCardTags(item).join(' ')
    ]
      .join(' ')
      .toLowerCase();
    const canUseBroadKeyword = noticeKeyword.length >= 4 || /[a-z0-9]/i.test(noticeKeyword);
    const matchesType = matchesNoticeType(item, filters.projectType);
    const matchesKind = matchesNoticeKind(item, filters.noticeKind);
    const matchesRange = matchesSchoolRange(
      item,
      filters.schoolRange as SchoolRangeFilter
    );
    const matchesRegion =
      filters.region === '全部' ||
      getNoticeRegion(item) === filters.region ||
      (item.tags || []).includes(filters.region);
    const matchesSchool =
      filters.schoolName === '全部' ||
      !schoolKeyword ||
      [displaySchool, displayDepartment].join(' ').toLowerCase().includes(schoolKeyword);
    const matchesCategory =
      filters.category === '全部' ||
      inferDisciplineCategory(item.discipline) === filters.category;
    const matchesDiscipline =
      filters.discipline === '全部' ||
      getDisplayDiscipline(item.discipline) === filters.discipline;
    const matchesMajor =
      !majorText ||
      [
        getDisplayDiscipline(item.discipline),
        displayDepartment,
        displayTitle,
        getNoticeCardTags(item).join(' ')
      ]
        .join(' ')
        .toLowerCase()
        .includes(majorText);
    const matchesProgressState = matchesNoticeProgress(filters.progress, item);
    const deadlineLevel = getDeadlineLevelFromDate(item.deadlineDate);
    const matchesDeadlineQuick =
      filters.deadlineQuick === '全部' ||
      (filters.deadlineQuick === 'today' && deadlineLevel === 'today') ||
      (filters.deadlineQuick === 'within3days' &&
        ['today', 'within3days'].includes(deadlineLevel)) ||
      (filters.deadlineQuick === 'within7days' &&
        ['today', 'within3days', 'within7days'].includes(deadlineLevel));
    const matchesFresh =
      filters.fresh === '全部' || item.publishDate === todayInBeijing;
    const matchesPublishDate =
      !filters.publishDate || item.publishDate === filters.publishDate;
    const matchesYear =
      filters.year === '全部' || String(item.year) === filters.year;
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

  return sortNotices(rows, filters.sortBy);
}
