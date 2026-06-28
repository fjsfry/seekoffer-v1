import { getDeadlineLevelFromDate, getDeadlineTimestamp } from '@/lib/deadline-display';
import {
  getDisplayNoticeDepartment,
  getDisplayProjectType,
  getDisplaySchoolName,
  normalizeNoticeTitle
} from '@/lib/notice-display';
import type { PublicNoticeProject } from '@/lib/mock-data';

export const noticeTypeFilters = ['全部', '夏令营', '预推免', '宣讲会', '入营名单', '推免'] as const;
export type NoticeTypeFilter = (typeof noticeTypeFilters)[number];

const regionTags = [
  '北京',
  '上海',
  '天津',
  '重庆',
  '河北',
  '山西',
  '辽宁',
  '吉林',
  '黑龙江',
  '江苏',
  '浙江',
  '安徽',
  '福建',
  '江西',
  '山东',
  '河南',
  '湖北',
  '湖南',
  '广东',
  '广西',
  '海南',
  '四川',
  '贵州',
  '云南',
  '陕西',
  '甘肃',
  '青海',
  '宁夏',
  '新疆',
  '内蒙古',
  '西藏',
  '香港',
  '澳门',
  '台湾',
  '南京',
  '武汉',
  '广州',
  '深圳',
  '杭州',
  '成都',
  '西安',
  '合肥',
  '苏州',
  '厦门',
  '青岛',
  '哈尔滨'
] as const;

const regionSet = new Set<string>(regionTags);

function compactText(value: string | undefined | null) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function getNoticeSearchText(project: PublicNoticeProject) {
  return [
    getDisplayProjectType(project.projectType),
    getDisplaySchoolName(project.schoolName),
    getDisplayNoticeDepartment(project),
    normalizeNoticeTitle(project.projectName, 160),
    compactText(project.requirements),
    ...(project.tags || [])
  ].join(' ');
}

export function getNoticeTypeBucket(project: PublicNoticeProject): Exclude<NoticeTypeFilter, '全部'> {
  const text = getNoticeSearchText(project);
  const projectType = getDisplayProjectType(project.projectType);

  if (/(入营名单|入选名单|营员名单|参营名单|拟入营|入营结果|夏令营名单|优秀营员)/.test(text)) {
    return '入营名单';
  }

  if (/(宣讲会|说明会|咨询会|开放日|线上交流|招生宣讲|项目宣讲)/.test(text)) {
    return '宣讲会';
  }

  if (projectType.includes('夏令营') || /夏令营|暑期学校|暑期项目/.test(text)) {
    return '夏令营';
  }

  if (projectType.includes('预推免') || /预推免|预报名|预接收/.test(text)) {
    return '预推免';
  }

  return '推免';
}

export function matchesNoticeType(project: PublicNoticeProject, filter: NoticeTypeFilter | string) {
  if (!filter || filter === '全部') {
    return true;
  }

  return getNoticeTypeBucket(project) === filter;
}

export function isActiveNotice(project: PublicNoticeProject) {
  const deadlineLevel = getDeadlineLevelFromDate(project.deadlineDate);
  return deadlineLevel !== 'expired' && project.status !== '已截止' && project.status !== '已结束';
}

export function isNearDeadlineNotice(project: PublicNoticeProject) {
  return ['today', 'within3days', 'within7days'].includes(getDeadlineLevelFromDate(project.deadlineDate));
}

export function getNoticeRegion(project: PublicNoticeProject) {
  return (project.tags || []).find((tag) => regionSet.has(tag)) || '';
}

export function getNoticeRegionOptions(projects: PublicNoticeProject[]) {
  const seen = new Set<string>();
  const values: string[] = [];

  projects.forEach((project) => {
    const region = getNoticeRegion(project);
    if (region && !seen.has(region)) {
      seen.add(region);
      values.push(region);
    }
  });

  return values.sort((left, right) => {
    const leftIndex = regionTags.indexOf(left as (typeof regionTags)[number]);
    const rightIndex = regionTags.indexOf(right as (typeof regionTags)[number]);
    return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
  });
}

export type CollegeNoticeStats = {
  schoolName: string;
  total: number;
  active: number;
  summer: number;
  pre: number;
  push: number;
  nearDeadline: number;
  latestPublishDate: string;
};

export function getEmptyCollegeNoticeStats(schoolName: string): CollegeNoticeStats {
  return {
    schoolName,
    total: 0,
    active: 0,
    summer: 0,
    pre: 0,
    push: 0,
    nearDeadline: 0,
    latestPublishDate: ''
  };
}

export function buildCollegeNoticeStats(projects: PublicNoticeProject[], schoolName: string): CollegeNoticeStats {
  const stats = getEmptyCollegeNoticeStats(schoolName);

  projects.forEach((project) => {
    const displaySchool = getDisplaySchoolName(project.schoolName);
    if (displaySchool !== schoolName) {
      return;
    }

    const bucket = getNoticeTypeBucket(project);
    stats.total += 1;
    if (isActiveNotice(project)) stats.active += 1;
    if (bucket === '夏令营') stats.summer += 1;
    if (bucket === '预推免') stats.pre += 1;
    if (bucket === '推免') stats.push += 1;
    if (isNearDeadlineNotice(project)) stats.nearDeadline += 1;
    if (project.publishDate > stats.latestPublishDate) stats.latestPublishDate = project.publishDate;
  });

  return stats;
}

export function getTopCollegeNoticeStats(projects: PublicNoticeProject[], limit = 6) {
  const statsBySchool = new Map<string, CollegeNoticeStats>();

  projects.forEach((project) => {
    const schoolName = getDisplaySchoolName(project.schoolName);
    if (!schoolName || schoolName === '待识别院校') {
      return;
    }

    if (!statsBySchool.has(schoolName)) {
      statsBySchool.set(schoolName, getEmptyCollegeNoticeStats(schoolName));
    }

    const stats = statsBySchool.get(schoolName);
    if (!stats) return;

    const bucket = getNoticeTypeBucket(project);
    stats.total += 1;
    if (isActiveNotice(project)) stats.active += 1;
    if (bucket === '夏令营') stats.summer += 1;
    if (bucket === '预推免') stats.pre += 1;
    if (bucket === '推免') stats.push += 1;
    if (isNearDeadlineNotice(project)) stats.nearDeadline += 1;
    if (project.publishDate > stats.latestPublishDate) stats.latestPublishDate = project.publishDate;
  });

  return Array.from(statsBySchool.values())
    .sort(
      (left, right) =>
        right.active - left.active ||
        right.total - left.total ||
        getDeadlineTimestamp(right.latestPublishDate) - getDeadlineTimestamp(left.latestPublishDate) ||
        left.schoolName.localeCompare(right.schoolName, 'zh-CN')
    )
    .slice(0, limit);
}
