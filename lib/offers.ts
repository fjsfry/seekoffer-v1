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
  isCuratedSample?: boolean;
  sourceLabel?: string;
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

export const curatedOfferSamples: PublicOffer[] = [
  {
    id: 'sample-offer-zju-cs-2026',
    authorName: '整理样本',
    schoolName: '浙江大学',
    major: '计算机科学与技术',
    projectType: '夏令营',
    result: '录取',
    undergraduateBackground: '华东地区 211，专业前 8%，有一段科研训练和省级竞赛经历',
    content: '材料初筛看重排名、科研经历和项目表达，面试主要围绕简历项目、专业基础和未来方向展开。适合作为计算机方向同学准备材料和面试问题的参考样本。',
    isAnonymous: true,
    reportsCount: 0,
    createdAt: '2026-06-26T09:30:00+08:00',
    isCuratedSample: true,
    sourceLabel: '已整理样本'
  },
  {
    id: 'sample-offer-fudan-econ-2026',
    authorName: '整理样本',
    schoolName: '复旦大学',
    major: '应用经济学',
    projectType: '预推免',
    result: '候补',
    undergraduateBackground: '财经类 211，专业前 5%，有论文训练和数模经历',
    content: '候补样本显示经管方向不仅看成绩，也会关注计量、英语和研究问题表达。建议提前准备一版研究兴趣陈述，并把课程、竞赛和实习经历组织成清晰主线。',
    isAnonymous: true,
    reportsCount: 0,
    createdAt: '2026-06-25T19:20:00+08:00',
    isCuratedSample: true,
    sourceLabel: '已整理样本'
  },
  {
    id: 'sample-offer-ustc-auto-2026',
    authorName: '整理样本',
    schoolName: '中国科学技术大学',
    major: '控制科学与工程',
    projectType: '夏令营',
    result: '录取',
    undergraduateBackground: '985，自动化专业前 15%，有机器人项目和导师联系经历',
    content: '这个样本的关键不是排名特别靠前，而是方向匹配和项目细节讲得清楚。控制、机器人、自动化方向同学可以重点准备项目动机、算法选择和实验结果复盘。',
    isAnonymous: true,
    reportsCount: 0,
    createdAt: '2026-06-24T11:10:00+08:00',
    isCuratedSample: true,
    sourceLabel: '已整理样本'
  },
  {
    id: 'sample-offer-nju-business-2026',
    authorName: '整理样本',
    schoolName: '南京大学',
    major: '工商管理',
    projectType: '预推免',
    result: '放弃',
    undergraduateBackground: '综合类 985，专业前 20%，有商赛和咨询实习',
    content: '放弃原因主要是方向和导师匹配度不如另一个 Offer。这个样本适合提醒同学不要只看学校名，也要把导师方向、培养方式和后续去向一起纳入决策。',
    isAnonymous: true,
    reportsCount: 0,
    createdAt: '2026-06-23T15:45:00+08:00',
    isCuratedSample: true,
    sourceLabel: '已整理样本'
  },
  {
    id: 'sample-offer-sjtu-ai-2026',
    authorName: '整理样本',
    schoolName: '上海交通大学',
    major: '人工智能',
    projectType: '夏令营',
    result: '录取',
    undergraduateBackground: '双一流，专业前 3%，有机器学习科研和工程项目',
    content: '面试集中在机器学习基础、项目贡献和代码实现细节。AI 方向申请人建议把简历中的每个项目拆成问题、方法、结果和个人贡献四部分。',
    isAnonymous: true,
    reportsCount: 0,
    createdAt: '2026-06-22T21:15:00+08:00',
    isCuratedSample: true,
    sourceLabel: '已整理样本'
  },
  {
    id: 'sample-offer-pku-law-2026',
    authorName: '整理样本',
    schoolName: '北京大学',
    major: '法学',
    projectType: '推免',
    result: '官方确认',
    undergraduateBackground: '政法类强校，专业前 5%，有论文写作和模拟法庭经历',
    content: '文法方向样本更强调阅读、写作和问题意识。材料里不要只堆获奖，建议把课程论文、研究兴趣和未来导师方向之间的关系说清楚。',
    isAnonymous: true,
    reportsCount: 0,
    createdAt: '2026-06-21T10:00:00+08:00',
    isCuratedSample: true,
    sourceLabel: '已整理样本'
  }
];

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
