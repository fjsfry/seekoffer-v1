'use client';

import type React from 'react';
import { Ban, CheckCircle2, Clock3, FileText, ShieldAlert, Trash2, UserPlus, UsersRound } from 'lucide-react';
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
import {
  adminFeedbackRows,
  adminOperationLogs,
  adminUsers,
  feedbackMetrics,
  logMetrics,
  userMetrics
} from '@/lib/admin-data';
import type { AdminFeedbackRow, AdminOperationLog, AdminUserRow } from '@/lib/admin-data';
import { invokeAdminApi } from '@/lib/admin-api';

export default function AdminOperationsPage() {
  const [users, setUsers] = useState<AdminUserRow[]>(adminUsers);
  const [feedback, setFeedback] = useState<AdminFeedbackRow[]>(adminFeedbackRows);
  const [logs, setLogs] = useState<AdminOperationLog[]>(adminOperationLogs);
  const [message, setMessage] = useState('正在连接后台真实运营数据...');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOperationsData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function loadOperationsData() {
    try {
      const [userData, feedbackData, logData] = await Promise.all([
        invokeAdminApi<{ users: UserApiRow[] }>({ resource: 'users', action: 'list' }),
        invokeAdminApi<{ feedback: FeedbackApiRow[] }>({ resource: 'feedback', action: 'list' }),
        invokeAdminApi<{ logs: LogApiRow[] }>({ resource: 'logs', action: 'list' })
      ]);
      setUsers(userData.users.map(mapUserApiRow));
      setFeedback(feedbackData.feedback.map(mapFeedbackApiRow));
      setLogs(logData.logs.map(mapLogApiRow));
      setMessage('已连接 Supabase，运营数据和操作按钮已切换到真实后台 API。');
    } catch (error) {
      setMessage(error instanceof Error ? `真实 API 暂不可用，当前显示降级数据：${error.message}` : '真实 API 暂不可用，当前显示降级数据。');
    }
  }

  async function updateUserStatus(id: string, status: string, note: string) {
    if ((status === 'banned' || status === 'restricted') && !window.confirm('确认调整该用户状态吗？该操作会写入后台日志。')) {
      return;
    }

    try {
      await invokeAdminApi({ resource: 'users', action: 'update_status', id, status, note });
      setMessage('用户状态已更新，并写入操作日志。');
      await loadOperationsData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '用户状态更新失败。');
    }
  }

  async function updateFeedbackStatus(id: string, status: string, note: string) {
    try {
      await invokeAdminApi({ resource: 'feedback', action: 'update_status', id, status, note });
      setMessage('反馈/举报状态已更新，并写入操作日志。');
      await loadOperationsData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '反馈处理失败。');
    }
  }

  async function updateSetting(key: string, value: unknown) {
    try {
      await invokeAdminApi({ resource: 'settings', action: 'update', key, value });
      setMessage('系统设置已更新，并写入操作日志。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '系统设置更新失败。');
    }
  }

  return (
    <AdminShell title="运营管理">
      <div className="space-y-8">
        <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div>
        <section id="users" className="scroll-mt-24">
          <UsersView users={users} onRefresh={loadOperationsData} onUpdateUserStatus={updateUserStatus} onNotify={setMessage} />
        </section>
        <section id="feedback" className="scroll-mt-24">
          <FeedbackView feedback={feedback} onUpdateFeedbackStatus={updateFeedbackStatus} onNotify={setMessage} />
        </section>
        <section id="logs" className="scroll-mt-24">
          <LogsView logs={logs} onNotify={setMessage} />
        </section>
        <section id="settings" className="scroll-mt-24">
          <SettingsView onUpdateSetting={updateSetting} onNotify={setMessage} />
        </section>
      </div>
    </AdminShell>
  );
}

