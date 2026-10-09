'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, BellRing, CheckSquare2, ClipboardList, LockKeyhole, Sparkles } from 'lucide-react';
import { openAuthModal, type AuthIntent, writeAuthIntent } from '@/lib/auth-intent';
import type { AuthRequirement } from '@/lib/user-session';

export function LoginRequiredCard({
  title = '别再用 Excel 追保研截止了',
  description = '免费创建申请表，把目标项目、材料进度、今日待办和截止提醒放到一个工作台里。通知库仍可直接浏览，登录后才能保存你的申请计划。',
  intent,
  requiredAuth = 'session',
  actionLabel = '免费进入工作台',
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
    <section className="relative overflow-hidden rounded-[38px] border border-black/5 bg-white p-6 shadow-[0_26px_80px_rgba(18,32,38,0.08)] lg:p-10">
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_70%_24%,rgba(113,202,193,0.2),transparent_28rem)] lg:block" />
      <div className={`grid gap-7 ${showPreview ? 'lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center' : ''}`}>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand/8 px-3 py-1 text-sm font-semibold text-brand">
            <LockKeyhole className="h-4 w-4" />
            登录后保存你的申请计划
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {['保存目标项目', '材料进度同步', '截止前提醒'].map((item) => (
              <div key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                {item}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleOpenLogin}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-float transition hover:-translate-y-0.5 hover:bg-brand-deep"
            >
              {actionLabel}
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              href="/notices"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand/25 hover:text-brand"
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
    <div className="relative z-10 rounded-[30px] border border-slate-100 bg-white/90 p-5 shadow-soft backdrop-blur">
      <div className="absolute inset-x-6 top-1/2 z-20 -translate-y-1/2 rounded-2xl border border-white/70 bg-white/80 px-5 py-4 text-center shadow-soft backdrop-blur">
        <Sparkles className="mx-auto h-5 w-5 text-brand" />
        <div className="mt-2 text-sm font-semibold text-ink">登录后解锁完整工作台</div>
        <div className="mt-1 text-xs text-slate-500">保存、提醒、同步都会自动开启</div>
      </div>
      <div className="pointer-events-none absolute inset-0 z-10 rounded-[30px] bg-white/20 backdrop-blur-[1.5px]" />
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
