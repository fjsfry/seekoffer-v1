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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.12),transparent_34%),linear-gradient(180deg,#f7fbfa_0%,#f6f8fb_52%,#ffffff_100%)] px-4 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-64px)] max-w-[1180px] items-center gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-3xl border border-slate-200/80 bg-white/95 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur lg:p-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-teal-700">
            <ShieldCheck className="h-4 w-4" />
            Seekoffer Console
          </div>
          <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950">
            面向运营团队的内容与用户治理工作台。
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-8 text-slate-600">
            集中处理通知审核、Offer 质量、用户反馈、操作记录与基础增长数据。个人申请表只做汇总统计，不进入具体内容。
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              [BarChart3, '数据概览', '一眼看清用户增长、待审核内容和申请功能使用趋势。'],
              [Bell, '通知审核', '审核、发布、驳回、下架和删除通知，保障前台可信。'],
              [ClipboardCheck, 'Offer 管理', '控制用户贡献内容的真实性、隐私和举报风险。'],
              [UsersRound, '用户与反馈', '查看用户状态，处理反馈举报，所有关键操作留痕。']
            ].map(([Icon, title, description]) => (
              <div key={String(title)} className="rounded-2xl bg-slate-50 p-5">
                <Icon className="h-6 w-6 text-blue-600" />
                <div className="mt-4 font-semibold text-slate-950">{title as string}</div>
                <p className="mt-2 text-sm leading-7 text-slate-500">{description as string}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200/80 bg-white/95 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700">
            <LockKeyhole className="h-4 w-4" />
            后台登录
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-slate-950">进入运营工作台</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            使用授权管理员账号登录。系统会按你的角色开放对应的运营入口，并记录关键操作。
          </p>

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
          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-500">
            仅限内部授权成员访问。若无法登录，请确认账号权限或联系管理员处理。
          </div>
        </section>
      </div>
    </main>
  );
}