function UsersView({
  users,
  onRefresh,
  onUpdateUserStatus,
  onNotify
}: {
  users: AdminUserRow[];
  onRefresh: () => void;
  onUpdateUserStatus: (id: string, status: string, note: string) => void;
  onNotify: (message: string) => void;
}) {
  const icons = [UsersRound, UserPlus, CheckCircle2, Ban];
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedUser = users.find((user) => user.id === selectedUserId) || users[0] || adminUsers[0];

  function previewUser(user: AdminUserRow) {
    setSelectedUserId(user.id);
    onNotify(`已打开 ${user.nickname} 的用户详情预览。`);
  }

  function saveUserNote(user: AdminUserRow) {
    const note = window.prompt(`给 ${user.nickname} 添加后台备注`, '');
    if (!note?.trim()) return;
    onUpdateUserStatus(user.id, userStatusToApi(user.status), note.trim());
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-6">
        <AdminPanel>
          <div className="grid gap-4 p-5 xl:grid-cols-[220px_minmax(0,1fr)_220px_300px_180px_120px_120px]">
            <AdminInput placeholder="请输入用户ID" />
            <AdminInput placeholder="请输入昵称 / 手机号 / 邮箱" />
            <AdminSelect options={['全部状态', '正常', '限制', '封禁', '已注销']} />
            <AdminInput placeholder="开始日期  至  结束日期" />
            <AdminSelect options={['全部时间', '今日活跃', '7日活跃', '30日活跃']} />
            <AdminButton onClick={onRefresh}>查询</AdminButton>
            <AdminButton
              tone="secondary"
              onClick={() => {
                onRefresh();
                onNotify('用户筛选条件已重置，并重新加载真实用户列表。');
              }}
            >
              重置
            </AdminButton>
          </div>
        </AdminPanel>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {userMetrics.map((metric, index) => (
            <AdminMetricCard key={metric.label} metric={metric} icon={icons[index]} />
          ))}
        </section>

        <AdminPanel title="用户列表">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-5 py-3"><input type="checkbox" aria-label="选择全部用户" /></th>
                  <th className="px-5 py-3">用户ID</th>
                  <th className="px-5 py-3">昵称</th>
                  <th className="px-5 py-3">手机/邮箱</th>
                  <th className="px-5 py-3">注册时间</th>
                  <th className="px-5 py-3">最近活跃</th>
                  <th className="px-5 py-3">通知提交数</th>
                  <th className="px-5 py-3">Offer提交数</th>
                  <th className="px-5 py-3">申请记录数</th>
                  <th className="px-5 py-3">状态</th>
                  <th className="px-5 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-slate-100">
                    <td className="px-5 py-4"><input type="checkbox" aria-label={`选择 ${user.nickname}`} /></td>
                    <td className="px-5 py-4 font-mono text-slate-700">{user.id}</td>
                    <td className="px-5 py-4 font-medium text-slate-900">{user.nickname}</td>
                    <td className="px-5 py-4 text-slate-600">{user.contact}</td>
                    <td className="px-5 py-4 text-slate-600">{user.registeredAt}</td>
                    <td className="px-5 py-4 text-slate-600">{user.lastActiveAt}</td>
                    <td className="px-5 py-4 text-slate-700">{user.noticeCount}</td>
                    <td className="px-5 py-4 text-slate-700">{user.offerCount}</td>
                    <td className="px-5 py-4 text-slate-700">{user.applicationCount}</td>
                    <td className="px-5 py-4"><AdminStatusBadge status={user.status} /></td>
                    <td className="px-5 py-4">
                      <div className="flex gap-3 font-medium">
                        <button className="text-blue-600" onClick={() => previewUser(user)}>详情</button>
                        <button className="text-blue-600" onClick={() => onUpdateUserStatus(user.id, 'restricted', '后台限制用户提交')}>限制</button>
                        <button className="text-blue-600" onClick={() => onUpdateUserStatus(user.id, 'banned', '后台封禁用户')}>封禁</button>
                        <button className="text-blue-600" onClick={() => saveUserNote(user)}>备注</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AdminPagination total={String(users.length)} />
        </AdminPanel>
      </div>

      <AdminPanel title="用户详情预览">
        <div className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-semibold text-blue-600">
              {selectedUser.nickname.slice(0, 1)}
            </div>
            <div>
              <div className="text-xl font-semibold text-slate-950">{selectedUser.id}</div>
              <div className="mt-1 flex items-center gap-2">
                <span>{selectedUser.nickname}</span>
                <AdminStatusBadge status={selectedUser.status} />
              </div>
            </div>
          </div>
          <DetailList
            items={[
              ['用户ID', selectedUser.id],
              ['昵称', selectedUser.nickname],
              ['手机/邮箱', selectedUser.contact],
              ['注册时间', selectedUser.registeredAt],
              ['最近登录', selectedUser.lastActiveAt],
              ['账号状态', selectedUser.status],
              ['提交通知数', String(selectedUser.noticeCount)],
              ['提交Offer数', String(selectedUser.offerCount)],
              ['申请记录数', String(selectedUser.applicationCount)]
            ]}
          />
          <textarea className="mt-5 h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none" placeholder="后台备注" />
          <button className="mt-3 text-sm font-semibold text-blue-600" onClick={() => saveUserNote(selectedUser)}>编辑备注</button>
        </div>
      </AdminPanel>
    </div>
  );
}

