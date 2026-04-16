import { baseNoticeProjects } from './notice-source';
import { offerFeedItems } from './portal-data';

export type AdminRole = 'super_admin' | 'content_admin' | 'review_admin' | 'ops_admin';

export type AdminAccount = {
  email: string;
  password: string;
  name: string;
  role: AdminRole;
};

export type AdminDashboardCard = {
  label: string;
  value: string;
  hint: string;
  tone: 'brand' | 'amber' | 'rose' | 'slate';
};

export type AdminRiskItem = {
  id: string;
  title: string;
  detail: string;
  level: 'high' | 'medium' | 'low';
};

export type AdminQuickAction = {
  title: string;
  href: string;
  description: string;
};

export type AdminNoticeRow = {
  id: string;
  title: string;
  school: string;
  department: string;
  noticeType: string;
  publishDate: string;
  deadlineDate: string;
  status: string;
  source: string;
  updatedAt: string;
  manualEdited: boolean;
  operator: string;
};

export type AdminOfferRow = {
  id: string;
  author: string;
  school: string;
  major: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'hidden' | 'deleted';
  reportsCount: number;
  likesCount: number;
  commentsCount: number;
  anonymous: boolean;
  riskFlags: string[];
};

export type AdminCrawlerJob = {
  id: string;
  taskName: string;
  sourceName: string;
  triggerType: 'schedule' | 'manual' | 'retry';
  status: 'running' | 'success' | 'partial_failed' | 'failed';
  startedAt: string;
  endedAt: string;
  duration: string;
  fetchedCount: number;
  newCount: number;
  updatedCount: number;
  failedCount: number;
  errorSummary: string;
};

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: 'active' | 'disabled';
  lastLoginAt: string;
};

export const adminAccounts: AdminAccount[] = [
  {
    email: 'admin@seekoffer.cn',
    password: 'seekoffer-admin',
    name: 'Seekoffer 管理员',
    role: 'super_admin'
  },
  {
    email: 'ops@seekoffer.cn',
    password: 'seekoffer-ops',
    name: '运营值班同学',
    role: 'ops_admin'
  }
];

const sortedNotices = [...baseNoticeProjects].sort((left, right) =>
  right.publishDate.localeCompare(left.publishDate)
);

const latestPublishDate = sortedNotices[0]?.publishDate || '';
const latestUpdateDate =
  [...sortedNotices]
    .map((item) => item.updatedAt?.slice(0, 10) || item.publishDate)
    .sort((left, right) => right.localeCompare(left))[0] || latestPublishDate;

export const adminNoticeRows: AdminNoticeRow[] = sortedNotices.slice(0, 30).map((item, index) => ({
  id: item.id,
  title: item.projectName,
  school: item.schoolName,
  department: item.departmentName,
  noticeType: item.projectType,
  publishDate: item.publishDate,
  deadlineDate: item.deadlineDate,
  status: item.status,
  source: item.sourceSite,
  updatedAt: item.updatedAt || item.publishDate,
  manualEdited: index % 4 === 0 || item.isVerified,
  operator: index % 3 === 0 ? '内容运营' : '系统抓取'
}));

export const adminOfferRows: AdminOfferRow[] = offerFeedItems.map((item, index) => ({
  id: item.id,
  author: item.author,
  school: item.school,
  major: item.goTo.split('·')[1]?.trim() || '待补充',
  createdAt: item.time,
  status: index === 0 ? 'pending' : index === 1 ? 'approved' : index === 2 ? 'hidden' : 'approved',
  reportsCount: index === 0 ? 2 : index === 2 ? 1 : 0,
  likesCount: item.likes,
  commentsCount: 6 + index * 2,
  anonymous: !item.verified,
  riskFlags: index === 0 ? ['待审核'] : index === 2 ? ['隐藏复核'] : []
}));

export const adminCrawlerJobs: AdminCrawlerJob[] = [
  {
    id: 'crawler-20260416-01',
    taskName: '每小时通知同步',
    sourceName: '保研通知网',
    triggerType: 'schedule',
    status: 'success',
    startedAt: '2026-04-16 14:00',
    endedAt: '2026-04-16 14:01',
    duration: '61 秒',
    fetchedCount: 42,
    newCount: 2,
    updatedCount: 5,
    failedCount: 0,
    errorSummary: '运行正常'
  },
  {
    id: 'crawler-20260416-02',
    taskName: '补充源同步',
    sourceName: '保研信息网',
    triggerType: 'schedule',
    status: 'partial_failed',
    startedAt: '2026-04-16 14:00',
    endedAt: '2026-04-16 14:03',
    duration: '3 分 12 秒',
    fetchedCount: 128,
    newCount: 7,
    updatedCount: 18,
    failedCount: 3,
    errorSummary: '3 条详情页解析失败，需人工复核'
  },
  {
    id: 'crawler-20260415-03',
    taskName: '手动补跑',
    sourceName: '保研通知网',
    triggerType: 'manual',
    status: 'failed',
    startedAt: '2026-04-15 22:30',
    endedAt: '2026-04-15 22:31',
    duration: '43 秒',
    fetchedCount: 0,
    newCount: 0,
    updatedCount: 0,
    failedCount: 1,
    errorSummary: '上游接口限流，建议 15 分钟后重试'
  }
];

