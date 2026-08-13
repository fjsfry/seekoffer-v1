const RESULT_PATTERNS = /入营名单|入选名单|入围名单|营员名单|优秀营员|考核结果|录取名单|拟录取|结果公示|通过名单/;
const PRESENTATION_PATTERNS = /宣讲会|招生宣讲|线上宣讲|线下宣讲|说明会|开放日|交流会|项目介绍会/;
const SUMMER_PATTERNS = /夏令营|暑期学校|暑期项目|科创营|科学营|交流营|研学营/;
const PRE_RECOMMENDATION_PATTERNS = /预推免|推免预报名|预接收|预报名.*推免|推荐免试(?:研究生)?预报名/;
const FORMAL_RECOMMENDATION_PATTERNS = /正式推免|全国推免系统|推免服务系统|九推|接收推荐免试|接收推免|推免.*复试|推荐免试.*复试/;

const PROGRAM_MARKERS = [
  ['mpacc', /MPAcc|会计专硕|会计硕士/i],
  ['master', /硕士研究生|硕士生|硕士项目|硕士招生/],
  ['direct-phd', /直博生|直博项目|直接攻博|直博/],
  ['phd', /博士研究生|博士生|博士项目|博士招生/],
  ['joint', /联合培养|联培/],
  ['school-wide', /校级|全校/],
  ['professional', /专业学位|专硕/],
  ['academic', /学术学位|学硕/],
  ['part-time', /非全日制/],
  ['full-time', /全日制/]
];

const GENERIC_TITLE_WORDS = [
  /20\d{2}年?/g,
  /全国优秀大学生/g,
  /优秀大学生/g,
  /推荐免试研究生/g,
  /推荐免试/g,
  /夏令营/g,
  /预推免/g,
  /暑期学校/g,
  /报名通知/g,
  /招生通知/g,
  /活动通知/g,
  /工作通知/g,
  /通知/g,
  /招生简章/g,
  /简章/g,
  /关于/g,
  /举办/g,
  /开展/g
];

export function normalizeSyncText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function getXingkePublishTimestamp(record) {
  return normalizeSyncText(record?.created_at || record?.updated_at || record?.signup_start);
}

export function isRetryableIngestStatus(status) {
  const code = Number(status);
  return code === 408 || code === 425 || code === 429 || (code >= 500 && code <= 599);
}

export function inferProjectType(...values) {
  const text = values.map(normalizeSyncText).join(' ');

  if (/admission_list|result_notice|camp_result/i.test(text)) return '入营名单';
  if (/presentation|open_day|information_session/i.test(text)) return '宣讲会';
  if (/summer_camp|summer_school/i.test(text)) return '夏令营';
  if (/pre_recommendation|pre_admission/i.test(text)) return '预推免';
  if (/formal_recommendation|national_recommendation/i.test(text)) return '正式推免';
  if (RESULT_PATTERNS.test(text)) return '入营名单';
  if (PRESENTATION_PATTERNS.test(text)) return '宣讲会';
  if (SUMMER_PATTERNS.test(text)) return '夏令营';
  if (PRE_RECOMMENDATION_PATTERNS.test(text)) return '预推免';
  if (/九推/.test(text)) return '九推';
  if (FORMAL_RECOMMENDATION_PATTERNS.test(text)) return '正式推免';
  return '推免';
}

export function inferNoticeKind(...values) {
  const text = values.map(normalizeSyncText).join(' ');

  if (RESULT_PATTERNS.test(text)) return '结果公示';
  if (/补录|递补/.test(text)) return '补录通知';
  if (PRESENTATION_PATTERNS.test(text)) return '宣讲活动';
  if (/导师直招|课题组直招|实验室直招/.test(text)) return '导师直招';
  if (/报名|申请|招收|招生|接收/.test(text)) return '招生通知';
  return '信息通知';
}

function chinaReferenceParts(referenceDate) {
  const match = normalizeSyncText(referenceDate).match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3])
    };
  }

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day)
  };
}

