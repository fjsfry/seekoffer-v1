import {
  Bell,
  ClipboardList,
  FileText,
  ShieldAlert,
  UserPlus,
  UsersRound
} from 'lucide-react';
import type React from 'react';
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

const dashboardIcons = [UsersRound, Bell, ClipboardList, ShieldAlert, UserPlus, FileText];

export default function AdminDashboardPage() {
  const pendingNotices = adminNoticeRows.filter((item) => item.status === '待审核').slice(0, 5);
  const pendingOffers = adminOfferRows.filter((item) => item.status === '待审核' || item.reports > 0).slice(0, 5);
  const latestFeedback = adminFeedbackRows.slice(0, 5);

  return (
    <AdminShell title="数据概览">
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {dashboardMetrics.map((metric, index) => (
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
