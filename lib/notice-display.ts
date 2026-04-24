import type { PublicNoticeProject } from './mock-data';

const DATE_FIELD_PATTERN =
  /\s*(报名通知发布时间|通知发布时间|发布时间|报名开始时间|申请开始时间|报名截止时间|申请截止时间|活动开始时间|活动结束时间|开始时间|截止时间)[:：]\s*\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(\s+\d{1,2}:\d{2}(:\d{2})?)?/gi;

const INTERNAL_SOURCE_LABELS = new Map([
  ['calendar_notices', '院校公开通知自动同步'],
  ['project_notices', '院校公开通知自动同步'],
  ['calendar_multi_source_v12', '院校公开通知自动同步'],
  ['cloudbase-sync', '院校公开通知自动同步'],
  ['cloudbase-sync-fallback', '院校公开通知自动同步']
]);

function compactText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function isWeakNoticeValue(value: string | undefined | null) {
  const text = compactText(String(value || ''));
  return !text || text === '???' || text === '-' || text === '待补充' || text.toLowerCase() === 'unknown';
}

export function getDisplaySchoolName(value: string | undefined | null) {
  const text = compactText(String(value || ''));
  return isWeakNoticeValue(text) || text === '其他' ? '待识别院校' : text;
}

export function getDisplayDepartmentName(value: string | undefined | null) {
  const text = compactText(String(value || ''));
  return isWeakNoticeValue(text) ? '学院信息待补充' : text;
}

export function getDisplayDiscipline(value: string | undefined | null) {
  const text = compactText(String(value || ''));
  return isWeakNoticeValue(text) ? '方向待分类' : text;
}

export function getDisplayProjectType(value: string | undefined | null) {
  const text = compactText(String(value || ''));
  return isWeakNoticeValue(text) ? '待分类' : text;
}

export function getDisplayTags(tags: string[] | undefined | null) {
  const normalized = (tags || [])
    .map((item) => compactText(item))
    .filter((item) => item && item !== '???' && !/^calendar_|^project_notices|^cloudbase/.test(item));

  return normalized.length ? normalized : ['待分类'];
}

export function normalizeNoticeTitle(projectName: string, limit = 72) {
  const compact = compactText(
    String(projectName || '')
      .replace(DATE_FIELD_PATTERN, '')
      .replace(/\s*(春令营|夏令营)?报名\s*(由请|申请)?开始时间[:：]?.*$/i, '')
  );

  const cleaned = compact || '通知标题待补充';
  return cleaned.length > limit ? `${cleaned.slice(0, limit)}...` : cleaned;
}

export function formatNoticeDate(value: string | undefined | null, fallback = '待补充') {
  const text = compactText(String(value || ''));
  if (!text) {
    return fallback;
  }

  return text.replace(/:00$/, '').replace(/\s00:00$/, '');
}

export function formatNoticeDateOnly(value: string | undefined | null, fallback = '待补充') {
  const text = compactText(String(value || ''));
  return text ? text.slice(0, 10) : fallback;
}

export function getDisplaySourceLabel(value: string | undefined | null) {
  const text = compactText(String(value || ''));
  if (!text) {
    return '院校公开通知自动同步';
  }

  return INTERNAL_SOURCE_LABELS.get(text) || text;
}

export function getVerificationLabel(project: Pick<PublicNoticeProject, 'isVerified' | 'lastCheckedAt'>) {
  if (project.isVerified) {
    return '已人工复核';
  }

  return project.lastCheckedAt ? '已自动同步，待人工抽检' : '待同步核验';
}

export function buildNoticeFeedbackHref(project: Pick<PublicNoticeProject, 'id' | 'schoolName' | 'projectName'>) {
  const subject = encodeURIComponent(`Seekoffer 通知纠错：${getDisplaySchoolName(project.schoolName)}`);
  const body = encodeURIComponent(
    [
      `通知编号：${project.id}`,
      `通知标题：${normalizeNoticeTitle(project.projectName, 120)}`,
      '',
      '我发现的问题：',
      ''
    ].join('\n')
  );

  return `mailto:feedback@seekoffer.com.cn?subject=${subject}&body=${body}`;
}