function normalizeHour(hourValue, period) {
  let hour = Number(hourValue || 23);
  if (/下午|晚上/.test(period) && hour < 12) hour += 12;
  if (period === '中午' && hour < 11) hour += 12;
  if (period === '凌晨' && hour === 12) hour = 0;
  if (hour >= 24) hour = 23;
  return Math.max(0, Math.min(23, hour));
}

function formatDateCandidate(candidate, reference) {
  let year = candidate.year ? Number(candidate.year) : reference.year;
  const month = Number(candidate.month);
  const day = Number(candidate.day);

  if (!candidate.year && reference.month >= 10 && month <= 3) {
    year += 1;
  }

  const hour = normalizeHour(candidate.hour, candidate.period || '');
  const minute = Math.max(0, Math.min(59, Number(candidate.minute ?? 59)));
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return '';
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function extractDateCandidates(fragment, referenceDate) {
  const reference = chinaReferenceParts(referenceDate);
  const matches = [];
  const pattern = /(?:(20\d{2})\s*[年./-]\s*)?(\d{1,2})\s*(月|[./-])\s*(\d{1,2})\s*日?(?:\s*(?:(上午|下午|晚上|中午|凌晨)\s*(\d{1,2})(?:\s*[:：点时]\s*(\d{1,2}))?\s*分?|(\d{1,2})\s*[:：]\s*(\d{1,2})|(\d{1,2})\s*[点时](?:\s*(\d{1,2})\s*分?)?))?/g;
  let match;

  while ((match = pattern.exec(fragment)) !== null) {
    const [
      ,
      year,
      month,
      separator,
      day,
      period,
      periodHour,
      periodMinute,
      colonHour,
      colonMinute,
      pointHour,
      pointMinute
    ] = match;
    const hour = periodHour || colonHour || pointHour;
    const minute = periodMinute || colonMinute || pointMinute;
    if (!year && separator !== '月' && !/[日号]/.test(match[0]) && !/[截止截至前]/.test(fragment)) {
      continue;
    }

    const value = formatDateCandidate(
      {
        year,
        month,
        day,
        period,
        hour,
        minute
      },
      reference
    );

    if (value) matches.push(value);
  }

  return matches;
}

function chooseDeadline(candidates, referenceDate) {
  const uniqueCandidates = [...new Set(candidates)].sort();
  if (!uniqueCandidates.length) return '';

  const reference = normalizeSyncText(referenceDate).slice(0, 10);
  const plausible = reference
    ? uniqueCandidates.filter((candidate) => candidate.slice(0, 10) >= reference)
    : uniqueCandidates;
  return (plausible.length ? plausible : uniqueCandidates)[0];
}

export function extractDeadlineFromText(text, referenceDate = '') {
  const source = normalizeSyncText(text)
    .replace(/[﹣－]/g, '-')
    .replace(/[～〜]/g, '~');
  if (!source || /长期有效|常年招生|额满即止|招满即止/.test(source) && !/截止|截至/.test(source)) {
    return '';
  }

  const segments = [];
  const patterns = [
    /(?:报名|申请|材料提交|提交材料|网上填报|系统填报)[^。；;！？!\n]{0,140}/g,
    /(?:截止(?:时间|日期)?|截至|截止至|截止到)[^。；;！？!\n]{0,90}/g,
    /(?:请于|须于|需于|应于|务必于)[^。；;！？!\n]{0,90}(?:前|之前|截止前)/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      segments.push(match[0]);
    }
  }

  const candidates = [];
  for (const segment of segments) {
    if (!/截止|截至|时间|期限|请于|须于|需于|应于|务必于|至|到/.test(segment)) continue;
    const dates = extractDateCandidates(segment, referenceDate);
    if (!dates.length) continue;

    const isRange = /(?:至|到|—|~)/.test(segment) && dates.length > 1;
    candidates.push(isRange ? dates.at(-1) : dates[0]);
  }

  return chooseDeadline(candidates.filter(Boolean), referenceDate);
}

export function normalizeComparableUrl(value) {
  const text = normalizeSyncText(value);
  if (!text) return '';

  try {
    const url = new URL(text);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_.+|spm|from|source|share_.+|timestamp|t)$/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
    return url.toString().replace(/\?$/, '');
  } catch {
    return '';
  }
}

