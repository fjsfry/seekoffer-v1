'use client';

import Link from 'next/link';
import { LockKeyhole } from 'lucide-react';
import { LoginMethodPanel } from './login-method-panel';

export function LoginRequiredCard({
  title = '这个功能需要先登录',
  description = '公共内容允许直接浏览，但申请表、待办、收藏和发布入口需要先完成登录。当前支持微信开放平台、用户名密码、匿名试用，以及微信环境中的小程序登录入口。'
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="rounded-[32px] border border-black/5 bg-white p-6 shadow-soft">
      <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
        <LockKeyhole className="h-4 w-4" />
        登录后使用
      </div>
      <h2 className="mt-4 text-2xl font-semibold text-ink">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <LoginMethodPanel />
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
