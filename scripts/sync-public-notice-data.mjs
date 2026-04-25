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

function readJson(filePath, fallback = []) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
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
  return !text || text === '???' || text === '其他' || text === '待补充' || /^20\d{2}年大学$/.test(text);
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
  if (/预推免|预报名/.test(text)) return '预推免';
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

  if (diffDays < 0 || text.includes('已截止') || text.includes('已结束')) return 'expired';
  if (diffDays <= 1) return 'today';
  if (diffDays <= 3) return 'within3days';
  if (diffDays <= 7) return 'within7days';
  return 'future';
}

function inferStatus(deadlineLevel, rawStatus) {
  const status = compact(rawStatus);
  if (['未开始', '报名中', '即将截止', '已截止', '活动中', '已结束'].includes(status)) {
    return status;
  }

  if (deadlineLevel === 'expired') return '已截止';
  if (deadlineLevel === 'today' || deadlineLevel === 'within3days' || deadlineLevel === 'within7days') return '即将截止';
  return '报名中';
}

function normalizeTags(tags, college, discipline) {
  const base = toArray(tags)
    .map(compact)
    .filter((item) => item && item !== '???' && !INTERNAL_TAG_PATTERN.test(item) && !NOISY_TAG_PATTERN.test(item));

  return unique([...(college?.levels || []), college?.city || '', discipline, ...base]).slice(0, 8);
}

function normalizeProject(row) {
  const rawTitle = compact(row.projectName || row.project_name || row.project || row.title || '');
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
    applyLink: compact(row.applyLink || row.apply_link || row.applyUrl || row.apply_url || row.sourceLink || row.source_link),
    sourceLink: compact(row.sourceLink || row.source_link || row.detailUrl || row.detail_url || row.applyLink || row.apply_link),
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

const exportRows = loadExportRows().map(normalizeProject).filter((item) => item.id && item.year === 2026);
const supplementRows = readJson(dataPath)
  .filter((item) => String(item.id || '').startsWith('baoyantongzhi-'))
  .map(normalizeProject)
  .filter((item) => item.id && item.year === 2026);

const merged = new Map();
exportRows.forEach((item) => merged.set(item.id, item));
supplementRows.forEach((item) => merged.set(item.id, item));

const result = Array.from(merged.values()).sort((left, right) => {
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
      output: result.length,
      dataPath
    },
    null,
    2
  )
);
