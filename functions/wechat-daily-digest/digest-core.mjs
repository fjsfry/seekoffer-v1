import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import * as PImage from 'pureimage';

const CATEGORY_ORDER = ['预推免', '夏令营', '开放日与宣讲', '名单与结果', '其他通知'];
const CATEGORY_META = {
  预推免: { accent: '#b68443', soft: '#fbf6ed', kicker: 'PRE-RECOMMENDATION' },
  夏令营: { accent: '#2f7c7a', soft: '#edf7f6', kicker: 'SUMMER PROGRAM' },
  开放日与宣讲: { accent: '#6877a8', soft: '#f1f3fa', kicker: 'OPEN DAY & SESSION' },
  名单与结果: { accent: '#a4534d', soft: '#fbf1f0', kicker: 'RESULT & ADMISSION' },
  其他通知: { accent: '#647687', soft: '#f2f5f7', kicker: 'OTHER UPDATES' }
};
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

function getDeadlineMeta(deadlineDate, targetDate) {
  const match = compactText(deadlineDate).match(/20\d{2}-\d{2}-\d{2}/);
  if (!match) {
    return { label: '截止时间', color: '#52697a', background: '#eef3f6', urgent: false };
  }

  const deadline = Date.parse(`${match[0]}T23:59:59+08:00`);
  const start = Date.parse(`${targetDate}T00:00:00+08:00`);
  const remainingDays = Math.floor((deadline - start) / 86_400_000);

  if (remainingDays < 0) {
    return { label: '已截止', color: '#7f8c97', background: '#eef1f3', urgent: false };
  }
  if (remainingDays === 0) {
    return { label: '今日截止', color: '#a33f35', background: '#fff0ed', urgent: true };
  }
  if (remainingDays <= 3) {
    return { label: `${remainingDays}天内截止`, color: '#9a5f1f', background: '#fff5e6', urgent: true };
  }

  return { label: '报名截止', color: '#52697a', background: '#eef3f6', urgent: false };
}

function buildCategoryHeader(category, count) {
  const position = CATEGORY_ORDER.indexOf(category) + 1;
  const meta = CATEGORY_META[category] || CATEGORY_META.其他通知;
  return [
    '<section style="margin:30px 0 14px;padding:0 0 10px;border-bottom:1px solid #dfe6eb;">',
    `<p style="margin:0 0 3px;font-size:10px;line-height:1.4;letter-spacing:0.16em;color:${meta.accent};">${String(position).padStart(2, '0')} / ${meta.kicker}</p>`,
    `<p style="margin:0;font-size:20px;line-height:1.45;font-weight:700;color:#102a43;">${escapeHtml(category)}`,
    `<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:${meta.soft};font-size:11px;font-weight:500;color:${meta.accent};vertical-align:2px;">${count} 条</span></p>`,
    '</section>'
  ].join('');
}

