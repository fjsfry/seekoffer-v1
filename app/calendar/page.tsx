'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CalendarAliasPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/deadlines');
  }, [router]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-6 text-center">
      <div className="rounded-[28px] border border-black/5 bg-white px-8 py-10 shadow-soft">
        <div className="text-lg font-semibold text-ink">正在跳转到截止提醒页</div>
        <p className="mt-3 text-sm leading-7 text-slate-500">
          如果页面没有自动跳转，可以直接点击下面的入口继续访问。
        </p>
        <Link
          href="/deadlines"
          className="mt-5 inline-flex items-center rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white"
        >
          前往截止提醒
        </Link>
      </div>
    </main>
  );
}
