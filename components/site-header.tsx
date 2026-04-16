'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Brain, Building2, Globe, Heart, House, Newspaper, UserRound } from 'lucide-react';
import { SeekofferLogo } from './seekoffer-logo';
import { UserSessionEntry } from './user-session-entry';

const navItems = [
  { href: '/', label: '首页', icon: House },
  { href: '/notices', label: '通知库', icon: Newspaper },
  { href: '/resources', label: '资源库', icon: BookOpen },
  { href: '/colleges', label: '院校库', icon: Building2 },
  { href: '/offers', label: 'Offer 池', icon: Heart },
  { href: '/ai', label: 'AI 定位', icon: Brain },
  { href: 'https://yz.chsi.com.cn/', label: '研招网', icon: Globe, external: true },
  { href: '/me', label: '我的', icon: UserRound }
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-4 z-40 mb-8">
      <div className="rounded-[34px] bg-brand px-4 py-3 shadow-hero">
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            <SeekofferLogo />
          </div>

          <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
            <nav className="flex min-w-max items-center gap-1.5 rounded-full bg-white/10 p-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = item.external
                  ? false
                  : item.href === '/'
                    ? pathname === '/'
                    : item.href === '/notices'
                      ? pathname === '/notices' || pathname.startsWith('/notices/')
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);

                const className = `inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2.5 text-sm font-semibold transition ${
                  active
                    ? 'bg-white text-brand shadow-sm'
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

          <div className="shrink-0">
            <UserSessionEntry />
          </div>
        </div>
      </div>
    </header>
  );
}
