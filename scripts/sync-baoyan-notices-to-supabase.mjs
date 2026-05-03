const PRIMARY_API_BASE_URL = process.env.API_BASE_URL || 'https://ajqwsiasyqyi.sealosgzg.site';
const SECONDARY_API_BASE_URL = process.env.BAOYANWANG_API_BASE_URL || 'http://api.baoyanwang.com.cn/api/v1';
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || '';
const SUPABASE_INGEST_URL =
  process.env.SUPABASE_INGEST_URL ||
  (SUPABASE_PROJECT_REF ? `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/ingest-notices` : '');
const SUPABASE_INGEST_SECRET = process.env.SUPABASE_INGEST_SECRET || process.env.SEEKOFFER_INGEST_SECRET || '';
const SUPABASE_INGEST_SOURCE = process.env.SUPABASE_INGEST_SOURCE || 'github-actions-sync';
const TARGET_YEAR = Number(process.env.TARGET_YEAR || '2026');

const PRIMARY_WEB_DETAIL_URL = 'https://www.baoyantongzhi.com/notice/detail/{id}';
const PRIMARY_LIST_ENDPOINT = '/backgd/notice/show/list';
const PRIMARY_DETAIL_ENDPOINT = '/backgd/notice/show/{id}';
const SECONDARY_LIST_ENDPOINT = '/articles';

const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 30000);
const PRIMARY_PAGE_SIZE = Number(process.env.PRIMARY_PAGE_SIZE || 40);
const PRIMARY_MAX_PAGES = parseOptionalInteger(process.env.PRIMARY_MAX_PAGES);
const PRIMARY_MAX_DETAILS = parseOptionalInteger(process.env.PRIMARY_MAX_DETAILS);
const PRIMARY_ORDER_BY = process.env.PRIMARY_ORDER_BY || 'publishTime';
const PRIMARY_DETAIL_CONCURRENCY = Math.max(1, Number(process.env.PRIMARY_DETAIL_CONCURRENCY || 3));
const PRIMARY_DETAIL_DELAY_MS = Math.max(0, Number(process.env.PRIMARY_DETAIL_DELAY_MS || 150));
const SECONDARY_PAGE_SIZE = Number(process.env.SECONDARY_PAGE_SIZE || 25);
const SECONDARY_MAX_PAGES = Number(process.env.SECONDARY_MAX_PAGES || 30);
const DRY_RUN = /^1|true|yes$/i.test(process.env.DRY_RUN || '');

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
  /蓝桥杯|全国大学生.*竞赛|大学生软件和信息技术大赛|数学建模|程序设计竞赛|\bACM\b|\bICPC\b/i;

