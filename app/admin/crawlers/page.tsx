import type React from 'react';
import { Ban, CheckCircle2, Clock3, FileText, ShieldAlert, Trash2, UserPlus, UsersRound } from 'lucide-react';
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

export default function AdminOperationsPage() {
  return (
    <AdminShell title="运营管理">
      <div className="space-y-8">
        <section id="users" className="scroll-mt-24">
          <UsersView />
        </section>
        <section id="feedback" className="scroll-mt-24">
          <FeedbackView />
        </section>
        <section id="logs" className="scroll-mt-24">
          <LogsView />
        </section>
        <section id="settings" className="scroll-mt-24">
          <SettingsView />
        </section>
      </div>
    </AdminShell>
  );
}

function UsersView() {
  const icons = [UsersRound, UserPlus, CheckCircle2, Ban];
  const selectedUser = adminUsers[0];

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
            <AdminButton>查询</AdminButton>
            <AdminButton tone="secondary">重置</AdminButton>
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
                {adminUsers.map((user) => (
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
                        <button className="text-blue-600">详情</button>
                        <button className="text-blue-600">限制</button>
                        <button className="text-blue-600">封禁</button>
                        <button className="text-blue-600">备注</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AdminPagination total="12,846" />
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
          <button className="mt-3 text-sm font-semibold text-blue-600">编辑备注</button>
        </div>
      </AdminPanel>
    </div>
  );
}

function FeedbackView() {
  const icons = [ShieldAlert, Clock3, CheckCircle2, FileText];

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
            <AdminButton>查询</AdminButton>
            <AdminButton tone="secondary">重置</AdminButton>
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
            rows={adminFeedbackRows.map((item) => [
              <AdminStatusBadge key={`${item.id}-type`} status={item.type} />,
              item.module,
              item.user,
              item.content,
              item.submittedAt,
              <AdminStatusBadge key={`${item.id}-status`} status={item.status} />,
              item.handler,
              <div key={`${item.id}-actions`} className="flex gap-3 font-medium"><button className="text-blue-600">查看</button><button className="text-blue-600">处理</button></div>
            ])}
          />
          <AdminPagination total="173" />
        </AdminPanel>
      </div>

      <AdminPanel title="处理工作台">
        <div className="p-5 text-sm text-slate-600">
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">请选择一条记录查看详情并进行处理</div>
          <DetailList
            items={[
              ['反馈类型', '-'],
              ['关联模块', '-'],
              ['提交内容', '-'],
              ['建议处理方式', '-']
            ]}
          />
          <textarea className="mt-5 h-36 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none" placeholder="请输入处理备注（选填）" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button className="h-11 rounded-lg bg-emerald-50 text-sm font-semibold text-emerald-700">标记已解决</button>
            <button className="h-11 rounded-lg bg-rose-50 text-sm font-semibold text-rose-700">关闭工单</button>
          </div>
        </div>
      </AdminPanel>
    </div>
  );
}

function LogsView() {
  const icons = [FileText, Trash2, ShieldAlert, Ban];

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <AdminPanel>
          <div className="grid gap-4 p-5 xl:grid-cols-[220px_240px_240px_320px_120px_120px]">
            <AdminSelect label="操作人" options={['请选择操作人', 'admin', '运营小李', '系统']} />
            <AdminSelect label="操作类型" options={['请选择操作类型', '审核通知', '删除Offer', '封禁用户', '登录后台']} />
            <AdminSelect label="对象模块" options={['请选择对象模块', '通知管理', 'Offer池', '用户管理', '系统']} />
            <AdminInput placeholder="2026-04-21  至  2026-04-27" />
            <AdminButton>查询</AdminButton>
            <AdminButton tone="secondary">重置</AdminButton>
          </div>
        </AdminPanel>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {logMetrics.map((metric, index) => (
            <AdminMetricCard key={metric.label} metric={metric} icon={icons[index]} />
          ))}
        </section>

        <AdminPanel title="操作日志" action={<button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">导出日志</button>}>
          <SimpleTable
            columns={['时间', '操作人', '操作类型', '对象模块', '操作对象', 'IP地址', '结果', '备注']}
            rows={adminOperationLogs.concat(adminOperationLogs).map((item, index) => [
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

function SettingsView() {
  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
      <AdminPanel title="角色权限">
        <SimpleTable
          columns={['角色', '权限范围', '高危权限', '成员数', '操作']}
          rows={[
            ['超级管理员', '全部权限', '删除 / 封禁 / 导出 / 配置', '1', <button key="edit-super" className="text-blue-600">编辑</button>],
            ['内容审核员', '通知与Offer审核', '下架内容', '3', <button key="edit-review" className="text-blue-600">编辑</button>],
            ['运营管理员', '用户、反馈、内容处理', '限制用户', '2', <button key="edit-ops" className="text-blue-600">编辑</button>],
            ['只读管理员', '只读数据', '无', '1', <button key="edit-read" className="text-blue-600">编辑</button>]
          ]}
        />
      </AdminPanel>
      <SettingsCard />
    </div>
  );
}

function SettingsCard() {
  return (
    <AdminPanel title="基础配置">
      <div className="space-y-5 p-5">
        {[
          ['开启内容审核', '开启后，用户发布内容需审核'],
          ['允许用户提交Offer', '开启后，用户可提交Offer'],
          ['开启举报提醒', '开启后，收到举报会发送提醒'],
          ['日志保留180天', '超时时间的日志将自动删除']
        ].map(([title, description]) => (
          <div key={title} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5 last:border-b-0 last:pb-0">
            <div>
              <div className="font-semibold text-slate-950">{title}</div>
              <div className="mt-1 text-sm text-slate-500">{description}</div>
            </div>
            <button className="h-7 w-12 rounded-full bg-blue-600 p-1">
              <span className="block h-5 w-5 translate-x-5 rounded-full bg-white shadow-sm" />
            </button>
          </div>
        ))}
      </div>
    </AdminPanel>
  );
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