function FeedbackView({
  feedback,
  onUpdateFeedbackStatus,
  onNotify
}: {
  feedback: AdminFeedbackRow[];
  onUpdateFeedbackStatus: (id: string, status: string, note: string) => void;
  onNotify: (message: string) => void;
}) {
  const icons = [ShieldAlert, Clock3, CheckCircle2, FileText];
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const selectedFeedback = feedback.find((item) => item.id === selectedFeedbackId) || feedback[0] || null;

  function previewFeedback(item: AdminFeedbackRow) {
    setSelectedFeedbackId(item.id);
    onNotify(`已打开反馈/举报 ${item.id} 的处理详情。`);
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <AdminPanel>
          <div className="grid gap-4 p-5 xl:grid-cols-[220px_240px_240px_320px_minmax(0,1fr)_120px_120px]">
            <AdminSelect label="类型" options={['请选择类型', '反馈', '举报']} />
            <AdminSelect label="关联内容" options={['请选择关联内容', '通知内容', 'Offer信息', '系统功能', '用户行为']} />
            <AdminSelect label="处理状态" options={['请选择处理状态', '待处理', '处理中', '已解决', '已关闭']} />
            <AdminInput placeholder="开始日期  至  结束日期" />
            <AdminInput placeholder="搜索反馈内容 / 用户名 / ID" />
            <AdminButton onClick={() => onNotify('反馈/举报筛选已刷新。当前版本按真实数据列表重新展示。')}>查询</AdminButton>
            <AdminButton tone="secondary" onClick={() => onNotify('反馈/举报筛选条件已重置。')}>重置</AdminButton>
          </div>
        </AdminPanel>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {feedbackMetrics.map((metric, index) => (
            <AdminMetricCard key={metric.label} metric={metric} icon={icons[index]} />
          ))}
        </section>

        <AdminPanel title="反馈 / 举报列表">
          <SimpleTable
            columns={['类型', '关联内容', '提交用户', '反馈内容', '提交时间', '处理状态', '处理人', '操作']}
            rows={feedback.map((item) => [
              <AdminStatusBadge key={`${item.id}-type`} status={item.type} />,
              item.module,
              item.user,
              item.content,
              item.submittedAt,
              <AdminStatusBadge key={`${item.id}-status`} status={item.status} />,
              item.handler,
              <div key={`${item.id}-actions`} className="flex gap-3 font-medium">
                <button className="text-blue-600" onClick={() => previewFeedback(item)}>查看</button>
                <button className="text-blue-600" onClick={() => onUpdateFeedbackStatus(item.id, 'processing', '开始处理反馈')}>处理</button>
                <button className="text-emerald-600" onClick={() => onUpdateFeedbackStatus(item.id, 'resolved', '反馈已解决')}>解决</button>
              </div>
            ])}
          />
          <AdminPagination total="173" />
        </AdminPanel>
      </div>

      <AdminPanel title="处理工作台">
        <div className="p-5 text-sm text-slate-600">
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            {selectedFeedback ? '已载入所选工单详情，可继续处理或关闭。' : '请选择一条记录查看详情并进行处理'}
          </div>
          <DetailList
            items={[
              ['反馈类型', selectedFeedback?.type || '-'],
              ['关联模块', selectedFeedback?.module || '-'],
              ['提交内容', selectedFeedback?.content || '-'],
              ['建议处理方式', selectedFeedback ? '核验关联内容后更新处理状态，并保留操作日志。' : '-']
            ]}
          />
          <textarea className="mt-5 h-36 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none" placeholder="请输入处理备注（选填）" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              className="h-11 rounded-lg bg-emerald-50 text-sm font-semibold text-emerald-700"
              onClick={() => selectedFeedback && onUpdateFeedbackStatus(selectedFeedback.id, 'resolved', '从处理工作台标记解决')}
            >
              标记已解决
            </button>
            <button
              className="h-11 rounded-lg bg-rose-50 text-sm font-semibold text-rose-700"
              onClick={() => selectedFeedback && onUpdateFeedbackStatus(selectedFeedback.id, 'closed', '从处理工作台关闭工单')}
            >
              关闭工单
            </button>
          </div>
        </div>
      </AdminPanel>
    </div>
  );
}

