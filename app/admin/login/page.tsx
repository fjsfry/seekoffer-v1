'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Bell, ClipboardCheck, LoaderCircle, LockKeyhole, ShieldCheck, UsersRound } from 'lucide-react';
import { getAdminErrorMessage } from '@/lib/admin-api';
import { refreshAdminSession, signInAdmin } from '@/lib/admin-session';

function getSafeAdminNextPath() {
  if (typeof window === 'undefined') {
    return '/admin/dashboard';
  }

  const next = new URLSearchParams(window.location.search).get('next') || '';

  if (next.startsWith('/admin') && !next.startsWith('/admin/login')) {
    return next;
  }

  return '/admin/dashboard';
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;

    refreshAdminSession().then((session) => {
      if (!disposed && session) {
        router.replace(getSafeAdminNextPath());
      }
    });

    return () => {
      disposed = true;
    };
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError('');

    try {
      await signInAdmin(email, password);
      router.push(getSafeAdminNextPath());
    } catch (loginError) {
      setError(getAdminErrorMessage(loginError, '后台登录失败，请稍后重试。'));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7f6] px-4 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-64px)] max-w-[1080px] items-center gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-[0_20px_58px_rgba(15,23,42,0.07)] lg:p-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-teal-700">
            <ShieldCheck className="h-4 w-4" />
            Seekoffer 运营平台
          </div>
          <h1 className="mt-6 max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">
            让运营数据、内容审核和风险处理保持清晰。
          </h1>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              [BarChart3, '增长与访问'],
              [Bell, '通知审核'],
              [ClipboardCheck, 'Offer 管理'],
              [UsersRound, '用户与反馈']
            ].map(([Icon, title]) => (
              <div key={String(title)} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-teal-700 shadow-sm"><Icon className="h-5 w-5" /></span>
                <div className="font-semibold text-slate-800">{title as string}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-[0_20px_58px_rgba(15,23,42,0.07)]">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700">
            <LockKeyhole className="h-4 w-4" />
            后台登录
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-slate-950">进入运营工作台</h2>
          <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-800">管理员邮箱</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-emerald-50"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-800">密码</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-emerald-50"
              />
            </label>

            <button
              type="submit"
              className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {pending ? '登录中...' : '进入后台'}
            </button>
          </form>

          {error ? <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div> : null}
        </section>
      </div>
    </main>
  );
}
