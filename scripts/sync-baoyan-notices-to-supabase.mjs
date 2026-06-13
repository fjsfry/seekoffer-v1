import http from 'node:http';
import https from 'node:https';

const PRIMARY_API_BASE_URL = process.env.API_BASE_URL || 'https://ajqwsiasyqyi.sealosgzg.site';
const SECONDARY_API_BASE_URL = process.env.BAOYANWANG_API_BASE_URL || 'http://api.baoyanwang.com.cn/api/v1';
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || '';
const SUPABASE_INGEST_URL =
  process.env.SUPABASE_INGEST_URL ||
  (SUPABASE_PROJECT_REF ? `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/ingest-notices` : '');
const SUPABASE_INGEST_SECRET = process.env.SUPABASE_INGEST_SECRET || process.env.SEEKOFFER_INGEST_SECRET || '';
const SUPABASE_INGEST_SOURCE = process.env.SUPABASE_INGEST_SOURCE || 'github-actions-sync';
const TARGET_YEAR = Number(process.env.TARGET_YEAR || '2026');
const SYNC_MODE = normalizeSyncMode(process.env.SYNC_MODE || 'full');
const IS_INCREMENTAL_SYNC = SYNC_MODE === 'incremental';

const PRIMARY_WEB_DETAIL_URL = 'https://www.baoyantongzhi.com/notice/detail/{id}';
const PRIMARY_LIST_ENDPOINT = '/backgd/notice/show/list';
const PRIMARY_DETAIL_ENDPOINT = '/backgd/notice/show/{id}';
const SECONDARY_LIST_ENDPOINT = '/articles';
const SECONDARY_DETAIL_ENDPOINT = '/articles/{id}';

const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 30000);
const MAX_RATE_LIMIT_RETRY_AFTER_SECONDS = Number(process.env.MAX_RATE_LIMIT_RETRY_AFTER_SECONDS || 30);
const PRIMARY_PAGE_SIZE = Number(process.env.PRIMARY_PAGE_SIZE || 40);
const DEFAULT_INCREMENTAL_PRIMARY_MAX_PAGES = 2;
const DEFAULT_INCREMENTAL_PRIMARY_MAX_DETAILS = 40;
const DEFAULT_INCREMENTAL_SECONDARY_MAX_PAGES = 3;
const DEFAULT_FULL_SECONDARY_MAX_PAGES = 30;
const DEFAULT_FULL_PRIMARY_MAX_DETAILS = 120;
const PRIMARY_MAX_PAGES =
  parseOptionalInteger(process.env.PRIMARY_MAX_PAGES) ||
  (IS_INCREMENTAL_SYNC ? DEFAULT_INCREMENTAL_PRIMARY_MAX_PAGES : null);
const PRIMARY_MAX_DETAILS =
  parseOptionalInteger(process.env.PRIMARY_MAX_DETAILS) ||
  (IS_INCREMENTAL_SYNC ? DEFAULT_INCREMENTAL_PRIMARY_MAX_DETAILS : DEFAULT_FULL_PRIMARY_MAX_DETAILS);
const PRIMARY_ORDER_BY = process.env.PRIMARY_ORDER_BY || 'publishTime';
const PRIMARY_DETAIL_CONCURRENCY = Math.max(1, Number(process.env.PRIMARY_DETAIL_CONCURRENCY || 3));
const PRIMARY_DETAIL_DELAY_MS = Math.max(0, Number(process.env.PRIMARY_DETAIL_DELAY_MS || 150));
const PRIMARY_MISSING_DEADLINE_MAX_DETAILS =
  parseOptionalInteger(process.env.PRIMARY_MISSING_DEADLINE_MAX_DETAILS) || (IS_INCREMENTAL_SYNC ? 20 : 120);
const SECONDARY_PAGE_SIZE = Number(process.env.SECONDARY_PAGE_SIZE || 25);
const SECONDARY_MAX_PAGES =
  parseOptionalInteger(process.env.SECONDARY_MAX_PAGES) ||
  (IS_INCREMENTAL_SYNC ? DEFAULT_INCREMENTAL_SECONDARY_MAX_PAGES : DEFAULT_FULL_SECONDARY_MAX_PAGES);
const SECONDARY_CATEGORY = process.env.SECONDARY_CATEGORY || '\u4fdd\u7814\u4fe1\u606f';
const DEFAULT_SECONDARY_REPAIR_DETAIL_IDS = IS_INCREMENTAL_SYNC ? [] : ['7308'];
const SECONDARY_REPAIR_DETAIL_IDS = unique([
  ...DEFAULT_SECONDARY_REPAIR_DETAIL_IDS,
  ...parseDelimitedList(process.env.SECONDARY_REPAIR_DETAIL_IDS)
]);
const SECONDARY_DETAIL_DELAY_MS = Math.max(0, Number(process.env.SECONDARY_DETAIL_DELAY_MS || 120));
const SECONDARY_MISSING_DEADLINE_MAX_DETAILS =
  parseOptionalInteger(process.env.SECONDARY_MISSING_DEADLINE_MAX_DETAILS) || (IS_INCREMENTAL_SYNC ? 20 : 80);
const DRY_RUN = /^1|true|yes$/i.test(process.env.DRY_RUN || '');

const TITLE_BODY_START_PATTERNS = [
  /发布时间[:：]?\s*20\d{2}/i,
  /发布日期[:：]?\s*20\d{2}/i,
  /发稿时间[:：]?\s*20\d{2}/i,
  /创建时间[:：]?\s*20\d{2}/i,
  /日期[:：]?\s*20\d{2}/i,
  /时间[:：]?\s*20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}/i,
  /20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(?:\s*\d{1,2}:\d{2}(?::\d{2})?)?/i,
  /阅读量[:：]?\s*\d+/i,
  /发布人[:：]?/i,
  /发布者[:：]?/i,
  /作者[:：]?/i,
  /来源[:：]?/i,
  /publish(?:ed)?\s*time[:：]?\s*20\d{2}/i,
  /author[:：]?/i,
  /source[:：]?/i,
  /一[、.．]\s*/,
  /各位同学[:：]?/,
  /全国高校的优秀本科学子[:：]?/,
  /为促进/,
  /为了/,
  /为增进/,
  /现定于/,
  /具体事项通知如下/,
  /申请条件/
];

const PRIMARY_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  Origin: 'https://www.baoyantongzhi.com',
  Referer: 'https://www.baoyantongzhi.com/notice'
};

const SECONDARY_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  Referer: 'http://pc.baoyanwang.com.cn/articles?category=%E4%BF%9D%E7%A0%94%E4%BF%A1%E6%81%AF'
};

const MATERIAL_KEYWORDS = [
  '简历',
  '成绩单',
  '排名证明',
  '推荐信',
  '个人陈述',
  '英语成绩',
  '获奖证明',
  '身份证',
  '学生证',
  '学籍证明',
  '论文',
  '科研成果'
];

const DIRTY_NOTICE_PATTERN =
  /seekoffer\s*test|\bdemo\b|\btest\b|测试|测试数据|占位数据|示例数据|\?{3,}|undefined|null/i;
const COMPETITION_NOTICE_PATTERN =
  /蓝桥杯|挑战杯|互联网\+|全国大学生.*竞赛|大学生软件和信息技术大赛|数学建模|程序设计竞赛|创新创业大赛|(?:技能|设计|软件和信息技术|计算机).*大赛|大赛.*(?:章程|报名|参赛|获奖|竞赛)|\bACM\b|\bICPC\b/i;

