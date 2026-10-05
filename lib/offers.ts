'use client';

import { cloudflareRequest } from './cloudflare-api';

export const offerResultTypes = ['录取', '放弃', '候补', '补录传闻', '官方确认'] as const;
export const offerProjectTypes = ['夏令营', '预推免', '九推', '直博', '硕士', '博士', '其他'] as const;
export const offerDiscussionCategories = ['选校定位', '材料准备', '导师联系', '面试经验', 'Offer选择', '候补动态', '其他'] as const;

export type OfferResultType = (typeof offerResultTypes)[number];
export type OfferProjectType = (typeof offerProjectTypes)[number];
export type OfferDiscussionCategory = (typeof offerDiscussionCategories)[number];
export type OfferContentType = 'offer' | 'discussion';

export type PublicOffer = {
  id: string;
  contentType: OfferContentType;
  title: string;
  category: string;
  authorName: string;
  schoolName: string;
  major: string;
  projectType: string;
  result: OfferResultType;
  undergraduateBackground: string;
  content: string;
  isAnonymous: boolean;
  isOfficial: boolean;
  sourceLabel: string;
  commentsCount: number;
  followsCount: number;
  reportsCount: number;
  createdAt: string;
};

export type OfferComment = {
  id: string;
  postId: string;
  authorName: string;
  content: string;
  isAnonymous: boolean;
  createdAt: string;
};

export type OfferSubmitInput = {
  userId: string;
  authorName: string;
  schoolName: string;
  major: string;
  projectType: OfferProjectType;
  result: OfferResultType;
  undergraduateBackground: string;
  content: string;
  isAnonymous: boolean;
};

export type OfferDiscussionSubmitInput = {
  userId: string;
  authorName: string;
  schoolName: string;
  major: string;
  title: string;
  category: OfferDiscussionCategory;
  content: string;
  isAnonymous: boolean;
};

type OfferPostRow = {
  id: string;
  content_type: string | null;
  title: string | null;
  category: string | null;
  author_name: string | null;
  school_name: string | null;
  major: string | null;
  project_type: string | null;
  result: string | null;
  undergraduate_background: string | null;
  content: string | null;
  is_anonymous: boolean | null;
  is_official: boolean | null;
  source_label: string | null;
  comments_count: number | null;
  follows_count: number | null;
  reports_count: number | null;
  created_at: string | null;
};

type OfferCommentRow = {
  id: string;
  post_id: string;
  author_name: string | null;
  content: string | null;
  is_anonymous: boolean | null;
  created_at: string | null;
};

function cleanText(value: string, maxLength: number) {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanMultiline(value: string, maxLength: number) {
  return value.trim().replace(/\n{3,}/g, '\n\n').slice(0, maxLength);
}

function normalizeResult(value: string | null | undefined): OfferResultType {
  return offerResultTypes.find((item) => item === value) || '录取';
}

function normalizeContentType(value: string | null | undefined): OfferContentType {
  return value === 'discussion' ? 'discussion' : 'offer';
}

function mapOfferRow(row: OfferPostRow): PublicOffer {
  return {
    id: row.id,
    contentType: normalizeContentType(row.content_type),
    title: cleanText(row.title || '', 120),
    category: cleanText(row.category || '', 40),
    authorName: cleanText(row.author_name || '', 80),
    schoolName: cleanText(row.school_name || '', 80),
    major: cleanText(row.major || '', 80),
    projectType: cleanText(row.project_type || '', 40),
    result: normalizeResult(row.result),
    undergraduateBackground: cleanText(row.undergraduate_background || '', 120),
    content: cleanMultiline(row.content || '', 1200),
    isAnonymous: row.is_anonymous !== false,
    isOfficial: row.is_official === true,
    sourceLabel: cleanText(row.source_label || '', 40),
    commentsCount: Math.max(0, Number(row.comments_count || 0)),
    followsCount: Math.max(0, Number(row.follows_count || 0)),
    reportsCount: Math.max(0, Number(row.reports_count || 0)),
    createdAt: row.created_at || ''
  };
}

function mapCommentRow(row: OfferCommentRow): OfferComment {
  return {
    id: row.id,
    postId: row.post_id,
    authorName: cleanText(row.author_name || '', 80),
    content: cleanMultiline(row.content || '', 800),
    isAnonymous: row.is_anonymous !== false,
    createdAt: row.created_at || ''
  };
}

function ensureConfigured(message: string) {
  void message;
}

export function formatOfferTime(value: string) {
  if (!value) return '刚刚';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '刚刚';

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai'
  }).format(date);
}