function canonicalIdentity(value) {
  return normalizeSyncText(value)
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

export function normalizeCanonicalTitle(value) {
  let text = normalizeSyncText(value).toLowerCase();
  for (const pattern of GENERIC_TITLE_WORDS) {
    text = text.replace(pattern, '');
  }
  return text.replace(/[\s\p{P}\p{S}]/gu, '');
}

function markerSet(text) {
  return new Set(PROGRAM_MARKERS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name));
}

function hasConflictingProgramMarkers(leftText, rightText) {
  const left = markerSet(leftText);
  const right = markerSet(rightText);
  if (!left.size || !right.size) return false;

  const conflictGroups = [
    ['mpacc', 'master', 'direct-phd', 'phd'],
    ['joint', 'school-wide'],
    ['professional', 'academic'],
    ['part-time', 'full-time']
  ];

  return conflictGroups.some((group) => {
    const leftMarkers = group.filter((marker) => left.has(marker));
    const rightMarkers = group.filter((marker) => right.has(marker));
    return leftMarkers.length && rightMarkers.length && !leftMarkers.some((marker) => right.has(marker));
  });
}

function bigrams(value) {
  if (value.length < 2) return value ? [value] : [];
  const result = [];
  for (let index = 0; index < value.length - 1; index += 1) {
    result.push(value.slice(index, index + 2));
  }
  return result;
}

function diceSimilarity(left, right) {
  if (!left || !right) return 0;
  if (left === right) return 1;

  const leftPairs = bigrams(left);
  const rightPairs = bigrams(right);
  const counts = new Map();
  for (const pair of leftPairs) counts.set(pair, (counts.get(pair) || 0) + 1);

  let overlap = 0;
  for (const pair of rightPairs) {
    const remaining = counts.get(pair) || 0;
    if (remaining > 0) {
      overlap += 1;
      counts.set(pair, remaining - 1);
    }
  }

  return (2 * overlap) / (leftPairs.length + rightPairs.length);
}

function stageFamily(project) {
  const type = normalizeSyncText(project.project_type);
  if (type === '夏令营') return 'summer';
  if (type === '预推免') return 'pre';
  if (type === '入营名单') return 'result';
  if (type === '宣讲会') return 'presentation';
  if (type === '正式推免' || type === '推免' || type === '九推') return 'recommendation';
  return '';
}

export function areLikelyDuplicateNotices(left, right) {
  const leftSource = normalizeComparableUrl(left?.source_link);
  const rightSource = normalizeComparableUrl(right?.source_link);
  if (leftSource && rightSource && leftSource === rightSource) return true;

  const leftSchool = canonicalIdentity(left?.school_name);
  const rightSchool = canonicalIdentity(right?.school_name);
  if (!leftSchool || !rightSchool || leftSchool !== rightSchool) return false;

  const leftTitleText = normalizeSyncText(left?.project_name);
  const rightTitleText = normalizeSyncText(right?.project_name);
  if (hasConflictingProgramMarkers(leftTitleText, rightTitleText)) return false;

  const leftStage = stageFamily(left || {});
  const rightStage = stageFamily(right || {});
  if (leftStage && rightStage && leftStage !== rightStage) return false;

  const leftTitle = normalizeCanonicalTitle(leftTitleText);
  const rightTitle = normalizeCanonicalTitle(rightTitleText);
  if (!leftTitle || !rightTitle) return false;
  if (leftTitle === rightTitle) return true;

  const similarity = diceSimilarity(leftTitle, rightTitle);
  if (similarity >= 0.92) return true;

  const leftDepartment = canonicalIdentity(left?.department_name);
  const rightDepartment = canonicalIdentity(right?.department_name);
  const sameDepartment = leftDepartment && rightDepartment && leftDepartment === rightDepartment;
  const leftDeadline = normalizeSyncText(left?.deadline_date).slice(0, 10);
  const rightDeadline = normalizeSyncText(right?.deadline_date).slice(0, 10);
  const sameDeadline = leftDeadline && rightDeadline && leftDeadline === rightDeadline;

  return Boolean(sameDepartment && sameDeadline && similarity >= 0.82);
}
