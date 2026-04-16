'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
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
    if (pending) {
      return;
    }

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
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-[1080px]">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section className="surface-card rounded-[34px] p-8 lg:p-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-brand">
              <ShieldCheck className="h-4 w-4" />
              Seekoffer Admin
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-ink">先用一个轻后台，把运营最重要的动作收进来。</h1>
            <p className="mt-5 max-w-2xl text-sm leading-8 text-slate-600">
              这版后台 MVP 只先解决四件事：看数据、改通知、管 Offer 池、看爬虫状态。后面再把高风险写操作逐步迁到 CloudBase 云函数。
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {[
                ['仪表盘', '先看今日新增、待审核内容和最近一次爬虫状态。'],
                ['通知库管理', '补录、修正、归档通知，避免前台暴露脏数据。'],
                ['Offer 池审核', '处理待审核、隐藏、软删除和举报内容。'],
                ['爬虫状态', '知道哪一路源挂了、哪次同步失败、需不需要重跑。']
              ].map(([title, description]) => (
                <div key={title} className="rounded-[24px] bg-slate-50 p-5">
                  <div className="text-base font-semibold text-ink">{title}</div>
                  <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-card rounded-[34px] p-8">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <LockKeyhole className="h-4 w-4" />
              后台登录
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-ink">进入运营工作区</h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              当前先用管理员账号进入后台，下一步再接 CloudBase 的 <code>admin_users</code> 和角色校验。
            </p>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-ink">管理员邮箱</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-ink">密码</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
                />
              </label>

              <button
                type="submit"
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white"
              >
                {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {pending ? '登录中...' : '进入后台'}
              </button>
            </form>

            {error ? <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div> : null}

            <div className="mt-6 rounded-[24px] bg-slate-50 p-4">
              <div className="text-sm font-semibold text-ink">当前内置管理员账号</div>
              <div className="mt-3 grid gap-3 text-sm text-slate-600">
                {adminAccounts.map((item) => (
                  <div key={item.email} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                    <div className="font-semibold text-ink">{item.name}</div>
                    <div className="mt-1 text-xs leading-6 text-slate-500">
                      {item.email} · {item.role}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
