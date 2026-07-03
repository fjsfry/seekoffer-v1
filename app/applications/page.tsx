'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { SiteShell } from '@/components/site-shell';

export default function ApplicationsRedirectPage() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.replace('/me/');
    }, 600);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <SiteShell>
      <section className="page-hero px-6 py-7 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/8 text-brand">
            <ClipboardList className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-ink md:text-5xl">申请管理已合并到工作台</h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            状态、优先级、材料清单、备注和截止提醒现在都在工作台内完成，不再维护独立申请表页面。
          </p>
          <Link
            href="/me"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-float transition hover:bg-brand-deep"
          >
            前往工作台
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
