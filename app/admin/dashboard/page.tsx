'use client';

import {
  Activity,
  ArrowRight,
  Bell,
  ClipboardList,
  Download,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  UsersRound
} from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import {
  AdminMiniBars,
  AdminPanel,
  AdminStatusBadge,
  adminClassNames
} from '@/components/admin-ui';
import type { AdminFeedbackRow, AdminNoticeRow, AdminOfferRow, TrendPoint } from '@/lib/admin-data';
import { getAdminErrorMessage, invokeAdminApi } from '@/lib/admin-api';
import { formatBeijingDateTime } from '@/lib/admin-time';

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
  const [trends, setTrends] = useState<TrendPoint[]>(buildEmptyTrends());
  const [pendingNotices, setPendingNotices] = useState<AdminNoticeRow[]>([]);
  const [pendingOffers, setPendingOffers] = useState<AdminOfferRow[]>([]);
  const [latestFeedback, setLatestFeedback] = useState<AdminFeedbackRow[]>([]);
  const [message, setMessage] = useState('');
  const [dataError, setDataError] = useState('');

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
      setTrends(overview.trends?.length ? overview.trends : buildEmptyTrends());
      setPendingNotices(notices.notices.map(mapNoticeApiRow));
      setPendingOffers(offers.offers.filter((item) => item.review_status === 'pending' || item.reports_count > 0).slice(0, 5).map(mapOfferApiRow));
      setLatestFeedback(feedback.feedback.map(mapFeedbackApiRow));
      setDataError('');
      setMessage('');
    } catch (error) {
      const errorMessage = getAdminErrorMessage(error, '数据暂时无法更新，请稍后重试。');
      setOverviewMetrics(emptyOverview);
      setAnalytics(emptyAnalytics);
      setTrends(buildEmptyTrends());
      setPendingNotices([]);
      setPendingOffers([]);
      setLatestFeedback([]);
      setDataError(errorMessage);
      setMessage(errorMessage);
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
  const pendingTotal = overviewMetrics.pendingNotices + overviewMetrics.pendingOffers + overviewMetrics.pendingFeedback;
  const recentRegistrations = trends.reduce((total, item) => total + item.users, 0);
  const totalAudienceUsers = Math.max(analytics.metrics.totalVisitors, overviewMetrics.totalUsers);
  const registrationConversion = totalAudienceUsers > 0
    ? Math.min((overviewMetrics.totalUsers / totalAudienceUsers) * 100, 100)
    : 0;
  const todoCards = [
    { href: '/admin/notices', label: '待审核通知', value: overviewMetrics.pendingNotices, hint: '确认后进入通知库', icon: Bell, tone: 'bg-amber-50 text-amber-700' },
    { href: '/admin/offers', label: '待审核 Offer', value: overviewMetrics.pendingOffers, hint: '核验投稿真实性', icon: ClipboardList, tone: 'bg-violet-50 text-violet-700' },
    { href: '/admin/feedback', label: '待处理举报', value: overviewMetrics.pendingFeedback, hint: '优先处理用户风险', icon: ShieldAlert, tone: 'bg-rose-50 text-rose-700' }
  ];
  const secondaryMetrics = [
    {
      href: '/admin/dashboard',
      label: '今日新增访客',
      value: formatNumber(analytics.metrics.todayVisitors),
      hint: `实时在线 ${formatNumber(analytics.metrics.onlineVisitors)}`,
      icon: Activity,
      tone: 'bg-emerald-50 text-emerald-700'
    },
    {
      href: '/admin/notices',
      label: '通知内容',
      value: formatNumber(overviewMetrics.totalNotices),
      hint: `今日新增 ${formatNumber(overviewMetrics.todayNotices)}`,
      icon: Bell,
      tone: 'bg-blue-50 text-blue-700'
    },
    {
      href: '/admin/offers',
      label: 'Offer 内容',
      value: formatNumber(overviewMetrics.totalOffers),
      hint: `今日新增 ${formatNumber(overviewMetrics.todayOffers)}`,
      icon: ClipboardList,
      tone: 'bg-violet-50 text-violet-700'
    },
    {
      href: pendingTotal > 0 ? '/admin/notices' : '/admin/settings',
      label: '待处理事项',
      value: formatNumber(pendingTotal),
      hint: pendingTotal > 0 ? '通知、Offer 与反馈' : '当前无积压',
      icon: ShieldAlert,
      tone: pendingTotal > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
    }
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
    <AdminShell title="数据概览" description="聚焦用户增长、内容质量与今日待办，快速判断下一步。">
      <div className="space-y-5">
        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_8px_28px_rgba(15,23,42,0.035)] xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className={adminClassNames('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', dataHealthy ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-slate-950">{dataHealthy ? '今日运营数据已就绪' : '数据需要关注'}</span>
                <span className={adminClassNames('rounded-md px-2 py-1 text-xs font-semibold', pendingTotal > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>
                  {pendingTotal > 0 ? `待处理 ${formatNumber(pendingTotal)} 项` : '暂无积压'}
                </span>
              </div>
              {message ? <p className="mt-1 line-clamp-1 text-sm text-rose-600">{message}</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-emerald-50/60 hover:text-teal-800"
            >
              <RefreshCw className="h-4 w-4" />
              刷新
            </button>
            <button
              type="button"
              onClick={exportDashboardSnapshot}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-800 px-4 text-sm font-semibold text-white transition hover:bg-teal-900"
            >
              <Download className="h-4 w-4" />
              导出日报
            </button>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)] lg:p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-100">
                  <UsersRound className="h-6 w-6" />
                </span>
                <h2 className="text-lg font-semibold text-slate-950">累计用户</h2>
              </div>
              <span className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
                今日新增 {formatNumber(analytics.metrics.todayVisitors)}
              </span>
            </div>

            <div className="mt-8 text-6xl font-semibold leading-none text-slate-950 tabular-nums">{formatNumber(totalAudienceUsers)}</div>

            <dl className="mt-8 grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-100 pt-5">
              <div className="pr-4">
                <dd className="text-xl font-semibold text-slate-950 tabular-nums">{formatNumber(analytics.metrics.todayVisitors)}</dd>
                <dt className="mt-1 text-sm text-slate-500">新增访客</dt>
              </div>
              <div className="px-4">
                <dd className="text-xl font-semibold text-slate-950 tabular-nums">{formatNumber(analytics.metrics.todayPageViews)}</dd>
                <dt className="mt-1 text-sm text-slate-500">今日浏览</dt>
              </div>
              <div className="pl-4">
                <dd className="text-xl font-semibold text-slate-950 tabular-nums">{formatNumber(analytics.metrics.onlineVisitors)}</dd>
                <dt className="mt-1 text-sm text-slate-500">实时在线</dt>
              </div>
            </dl>
          </article>

          <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)] lg:p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100">
                  <UserPlus className="h-6 w-6" />
                </span>
                <h2 className="text-lg font-semibold text-slate-950">注册用户</h2>
              </div>
              <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
                转化率 {registrationConversion.toFixed(1)}%
              </span>
            </div>

            <div className="mt-8 text-6xl font-semibold leading-none text-slate-950 tabular-nums">{formatNumber(overviewMetrics.totalUsers)}</div>
            <div
              className="mt-6 h-1.5 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-label="注册转化率"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Number(registrationConversion.toFixed(1))}
            >
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${registrationConversion}%` }} />
            </div>

            <dl className="mt-6 grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-100 pt-5">
              <div className="pr-4">
                <dd className="text-xl font-semibold text-slate-950 tabular-nums">{formatNumber(overviewMetrics.todayUsers)}</dd>
                <dt className="mt-1 text-sm text-slate-500">今日注册</dt>
              </div>
              <div className="px-4">
                <dd className="text-xl font-semibold text-slate-950 tabular-nums">{formatNumber(recentRegistrations)}</dd>
                <dt className="mt-1 text-sm text-slate-500">近 7 日新增</dt>
              </div>
              <div className="pl-4">
                <dd className="text-xl font-semibold text-slate-950 tabular-nums">{formatNumber(overviewMetrics.normalUsers)}</dd>
                <dt className="mt-1 text-sm text-slate-500">正常账号</dt>
              </div>
            </dl>
          </article>
        </section>

        <section className="grid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.035)] sm:grid-cols-2 xl:grid-cols-4">
          {secondaryMetrics.map((item, index) => {
            const MetricIcon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={adminClassNames(
                  'group flex min-w-0 items-center gap-4 px-5 py-4 transition hover:bg-slate-50',
                  index > 0 && 'border-t border-slate-100 sm:border-l sm:border-t-0',
                  index === 2 && 'sm:border-t xl:border-t-0'
                )}
              >
                <span className={adminClassNames('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', item.tone)}>
                  <MetricIcon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-slate-400">{item.label}</span>
                  <span className="mt-0.5 block text-2xl font-semibold text-slate-950">{item.value}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-teal-700" />
              </Link>
            );
          })}
        </section>

        <section className="grid gap-5 2xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
          <AdminPanel
            title="用户增长"
            description="近 7 日注册用户变化，用于判断增长节奏与转化表现。"
            action={<span className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">近 7 日</span>}
          >
            <AdminMiniBars data={trends} valueKey="users" color="bg-teal-700" />
            <div className="grid grid-cols-3 border-t border-slate-100 text-center">
              <div className="px-3 py-4"><div className="text-xs text-slate-400">累计用户</div><div className="mt-1 font-semibold text-slate-900">{formatNumber(totalAudienceUsers)}</div></div>
              <div className="border-x border-slate-100 px-3 py-4"><div className="text-xs text-slate-400">注册用户</div><div className="mt-1 font-semibold text-slate-900">{formatNumber(overviewMetrics.totalUsers)}</div></div>
              <div className="px-3 py-4"><div className="text-xs text-slate-400">注册转化率</div><div className="mt-1 font-semibold text-slate-900">{registrationConversion.toFixed(1)}%</div></div>
            </div>
          </AdminPanel>

          <AdminPanel
            title="优先处理"
            description="影响公开内容和用户体验的事项会优先出现在这里。"
            action={<span className={adminClassNames('rounded-md px-3 py-1 text-xs font-semibold', pendingTotal > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>{pendingTotal > 0 ? `共 ${formatNumber(pendingTotal)} 项` : '已清空'}</span>}
          >
            <div className="divide-y divide-slate-100 px-5">
              {todoCards.map((item) => {
                const TodoIcon = item.icon;
                return (
                  <Link key={item.label} href={item.href} className="group flex items-center gap-3 py-4">
                    <span className={adminClassNames('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', item.tone)}>
                      <TodoIcon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-800">{item.label}</span>
                    </span>
                    <span className="text-xl font-semibold text-slate-950">{formatNumber(item.value)}</span>
                    <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-teal-700" />
                  </Link>
                );
              })}
              <Link href="/admin/notices" className="inline-flex items-center gap-2 py-4 text-sm font-semibold text-teal-700">
                进入审核工作台 <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </AdminPanel>
        </section>

        <section>
          <AdminPanel
            title="内容增长"
            description="近 7 日通知与 Offer 内容新增情况。"
            action={<span className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">近 7 日</span>}
          >
            <div className="grid h-52 grid-cols-7 items-end gap-3 px-6 pb-5 pt-6">
              {trends.map((point) => (
                <div key={point.date} className="flex min-w-0 flex-col items-center gap-2">
                  <div className="flex h-28 items-end gap-1.5">
                    <div
                      className="w-3 rounded-t-sm bg-blue-500"
                      style={{ height: `${Math.max((point.notices / maxNotices) * 100, 8)}%` }}
                      title={`通知 ${point.notices}`}
                    />
                    <div
                      className="w-3 rounded-t-sm bg-emerald-500"
                      style={{ height: `${Math.max((point.offers / maxOffers) * 100, 8)}%` }}
                      title={`Offer ${point.offers}`}
                    />
                  </div>
                  <span className="text-[11px] text-slate-400">{point.date}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-6 border-t border-slate-100 py-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> 通知新增</span>
              <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Offer 新增</span>
            </div>
          </AdminPanel>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <VisitorPanel
            title="实时在线用户"
            rows={analytics.onlineVisitors}
            empty="当前暂无在线用户。"
          />
          <VisitorPanel
            title="最近活跃用户"
            rows={analytics.recentVisitors}
            empty="暂无用户活跃记录。"
          />
        </section>

        <section className="grid gap-5 2xl:grid-cols-3">
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
            title="待审核 Offer"
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
            title="最新反馈与举报"
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
  content?: string;
  content_type?: string;
  title?: string;
  category?: string;
  is_official?: boolean;
  source_label?: string;
  comments_count?: number;
  follows_count?: number;
};

function mapOfferApiRow(row: OfferApiRow): AdminOfferRow {
  return {
    id: row.id,
    user: row.author_name || '匿名用户',
    avatar: (row.author_name || '匿').slice(0, 1),
    contentType: row.content_type === 'discussion' ? 'discussion' : 'offer',
    title: row.title || '',
    category: row.category || '',
    content: row.content || '',
    official: Boolean(row.is_official),
    sourceLabel: row.source_label || '',
    school: row.school_name || '待补充学校',
    major: row.major || '待补充专业',
    projectType: row.project_type || '其他',
    result: row.result || '待确认',
    background: row.undergraduate_background || '未填写',
    anonymous: row.is_anonymous,
    submittedAt: formatBeijingDateTime(row.created_at),
    status: mapOfferStatus(row.review_status),
    reports: row.reports_count || 0,
    comments: row.comments_count || 0,
    follows: row.follows_count || 0
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
  rows,
  empty
}: {
  title: string;
  rows: AdminVisitorRow[];
  empty: string;
}) {
  return (
    <AdminPanel title={title}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3">当前位置</th>
              <th className="px-4 py-3">最后活跃</th>
              <th className="px-4 py-3">访问次数</th>
              <th className="px-4 py-3">页面浏览</th>
              <th className="px-4 py-3">语言 / 时区</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.visitor_id} className={adminClassNames('border-t border-slate-100', index % 2 === 1 && 'bg-slate-50/40')}>
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
