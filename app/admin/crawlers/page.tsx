'use client';

import type React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Ban, CheckCircle2, Clock3, FileText, ShieldAlert, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import {
  AdminButton,
  AdminActionBanner,
  AdminInput,
  AdminMetricCard,
  AdminPagination,
  AdminPanel,
  AdminSelect,
  AdminStatusBadge
} from '@/components/admin-ui';
import type { AdminFeedbackRow, AdminMetric, AdminOperationLog, AdminUserRow } from '@/lib/admin-data';
import { getAdminErrorMessage, invokeAdminApi } from '@/lib/admin-api';
import { formatBeijingDateTime } from '@/lib/admin-time';

type OperationsSection = 'users' | 'feedback' | 'logs' | 'settings';

const operationsSectionTitles: Record<OperationsSection, string> = {
  users: '用户管理',
  feedback: '反馈举报',
  logs: '操作日志',
  settings: '系统设置'
};

const defaultUserFilters = {
  userId: '',
  query: '',
  status: '全部状态',
  activity: '全部时间'
};

const defaultFeedbackFilters = {
  type: '全部类型',
  module: '全部内容',
  status: '全部状态',
  dateFrom: '',
  dateTo: '',
  query: ''
};

const defaultLogFilters = {
  operator: '全部操作人',
  action: '全部类型',
  module: '全部模块',
  dateFrom: '',
  dateTo: '',
  query: ''
};

type UserFilters = typeof defaultUserFilters;
type FeedbackFilters = typeof defaultFeedbackFilters;
type LogFilters = typeof defaultLogFilters;

function resolveSectionFromLocation(pathname: string, hash: string): OperationsSection {
  if (pathname.includes('/admin/feedback')) return 'feedback';
  if (pathname.includes('/admin/logs')) return 'logs';
  if (pathname.includes('/admin/settings')) return 'settings';
  if (pathname.includes('/admin/users')) return 'users';

  const hashSection = hash.replace('#', '') as OperationsSection;
  return ['users', 'feedback', 'logs', 'settings'].includes(hashSection) ? hashSection : 'users';
}