export function getOfferAuthorLabel(offer: Pick<PublicOffer, 'authorName' | 'isAnonymous' | 'isOfficial'>) {
  if (offer.isOfficial) return offer.authorName || '寻鹿内容组';
  if (offer.isAnonymous) return '匿名同学';
  return offer.authorName || '寻鹿用户';
}

export function getOfferAvatar(label: string) {
  const normalized = label.trim();
  return normalized ? normalized.slice(0, 1).toUpperCase() : '鹿';
}

export async function fetchPublicCommunityPosts() {
  ensureConfigured('Offer 圈暂时无法加载，请稍后重试。');
  const rows: OfferPostRow[] = [];
  let page = 1;
  let nextPage: number | null = 1;
  while (nextPage && rows.length < 200) {
    const result = await cloudflareRequest<{ items?: OfferPostRow[]; pagination?: { totalPages?: number } }>(
      `/v1/community/posts?page=${page}&pageSize=40`,
      {},
      false
    );
    const items = Array.isArray(result.items) ? result.items : [];
    rows.push(...items);
    const totalPages = Number(result.pagination?.totalPages || page);
    nextPage = items.length && page < totalPages ? page + 1 : null;
    page += 1;
  }
  return rows.slice(0, 200).map(mapOfferRow);
}

export async function fetchPublicOffers() {
  const posts = await fetchPublicCommunityPosts();
  return posts.filter((post) => post.contentType === 'offer');
}

export async function fetchOfferComments(postId: string) {
  ensureConfigured('回复暂时无法加载，请稍后重试。');
  const result = await cloudflareRequest<{ items?: OfferCommentRow[] }>(
    `/v1/community/comments?postId=${encodeURIComponent(postId)}&page=1`,
    {},
    false
  );
  return (Array.isArray(result.items) ? result.items : []).map(mapCommentRow);
}

export async function fetchFollowedOfferPostIds(userId: string) {
  if (!userId) return [] as string[];
  const ids: string[] = [];
  let page = 1;
  let nextPage: number | null = 1;
  while (nextPage) {
    const result = await cloudflareRequest<{ ids?: string[]; nextPage?: number | null }>(
      `/v1/me/community/follows?page=${page}`,
      {},
      true
    );
    ids.push(...(Array.isArray(result.ids) ? result.ids : []));
    nextPage = result.nextPage || null;
    page = nextPage || 0;
  }
  return ids.filter(Boolean);
}

export async function toggleOfferPostFollow(postId: string, userId: string, followed: boolean) {
  ensureConfigured('关注状态暂时无法保存，请稍后重试。');
  if (!userId) throw new Error('请登录后关注讨论。');

  const result = await cloudflareRequest<{ followed?: boolean }>(
    '/v1/me/community/follows',
    { method: 'POST', body: JSON.stringify({ postId, follow: !followed }) },
    true
  );
  return result.followed === true;
}

export function validateOfferSubmitInput(input: OfferSubmitInput) {
  const authorName = cleanText(input.authorName, 80);
  const schoolName = cleanText(input.schoolName, 80);
  const major = cleanText(input.major, 80);
  const undergraduateBackground = cleanText(input.undergraduateBackground, 120);
  const content = cleanMultiline(input.content, 1200);

  if (!input.userId) throw new Error('登录状态已失效，请重新登录后再发布。');
  if (!authorName) throw new Error('请填写用于核验的发布人称呼。');
  if (!schoolName) throw new Error('请填写相关院校。');
  if (!major) throw new Error('请填写专业或方向。');
  if (!offerProjectTypes.includes(input.projectType)) throw new Error('请选择项目类型。');
  if (!offerResultTypes.includes(input.result)) throw new Error('请选择动态类型。');
  if (!undergraduateBackground) throw new Error('请填写本科背景，便于读者判断参考价值。');
  if (content.length < 12) throw new Error('请补充更多细节，至少 12 个字。');

  return { ...input, authorName, schoolName, major, undergraduateBackground, content };
}

