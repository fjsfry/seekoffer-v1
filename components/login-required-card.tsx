'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LoaderCircle, LockKeyhole } from 'lucide-react';
import { openCloudbaseLoginPage } from '@/lib/user-session';

export function LoginRequiredCard({
  title = '登录后开启你的工作台',
  description = '通知库、资源库和院校库可以直接浏览；申请表、行动清单和收藏功能需要先完成登录。'
}: {
  title?: string;
  description?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleOpenLogin() {
    if (pending) {
      return;
    }

    setPending(true);
    setError('');

    try {
      await openCloudbaseLoginPage();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '登录页暂时不可用，请稍后重试。');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[32px] border border-black/5 bg-white p-6 shadow-soft">
      <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
        <LockKeyhole className="h-4 w-4" />
        登录后使用
      </div>
      <h2 className="mt-4 text-2xl font-semibold text-ink">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={handleOpenLogin}
          className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white"
        >
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          打开 CloudBase 登录页
        </button>
        <Link
          href="/notices"
          className="inline-flex items-center justify-center rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
        >
          先去浏览通知库
        </Link>
      </div>

      {error ? <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div> : null}
    </section>
  );
}
