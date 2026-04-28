'use client';

import Link from 'next/link';
import { Bell, CheckCircle2, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import type { AdminNoticeRow } from '@/lib/admin-data';
import { invokeAdminApi } from '@/lib/admin-api';

const noticeIcons = [Bell, CheckCircle2, XCircle, Trash2];

export default function AdminNoticesPage() {
  const [rows, setRows] = useState<AdminNoticeRow[]>(adminNoticeRows);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pending, setPending] = useState('');
  const [message, setMessage] = useState('正在连接后台真实数据...');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNotices();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function loadNotices() {
    setPending('load');
    try {
      const data = await invokeAdminApi<{ notices: NoticeApiRow[] }>({ resource: 'notices', action: 'list' });
      setRows(data.notices.map(mapNoticeApiRow));
      setMessage(`已连接 Supabase，加载 ${data.notices.length} 条通知。`);
    } catch (error) {
      setMessage(error instanceof Error ? `真实 API 暂不可用，当前显示降级数据：${error.message}` : '真实 API 暂不可用，当前显示降级数据。');
    } finally {
      setPending('');
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleAll() {
    const visibleIds = rows.slice(0, 10).map((item) => item.id);
    setSelectedIds((current) => (visibleIds.every((id) => current.includes(id)) ? [] : visibleIds));
  }

  async function updateNoticeStatus(ids: string[], status: string, note: string) {
    if (!ids.length) {
      setMessage('请先选择需要处理的通知。');
      return;
    }

    const dangerous = status === 'deleted' || status === 'rejected';
    if (dangerous && !window.confirm(`确认要处理 ${ids.length} 条通知吗？该操作会写入后台日志。`)) {
      return;
    }

    setPending(`${status}:${ids.join(',')}`);
    try {
      await Promise.all(
        ids.map((id) =>
          invokeAdminApi({
            resource: 'notices',
            action: 'update_status',
            id,
            status,
            note
          })
        )
      );
      setMessage('操作成功，已写入 Supabase 并记录操作日志。');
      setSelectedIds([]);
      await loadNotices();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '通知操作失败，请稍后重试。');
    } finally {
      setPending('');
    }
  }

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
              <AdminButton onClick={loadNotices} disabled={pending === 'load'}>查询</AdminButton>
              <AdminButton tone="secondary" onClick={() => setSelectedIds([])}>
                <RotateCcw className="mr-2 h-4 w-4" />
                重置
              </AdminButton>
            </div>
            <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div>
          </div>
        </AdminPanel>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {noticeMetrics.map((metric, index) => (
            <AdminMetricCard key={metric.label} metric={metric} icon={noticeIcons[index]} />
          ))}
        </section>

        <AdminPanel title="通知列表">
          <div className="flex flex-wrap gap-3 px-5 py-4">
            <AdminButton tone="secondary" onClick={() => updateNoticeStatus(selectedIds, 'published', '批量通过通知')}>批量通过</AdminButton>
            <AdminButton tone="danger" onClick={() => updateNoticeStatus(selectedIds, 'rejected', '批量驳回通知')}>批量驳回</AdminButton>
            <AdminButton tone="secondary" onClick={() => updateNoticeStatus(selectedIds, 'deleted', '批量删除通知')}>批量删除</AdminButton>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-5 py-3">
                    <input
                      type="checkbox"
                      aria-label="选择全部通知"
                      checked={rows.slice(0, 10).every((item) => selectedIds.includes(item.id))}
                      onChange={toggleAll}
                    />
                  </th>
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
                {rows.slice(0, 10).map((notice) => (
                  <tr key={notice.id} className="border-t border-slate-100">
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        aria-label={`选择 ${notice.title}`}
                        checked={selectedIds.includes(notice.id)}
                        onChange={() => toggleSelected(notice.id)}
                      />
                    </td>
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
                        <button className="text-blue-600" onClick={() => window.open(notice.sourceUrl, '_blank', 'noopener,noreferrer')}>查看</button>
                        <button className="text-blue-600" onClick={() => updateNoticeStatus([notice.id], 'published', '审核通过通知')}>审核</button>
                        <button className="text-blue-600" onClick={() => updateNoticeStatus([notice.id], 'hidden', '后台下架通知')}>下架</button>
                        <button className="text-rose-600" onClick={() => updateNoticeStatus([notice.id], 'deleted', '后台删除通知')}>删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <AdminPagination total={String(rows.length)} pages={5} />
        </AdminPanel>
      </div>
    </AdminShell>
  );
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
