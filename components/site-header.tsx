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
      <div className="rounded-[30px] bg-brand px-3 py-3 shadow-hero md:rounded-[34px] md:px-5 md:py-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-4">
          <div className="min-w-0 md:col-start-1 md:row-start-1">
            <SeekofferLogo />
          </div>

          <div className="justify-self-end md:col-start-3 md:row-start-1">
            <UserSessionEntry />
          </div>

          <div className="col-span-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
            <div className="rounded-full bg-white/8 p-1.5 ring-1 ring-white/8 md:mx-auto md:max-w-[860px] md:bg-white/10 md:px-2 md:py-1.5">
              <nav className="no-scrollbar flex w-full items-center gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [touch-action:pan-x] [-webkit-overflow-scrolling:touch] md:justify-center">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = item.external
                    ? false
                    : item.href === '/'
                      ? pathname === '/'
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);

                  const className = `inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold transition md:gap-2 md:px-4 md:py-2.5 md:text-sm ${
                    active
                      ? 'bg-white text-brand shadow-[0_10px_24px_rgba(15,23,42,0.12)]'
                      : 'text-white/88 hover:bg-white/12 hover:text-white'
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
      </div>
    </header>
  );
}
