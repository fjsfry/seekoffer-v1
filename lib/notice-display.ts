import type { PublicNoticeProject } from './mock-data';

const DATE_FIELD_PATTERN =
  /\s*(报名通知发布时间|通知发布时间|发布时间|报名开始时间|申请开始时间|报名截止时间|申请截止时间|活动开始时间|活动结束时间|开始时间|截止时间)[:：]\s*\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(\s+\d{1,2}:\d{2}(:\d{2})?)?/gi;

const TITLE_TRAILING_PATTERN =
  /\s*(报名中|即将截止|已截止|未开始|活动中|已结束|剩余\s*\d+\s*天|距离(报名)?截止\s*\d+\s*天).*$/i;

const TITLE_BODY_BOUNDARY_PATTERN =
  /\s+(?:发布于|浏览|阅读|来源|原文链接|报名链接|申请链接|申请材料|材料要求|联系方式|联系人|咨询电话|电子邮箱|附件|招生对象|申请条件|报名方式|一、|一\.|1\.|1、)\s*.*$/i;

const TITLE_PREFIX_PATTERN =
  /^(?:招生通知|通知公告|通知|项目通知|院校通知|保研通知|推免通知|官方通知)\s*[|｜:：-]\s*/i;

const TITLE_SOURCE_PREFIX_PATTERN = /^【[^】]{2,16}】\s*/;

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

function isNoisyTag(value: string) {
  const lower = value.toLowerCase();
  return /https?:|www\.|\.(com|cn|edu|org)|(^|\s)com($|\s)/i.test(lower) || value.length > 16;
}

export function isWeakNoticeValue(value: string | undefined | null) {
  const text = compactText(String(value || ''));
  return !text || text === '???' || text === '-' || text === '待补充' || text === '待识别院校' || text.toLowerCase() === 'unknown';
}

export function getDisplaySchoolName(value: string | undefined | null) {
  const text = compactText(String(value || ''));
  return isWeakNoticeValue(text) || text === '其他' || /^20\d{2}年大学$/.test(text) ? '待识别院校' : text;
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
    .filter(
      (item) => item && item !== '???' && !/^calendar_|^project_notices|^cloudbase/.test(item) && !isNoisyTag(item)
    );

  return normalized.length ? normalized : ['待分类'];
}

export function normalizeNoticeTitle(projectName: string, limit = 72) {
  const compact = compactText(
    String(projectName || '')
      .split(/\r?\n/)[0]
      .replace(TITLE_SOURCE_PREFIX_PATTERN, '')
      .replace(TITLE_PREFIX_PATTERN, '')
      .replace(DATE_FIELD_PATTERN, '')
      .replace(TITLE_BODY_BOUNDARY_PATTERN, '')
      .replace(TITLE_TRAILING_PATTERN, '')
      .replace(/\s*(报名中|即将截止|已截止|未开始|活动中|已结束)\s*(其他|夏令营|预推免|正式推免|春令营报名|夏令营报名)?\s*(由请|申请|报名)?开始时间(?:[:：]|在|为)?.*$/i, '')
      .replace(/\s*[^，。；;|｜]{0,16}报名截止时间(?:[:：]|在|为)?.*$/i, '')
      .replace(/\s*距离(报名)?截止\s*\d+\s*天.*$/i, '')
      .replace(/\s*(春令营|夏令营)?报名\s*(由请|申请)?开始时间(?:[:：]|在|为)?.*$/i, '')
      .replace(/\s*[|｜]\s*(春令营|夏令营|预推免|九推|正式推免)?\s*(报名|申请)?\s*(由请|申请|报名)?开始时间.*$/i, '')
      .replace(/简介(?=.{18,}).*$/i, '简介')
      .replace(/[。；;！!](?=.{12,}).*$/i, (matched) => matched.slice(0, 1))
      .replace(/\s{2,}/g, ' ')
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

  return project.lastCheckedAt ? '自动同步，官网来源' : '待同步核验';
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

  return `mailto:seekoffer@qq.com?subject=${subject}&body=${body}`;
}