function buildNoticeCard(notice, index, targetDate) {
  const meta = CATEGORY_META[notice.category] || CATEGORY_META.其他通知;
  const deadline = getDeadlineMeta(notice.deadlineDate, targetDate);
  const department = notice.departmentName
    ? `<p style="margin:3px 0 0;font-size:12px;line-height:1.6;color:#7b8b98;">${escapeHtml(notice.departmentName)}</p>`
    : '';

  return [
    '<section style="margin:0 0 15px;border:1px solid #e3e9ed;border-radius:12px;background:#ffffff;overflow:hidden;">',
    `<section style="height:4px;background:${meta.accent};font-size:0;line-height:0;">&nbsp;</section>`,
    '<section style="padding:16px 16px 15px;">',
    `<p style="margin:0;font-size:12px;line-height:1.5;color:${meta.accent};letter-spacing:0.08em;">NO. ${String(index).padStart(2, '0')}</p>`,
    `<p style="margin:5px 0 0;font-size:17px;line-height:1.55;font-weight:700;color:#17324d;">${escapeHtml(notice.schoolName)}</p>`,
    department,
    `<p style="margin:11px 0 0;font-size:14px;line-height:1.78;color:#3e5060;">${escapeHtml(notice.projectName)}</p>`,
    '<section style="margin-top:13px;padding-top:11px;border-top:1px solid #edf1f3;">',
    `<span style="display:inline-block;margin-right:7px;padding:2px 8px;border-radius:999px;background:${deadline.background};font-size:11px;line-height:1.7;font-weight:700;color:${deadline.color};">${deadline.label}</span>`,
    `<span style="font-size:12px;line-height:1.7;color:#667887;">${escapeHtml(notice.deadlineDate)}</span>`,
    '</section>',
    '</section>',
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
  const urgentCount = notices.filter((notice) => getDeadlineMeta(notice.deadlineDate, targetDate).urgent).length;
  const summaryChips = categories.map((category) => {
    const meta = CATEGORY_META[category] || CATEGORY_META.其他通知;
    return `<span style="display:inline-block;margin:4px 6px 0 0;padding:4px 9px;border-radius:999px;background:${meta.soft};font-size:11px;line-height:1.7;color:${meta.accent};">${escapeHtml(category)} · ${categoryCounts[category]}</span>`;
  }).join('');
  const header = [
    '<section style="font-size:15px;line-height:1.8;color:#2f4050;letter-spacing:0.01em;word-break:break-word;">',
    '<section style="padding:24px 20px 22px;border-radius:14px;background:#102a43;">',
    `<p style="margin:0;font-size:11px;line-height:1.5;letter-spacing:0.18em;color:#d9b878;">SEEK OFFER · DAILY BRIEF</p>`,
    `<p style="margin:15px 0 0;font-size:15px;line-height:1.5;color:#c5d3dc;">${escapeHtml(formatMonthDay(targetDate))}信息更新</p>`,
    `<p style="margin:2px 0 0;line-height:1.2;color:#ffffff;"><strong style="font-size:46px;font-weight:700;">${notices.length}</strong><span style="margin-left:7px;font-size:18px;">条保研通知</span></p>`,
    '<p style="margin:13px 0 0;font-size:12px;line-height:1.7;color:#aebfc9;">按申请阶段整理，帮助你快速判断优先级与截止时间。</p>',
    '</section>',
    '<section style="margin-top:14px;padding:15px 16px;border:1px solid #e3e9ed;border-radius:11px;background:#f8fafb;">',
    '<p style="margin:0;font-size:13px;font-weight:700;color:#17324d;">今日速览</p>',
    `<p style="margin:5px 0 0;line-height:1.8;">${summaryChips || '<span style="font-size:12px;color:#7b8b98;">今日暂无新增分类</span>'}</p>`,
    '</section>',
    urgentCount > 0
      ? `<section style="margin-top:12px;padding:12px 14px;border-left:4px solid #b15b4f;border-radius:8px;background:#fff3f0;"><p style="margin:0;font-size:13px;line-height:1.75;color:#8d4037;"><strong>截止提醒：</strong>今日有 ${urgentCount} 条通知将在 3 天内截止，请优先核对。</p></section>`
      : ''
  ].join('');
  const footerReserve = 1_500;
  let content = header;
  let currentCategory = '';
  let includedCount = 0;

  for (const notice of notices) {
    const categoryHeader = notice.category === currentCategory
      ? ''
      : buildCategoryHeader(notice.category, categoryCounts[notice.category]);
    const card = buildNoticeCard(notice, includedCount + 1, targetDate);

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
    '<section style="margin-top:28px;padding:17px 16px;border-top:3px solid #b68443;border-radius:10px;background:#f6f8f9;">',
    '<p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#17324d;">阅读前请确认</p>',
    '<p style="margin:0;font-size:12px;line-height:1.8;color:#667887;">院校通知可能临时调整、补充或提前关闭。申请前请打开官方原文，核对报名资格、材料要求与最终截止时间。</p>',
    '</section>',
    '<section style="margin-top:14px;padding:20px 16px;border-radius:12px;background:#17324d;text-align:center;">',
    '<p style="margin:0;font-size:16px;line-height:1.6;font-weight:700;color:#ffffff;">查看完整通知与官方入口</p>',
    '<p style="margin:6px 0 0;font-size:12px;line-height:1.7;color:#bdccd5;">点击文末「阅读原文」，进入当日通知列表</p>',
    '</section>',
    '<p style="margin:22px 0 0;text-align:center;font-size:10px;line-height:1.8;letter-spacing:0.16em;color:#9aa8b2;">SEEK OFFER · 保研信息每日更新</p>',
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

const COVER_FONT_REGULAR_PATH = fileURLToPath(new URL('./assets/Lato-Regular.ttf', import.meta.url));
const COVER_FONT_BLACK_PATH = fileURLToPath(new URL('./assets/Lato-Black.ttf', import.meta.url));
let coverFontPromise;

function ensureCoverFont() {
  if (!coverFontPromise) {
    coverFontPromise = Promise.all([
      PImage.registerFont(COVER_FONT_REGULAR_PATH, 'Lato').load(),
      PImage.registerFont(COVER_FONT_BLACK_PATH, 'Lato Black').load()
    ]);
  }
  return coverFontPromise;
}

function drawTrackedText(context, text, x, y, spacing) {
  let cursor = x;
  for (const character of String(text)) {
    context.fillText(character, cursor, y);
    cursor += context.measureText(character).width + spacing;
  }
}

function drawStrongText(context, text, x, y) {
  context.fillText(text, x, y);
  context.fillText(text, x + 1, y);
}

function drawRoundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function fillCoverGradient(context, width, height) {
  for (let y = 0; y < height; y += 1) {
    const progress = y / Math.max(1, height - 1);
    const red = Math.round(12 + 18 * progress);
    const green = Math.round(34 + 40 * progress);
    const blue = Math.round(55 + 39 * progress);
    context.fillStyle = `rgb(${red},${green},${blue})`;
    context.fillRect(0, y, width, 1);
  }
}

export async function renderCoverPng(digest) {
  await ensureCoverFont();
  const width = 900;
  const height = 383;
  const canvas = PImage.make(width, height);
  const context = canvas.getContext('2d');
  fillCoverGradient(context, width, height);

  context.strokeStyle = 'rgba(255,255,255,0.045)';
  context.lineWidth = 1;
  for (let x = 30; x < width; x += 54) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }

  context.fillStyle = 'rgba(255,255,255,0.035)';
  context.beginPath();
  context.arc(812, 32, 196, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(222,182,112,0.065)';
  context.beginPath();
  context.arc(760, 374, 150, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#d9b878';
  context.fillRect(53, 49, 5, 278);
  context.font = "14pt 'Lato'";
  drawTrackedText(context, 'SEEK OFFER', 82, 72, 4);
  context.fillStyle = '#ffffff';
  context.font = "58pt 'Lato Black'";
  drawStrongText(context, 'DAILY', 78, 163);
  drawStrongText(context, 'DIGEST', 78, 231);
  context.fillStyle = '#b8ced8';
  context.font = "14pt 'Lato'";
  drawTrackedText(context, 'POSTGRADUATE RECOMMENDATION', 82, 276, 1.35);
  context.fillStyle = '#d9b878';
  context.font = "14pt 'Lato'";
  drawTrackedText(context, digest.targetDate.replaceAll('-', ' · '), 82, 328, 2.2);

  drawRoundedRect(context, 646, 65, 198, 250, 24);
  context.fillStyle = 'rgba(255,255,255,0.075)';
  context.fill();
  context.strokeStyle = 'rgba(255,255,255,0.18)';
  context.lineWidth = 1;
  context.stroke();

  const countText = String(digest.noticeCount).padStart(2, '0');
  context.font = "82pt 'Lato Black'";
  const countWidth = context.measureText(countText).width;
  context.fillStyle = '#ffffff';
  drawStrongText(context, countText, 745 - countWidth / 2, 188);
  context.fillStyle = '#d9b878';
  context.font = "12pt 'Lato'";
  const label = 'NEW NOTICES';
  const labelWidth = context.measureText(label).width;
  context.fillText(label, 745 - labelWidth / 2, 232);
  context.fillStyle = 'rgba(255,255,255,0.22)';
  context.fillRect(685, 255, 120, 1);
  context.fillStyle = '#b8ced8';
  context.font = "10pt 'Lato'";
  const todayLabel = 'DAILY UPDATE';
  const todayWidth = context.measureText(todayLabel).width;
  context.fillText(todayLabel, 745 - todayWidth / 2, 285);

  const stream = new PassThrough();
  const chunks = [];
  stream.on('data', (chunk) => chunks.push(chunk));
  await PImage.encodePNGToStream(canvas, stream);
  return Buffer.concat(chunks);
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
