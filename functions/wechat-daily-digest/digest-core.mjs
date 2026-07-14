import { PassThrough } from 'node:stream';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as PImage from 'pureimage';
import { buildFallbackEditorial, createEditorialPlan } from './editorial-core.mjs';

const CATEGORY_ORDER = ['预推免', '夏令营', '开放日与宣讲', '名单与结果', '其他通知'];
const DEFAULT_SITE_URL = 'https://www.seekoffer.com.cn';
const DEFAULT_MAX_CONTENT_CHARS = 18_000;
const WECHAT_STABLE_TOKEN_URL = 'https://api.weixin.qq.com/cgi-bin/stable_token';
const WECHAT_UPLOAD_MATERIAL_URL = 'https://api.weixin.qq.com/cgi-bin/material/add_material';
const WECHAT_ADD_DRAFT_URL = 'https://api.weixin.qq.com/cgi-bin/draft/add';
const WECHAT_UPDATE_DRAFT_URL = 'https://api.weixin.qq.com/cgi-bin/draft/update';

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

function formatFullDate(targetDate) {
  const [year, month, day] = targetDate.split('-');
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function formatCompactDeadline(deadlineDate) {
  const match = compactText(deadlineDate).match(/20\d{2}-(\d{2})-(\d{2})/);
  return match ? `${Number(match[1])}月${Number(match[2])}日` : '时间见原文';
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
  return [
    '<section style="margin:34px 0 8px;padding:0 0 9px;border-bottom:1px solid #d9dedb;">',
    `<p style="margin:0;padding-left:10px;border-left:3px solid #2f6f68;font-size:19px;line-height:1.5;font-weight:700;color:#1f2b2a;">${escapeHtml(category)}`,
    `<span style="margin-left:7px;font-size:12px;font-weight:400;color:#8b9692;">${count} 条</span></p>`,
    '</section>'
  ].join('');
}

function buildNoticeCard(notice, index, targetDate) {
  const deadline = getDeadlineMeta(notice.deadlineDate, targetDate);
  const department = notice.departmentName
    ? `<span style="color:#7c8783;"> · ${escapeHtml(notice.departmentName)}</span>`
    : '';
  const deadlineColor = deadline.urgent ? '#a55445' : '#58706a';

  return [
    '<section style="margin:0;padding:18px 0 17px;border-bottom:1px solid #edf0ee;">',
    `<p style="margin:0 0 6px;font-size:11px;line-height:1.4;color:#b2b8b5;letter-spacing:0.08em;">${String(index).padStart(2, '0')}</p>`,
    `<p style="margin:0;font-size:16px;line-height:1.55;font-weight:700;color:#1e2c2a;">${escapeHtml(notice.schoolName)}</p>`,
    `<p style="margin:3px 0 0;font-size:12px;line-height:1.65;color:#687571;">${escapeHtml(notice.category)}${department}</p>`,
    `<p style="margin:10px 0 0;font-size:14px;line-height:1.85;color:#364440;">${escapeHtml(notice.projectName)}</p>`,
    `<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:${deadlineColor};">${deadline.label} · ${escapeHtml(notice.deadlineDate)}</p>`,
    '</section>'
  ].join('');
}

function buildEditorialPicks(editorial, notices, targetDate) {
  const byId = new Map(notices.map((notice) => [notice.id, notice]));
  const selected = editorial.selectedNoticeIds.map((id) => byId.get(id)).filter(Boolean);
  if (!selected.length) return '';

  const rows = selected.map((notice, index) => {
    const deadline = getDeadlineMeta(notice.deadlineDate, targetDate);
    const color = deadline.urgent ? '#a55445' : '#60736d';
    return [
      `<p style="margin:${index ? '13px' : '10px'} 0 0;font-size:13px;line-height:1.75;color:#35433f;">`,
      `<span style="color:#9aa39f;">${['一', '二', '三'][index]}、</span>`,
      `<strong style="font-weight:700;color:#1f2b2a;">${escapeHtml(notice.schoolName)}</strong>`,
      `<span style="color:${color};"> · ${formatCompactDeadline(notice.deadlineDate)}${deadline.urgent ? '截止' : ''}</span>`,
      `<br><span style="padding-left:22px;color:#687571;">${escapeHtml(notice.projectName)}</span>`,
      '</p>'
    ].join('');
  }).join('');

  return [
    '<section style="margin:26px 0 8px;padding:17px 0;border-top:1px solid #d9dedb;border-bottom:1px solid #d9dedb;">',
    '<p style="margin:0;font-size:15px;line-height:1.5;font-weight:700;color:#2f6f68;">先看这几条</p>',
    rows,
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
  const editorial = options.editorial || buildFallbackEditorial({ notices, targetDate, categoryCounts });
  const title = `${formatMonthDay(targetDate)}｜${compactText(editorial.titleHook) || '今天有哪些新通知'}`;
  const digest = compactText(editorial.lead)
    || `${formatMonthDay(targetDate)}整理了 ${notices.length} 条院校通知，具体要求请以院校原文为准。`;
  const summaryText = categories.length
    ? categories.map((category) => `${category} ${categoryCounts[category]} 条`).join(' · ')
    : '今天暂无新增分类';
  const header = [
    '<section style="font-size:15px;line-height:1.8;color:#35433f;letter-spacing:0.01em;word-break:break-word;">',
    '<section style="padding:3px 0 19px;border-bottom:1px solid #d9dedb;">',
    '<p style="margin:0;font-size:13px;line-height:1.5;font-weight:700;color:#2f6f68;">寻鹿 SeekOffer</p>',
    `<p style="margin:7px 0 0;font-size:12px;line-height:1.5;color:#8a9692;">${escapeHtml(formatFullDate(targetDate))} · 保研信息整理</p>`,
    '</section>',
    `<p style="margin:22px 0 0;font-size:16px;line-height:1.95;color:#263431;">${escapeHtml(digest)}</p>`,
    `<p style="margin:16px 0 0;font-size:12px;line-height:1.75;color:#7c8783;">今日收录 ${notices.length} 条 · ${escapeHtml(summaryText)}</p>`,
    buildEditorialPicks(editorial, notices, targetDate)
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
    content += `<p style="margin:20px 0;padding:12px 0;border-top:1px solid #d9dedb;border-bottom:1px solid #d9dedb;color:#7a6650;">篇幅有限，另有 ${omittedCount} 条通知未在正文展开，点击“阅读原文”可查看完整列表。</p>`;
  }

  content += [
    '<section style="margin-top:32px;padding:18px 0 0;border-top:1px solid #d9dedb;">',
    '<p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#2f6f68;">说明</p>',
    '<p style="margin:0;font-size:12px;line-height:1.85;color:#74807c;">院校通知可能临时调整、补充或提前关闭。申请前请打开官方原文，核对报名资格、材料要求和最终截止时间。</p>',
    '</section>',
    '<p style="margin:25px 0 0;padding:14px 0;border-top:1px solid #edf0ee;border-bottom:1px solid #edf0ee;text-align:center;font-size:13px;line-height:1.75;color:#2f6f68;">文末「阅读原文」可查看全部通知与官方链接</p>',
    '<p style="margin:24px 0 0;text-align:center;font-size:10px;line-height:1.8;color:#a0aaa6;">寻鹿 SeekOffer · 保研信息每日整理</p>',
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
    sourceUrl,
    editorial
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
const COVER_TEMPLATE_PATH = fileURLToPath(new URL('./assets/cover-template.png', import.meta.url));
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

export async function renderCoverJpeg(digest) {
  await ensureCoverFont();
  const canvas = await PImage.decodePNGFromStream(createReadStream(COVER_TEMPLATE_PATH));
  const context = canvas.getContext('2d');

  const [, month, day] = digest.targetDate.split('-');
  context.fillStyle = '#1f2b2a';
  context.font = '72pt Lato Black';
  context.fillText(`${month}.${day}`, 62, 190);
  const countText = String(digest.noticeCount).padStart(2, '0');
  context.font = '68pt Lato Black';
  const countWidth = context.measureText(countText).width;
  context.fillStyle = '#1f2b2a';
  context.fillText(countText, 750 - countWidth / 2, 220);

  const stream = new PassThrough();
  const chunks = [];
  stream.on('data', (chunk) => chunks.push(chunk));
  await PImage.encodeJPEGToStream(canvas, stream, 92);
  return Buffer.concat(chunks);
}

async function uploadCover(fetchImpl, accessToken, digest) {
  const coverBuffer = await renderCoverJpeg(digest);
  const form = new FormData();
  form.append('media', new Blob([coverBuffer], { type: 'image/jpeg' }), `seekoffer-${digest.targetDate}.jpg`);
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

function buildWechatArticle(env, digest, thumbMediaId) {
  return {
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
  };
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
        articles: [buildWechatArticle(env, digest, thumbMediaId)]
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

async function updateWechatDraft(fetchImpl, accessToken, env, digest, thumbMediaId, mediaId) {
  const url = `${WECHAT_UPDATE_DRAFT_URL}?access_token=${encodeURIComponent(accessToken)}`;
  const payload = await requestJson(
    fetchImpl,
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_id: mediaId,
        index: 0,
        articles: buildWechatArticle(env, digest, thumbMediaId)
      })
    },
    'wechat_draft_update_failed'
  );

  if (Number(payload?.errcode || 0) !== 0) {
    throw new DigestError(
      String(payload?.errcode || 'wechat_draft_update_failed'),
      compactText(payload?.errmsg) || 'WeChat did not update the draft',
      payload
    );
  }
  return mediaId;
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
  const digestOptions = {
    siteUrl: env.SEEKOFFER_SITE_URL || env.NEXT_PUBLIC_SITE_URL,
    maxContentChars: env.WECHAT_DAILY_MAX_CONTENT_CHARS
  };
  const baselineDigest = buildDailyDigest(rawNotices, targetDate, digestOptions);

  let existing = null;
  if (!dryRun) {
    requireEnv(env, ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'WECHAT_MP_APP_ID', 'WECHAT_MP_APP_SECRET']);
    existing = await getExistingPublication(fetchImpl, env, targetDate);

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
  }

  const editorial = await createEditorialPlan({
    notices: baselineDigest.notices,
    targetDate,
    categoryCounts: baselineDigest.categoryCounts,
    fetchImpl,
    env
  });
  const digest = buildDailyDigest(rawNotices, targetDate, { ...digestOptions, editorial });

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
      },
      editorial: {
        source: editorial.source,
        model: editorial.model,
        fallbackReason: editorial.fallbackReason
      }
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
      forced: force,
      editorialSource: editorial.source,
      editorialModel: editorial.model,
      editorialFallbackReason: editorial.fallbackReason,
      openaiResponseId: editorial.responseId
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
    const existingMediaId = compactText(existing?.wechat_media_id);
    const mediaId = existing && force && existingMediaId
      ? await updateWechatDraft(fetchImpl, accessToken, env, digest, thumbMediaId, existingMediaId)
      : await addWechatDraft(fetchImpl, accessToken, env, digest, thumbMediaId);

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
      articleTitle: digest.title,
      editorialSource: editorial.source,
      editorialModel: editorial.model
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
