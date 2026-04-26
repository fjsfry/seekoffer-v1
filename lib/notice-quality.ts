import type { PublicNoticeProject } from './mock-data';

export type NoticeQualityTier = 'clean' | 'p0' | 'p1' | 'p2';

const dirtyTextPatterns = [
  /seekoffer\s*test/i,
  /\btest\b/i,
  /测试|測試/,
  /\?{3,}/,
  /�{2,}/,
  /锟斤拷|锟�/
];

const competitionPatterns = [
  /蓝桥杯/,
  /挑战杯/,
  /互联网\+/,
  /数学建模/,
  /程序设计竞赛/,
  /软件和信息技术大赛/,
  /大学生.*竞赛/,
  /创新创业大赛/,
  /\bACM\b/i,
  /\bICPC\b/i
];

const baoyanIntentPatterns = [
  /推免/,
  /保研/,
  /夏令营/,
  /预推免/,
  /免试研究生/,
  /优秀大学生/,
  /研究生招生/,
  /接收.*推荐免试/
];

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

function hasBaoyanIntent(project: PublicNoticeProject) {
  const text = buildNoticeText(project);
  return baoyanIntentPatterns.some((pattern) => pattern.test(text));
}

export function getNoticeQualityTier(project: PublicNoticeProject): NoticeQualityTier {
  if (hasDirtyText(project) || !hasValidDeadline(project)) {
    return 'p0';
  }

  if (isCompetitionOrContest(project) && !hasBaoyanIntent(project)) {
    return 'p1';
  }

  if (!compactText(project.schoolName) || !compactText(project.departmentName) || !compactText(project.sourceLink)) {
    return 'p2';
  }

  return 'clean';
}

export function shouldShowInMainNoticeFlow(project: PublicNoticeProject) {
  return getNoticeQualityTier(project) !== 'p0' && getNoticeQualityTier(project) !== 'p1';
}

export function filterMainNoticeProjects(projects: PublicNoticeProject[]) {
  return projects.filter(shouldShowInMainNoticeFlow);
}
