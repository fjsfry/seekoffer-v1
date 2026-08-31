'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { SiteShell } from './site-shell';

export function LegacyWorkbenchRedirect({ target, label }: { target: string; label: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(target);
  }, [router, target]);

  return (
    <SiteShell>
      <section className="page-hero flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <h1 className="mt-5 text-2xl font-semibold text-ink">正在打开{label}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-500">相关功能已合并到新的申请管理入口。</p>
        <Link href={target} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white">
          立即前往
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </SiteShell>
  );
}
