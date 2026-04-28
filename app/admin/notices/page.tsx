import Link from 'next/link';
import { Bell, CheckCircle2, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import {
  AdminButton,
  AdminInput,
  AdminMetricCard,
  AdminPagination,
  AdminPanel,
  AdminSelect,
  AdminStatusBadge
} from '@/components/admin-ui';
import { adminNoticeRows, noticeMetrics } from '@/lib/admin-data';

const noticeIcons = [Bell, CheckCircle2, XCircle, Trash2];

export default function AdminNoticesPage() {
  return (
    <AdminShell title="通知管理">
      <div className="space-y-6">
        <AdminPanel>
          <div className="grid gap-5 p-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_220px_220px_220px_120px]">
              <AdminInput placeholder="请输入通知标题" />
              <AdminSelect label="" options={['请选择学校', '清华大学', '北京大学', '复旦大学', '上海交通大学']} />
              <AdminSelect label="" options={['请选择类型', '夏令营', '预推免', '九推', '招生通知']} />
              <AdminSelect label="" options={['请选择状态', '待审核', '已发布', '已驳回', '已下架']} />
              <AdminInput placeholder="开始日期  至  结束日期" />
              <Link
                href="/admin/notices/new"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                新建通知
              </Link>
            </div>
            <div className="flex justify-end gap-3">
              <AdminButton>查询</AdminButton>
              <AdminButton tone="secondary">
                <RotateCcw className="mr-2 h-4 w-4" />
                重置
              </AdminButton>
            </div>
          </div>
        </AdminPanel>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {noticeMetrics.map((metric, index) => (
            <AdminMetricCard key={metric.label} metric={metric} icon={noticeIcons[index]} />
          ))}
        </section>

        <AdminPanel title="通知列表">
          <div className="flex flex-wrap gap-3 px-5 py-4">
            <AdminButton tone="secondary">批量通过</AdminButton>
            <AdminButton tone="danger">批量驳回</AdminButton>
            <AdminButton tone="secondary">批量删除</AdminButton>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-5 py-3"><input type="checkbox" aria-label="选择全部通知" /></th>
                  <th className="px-5 py-3">通知标题</th>
                  <th className="px-5 py-3">学校</th>
                  <th className="px-5 py-3">类型</th>
                  <th className="px-5 py-3">来源链接</th>
                  <th className="px-5 py-3">提交人</th>
                  <th className="px-5 py-3">提交时间</th>
                  <th className="px-5 py-3">状态</th>
                  <th className="px-5 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {adminNoticeRows.slice(0, 10).map((notice) => (
                  <tr key={notice.id} className="border-t border-slate-100">
                    <td className="px-5 py-4"><input type="checkbox" aria-label={`选择 ${notice.title}`} /></td>
                    <td className="max-w-[320px] truncate px-5 py-4 font-medium text-slate-900">{notice.title}</td>
                    <td className="px-5 py-4 text-slate-700">{notice.school}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">{notice.type}</span>
                    </td>
                    <td className="max-w-[220px] truncate px-5 py-4">
                      <a href={notice.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                        {notice.sourceUrl}
                      </a>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{notice.submitter}</td>
                    <td className="px-5 py-4 text-slate-600">{notice.submittedAt}</td>
                    <td className="px-5 py-4"><AdminStatusBadge status={notice.status} /></td>
                    <td className="px-5 py-4">
                      <div className="flex gap-3 text-sm font-medium">
                        <button className="text-blue-600">查看</button>
                        <button className="text-blue-600">审核</button>
                        <button className="text-blue-600">编辑</button>
                        <button className="text-rose-600">删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <AdminPagination total="152" pages={5} />
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
