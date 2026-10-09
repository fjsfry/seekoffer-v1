'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Building2, Crown, Heart, House, Menu, MonitorDown, Newspaper, Trophy, X } from 'lucide-react';
import { SeekofferLogo } from './seekoffer-logo';
import { UserSessionEntry } from './user-session-entry';

const navItems = [
  { href: '/', label: '首页', icon: House },
  { href: '/notices', label: '通知库', icon: Newspaper },
  { href: '/competitions', label: '竞赛库', icon: Trophy },
  { href: '/colleges', label: '院校库', icon: Building2 },
  { href: '/resources', label: '资源库', icon: BookOpen },
  { href: '/offers', label: 'Offer 圈', icon: Heart },
  { href: '/pro', label: 'Pro', icon: Crown }
];

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const header = headerRef.current;
    const shell = header?.parentElement;
    if (!header || !shell) return;

    const syncHeaderHeight = () => {
      shell.style.setProperty('--site-header-height', `${header.getBoundingClientRect().height}px`);
    };

    syncHeaderHeight();
    const observer = new ResizeObserver(syncHeaderHeight);
    observer.observe(header);
    return () => {
      observer.disconnect();
      shell.style.removeProperty('--site-header-height');
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setMobileOpen(false);
      menuButtonRef.current?.focus();
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileOpen]);

  return (
    <header ref={headerRef} className="sticky top-0 z-40 -mx-4 border-b border-slate-200/70 bg-white/95 px-4 py-2.5 shadow-[0_10px_30px_rgba(18,32,38,0.04)] backdrop-blur-2xl sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 min-[1440px]:grid-cols-[auto_minmax(0,1fr)_auto]">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <SeekofferLogo />
          </div>

          <nav
            aria-label="主导航"
            className="hidden min-w-0 flex-wrap items-center justify-center gap-x-1 gap-y-1 border-t border-slate-100 pt-2 lg:col-span-2 lg:row-start-2 lg:flex min-[1440px]:col-span-1 min-[1440px]:col-start-2 min-[1440px]:row-start-1 min-[1440px]:border-t-0 min-[1440px]:pt-0"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-[14px] font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/10 ${
                    active
                      ? 'bg-brand/[0.08] text-brand'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-brand'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 justify-self-end lg:col-start-2 lg:row-start-1 lg:flex min-[1440px]:col-start-3 min-[1440px]:border-l min-[1440px]:border-slate-200 min-[1440px]:pl-3">
            <Link
              href="/download"
              aria-label="下载寻鹿桌面端"
              aria-current={pathname === '/download' ? 'page' : undefined}
              className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-3 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/10 ${
                pathname === '/download'
                  ? 'border-brand/20 bg-brand/[0.08] text-brand'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand/30 hover:text-brand'
              }`}
            >
              <MonitorDown className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>下载桌面端</span>
            </Link>
            <UserSessionEntry />
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileOpen((current) => !current)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/10 lg:hidden"
            aria-label={mobileOpen ? '关闭导航菜单' : '打开导航菜单'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-site-navigation"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen ? (
          <div id="mobile-site-navigation" className="mt-3 max-h-[calc(100dvh-5.5rem)] overflow-y-auto border-t border-slate-100 pb-1 pt-3 lg:hidden">
            <nav className="grid grid-cols-2 gap-2" aria-label="移动端主导航">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-11 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${active ? 'bg-brand/10 text-brand' : 'bg-slate-50 text-slate-600'}`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <Link
              href="/download"
              onClick={() => setMobileOpen(false)}
              aria-current={pathname === '/download' ? 'page' : undefined}
              className={`mt-3 flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2.5 ${
                pathname === '/download'
                  ? 'border-brand/20 bg-brand/10 text-brand'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/[0.08] text-brand">
                <MonitorDown className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">下载寻鹿桌面端</span>
                <span className="mt-0.5 block text-xs text-slate-500">Windows 10 / 11 · 64 位</span>
              </span>
            </Link>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <UserSessionEntry />
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
