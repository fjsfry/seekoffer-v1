'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { readAnalyticsPreference, writeAnalyticsPreference, type AnalyticsPreference } from '@/lib/privacy-preference';

export function PrivacyConsentBanner() {
  const pathname = usePathname() || '/';
  const [preference, setPreference] = useState<AnalyticsPreference>('unknown');

  useEffect(() => {
    setPreference(readAnalyticsPreference());
  }, []);

  if (pathname.startsWith('/admin') || preference !== 'unknown') return null;

  function choose(value: 'accepted' | 'declined') {
    writeAnalyticsPreference(value);
    setPreference(value);
  }

  return (
    <aside className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:bottom-5 sm:flex sm:items-center sm:gap-4 sm:p-5" aria-label="访问统计选择">
      <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand sm:flex">
        <ShieldCheck className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-ink">帮助我们改进浏览体验</div>
        <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
          你同意后，我们会记录匿名访问设备、页面路径和停留状态用于改进产品；拒绝不会影响通知查询和工作台使用。<Link href="/privacy" className="ml-1 font-semibold text-brand">查看隐私政策</Link>
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-0 sm:flex sm:shrink-0">
        <button type="button" onClick={() => choose('declined')} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600">仅必要功能</button>
        <button type="button" onClick={() => choose('accepted')} className="h-10 rounded-xl bg-brand px-3 text-sm font-semibold text-white">同意匿名统计</button>
      </div>
    </aside>
  );
}
