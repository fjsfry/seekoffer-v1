import type { PublicNoticeProject } from './mock-data';
import { getDisplayNoticeDepartment } from './notice-display';

export type NoticeQualityTier = 'clean' | 'p0' | 'p1' | 'p2';

const dirtyTextPatterns = [
  /seekoffer\s*test/i,
  /\bdemo\b/i,
  /\btest\b/i,
  /测试|測試|测试数据|占位数据|示例数据/,
  /\?{3,}/,
  /�{2,}/,
  /锟斤拷|锟�/,
  /undefined|null/i
];

const competitionPatterns = [
  /榜单赛事/,
  /蓝桥杯/,
  /挑战杯/,
  /互联网\+/,
  /数学建模/,
  /程序设计竞赛/,
  /软件和信息技术大赛/,
  /高校计算机大赛/,
  /跨文化能力竞赛/,
  /竞赛章程/,
  /大学生.*竞赛/,
  /创新创业大赛/,
  /(?:挑战杯|蓝桥杯|数学建模|程序设计|创新创业|技能|设计|软件和信息技术|互联网\+|计算机).*大赛/,
  /大赛.*(?:章程|报名|参赛|获奖|竞赛)/,
  /\bACM\b/i,
  /\bICPC\b/i
];

const bodyLikeTitlePatterns = [/^通\s*知我院/, /复试工作还在进行中/, /请各位同学及时/, /详见附件/, /具体安排如下/];

function compactText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildNoticeText(project: PublicNoticeProject) {
  return [
    project.id,
    project.schoolName,
    project.departmentName,
    project.projectName,
    project.projectType,
    project.discipline,
    project.status,
    project.sourceSite,
    project.tags.join(' '),
    project.requirements,
    project.remarks
  ]
    .map(compactText)
    .join(' ');
}

function hasDirtyText(project: PublicNoticeProject) {
  const text = buildNoticeText(project);
  return dirtyTextPatterns.some((pattern) => pattern.test(text));
}

function hasValidDeadline(project: PublicNoticeProject) {
  const value = compactText(project.deadlineDate);
  if (!value) {
    return false;
  }

  const dateTimeText = value.includes('T')
    ? value
    : value.includes(' ')
      ? value.replace(' ', 'T')
      : `${value}T23:59`;
  const withSeconds = /\d{2}:\d{2}:\d{2}$/.test(dateTimeText) ? dateTimeText : `${dateTimeText}:00`;
  const timestamp = new Date(`${withSeconds}+08:00`).getTime();
  if (Number.isNaN(timestamp)) {
    return false;
  }

  const year = new Date(timestamp).getFullYear();
  return year >= 2025 && year <= 2028;
}

function isCompetitionOrContest(project: PublicNoticeProject) {
  const text = buildNoticeText(project);
  return competitionPatterns.some((pattern) => pattern.test(text));
}

function hasBodyLikeTitle(project: PublicNoticeProject) {
  const title = compactText(project.projectName);
  return bodyLikeTitlePatterns.some((pattern) => pattern.test(title));
}

function hasBrokenPublicIdentity(project: PublicNoticeProject) {
  const schoolName = compactText(project.schoolName);
  const title = compactText(project.projectName);

  return (
    !schoolName ||
    !title ||
    schoolName === '其他' ||
    schoolName === '待补充' ||
    schoolName === '待补充院校' ||
    schoolName === '待识别学校' ||
    schoolName === '待识别院校' ||
    schoolName === '中国大学' ||
    /^20\d{2}年大学$/.test(schoolName) ||
    /^【.*】/.test(schoolName) ||
    title.length < 6
  );
}

function hasBrokenDepartmentIdentity(project: PublicNoticeProject) {
  const departmentName = compactText(getDisplayNoticeDepartment(project));
  return !departmentName || departmentName === '学院信息待补充' || /待识别|待补充/.test(departmentName);
}

export function getNoticeQualityTier(project: PublicNoticeProject): NoticeQualityTier {
  if (
    hasDirtyText(project) ||
    hasBodyLikeTitle(project) ||
    hasBrokenPublicIdentity(project) ||
    hasBrokenDepartmentIdentity(project)
  ) {
    return 'p0';
  }

  if (isCompetitionOrContest(project)) {
    return 'p1';
  }

  if (!hasValidDeadline(project) || !compactText(project.sourceLink)) {
    return 'p2';
  }

  return 'clean';
}

export function shouldShowInMainNoticeFlow(project: PublicNoticeProject) {
  const tier = getNoticeQualityTier(project);
  if (tier === 'p0' || tier === 'p1') {
    return false;
  }

  return Boolean(compactText(project.sourceLink));
}

export function filterMainNoticeProjects(projects: PublicNoticeProject[]) {
  return projects.filter(shouldShowInMainNoticeFlow);
}
