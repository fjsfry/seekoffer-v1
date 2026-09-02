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
import {
  ADMIN_DASHBOARD_SNAPSHOT_EVENT,
  type AdminDashboardShellSnapshot
} from '@/lib/admin-shell-events';
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
  showLogin = false
}: {
  title: string;
  showLogin?: boolean;
}) {
  return (
    <main className="min-h-screen bg-[#f6f8fb] px-5 py-8 text-slate-900">
      <section className="mx-auto mt-24 max-w-xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-teal-700">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold text-slate-950">{title}</h1>
        {showLogin ? (
          <Link
            href="/admin/login"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white"
          >
            进入后台登录
          </Link>
        ) : null}
      </section>
    </main>
  );
}

export function AdminShell({
  title,
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

    if (normalizedPathname === '/admin/dashboard') {
      setShellStatus((current) => ({ ...current, loading: false }));
      const syncDashboardSnapshot = (event: Event) => {
        const snapshot = (event as CustomEvent<AdminDashboardShellSnapshot>).detail;
        if (!snapshot) return;
        setShellStatus((current) => ({
          ...current,
          ...snapshot,
          loading: false,
          error: '',
          lastCheckedAt: new Date().toISOString()
        }));
      };
      window.addEventListener(ADMIN_DASHBOARD_SNAPSHOT_EVENT, syncDashboardSnapshot);
      return () => {
        window.removeEventListener(ADMIN_DASHBOARD_SNAPSHOT_EVENT, syncDashboardSnapshot);
      };
    }

    let disposed = false;
    let inFlight: Promise<void> | null = null;

    const loadShellStatus = () => {
      if (document.visibilityState !== 'visible') {
        return Promise.resolve();
      }

      if (inFlight) {
        return inFlight;
      }

      const request = (async () => {
        const startedAt = performance.now();
        setShellStatus((current) => ({ ...current, loading: true, error: '' }));

        try {
          const snapshot = await invokeAdminApi<{
            overview: { metrics: ShellOverviewMetrics };
            analytics: ShellAnalyticsPayload;
          }>({ resource: 'shell', action: 'snapshot' });
          const { overview, analytics } = snapshot;

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
        } finally {
          inFlight = null;
        }
      })();

      inFlight = request;
      return request;
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadShellStatus();
      }
    };

    refreshWhenVisible();
    const interval = window.setInterval(refreshWhenVisible, 5 * 60_000);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [normalizedPathname, session]);

  if (!sessionReady) {
    return (
      <AdminAuthGate title="正在加载" />
    );
  }

  if (!session) {
    return (
      <AdminAuthGate title="请先登录" showLogin />
    );
  }

  const pendingCount = shellStatus.pendingNotices + shellStatus.pendingOffers + shellStatus.pendingFeedback;
  const reminderHref =
    shellStatus.pendingNotices > 0
      ? '/admin/notices'
      : shellStatus.pendingOffers > 0
        ? '/admin/offers'
        : shellStatus.pendingFeedback > 0
          ? '/admin/feedback'
          : '/admin/logs';
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

        {sidebarCollapsed ? (
          <div className="absolute bottom-5 left-3 right-3">
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-teal-200 hover:text-teal-800"
              aria-label="展开左侧导航"
              title="展开导航"
            >
              <PanelLeftOpen className="h-5 w-5" />
            </button>
          </div>
        ) : null}
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
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 lg:gap-4">
            <label className="relative hidden xl:block">
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