function LogsView({ logs, onNotify }: { logs: AdminOperationLog[]; onNotify: (message: string) => void }) {
  const icons = [FileText, Trash2, ShieldAlert, Ban];

  function exportLogs() {
    const header = ['时间', '操作人', '操作类型', '对象模块', '操作对象', 'IP地址', '结果', '备注'];
    const lines = logs.map((item) =>
      [item.createdAt, item.operator, item.action, item.module, item.target, item.ip, item.result, item.remark]
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(',')
    );
    const blob = new Blob([`\uFEFF${[header.join(','), ...lines].join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seekoffer-admin-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    onNotify(`已导出 ${logs.length} 条操作日志。`);
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <AdminPanel>
          <div className="grid gap-4 p-5 xl:grid-cols-[220px_240px_240px_320px_120px_120px]">
            <AdminSelect label="操作人" options={['请选择操作人', 'admin', '运营小李', '系统']} />
            <AdminSelect label="操作类型" options={['请选择操作类型', '审核通知', '删除Offer', '封禁用户', '登录后台']} />
            <AdminSelect label="对象模块" options={['请选择对象模块', '通知管理', 'Offer池', '用户管理', '系统']} />
            <AdminInput placeholder="2026-04-21  至  2026-04-27" />
            <AdminButton onClick={() => onNotify('操作日志筛选已刷新。当前版本按最新日志重新展示。')}>查询</AdminButton>
            <AdminButton tone="secondary" onClick={() => onNotify('操作日志筛选条件已重置。')}>重置</AdminButton>
          </div>
        </AdminPanel>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {logMetrics.map((metric, index) => (
            <AdminMetricCard key={metric.label} metric={metric} icon={icons[index]} />
          ))}
        </section>

        <AdminPanel title="操作日志" action={<button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600" onClick={exportLogs}>导出日志</button>}>
          <SimpleTable
            columns={['时间', '操作人', '操作类型', '对象模块', '操作对象', 'IP地址', '结果', '备注']}
            rows={logs.map((item, index) => [
              item.createdAt,
              item.operator,
              item.action,
              item.module,
              item.target,
              item.ip,
              <AdminStatusBadge key={`${item.id}-${index}`} status={item.result} />,
              item.remark
            ])}
          />
          <AdminPagination total="238" pages={6} />
        </AdminPanel>
      </div>

      <SettingsCard />
    </div>
  );
}

function SettingsView({
  onUpdateSetting,
  onNotify
}: {
  onUpdateSetting: (key: string, value: unknown) => void;
  onNotify: (message: string) => void;
}) {
  function roleMessage(role: string) {
    onNotify(`${role} 的权限编辑入口已接通：第一版先保留为运营提示，后续接入细粒度权限表。`);
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
      <AdminPanel title="角色权限">
        <SimpleTable
          columns={['角色', '权限范围', '高危权限', '成员数', '操作']}
          rows={[
            ['超级管理员', '全部权限', '删除 / 封禁 / 导出 / 配置', '1', <button key="edit-super" className="text-blue-600" onClick={() => roleMessage('超级管理员')}>编辑</button>],
            ['内容审核员', '通知与Offer审核', '下架内容', '3', <button key="edit-review" className="text-blue-600" onClick={() => roleMessage('内容审核员')}>编辑</button>],
            ['运营管理员', '用户、反馈、内容处理', '限制用户', '2', <button key="edit-ops" className="text-blue-600" onClick={() => roleMessage('运营管理员')}>编辑</button>],
            ['只读管理员', '只读数据', '无', '1', <button key="edit-read" className="text-blue-600" onClick={() => roleMessage('只读管理员')}>编辑</button>]
          ]}
        />
      </AdminPanel>
      <SettingsCard onUpdateSetting={onUpdateSetting} />
    </div>
  );
}

function SettingsCard({ onUpdateSetting }: { onUpdateSetting?: (key: string, value: unknown) => void }) {
  const settings = [
    ['content_review_enabled', '开启内容审核', '开启后，用户发布内容需审核', true],
    ['offer_submit_enabled', '允许用户提交Offer', '开启后，用户可提交Offer', true],
    ['report_alert_enabled', '开启举报提醒', '开启后，收到举报会发送提醒', true],
    ['operation_log_retention_days', '日志保留180天', '超时时间的日志将自动删除', 180]
  ] as const;

  return (
    <AdminPanel title="基础配置">
      <div className="space-y-5 p-5">
        {settings.map(([key, title, description, value]) => (
          <div key={title} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5 last:border-b-0 last:pb-0">
            <div>
              <div className="font-semibold text-slate-950">{title}</div>
              <div className="mt-1 text-sm text-slate-500">{description}</div>
            </div>
            <button
              className="h-7 w-12 rounded-full bg-blue-600 p-1"
              onClick={() => onUpdateSetting?.(key, typeof value === 'boolean' ? !value : value)}
            >
              <span className="block h-5 w-5 translate-x-5 rounded-full bg-white shadow-sm" />
            </button>
          </div>
        ))}
      </div>
    </AdminPanel>
  );
}

function userStatusToApi(status: string) {
  if (status === '限制') return 'restricted';
  if (status === '封禁') return 'banned';
  if (status === '已注销') return 'deleted';
  return 'active';
}

type UserApiRow = {
  id: string;
  nickname: string;
  undergraduate_school: string;
  major: string;
  target_major: string;
  created_at: string;
  updated_at: string;
  application_count: number;
  moderation_status: string;
};

function mapUserApiRow(row: UserApiRow): AdminUserRow {
  return {
    id: row.id,
    nickname: row.nickname || '未设置昵称',
    contact: `${row.undergraduate_school || '未填写学校'} / ${row.major || '未填写专业'}`,
    registeredAt: row.created_at?.slice(0, 16).replace('T', ' ') || '-',
    lastActiveAt: row.updated_at?.slice(0, 16).replace('T', ' ') || '-',
    noticeCount: 0,
    offerCount: 0,
    applicationCount: row.application_count || 0,
    status: mapUserStatus(row.moderation_status)
  };
}

function mapUserStatus(status: string): AdminUserRow['status'] {
  if (status === 'restricted') return '限制';
  if (status === 'banned') return '封禁';
  if (status === 'deleted') return '已注销';
  return '正常';
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
    module: mapFeedbackModule(row.module),
    user: row.target_id || '用户反馈',
    content: row.content || '-',
    submittedAt: row.created_at?.slice(0, 16).replace('T', ' ') || '-',
    status: mapFeedbackStatus(row.status),
    handler: row.handler || '-'
  };
}

function mapFeedbackModule(module: string): AdminFeedbackRow['module'] {
  if (module === 'notice') return '通知内容';
  if (module === 'offer') return 'Offer信息';
  if (module === 'user') return '用户行为';
  return '系统功能';
}

function mapFeedbackStatus(status: string): AdminFeedbackRow['status'] {
  if (status === 'processing') return '处理中';
  if (status === 'resolved') return '已解决';
  if (status === 'closed') return '已关闭';
  return '待处理';
}

type LogApiRow = {
  id: string;
  admin_email: string;
  action: string;
  module: string;
  target_id: string;
  ip_address: string;
  result: string;
  remark: string;
  created_at: string;
};

function mapLogApiRow(row: LogApiRow): AdminOperationLog {
  return {
    id: row.id,
    operator: row.admin_email || 'system',
    action: row.action,
    module: row.module,
    target: row.target_id,
    ip: row.ip_address || '-',
    result: row.result === 'failed' ? '失败' : '成功',
    remark: row.remark || '-',
    createdAt: row.created_at?.slice(0, 19).replace('T', ' ') || '-'
  };
}

function SimpleTable({ columns, rows }: { columns: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
          <tr>
            <th className="px-5 py-3"><input type="checkbox" aria-label="选择全部" /></th>
            {columns.map((column) => (
              <th key={column} className="px-5 py-3">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`} className="border-t border-slate-100">
              <td className="px-5 py-4"><input type="checkbox" aria-label={`选择第 ${rowIndex + 1} 行`} /></td>
              {row.map((cell, cellIndex) => (
                <td key={`row-${rowIndex}-${cellIndex}`} className="max-w-[260px] truncate px-5 py-4 text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="mt-6 space-y-4 text-sm">
      {items.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 border-b border-slate-100 pb-3 last:border-0">
          <dt className="text-slate-500">{label}</dt>
          <dd className="text-right font-medium text-slate-700">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