export async function submitOfferPost(input: OfferSubmitInput) {
  ensureConfigured('发布入口正在维护中，请稍后再试。');
  const validated = validateOfferSubmitInput(input);
  await cloudflareRequest(
    '/v1/me/community/posts',
    {
      method: 'POST',
      body: JSON.stringify({
        requestId: crypto.randomUUID(),
        contentType: 'offer',
        authorName: validated.authorName,
        schoolName: validated.schoolName,
        major: validated.major,
        projectType: validated.projectType,
        result: validated.result,
        undergraduateBackground: validated.undergraduateBackground,
        content: validated.content,
        isAnonymous: validated.isAnonymous,
        title: '',
        category: ''
      })
    },
    true
  );
}

export async function submitOfferDiscussion(input: OfferDiscussionSubmitInput) {
  ensureConfigured('讨论发布入口正在维护中，请稍后再试。');
  const authorName = cleanText(input.authorName, 80);
  const schoolName = cleanText(input.schoolName, 80);
  const major = cleanText(input.major, 80);
  const title = cleanText(input.title, 120);
  const content = cleanMultiline(input.content, 1200);

  if (!input.userId) throw new Error('请登录后发起讨论。');
  if (!authorName) throw new Error('请填写发布人称呼。');
  if (!schoolName) throw new Error('请填写相关院校或“通用讨论”。');
  if (!major) throw new Error('请填写专业方向或“通用”。');
  if (title.length < 4) throw new Error('标题至少需要 4 个字。');
  if (!offerDiscussionCategories.includes(input.category)) throw new Error('请选择讨论分类。');
  if (content.length < 12) throw new Error('请补充问题背景，至少 12 个字。');

  await cloudflareRequest(
    '/v1/me/community/posts',
    {
      method: 'POST',
      body: JSON.stringify({
        requestId: crypto.randomUUID(),
        contentType: 'discussion',
        authorName,
        schoolName,
        major,
        projectType: '',
        result: '',
        undergraduateBackground: '',
        content,
        isAnonymous: input.isAnonymous,
        title,
        category: input.category
      })
    },
    true
  );
}

export async function submitOfferComment(input: {
  postId: string;
  userId: string;
  authorName: string;
  content: string;
  isAnonymous: boolean;
}) {
  ensureConfigured('回复入口正在维护中，请稍后再试。');
  const authorName = cleanText(input.authorName, 80);
  const content = cleanMultiline(input.content, 800);
  if (!input.userId) throw new Error('请登录后回复。');
  if (!authorName) throw new Error('请填写发布人称呼。');
  if (content.length < 2) throw new Error('请填写回复内容。');

  await cloudflareRequest(
    '/v1/me/community/comments',
    {
      method: 'POST',
      body: JSON.stringify({
        requestId: crypto.randomUUID(),
        postId: input.postId,
        authorName,
        content,
        isAnonymous: input.isAnonymous
      })
    },
    true
  );
}

export async function reportOfferPost(offerId: string, content: string, userId?: string | null) {
  ensureConfigured('反馈入口正在维护中，请稍后再试。');
  const cleanContent = cleanMultiline(content, 800);
  if (cleanContent.length < 8) throw new Error('请至少用 8 个字说明举报原因。');

  await cloudflareRequest(
    '/v1/community/report',
    {
      method: 'POST',
      body: JSON.stringify({ requestId: crypto.randomUUID(), postId: offerId, content: cleanContent })
    },
    Boolean(userId)
  );
}