export const adminUsers: AdminUserRow[] = [
  {
    id: 'admin-1',
    name: 'Seekoffer 管理员',
    email: 'admin@seekoffer.cn',
    role: 'super_admin',
    status: 'active',
    lastLoginAt: '2026-04-16 14:08'
  },
  {
    id: 'admin-2',
    name: '内容运营',
    email: 'content@seekoffer.cn',
    role: 'content_admin',
    status: 'active',
    lastLoginAt: '2026-04-16 13:44'
  },
  {
    id: 'admin-3',
    name: '审核同学',
    email: 'review@seekoffer.cn',
    role: 'review_admin',
    status: 'active',
    lastLoginAt: '2026-04-16 12:57'
  }
];

export function buildAdminDashboardCards(): AdminDashboardCard[] {
  const todayNew = sortedNotices.filter((item) => item.publishDate === latestPublishDate).length;
  const todayUpdated = sortedNotices.filter(
    (item) => (item.updatedAt?.slice(0, 10) || item.publishDate) === latestUpdateDate
  ).length;
  const pendingOffers = adminOfferRows.filter((item) => item.status === 'pending').length;
  const expiredNotices = sortedNotices.filter(
    (item) => item.status === '已截止' || item.deadlineLevel === 'expired'
  ).length;
  const latestCrawler = adminCrawlerJobs[0];

  return [
    {
      label: '今日新增通知数',
      value: String(todayNew),
      hint: `按最近发布日 ${latestPublishDate} 统计`,
      tone: 'brand'
    },
    {
      label: '今日更新通知数',
      value: String(todayUpdated),
      hint: `按最近更新日 ${latestUpdateDate} 统计`,
      tone: 'slate'
    },
    {
      label: '待审核 offer 数',
      value: String(pendingOffers),
      hint: '优先处理待审核和被举报内容',
      tone: 'amber'
    },
    {
      label: '已失效通知数',
      value: String(expiredNotices),
      hint: '建议归档，避免前台继续暴露',
      tone: 'rose'
    },
    {
      label: '爬虫最近一次状态',
      value: latestCrawler.status === 'success' ? '成功' : latestCrawler.status === 'partial_failed' ? '部分失败' : '失败',
      hint: `${latestCrawler.sourceName} · ${latestCrawler.startedAt}`,
      tone: latestCrawler.status === 'success' ? 'brand' : 'amber'
    }
  ];
}

export function buildAdminRiskItems(): AdminRiskItem[] {
  const urgentNotices = sortedNotices
    .filter((item) => item.deadlineLevel === 'today' || item.deadlineLevel === 'within3days')
    .slice(0, 2)
    .map((item) => ({
      id: `notice-${item.id}`,
      title: `${item.schoolName} · 即将截止`,
      detail: `${item.projectName}，截止时间 ${item.deadlineDate}`,
      level: 'high' as const
    }));

  const crawlerRisk = adminCrawlerJobs
    .filter((job) => job.status !== 'success')
    .slice(0, 1)
    .map((job) => ({
      id: `crawler-${job.id}`,
      title: `${job.sourceName} 抓取异常`,
      detail: job.errorSummary,
      level: 'medium' as const
    }));

  const offerRisk = adminOfferRows
    .filter((item) => item.reportsCount > 0 || item.status === 'pending')
    .slice(0, 2)
    .map((item) => ({
      id: `offer-${item.id}`,
      title: `${item.school} Offer 池内容待处理`,
      detail: `${item.author}，举报 ${item.reportsCount} 次，状态 ${item.status}`,
      level: item.status === 'pending' ? ('high' as const) : ('low' as const)
    }));

  return [...urgentNotices, ...crawlerRisk, ...offerRisk];
}

export const adminQuickActions: AdminQuickAction[] = [
  {
    title: '新建通知',
    href: '/admin/notices',
    description: '快速补录爬虫没抓到的重要院校通知'
  },
  {
    title: '重跑爬虫',
    href: '/admin/crawlers',
    description: '查看失败任务并手动触发补跑'
  },
  {
    title: '查看待审核内容',
    href: '/admin/offers',
    description: '优先处理待审核和被举报的 Offer'
  },
  {
    title: '查看异常日志',
    href: '/admin/crawlers',
    description: '定位失败数据源、限流和解析异常'
  }
];