function parseOptionalInteger(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function parseDelimitedList(value) {
  return String(value || '')
    .split(/[\s,;，；]+/)
    .map(normalizeSpace)
    .filter(Boolean);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function isSourceRateLimitError(error) {
  return /^Source rate limited/.test(toErrorMessage(error));
}

function normalizeSpace(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).replace(/\s+/g, ' ').trim();
}

function isWeakSchoolName(value) {
  const text = normalizeSpace(value);
  return (
    !text ||
    text === '???' ||
    text === '-' ||
    text === '其他' ||
    text === '待补充' ||
    text === '待补充院校' ||
    text === '待识别学校' ||
    text === '待识别院校' ||
    text === '中国大学' ||
    /^20\d{2}年大学$/.test(text)
  );
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toChinaParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute
  };
}

function nowText() {
  const parts = toChinaParts();
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function nowDateText() {
  return nowText().slice(0, 10);
}

function logEvent(event, payload = {}) {
  console.log(
    JSON.stringify(
      {
        event,
        ...payload,
        at: nowText()
      },
      null,
      2
    )
  );
}

function formatDateTimeInChina(date) {
  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }

  const parts = toChinaParts(date);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function normalizeDateTime(value, fallbackTime = '23:59') {
  const text = normalizeSpace(value);
  if (!text || text === 'null') {
    return '';
  }

  const directMatch = text.match(
    /(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?:[ T]+(\d{1,2}):(\d{2})(?::\d{2})?)?/
  );

  if (directMatch) {
    const [, year, month, day, hour, minute] = directMatch;
    const [fallbackHour, fallbackMinute] = fallbackTime.split(':');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${String(hour || fallbackHour).padStart(
      2,
      '0'
    )}:${String(minute || fallbackMinute).padStart(2, '0')}`;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : formatDateTimeInChina(parsed);
}

function normalizeDate(value) {
  const text = normalizeDateTime(value, '00:00');
  return text ? text.slice(0, 10) : '';
}

function dateTimeToChinaTime(value) {
  const text = normalizeDateTime(value, '23:59');
  if (!text) {
    return Number.NaN;
  }

  return new Date(`${text.replace(' ', 'T')}:00+08:00`).getTime();
}

function inferDeadlineLevel(deadlineText) {
  const deadlineTime = dateTimeToChinaTime(deadlineText);
  if (Number.isNaN(deadlineTime)) {
    return 'future';
  }

  const diff = deadlineTime - Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  if (diff <= 0) return 'expired';
  if (diff <= oneDay) return 'today';
  if (diff <= oneDay * 3) return 'within3days';
  if (diff <= oneDay * 7) return 'within7days';
  return 'future';
}

function inferStatus(deadlineLevel) {
  if (deadlineLevel === 'expired') return '已截止';
  if (deadlineLevel === 'today' || deadlineLevel === 'within3days' || deadlineLevel === 'within7days') {
    return '即将截止';
  }
  return '报名中';
}

function shorten(text, limit = 800) {
  const normalized = normalizeSpace(text);
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 1)}…`;
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function htmlToTextLines(detailHtml) {
  if (!detailHtml) {
    return [];
  }

  const text = decodeHtmlEntities(
    String(detailHtml)
      .replace(/<script[\s\S]*?<\/script>/gi, '\n')
      .replace(/<style[\s\S]*?<\/style>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|section|tr|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );

  const seen = new Set();
  return text
    .split(/\r?\n/)
    .map(normalizeSpace)
    .filter((line) => {
      if (line.length < 2 || seen.has(line)) {
        return false;
      }

      seen.add(line);
      return true;
    });
}

function splitTags(raw) {
  if (Array.isArray(raw)) {
    return raw.map(normalizeSpace).filter(Boolean);
  }

  const text = normalizeSpace(raw);
  if (!text) {
    return [];
  }

  const jsonLike = text.replace(/'/g, '"');
  const parsed = safeJsonParse(jsonLike, null);
  if (Array.isArray(parsed)) {
    return parsed.map(normalizeSpace).filter(Boolean);
  }

  return text
    .replace(/^\[|\]$/g, '')
    .split(/[、,，/|]/)
    .map((item) => item.replace(/^['"]|['"]$/g, ''))
    .map(normalizeSpace)
    .filter(Boolean);
}

function unique(items) {
  const seen = new Set();
  const result = [];
  for (const item of items.map(normalizeSpace).filter(Boolean)) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

function inferProjectType(...values) {
  const text = values.map(normalizeSpace).join(' ');
  if (/正式推免|九推/.test(text)) return '正式推免';
  if (/预推免|推免预报名|预报名/.test(text)) return '预推免';
  if (/导师直招|直博生|直博/.test(text)) return '导师直招';
  if (/开放日|科创营|科学营|夏令营|暑期学校|交流营/.test(text)) return '夏令营';
  return '夏令营';
}

function inferDiscipline(value, title) {
  const text = normalizeSpace(`${value || ''} ${title || ''}`);
  if (!text) return '待补充';
  if (/计算机|人工智能|软件|网安|网络|电子|信息|通信|自动化|控制|机械|材料|化工|工程|建筑|土木|能源|航空|仪器|纳米|理工/.test(text)) {
    return '理工';
  }
  if (/数学|物理|化学|统计|地理|地球|天文|理学/.test(text)) return '理学';
  if (/经济|金融|管理|工商|会计|市场|商学/.test(text)) return '经管';
  if (/医学|生物|生命|药学|护理|口腔|公共卫生|健康/.test(text)) return '生命医学';
  if (/法学|政治|社会|教育|中文|历史|哲学|新闻|外语|国际关系|马克思/.test(text)) return '人文社科';
  return normalizeSpace(value) || '交叉其他';
}

function extractMaterialsFromText(text) {
  const found = MATERIAL_KEYWORDS.filter((keyword) => text.includes(keyword));
  return found.length ? unique(found) : ['以原通知材料要求为准'];
}

function extractRequirementsFromText(lines, fallbackText) {
  const candidates = lines.filter((line) => line.length >= 8 && line.length <= 260).slice(0, 8);
  if (candidates.length) {
    return shorten(candidates.join(' '), 1000);
  }
  return shorten(fallbackText, 1000) || '以原文通知要求为准';
}

function extractExamInfoFromText(text) {
  const flags = [];
  if (text.includes('笔试')) flags.push('原文提到笔试');
  if (text.includes('面试')) flags.push('原文提到面试');
  if (flags.length) {
    return `${flags.join('，')}，请以原文安排为准。`;
  }
  return '原通知未明确笔试 / 面试安排，建议以原文和后续邮件通知为准。';
}

function extractContactInfo(text, explicitContact = '') {
  const email = normalizeSpace(explicitContact) || text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0];
  const mobile = text.match(/1[3-9]\d{9}/)?.[0];
  const landline = text.match(/0\d{2,3}-?\d{7,8}/)?.[0];
  return [email, mobile, landline].filter(Boolean).join(' / ') || '以原通知中的联系方式为准';
}

function buildTags(record, text, discipline, materials) {
  const tags = [
    ...splitTags(record.level || record.universityLevel || record.college_level),
    normalizeSpace(record.province || record.location),
    discipline
  ];

  if (text.includes('笔试')) tags.push('需笔试');
  if (text.includes('面试')) tags.push('需面试');
  if (materials.length >= 5) tags.push('材料较多');
  if (text.includes('导师')) tags.push('导师联系');

  return unique(tags).slice(0, 8);
}

function truncateTitleAtBodyStart(value) {
  let title = normalizeSpace(value);

  for (const pattern of TITLE_BODY_START_PATTERNS) {
    const match = title.match(pattern);
    if (match?.index && match.index >= 8) {
      title = title.slice(0, match.index);
      break;
    }
  }

  return normalizeSpace(title);
}

function cleanTitle(value, limit = 140) {
  let title = truncateTitleAtBodyStart(
    decodeHtmlEntities(value)
      .replace(/[\u00a0\t]+/g, ' ')
      .replace(/\.pdf$/i, '')
      .replace(/^【?招生通知】?\s*/i, '')
      .replace(/^(正式启动|报名开启|重磅发布|最新发布)[｜|]\s*/i, '')
  )
    .replace(/\.pdf$/i, '')
    .replace(/^【?招生通知】?\s*/i, '')
    .trim();

  const sentenceCut = title.search(/[。；;！!](?=.{12,})/);
  if (sentenceCut >= 12) {
    title = title.slice(0, sentenceCut);
  }

  return normalizeSpace(title).slice(0, limit);
}

function isSuspiciousTitle(value) {
  const title = normalizeSpace(value);
  if (!title || title.length > 150) {
    return true;
  }

  return TITLE_BODY_START_PATTERNS.some((pattern) => pattern.test(title));
}

function extractDeadlineFromText(text) {
  const source = normalizeSpace(text);
  if (!source) {
    return '';
  }

  const labeledPatterns = [
    /(?:报名|申请|提交材料|网上报名)?截止(?:时间|日期)?[:：为至到\s]*(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(?:\s*\d{1,2}[:：]\d{2})?)/i,
    /(?:报名|申请)时间[:：]?\s*20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?.{0,12}?(?:至|到|-|—|~)\s*(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(?:\s*\d{1,2}[:：]\d{2})?)/i,
    /(?:报名|申请|提交|材料|系统|邮箱|纸质材料|电子材料).{0,24}?(?:于|在|至|到|截止至|截止到)\s*(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(?:\s*\d{1,2}[:：]\d{2})?)\s*(?:前|之前|截止)?/i,
    /(?:请于|须于|需于|应于|务必于)\s*(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(?:\s*\d{1,2}[:：]\d{2})?)\s*(?:前|之前|截止前)/i,
    /(?:截至|截止到|截止至)\s*(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(?:\s*\d{1,2}[:：]\d{2})?)/i
  ];

  for (const pattern of labeledPatterns) {
    const match = source.match(pattern);
    const deadline = normalizeDateTime(match?.[1] || '', '23:59');
    if (deadline) {
      return deadline;
    }
  }

  return '';
}

function normalizeCanonicalText(value) {
  const stopWords = [
    '2026年',
    '2026',
    '全国优秀大学生',
    '优秀大学生',
    '夏令营',
    '暑期学校',
    '开放日',
    '报名通知',
    '活动通知',
    '通知',
    '活动',
    '简章',
    '关于举办'
  ];
  let text = normalizeSpace(value).toLowerCase();

  for (const word of stopWords) {
    text = text.split(word).join('');
  }

  return text.replace(/[\s\p{P}\p{S}]/gu, '');
}

function assessNoticeQuality(notice, extraReasons = []) {
  const reasons = [...extraReasons];
  const text = [
    notice.school_name,
    notice.department_name,
    notice.project_name,
    notice.project_type,
    notice.discipline,
    notice.requirements,
    notice.tags?.join(' ')
  ]
    .map(normalizeSpace)
    .join(' ');

  if (!notice.id || !notice.school_name || !notice.project_name) {
    reasons.push('missing_required_identity');
    return { tier: 'hidden', adminStatus: 'hidden', reasons };
  }

  if (isWeakSchoolName(notice.school_name)) {
    reasons.push('weak_school_name');
  }

  if (notice.project_name.length < 6) {
    reasons.push('title_too_short');
  }

  if (isDeadlineOlderThanTargetYear(notice.deadline_date, TARGET_YEAR)) {
    reasons.push('outdated_deadline');
  }

  if (DIRTY_NOTICE_PATTERN.test(text)) {
    reasons.push('dirty_or_test_content');
  }

  if (COMPETITION_NOTICE_PATTERN.test(text)) {
    reasons.push('competition_or_contest');
  }

  if (!normalizeSpace(notice.deadline_date)) {
    reasons.push('missing_deadline');
  }

  if (isSuspiciousTitle(notice.project_name)) {
    reasons.push('suspicious_or_body_like_title');
  }

  if (!normalizeSpace(notice.source_link) && !normalizeSpace(notice.apply_link)) {
    reasons.push('missing_source_link');
  }

  const hardReasons = new Set([
    'missing_required_identity',
    'title_too_short',
    'weak_school_name',
    'outdated_deadline',
    'dirty_or_test_content',
    'competition_or_contest',
    'duplicate_notice'
  ]);
  const hasHardReason = reasons.some((reason) => hardReasons.has(reason));

  if (hasHardReason) {
    return { tier: 'hidden', adminStatus: 'hidden', reasons: unique(reasons) };
  }

  if (reasons.length) {
    return { tier: 'needs_review', adminStatus: 'pending', reasons: unique(reasons) };
  }

  return { tier: 'clean', adminStatus: 'published', reasons: [] };
}

function applyQualityGate(notice, extraReasons = []) {
  const quality = assessNoticeQuality(notice, extraReasons);
  const reviewNote = quality.reasons.length ? `auto_quality:${quality.reasons.join(',')}` : '';

  return {
    ...notice,
    admin_status: quality.adminStatus,
    admin_review_note: reviewNote,
    is_private: quality.adminStatus !== 'published',
    is_verified: quality.adminStatus === 'published',
    quality_tier: quality.tier,
    quality_reasons: quality.reasons
  };
}

function normalizeSyncMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return mode === 'incremental' || mode === 'full' ? mode : 'full';
}

function extractFirstYear(value) {
  const match = normalizeSpace(value).match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function isDeadlineOlderThanTargetYear(deadlineText, targetYear) {
  const deadlineYear = extractFirstYear(deadlineText);
  return Boolean(deadlineYear && deadlineYear < targetYear);
}

function buildPrimaryProject(record, detail = {}, targetYear = TARGET_YEAR) {
  const recordId = Number(record.id || detail.id);
  const title = cleanTitle(detail.name || record.name || record.title);
  const textLines = htmlToTextLines(detail.detailContent || detail.content || '');
  const plainText = textLines.join('\n');
  const publishDate = normalizeDate(detail.publishTime || record.publishTime) || nowDateText();
  const deadlineDate =
    normalizeDateTime(detail.endTime || record.endTime) ||
    extractDeadlineFromText(`${title} ${plainText}`) ||
    '';
  const eventStartDate = normalizeDate(detail.startTime || record.startTime);
  const eventEndDate = normalizeDate(detail.endTime || record.endTime);
  const deadlineLevel = inferDeadlineLevel(deadlineDate);
  const discipline = inferDiscipline(detail.majorType || record.majorType, title);
  const materials = extractMaterialsFromText(plainText || title);

  return {
    id: `baoyantongzhi-${recordId}`,
    source_record_id: recordId,
    school_name: normalizeSpace(detail.school || record.school) || '待识别学校',
    department_name: normalizeSpace(detail.college || record.college) || '待补充院系',
    project_name: title,
    project_type: inferProjectType(detail.recruitType || record.recruitType, title),
    discipline,
    publish_date: publishDate,
    deadline_date: deadlineDate,
    event_start_date: eventStartDate,
    event_end_date: eventEndDate,
    apply_link: normalizeSpace(detail.websiteUrl || record.websiteUrl) || PRIMARY_WEB_DETAIL_URL.replace('{id}', String(recordId)),
    source_link: PRIMARY_WEB_DETAIL_URL.replace('{id}', String(recordId)),
    requirements: extractRequirementsFromText(textLines, plainText || title),
    materials_required: materials,
    exam_interview_info: extractExamInfoFromText(plainText),
    contact_info: extractContactInfo(plainText),
    remarks: '由保研通知网自动同步，建议结合官网原文再次确认时间、材料和资格要求。',
    tags: buildTags(detail || record, plainText || title, discipline, materials),
    status: inferStatus(deadlineLevel),
    deadline_level: deadlineLevel,
    year: targetYear,
    source_site: '保研通知网',
    collected_at: nowText(),
    updated_at: nowText(),
    last_checked_at: nowText(),
    last_checked_source: '保研通知网',
    is_verified: false,
    change_log: [],
    history_records: [],
    reminder_7d_sent: false,
    reminder_3d_sent: false,
    reminder_1d_sent: false
  };
}

function extractYearSignals(record) {
  return [
    record.year,
    record.sign_up_start,
    record.sign_up_end,
    record.start_time,
    record.end_time,
    record.title,
    record.description,
    record.rule,
    record.content
  ]
    .map(normalizeSpace)
    .filter(Boolean)
    .join(' ');
}

function isSecondaryTargetRecord(record, targetYear) {
  if (Number(record.year) === targetYear) {
    return true;
  }

  return extractYearSignals(record).includes(String(targetYear));
}

function normalizeSecondaryPayload(payload) {
  if (Array.isArray(payload?.result?.content)) {
    return payload.result.content;
  }
  if (Array.isArray(payload?.data?.records)) {
    return payload.data.records;
  }
  return [];
}

function pickFirst(...values) {
  return values.map(normalizeSpace).find(Boolean) || '';
}

function parseSecondaryTitle(value) {
  const text = normalizeSpace(value);
  const match = text.match(/^【([^】]{2,60})】\s*[\u2014\u2013\-－]{1,3}\s*(.{2,80})$/);

  if (!match) {
    return { school: '', department: '' };
  }

  return {
    school: normalizeSpace(match[1]),
    department: normalizeSpace(match[2])
  };
}

function normalizeSecondaryDepartment(value) {
  const text = normalizeSpace(value);
  if (!text || text === '待补充院系') {
    return '';
  }

  if (
    text === '全校通知' ||
    /(学院|研究院|研究所|医院|临床学院|学部|系|中心|实验室|书院|基地)/.test(text)
  ) {
    return text;
  }

  return '';
}

function quillOpsToText(ops) {
  if (!Array.isArray(ops)) {
    return '';
  }

  return normalizeSpace(
    ops
      .map((op) => (typeof op?.insert === 'string' ? op.insert : ''))
      .filter(Boolean)
      .join(' ')
  );
}

function parseSecondaryContent(record) {
  const contentPayload = safeJsonParse(record.content || '{}', null);
  let coverUrl = normalizeSpace(record.cover_url);
  let summary = '';

  if (Array.isArray(contentPayload)) {
    summary = quillOpsToText(contentPayload);
  } else if (contentPayload && typeof contentPayload === 'object') {
    coverUrl = normalizeSpace(contentPayload.cover_url || coverUrl);
    summary = normalizeSpace(
      contentPayload.p ||
        contentPayload.text ||
        contentPayload.summary ||
        contentPayload.description ||
        quillOpsToText(contentPayload.ops)
    );
  }

  if (!summary && typeof record.content === 'string' && /<[^>]+>/.test(record.content)) {
    summary = htmlToTextLines(record.content).join(' ');
  }

  return {
    coverUrl,
    summary: normalizeSpace(summary || record.description || record.sub_title || record.title)
  };
}

function buildSecondaryProject(record, targetYear = TARGET_YEAR) {
  const contentMeta = parseSecondaryContent(record);
  const titleParts = parseSecondaryTitle(record.title);
  const title = cleanTitle(contentMeta.summary || record.title, 140) || cleanTitle(record.title, 100);
  const summaryText = [title, contentMeta.summary, normalizeSpace(record.description)].filter(Boolean).join(' ');
  const publishDate = normalizeDate(record.updated_time || record.updated_at || record.created_at) || nowDateText();
  const deadlineDate = normalizeDateTime(record.sign_up_end || record.end_time) || extractDeadlineFromText(summaryText);
  const eventStartDate = normalizeDate(record.start_time || record.sign_up_start);
  const eventEndDate = normalizeDate(record.end_time || record.sign_up_end);
  const deadlineLevel = inferDeadlineLevel(deadlineDate);
  const discipline = inferDiscipline(pickFirst(record.major, record.academy_major, record.subject), title);
  const materials = extractMaterialsFromText(summaryText);

  return {
    id: `baoyanwang-${record.id}`,
    source_record_id: Number(record.id),
    school_name: pickFirst(record.college, record.school, titleParts.school) || '待识别学校',
    department_name:
      pickFirst(record.academy, record.department, normalizeSecondaryDepartment(titleParts.department)) || '待补充院系',
    project_name: title,
    project_type: inferProjectType(title, record.tags, contentMeta.summary),
    discipline,
    publish_date: publishDate,
    deadline_date: deadlineDate,
    event_start_date: eventStartDate,
    event_end_date: eventEndDate,
    apply_link: pickFirst(record.sign_up_url, record.office_url, record.gzh_url),
    source_link: pickFirst(record.office_url, record.gzh_url, record.sign_up_url),
    requirements: shorten(summaryText, 1000) || '以原文通知要求为准',
    materials_required: materials,
    exam_interview_info: extractExamInfoFromText(summaryText),
    contact_info: extractContactInfo(summaryText, record.sign_up_email),
    remarks: shorten([normalizeSpace(record.rule), normalizeSpace(record.description)].filter(Boolean).join('；'), 500),
    tags: buildTags(record, summaryText, discipline, materials),
    status: inferStatus(deadlineLevel),
    deadline_level: deadlineLevel,
    year: targetYear,
    source_site: '保研信息网',
    collected_at: nowText(),
    updated_at: nowText(),
    last_checked_at: nowText(),
    last_checked_source: '保研信息网',
    is_verified: false,
    change_log: [],
    history_records: [],
    reminder_7d_sent: false,
    reminder_3d_sent: false,
    reminder_1d_sent: false
  };
}

function normalizeFingerprint(value) {
  return normalizeSpace(value)
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[【】（）()\-\s·、，,.:：]/g, '');
}

function buildFingerprints(project) {
  const deadlineDay = normalizeSpace(project.deadline_date).slice(0, 10);
  const school = normalizeCanonicalText(project.school_name);
  const department = normalizeCanonicalText(project.department_name);
  const title = normalizeCanonicalText(project.project_name);

  return unique([
    normalizeFingerprint(project.source_link),
    normalizeFingerprint(project.apply_link),
    deadlineDay && school && department ? `identity:${school}|${department}|${deadlineDay}` : '',
    deadlineDay && school && title ? `title:${school}|${title.slice(0, 28)}|${deadlineDay}` : '',
    normalizeFingerprint(`${project.school_name}|${project.department_name}|${project.project_name}`),
    normalizeFingerprint(`${project.school_name}|${project.project_name}`)
  ]).filter(Boolean);
}

function isWeakDepartmentName(value) {
  const text = normalizeSpace(value);
  return !text || text === '待补充院系' || text === '学院信息待补充' || text === '全校类';
}

function isGenericContactInfo(value) {
  const text = normalizeSpace(value);
  return !text || /以原.*通知.*联系方式为准|以原通知中的联系方式为准/.test(text);
}

function isGenericExamInfo(value) {
  const text = normalizeSpace(value);
  return !text || /未明确|以原文/.test(text);
}

function chooseProjectTitle(current, candidate) {
  const currentTitle = normalizeSpace(current);
  const candidateTitle = normalizeSpace(candidate);
  if (!currentTitle) return candidateTitle;
  if (!candidateTitle) return currentTitle;

  const currentSuspicious = isSuspiciousTitle(currentTitle);
  const candidateSuspicious = isSuspiciousTitle(candidateTitle);
  if (currentSuspicious && !candidateSuspicious) return candidateTitle;
  if (!currentSuspicious && candidateSuspicious) return currentTitle;
  return currentTitle.length <= candidateTitle.length ? currentTitle : candidateTitle;
}

function chooseLongerText(current, candidate, limit) {
  const currentText = normalizeSpace(current);
  const candidateText = normalizeSpace(candidate);
  const chosen = candidateText.length > currentText.length ? candidateText : currentText;
  return limit ? shorten(chosen, limit) : chosen;
}

function mergeDateTime(current, candidate) {
  return normalizeSpace(current) || normalizeSpace(candidate);
}

function choosePublishDate(current, candidate) {
  const currentDate = normalizeSpace(current);
  const candidateDate = normalizeSpace(candidate);
  if (!currentDate) return candidateDate;
  if (!candidateDate) return currentDate;
  return currentDate >= candidateDate ? currentDate : candidateDate;
}

function mergeDuplicateProjectData(canonical, duplicate) {
  const canonicalSource = normalizeSpace(canonical.source_site);
  const duplicateSource = normalizeSpace(duplicate.source_site);
  const duplicateSourceLink = normalizeSpace(duplicate.source_link || duplicate.apply_link);
  const mergeNote = duplicateSource
    ? `已合并重复来源：${duplicateSource}${duplicateSourceLink ? `（${duplicateSourceLink}）` : ''}`
    : '';

  return {
    ...canonical,
    school_name: isWeakSchoolName(canonical.school_name) && !isWeakSchoolName(duplicate.school_name) ? duplicate.school_name : canonical.school_name,
    department_name:
      isWeakDepartmentName(canonical.department_name) && !isWeakDepartmentName(duplicate.department_name)
        ? duplicate.department_name
        : canonical.department_name,
    project_name: chooseProjectTitle(canonical.project_name, duplicate.project_name),
    project_type: normalizeSpace(canonical.project_type) || normalizeSpace(duplicate.project_type),
    discipline: normalizeSpace(canonical.discipline) || normalizeSpace(duplicate.discipline),
    publish_date: choosePublishDate(canonical.publish_date, duplicate.publish_date),
    deadline_date: mergeDateTime(canonical.deadline_date, duplicate.deadline_date),
    event_start_date: mergeDateTime(canonical.event_start_date, duplicate.event_start_date),
    event_end_date: mergeDateTime(canonical.event_end_date, duplicate.event_end_date),
    apply_link: normalizeSpace(canonical.apply_link) || normalizeSpace(duplicate.apply_link),
    source_link: normalizeSpace(canonical.source_link) || normalizeSpace(duplicate.source_link),
    requirements: chooseLongerText(canonical.requirements, duplicate.requirements, 1000),
    materials_required: unique([...(canonical.materials_required || []), ...(duplicate.materials_required || [])]).slice(0, 12),
    exam_interview_info: isGenericExamInfo(canonical.exam_interview_info) ? duplicate.exam_interview_info : canonical.exam_interview_info,
    contact_info: isGenericContactInfo(canonical.contact_info) ? duplicate.contact_info : canonical.contact_info,
    remarks: shorten(unique([canonical.remarks, duplicate.remarks, mergeNote]).join('；'), 500),
    tags: unique([...(canonical.tags || []), ...(duplicate.tags || [])]).slice(0, 10),
    status: inferStatus(inferDeadlineLevel(mergeDateTime(canonical.deadline_date, duplicate.deadline_date))),
    deadline_level: inferDeadlineLevel(mergeDateTime(canonical.deadline_date, duplicate.deadline_date)),
    last_checked_at: nowText(),
    last_checked_source: unique([canonicalSource, duplicateSource]).join(' + '),
    change_log: [
      ...(Array.isArray(canonical.change_log) ? canonical.change_log : []),
      {
        date: nowText(),
        field: 'duplicate_merge',
        change: `合并重复通知 ${duplicate.id}`
      }
    ].slice(-20)
  };
}

function mergeProjects(primaryProjects, secondaryProjects) {
  const fingerprints = new Map();
  const merged = [];
  const ids = new Set();
  let skippedSecondaryDuplicates = 0;
  let skippedDuplicateIds = 0;
  let skippedQuality = 0;

  for (const project of [...primaryProjects, ...secondaryProjects]) {
    if (!project.id || !project.school_name || !project.project_name) {
      skippedQuality += 1;
      continue;
    }

    if (ids.has(project.id)) {
      skippedDuplicateIds += 1;
      continue;
    }

    const duplicate = buildFingerprints(project)
      .map((fingerprint) => fingerprints.get(fingerprint))
      .find(Boolean);

    if (duplicate) {
      skippedSecondaryDuplicates += 1;

      const canonical = merged[duplicate.index];
      const canonicalId = canonical?.id || duplicate.id;
      const duplicateQuality = assessNoticeQuality(project);
      if (canonical && canonical.admin_status !== 'hidden' && duplicateQuality.adminStatus !== 'hidden') {
        const mergedCanonical = applyQualityGate(mergeDuplicateProjectData(canonical, project));
        merged[duplicate.index] = mergedCanonical;
        buildFingerprints(mergedCanonical).forEach((fingerprint) => {
          fingerprints.set(fingerprint, {
            id: mergedCanonical.id,
            source_site: mergedCanonical.source_site,
            index: duplicate.index
          });
        });
      }

      merged.push(
        applyQualityGate(project, [
          'duplicate_notice',
          `duplicate_of:${canonicalId}`
        ])
      );
      ids.add(project.id);
      continue;
    }

    const gatedProject = applyQualityGate(project);
    const projectIndex = merged.length;
    merged.push(gatedProject);
    ids.add(project.id);

    if (gatedProject.admin_status !== 'hidden') {
      buildFingerprints(gatedProject).forEach((fingerprint) => {
        if (!fingerprints.has(fingerprint)) {
          fingerprints.set(fingerprint, {
            id: gatedProject.id,
            source_site: gatedProject.source_site,
            index: projectIndex
          });
        }
      });
    }
  }

  return {
    merged,
    skippedSecondaryDuplicates,
    skippedDuplicateIds,
    skippedQuality
  };
}

async function requestJson(baseUrl, path, params = {}, headers = {}, attempt = 0) {
  const url = new URL(`${baseUrl}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  try {
    const payload = await requestJsonWithNode(url, headers);
    if (payload?.code === 4029) {
      const retryAfter = Number(payload?.data?.retryAfter || 2);
      if (retryAfter > MAX_RATE_LIMIT_RETRY_AFTER_SECONDS) {
        throw new Error(`Source rate limited for ${retryAfter}s: ${url.toString()}`);
      }

      if (attempt >= 3) {
        throw new Error(`Source rate limited after retries: ${url.toString()}`);
      }

      await sleep((retryAfter + attempt) * 1000);
      return requestJson(baseUrl, path, params, headers, attempt + 1);
    }

    return payload;
  } catch (error) {
    if (isSourceRateLimitError(error)) {
      throw error;
    }

    if (attempt < 2) {
      await sleep((attempt + 1) * 1000);
      return requestJson(baseUrl, path, params, headers, attempt + 1);
    }

    throw error;
  }
}

function requestJsonWithNode(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'http:' ? http : https;
    const request = client.request(
      url,
      {
        method: 'GET',
        headers,
        timeout: REQUEST_TIMEOUT_MS
      },
      (response) => {
        const statusCode = Number(response.statusCode || 0);
        const chunks = [];
        let totalBytes = 0;

        response.on('data', (chunk) => {
          totalBytes += chunk.length;
          if (totalBytes > 20 * 1024 * 1024) {
            request.destroy(new Error(`Response too large: ${url.toString()}`));
            return;
          }
          chunks.push(chunk);
        });

        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');

          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`Request failed with status ${statusCode}: ${url.toString()} ${text.slice(0, 300)}`));
            return;
          }

          try {
            resolve(JSON.parse(text));
          } catch (error) {
            reject(new Error(`Invalid JSON from ${url.toString()}: ${error instanceof Error ? error.message : String(error)}`));
          }
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms: ${url.toString()}`));
    });
    request.on('error', reject);
    request.end();
  });
}

async function fetchPrimaryNoticeRecords(year) {
  const records = [];
  let current = 1;
  let totalPages = 1;

  while (current <= totalPages) {
    if (PRIMARY_MAX_PAGES && current > PRIMARY_MAX_PAGES) {
      break;
    }

    logEvent('primary_page_fetch_started', { page: current, pageSize: PRIMARY_PAGE_SIZE });
    if (process.env.DEBUG_SYNC_URLS) {
      const debugUrl = new URL(`${PRIMARY_API_BASE_URL}${PRIMARY_LIST_ENDPOINT}`);
      Object.entries({
        current,
        size: PRIMARY_PAGE_SIZE,
        recruitType: '',
        majorName: '',
        orderBy: PRIMARY_ORDER_BY,
        universityLevel: '',
        school: '',
        status: '',
        subjectCodes: '',
        categoryCode: '',
        year
      }).forEach(([key, value]) => debugUrl.searchParams.set(key, String(value)));
      logEvent('primary_page_url', { url: debugUrl.toString() });
    }
    const payload = await requestJson(
      PRIMARY_API_BASE_URL,
      PRIMARY_LIST_ENDPOINT,
      {
        current,
        size: PRIMARY_PAGE_SIZE,
        recruitType: '',
        majorName: '',
        orderBy: PRIMARY_ORDER_BY,
        universityLevel: '',
        school: '',
        status: '',
        subjectCodes: '',
        categoryCode: '',
        year
      },
      PRIMARY_HEADERS
    );
    const data = payload.data || {};
    const batch = Array.isArray(data.records) ? data.records : [];
    records.push(...batch);

    totalPages = Number(data.pages || totalPages || 1);
    logEvent('primary_page_fetch_finished', {
      page: current,
      records: batch.length,
      totalPages,
      totalRecords: records.length
    });
    current += 1;
  }

  return records;
}

async function fetchPrimaryNoticeDetail(noticeId) {
  const payload = await requestJson(
    PRIMARY_API_BASE_URL,
    PRIMARY_DETAIL_ENDPOINT.replace('{id}', String(noticeId)),
    {},
    PRIMARY_HEADERS
  );

  if (!payload.data || typeof payload.data !== 'object') {
    throw new Error(`Unexpected detail payload for notice ${noticeId}`);
  }

  return payload.data;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function buildPrimaryProjects(records) {
  const detailRecords = PRIMARY_MAX_DETAILS ? records.slice(0, PRIMARY_MAX_DETAILS) : records;
  const fallbackRecords = PRIMARY_MAX_DETAILS ? records.slice(PRIMARY_MAX_DETAILS) : [];
  const failures = [];
  const missingDeadlineFailures = [];
  logEvent('primary_detail_fetch_started', {
    requestedDetails: detailRecords.length,
    fallbackDetails: fallbackRecords.length,
    concurrency: PRIMARY_DETAIL_CONCURRENCY
  });
  const detailedProjects = await mapWithConcurrency(detailRecords, PRIMARY_DETAIL_CONCURRENCY, async (record) => {
    const noticeId = Number(record.id);

    try {
      const detail = await fetchPrimaryNoticeDetail(noticeId);
      await sleep(PRIMARY_DETAIL_DELAY_MS);
      return buildPrimaryProject(record, detail, TARGET_YEAR);
    } catch (error) {
      failures.push({
        id: noticeId,
        error: error instanceof Error ? error.message : String(error)
      });
      return buildPrimaryProject(record, record, TARGET_YEAR);
    }
  });

  const fallbackProjects = [];
  const missingDeadlineRecords = [];
  for (const record of fallbackRecords) {
    const project = buildPrimaryProject(record, record, TARGET_YEAR);
    if (!normalizeSpace(project.deadline_date) && missingDeadlineRecords.length < PRIMARY_MISSING_DEADLINE_MAX_DETAILS) {
      missingDeadlineRecords.push(record);
    } else {
      fallbackProjects.push(project);
    }
  }

  let missingDeadlineDetailProjects = [];
  if (missingDeadlineRecords.length) {
    logEvent('primary_missing_deadline_detail_fetch_started', {
      requestedDetails: missingDeadlineRecords.length,
      maxDetails: PRIMARY_MISSING_DEADLINE_MAX_DETAILS,
      concurrency: PRIMARY_DETAIL_CONCURRENCY
    });
    missingDeadlineDetailProjects = await mapWithConcurrency(
      missingDeadlineRecords,
      PRIMARY_DETAIL_CONCURRENCY,
      async (record) => {
        const noticeId = Number(record.id);

        try {
          const detail = await fetchPrimaryNoticeDetail(noticeId);
          await sleep(PRIMARY_DETAIL_DELAY_MS);
          return buildPrimaryProject(record, detail, TARGET_YEAR);
        } catch (error) {
          missingDeadlineFailures.push({
            id: noticeId,
            error: toErrorMessage(error)
          });
          return buildPrimaryProject(record, record, TARGET_YEAR);
        }
      }
    );
    logEvent('primary_missing_deadline_detail_fetch_finished', {
      requestedDetails: missingDeadlineRecords.length,
      failed: missingDeadlineFailures.length,
      repaired: missingDeadlineDetailProjects.filter((project) => normalizeSpace(project.deadline_date)).length
    });
  }

  logEvent('primary_detail_fetch_finished', {
    requestedDetails: detailRecords.length,
    fallbackDetails: fallbackRecords.length,
    failed: failures.length,
    missingDeadlineRequestedDetails: missingDeadlineRecords.length,
    missingDeadlineFailed: missingDeadlineFailures.length
  });

  return {
    projects: [...detailedProjects, ...missingDeadlineDetailProjects, ...fallbackProjects],
    failures: [...failures, ...missingDeadlineFailures],
    requestedDetails: detailRecords.length + missingDeadlineRecords.length,
    fallbackDetails: fallbackRecords.length,
    missingDeadlineRequestedDetails: missingDeadlineRecords.length,
    missingDeadlineRepaired: missingDeadlineDetailProjects.filter((project) => normalizeSpace(project.deadline_date)).length,
    missingDeadlineFailed: missingDeadlineFailures.length
  };
}

async function fetchSecondaryNoticeRecords(targetYear) {
  const records = [];
  let emptyTargetPages = 0;

  for (let page = 1; page <= SECONDARY_MAX_PAGES; page += 1) {
    logEvent('secondary_page_fetch_started', { page, pageSize: SECONDARY_PAGE_SIZE });
    const payload = await requestJson(
      SECONDARY_API_BASE_URL,
      SECONDARY_LIST_ENDPOINT,
      {
        page,
        size: SECONDARY_PAGE_SIZE,
        category: SECONDARY_CATEGORY,
        all: 1
      },
      SECONDARY_HEADERS
    );

    const batch = normalizeSecondaryPayload(payload);
    logEvent('secondary_page_fetch_finished', {
      page,
      records: batch.length,
      targetRecords: batch.filter((record) => isSecondaryTargetRecord(record, targetYear)).length
    });
    if (!batch.length) {
      break;
    }

    const targetBatch = batch.filter((record) => isSecondaryTargetRecord(record, targetYear));
    records.push(...targetBatch);

    if (!targetBatch.length) {
      emptyTargetPages += 1;
      if (emptyTargetPages >= 2) {
        break;
      }
    } else {
      emptyTargetPages = 0;
    }

    if (batch.length < SECONDARY_PAGE_SIZE) {
      break;
    }

    await sleep(300);
  }

  return records;
}

async function fetchSecondaryNoticeDetail(articleId) {
  const id = normalizeSpace(articleId);
  if (!/^\d+$/.test(id)) {
    throw new Error(`Invalid secondary detail id: ${articleId}`);
  }

  const payload = await requestJson(
    SECONDARY_API_BASE_URL,
    SECONDARY_DETAIL_ENDPOINT.replace('{id}', id),
    {},
    SECONDARY_HEADERS
  );
  const record = payload?.result || payload?.data || payload?.article;
  if (!record || typeof record !== 'object') {
    throw new Error(`Secondary detail missing record: ${id}`);
  }

  return record;
}

async function fetchSecondaryRepairRecords(existingRecords, targetYear) {
  const existingIds = new Set(existingRecords.map((record) => normalizeSpace(record.id)));
  const repairIds = SECONDARY_REPAIR_DETAIL_IDS.filter((id) => !existingIds.has(id));
  const records = [];
  const failures = [];

  for (const id of repairIds) {
    logEvent('secondary_detail_repair_started', { id });
    try {
      const record = await fetchSecondaryNoticeDetail(id);
      if (isSecondaryTargetRecord(record, targetYear)) {
        records.push(record);
      }
      logEvent('secondary_detail_repair_finished', {
        id,
        included: isSecondaryTargetRecord(record, targetYear)
      });
    } catch (error) {
      failures.push({
        id,
        error: toErrorMessage(error)
      });
      logEvent('secondary_detail_repair_failed', {
        id,
        error: toErrorMessage(error)
      });
    }

    if (SECONDARY_DETAIL_DELAY_MS > 0) {
      await sleep(SECONDARY_DETAIL_DELAY_MS);
    }
  }

  return {
    records,
    failures,
    requestedIds: repairIds
  };
}

async function buildSecondaryProjects(records) {
  const projects = records.map((record) => buildSecondaryProject(record, TARGET_YEAR));
  const failures = [];
  const repairCandidates = projects
    .map((project, index) => ({
      project,
      record: records[index],
      index
    }))
    .filter((item) => !normalizeSpace(item.project.deadline_date) && item.record?.id)
    .slice(0, SECONDARY_MISSING_DEADLINE_MAX_DETAILS);

  if (!repairCandidates.length) {
    return {
      projects,
      failures,
      requestedDetails: 0,
      repaired: 0
    };
  }

  logEvent('secondary_missing_deadline_detail_fetch_started', {
    requestedDetails: repairCandidates.length,
    maxDetails: SECONDARY_MISSING_DEADLINE_MAX_DETAILS
  });

  let repaired = 0;
  for (const candidate of repairCandidates) {
    const id = normalizeSpace(candidate.record.id);
    try {
      const detail = await fetchSecondaryNoticeDetail(id);
      const repairedProject = buildSecondaryProject(
        {
          ...candidate.record,
          ...detail
        },
        TARGET_YEAR
      );
      projects[candidate.index] = repairedProject;
      if (normalizeSpace(repairedProject.deadline_date)) {
        repaired += 1;
      }
    } catch (error) {
      failures.push({
        id,
        error: toErrorMessage(error)
      });
    }

    if (SECONDARY_DETAIL_DELAY_MS > 0) {
      await sleep(SECONDARY_DETAIL_DELAY_MS);
    }
  }

  logEvent('secondary_missing_deadline_detail_fetch_finished', {
    requestedDetails: repairCandidates.length,
    repaired,
    failed: failures.length
  });

  return {
    projects,
    failures,
    requestedDetails: repairCandidates.length,
    repaired
  };
}

async function pushProjectsToSupabase(projects, summary) {
  if (DRY_RUN) {
    return {
      ok: true,
      dryRun: true,
      noticesReceived: projects.length,
      noticesUpserted: 0
    };
  }

  if (!SUPABASE_INGEST_URL) {
    throw new Error('SUPABASE_INGEST_URL or SUPABASE_PROJECT_REF is not configured.');
  }

  if (!SUPABASE_INGEST_SECRET) {
    throw new Error('SUPABASE_INGEST_SECRET or SEEKOFFER_INGEST_SECRET is not configured.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(SUPABASE_INGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-seekoffer-ingest-secret': SUPABASE_INGEST_SECRET
      },
      body: JSON.stringify({
        source: SUPABASE_INGEST_SOURCE,
        notices: projects,
        summary
      }),
      signal: controller.signal
    });

    const rawText = await response.text();
    const payload = safeJsonParse(rawText, {
      status: response.status,
      body: rawText
    });

    if (!response.ok) {
      throw new Error(`Supabase ingest failed with status ${response.status}: ${JSON.stringify(payload)}`);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function countBy(items, picker) {
  return items.reduce((result, item) => {
    const key = picker(item) || 'unknown';
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function maxDateText(values) {
  return values.map(normalizeSpace).filter(Boolean).sort().at(-1) || '';
}

function getProjectPublishDate(project) {
  return normalizeSpace(project.publish_date).slice(0, 10);
}

function getPrimaryRecordPublishDate(record) {
  return normalizeDate(record.publishTime || record.publish_time || record.updatedTime || record.updated_time);
}

function getSecondaryRecordPublishDate(record) {
  return normalizeDate(record.updated_time || record.updated_at || record.created_at || record.sign_up_start);
}

function buildSourceStats(primaryRecords, secondaryRecords) {
  const primaryDates = primaryRecords.map(getPrimaryRecordPublishDate).filter(Boolean);
  const secondaryDates = secondaryRecords.map(getSecondaryRecordPublishDate).filter(Boolean);

  return {
    maxSourcePublishDate: maxDateText([...primaryDates, ...secondaryDates]),
    maxPrimaryPublishDate: maxDateText(primaryDates),
    maxSecondaryPublishDate: maxDateText(secondaryDates),
    primaryDateHistogram: countBy(primaryDates, (date) => date),
    secondaryDateHistogram: countBy(secondaryDates, (date) => date)
  };
}

function buildQualityStats(projects) {
  const published = projects.filter((project) => project.admin_status === 'published');
  const privateProjects = projects.filter((project) => project.is_private);
  const longPublishedTitles = published.filter((project) => normalizeSpace(project.project_name).length > 140);
  const weakSchoolProjects = projects.filter((project) => isWeakSchoolName(project.school_name));
  const publishedWeakSchoolProjects = published.filter((project) => isWeakSchoolName(project.school_name));

  return {
    byAdminStatus: countBy(projects, (project) => project.admin_status),
    byQualityTier: countBy(projects, (project) => project.quality_tier),
    bySource: countBy(projects, (project) => project.source_site),
    published: published.length,
    private: privateProjects.length,
    maxOutputPublishDate: maxDateText(projects.map(getProjectPublishDate)),
    maxPublishedPublishDate: maxDateText(published.map(getProjectPublishDate)),
    publishedLongTitleCount: longPublishedTitles.length,
    publishedLongTitleIds: longPublishedTitles.slice(0, 10).map((project) => project.id),
    weakSchoolCount: weakSchoolProjects.length,
    weakSchoolIds: weakSchoolProjects.slice(0, 10).map((project) => project.id),
    publishedWeakSchoolCount: publishedWeakSchoolProjects.length,
    publishedWeakSchoolIds: publishedWeakSchoolProjects.slice(0, 10).map((project) => project.id),
    missingDeadlineCount: projects.filter((project) => !normalizeSpace(project.deadline_date)).length,
    duplicateHiddenCount: projects.filter((project) => project.quality_reasons?.some((reason) => reason === 'duplicate_notice')).length,
    reviewSamples: projects
      .filter((project) => project.admin_status !== 'published')
      .slice(0, 10)
      .map((project) => ({
        id: project.id,
        status: project.admin_status,
        source: project.source_site,
        title: project.project_name,
        reasons: project.quality_reasons
      }))
  };
}

function assessSyncHealth(sourceStats, qualityStats) {
  const errors = [];
  const warnings = [];

  if (!qualityStats.published) {
    errors.push('no_published_notices');
  }

  if (qualityStats.publishedLongTitleCount > 0) {
    errors.push('published_body_like_titles');
  }

  if (qualityStats.publishedWeakSchoolCount > 0) {
    errors.push('published_weak_school_names');
  }

  if (sourceStats.maxSourcePublishDate && qualityStats.maxOutputPublishDate && sourceStats.maxSourcePublishDate > qualityStats.maxOutputPublishDate) {
    errors.push('source_newer_than_output');
  }

  if (
    sourceStats.maxSourcePublishDate &&
    qualityStats.maxPublishedPublishDate &&
    sourceStats.maxSourcePublishDate > qualityStats.maxPublishedPublishDate
  ) {
    warnings.push('latest_source_date_has_no_public_notice');
  }

  if (qualityStats.duplicateHiddenCount > 0) {
    warnings.push('duplicates_hidden');
  }

  if (qualityStats.missingDeadlineCount > 0) {
    warnings.push('missing_deadline_routed_to_review');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}

async function runSync() {
  const startedAt = nowText();
  console.log(
    JSON.stringify(
      {
        event: 'sync_started',
        source: SUPABASE_INGEST_SOURCE,
        syncMode: SYNC_MODE,
        targetYear: TARGET_YEAR,
        primaryOrderBy: PRIMARY_ORDER_BY,
        primaryMaxPages: PRIMARY_MAX_PAGES || 'all',
        primaryMaxDetails: PRIMARY_MAX_DETAILS || 'all',
        secondaryMaxPages: SECONDARY_MAX_PAGES,
        secondaryRepairDetailIds: SECONDARY_REPAIR_DETAIL_IDS,
        requestTimeoutMs: REQUEST_TIMEOUT_MS,
        dryRun: DRY_RUN,
        startedAt
      },
      null,
      2
    )
  );

  const sourceErrors = [];
  let primaryListRecords = [];
  let primaryNoticeRecords = [];
  let primaryProjects = [];
  let primaryFailures = [];
  let requestedDetails = 0;
  let fallbackDetails = 0;
  let primaryMissingDeadlineRequestedDetails = 0;
  let primaryMissingDeadlineRepaired = 0;
  let primaryMissingDeadlineFailed = 0;

  try {
    primaryListRecords = await fetchPrimaryNoticeRecords(TARGET_YEAR);
    primaryNoticeRecords = primaryListRecords.filter((record) => normalizeSpace(record?.name) && record?.id);
    const primaryBuildResult = await buildPrimaryProjects(primaryNoticeRecords);
    primaryProjects = primaryBuildResult.projects;
    primaryFailures = primaryBuildResult.failures;
    requestedDetails = primaryBuildResult.requestedDetails;
    fallbackDetails = primaryBuildResult.fallbackDetails;
    primaryMissingDeadlineRequestedDetails = primaryBuildResult.missingDeadlineRequestedDetails;
    primaryMissingDeadlineRepaired = primaryBuildResult.missingDeadlineRepaired;
    primaryMissingDeadlineFailed = primaryBuildResult.missingDeadlineFailed;
  } catch (error) {
    const message = toErrorMessage(error);
    sourceErrors.push({
      source: 'primary',
      sourceSite: '保研通知网',
      stage: 'primary_fetch',
      error: message
    });
    logEvent('source_fetch_failed', {
      source: 'primary',
      sourceSite: '保研通知网',
      error: message
    });
  }

  let secondaryRecords = [];
  let secondaryProjects = [];
  let secondaryRepairRecords = [];
  let secondaryRepairFailures = [];
  let secondaryRepairRequestedIds = [];
  let secondaryMissingDeadlineFailures = [];
  let secondaryMissingDeadlineRequestedDetails = 0;
  let secondaryMissingDeadlineRepaired = 0;

  try {
    secondaryRecords = await fetchSecondaryNoticeRecords(TARGET_YEAR);
    const secondaryRepairResult = await fetchSecondaryRepairRecords(secondaryRecords, TARGET_YEAR);
    secondaryRepairRecords = secondaryRepairResult.records;
    secondaryRepairFailures = secondaryRepairResult.failures;
    secondaryRepairRequestedIds = secondaryRepairResult.requestedIds;
    secondaryRecords = [...secondaryRecords, ...secondaryRepairRecords];
    const secondaryBuildResult = await buildSecondaryProjects(secondaryRecords);
    secondaryProjects = secondaryBuildResult.projects;
    secondaryMissingDeadlineFailures = secondaryBuildResult.failures;
    secondaryMissingDeadlineRequestedDetails = secondaryBuildResult.requestedDetails;
    secondaryMissingDeadlineRepaired = secondaryBuildResult.repaired;
  } catch (error) {
    const message = toErrorMessage(error);
    sourceErrors.push({
      source: 'secondary',
      sourceSite: '保研信息网',
      stage: 'secondary_fetch',
      error: message
    });
    logEvent('source_fetch_failed', {
      source: 'secondary',
      sourceSite: '保研信息网',
      error: message
    });
  }

  const { merged, skippedSecondaryDuplicates, skippedDuplicateIds, skippedQuality } = mergeProjects(
    primaryProjects,
    secondaryProjects
  );

  if (!merged.length) {
    throw new Error(
      `No valid projects parsed, aborting sync.${
        sourceErrors.length ? ` Source errors: ${sourceErrors.map((item) => `${item.source}:${item.error}`).join(' | ')}` : ''
      }`
    );
  }

  const sourceStats = buildSourceStats(primaryNoticeRecords, secondaryRecords);
  const qualityStats = buildQualityStats(merged);
  const health = assessSyncHealth(sourceStats, qualityStats);
  if (sourceErrors.length) {
    health.warnings.push(...sourceErrors.map((item) => `${item.source}_source_unavailable`));
  }
  if (secondaryRepairFailures.length) {
    health.warnings.push('secondary_detail_repair_failed');
  }
  if (secondaryMissingDeadlineFailures.length) {
    health.warnings.push('secondary_missing_deadline_detail_failed');
  }

  if (!health.ok) {
    logEvent('sync_health_failed', {
      sourceStats,
      qualityStats,
      health
    });
    throw new Error(`Notice sync health check failed: ${health.errors.join(', ')}`);
  }

  const summary = {
    syncMode: SYNC_MODE,
    targetYear: TARGET_YEAR,
    startedAt,
    finishedAt: nowText(),
    primaryOrderBy: PRIMARY_ORDER_BY,
    primaryMaxPages: PRIMARY_MAX_PAGES || 'all',
    primaryFetched: primaryListRecords.length,
    primaryParsed: primaryProjects.length,
    primaryRequestedDetails: requestedDetails,
    primaryFallbackDetails: fallbackDetails,
    primaryMissingDeadlineRequestedDetails,
    primaryMissingDeadlineRepaired,
    primaryMissingDeadlineFailed,
    primaryFailed: primaryFailures.length,
    primaryFailures: primaryFailures.slice(0, 10),
    secondaryMaxPages: SECONDARY_MAX_PAGES,
    secondaryFetched: secondaryRecords.length,
    secondaryRepairRequestedIds,
    secondaryRepairFetched: secondaryRepairRecords.length,
    secondaryRepairFailed: secondaryRepairFailures.length,
    secondaryRepairFailures: secondaryRepairFailures.slice(0, 10),
    secondaryMissingDeadlineRequestedDetails,
    secondaryMissingDeadlineRepaired,
    secondaryMissingDeadlineFailed: secondaryMissingDeadlineFailures.length,
    secondaryMissingDeadlineFailures: secondaryMissingDeadlineFailures.slice(0, 10),
    secondaryParsed: secondaryProjects.length,
    secondarySkippedAsDuplicate: skippedSecondaryDuplicates,
    skippedDuplicateIds,
    skippedQuality,
    mergedProjects: merged.length,
    sourceStats,
    qualityStats,
    health,
    sourceErrors,
    dryRun: DRY_RUN
  };

  const ingestResult = await pushProjectsToSupabase(merged, summary);
  const result = {
    ok: true,
    destination: DRY_RUN ? 'dry-run' : 'supabase.notices',
    source: SUPABASE_INGEST_SOURCE,
    ...summary,
    noticesReceived: Number(ingestResult?.noticesReceived || merged.length),
    noticesUpserted: Number(ingestResult?.noticesUpserted || 0)
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

runSync().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      null,
      2
    )
  );
  process.exit(1);
});
