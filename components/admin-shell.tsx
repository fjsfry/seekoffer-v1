'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  Bell,
  ChevronDown,
  ClipboardList,
  Download,
  Flag,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  X
} from 'lucide-react';
import { refreshAdminSession, signOutAdmin, watchAdminSession, type AdminSession } from '@/lib/admin-session';
import { getAdminErrorMessage, invokeAdminApi } from '@/lib/admin-api';
import packageJson from '../package.json';
import { adminClassNames } from './admin-ui';

const adminNavItems = [
  { href: '/admin/dashboard', label: '数据概览', icon: LayoutDashboard },
  { href: '/admin/notices', label: '通知管理', icon: Bell },
  { href: '/admin/offers', label: 'Offer圈管理', icon: ClipboardList },
  { href: '/admin/users', label: '用户管理', icon: UsersRound },
  { href: '/admin/feedback', label: '反馈举报', icon: Flag },
  { href: '/admin/logs', label: '操作日志', icon: ShieldCheck },
  { href: '/admin/settings', label: '系统设置', icon: Settings }
];

const quickActions = [
  { href: '/admin/notices/new', label: '新建通知', icon: Plus },
  { href: '/admin/notices', label: '审核通知', icon: Bell },
  { href: '/admin/offers', label: '审核 Offer', icon: ClipboardList },
  { href: '/admin/logs', label: '查看操作记录', icon: Download }
];

type ShellOverviewMetrics = {
  pendingNotices: number;
  pendingOffers: number;
  pendingFeedback: number;
};

type ShellAnalyticsPayload = {
  metrics: {
    onlineVisitors: number;
    totalVisitors: number;
    todayPageViews: number;
    activeWindowMinutes: number;
  };
};

type ShellStatus = {
  loading: boolean;
  error: string;
  apiLatencyMs: number | null;
  pendingNotices: number;
  pendingOffers: number;
  pendingFeedback: number;
  onlineVisitors: number;
  totalVisitors: number;
  todayPageViews: number;
  lastCheckedAt: string;
};

const emptyShellStatus: ShellStatus = {
  loading: true,
  error: '',
  apiLatencyMs: null,
  pendingNotices: 0,
  pendingOffers: 0,
  pendingFeedback: 0,
  onlineVisitors: 0,
  totalVisitors: 0,
  todayPageViews: 0,
  lastCheckedAt: ''
};

const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || packageJson.version;

function getRoleName(role: string) {
  const map: Record<string, string> = {
    super_admin: '超级管理员',
    content_reviewer: '内容审核员',
    ops_manager: '运营管理员',
    readonly_admin: '只读管理员'
  };

  return map[role] || role;
}

function AdminAuthGate({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="min-h-screen bg-[#f6f8fb] px-5 py-8 text-slate-900">
      <section className="mx-auto mt-24 max-w-xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-teal-700">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-500">{description}</p>
        <Link
          href="/admin/login"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white"
        >
          进入后台登录
        </Link>
      </section>
    </main>
  );
}

