'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, UsersRound, X } from 'lucide-react';
import { SITE_ANNOUNCEMENT } from '@/lib/site-announcement';

export function SiteAnnouncement() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (
      document.documentElement.dataset.seekofferAnnouncementHidden === 'true' ||
      Date.now() > Date.parse(SITE_ANNOUNCEMENT.expiresAt)
    ) {
      setHidden(true);
    }
  }, []);

  function rememberDismissal() {
    try {
      window.localStorage.setItem(SITE_ANNOUNCEMENT.storageKey, 'dismissed');
    } catch {
      // The current document still hides the announcement when storage is unavailable.
    }

    document.documentElement.dataset.seekofferAnnouncementHidden = 'true';
    setHidden(true);
  }

  function dismissAndRestoreFocus() {
    rememberDismissal();
    window.requestAnimationFrame(() => {
      document.getElementById('main-content')?.focus({ preventScroll: true });
    });
  }

  if (hidden || pathname === SITE_ANNOUNCEMENT.actionHref) {
    return null;
  }

  return (
    <aside
      data-site-announcement={SITE_ANNOUNCEMENT.id}
      aria-labelledby="site-announcement-title"
      className="relative mt-4 overflow-hidden rounded-[20px] border border-[#dce8e5] bg-white px-4 py-3 pr-14 shadow-[0_12px_34px_rgba(18,32,38,0.055)] sm:px-5 sm:py-3.5 sm:pr-14"
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-brand/[0.07] px-2.5 py-1 text-xs font-semibold text-brand">
              <UsersRound aria-hidden="true" className="h-3.5 w-3.5" />
              {SITE_ANNOUNCEMENT.badge}
            </span>
            <h2 id="site-announcement-title" className="text-sm font-semibold leading-6 text-ink sm:text-[15px]">
              {SITE_ANNOUNCEMENT.title}
            </h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-[13px] sm:leading-6">
            {SITE_ANNOUNCEMENT.body}
          </p>
        </div>

        <Link
          href={SITE_ANNOUNCEMENT.actionHref}
          onClick={rememberDismissal}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15 sm:w-auto"
        >
          {SITE_ANNOUNCEMENT.actionLabel}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>

      <button
        type="button"
        onClick={dismissAndRestoreFocus}
        aria-label="关闭网站公告"
        className="absolute right-1.5 top-1.5 inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/10"
      >
        <X aria-hidden="true" className="h-4.5 w-4.5" />
      </button>
    </aside>
  );
}
