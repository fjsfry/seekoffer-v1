'use client';

import {
  Bell,
  ClipboardList,
  FileText,
  ShieldAlert,
  UserPlus,
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
import { invokeAdminApi } from '@/lib/admin-api';

const dashboardIcons = [UsersRound, Bell, ClipboardList, ShieldAlert, UserPlus, FileText];

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

export default function AdminDashboardPage() {
  const [overviewMetrics, setOverviewMetrics] = useState<AdminOverviewMetrics>(emptyOverview);
  const [metrics, setMetrics] = useState<AdminMetric[]>(buildLiveMetrics(emptyOverview));
  const [trends, setTrends] = useState<TrendPoint[]>(buildEmptyTrends());
  const [pendingNotices, setPendingNotices] = useState<AdminNoticeRow[]>([]);
  const [pendingOffers, setPendingOffers] = useState<AdminOfferRow[]>([]);
  const [latestFeedback, setLatestFeedback] = useState<AdminFeedbackRow[]>([]);
  const [message, setMessage] = useState('正在连接后台真实统计数据...');

  async function loadDashboard() {
    try {
      const [overview, notices, offers, feedback] = await Promise.all([
        invokeAdminApi<{ metrics: AdminOverviewMetrics; trends: TrendPoint[] }>({ resource: 'overview', action: 'get' }),
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
      setMetrics(buildLiveMetrics(overview.metrics));
      setTrends(overview.trends?.length ? overview.trends : buildEmptyTrends());
      setPendingNotices(notices.notices.map(mapNoticeApiRow));
      setPendingOffers(offers.offers.filter((item) => item.review_status === 'pending' || item.reports_count > 0).slice(0, 5).map(mapOfferApiRow));
      setLatestFeedback(feedback.feedback.map(mapFeedbackApiRow));
      setMessage('已连接 Supabase，数据概览、趋势和待处理列表均来自真实业务表。');
    } catch (error) {
      setOverviewMetrics(emptyOverview);
      setMetrics(buildLiveMetrics(emptyOverview));
      setTrends(buildEmptyTrends());
      setPendingNotices([]);
      setPendingOffers([]);
      setLatestFeedback([]);
      setMessage(error instanceof Error ? `真实 API 暂不可用：${error.message}` : '真实 API 暂不可用，请稍后重试。');
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const maxNotices = Math.max(...trends.map((item) => item.notices), 1);
  const maxOffers = Math.max(...trends.map((item) => item.offers), 1);

  return (
    <AdminShell title="数据概览">
      <div className="space-y-6">
        <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {metrics.map((metric, index) => (
            <AdminMetricCard key={metric.label} metric={metric} icon={dashboardIcons[index]} />
          ))}
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

function buildLiveMetrics(metrics: AdminOverviewMetrics): AdminMetric[] {
  return [
    { label: '总用户数', value: formatNumber(metrics.totalUsers), hint: `今日新增 ${formatNumber(metrics.todayUsers)}`, tone: 'blue' },
    { label: '待审核通知', value: formatNumber(metrics.pendingNotices), hint: `通知总数 ${formatNumber(metrics.totalNotices)}`, tone: 'amber' },
    { label: '待审核 Offer', value: formatNumber(metrics.pendingOffers), hint: `Offer 总数 ${formatNumber(metrics.totalOffers)}`, tone: 'purple' },
    { label: '待处理举报', value: formatNumber(metrics.pendingFeedback), hint: `反馈总数 ${formatNumber(metrics.totalFeedback)}`, tone: 'rose' },
    { label: '今日新增用户', value: formatNumber(metrics.todayUsers), hint: `正常用户 ${formatNumber(metrics.normalUsers)}`, tone: 'green' },
    { label: '申请记录总数', value: formatNumber(metrics.totalApplications), hint: `今日新增 ${formatNumber(metrics.todayApplications)}，只做统计`, tone: 'blue' }
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
    submitter: row.is_private ? '用户提交' : '系统同步',
    submittedAt: row.updated_at_ts?.slice(0, 16).replace('T', ' ') || row.created_at?.slice(0, 16).replace('T', ' ') || row.publish_date || '-',
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
    submittedAt: row.created_at?.slice(0, 16).replace('T', ' ') || '-',
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
    submittedAt: row.created_at?.slice(0, 16).replace('T', ' ') || '-',
    status: row.status === 'processing' ? '处理中' : row.status === 'resolved' ? '已解决' : row.status === 'closed' ? '已关闭' : '待处理',
    handler: row.handler || '-'
  };
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