export default function AdminOperationsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const isLegacyCrawlerRoute = pathname.includes('/admin/crawlers');
  const [activeSection, setActiveSection] = useState<OperationsSection>('users');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [feedback, setFeedback] = useState<AdminFeedbackRow[]>([]);
  const [logs, setLogs] = useState<AdminOperationLog[]>([]);
  const [userMetrics, setUserMetrics] = useState<AdminMetric[]>(buildUserMetrics());
  const [feedbackMetrics, setFeedbackMetrics] = useState<AdminMetric[]>(buildFeedbackMetrics());
  const [logMetrics, setLogMetrics] = useState<AdminMetric[]>(buildLogMetrics());
  const [userTotal, setUserTotal] = useState(0);
  const [feedbackTotal, setFeedbackTotal] = useState(0);
  const [logTotal, setLogTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [feedbackPageSize, setFeedbackPageSize] = useState(10);
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(10);
  const [userFilters, setUserFilters] = useState<UserFilters>(defaultUserFilters);
  const [feedbackFilters, setFeedbackFilters] = useState<FeedbackFilters>(defaultFeedbackFilters);
  const [logFilters, setLogFilters] = useState<LogFilters>(defaultLogFilters);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isLegacyCrawlerRoute) {
      router.replace('/admin/dashboard');
      return;
    }

    const syncSection = () => {
      setActiveSection(resolveSectionFromLocation(pathname, window.location.hash));
    };

    syncSection();
    window.addEventListener('hashchange', syncSection);

    const timer = window.setTimeout(() => {
      void loadOperationsData();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('hashchange', syncSection);
    };
    // The operations console loads once on mount; child actions refresh data explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLegacyCrawlerRoute, pathname, router]);

  if (isLegacyCrawlerRoute) {
    return (
      <AdminShell title="正在返回数据概览" description="旧版运维入口已合并到当前运营工作台。">
        <AdminActionBanner>正在跳转到数据概览，请稍候。</AdminActionBanner>
      </AdminShell>
    );
  }

  async function loadOperationsData(
    overrides: Partial<{
      userPage: number;
      userPageSize: number;
      userFilters: UserFilters;
      feedbackPage: number;
      feedbackPageSize: number;
      feedbackFilters: FeedbackFilters;
      logPage: number;
      logPageSize: number;
      logFilters: LogFilters;
    }> = {}
  ) {
    const nextUserPage = overrides.userPage ?? userPage;
    const nextUserPageSize = overrides.userPageSize ?? userPageSize;
    const nextUserFilters = overrides.userFilters ?? userFilters;
    const nextFeedbackPage = overrides.feedbackPage ?? feedbackPage;
    const nextFeedbackPageSize = overrides.feedbackPageSize ?? feedbackPageSize;
    const nextFeedbackFilters = overrides.feedbackFilters ?? feedbackFilters;
    const nextLogPage = overrides.logPage ?? logPage;
    const nextLogPageSize = overrides.logPageSize ?? logPageSize;
    const nextLogFilters = overrides.logFilters ?? logFilters;

    try {
      const [userData, feedbackData, logData] = await Promise.all([
        invokeAdminApi<{ users: UserApiRow[]; total: number; page: number; pageSize: number; metrics: UserMetricsPayload }>({
          resource: 'users',
          action: 'list',
          page: nextUserPage,
          pageSize: nextUserPageSize,
          filters: serializeUserFilters(nextUserFilters)
        }),
        invokeAdminApi<{ feedback: FeedbackApiRow[]; total: number; page: number; pageSize: number; metrics: FeedbackMetricsPayload }>({
          resource: 'feedback',
          action: 'list',
          page: nextFeedbackPage,
          pageSize: nextFeedbackPageSize,
          filters: serializeFeedbackFilters(nextFeedbackFilters)
        }),
        invokeAdminApi<{ logs: LogApiRow[]; total: number; page: number; pageSize: number; metrics: LogMetricsPayload }>({
          resource: 'logs',
          action: 'list',
          page: nextLogPage,
          pageSize: nextLogPageSize,
          filters: serializeLogFilters(nextLogFilters)
        })
      ]);
      setUsers(userData.users.map(mapUserApiRow));
      setFeedback(feedbackData.feedback.map(mapFeedbackApiRow));
      setLogs(logData.logs.map(mapLogApiRow));
      setUserMetrics(buildUserMetrics(userData.metrics));
      setFeedbackMetrics(buildFeedbackMetrics(feedbackData.metrics));
      setLogMetrics(buildLogMetrics(logData.metrics));
      setUserTotal(userData.total);
      setFeedbackTotal(feedbackData.total);
      setLogTotal(logData.total);
      setUserPage(userData.page);
      setUserPageSize(userData.pageSize);
      setFeedbackPage(feedbackData.page || nextFeedbackPage);
      setFeedbackPageSize(feedbackData.pageSize || nextFeedbackPageSize);
      setLogPage(logData.page || nextLogPage);
      setLogPageSize(logData.pageSize || nextLogPageSize);
      setUserFilters(nextUserFilters);
      setFeedbackFilters(nextFeedbackFilters);
      setLogFilters(nextLogFilters);
      setMessage('');
    } catch (error) {
      setUsers([]);
      setFeedback([]);
      setLogs([]);
      setMessage(`运营数据暂时无法更新：${getAdminErrorMessage(error)}`);
    }
  }

  async function updateUserStatus(id: string, status: string, note: string) {
    if ((status === 'banned' || status === 'restricted') && !window.confirm('确认调整该用户状态吗？')) {
      return;
    }

    try {
      await invokeAdminApi({ resource: 'users', action: 'update_status', id, status, note });
      setMessage('用户状态已更新。');
      await loadOperationsData();
    } catch (error) {
      setMessage(getAdminErrorMessage(error, '用户状态更新失败。'));
    }
  }

  async function updateFeedbackStatus(id: string, status: string, note: string) {
    try {
      await invokeAdminApi({ resource: 'feedback', action: 'update_status', id, status, note });
      setMessage('反馈/举报状态已更新。');
      await loadOperationsData();
    } catch (error) {
      setMessage(getAdminErrorMessage(error, '反馈处理失败。'));
    }
  }

  async function updateSetting(key: string, value: unknown) {
    try {
      await invokeAdminApi({ resource: 'settings', action: 'update', key, value });
      setMessage('系统设置已更新。');
    } catch (error) {
      setMessage(getAdminErrorMessage(error, '系统设置更新失败。'));
    }
  }

  return (
    <AdminShell title={operationsSectionTitles[activeSection]}>
      <div className="min-w-0 space-y-6">
        {message ? <AdminActionBanner tone={message.includes('失败') || message.includes('无法') ? 'danger' : 'info'}>{message}</AdminActionBanner> : null}
        {activeSection === 'users' ? (
          <UsersView
            users={users}
            metrics={userMetrics}
            total={userTotal || users.length}
            page={userPage}
            pageSize={userPageSize}
            filters={userFilters}
            onPageChange={(nextPage) => loadOperationsData({ userPage: nextPage })}
            onPageSizeChange={(nextPageSize) => loadOperationsData({ userPage: 1, userPageSize: nextPageSize })}
            onApplyFilters={(nextFilters) => loadOperationsData({ userPage: 1, userFilters: nextFilters })}
            onUpdateUserStatus={updateUserStatus}
            onNotify={setMessage}
          />
        ) : null}
        {activeSection === 'feedback' ? (
          <FeedbackView
            feedback={feedback}
            metrics={feedbackMetrics}
            total={feedbackTotal || feedback.length}
            page={feedbackPage}
            pageSize={feedbackPageSize}
            filters={feedbackFilters}
            onPageChange={(nextPage) => loadOperationsData({ feedbackPage: nextPage })}
            onPageSizeChange={(nextPageSize) => loadOperationsData({ feedbackPage: 1, feedbackPageSize: nextPageSize })}
            onApplyFilters={(nextFilters) => loadOperationsData({ feedbackPage: 1, feedbackFilters: nextFilters })}
            onUpdateFeedbackStatus={updateFeedbackStatus}
            onNotify={setMessage}
          />
        ) : null}
        {activeSection === 'logs' ? (
          <LogsView
            logs={logs}
            metrics={logMetrics}
            total={logTotal || logs.length}
            page={logPage}
            pageSize={logPageSize}
            filters={logFilters}
            onPageChange={(nextPage) => loadOperationsData({ logPage: nextPage })}
            onPageSizeChange={(nextPageSize) => loadOperationsData({ logPage: 1, logPageSize: nextPageSize })}
            onApplyFilters={(nextFilters) => loadOperationsData({ logPage: 1, logFilters: nextFilters })}
            onNotify={setMessage}
          />
        ) : null}
        {activeSection === 'settings' ? <SettingsView onUpdateSetting={updateSetting} onNotify={setMessage} /> : null}
      </div>
    </AdminShell>
  );
}

