'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ActivitySquare,
  ArrowRight,
  BookOpenCheck,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  ShieldEllipsis,
  UserCog
} from 'lucide-react';
import { getAdminSession, signOutAdmin, watchAdminSession, type AdminSession } from '@/lib/admin-session';

const adminNavItems = [
  { href: '/admin/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { href: '/admin/notices', label: '通知库管理', icon: BookOpenCheck },
  { href: '/admin/offers', label: 'Offer 池管理', icon: ShieldEllipsis },
  { href: '/admin/crawlers', label: '爬虫与同步', icon: ActivitySquare },
  { href: '/admin/login', label: '后台登录', icon: UserCog }
];

export function AdminShell({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [session, setSession] = useState<AdminSession | null>(null);

  useEffect(() => {
    setSession(getAdminSession());
    const dispose = watchAdminSession(() => {
      setSession(getAdminSession());
    });

    return () => dispose();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-4 lg:flex-row lg:px-6">
        <aside className="surface-card h-fit rounded-[30px] p-5 lg:sticky lg:top-4 lg:w-[280px] lg:shrink-0">
          <div className="rounded-[24px] bg-slate-950 px-4 py-5 text-white">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Seekoffer Admin</div>
            <div className="mt-3 text-2xl font-semibold">轻运营后台</div>
            <p className="mt-3 text-sm leading-7 text-white/75">先聚焦看数据、改通知、管 Offer 池和查看爬虫状态。</p>
          </div>

          <nav className="mt-5 grid gap-2">
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    active
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 rounded-[24px] bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-ink">
                  {session ? `${session.name} · ${session.role}` : '尚未登录后台'}
                </div>
                <div className="mt-1 text-xs leading-6 text-slate-500">
                  {session ? session.email : '先用管理员账号进入后台，再处理通知、Offer 和爬虫任务。'}
                </div>
              </div>
            </div>

            {session ? (
              <button
                onClick={signOutAdmin}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
              >
                <LogOut className="h-4 w-4" />
                退出后台
              </button>
            ) : (
              <Link
                href="/admin/login"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white"
              >
                去后台登录
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-6">
          <section className="surface-card rounded-[30px] px-6 py-6">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Admin Workspace</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{description}</p>
          </section>

          {session ? (
            children
          ) : (
            <section className="surface-card rounded-[30px] p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-brand/10 text-brand">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h2 className="mt-6 text-2xl font-semibold text-ink">请先登录后台</h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                轻后台 MVP 当前先用独立管理员账号访问，后续再接入 CloudBase 的 admin_users 与云函数校验。
              </p>
              <Link
                href="/admin/login"
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white"
              >
                打开后台登录
                <ArrowRight className="h-4 w-4" />
              </Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
