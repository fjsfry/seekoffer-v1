'use client';

import {
  Activity,
  ArrowRight,
  Bell,
  CheckCircle2,
  ClipboardList,
  Download,
  Globe2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UsersRound
} from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import {
  AdminMetricCard,
  AdminMiniBars,
  AdminPanel,
  AdminStatusBadge,
  adminClassNames
} from '@/components/admin-ui';
import type { AdminFeedbackRow, AdminMetric, AdminNoticeRow, AdminOfferRow, TrendPoint } from '@/lib/admin-data';
import { getAdminErrorMessage, invokeAdminApi } from '@/lib/admin-api';
import { formatBeijingDateTime } from '@/lib/admin-time';

const dashboardIcons = [Activity, Globe2, UsersRound, Bell, ClipboardList, ShieldAlert];

const emptyOverview: AdminOverviewMetrics = {
  totalUsers: 0,
  todayUsers: 0,
  normalUsers: 0,
  restrictedUsers: 0,
  bannedUsers: 0,
  deletedUsers: 0,
  totalNotices: 0,
  pendingNotices: 0,
  publishedNotices: 0,
  rejectedNotices: 0,
  hiddenNotices: 0,
  deletedNotices: 0,
  todayNotices: 0,
  totalOffers: 0,
  pendingOffers: 0,
  approvedOffers: 0,
  hiddenOffers: 0,
  deletedOffers: 0,
  todayOffers: 0,
  totalApplications: 0,
  todayApplications: 0,
  totalFeedback: 0,
  pendingFeedback: 0,
  processingFeedback: 0,
  resolvedFeedback: 0,
  closedFeedback: 0
};

const emptyAnalytics: AdminAnalyticsPayload = {
  metrics: {
    onlineVisitors: 0,
    totalVisitors: 0,
    todayVisitors: 0,
    todayPageViews: 0,
    activeWindowMinutes: 2
  },
  onlineVisitors: [],
  recentVisitors: []
};