function parseOptionalInteger(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSpace(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).replace(/\s+/g, ' ').trim();
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

function formatDateInChina(date) {
  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }

  const parts = toChinaParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
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

function cleanTitle(value) {
  return normalizeSpace(value)
    .replace(/\.pdf$/i, '')
    .replace(/^【?招生通知】?\s*/i, '')
    .slice(0, 140);
}

function shouldKeepNotice(notice) {
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

  if (!notice.id || !notice.school_name || !notice.project_name) return false;
  if (notice.project_name.length < 6) return false;
  if (DIRTY_NOTICE_PATTERN.test(text)) return false;
  if (COMPETITION_NOTICE_PATTERN.test(text)) return false;
  return true;
}

function buildPrimaryProject(record, detail = {}, targetYear = TARGET_YEAR) {
  const recordId = Number(record.id || detail.id);
  const title = cleanTitle(detail.name || record.name || record.title);
  const textLines = htmlToTextLines(detail.detailContent || detail.content || '');
  const plainText = textLines.join('\n');
  const publishDate = normalizeDate(detail.publishTime || record.publishTime) || nowDateText();
  const deadlineDate = normalizeDateTime(detail.endTime || record.endTime);
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
    record.updated_time,
    record.updated_at,
    record.created_at,
    record.title,
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

function parseSecondaryContent(record) {
  const contentPayload = safeJsonParse(record.content || '{}', {});
  return {
    coverUrl: normalizeSpace(contentPayload.cover_url || record.cover_url),
    summary: normalizeSpace(contentPayload.p || record.description || record.title)
  };
}

function buildSecondaryProject(record, targetYear = TARGET_YEAR) {
  const title = cleanTitle(record.title);
  const contentMeta = parseSecondaryContent(record);
  const summaryText = [title, contentMeta.summary, normalizeSpace(record.description)].filter(Boolean).join(' ');
  const publishDate = normalizeDate(record.updated_time || record.updated_at || record.created_at) || nowDateText();
  const deadlineDate = normalizeDateTime(record.sign_up_end || record.end_time);
  const eventStartDate = normalizeDate(record.start_time || record.sign_up_start);
  const eventEndDate = normalizeDate(record.end_time || record.sign_up_end);
  const deadlineLevel = inferDeadlineLevel(deadlineDate);
  const discipline = inferDiscipline(pickFirst(record.major, record.academy_major, record.subject), title);
  const materials = extractMaterialsFromText(summaryText);

  return {
    id: `baoyanwang-${record.id}`,
    source_record_id: Number(record.id),
    school_name: pickFirst(record.college, record.school) || '待识别学校',
    department_name: pickFirst(record.academy, record.department) || '待补充院系',
    project_name: pickFirst(contentMeta.summary, title),
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
  return unique([
    normalizeFingerprint(project.source_link),
    normalizeFingerprint(project.apply_link),
    normalizeFingerprint(`${project.school_name}|${project.department_name}|${project.project_name}`),
    normalizeFingerprint(`${project.school_name}|${project.project_name}`)
  ]).filter(Boolean);
}

function mergeProjects(primaryProjects, secondaryProjects) {
  const fingerprints = new Set();
  const merged = [];
  const ids = new Set();
  let skippedSecondaryDuplicates = 0;
  let skippedDuplicateIds = 0;
  let skippedQuality = 0;

  for (const project of [...primaryProjects, ...secondaryProjects]) {
    if (!shouldKeepNotice(project)) {
      skippedQuality += 1;
      continue;
    }

    if (ids.has(project.id)) {
      skippedDuplicateIds += 1;
      continue;
    }

    const projectFingerprints = buildFingerprints(project);
    const isDuplicate = projectFingerprints.some((fingerprint) => fingerprints.has(fingerprint));
    if (isDuplicate && project.source_site !== '保研通知网') {
      skippedSecondaryDuplicates += 1;
      continue;
    }

    merged.push(project);
    ids.add(project.id);
    projectFingerprints.forEach((fingerprint) => fingerprints.add(fingerprint));
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
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}: ${url.toString()}`);
    }

    const payload = await response.json();
    if (payload?.code === 4029 && attempt < 3) {
      const retryAfter = Number(payload?.data?.retryAfter || 2);
      await sleep((retryAfter + attempt) * 1000);
      return requestJson(baseUrl, path, params, headers, attempt + 1);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPrimaryNoticeRecords(year) {
  const records = [];
  let current = 1;
  let totalPages = 1;

  while (current <= totalPages) {
    if (PRIMARY_MAX_PAGES && current > PRIMARY_MAX_PAGES) {
      break;
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
  const limitedRecords = PRIMARY_MAX_DETAILS ? records.slice(0, PRIMARY_MAX_DETAILS) : records;
  const failures = [];
  const projects = await mapWithConcurrency(limitedRecords, PRIMARY_DETAIL_CONCURRENCY, async (record) => {
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

  return {
    projects,
    failures,
    requestedDetails: limitedRecords.length
  };
}

async function fetchSecondaryNoticeRecords(targetYear) {
  const records = [];
  let emptyTargetPages = 0;

  for (let page = 1; page <= SECONDARY_MAX_PAGES; page += 1) {
    const payload = await requestJson(
      SECONDARY_API_BASE_URL,
      SECONDARY_LIST_ENDPOINT,
      {
        page,
        size: SECONDARY_PAGE_SIZE,
        category: '保研信息',
        all: 1
      },
      SECONDARY_HEADERS
    );

    const batch = normalizeSecondaryPayload(payload);
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
    throw new Error('SUPABASE_INGEST_SECRET is not configured.');
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

async function runSync() {
  const startedAt = nowText();
  console.log(
    JSON.stringify(
      {
        event: 'sync_started',
        source: SUPABASE_INGEST_SOURCE,
        targetYear: TARGET_YEAR,
        primaryOrderBy: PRIMARY_ORDER_BY,
        primaryMaxPages: PRIMARY_MAX_PAGES || 'all',
        dryRun: DRY_RUN,
        startedAt
      },
      null,
      2
    )
  );

  const primaryListRecords = await fetchPrimaryNoticeRecords(TARGET_YEAR);
  const primaryNoticeRecords = primaryListRecords.filter((record) => normalizeSpace(record?.name) && record?.id);
  const { projects: primaryProjects, failures: primaryFailures, requestedDetails } = await buildPrimaryProjects(
    primaryNoticeRecords
  );
  const secondaryRecords = await fetchSecondaryNoticeRecords(TARGET_YEAR);
  const secondaryProjects = secondaryRecords.map((record) => buildSecondaryProject(record, TARGET_YEAR));
  const { merged, skippedSecondaryDuplicates, skippedDuplicateIds, skippedQuality } = mergeProjects(
    primaryProjects,
    secondaryProjects
  );

  if (!merged.length) {
    throw new Error('No valid projects parsed, aborting sync.');
  }

  const summary = {
    targetYear: TARGET_YEAR,
    startedAt,
    finishedAt: nowText(),
    primaryOrderBy: PRIMARY_ORDER_BY,
    primaryFetched: primaryListRecords.length,
    primaryParsed: primaryProjects.length,
    primaryRequestedDetails: requestedDetails,
    primaryFailed: primaryFailures.length,
    primaryFailures: primaryFailures.slice(0, 10),
    secondaryFetched: secondaryRecords.length,
    secondaryParsed: secondaryProjects.length,
    secondarySkippedAsDuplicate: skippedSecondaryDuplicates,
    skippedDuplicateIds,
    skippedQuality,
    mergedProjects: merged.length,
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
