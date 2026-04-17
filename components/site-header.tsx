'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Brain, Building2, Globe, Heart, House, Newspaper } from 'lucide-react';
import { SeekofferLogo } from './seekoffer-logo';
import { UserSessionEntry } from './user-session-entry';

const navItems = [
  { href: '/', label: '首页', icon: House },
  { href: '/notices', label: '通知库', icon: Newspaper },
  { href: '/resources', label: '资源库', icon: BookOpen },
  { href: '/colleges', label: '院校库', icon: Building2 },
  { href: '/offers', label: 'Offer 池', icon: Heart },
  { href: '/ai', label: 'AI 定位', icon: Brain },
  { href: 'https://yz.chsi.com.cn/', label: '研招网', icon: Globe, external: true }
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-4 z-40 mb-8">
      <div className="rounded-[32px] bg-brand px-4 py-3 shadow-hero md:px-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-4">
          <div className="min-w-0">
            <SeekofferLogo />
          </div>

          <div className="justify-self-end md:col-start-3">
            <UserSessionEntry />
          </div>

          <div className="col-span-2 min-w-0 md:col-span-1 md:col-start-2">
            <nav className="no-scrollbar flex w-full items-center gap-1.5 overflow-x-auto whitespace-nowrap rounded-full bg-white/8 p-1.5 pr-2 [scrollbar-width:none] [-ms-overflow-style:none] [touch-action:pan-x] [-webkit-overflow-scrolling:touch]">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = item.external
                  ? false
                  : item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);

                const className = `inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold transition md:gap-2 md:px-3.5 md:py-2.5 md:text-sm ${
                  active ? 'bg-white text-brand shadow-sm' : 'text-white/88 hover:bg-white/12 hover:text-white'
                }`;

                if (item.external) {
                  return (
                    <a key={item.href} href={item.href} target="_blank" rel="noreferrer" className={className}>
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </a>
                  );
                }

                return (
                  <Link key={item.href} href={item.href} className={className}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
