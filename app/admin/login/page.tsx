'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Bell, ClipboardCheck, LoaderCircle, LockKeyhole, ShieldCheck, UsersRound } from 'lucide-react';
import { adminAccounts } from '@/lib/admin-data';
import { getAdminSession, signInAdmin } from '@/lib/admin-session';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(adminAccounts[0]?.email || '');
  const [password, setPassword] = useState(adminAccounts[0]?.password || '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (getAdminSession()) {
      router.replace('/admin/dashboard');
    }
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError('');

    try {
      await signInAdmin(email, password);
      router.push('/admin/dashboard');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '后台登录失败，请稍后重试。');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb] px-4 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-64px)] max-w-[1180px] items-center gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm lg:p-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-600">
            <ShieldCheck className="h-4 w-4" />
            SeekOffer Admin
          </div>
          <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950">
            运营管理后台，先把内容质量和用户秩序管起来。
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-8 text-slate-600">
            后台只服务网站运营：审核通知、管理 Offer 池、处理用户反馈、查看操作日志与基础增长数据。用户个人申请表只做统计，不进入具体内容。
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              [BarChart3, '数据概览', '一眼看清用户增长、待审核内容和申请功能使用趋势。'],
              [Bell, '通知审核', '审核、发布、驳回、下架和删除通知，保障前台可信。'],
              [ClipboardCheck, 'Offer 管理', '控制演示/用户贡献内容的真实性、隐私和举报风险。'],
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

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
            <LockKeyhole className="h-4 w-4" />
            后台登录
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-slate-950">进入运营工作台</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">当前为独立后台 MVP，后续可以接入 Supabase 管理员表和服务端权限校验。</p>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-800">管理员邮箱</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-800">密码</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              />
            </label>

            <button
              type="submit"
              className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {pending ? '登录中...' : '进入后台'}
            </button>
          </form>

          {error ? <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div> : null}

          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-950">当前内置管理员账号</div>
            <div className="mt-3 grid gap-3 text-sm text-slate-600">
              {adminAccounts.map((item) => (
                <div key={item.email} className="rounded-xl bg-white px-4 py-3 shadow-sm">
                  <div className="font-semibold text-slate-950">{item.name}</div>
                  <div className="mt-1 text-xs leading-6 text-slate-500">
                    {item.email} / {item.password}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
