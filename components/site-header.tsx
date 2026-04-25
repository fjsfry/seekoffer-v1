'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Brain, BriefcaseBusiness, Building2, Heart, House, Newspaper, Search } from 'lucide-react';
import { SeekofferLogo } from './seekoffer-logo';
import { UserSessionEntry } from './user-session-entry';

const navItems = [
  { href: '/', label: '首页', icon: House },
  { href: '/notices', label: '通知库', icon: Newspaper },
  { href: '/colleges', label: '院校库', icon: Building2 },
  { href: '/resources', label: '资源库', icon: BookOpen },
  { href: '/offers', label: 'Offer 池', icon: Heart },
  { href: '/ai', label: 'AI 定位', icon: Brain },
  { href: '/me', label: '工作台', icon: BriefcaseBusiness }
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 -mx-4 border-b border-slate-200/70 bg-white/90 px-4 py-2.5 shadow-[0_10px_30px_rgba(18,32,38,0.04)] backdrop-blur-2xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-4">
          <div className="min-w-0 md:col-start-1 md:row-start-1">
            <SeekofferLogo />
          </div>

          <div className="flex items-center gap-3 justify-self-end md:col-start-3 md:row-start-1">
            <Link
              href="/notices"
              aria-label="搜索通知"
              className="hidden h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:text-brand md:inline-flex"
            >
              <Search className="h-5 w-5" />
            </Link>
            <UserSessionEntry />
          </div>

          <div className="col-span-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
            <div className="md:mx-auto md:max-w-[760px]">
              <nav className="no-scrollbar flex w-full items-center gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [touch-action:pan-x] [-webkit-overflow-scrolling:touch] md:justify-center">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);

                  const className = `group relative inline-flex shrink-0 items-center gap-1.5 rounded-2xl px-3 py-2 text-[13px] font-semibold transition md:gap-2 md:px-3.5 md:py-2.5 md:text-sm ${
                    active
                      ? 'bg-brand/[0.07] text-brand'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-brand'
                  }`;

                  return (
                    <Link key={item.href} href={item.href} className={className}>
                      <Icon className="hidden h-4 w-4 sm:block" />
                      {item.label}
                      <span
                        className={`absolute inset-x-3 -bottom-1 h-0.5 rounded-full bg-brand transition ${
                          active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
                        }`}
                      />
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
