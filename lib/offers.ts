'use client';

import { getSupabaseBrowserClient } from './supabase-browser';
import { isSupabaseConfigured } from './supabase-env';

export const offerResultTypes = ['录取', '放弃', '候补', '补录传闻', '官方确认'] as const;
export const offerProjectTypes = ['夏令营', '预推免', '九推', '直博', '硕士', '博士', '其他'] as const;

export type OfferResultType = (typeof offerResultTypes)[number];
export type OfferProjectType = (typeof offerProjectTypes)[number];

export type PublicOffer = {
  id: string;
  authorName: string;
  schoolName: string;
  major: string;
  projectType: string;
  result: OfferResultType;
  undergraduateBackground: string;
  content: string;
  isAnonymous: boolean;
  reportsCount: number;
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

type OfferPostRow = {
  id: string;
  author_name: string | null;
  school_name: string | null;
  major: string | null;
  project_type: string | null;
  result: string | null;
  undergraduate_background: string | null;
  content: string | null;
  is_anonymous: boolean | null;
  reports_count: number | null;
  created_at: string | null;
};

function cleanText(value: string, maxLength: number) {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanMultiline(value: string, maxLength: number) {
  return value.trim().replace(/\n{3,}/g, '\n\n').slice(0, maxLength);
}

function normalizeResult(value: string | null | undefined): OfferResultType {
  const matched = offerResultTypes.find((item) => item === value);
  return matched || '录取';
}

function mapOfferRow(row: OfferPostRow): PublicOffer {
  return {
    id: row.id,
    authorName: cleanText(row.author_name || '', 80),
    schoolName: cleanText(row.school_name || '', 80),
    major: cleanText(row.major || '', 80),
    projectType: cleanText(row.project_type || '', 40),
    result: normalizeResult(row.result),
    undergraduateBackground: cleanText(row.undergraduate_background || '', 120),
    content: cleanMultiline(row.content || '', 1200),
    isAnonymous: row.is_anonymous !== false,
    reportsCount: Math.max(0, Number(row.reports_count || 0)),
    createdAt: row.created_at || ''
  };
}

export function formatOfferTime(value: string) {
  if (!value) {
    return '刚刚';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '刚刚';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai'
  }).format(date);
}

export function getOfferAuthorLabel(offer: Pick<PublicOffer, 'authorName' | 'isAnonymous'>) {
  if (offer.isAnonymous) {
    return '匿名同学';
  }

  return offer.authorName || 'Seekoffer 用户';
}

export function getOfferAvatar(label: string) {
  const normalized = label.trim();
  return normalized ? normalized.slice(0, 1).toUpperCase() : 'O';
}

export async function fetchPublicOffers() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 环境变量未配置，Offer 池真实数据暂不可用。');
  }

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('offer_posts')
    .select(
      'id,author_name,school_name,major,project_type,result,undergraduate_background,content,is_anonymous,reports_count,created_at'
    )
    .eq('review_status', 'approved')
    .is('hidden_at', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(error.message || '读取 Offer 池失败。');
  }

  return ((data || []) as OfferPostRow[]).map(mapOfferRow);
}

export function validateOfferSubmitInput(input: OfferSubmitInput) {
  const authorName = cleanText(input.authorName, 80);
  const schoolName = cleanText(input.schoolName, 80);
  const major = cleanText(input.major, 80);
  const undergraduateBackground = cleanText(input.undergraduateBackground, 120);
  const content = cleanMultiline(input.content, 1200);

  if (!input.userId) {
    throw new Error('登录状态已失效，请重新登录后再发布。');
  }

  if (!authorName) {
    throw new Error('请填写后台可核验的发布人称呼。');
  }

  if (!schoolName) {
    throw new Error('请填写相关院校。');
  }

  if (!major) {
    throw new Error('请填写专业或方向。');
  }

  if (!offerProjectTypes.includes(input.projectType)) {
    throw new Error('请选择项目类型。');
  }

  if (!offerResultTypes.includes(input.result)) {
    throw new Error('请选择动态类型。');
  }

  if (!undergraduateBackground) {
    throw new Error('请填写本科背景，便于读者判断参考价值。');
  }

  if (content.length < 12) {
    throw new Error('请补充更多细节，至少 12 个字。');
  }

  return {
    userId: input.userId,
    authorName,
    schoolName,
    major,
    projectType: input.projectType,
    result: input.result,
    undergraduateBackground,
    content,
    isAnonymous: input.isAnonymous
  };
}

export async function submitOfferPost(input: OfferSubmitInput) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 环境变量未配置，暂时不能发布 Offer。');
  }

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
    is_anonymous: validated.isAnonymous
  });

  if (error) {
    throw new Error(error.message || '发布失败，请稍后重试。');
  }
}

export async function reportOfferPost(offerId: string, content: string, userId?: string | null) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 环境变量未配置，暂时不能提交举报。');
  }

  const cleanContent = cleanMultiline(content, 800);
  if (cleanContent.length < 8) {
    throw new Error('请至少用 8 个字说明举报原因。');
  }

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from('feedback_reports').insert({
    user_id: userId || null,
    type: 'report',
    module: 'offer',
    target_id: offerId,
    content: cleanContent
  });

  if (error) {
    throw new Error(error.message || '举报提交失败，请稍后重试。');
  }
}
