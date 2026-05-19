'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  Bell,
  BrainCircuit,
  ChevronDown,
  ClipboardList,
  Database,
  Download,
  Flag,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound
} from 'lucide-react';
import { refreshAdminSession, signOutAdmin, watchAdminSession, type AdminSession } from '@/lib/admin-session';
import { invokeAdminApi } from '@/lib/admin-api';
import packageJson from '../package.json';
import { adminClassNames } from './admin-ui';

const adminNavItems = [
  { href: '/admin/dashboard', label: '数据概览', icon: LayoutDashboard },
  { href: '/admin/notices', label: '通知管理', icon: Bell },
  { href: '/admin/offers', label: 'Offer池管理', icon: ClipboardList },
  { href: '/admin/ai-leads', label: 'AI内测管理', icon: BrainCircuit },
  { href: '/admin/users', label: '用户管理', icon: UsersRound },
  { href: '/admin/feedback', label: '反馈举报', icon: Flag },
  { href: '/admin/logs', label: '操作日志', icon: ShieldCheck },
  { href: '/admin/settings', label: '系统设置', icon: Settings }
];

const quickActions = [
  { href: '/admin/notices/new', label: '新建通知', icon: Plus },
  { href: '/admin/notices', label: '审核通知', icon: Bell },
  { href: '/admin/offers', label: '审核 Offer', icon: ClipboardList },
  { href: '/admin/ai-leads', label: '查看 AI 内测', icon: BrainCircuit },
  { href: '/admin/logs', label: '查看/导出日志', icon: Download }
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
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-500">{description}</p>
        <Link
          href="/admin/login"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white"
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
  const [shellStatus, setShellStatus] = useState<ShellStatus>(emptyShellStatus);
  const normalizedPathname = pathname.replace(/\/$/, '') || '/';

  useEffect(() => {
    let disposed = false;

    const syncSession = async () => {
      const verifiedSession = await refreshAdminSession();
      if (!disposed) {
        setSession(verifiedSession);
        setSessionReady(true);
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
          error: error instanceof Error ? error.message : '后台状态接口暂不可用',
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
        description="我们正在确认你的管理员登录状态。通过校验后才会加载后台导航、用户数据和审核工具。"
      />
    );
  }

  if (!session) {
    return (
      <AdminAuthGate
        title="请先登录运营后台"
        description="后台只面向管理员开放。未登录时不会展示用户、反馈、日志和系统设置等运营入口。"
      />
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
  const systemHealthy = !shellStatus.error;

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] border-r border-slate-200 bg-white lg:block">
        <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 text-lg font-black text-white shadow-sm shadow-blue-500/20">S</div>
          <div>
            <div className="text-lg font-semibold text-blue-600">SeekOffer</div>
            <div className="text-sm font-medium text-slate-700">运营管理后台</div>
            <div className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">SeekOffer Admin</div>
          </div>
        </div>

        <nav className="space-y-2 px-3 py-5">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const itemPath = item.href.replace(/\/$/, '');
            const active =
              normalizedPathname === itemPath ||
              (itemPath !== '/admin/dashboard' && normalizedPathname.startsWith(`${itemPath}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={adminClassNames(
                  'relative flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium transition',
                  active ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-700 hover:bg-slate-50 hover:text-blue-600'
                )}
                aria-current={active ? 'page' : undefined}
              >
                {active ? <span className="absolute bottom-3 left-0 top-3 w-1 rounded-r-full bg-blue-600" /> : null}
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-5 left-5 right-5">
          <div className={adminClassNames('rounded-2xl border p-4', systemHealthy ? 'border-emerald-100 bg-emerald-50/80' : 'border-rose-100 bg-rose-50/80')}>
            <div className={adminClassNames('flex items-center gap-2 text-sm font-semibold', systemHealthy ? 'text-emerald-700' : 'text-rose-700')}>
              <ShieldCheck className="h-4 w-4" />
              {shellStatus.loading ? '正在同步后台状态' : systemHealthy ? '系统运行正常' : '后台状态异常'}
            </div>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">API 响应</dt><dd className={adminClassNames('font-semibold', systemHealthy ? 'text-emerald-700' : 'text-rose-700')}>{shellStatus.apiLatencyMs ? `${shellStatus.apiLatencyMs}ms` : '待检测'}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">实时在线</dt><dd className="font-semibold text-slate-700">{shellStatus.onlineVisitors}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">待处理</dt><dd className="font-semibold text-slate-700">{pendingCount}</dd></div>
              <div className={adminClassNames('flex items-center justify-between gap-3 border-t pt-2', systemHealthy ? 'border-emerald-100' : 'border-rose-100')}><dt className="text-slate-500">当前版本</dt><dd className="font-semibold text-slate-700">v{appVersion}</dd></div>
            </dl>
            {shellStatus.error ? <p className="mt-3 line-clamp-2 text-xs text-rose-600">{shellStatus.error}</p> : null}
            <Link href="/admin/settings" className="mt-3 inline-flex text-xs font-semibold text-blue-700">
              查看系统详情 →
            </Link>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur lg:px-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>

          <div className="flex items-center gap-4">
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
                className="h-11 w-[360px] rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                placeholder="搜索通知、学校、用户；回车进入通知管理"
              />
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setQuickMenuOpen((open) => !open)}
                className="hidden h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 xl:inline-flex"
              >
                <Sparkles className="h-4 w-4 text-blue-600" />
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
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Icon className="h-4 w-4" />
                        {action.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="h-8 w-px bg-slate-200" />

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
              <Database className="h-5 w-5" />
            </Link>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white">
                <UserRound className="h-5 w-5" />
              </div>
              <div className="hidden text-sm md:block">
                <div className="font-semibold text-slate-950">{session?.name || 'admin'}</div>
                <div className="text-xs text-slate-500">{session ? getRoleName(session.role) : '未登录'}</div>
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

        <main className="min-h-[calc(100vh-80px)] px-5 py-6 lg:px-8">
          {session ? (
            children
          ) : (
            <section className="mx-auto mt-20 max-w-xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h2 className="mt-6 text-2xl font-semibold text-slate-950">请先登录运营后台</h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">后台用于审核通知、Offer、用户反馈和系统日志，所有关键操作都会留痕。</p>
              <Link
                href="/admin/login"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white"
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
