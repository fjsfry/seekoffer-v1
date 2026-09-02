import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const exportRoot = process.env.NOTICE_EXPORT_ROOT || path.resolve(repoRoot, '..', 'exports');
const dataPath = path.join(repoRoot, 'data', 'baoyantongzhi-notices-2026.json');
const projectNoticesPath = path.join(exportRoot, 'project_notices.json');
const calendarNoticesPath = path.join(exportRoot, 'calendar_notices.json');
const collegeDirectoryPath = path.join(repoRoot, 'lib', 'college-directory.ts');

const INTERNAL_TAG_PATTERN = /^calendar_|^project_notices|^cloudbase/i;
const NOISY_TAG_PATTERN = /https?:|www\.|\.(com|cn|edu|org)|(^|\s)com($|\s)/i;
const DIRTY_NOTICE_PATTERN =
  /seekoffer\s*test|\bdemo\b|\btest\b|测试|測試|测试数据|占位数据|示例数据|\?{3,}|�{2,}|锟斤拷|锟�|undefined|null/i;
const COMPETITION_NOTICE_PATTERN =
  /榜单赛事|蓝桥杯|挑战杯|互联网\+|数学建模|程序设计竞赛|软件和信息技术大赛|高校计算机大赛|跨文化能力竞赛|竞赛章程|大学生.*竞赛|创新创业大赛|大赛|\bACM\b|\bICPC\b/i;
const BODY_LIKE_TITLE_PATTERN = /^通\s*知我院|复试工作还在进行中|请各位同学及时|详见附件|具体安排如下/i;

