import { deflateSync } from 'node:zlib';

const CATEGORY_ORDER = ['预推免', '夏令营', '开放日与宣讲', '名单与结果', '其他通知'];
const DEFAULT_SITE_URL = 'https://www.seekoffer.com.cn';
const DEFAULT_MAX_CONTENT_CHARS = 18_000;
const WECHAT_STABLE_TOKEN_URL = 'https://api.weixin.qq.com/cgi-bin/stable_token';
const WECHAT_UPLOAD_MATERIAL_URL = 'https://api.weixin.qq.com/cgi-bin/material/add_material';
const WECHAT_ADD_DRAFT_URL = 'https://api.weixin.qq.com/cgi-bin/draft/add';

export class DigestError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'DigestError';
    this.code = code;
    this.details = details;
  }
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function escapeHtml(value) {
  return compactText(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function validateDateString(value) {
  const text = compactText(value);
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(text)) {
    return false;
  }

  const timestamp = Date.parse(`${text}T00:00:00+08:00`);
  return Number.isFinite(timestamp);
}

export function getBeijingDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value || '';

  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function resolveTargetDate(event = {}, now = new Date()) {
  const requested = compactText(event.targetDate || event.target_date);
  if (!requested) {
    return getBeijingDateString(now);
  }

  if (!validateDateString(requested)) {
    throw new DigestError('invalid_target_date', `Invalid target date: ${requested}`);
  }

  return requested;
}

function formatMonthDay(targetDate) {
  const [, month, day] = targetDate.split('-');
  return `${Number(month)}月${Number(day)}日`;
}

function normalizeDeadline(value) {
  const text = compactText(value).replace('T', ' ').replace(/:00$/, '');
  return text || '以院校通知为准';
}

function normalizeTitle(notice, targetDate) {
  const original = compactText(notice.project_name || notice.projectName);
  const school = compactText(notice.school_name || notice.schoolName);
  const year = targetDate.slice(0, 4);
  let title = original;

  for (const prefix of [`${year}年${school}`, school, `${year}年`]) {
    if (prefix && title.startsWith(prefix)) {
      title = title.slice(prefix.length).replace(/^[：:·\-—\s]+/, '');
      break;
    }
  }

  return title || original || '通知标题待补充';
}

export function classifyNotice(notice) {
  const text = [notice.project_name, notice.projectName, notice.project_type, notice.projectType]
    .map(compactText)
    .join(' ');

  if (/推免|免试|预报名/.test(text)) return '预推免';
  if (/入营|录取|拟录取|名单|考核结果/.test(text)) return '名单与结果';
  if (/开放日|宣讲|说明会/.test(text)) return '开放日与宣讲';
  if (/夏令营|冬令营|春令营/.test(text)) return '夏令营';
  return '其他通知';
}

function normalizeNotices(notices, targetDate) {
  const byId = new Map();

  for (const item of Array.isArray(notices) ? notices : []) {
    const id = compactText(item.id);
    const schoolName = compactText(item.school_name || item.schoolName);
    const projectName = compactText(item.project_name || item.projectName);
    const publishDate = compactText(item.publish_date || item.publishDate).slice(0, 10);

    if (!id || !schoolName || !projectName || publishDate !== targetDate) {
      continue;
    }

    byId.set(id, {
      id,
      schoolName,
      departmentName: compactText(item.department_name || item.departmentName),
      projectName: normalizeTitle(item, targetDate),
      projectType: compactText(item.project_type || item.projectType),
      publishDate,
      deadlineDate: normalizeDeadline(item.deadline_date || item.deadlineDate),
      applyLink: compactText(item.apply_link || item.applyLink),
      sourceLink: compactText(item.source_link || item.sourceLink),
      category: classifyNotice(item)
    });
  }

  return Array.from(byId.values()).sort((left, right) => {
    const categoryDelta = CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category);
    if (categoryDelta !== 0) return categoryDelta;

    const deadlineDelta = left.deadlineDate.localeCompare(right.deadlineDate, 'zh-CN');
    if (deadlineDelta !== 0) return deadlineDelta;

    return left.schoolName.localeCompare(right.schoolName, 'zh-CN');
  });
}

