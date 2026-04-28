'use client';

import {
  Bell,
  ClipboardList,
  FileText,
  ShieldAlert,
  UserPlus,
  UsersRound
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import {
  AdminMetricCard,
  AdminMiniBars,
  AdminPanel,
  AdminPagination,
  AdminStatusBadge,
  adminClassNames
} from '@/components/admin-ui';
import {
  adminFeedbackRows,
  adminNoticeRows,
  adminOfferRows,
  adminTrendPoints,
  dashboardMetrics
} from '@/lib/admin-data';
import type { AdminFeedbackRow, AdminMetric, AdminNoticeRow, AdminOfferRow } from '@/lib/admin-data';
import { invokeAdminApi } from '@/lib/admin-api';

const dashboardIcons = [UsersRound, Bell, ClipboardList, ShieldAlert, UserPlus, FileText];

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<AdminMetric[]>(dashboardMetrics);
  const [pendingNotices, setPendingNotices] = useState<AdminNoticeRow[]>(adminNoticeRows.filter((item) => item.status === '待审核').slice(0, 5));
  const [pendingOffers, setPendingOffers] = useState<AdminOfferRow[]>(adminOfferRows.filter((item) => item.status === '待审核' || item.reports > 0).slice(0, 5));
  const [latestFeedback, setLatestFeedback] = useState<AdminFeedbackRow[]>(adminFeedbackRows.slice(0, 5));
  const [message, setMessage] = useState('正在连接后台真实统计数据...');

  async function loadDashboard() {
    try {
      const [overview, notices, offers, feedback] = await Promise.all([
        invokeAdminApi<{ metrics: AdminOverviewMetrics }>({ resource: 'overview', action: 'get' }),
        invokeAdminApi<{ notices: NoticeApiRow[] }>({ resource: 'notices', action: 'list' }),
        invokeAdminApi<{ offers: OfferApiRow[] }>({ resource: 'offers', action: 'list' }),
        invokeAdminApi<{ feedback: FeedbackApiRow[] }>({ resource: 'feedback', action: 'list' })
      ]);
      setMetrics(buildLiveMetrics(overview.metrics));
      setPendingNotices(notices.notices.filter((item) => item.admin_status === 'pending').slice(0, 5).map(mapNoticeApiRow));
      setPendingOffers(offers.offers.filter((item) => item.review_status === 'pending' || item.reports_count > 0).slice(0, 5).map(mapOfferApiRow));
      setLatestFeedback(feedback.feedback.slice(0, 5).map(mapFeedbackApiRow));
      setMessage('已连接 Supabase，数据概览来自真实业务表。');
    } catch (error) {
      setMessage(error instanceof Error ? `真实 API 暂不可用，当前显示降级数据：${error.message}` : '真实 API 暂不可用，当前显示降级数据。');
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

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
            action={<select className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"><option>近7天</option></select>}
          >
            <AdminMiniBars data={adminTrendPoints} valueKey="users" color="bg-blue-500" />
          </AdminPanel>

          <AdminPanel
            title="近7天内容提交趋势"
            action={<select className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"><option>近7天</option></select>}
          >
            <div className="grid h-64 grid-cols-7 items-end gap-4 px-6 pb-6 pt-8">
              {adminTrendPoints.map((point) => (
                <div key={point.date} className="flex flex-col items-center gap-2">
                  <div className="flex h-40 items-end gap-2">
                    <div
                      className="w-4 rounded-t bg-blue-500"
                      style={{ height: `${Math.max((point.notices / 1800) * 100, 8)}%` }}
                      title={`通知 ${point.notices}`}
                    />
                    <div
                      className="w-4 rounded-t bg-emerald-500"
                      style={{ height: `${Math.max((point.offers / 120) * 100, 8)}%` }}
                      title={`Offer ${point.offers}`}
                    />
                  </div>
                  <span className="text-xs text-slate-400">{point.date}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-6 border-t border-slate-100 py-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-blue-500" /> 通知提交数</span>
              <span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-emerald-500" /> Offer提交数</span>
            </div>
          </AdminPanel>
        </section>

        <section className="grid gap-6 2xl:grid-cols-3">
          <DashboardTable
            title="待审核通知"
            columns={['标题', '学校', '类型', '提交时间', '状态']}
            rows={pendingNotices.map((item) => [
              item.title,
              item.school,
              item.type,
              item.submittedAt,
              <AdminStatusBadge key={`${item.id}-status`} status={item.status} />
            ])}
            total="38"
          />

          <DashboardTable
            title="待审核Offer"
            columns={['学校', '专业', '结果', '提交时间', '状态']}
            rows={pendingOffers.map((item) => [
              item.school,
              item.major,
              item.result,
              item.submittedAt,
              <AdminStatusBadge key={`${item.id}-status`} status={item.status} />
            ])}
            total="67"
          />

          <DashboardTable
            title="最新反馈 / 举报"
            columns={['类型', '内容', '提交时间', '状态']}
            rows={latestFeedback.map((item) => [
              item.type,
              item.content,
              item.submittedAt,
              <AdminStatusBadge key={`${item.id}-status`} status={item.status} />
            ])}
            total="15"
          />
        </section>
      </div>
    </AdminShell>
  );
}

type AdminOverviewMetrics = {
  totalUsers: number;
  totalNotices: number;
  pendingNotices: number;
  totalOffers: number;
  pendingOffers: number;
  totalApplications: number;
  totalFeedback: number;
  pendingFeedback: number;
};

function buildLiveMetrics(metrics: AdminOverviewMetrics): AdminMetric[] {
  return [
    { label: '总用户数', value: String(metrics.totalUsers), hint: 'profiles 真实统计', tone: 'blue' },
    { label: '待审核通知', value: String(metrics.pendingNotices), hint: `通知总数 ${metrics.totalNotices}`, tone: 'amber' },
    { label: '待审核 Offer', value: String(metrics.pendingOffers), hint: `Offer 总数 ${metrics.totalOffers}`, tone: 'purple' },
    { label: '待处理举报', value: String(metrics.pendingFeedback), hint: `反馈总数 ${metrics.totalFeedback}`, tone: 'rose' },
    { label: '今日新增用户', value: '-', hint: '下一步接入 auth 日统计', tone: 'green' },
    { label: '申请记录总数', value: String(metrics.totalApplications), hint: '只做统计，不进入个人内容', tone: 'blue' }
  ];
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
    sourceUrl: row.source_link || '/notices',
    submitter: row.is_private ? '用户提交' : '系统同步',
    submittedAt: row.updated_at_ts?.slice(0, 16).replace('T', ' ') || row.created_at?.slice(0, 16).replace('T', ' ') || row.publish_date || '-',
    deadline: row.deadline_date || '待确认',
    status: row.admin_status === 'pending' ? '待审核' : '已发布',
    views: 0,
    saves: 0
  };
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
    status: row.review_status === 'approved' ? '已通过' : row.review_status === 'hidden' ? '已隐藏' : '待审核',
    reports: row.reports_count || 0
  };
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
  columns,
  rows,
  total
}: {
  title: string;
  columns: string[];
  rows: Array<Array<React.ReactNode>>;
  total: string;
}) {
  return (
    <AdminPanel title={title} action={<a className="text-sm font-semibold text-blue-600">查看全部</a>}>
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
      <AdminPagination total={total} pages={3} />
    </AdminPanel>
  );
}
