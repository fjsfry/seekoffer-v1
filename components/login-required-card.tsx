'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { openAuthModal, type AuthIntent, writeAuthIntent } from '@/lib/auth-intent';
import type { AuthRequirement } from '@/lib/user-session';

export function LoginRequiredCard({
  title = '登录后开启你的工作台',
  description = '通知库、资源库和院校库可以先浏览；申请表、待办、收藏和发布这类个人动作需要先完成登录。',
  intent,
  requiredAuth = 'session',
  actionLabel = '登录后继续'
}: {
  title?: string;
  description?: string;
  intent?: AuthIntent;
  requiredAuth?: AuthRequirement;
  actionLabel?: string;
}) {
  const pathname = usePathname();

  function handleOpenLogin() {
    const nextIntent =
      intent ||
      ({
        type: 'open-workspace',
        returnTo: pathname,
        reason: 'login-required-card',
        requiredAuth
      } satisfies AuthIntent);

    writeAuthIntent(nextIntent);
    openAuthModal(nextIntent);
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
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </button>
        <Link
          href="/notices"
          className="inline-flex items-center justify-center rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
        >
          先去浏览通知库
        </Link>
      </div>
    </section>
  );
}