function buildCategoryHeader(category, count) {
  return [
    '<section style="margin:26px 0 12px;">',
    `<p style="margin:0;font-size:18px;font-weight:700;color:#102a43;">${escapeHtml(category)}`,
    `<span style="margin-left:8px;font-size:12px;font-weight:500;color:#537188;">${count} 条</span></p>`,
    '<div style="width:40px;height:3px;margin-top:7px;background:#c18a49;border-radius:999px;"></div>',
    '</section>'
  ].join('');
}

function buildNoticeCard(notice, index) {
  const identity = notice.departmentName
    ? `${notice.schoolName} · ${notice.departmentName}`
    : notice.schoolName;

  return [
    '<section style="margin:0 0 12px;padding:14px 15px;border:1px solid #e8edf1;border-radius:10px;background:#ffffff;">',
    `<p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#17324d;">${index}. ${escapeHtml(identity)}</p>`,
    `<p style="margin:0 0 7px;font-size:14px;line-height:1.75;color:#34495e;">${escapeHtml(notice.projectName)}</p>`,
    `<p style="margin:0;font-size:13px;color:#9a5f1f;"><strong>截止：</strong>${escapeHtml(notice.deadlineDate)}</p>`,
    '</section>'
  ].join('');
}

function normalizeSiteUrl(value) {
  const candidate = compactText(value) || DEFAULT_SITE_URL;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    return url.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function buildDailyDigest(rawNotices, targetDate, options = {}) {
  if (!validateDateString(targetDate)) {
    throw new DigestError('invalid_target_date', `Invalid target date: ${targetDate}`);
  }

  const notices = normalizeNotices(rawNotices, targetDate);
  const siteUrl = normalizeSiteUrl(options.siteUrl);
  const maxContentChars = Math.max(8_000, Number(options.maxContentChars) || DEFAULT_MAX_CONTENT_CHARS);
  const categoryCounts = Object.fromEntries(
    CATEGORY_ORDER.map((category) => [category, notices.filter((notice) => notice.category === category).length])
  );
  const categories = CATEGORY_ORDER.filter((category) => categoryCounts[category] > 0);
  const sourceUrl = `${siteUrl}/notices/?date=${encodeURIComponent(targetDate)}&year=${targetDate.slice(0, 4)}&sort=publish`;
  const title = `${formatMonthDay(targetDate)}保研通知汇总｜新增${notices.length}条`;
  const categorySummary = categories.length ? categories.join('、') : '保研通知';
  const digest = `${formatMonthDay(targetDate)}新增${notices.length}条，涵盖${categorySummary}。院校要求可能调整，请以原通知为准。`;
  const header = [
    '<section style="font-size:15px;line-height:1.8;color:#2f4050;letter-spacing:0.02em;">',
    '<section style="padding:18px 16px;border-radius:12px;background:#f5f1e8;">',
    `<p style="margin:0 0 4px;font-size:13px;color:#8a6a42;">SEEK OFFER DAILY · ${escapeHtml(targetDate)}</p>`,
    `<p style="margin:0;font-size:20px;font-weight:700;color:#17324d;">今日新增 ${notices.length} 条保研通知</p>`,
    '<p style="margin:8px 0 0;font-size:13px;color:#617487;">已按通知类型整理；申请条件、时间和材料请以院校原文为准。</p>',
    '</section>'
  ].join('');
  const footerReserve = 900;
  let content = header;
  let currentCategory = '';
  let includedCount = 0;

  for (const notice of notices) {
    const categoryHeader = notice.category === currentCategory
      ? ''
      : buildCategoryHeader(notice.category, categoryCounts[notice.category]);
    const card = buildNoticeCard(notice, includedCount + 1);

    if (content.length + categoryHeader.length + card.length + footerReserve > maxContentChars) {
      break;
    }

    content += categoryHeader + card;
    currentCategory = notice.category;
    includedCount += 1;
  }

  const omittedCount = notices.length - includedCount;
  if (omittedCount > 0) {
    content += `<p style="margin:18px 0;padding:12px 14px;border-radius:8px;background:#fff7ea;color:#8a5a1f;">篇幅有限，另有 ${omittedCount} 条通知未在正文展开，点击“阅读原文”可查看完整列表。</p>`;
  }

  content += [
    '<section style="margin-top:24px;padding:15px;border-radius:10px;background:#eef4f6;">',
    '<p style="margin:0 0 5px;font-weight:700;color:#17324d;">使用提醒</p>',
    '<p style="margin:0;font-size:13px;color:#52697a;">通知可能临时调整或提前关闭，请尽早打开院校原文核对，并自行确认报名资格。</p>',
    '</section>',
    '<p style="margin:24px 0 0;text-align:center;font-size:12px;color:#93a1ad;">寻鹿 SeekOffer · 让保研信息更清晰</p>',
    '</section>'
  ].join('');

  return {
    targetDate,
    notices,
    noticeCount: notices.length,
    includedCount,
    omittedCount,
    categoryCounts,
    title,
    digest: digest.slice(0, 120),
    content,
    contentLength: content.length,
    sourceUrl
  };
}

export function buildCoverSvg(digest) {
  const safeDate = escapeHtml(digest.targetDate);
  const safeCount = escapeHtml(String(digest.noticeCount));

  return `
    <svg width="900" height="383" viewBox="0 0 900 383" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#102a43"/>
          <stop offset="1" stop-color="#2e5968"/>
        </linearGradient>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#d7ae6f"/>
          <stop offset="1" stop-color="#f0d9a8"/>
        </linearGradient>
      </defs>
      <rect width="900" height="383" rx="28" fill="url(#bg)"/>
      <circle cx="820" cy="52" r="170" fill="#ffffff" opacity="0.04"/>
      <circle cx="770" cy="350" r="120" fill="#d7ae6f" opacity="0.08"/>
      <rect x="62" y="60" width="74" height="8" rx="4" fill="url(#gold)"/>
      <text x="62" y="125" font-family="Arial, sans-serif" font-size="26" font-weight="700" letter-spacing="5" fill="#f0d9a8">SEEK OFFER</text>
      <text x="62" y="203" font-family="Arial, sans-serif" font-size="56" font-weight="800" letter-spacing="2" fill="#ffffff">DAILY BRIEF</text>
      <text x="66" y="260" font-family="Arial, sans-serif" font-size="24" font-weight="500" letter-spacing="3" fill="#c8d8df">${safeDate}</text>
      <rect x="610" y="132" width="220" height="124" rx="22" fill="#ffffff" opacity="0.10"/>
      <text x="720" y="195" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="800" fill="#ffffff">${safeCount}</text>
      <text x="720" y="230" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" letter-spacing="3" fill="#f0d9a8">NEW NOTICES</text>
      <text x="62" y="335" font-family="Arial, sans-serif" font-size="15" letter-spacing="2" fill="#9fb5c0">seekoffer.com.cn</text>
    </svg>
  `.trim();
}

function supabaseHeaders(env, extra = {}) {
  const key = compactText(env.SUPABASE_SERVICE_ROLE_KEY);
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

async function requestJson(fetchImpl, url, options, code) {
  const response = await fetchImpl(url, options);
  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new DigestError(code, `${code}: HTTP ${response.status}`, {
      status: response.status,
      payload
    });
  }

  return payload;
}

function requireEnv(env, names) {
  const missing = names.filter((name) => !compactText(env[name]));
  if (missing.length) {
    throw new DigestError('missing_env', `Missing environment variables: ${missing.join(', ')}`);
  }
}

async function fetchDailyNotices(fetchImpl, env, targetDate) {
  requireEnv(env, ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  const baseUrl = compactText(env.SUPABASE_URL).replace(/\/$/, '');
  const params = new URLSearchParams({
    select: 'id,school_name,department_name,project_name,project_type,publish_date,deadline_date,apply_link,source_link',
    publish_date: `eq.${targetDate}`,
    admin_status: 'eq.published',
    is_private: 'eq.false',
    admin_deleted_at: 'is.null',
    order: 'project_type.asc,deadline_date.asc,school_name.asc'
  });

  return requestJson(
    fetchImpl,
    `${baseUrl}/rest/v1/notices?${params.toString()}`,
    { method: 'GET', headers: supabaseHeaders(env) },
    'notices_query_failed'
  );
}

async function getExistingPublication(fetchImpl, env, targetDate) {
  const baseUrl = compactText(env.SUPABASE_URL).replace(/\/$/, '');
  const params = new URLSearchParams({
    select: '*',
    digest_date: `eq.${targetDate}`,
    limit: '1'
  });
  const rows = await requestJson(
    fetchImpl,
    `${baseUrl}/rest/v1/wechat_daily_publications?${params.toString()}`,
    { method: 'GET', headers: supabaseHeaders(env) },
    'publication_lookup_failed'
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function insertPublicationLock(fetchImpl, env, payload) {
  const baseUrl = compactText(env.SUPABASE_URL).replace(/\/$/, '');
  const response = await fetchImpl(`${baseUrl}/rest/v1/wechat_daily_publications`, {
    method: 'POST',
    headers: supabaseHeaders(env, { Prefer: 'return=minimal' }),
    body: JSON.stringify(payload)
  });

  if (response.status === 409) return false;
  if (!response.ok) {
    const text = await response.text();
    throw new DigestError('publication_lock_failed', `Unable to claim digest date: HTTP ${response.status}`, text);
  }
  return true;
}

async function updatePublication(fetchImpl, env, targetDate, patch) {
  const baseUrl = compactText(env.SUPABASE_URL).replace(/\/$/, '');
  const params = new URLSearchParams({ digest_date: `eq.${targetDate}` });
  return requestJson(
    fetchImpl,
    `${baseUrl}/rest/v1/wechat_daily_publications?${params.toString()}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders(env, { Prefer: 'return=minimal' }),
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
    },
    'publication_update_failed'
  );
}

async function getWechatAccessToken(fetchImpl, env) {
  requireEnv(env, ['WECHAT_MP_APP_ID', 'WECHAT_MP_APP_SECRET']);
  const payload = await requestJson(
    fetchImpl,
    WECHAT_STABLE_TOKEN_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credential',
        appid: compactText(env.WECHAT_MP_APP_ID),
        secret: compactText(env.WECHAT_MP_APP_SECRET),
        force_refresh: false
      })
    },
    'wechat_token_failed'
  );

  if (!payload?.access_token) {
    throw new DigestError(
      String(payload?.errcode || 'wechat_token_missing'),
      compactText(payload?.errmsg) || 'WeChat did not return an access token',
      payload
    );
  }
  return payload.access_token;
}

const PIXEL_FONT = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100']
};

let crcTable;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    return value >>> 0;
  });
  return crcTable;
}

function crc32(buffer) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const chunk = Buffer.allocUnsafe(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), data.length + 8);
  return chunk;
}

function fillRect(pixels, width, height, x, y, rectWidth, rectHeight, color, alpha = 1) {
  const startX = Math.max(0, Math.floor(x));
  const startY = Math.max(0, Math.floor(y));
  const endX = Math.min(width, Math.ceil(x + rectWidth));
  const endY = Math.min(height, Math.ceil(y + rectHeight));

  for (let py = startY; py < endY; py += 1) {
    for (let px = startX; px < endX; px += 1) {
      const offset = (py * width + px) * 4;
      pixels[offset] = Math.round(pixels[offset] * (1 - alpha) + color[0] * alpha);
      pixels[offset + 1] = Math.round(pixels[offset + 1] * (1 - alpha) + color[1] * alpha);
      pixels[offset + 2] = Math.round(pixels[offset + 2] * (1 - alpha) + color[2] * alpha);
      pixels[offset + 3] = 255;
    }
  }
}

function pixelTextWidth(text, scale) {
  return Math.max(0, String(text).length * 6 * scale - scale);
}

function drawPixelText(pixels, width, height, text, x, y, scale, color) {
  let cursorX = x;
  for (const character of String(text).toUpperCase()) {
    const glyph = PIXEL_FONT[character] || PIXEL_FONT[' '];
    glyph.forEach((row, rowIndex) => {
      for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
        if (row[columnIndex] === '1') {
          fillRect(
            pixels,
            width,
            height,
            cursorX + columnIndex * scale,
            y + rowIndex * scale,
            scale,
            scale,
            color
          );
        }
      }
    });
    cursorX += 6 * scale;
  }
}

function encodePng(width, height, pixels) {
  const scanlineSize = width * 4 + 1;
  const scanlines = Buffer.allocUnsafe(scanlineSize * height);
  for (let y = 0; y < height; y += 1) {
    const scanlineOffset = y * scanlineSize;
    scanlines[scanlineOffset] = 0;
    pixels.copy(scanlines, scanlineOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

export function renderCoverPng(digest) {
  const width = 900;
  const height = 383;
  const pixels = Buffer.allocUnsafe(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const progress = (x + y) / (width + height - 2);
      const offset = (y * width + x) * 4;
      pixels[offset] = Math.round(16 + 30 * progress);
      pixels[offset + 1] = Math.round(42 + 47 * progress);
      pixels[offset + 2] = Math.round(67 + 37 * progress);
      pixels[offset + 3] = 255;
    }
  }

  fillRect(pixels, width, height, 62, 60, 74, 8, [240, 217, 168]);
  fillRect(pixels, width, height, 610, 132, 220, 124, [255, 255, 255], 0.1);
  drawPixelText(pixels, width, height, 'SEEK OFFER', 62, 99, 4, [240, 217, 168]);
  drawPixelText(pixels, width, height, 'DAILY BRIEF', 62, 158, 8, [255, 255, 255]);
  drawPixelText(pixels, width, height, digest.targetDate, 66, 248, 4, [200, 216, 223]);
  drawPixelText(pixels, width, height, 'NEW NOTICES', 650, 224, 2, [240, 217, 168]);
  drawPixelText(pixels, width, height, 'SEEKOFFER.COM.CN', 62, 328, 2, [159, 181, 192]);

  const countText = String(digest.noticeCount);
  const countScale = countText.length >= 3 ? 7 : 9;
  drawPixelText(
    pixels,
    width,
    height,
    countText,
    720 - pixelTextWidth(countText, countScale) / 2,
    153,
    countScale,
    [255, 255, 255]
  );

  return encodePng(width, height, pixels);
}

async function uploadCover(fetchImpl, accessToken, digest) {
  const coverBuffer = await renderCoverPng(digest);
  const form = new FormData();
  form.append('media', new Blob([coverBuffer], { type: 'image/png' }), `seekoffer-${digest.targetDate}.png`);
  const url = `${WECHAT_UPLOAD_MATERIAL_URL}?access_token=${encodeURIComponent(accessToken)}&type=image`;
  const payload = await requestJson(fetchImpl, url, { method: 'POST', body: form }, 'wechat_cover_upload_failed');

  if (!payload?.media_id) {
    throw new DigestError(
      String(payload?.errcode || 'wechat_cover_media_missing'),
      compactText(payload?.errmsg) || 'WeChat did not return a cover media id',
      payload
    );
  }
  return payload.media_id;
}

async function addWechatDraft(fetchImpl, accessToken, env, digest, thumbMediaId) {
  const url = `${WECHAT_ADD_DRAFT_URL}?access_token=${encodeURIComponent(accessToken)}`;
  const payload = await requestJson(
    fetchImpl,
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articles: [
          {
            article_type: 'news',
            title: digest.title,
            author: compactText(env.WECHAT_DAILY_AUTHOR) || '寻鹿SeekOffer',
            digest: digest.digest,
            content: digest.content,
            content_source_url: digest.sourceUrl,
            thumb_media_id: thumbMediaId,
            show_cover_pic: 1,
            need_open_comment: 0,
            only_fans_can_comment: 0
          }
        ]
      })
    },
    'wechat_draft_failed'
  );

  if (!payload?.media_id) {
    throw new DigestError(
      String(payload?.errcode || 'wechat_draft_media_missing'),
      compactText(payload?.errmsg) || 'WeChat did not return a draft media id',
      payload
    );
  }
  return payload.media_id;
}

function booleanValue(value) {
  return value === true || ['1', 'true', 'yes'].includes(compactText(value).toLowerCase());
}

export async function runDailyDigest({
  event = {},
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = new Date()
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new DigestError('fetch_unavailable', 'A fetch implementation is required');
  }

  const targetDate = resolveTargetDate(event, now);
  const dryRun = booleanValue(event.dryRun ?? event.dry_run ?? env.WECHAT_DAILY_DRY_RUN);
  const force = booleanValue(event.force);
  const suppliedNotices = dryRun && Array.isArray(event.notices) ? event.notices : null;
  const rawNotices = suppliedNotices || await fetchDailyNotices(fetchImpl, env, targetDate);
  const digest = buildDailyDigest(rawNotices, targetDate, {
    siteUrl: env.SEEKOFFER_SITE_URL || env.NEXT_PUBLIC_SITE_URL,
    maxContentChars: env.WECHAT_DAILY_MAX_CONTENT_CHARS
  });

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      targetDate,
      noticeCount: digest.noticeCount,
      includedCount: digest.includedCount,
      omittedCount: digest.omittedCount,
      article: {
        title: digest.title,
        digest: digest.digest,
        content: digest.content,
        contentLength: digest.contentLength,
        sourceUrl: digest.sourceUrl
      }
    };
  }

  requireEnv(env, ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'WECHAT_MP_APP_ID', 'WECHAT_MP_APP_SECRET']);
  const existing = await getExistingPublication(fetchImpl, env, targetDate);

  if (existing && !force) {
    return {
      ok: existing.status === 'drafted' || existing.status === 'skipped',
      skipped: true,
      reason: `already_${existing.status}`,
      targetDate,
      noticeCount: Number(existing.notice_count || 0),
      mediaId: compactText(existing.wechat_media_id)
    };
  }

  const lockPayload = {
    digest_date: targetDate,
    status: 'preparing',
    notice_count: digest.noticeCount,
    included_notice_count: digest.includedCount,
    notice_ids: digest.notices.map((notice) => notice.id),
    article_title: digest.title,
    article_digest: digest.digest,
    content_source_url: digest.sourceUrl,
    content_html: digest.content,
    error_code: '',
    error_message: '',
    metadata: {
      omittedCount: digest.omittedCount,
      categoryCounts: digest.categoryCounts,
      forced: force
    }
  };

  let claimed = false;
  if (existing && force) {
    await updatePublication(fetchImpl, env, targetDate, lockPayload);
    claimed = true;
  } else {
    claimed = await insertPublicationLock(fetchImpl, env, lockPayload);
  }

  if (!claimed) {
    const winner = await getExistingPublication(fetchImpl, env, targetDate);
    return {
      ok: winner?.status === 'drafted' || winner?.status === 'skipped',
      skipped: true,
      reason: `already_${winner?.status || 'claimed'}`,
      targetDate,
      noticeCount: Number(winner?.notice_count || digest.noticeCount),
      mediaId: compactText(winner?.wechat_media_id)
    };
  }

  if (!digest.noticeCount) {
    await updatePublication(fetchImpl, env, targetDate, { status: 'skipped' });
    return { ok: true, skipped: true, reason: 'no_notices', targetDate, noticeCount: 0 };
  }

  try {
    const accessToken = await getWechatAccessToken(fetchImpl, env);
    const thumbMediaId = compactText(env.WECHAT_MP_THUMB_MEDIA_ID) || await uploadCover(fetchImpl, accessToken, digest);
    const mediaId = await addWechatDraft(fetchImpl, accessToken, env, digest, thumbMediaId);

    await updatePublication(fetchImpl, env, targetDate, {
      status: 'drafted',
      wechat_media_id: mediaId,
      wechat_thumb_media_id: thumbMediaId,
      error_code: '',
      error_message: ''
    });

    return {
      ok: true,
      targetDate,
      noticeCount: digest.noticeCount,
      includedCount: digest.includedCount,
      omittedCount: digest.omittedCount,
      mediaId,
      thumbMediaId,
      articleTitle: digest.title
    };
  } catch (error) {
    const code = compactText(error?.code) || 'unexpected_error';
    const message = compactText(error?.message) || String(error);
    await updatePublication(fetchImpl, env, targetDate, {
      status: 'failed',
      error_code: code,
      error_message: message.slice(0, 2_000)
    }).catch(() => undefined);
    throw error;
  }
}