function UsersView({
  users,
  metrics,
  total,
  page,
  pageSize,
  filters,
  onPageChange,
  onPageSizeChange,
  onApplyFilters,
  onUpdateUserStatus,
  onNotify
}: {
  users: AdminUserRow[];
  metrics: AdminMetric[];
  total: number;
  page: number;
  pageSize: number;
  filters: UserFilters;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onApplyFilters: (filters: UserFilters) => void;
  onUpdateUserStatus: (id: string, status: string, note: string) => void;
  onNotify: (message: string) => void;
}) {
  const icons = [UsersRound, UserPlus, CheckCircle2, Ban];
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [draftFilters, setDraftFilters] = useState<UserFilters>(filters);
  const [noteDraft, setNoteDraft] = useState('');
  const selectedUser = users.find((user) => user.id === selectedUserId) || users[0] || null;

  function previewUser(user: AdminUserRow) {
    setSelectedUserId(user.id);
    onNotify(`已打开 ${user.nickname} 的用户详情预览。`);
  }

  function startUserNote(user: AdminUserRow) {
    setSelectedUserId(user.id);
    setNoteDraft('');
    onNotify(`请为 ${user.nickname} 填写备注。`);
  }

  function saveUserNote(user: AdminUserRow) {
    const note = noteDraft.trim();
    if (!note) {
      onNotify('请先填写备注。');
      return;
    }
    onUpdateUserStatus(user.id, userStatusToApi(user.status), note);
    setNoteDraft('');
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-6">
        <AdminPanel>
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[180px_minmax(280px,1fr)_160px_160px_110px_110px]">
            <AdminInput
              placeholder="请输入用户ID"
              value={draftFilters.userId}
              onChange={(value) => setDraftFilters((current) => ({ ...current, userId: value }))}
            />
            <AdminInput
              placeholder="请输入昵称 / 学校 / 专业 / 邮箱"
              value={draftFilters.query}
              onChange={(value) => setDraftFilters((current) => ({ ...current, query: value }))}
            />
            <AdminSelect
              value={draftFilters.status}
              options={['全部状态', '正常', '限制', '封禁', '已注销']}
              onChange={(value) => setDraftFilters((current) => ({ ...current, status: value }))}
            />
            <AdminSelect
              value={draftFilters.activity}
              options={['全部时间', '今日活跃', '7日活跃', '30日活跃']}
              onChange={(value) => setDraftFilters((current) => ({ ...current, activity: value }))}
            />
            <AdminButton onClick={() => onApplyFilters(draftFilters)}>查询</AdminButton>
            <AdminButton
              tone="secondary"
              onClick={() => {
                setDraftFilters(defaultUserFilters);
                onApplyFilters(defaultUserFilters);
                onNotify('用户筛选已重置。');
              }}
            >
              重置
            </AdminButton>
          </div>
        </AdminPanel>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric, index) => (
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
                {users.length ? (
                  users.map((user) => (
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
                          <button className="text-blue-600" onClick={() => onUpdateUserStatus(user.id, 'restricted', '限制用户提交')}>限制</button>
                          <button className="text-blue-600" onClick={() => onUpdateUserStatus(user.id, 'banned', '封禁用户')}>封禁</button>
                          <button className="text-blue-600" onClick={() => startUserNote(user)}>备注</button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-slate-100">
                    <td colSpan={11} className="px-5 py-14 text-center">
                      <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                        暂无用户数据。
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <AdminPagination total={total} page={page} pageSize={pageSize} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
        </AdminPanel>
      </div>

      <AdminPanel title="用户详情预览">
        <div className="p-5">
          {selectedUser ? (
            <>
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
              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                className="mt-5 h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                placeholder="例如：已电话核验、限制原因或用户申诉情况。"
              />
              <button className="mt-3 text-sm font-semibold text-blue-600" onClick={() => saveUserNote(selectedUser)}>编辑备注</button>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              暂无用户数据。请稍后刷新，或检查当前筛选条件。
            </div>
          )}
        </div>
      </AdminPanel>
    </div>
  );
}

function FeedbackView({
  feedback,
  metrics,
  total,
  page,
  pageSize,
  filters,
  onPageChange,
  onPageSizeChange,
  onApplyFilters,
  onUpdateFeedbackStatus,
  onNotify
}: {
  feedback: AdminFeedbackRow[];
  metrics: AdminMetric[];
  total: number;
  page: number;
  pageSize: number;
  filters: FeedbackFilters;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onApplyFilters: (filters: FeedbackFilters) => void;
  onUpdateFeedbackStatus: (id: string, status: string, note: string) => void;
  onNotify: (message: string) => void;
}) {
  const icons = [ShieldAlert, Clock3, CheckCircle2, FileText];
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const [draftFilters, setDraftFilters] = useState<FeedbackFilters>(filters);
  const selectedFeedback = feedback.find((item) => item.id === selectedFeedbackId) || feedback[0] || null;

  function previewFeedback(item: AdminFeedbackRow) {
    setSelectedFeedbackId(item.id);
    onNotify(`已打开反馈/举报 ${item.id} 的处理详情。`);
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <AdminPanel>
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-[140px_160px_160px_150px_150px_minmax(260px,1fr)_100px_100px]">
            <AdminSelect
              label="类型"
              value={draftFilters.type}
              options={['全部类型', '反馈', '举报']}
              onChange={(value) => setDraftFilters((current) => ({ ...current, type: value }))}
            />
            <AdminSelect
              label="关联内容"
              value={draftFilters.module}
              options={['全部内容', '通知内容', 'Offer信息', '系统功能', '用户行为']}
              onChange={(value) => setDraftFilters((current) => ({ ...current, module: value }))}
            />
            <AdminSelect
              label="处理状态"
              value={draftFilters.status}
              options={['全部状态', '待处理', '处理中', '已解决', '已关闭']}
              onChange={(value) => setDraftFilters((current) => ({ ...current, status: value }))}
            />
            <AdminInput
              type="date"
              placeholder="开始日期"
              value={draftFilters.dateFrom}
              onChange={(value) => setDraftFilters((current) => ({ ...current, dateFrom: value }))}
            />
            <AdminInput
              type="date"
              placeholder="结束日期"
              value={draftFilters.dateTo}
              onChange={(value) => setDraftFilters((current) => ({ ...current, dateTo: value }))}
            />
            <AdminInput
              placeholder="搜索反馈内容 / 用户名 / ID"
              value={draftFilters.query}
              onChange={(value) => setDraftFilters((current) => ({ ...current, query: value }))}
            />
            <AdminButton onClick={() => onApplyFilters(draftFilters)}>查询</AdminButton>
            <AdminButton
              tone="secondary"
              onClick={() => {
                setDraftFilters(defaultFeedbackFilters);
                onApplyFilters(defaultFeedbackFilters);
                onNotify('反馈/举报筛选条件已重置。');
              }}
            >
              重置
            </AdminButton>
          </div>
        </AdminPanel>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric, index) => (
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
          <AdminPagination total={total} page={page} pageSize={pageSize} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
        </AdminPanel>
      </div>

      <AdminPanel title="处理工作台">
        <div className="p-5 text-sm text-slate-600">
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            {selectedFeedback ? '可继续处理或关闭。' : '请选择一条记录。'}
          </div>
          <DetailList
            items={[
              ['反馈类型', selectedFeedback?.type || '-'],
              ['关联模块', selectedFeedback?.module || '-'],
              ['提交内容', selectedFeedback?.content || '-'],
              ['建议处理方式', selectedFeedback ? '核验关联内容后更新处理状态。' : '-']
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

function LogsView({
  logs,
  metrics,
  total,
  page,
  pageSize,
  filters,
  onPageChange,
  onPageSizeChange,
  onApplyFilters,
  onNotify
}: {
  logs: AdminOperationLog[];
  metrics: AdminMetric[];
  total: number;
  page: number;
  pageSize: number;
  filters: LogFilters;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onApplyFilters: (filters: LogFilters) => void;
  onNotify: (message: string) => void;
}) {
  const icons = [FileText, Trash2, ShieldAlert, Ban];
  const [draftFilters, setDraftFilters] = useState<LogFilters>(filters);

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
      <div className="min-w-0 space-y-6">
        <AdminPanel>
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-[150px_160px_160px_150px_150px_minmax(260px,1fr)_100px_100px]">
            <AdminSelect
              label="操作人"
              value={draftFilters.operator}
              options={['全部操作人', 'admin', 'system']}
              onChange={(value) => setDraftFilters((current) => ({ ...current, operator: value }))}
            />
            <AdminSelect
              label="操作类型"
              value={draftFilters.action}
              options={['全部类型', 'notice', 'offer', 'user', 'feedback', 'setting', 'delete']}
              onChange={(value) => setDraftFilters((current) => ({ ...current, action: value }))}
            />
            <AdminSelect
              label="对象模块"
              value={draftFilters.module}
              options={['全部模块', 'notices', 'offers', 'users', 'feedback', 'settings']}
              onChange={(value) => setDraftFilters((current) => ({ ...current, module: value }))}
            />
            <AdminInput
              type="date"
              placeholder="开始日期"
              value={draftFilters.dateFrom}
              onChange={(value) => setDraftFilters((current) => ({ ...current, dateFrom: value }))}
            />
            <AdminInput
              type="date"
              placeholder="结束日期"
              value={draftFilters.dateTo}
              onChange={(value) => setDraftFilters((current) => ({ ...current, dateTo: value }))}
            />
            <AdminInput
              placeholder="操作对象 / IP / 备注"
              value={draftFilters.query}
              onChange={(value) => setDraftFilters((current) => ({ ...current, query: value }))}
            />
            <AdminButton onClick={() => onApplyFilters(draftFilters)}>查询</AdminButton>
            <AdminButton
              tone="secondary"
              onClick={() => {
                setDraftFilters(defaultLogFilters);
                onApplyFilters(defaultLogFilters);
                onNotify('操作日志筛选条件已重置。');
              }}
            >
              重置
            </AdminButton>
          </div>
        </AdminPanel>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric, index) => (
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
          <AdminPagination total={total} page={page} pageSize={pageSize} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
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
    onNotify(`${role} 权限说明已更新。`);
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <AdminPanel title="角色权限">
          <SimpleTable
            columns={['角色', '权限范围', '高危权限', '成员数', '操作']}
            rows={[
              ['超级管理员', '全部权限', '删除 / 封禁 / 导出 / 配置', '1', <button key="edit-super" className="text-slate-500 hover:text-blue-600" onClick={() => roleMessage('超级管理员')}>权限说明</button>],
              ['内容审核员', '通知与 Offer 审核', '下架内容', '3', <button key="edit-review" className="text-slate-500 hover:text-blue-600" onClick={() => roleMessage('内容审核员')}>权限说明</button>],
              ['运营管理员', '用户、反馈、内容处理', '限制用户', '2', <button key="edit-ops" className="text-slate-500 hover:text-blue-600" onClick={() => roleMessage('运营管理员')}>权限说明</button>],
              ['只读管理员', '只读数据', '无', '1', <button key="edit-read" className="text-slate-500 hover:text-blue-600" onClick={() => roleMessage('只读管理员')}>权限说明</button>]
            ]}
          />
        </AdminPanel>
      </div>
      <SettingsCard onUpdateSetting={onUpdateSetting} />
    </div>
  );
}

function SettingsCard({ onUpdateSetting }: { onUpdateSetting?: (key: string, value: unknown) => void }) {
  if (!onUpdateSetting) {
    return (
      <AdminPanel title="审计规则 / 基础配置">
        <div className="space-y-4 p-5 text-sm">
          <Link
            href="/admin/settings"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            进入系统设置
          </Link>
        </div>
      </AdminPanel>
    );
  }

  const settings = [
    ['content_review_enabled', '开启内容审核', '开启后，用户发布内容需审核', true],
    ['offer_submit_enabled', '允许用户提交Offer', '开启后，用户可提交Offer', true],
    ['report_alert_enabled', '开启举报提醒', '开启后，收到举报会发送提醒', true],
    ['operation_log_retention_days', '日志保留180天', '超时时间的日志将自动删除', 180]
  ] as const;

  return (
    <AdminPanel title="基础配置">
      <div className="space-y-5 p-5">
        {settings.map(([key, title, , value]) => (
          <div key={title} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5 last:border-b-0 last:pb-0">
            <div className="font-semibold text-slate-950">{title}</div>
            <button
              type="button"
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

function serializeUserFilters(filters: UserFilters) {
  return {
    userId: filters.userId.trim(),
    query: filters.query.trim(),
    status: userStatusToApiFilter(filters.status),
    activity: userActivityToApi(filters.activity)
  };
}

function userStatusToApiFilter(status: string) {
  if (status === '限制') return 'restricted';
  if (status === '封禁') return 'banned';
  if (status === '已注销') return 'deleted';
  if (status === '正常') return 'active';
  return 'all';
}

function userActivityToApi(activity: string) {
  if (activity === '今日活跃') return 'today';
  if (activity === '7日活跃') return '7d';
  if (activity === '30日活跃') return '30d';
  return 'all';
}

function serializeFeedbackFilters(filters: FeedbackFilters) {
  return {
    type: filters.type === '举报' ? 'report' : filters.type === '反馈' ? 'feedback' : 'all',
    module: feedbackModuleToApi(filters.module),
    status: feedbackStatusToApi(filters.status),
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    query: filters.query.trim()
  };
}

function feedbackModuleToApi(module: string) {
  if (module === '通知内容') return 'notice';
  if (module === 'Offer信息') return 'offer';
  if (module === '用户行为') return 'user';
  if (module === '系统功能') return 'system';
  return 'all';
}

function feedbackStatusToApi(status: string) {
  if (status === '处理中') return 'processing';
  if (status === '已解决') return 'resolved';
  if (status === '已关闭') return 'closed';
  if (status === '待处理') return 'pending';
  return 'all';
}

function serializeLogFilters(filters: LogFilters) {
  return {
    operator: filters.operator === '全部操作人' ? 'all' : filters.operator,
    action: filters.action === '全部类型' ? 'all' : filters.action,
    module: filters.module === '全部模块' ? 'all' : filters.module,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    query: filters.query.trim()
  };
}

type UserApiRow = {
  id: string;
  nickname: string;
  email?: string;
  undergraduate_school: string;
  major: string;
  target_major: string;
  created_at: string;
  updated_at: string;
  application_count: number;
  notice_count: number;
  offer_count: number;
  moderation_status: string;
};

type UserMetricsPayload = {
  totalUsers: number;
  todayUsers: number;
  normalUsers: number;
  restrictedUsers: number;
  bannedUsers: number;
  deletedUsers: number;
};

type FeedbackMetricsPayload = {
  pending: number;
  processing: number;
  resolved: number;
  closed: number;
};

type LogMetricsPayload = {
  todayOperations: number;
  deleteOperations: number;
  banOperations: number;
  failedOperations: number;
};

function mapUserApiRow(row: UserApiRow): AdminUserRow {
  return {
    id: row.id,
    nickname: row.nickname || '未设置昵称',
    contact: row.email || `${row.undergraduate_school || '未填写学校'} / ${row.major || '未填写专业'}`,
    registeredAt: formatBeijingDateTime(row.created_at),
    lastActiveAt: formatBeijingDateTime(row.updated_at),
    noticeCount: row.notice_count || 0,
    offerCount: row.offer_count || 0,
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
    submittedAt: formatBeijingDateTime(row.created_at),
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
    createdAt: formatBeijingDateTime(row.created_at)
  };
}

function buildUserMetrics(metrics?: UserMetricsPayload): AdminMetric[] {
  const data = metrics || {
    totalUsers: 0,
    todayUsers: 0,
    normalUsers: 0,
    restrictedUsers: 0,
    bannedUsers: 0,
    deletedUsers: 0
  };

  return [
    { label: '总用户数', value: formatNumber(data.totalUsers), hint: '累计注册用户', tone: 'blue' },
    { label: '今日新增', value: formatNumber(data.todayUsers), hint: '今日新增账号', tone: 'green' },
    { label: '正常用户', value: formatNumber(data.normalUsers), hint: `限制 ${formatNumber(data.restrictedUsers)} 个`, tone: 'blue' },
    { label: '封禁用户', value: formatNumber(data.bannedUsers), hint: `已注销 ${formatNumber(data.deletedUsers)} 个`, tone: 'rose' }
  ];
}

function buildFeedbackMetrics(metrics?: FeedbackMetricsPayload): AdminMetric[] {
  const data = metrics || { pending: 0, processing: 0, resolved: 0, closed: 0 };

  return [
    { label: '待处理', value: formatNumber(data.pending), hint: '需要运营处理', tone: 'rose' },
    { label: '处理中', value: formatNumber(data.processing), hint: '已有处理人', tone: 'amber' },
    { label: '已解决', value: formatNumber(data.resolved), hint: '用户问题已闭环', tone: 'green' },
    { label: '已关闭', value: formatNumber(data.closed), hint: '无需继续处理', tone: 'slate' }
  ];
}

function buildLogMetrics(metrics?: LogMetricsPayload): AdminMetric[] {
  const data = metrics || { todayOperations: 0, deleteOperations: 0, banOperations: 0, failedOperations: 0 };

  return [
    { label: '今日操作', value: formatNumber(data.todayOperations), hint: '后台关键动作', tone: 'blue' },
    { label: '删除操作', value: formatNumber(data.deleteOperations), hint: '需重点留痕', tone: 'rose' },
    { label: '封禁操作', value: formatNumber(data.banOperations), hint: '账号风险处置', tone: 'amber' },
    { label: '异常登录', value: formatNumber(data.failedOperations), hint: '安全提醒', tone: 'purple' }
  ];
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value || 0);
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
          {rows.length ? (
            rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} className="border-t border-slate-100">
                <td className="px-5 py-4"><input type="checkbox" aria-label={`选择第 ${rowIndex + 1} 行`} /></td>
                {row.map((cell, cellIndex) => (
                  <td key={`row-${rowIndex}-${cellIndex}`} className="max-w-[260px] truncate px-5 py-4 text-slate-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr className="border-t border-slate-100">
              <td colSpan={columns.length + 1} className="px-5 py-14 text-center">
                <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                  暂无数据。请确认筛选条件或稍后刷新。
                </div>
              </td>
            </tr>
          )}
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
