'use client';

import { getSupabaseBrowserClient } from './supabase-browser';
import { isSupabaseConfigured } from './supabase-env';

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

const publicPostColumns = [
  'id',
  'content_type',
  'title',
  'category',
  'author_name',
  'school_name',
  'major',
  'project_type',
  'result',
  'undergraduate_background',
  'content',
  'is_anonymous',
  'is_official',
  'source_label',
  'comments_count',
  'follows_count',
  'reports_count',
  'created_at'
].join(',');

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
  if (!isSupabaseConfigured()) {
    throw new Error(message);
  }
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
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('offer_posts')
    .select(publicPostColumns)
    .eq('review_status', 'approved')
    .is('hidden_at', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw new Error('Offer 圈暂时无法加载，请稍后重试。');
  return ((data || []) as unknown as OfferPostRow[]).map(mapOfferRow);
}

export async function fetchPublicOffers() {
  const posts = await fetchPublicCommunityPosts();
  return posts.filter((post) => post.contentType === 'offer');
}

export async function fetchOfferComments(postId: string) {
  ensureConfigured('回复暂时无法加载，请稍后重试。');
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('offer_comments')
    .select('id,post_id,author_name,content,is_anonymous,created_at')
    .eq('post_id', postId)
    .eq('review_status', 'approved')
    .is('hidden_at', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) throw new Error('回复暂时无法加载，请稍后重试。');
  return ((data || []) as OfferCommentRow[]).map(mapCommentRow);
}

export async function fetchFollowedOfferPostIds(userId: string) {
  if (!userId || !isSupabaseConfigured()) return [] as string[];
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from('offer_post_follows').select('post_id').eq('user_id', userId);
  if (error) return [] as string[];
  return (data || []).map((row) => String(row.post_id || '')).filter(Boolean);
}

export async function toggleOfferPostFollow(postId: string, userId: string, followed: boolean) {
  ensureConfigured('关注状态暂时无法保存，请稍后重试。');
  if (!userId) throw new Error('请登录后关注讨论。');

  const supabase = getSupabaseBrowserClient();
  if (followed) {
    const { error } = await supabase.from('offer_post_follows').delete().eq('post_id', postId).eq('user_id', userId);
    if (error) throw new Error('取消关注失败，请稍后重试。');
    return false;
  }

  const { error } = await supabase.from('offer_post_follows').insert({ post_id: postId, user_id: userId });
  if (error) throw new Error('关注失败，请稍后重试。');
  return true;
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
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from('offer_posts').insert({
    user_id: validated.userId,
    author_name: validated.authorName,
    school_name: validated.schoolName,
    major: validated.major,
    project_type: validated.projectType,
    result: validated.result,
    undergraduate_background: validated.undergraduateBackground,
    content: validated.content,
    is_anonymous: validated.isAnonymous,
    content_type: 'offer',
    title: '',
    category: ''
  });

  if (error) throw new Error('发布失败，请稍后重试。');
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

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from('offer_posts').insert({
    user_id: input.userId,
    author_name: authorName,
    school_name: schoolName,
    major,
    project_type: '',
    result: '',
    undergraduate_background: '',
    content,
    is_anonymous: input.isAnonymous,
    content_type: 'discussion',
    title,
    category: input.category
  });

  if (error) throw new Error('讨论提交失败，请稍后重试。');
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

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from('offer_comments').insert({
    post_id: input.postId,
    user_id: input.userId,
    author_name: authorName,
    content,
    is_anonymous: input.isAnonymous
  });

  if (error) throw new Error('回复失败，请稍后重试。');
}

export async function reportOfferPost(offerId: string, content: string, userId?: string | null) {
  ensureConfigured('反馈入口正在维护中，请稍后再试。');
  const cleanContent = cleanMultiline(content, 800);
  if (cleanContent.length < 8) throw new Error('请至少用 8 个字说明举报原因。');

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from('feedback_reports').insert({
    user_id: userId || null,
    type: 'report',
    module: 'offer',
    target_id: offerId,
    content: cleanContent
  });

  if (error) throw new Error('举报提交失败，请稍后重试。');
}