function loadLocalEnv() {
  for (const fileName of ['.env.local', '.env']) {
    const filePath = path.join(repoRoot, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
        continue;
      }

      const [key, ...rest] = trimmed.split('=');
      if (!process.env[key]) {
        process.env[key] = rest.join('=').replace(/^['"]|['"]$/g, '');
      }
    }
  }
}

function readJson(filePath, fallback = []) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

const APPLICATION_ONLY_LINK_PATTERN =
  /(wjx|wenjuan|jinshuju|questionnaire|survey|docs\.qq\.com\/form|feishu\.cn\/share\/base\/form|forms?\.|\/forms?\/|\/form\/|\/survey\/|\/questionnaire\/|\/collect\/)/i;

function isLikelyApplicationOnlyLink(value) {
  const link = compact(value);
  return Boolean(link && /^https?:\/\//i.test(link) && APPLICATION_ONLY_LINK_PATTERN.test(link));
}

function pickApplyLink(row) {
  return compact(row.applyLink || row.apply_link || row.applyUrl || row.apply_url || row.sourceLink || row.source_link);
}

function pickSourceLink(row) {
  const directSource = compact(row.sourceLink || row.source_link || row.detailUrl || row.detail_url);

  if (directSource) {
    return directSource;
  }

  const fallback = compact(row.applyLink || row.apply_link || row.applyUrl || row.apply_url);
  return fallback && !isLikelyApplicationOnlyLink(fallback) ? fallback : '';
}

function cleanProjectTitle(value) {
  let title = compact(value)
    .replace(/^招生通知\s*[|｜]\s*/i, '')
    .replace(/\.pdf\b/gi, '')
    .replace(/\s*(报名中|已截止|未开始)\s*(夏令营报名|春令营报名|其他)?\s*/g, ' ')
    .trim();

  const cutPatterns = [
    /(?:申请|报名|推免|营员)?截止时间(?:[:：]|在|为)?/i,
    /(?:申请|报名|由请)?开始时间(?:[:：]|在|为)?/i,
    /发布时间[:：]/i,
    /发布日期[:：]/i,
    /发表日期[:：]/i,
    /一、/,
    /1[.、]\s*/
  ];

  for (const pattern of cutPatterns) {
    const match = title.match(pattern);
    if (match?.index && match.index >= 8) {
      title = title.slice(0, match.index).trim();
      break;
    }
  }

  const introIndex = title.search(/简介(?=.{18,})/);
  if (introIndex >= 12) {
    title = title.slice(0, introIndex + 2).trim();
  }

  const sentenceCut = title.search(/[。；;！!](?=.{12,})/);
  if (sentenceCut >= 12) {
    title = title.slice(0, sentenceCut + 1).trim();
  }

  return compact(title).slice(0, 110);
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return value
      .split(/[、,，;；\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function unique(items) {
  const seen = new Set();
  return items.filter((item) => {
    const value = compact(item);
    if (!value || seen.has(value)) {
      return false;
    }

    seen.add(value);
    return true;
  });
}

function isWeakSchool(value) {
  const text = compact(value);
  return (
    !text ||
    text === '???' ||
    text === '其他' ||
    text === '待补充' ||
    text === '待补充院校' ||
    text === '待识别学校' ||
    text === '待识别院校' ||
    text === '中国大学' ||
    /^20\d{2}年大学$/.test(text)
  );
}

function loadColleges() {
  const source = fs.readFileSync(collegeDirectoryPath, 'utf8');
  const rows = [];
  const matcher = /\['([^']+)',\s*'([^']*)',\s*'([^']*)'/g;
  let match;

  while ((match = matcher.exec(source))) {
    rows.push({
      name: match[1],
      city: match[2],
      levels: match[3].split(',').map((item) => item.trim()).filter(Boolean)
    });
  }

  return rows.sort((left, right) => right.name.length - left.name.length);
}

const colleges = loadColleges();

function findCollegeFromText(text) {
  const value = compact(text);
  const matched = colleges.find((item) => value.includes(item.name));

  if (matched) {
    return matched;
  }

  if (value.includes('中国科学院')) {
    return { name: '中国科学院', city: '', levels: ['双一流'] };
  }

  return null;
}

function normalizeDateFragment(value, fallbackTime = '23:59') {
  const text = compact(value);
  const match = text.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?/);

  if (!match) {
    return '';
  }

  const [, year, month, day, hour, minute] = match;
  const mm = month.padStart(2, '0');
  const dd = day.padStart(2, '0');
  const time = hour ? `${hour.padStart(2, '0')}:${(minute || '00').padStart(2, '0')}` : fallbackTime;
  return `${year}-${mm}-${dd} ${time}`;
}

function normalizeDateOnly(value) {
  const normalized = normalizeDateFragment(value, '00:00');
  return normalized ? normalized.slice(0, 10) : '';
}

function extractLabeledDate(text, labels, fallbackTime = '23:59') {
  const source = compact(text);

  for (const label of labels) {
    const matcher = new RegExp(`${label}[:：]?\\s*(20\\d{2}[-/.年]\\d{1,2}[-/.月]\\d{1,2}日?(?:\\s+\\d{1,2}:\\d{2}(?::\\d{2})?)?)`, 'g');
    const matches = [...source.matchAll(matcher)];
    const last = matches.at(-1)?.[1];

    if (last) {
      return normalizeDateFragment(last, fallbackTime);
    }
  }

  return '';
}

function inferProjectType(projectType, title) {
  const text = `${projectType} ${title}`;
  if (/夏令营|暑期学校|开放日|交流营|科学营/.test(text)) return '夏令营';
  if (/预推免|推免预报名|预接收|预报名.*推免|接收推荐免试(?:研究生)?预报名|推荐免试(?:研究生)?预报名/.test(text)) {
    return '预推免';
  }
  if (/推免|免试|正式/.test(text)) return '正式推免';
  return '夏令营';
}

function inferDiscipline(value, title) {
  const text = compact(`${value} ${title}`);

  if (/计算机|人工智能|软件|网络|电子|信息|通信|自动化|控制|机械|材料|化工|工程|建筑|土木|能源|航空|仪器|纳米/.test(text)) {
    return '工学';
  }
  if (/数学|物理|化学|统计|地理|地球|天文|理学/.test(text)) return '理学';
  if (/经济|金融|管理|工商|会计|市场|商学院/.test(text)) return '经管';
  if (/医学|生物|生命|药学|护理|口腔|公共卫生|健康/.test(text)) return '生命医学';
  if (/法学|政治|社会|教育|中文|历史|哲学|新闻|外语|国际关系|马克思/.test(text)) return '人文社科';
  return compact(value) || '交叉其他';
}

function parseDateToTime(value) {
  const text = normalizeDateFragment(value, '23:59');
  if (!text) {
    return Number.NaN;
  }

  return new Date(`${text.replace(' ', 'T')}:00+08:00`).getTime();
}

function inferDeadlineLevel(deadlineDate, status) {
  const text = compact(status);
  const deadlineTime = parseDateToTime(deadlineDate);

  if (Number.isNaN(deadlineTime)) {
    return text.includes('截止') || text.includes('结束') ? 'expired' : 'future';
  }

  const now = Date.now();
  const diffDays = Math.ceil((deadlineTime - now) / (1000 * 60 * 60 * 24));

  if (deadlineTime <= now || text.includes('已截止') || text.includes('已结束')) return 'expired';
  if (diffDays <= 1) return 'today';
  if (diffDays <= 3) return 'within3days';
  if (diffDays <= 7) return 'within7days';
  return 'future';
}

function inferStatus(deadlineLevel, rawStatus) {
  const status = compact(rawStatus);
  if (deadlineLevel === 'expired') return '已截止';
  if (deadlineLevel === 'today' || deadlineLevel === 'within3days' || deadlineLevel === 'within7days') return '即将截止';

  if (['未开始', '报名中', '即将截止', '已截止', '活动中', '已结束'].includes(status)) {
    return status;
  }

  return '报名中';
}

function normalizeTags(tags, college, discipline) {
  const base = toArray(tags)
    .map(compact)
    .filter((item) => item && item !== '???' && !INTERNAL_TAG_PATTERN.test(item) && !NOISY_TAG_PATTERN.test(item));

  return unique([...(college?.levels || []), college?.city || '', discipline, ...base]).slice(0, 8);
}

function hasValidDeadlineDate(value) {
  const deadlineTime = parseDateToTime(value);
  if (Number.isNaN(deadlineTime)) {
    return false;
  }

  const year = new Date(deadlineTime).getFullYear();
  return year >= 2025 && year <= 2028;
}

function shouldKeepPublicNotice(project) {
  const text = [
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
    .map(compact)
    .join(' ');

  if (DIRTY_NOTICE_PATTERN.test(text)) {
    return false;
  }

  if (BODY_LIKE_TITLE_PATTERN.test(compact(project.projectName))) {
    return false;
  }

  if (COMPETITION_NOTICE_PATTERN.test(text)) {
    return false;
  }

  if (!project.id || isWeakSchool(project.schoolName) || /^【.*】/.test(compact(project.schoolName))) {
    return false;
  }

  if (!compact(project.projectName) || compact(project.projectName).length < 6 || !hasValidDeadlineDate(project.deadlineDate)) {
    return false;
  }

  return true;
}

function normalizeProject(row) {
  const rawTitle = cleanProjectTitle(row.projectName || row.project_name || row.project || row.title || '');
  const college = findCollegeFromText(`${row.schoolName || row.school_name || row.school || ''} ${rawTitle}`);
  const schoolName = isWeakSchool(row.schoolName || row.school_name || row.school)
    ? college?.name || '待识别院校'
    : compact(row.schoolName || row.school_name || row.school);
  const discipline = inferDiscipline(row.discipline, rawTitle);
  const deadlineFromTitle = extractLabeledDate(rawTitle, ['报名截止时间', '申请截止时间', '截止时间'], '23:59');
  const deadlineDate =
    deadlineFromTitle ||
    normalizeDateFragment(row.deadlineDate || row.deadline_date || row.deadline, '23:59') ||
    '';
  const publishDate =
    normalizeDateOnly(row.publishDate || row.publish_date || row.publishDateText) ||
    normalizeDateOnly(extractLabeledDate(rawTitle, ['通知发布时间', '发布时间'], '00:00')) ||
    deadlineDate.slice(0, 10);
  const deadlineLevel = inferDeadlineLevel(deadlineDate, row.status);
  const status = inferStatus(deadlineLevel, row.status);

  return {
    id: compact(row.id || row._id || row.sourceKey || row.source_key),
    schoolName,
    departmentName: compact(row.departmentName || row.department_name || row.department || ''),
    projectName: rawTitle || '通知标题待补充',
    projectType: inferProjectType(row.projectType || row.project_type || row.type, rawTitle),
    discipline,
    publishDate,
    deadlineDate,
    eventStartDate: normalizeDateOnly(row.eventStartDate || row.event_start_date || row.eventStart) || publishDate,
    eventEndDate: normalizeDateOnly(row.eventEndDate || row.event_end_date || row.eventEnd) || deadlineDate.slice(0, 10),
    applyLink: pickApplyLink(row),
    sourceLink: pickSourceLink(row),
    requirements: compact(row.requirements) || '以原通知申请条件为准，建议打开官网原文核对。',
    materialsRequired: toArray(row.materialsRequired || row.materials_required).length
      ? toArray(row.materialsRequired || row.materials_required)
      : ['以原通知材料要求为准'],
    examInterviewInfo: compact(row.examInterviewInfo || row.exam_interview_info) || '原通知未明确笔试 / 面试安排，建议以原文和后续邮件为准。',
    contactInfo: compact(row.contactInfo || row.contact_info) || '以原通知中的联系方式为准',
    remarks: compact(row.remarks || row.note) || '该项目由公开通知同步，建议结合原文再次确认关键时间和要求。',
    tags: normalizeTags(row.tags, college, discipline),
    status,
    year: Number(row.year || publishDate.slice(0, 4) || 2026),
    deadlineLevel,
    sourceSite: compact(row.sourceSite || row.source_site || row.crawlerTag || row.crawler_tag) || '院校公开通知自动同步',
    collectedAt: compact(row.collectedAt || row.collected_at || row.createTime) || '',
    updatedAt: compact(row.updatedAt || row.updated_at) || '',
    lastCheckedAt: compact(row.lastCheckedAt || row.last_checked_at) || '',
    isVerified: Boolean(row.isVerified ?? row.is_verified),
    changeLog: Array.isArray(row.changeLog || row.change_log) ? row.changeLog || row.change_log : [],
    historyRecords: Array.isArray(row.historyRecords || row.history_records) ? row.historyRecords || row.history_records : []
  };
}

function loadExportRows() {
  if (fs.existsSync(projectNoticesPath)) {
    return readJson(projectNoticesPath);
  }

  return readJson(calendarNoticesPath).filter((item) => item && (item.sourceKey || item.project || item.detailUrl));
}

function mapSupabaseNoticeRow(row) {
  const deadlineLevel = inferDeadlineLevel(row.deadline_date, row.status);
  const status = inferStatus(deadlineLevel, row.status);

  return normalizeProject({
    id: row.id,
    schoolName: row.school_name,
    departmentName: row.department_name,
    projectName: row.project_name,
    projectType: row.project_type,
    discipline: row.discipline,
    publishDate: row.publish_date,
    deadlineDate: row.deadline_date,
    eventStartDate: row.event_start_date,
    eventEndDate: row.event_end_date,
    applyLink: row.apply_link,
    sourceLink: row.source_link,
    requirements: row.requirements,
    materialsRequired: row.materials_required,
    examInterviewInfo: row.exam_interview_info,
    contactInfo: row.contact_info,
    remarks: row.remarks,
    tags: row.tags,
    status,
    year: row.year,
    deadlineLevel,
    sourceSite: row.source_site,
    collectedAt: row.collected_at,
    updatedAt: row.updated_at,
    lastCheckedAt: row.last_checked_at,
    isVerified: row.is_verified,
    changeLog: row.change_log,
    historyRecords: row.history_records
  });
}

async function fetchSupabaseNoticeRows() {
  loadLocalEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey || typeof fetch !== 'function') {
    return { ok: false, rows: [] };
  }

  const rows = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const endpoint = new URL('/rest/v1/notices', supabaseUrl);
    endpoint.searchParams.set(
      'select',
      [
        'id',
        'school_name',
        'department_name',
        'project_name',
        'project_type',
        'discipline',
        'publish_date',
        'deadline_date',
        'event_start_date',
        'event_end_date',
        'apply_link',
        'source_link',
        'requirements',
        'materials_required',
        'exam_interview_info',
        'contact_info',
        'remarks',
        'tags',
        'status',
        'year',
        'deadline_level',
        'source_site',
        'collected_at',
        'updated_at',
        'last_checked_at',
        'is_verified',
        'change_log',
        'history_records'
      ].join(',')
    );
    endpoint.searchParams.set('year', 'eq.2026');
    endpoint.searchParams.set('is_private', 'eq.false');
    endpoint.searchParams.set('admin_status', 'eq.published');
    endpoint.searchParams.set('admin_deleted_at', 'is.null');
    endpoint.searchParams.set('order', 'publish_date.desc,id.asc');
    endpoint.searchParams.set('limit', String(pageSize));
    endpoint.searchParams.set('offset', String(offset));

    const response = await fetch(endpoint, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`
      }
    });

    if (!response.ok) {
      console.warn(`Supabase notice sync skipped: ${response.status} ${await response.text()}`);
      return { ok: false, rows: [] };
    }

    const page = await response.json();
    if (!Array.isArray(page) || page.length === 0) {
      break;
    }

    rows.push(...page);
    if (page.length < pageSize) {
      break;
    }
  }

  return {
    ok: true,
    rows: rows
      .map(mapSupabaseNoticeRow)
      .filter((item) => item.year === 2026 && shouldKeepPublicNotice(item))
  };
}

const exportRows = loadExportRows()
  .map(normalizeProject)
  .filter((item) => item.year === 2026 && shouldKeepPublicNotice(item));
const supplementRows = readJson(dataPath)
  .filter((item) => String(item.id || '').startsWith('baoyantongzhi-'))
  .map(normalizeProject)
  .filter((item) => item.year === 2026 && shouldKeepPublicNotice(item));
const supabaseResult = await fetchSupabaseNoticeRows();
const supabaseRows = supabaseResult.rows;

const merged = new Map();
if (supabaseResult.ok) {
  supabaseRows.forEach((item) => merged.set(item.id, item));
} else {
  exportRows.forEach((item) => merged.set(item.id, item));
  supplementRows.forEach((item) => merged.set(item.id, item));
}

const result = Array.from(merged.values()).map((item) => ({
  ...item,
  projectName: cleanProjectTitle(item.projectName) || '通知标题待补充'
})).filter(shouldKeepPublicNotice).sort((left, right) => {
  const publishCompare = right.publishDate.localeCompare(left.publishDate);
  if (publishCompare !== 0) {
    return publishCompare;
  }

  return left.deadlineDate.localeCompare(right.deadlineDate);
});

fs.writeFileSync(dataPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

console.log(
  JSON.stringify(
    {
      exportRows: exportRows.length,
      supplements: supplementRows.length,
      supabaseRows: supabaseRows.length,
      output: result.length,
      dataPath
    },
    null,
    2
  )
);
