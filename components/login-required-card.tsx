'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, BellRing, CheckSquare2, ClipboardList, LockKeyhole } from 'lucide-react';
import { openAuthModal, type AuthIntent, writeAuthIntent } from '@/lib/auth-intent';
import type { AuthRequirement } from '@/lib/user-session';

export function LoginRequiredCard({
  title = '登录后开启你的工作台',
  description = '通知库、资源库和院校库可以先浏览；申请表、待办、收藏和发布这类个人动作需要先完成登录。',
  intent,
  requiredAuth = 'session',
  actionLabel = '登录 / 注册',
  showPreview = true
}: {
  title?: string;
  description?: string;
  intent?: AuthIntent;
  requiredAuth?: AuthRequirement;
  actionLabel?: string;
  showPreview?: boolean;
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
    <section className="rounded-[32px] border border-black/5 bg-white p-6 shadow-soft lg:p-8">
      <div className={`grid gap-7 ${showPreview ? 'lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center' : ''}`}>
        <div>
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
            <LockKeyhole className="h-4 w-4" />
            登录后使用
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleOpenLogin}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white"
            >
              {actionLabel}
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              href="/notices"
              className="inline-flex items-center justify-center rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
            >
              先浏览通知库
            </Link>
          </div>
        </div>

        {showPreview ? <WorkbenchPreview /> : null}
      </div>
    </section>
  );
}

function WorkbenchPreview() {
  return (
    <div className="rounded-[26px] border border-slate-100 bg-slate-50 p-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '申请中', value: '2', icon: ClipboardList },
          { label: '待办', value: '4', icon: CheckSquare2 },
          { label: '7天截止', value: '1', icon: BellRing }
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.label} className="rounded-2xl bg-white px-3 py-4 text-center shadow-sm">
              <Icon className="mx-auto h-4 w-4 text-brand" />
              <div className="mt-2 text-xl font-semibold text-ink">{item.value}</div>
              <div className="mt-1 text-[11px] text-slate-500">{item.label}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3">
        {[
          ['复旦大学', '材料待补充'],
          ['中国科学技术大学', '3 天内截止'],
          ['清华大学', '待确认导师']
        ].map(([school, status]) => (
          <div key={school} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm shadow-sm">
            <span className="font-semibold text-ink">{school}</span>
            <span className="text-xs font-semibold text-brand">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