export default function AdminDashboardPage() {
  const [overviewMetrics, setOverviewMetrics] = useState<AdminOverviewMetrics>(emptyOverview);
  const [analytics, setAnalytics] = useState<AdminAnalyticsPayload>(emptyAnalytics);
  const [metrics, setMetrics] = useState<AdminMetric[]>(buildLiveMetrics(emptyOverview, emptyAnalytics.metrics));
  const [trends, setTrends] = useState<TrendPoint[]>(buildEmptyTrends());
  const [pendingNotices, setPendingNotices] = useState<AdminNoticeRow[]>([]);
  const [pendingOffers, setPendingOffers] = useState<AdminOfferRow[]>([]);
  const [latestFeedback, setLatestFeedback] = useState<AdminFeedbackRow[]>([]);
  const [message, setMessage] = useState('正在更新运营数据...');
  const [dataError, setDataError] = useState('');
  const [lastLoadedAt, setLastLoadedAt] = useState('');

  async function loadDashboard() {
    try {
      const [overview, analyticsData, notices, offers, feedback] = await Promise.all([
        invokeAdminApi<{ metrics: AdminOverviewMetrics; trends: TrendPoint[] }>({ resource: 'overview', action: 'get' }),
        invokeAdminApi<AdminAnalyticsPayload>({ resource: 'analytics', action: 'overview' }),
        invokeAdminApi<{ notices: NoticeApiRow[] }>({
          resource: 'notices',
          action: 'list',
          page: 1,
          pageSize: 5,
          filters: { status: 'pending' },
          sort: 'updated_desc'
        }),
        invokeAdminApi<{ offers: OfferApiRow[] }>({ resource: 'offers', action: 'list', page: 1, pageSize: 20 }),
        invokeAdminApi<{ feedback: FeedbackApiRow[] }>({ resource: 'feedback', action: 'list', page: 1, pageSize: 5 })
      ]);

      setOverviewMetrics(overview.metrics);
      setAnalytics(analyticsData);
      setMetrics(buildLiveMetrics(overview.metrics, analyticsData.metrics));
      setTrends(overview.trends?.length ? overview.trends : buildEmptyTrends());
      setPendingNotices(notices.notices.map(mapNoticeApiRow));
      setPendingOffers(offers.offers.filter((item) => item.review_status === 'pending' || item.reports_count > 0).slice(0, 5).map(mapOfferApiRow));
      setLatestFeedback(feedback.feedback.map(mapFeedbackApiRow));
      setDataError('');
      setLastLoadedAt(new Date().toISOString());
      setMessage('数据已更新，待办、趋势和访问情况已准备好。');
    } catch (error) {
      const errorMessage = getAdminErrorMessage(error, '数据暂时无法更新，请稍后重试。');
      setOverviewMetrics(emptyOverview);
      setAnalytics(emptyAnalytics);
      setMetrics(buildLiveMetrics(emptyOverview, emptyAnalytics.metrics));
      setTrends(buildEmptyTrends());
      setPendingNotices([]);
      setPendingOffers([]);
      setLatestFeedback([]);
      setDataError(errorMessage);
      setMessage(`数据暂时无法更新：${errorMessage}`);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);
    const interval = window.setInterval(() => {
      void loadDashboard();
    }, 30_000);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);

  const maxNotices = Math.max(...trends.map((item) => item.notices), 1);
  const maxOffers = Math.max(...trends.map((item) => item.offers), 1);
  const dataHealthy = !dataError;
  const todoCards = [
    { href: '/admin/notices', label: '通知审核', value: overviewMetrics.pendingNotices, hint: '待发布通知', tone: 'bg-amber-50 text-amber-700' },
    { href: '/admin/feedback', label: '反馈工单', value: overviewMetrics.pendingFeedback, hint: '待处理举报', tone: 'bg-rose-50 text-rose-700' },
    { href: '/admin/offers', label: '高风险操作', value: overviewMetrics.pendingOffers, hint: 'Offer 审核', tone: 'bg-violet-50 text-violet-700' }
  ];
  const recentActivities = [
    ...pendingNotices.slice(0, 2).map((item) => ({
      label: `新通知待审：${item.school}`,
      time: item.submittedAt,
      href: '/admin/notices',
      tone: 'bg-blue-500'
    })),
    ...pendingOffers.slice(0, 2).map((item) => ({
      label: `Offer 待审：${item.school}`,
      time: item.submittedAt,
      href: '/admin/offers',
      tone: 'bg-emerald-500'
    })),
    ...latestFeedback.slice(0, 2).map((item) => ({
      label: `${item.type}工单：${item.module}`,
      time: item.submittedAt,
      href: '/admin/feedback',
      tone: 'bg-amber-500'
    }))
  ].slice(0, 5);
  const operationAlerts = recentActivities.length
    ? recentActivities
    : [
        { label: `当前待审核通知 ${formatNumber(overviewMetrics.pendingNotices)} 条`, time: '实时', href: '/admin/notices', tone: 'bg-blue-500' },
        { label: `当前待处理反馈 ${formatNumber(overviewMetrics.pendingFeedback)} 条`, time: '实时', href: '/admin/feedback', tone: 'bg-amber-500' },
        { label: `实时在线访客 ${formatNumber(analytics.metrics.onlineVisitors)} 人`, time: `最近 ${analytics.metrics.activeWindowMinutes} 分钟`, href: '/admin/dashboard', tone: 'bg-emerald-500' }
      ];
  const quickLinks: Array<{ href: string; label: string; hint: string; icon: typeof Bell }> = [
    { href: '/admin/notices', label: '通知管理', hint: '审核与发布通知', icon: Bell },
    { href: '/admin/offers', label: 'Offer池管理', hint: '处理社区动态', icon: ClipboardList },
    { href: '/admin/settings', label: '系统设置', hint: '配置安全策略', icon: ShieldCheck }
  ];

  function exportDashboardSnapshot() {
    const payload = {
      generatedAt: new Date().toISOString(),
      metrics: overviewMetrics,
      analytics: analytics.metrics,
      trends
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seekoffer-admin-overview-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
    setMessage('已导出当前数据概览快照。');
  }

  return (
    <AdminShell title="数据概览">
      <div className="space-y-6">
        <section
          className={adminClassNames(
            'flex flex-col gap-4 rounded-[22px] border px-5 py-4 text-sm shadow-sm lg:flex-row lg:items-center lg:justify-between',
            dataHealthy ? 'border-blue-100 bg-blue-50/80 text-blue-700' : 'border-rose-100 bg-rose-50/80 text-rose-700'
          )}
        >
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="inline-flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              工作台状态：{dataHealthy ? '正常' : '需要关注'}
            </span>
            <span>最近更新：{lastLoadedAt ? formatBeijingDateTime(lastLoadedAt) : '等待刷新'}</span>
            <span>{message}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={exportDashboardSnapshot}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
            >
              <Download className="h-4 w-4" />
              导出日报
            </button>
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              刷新数据
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {metrics.map((metric, index) => (
            <AdminMetricCard key={metric.label} metric={metric} icon={dashboardIcons[index]} />
          ))}
        </section>

        <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(360px,0.8fr)]">
          <AdminPanel
            title="今日待办"
            description="优先处理会影响内容质量、用户体验和公开展示的事项。"
            action={<Link href="/admin/notices" className="text-sm font-semibold text-blue-600">进入工作台 →</Link>}
          >
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {todoCards.map((item) => (
                <Link key={item.label} href={item.href} className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-blue-50/40">
                  <div className="flex items-center justify-between gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.tone}`}>
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
                  </div>
                  <div className="mt-4 text-2xl font-semibold text-slate-950">{formatNumber(item.value)}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-800">{item.label}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.hint}</div>
                </Link>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel
            title="运营状态"
            action={
              <span className={adminClassNames('rounded-full px-3 py-1 text-xs font-semibold', dataHealthy ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
                {dataHealthy ? '整体健康' : '需要排查'}
              </span>
            }
          >
            <div className="space-y-3 p-5 text-sm">
              {[
                ['数据更新', dataHealthy ? '正常' : '需要刷新'],
                ['内容规模', `通知 ${formatNumber(overviewMetrics.totalNotices)} 条 / 访客 ${formatNumber(analytics.metrics.totalVisitors)} 人`],
                ['待处理事项', `通知 ${formatNumber(overviewMetrics.pendingNotices)} / Offer ${formatNumber(overviewMetrics.pendingOffers)} / 反馈 ${formatNumber(overviewMetrics.pendingFeedback)}`],
                ['异常告警', overviewMetrics.bannedUsers + overviewMetrics.restrictedUsers > 0 ? `封禁 ${formatNumber(overviewMetrics.bannedUsers)} / 限制 ${formatNumber(overviewMetrics.restrictedUsers)}` : '无告警']
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <span className="flex items-center gap-2 text-slate-600">
                    <CheckCircle2 className={adminClassNames('h-4 w-4', dataHealthy ? 'text-emerald-600' : 'text-rose-600')} />
                    {label}
                  </span>
                  <span className={adminClassNames('font-semibold', dataHealthy ? 'text-emerald-700' : 'text-rose-700')}>{value}</span>
                </div>
              ))}
              <Link href="/admin/settings" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
                查看系统详情 <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </AdminPanel>

          <AdminPanel title="重点提醒" action={<Link href="/admin/logs" className="text-sm font-semibold text-teal-700">查看更多 →</Link>}>
            <div className="space-y-3 p-5 text-sm">
              {operationAlerts.map((item) => (
                <Link key={`${item.href}-${item.label}`} href={item.href} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-3 transition hover:border-blue-200 hover:bg-blue-50/30">
                  <span className={adminClassNames('mt-1 h-2.5 w-2.5 rounded-full', item.tone)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-slate-700">{item.label}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.time}</div>
                  </div>
                </Link>
              ))}
            </div>
          </AdminPanel>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <VisitorPanel
            title="实时在线访客"
            description={`最近 ${analytics.metrics.activeWindowMinutes} 分钟内仍在浏览的前台访客`}
            rows={analytics.onlineVisitors}
            empty="当前暂无在线访客。"
          />
          <VisitorPanel
            title="最近访问"
            description="按最后活跃时间排序，帮助你判断站点访问节奏"
            rows={analytics.recentVisitors}
            empty="暂无访客记录。"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <AdminPanel
            title="最近7天用户增长趋势"
            action={<span className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">近7天</span>}
          >
            <AdminMiniBars data={trends} valueKey="users" color="bg-blue-500" />
          </AdminPanel>

          <AdminPanel
            title="近7天内容提交趋势"
            action={<span className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">近7天</span>}
          >
            <div className="grid h-64 grid-cols-7 items-end gap-4 px-6 pb-6 pt-8">
              {trends.map((point) => (
                <div key={point.date} className="flex flex-col items-center gap-2">
                  <div className="flex h-40 items-end gap-2">
                    <div
                      className="w-4 rounded-t bg-blue-500"
                      style={{ height: `${Math.max((point.notices / maxNotices) * 100, 8)}%` }}
                      title={`通知 ${point.notices}`}
                    />
                    <div
                      className="w-4 rounded-t bg-emerald-500"
                      style={{ height: `${Math.max((point.offers / maxOffers) * 100, 8)}%` }}
                      title={`Offer ${point.offers}`}
                    />
                  </div>
                  <span className="text-xs text-slate-400">{point.date}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-6 border-t border-slate-100 py-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-blue-500" /> 通知新增数</span>
              <span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-emerald-500" /> Offer提交数</span>
            </div>
          </AdminPanel>
        </section>

        <section className="grid gap-6 2xl:grid-cols-3">
          <DashboardTable
            title="待审核通知"
            href="/admin/notices"
            columns={['标题', '学校', '类型', '提交时间', '状态']}
            rows={pendingNotices.map((item) => [
              item.title,
              item.school,
              item.type,
              item.submittedAt,
              <AdminStatusBadge key={`${item.id}-status`} status={item.status} />
            ])}
            total={overviewMetrics.pendingNotices}
          />

          <DashboardTable
            title="待审核Offer"
            href="/admin/offers"
            columns={['学校', '专业', '结果', '提交时间', '状态']}
            rows={pendingOffers.map((item) => [
              item.school,
              item.major,
              item.result,
              item.submittedAt,
              <AdminStatusBadge key={`${item.id}-status`} status={item.status} />
            ])}
            total={overviewMetrics.pendingOffers}
          />

          <DashboardTable
            title="最新反馈 / 举报"
            href="/admin/feedback"
            columns={['类型', '内容', '提交时间', '状态']}
            rows={latestFeedback.map((item) => [
              item.type,
              item.content,
              item.submittedAt,
              <AdminStatusBadge key={`${item.id}-status`} status={item.status} />
            ])}
            total={overviewMetrics.totalFeedback}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map((item) => {
            const LinkIcon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="group rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <LinkIcon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
                </div>
                <div className="mt-4 font-semibold text-slate-950">{item.label}</div>
                <div className="mt-1 text-sm text-slate-500">{item.hint}</div>
              </Link>
            );
          })}
        </section>
      </div>
    </AdminShell>
  );
}

type AdminOverviewMetrics = {
  totalUsers: number;
  todayUsers: number;
  normalUsers: number;
  restrictedUsers: number;
  bannedUsers: number;
  deletedUsers: number;
  totalNotices: number;
  pendingNotices: number;
  publishedNotices: number;
  rejectedNotices: number;
  hiddenNotices: number;
  deletedNotices: number;
  todayNotices: number;
  totalOffers: number;
  pendingOffers: number;
  approvedOffers: number;
  hiddenOffers: number;
  deletedOffers: number;
  todayOffers: number;
  totalApplications: number;
  todayApplications: number;
  totalFeedback: number;
  pendingFeedback: number;
  processingFeedback: number;
  resolvedFeedback: number;
  closedFeedback: number;
};

type AdminAnalyticsMetrics = {
  onlineVisitors: number;
  totalVisitors: number;
  todayVisitors: number;
  todayPageViews: number;
  activeWindowMinutes: number;
};

type AdminVisitorRow = {
  visitor_id: string;
  first_seen_at: string;
  last_seen_at: string;
  last_path: string;
  last_title: string;
  last_referrer: string;
  last_locale: string;
  last_timezone: string;
  visit_count: number;
  page_view_count: number;
};

type AdminAnalyticsPayload = {
  metrics: AdminAnalyticsMetrics;
  onlineVisitors: AdminVisitorRow[];
  recentVisitors: AdminVisitorRow[];
};

function buildLiveMetrics(metrics: AdminOverviewMetrics, analytics: AdminAnalyticsMetrics): AdminMetric[] {
  return [
    { label: '实时在线', value: formatNumber(analytics.onlineVisitors), hint: `最近 ${analytics.activeWindowMinutes} 分钟心跳`, tone: 'green' },
    { label: '累计访客', value: formatNumber(analytics.totalVisitors), hint: `今日新增 ${formatNumber(analytics.todayVisitors)}，PV ${formatNumber(analytics.todayPageViews)}`, tone: 'blue' },
    { label: '注册用户', value: formatNumber(metrics.totalUsers), hint: `今日注册 ${formatNumber(metrics.todayUsers)}`, tone: 'slate' },
    { label: '待审核通知', value: formatNumber(metrics.pendingNotices), hint: `通知总数 ${formatNumber(metrics.totalNotices)}`, tone: 'amber' },
    { label: '待审核 Offer', value: formatNumber(metrics.pendingOffers), hint: `Offer 总数 ${formatNumber(metrics.totalOffers)}`, tone: 'purple' },
    { label: '待处理举报', value: formatNumber(metrics.pendingFeedback), hint: `反馈总数 ${formatNumber(metrics.totalFeedback)}`, tone: 'rose' }
  ];
}

function buildEmptyTrends(): TrendPoint[] {
  return Array.from({ length: 7 }, (_, index) => ({
    date: `D-${6 - index}`,
    users: 0,
    notices: 0,
    offers: 0,
    applications: 0
  }));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value || 0);
}

type NoticeApiRow = {
  id: string;
  school_name: string;
  department_name: string;
  project_name: string;
  project_type: string;
  source_link: string;
  publish_date: string;
  deadline_date: string;
  admin_status?: string;
  is_private?: boolean;
  created_at?: string;
  updated_at_ts?: string;
};

function mapNoticeApiRow(row: NoticeApiRow): AdminNoticeRow {
  return {
    id: row.id,
    title: row.project_name || '未命名通知',
    school: row.school_name || '待识别学校',
    department: row.department_name || '待补充学院',
    type: row.project_type || '其他',
    sourceUrl: row.source_link || `/notices/${row.id}`,
    submitter: row.is_private ? '用户提交' : '平台收录',
    submittedAt: formatBeijingDateTime(row.updated_at_ts || row.created_at, row.publish_date || '-'),
    deadline: row.deadline_date || '待确认',
    status: mapNoticeStatus(row.admin_status),
    views: 0,
    saves: 0
  };
}

function mapNoticeStatus(status?: string): AdminNoticeRow['status'] {
  if (status === 'pending') return '待审核';
  if (status === 'rejected') return '已驳回';
  if (status === 'hidden') return '已下架';
  if (status === 'deleted') return '已删除';
  return '已发布';
}

type OfferApiRow = {
  id: string;
  author_name: string;
  school_name: string;
  major: string;
  project_type: string;
  result: string;
  undergraduate_background: string;
  is_anonymous: boolean;
  review_status: string;
  reports_count: number;
  created_at: string;
};

function mapOfferApiRow(row: OfferApiRow): AdminOfferRow {
  return {
    id: row.id,
    user: row.author_name || '匿名用户',
    avatar: (row.author_name || '匿').slice(0, 1),
    school: row.school_name || '待补充学校',
    major: row.major || '待补充专业',
    projectType: row.project_type || '其他',
    result: row.result || '待确认',
    background: row.undergraduate_background || '未填写',
    anonymous: row.is_anonymous,
    submittedAt: formatBeijingDateTime(row.created_at),
    status: mapOfferStatus(row.review_status),
    reports: row.reports_count || 0
  };
}

function mapOfferStatus(status?: string): AdminOfferRow['status'] {
  if (status === 'approved') return '已通过';
  if (status === 'rejected') return '已驳回';
  if (status === 'hidden') return '已隐藏';
  if (status === 'deleted') return '已删除';
  return '待审核';
}

type FeedbackApiRow = {
  id: string;
  type: string;
  module: string;
  target_id: string;
  content: string;
  status: string;
  handler: string;
  created_at: string;
};

function mapFeedbackApiRow(row: FeedbackApiRow): AdminFeedbackRow {
  return {
    id: row.id,
    type: row.type === 'report' ? '举报' : '反馈',
    module: row.module === 'notice' ? '通知内容' : row.module === 'offer' ? 'Offer信息' : row.module === 'user' ? '用户行为' : '系统功能',
    user: row.target_id || '用户反馈',
    content: row.content || '-',
    submittedAt: formatBeijingDateTime(row.created_at),
    status: row.status === 'processing' ? '处理中' : row.status === 'resolved' ? '已解决' : row.status === 'closed' ? '已关闭' : '待处理',
    handler: row.handler || '-'
  };
}

function VisitorPanel({
  title,
  description,
  rows,
  empty
}: {
  title: string;
  description: string;
  rows: AdminVisitorRow[];
  empty: string;
}) {
  return (
    <AdminPanel
      title={title}
      action={<span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">自动刷新 30s</span>}
    >
      <div className="px-5 pb-2 pt-4 text-sm text-slate-500">{description}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3">访客</th>
              <th className="px-4 py-3">当前位置</th>
              <th className="px-4 py-3">最后活跃</th>
              <th className="px-4 py-3">访问次数</th>
              <th className="px-4 py-3">页面浏览</th>
              <th className="px-4 py-3">地区线索</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.visitor_id} className={adminClassNames('border-t border-slate-100', index % 2 === 1 && 'bg-slate-50/40')}>
                <td className="px-4 py-3 font-mono text-xs text-slate-600" title={row.visitor_id}>
                  {shortVisitorId(row.visitor_id)}
                </td>
                <td className="max-w-[260px] truncate px-4 py-3 text-slate-700" title={row.last_title || row.last_path}>
                  <div className="font-medium text-slate-800">{row.last_path || '/'}</div>
                  <div className="truncate text-xs text-slate-400">{row.last_title || '未记录标题'}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{formatRelativeTime(row.last_seen_at)}</td>
                <td className="px-4 py-3 text-slate-600">{formatNumber(row.visit_count)}</td>
                <td className="px-4 py-3 text-slate-600">{formatNumber(row.page_view_count)}</td>
                <td className="px-4 py-3 text-slate-500">{row.last_locale || '-'}{row.last_timezone ? ` · ${row.last_timezone}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length ? <div className="border-t border-slate-100 px-5 py-8 text-center text-sm text-slate-500">{empty}</div> : null}
    </AdminPanel>
  );
}

function shortVisitorId(value: string) {
  if (!value) return '-';
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '-';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return `${diffSeconds} 秒前`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} 天前`;
}

function DashboardTable({
  title,
  href,
  columns,
  rows,
  total
}: {
  title: string;
  href: string;
  columns: string[];
  rows: Array<Array<React.ReactNode>>;
  total: number;
}) {
  return (
    <AdminPanel title={title} action={<Link href={href} className="text-sm font-semibold text-blue-600">查看全部</Link>}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${title}-${rowIndex}`} className={adminClassNames('border-t border-slate-100', rowIndex % 2 === 1 && 'bg-slate-50/40')}>
                {row.map((cell, cellIndex) => (
                  <td key={`${title}-${rowIndex}-${cellIndex}`} className="max-w-[220px] truncate px-4 py-3 text-slate-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length ? <div className="border-t border-slate-100 px-5 py-8 text-center text-sm text-slate-500">暂无需要处理的记录。</div> : null}
      <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-500">共 {formatNumber(total)} 条</div>
    </AdminPanel>
  );
}