export function AdminShell({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [shellStatus, setShellStatus] = useState<ShellStatus>(emptyShellStatus);
  const normalizedPathname = pathname.replace(/\/$/, '') || '/';

  useEffect(() => {
    let disposed = false;

    const syncSession = async () => {
      try {
        const verifiedSession = await refreshAdminSession();
        if (!disposed) {
          setSession(verifiedSession);
        }
      } catch {
        if (!disposed) {
          setSession(null);
        }
      } finally {
        if (!disposed) {
          setSessionReady(true);
        }
      }
    };

    void syncSession();
    const dispose = watchAdminSession(() => {
      void syncSession();
    });

    return () => {
      disposed = true;
      dispose();
    };
  }, []);

  useEffect(() => {
    if (!sessionReady || session) {
      return;
    }

    const next = pathname && pathname !== '/admin/login' ? `?next=${encodeURIComponent(pathname)}` : '';
    router.replace(`/admin/login${next}`);
  }, [pathname, router, session, sessionReady]);

  useEffect(() => {
    setMobileNavOpen(false);
    setQuickMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem('seekoffer-admin-sidebar') === 'collapsed');
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('seekoffer-admin-sidebar', next ? 'collapsed' : 'expanded');
      return next;
    });
  };

  useEffect(() => {
    if (!session) {
      setShellStatus(emptyShellStatus);
      return;
    }

    let disposed = false;

    const loadShellStatus = async () => {
      const startedAt = performance.now();
      setShellStatus((current) => ({ ...current, loading: true, error: '' }));

      try {
        const [overview, analytics] = await Promise.all([
          invokeAdminApi<{ metrics: ShellOverviewMetrics }>({ resource: 'overview', action: 'get' }),
          invokeAdminApi<ShellAnalyticsPayload>({ resource: 'analytics', action: 'overview' })
        ]);

        if (disposed) {
          return;
        }

        setShellStatus({
          loading: false,
          error: '',
          apiLatencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
          pendingNotices: overview.metrics.pendingNotices || 0,
          pendingOffers: overview.metrics.pendingOffers || 0,
          pendingFeedback: overview.metrics.pendingFeedback || 0,
          onlineVisitors: analytics.metrics.onlineVisitors || 0,
          totalVisitors: analytics.metrics.totalVisitors || 0,
          todayPageViews: analytics.metrics.todayPageViews || 0,
          lastCheckedAt: new Date().toISOString()
        });
      } catch (error) {
        if (disposed) {
          return;
        }

        setShellStatus((current) => ({
          ...current,
          loading: false,
          error: getAdminErrorMessage(error, '工作台暂时无法更新，请稍后刷新'),
          apiLatencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
          lastCheckedAt: new Date().toISOString()
        }));
      }
    };

    void loadShellStatus();
    const interval = window.setInterval(() => {
      void loadShellStatus();
    }, 60_000);

    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [session]);

  if (!sessionReady) {
    return (
      <AdminAuthGate
        title="正在校验后台会话"
        description="正在确认你的管理员权限。通过校验后会加载运营导航、用户数据和审核工具。"
      />
    );
  }

  if (!session) {
    return (
      <AdminAuthGate
        title="请先登录运营后台"
        description="运营后台只面向授权成员开放。未登录时不会展示用户、反馈、记录和设置入口。"
      />
    );
  }

  const pendingCount = shellStatus.pendingNotices + shellStatus.pendingOffers + shellStatus.pendingFeedback;
  const lastCheckedLabel = shellStatus.lastCheckedAt
    ? new Date(shellStatus.lastCheckedAt).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      })
    : '待检测';
  const reminderHref =
    shellStatus.pendingNotices > 0
      ? '/admin/notices'
      : shellStatus.pendingOffers > 0
        ? '/admin/offers'
        : shellStatus.pendingFeedback > 0
          ? '/admin/feedback'
          : '/admin/logs';
  const systemHealthy = !shellStatus.error;
  const renderNavItems = (onNavigate?: () => void, compact = false) =>
    adminNavItems.map((item) => {
      const Icon = item.icon;
      const itemPath = item.href.replace(/\/$/, '');
      const active =
        normalizedPathname === itemPath ||
        (itemPath !== '/admin/dashboard' && normalizedPathname.startsWith(`${itemPath}/`));

      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          title={compact ? item.label : undefined}
          aria-label={compact ? item.label : undefined}
          className={adminClassNames(
            'relative flex h-11 items-center rounded-xl text-sm font-semibold transition',
            compact ? 'justify-center px-0' : 'gap-3 px-4',
            active ? 'bg-emerald-50 text-teal-700 shadow-sm' : 'text-slate-700 hover:bg-slate-50 hover:text-teal-700'
          )}
          aria-current={active ? 'page' : undefined}
        >
          {active ? <span className="absolute bottom-3 left-0 top-3 w-1 rounded-r-full bg-teal-700" /> : null}
          <Icon className="h-5 w-5 shrink-0" />
          {!compact ? <span className="truncate">{item.label}</span> : null}
        </Link>
      );
    });

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-slate-900">
      <aside
        className={adminClassNames(
          'fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200/80 bg-white shadow-[12px_0_36px_rgba(15,23,42,0.035)] transition-[width] duration-200 lg:block',
          sidebarCollapsed ? 'w-[88px]' : 'w-[264px]'
        )}
      >
        <div className={adminClassNames('flex h-20 items-center border-b border-slate-100', sidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-5')}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-800 text-lg font-black text-white shadow-sm">S</div>
          {!sidebarCollapsed ? (
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold text-teal-900">Seekoffer</div>
              <div className="truncate text-xs font-medium text-slate-500">运营管理平台</div>
            </div>
          ) : null}
          {!sidebarCollapsed ? (
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-teal-800"
              aria-label="收起左侧导航"
              title="收起导航"
            >
              <PanelLeftClose className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <nav className="space-y-1.5 px-3 py-5">
          {renderNavItems(undefined, sidebarCollapsed)}
        </nav>

        <div className={adminClassNames('absolute bottom-5', sidebarCollapsed ? 'left-3 right-3' : 'left-5 right-5')}>
          {sidebarCollapsed ? (
            <div className="grid gap-2">
              <button
                type="button"
                onClick={toggleSidebar}
                className="flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-teal-200 hover:text-teal-800"
                aria-label="展开左侧导航"
                title="展开导航"
              >
                <PanelLeftOpen className="h-5 w-5" />
              </button>
              <Link
                href="/admin/settings"
                className={adminClassNames(
                  'relative flex h-11 items-center justify-center rounded-xl border',
                  systemHealthy ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-rose-100 bg-rose-50 text-rose-700'
                )}
                aria-label={systemHealthy ? '工作台运行正常' : '工作台需要关注'}
                title={systemHealthy ? '工作台运行正常' : '工作台需要关注'}
              >
                <ShieldCheck className="h-5 w-5" />
                {pendingCount > 0 ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{pendingCount > 99 ? '99+' : pendingCount}</span> : null}
              </Link>
            </div>
          ) : (
          <div className={adminClassNames('rounded-2xl border p-4', systemHealthy ? 'border-emerald-100 bg-emerald-50/80' : 'border-rose-100 bg-rose-50/80')}>
            <div className={adminClassNames('flex items-center gap-2 text-sm font-semibold', systemHealthy ? 'text-emerald-700' : 'text-rose-700')}>
              <ShieldCheck className="h-4 w-4" />
              {shellStatus.loading ? '正在更新工作台状态' : systemHealthy ? '工作台运行正常' : '工作台需要关注'}
            </div>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">数据同步</dt><dd className={adminClassNames('font-semibold', systemHealthy ? 'text-emerald-700' : 'text-rose-700')}>{shellStatus.loading ? '同步中' : systemHealthy ? '正常' : '异常'}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">实时在线</dt><dd className="font-semibold text-slate-700">{shellStatus.onlineVisitors}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">待处理</dt><dd className="font-semibold text-slate-700">{pendingCount}</dd></div>
              <div className={adminClassNames('flex items-center justify-between gap-3 border-t pt-2', systemHealthy ? 'border-emerald-100' : 'border-rose-100')}><dt className="text-slate-500">最近检查</dt><dd className="font-semibold text-slate-700">{lastCheckedLabel}</dd></div>
            </dl>
            {shellStatus.error ? <p className="mt-3 line-clamp-2 text-xs text-rose-600">{shellStatus.error}</p> : null}
            <Link href="/admin/settings" className="mt-3 inline-flex text-xs font-semibold text-blue-700">
              查看运营设置 →
            </Link>
          </div>
          )}
        </div>
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="关闭后台导航"
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(86vw,320px)] flex-col border-r border-slate-200 bg-white shadow-2xl">
            <div className="flex h-20 items-center justify-between gap-3 border-b border-slate-100 px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-800 text-lg font-black text-white shadow-sm">S</div>
                <div>
                  <div className="text-lg font-semibold text-teal-800">Seekoffer</div>
                  <div className="text-sm font-medium text-slate-700">运营管理中台</div>
                </div>
              </div>
              <button
                type="button"
                aria-label="关闭导航"
                onClick={() => setMobileNavOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-5">
              {renderNavItems(() => setMobileNavOpen(false))}
            </nav>
            <div className="border-t border-slate-100 p-4">
              <div className={adminClassNames('rounded-2xl border p-4 text-sm', systemHealthy ? 'border-emerald-100 bg-emerald-50/80' : 'border-rose-100 bg-rose-50/80')}>
                <div className={adminClassNames('font-semibold', systemHealthy ? 'text-emerald-700' : 'text-rose-700')}>
                  {shellStatus.loading ? '正在更新工作台状态' : systemHealthy ? '工作台运行正常' : '工作台需要关注'}
                </div>
                <div className="mt-2 text-xs text-slate-500">待处理 {pendingCount} 条 · v{appVersion}</div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <div className={adminClassNames('transition-[padding] duration-200', sidebarCollapsed ? 'lg:pl-[88px]' : 'lg:pl-[264px]')}>
        <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-4 py-3 shadow-[0_10px_32px_rgba(15,23,42,0.035)] backdrop-blur-xl lg:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="打开后台导航"
              onClick={() => setMobileNavOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label={sidebarCollapsed ? '展开左侧导航' : '收起左侧导航'}
              title={sidebarCollapsed ? '展开导航' : '收起导航'}
              onClick={toggleSidebar}
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-teal-200 hover:bg-emerald-50 hover:text-teal-800 lg:flex"
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-950 lg:text-2xl">{title}</h1>
              {description ? <p className="mt-1 line-clamp-1 text-sm text-slate-500">{description}</p> : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 lg:gap-4">
            <label className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && globalSearch.trim()) {
                    const keyword = globalSearch.trim();
                    const targetPath = /@|用户|user|^[0-9a-f-]{16,}$/i.test(keyword) ? '/admin/users' : '/admin/notices';
                    window.location.href = `${targetPath}?query=${encodeURIComponent(keyword)}`;
                  }
                }}
                className="h-11 w-[260px] rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-emerald-50 2xl:w-[340px]"
                placeholder="搜索通知、学校、用户"
              />
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setQuickMenuOpen((open) => !open)}
                className="hidden h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 2xl:inline-flex"
              >
                <Sparkles className="h-4 w-4 text-teal-700" />
                快捷操作
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
              {quickMenuOpen ? (
                <div className="absolute right-0 top-[52px] z-30 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link
                        key={action.href}
                        href={action.href}
                        onClick={() => setQuickMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-teal-700"
                      >
                        <Icon className="h-4 w-4" />
                        {action.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="hidden h-8 w-px bg-slate-200 xl:block" />

            <Link
              href={reminderHref}
              className="relative hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 md:flex"
              aria-label={`后台提醒，当前 ${pendingCount} 条待处理`}
            >
              <Bell className="h-5 w-5" />
              {pendingCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              ) : null}
            </Link>

            <Link
              href="/admin/dashboard"
              className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 md:flex"
              aria-label="数据概览"
            >
              <LayoutDashboard className="h-5 w-5" />
            </Link>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-800 text-white">
                <UserRound className="h-5 w-5" />
              </div>
              <div className="hidden text-sm md:block">
                <div className="font-semibold text-slate-950">{session.name || 'admin'}</div>
                <div className="text-xs text-slate-500">{getRoleName(session.role)}</div>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </div>

            {session ? (
              <button
                onClick={signOutAdmin}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
                aria-label="退出后台"
              >
                <LogOut className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </header>

        <main className="mx-auto min-h-[calc(100vh-80px)] max-w-[1760px] px-4 py-5 sm:px-5 lg:px-7 lg:py-6">
          {session ? (
            children
          ) : (
            <section className="mx-auto mt-20 max-w-xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-teal-700">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h2 className="mt-6 text-2xl font-semibold text-slate-950">请先登录运营后台</h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">登录后可处理通知、Offer、用户反馈和操作记录，关键动作都会留痕。</p>
              <Link
                href="/admin/login"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white"
              >
                进入后台登录
              </Link>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
