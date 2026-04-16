'use client';

import { useState } from 'react';
import {
  ExternalLink,
  LoaderCircle,
  QrCode,
  ShieldCheck,
  Smartphone,
  UserRound,
  UserRoundPlus,
  WandSparkles
} from 'lucide-react';
import {
  openCloudbaseLoginPage,
  signInAsGuest,
  signInWithPasswordAccount,
  signInWithWechat,
  signUpWithPasswordAccount
} from '@/lib/user-session';

function MethodCard({
  icon,
  title,
  description,
  action,
  actionLabel,
  busy,
  disabled = false,
  tone = 'light'
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: () => void;
  actionLabel: string;
  busy: boolean;
  disabled?: boolean;
  tone?: 'light' | 'brand';
}) {
  return (
    <div
      className={`rounded-[24px] border p-4 ${
        tone === 'brand'
          ? 'border-brand/15 bg-brand/5'
          : 'border-black/5 bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
            tone === 'brand' ? 'bg-brand text-white' : 'bg-slate-100 text-brand'
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">{title}</div>
          <p className="mt-1 text-xs leading-6 text-slate-500">{description}</p>
        </div>
      </div>

      <button
        onClick={action}
        disabled={disabled || busy}
        className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
          tone === 'brand'
            ? 'bg-brand text-white hover:bg-brand-deep disabled:bg-brand/60'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:bg-slate-100 disabled:text-slate-400'
        }`}
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        {actionLabel}
      </button>
    </div>
  );
}

export function LoginMethodPanel({
  mode = 'card',
  onSuccess
}: {
  mode?: 'card' | 'popover';
  onSuccess?: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState<
    '' | 'wechat' | 'guest' | 'password' | 'register' | 'wx-helper' | 'wx-mini'
  >('');
  const [error, setError] = useState('');

  const compact = mode === 'popover';
  const rootClassName = compact
    ? 'w-[400px] max-w-[calc(100vw-24px)] rounded-[28px] border border-black/5 bg-white p-5 shadow-2xl'
    : 'rounded-[28px] border border-black/5 bg-white p-5 shadow-soft';

  async function runTask(
    key: typeof pending,
    task: () => Promise<unknown>,
    callback?: () => void
  ) {
    if (pending) {
      return;
    }

    setPending(key);
    setError('');

    try {
      await task();
      callback?.();
      onSuccess?.();
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : '当前登录方式暂时不可用，请稍后重试。');
    } finally {
      setPending('');
    }
  }

  async function handlePasswordLogin() {
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码。');
      return;
    }

    await runTask('password', () =>
      signInWithPasswordAccount({
        username: username.trim(),
        password
      })
    );
  }

  async function handlePasswordRegister() {
    if (!username.trim() || !password.trim()) {
      setError('注册前请先填写用户名和密码。');
      return;
    }

    await runTask('register', () =>
      signUpWithPasswordAccount({
        username: username.trim(),
        password
      })
    );
  }

  return (
    <section className={rootClassName}>
      <div className="space-y-5">
        <div>
          <div className="text-sm font-semibold text-ink">已接入的登录方式</div>
          <p className="mt-2 text-xs leading-6 text-slate-500">
            下面这 5 种方式，已经和你 CloudBase 控制台当前开放的登录配置保持一致。
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <MethodCard
            icon={<QrCode className="h-4 w-4" />}
            title="微信开放平台登录"
            description="适合在电脑网页和浏览器里直接完成登录，进入工作台继续管理申请进度。"
            action={() => void runTask('wechat', () => signInWithWechat())}
            actionLabel={pending === 'wechat' ? '连接中...' : '立即使用微信登录'}
            busy={pending === 'wechat'}
            tone="brand"
          />

          <MethodCard
            icon={<WandSparkles className="h-4 w-4" />}
            title="匿名登录"
            description="无需注册即可先体验通知库、申请表和工作台流程，适合快速试用。"
            action={() => void runTask('guest', () => signInAsGuest())}
            actionLabel={pending === 'guest' ? '创建中...' : '先匿名试用'}
            busy={pending === 'guest'}
          />

          <MethodCard
            icon={<Smartphone className="h-4 w-4" />}
            title="微信云服务助手小程序"
            description="适合在微信环境中继续登录，网页端会跳到 CloudBase 默认登录页承接。"
            action={() => void runTask('wx-helper', () => openCloudbaseLoginPage())}
            actionLabel={pending === 'wx-helper' ? '打开中...' : '在微信中继续'}
            busy={pending === 'wx-helper'}
          />

          <MethodCard
            icon={<ShieldCheck className="h-4 w-4" />}
            title="小程序授权登录"
            description="对应你已开启的 wx2a3a6dd9cc6ea678 小程序登录，适合微信 / 小程序环境。"
            action={() => void runTask('wx-mini', () => openCloudbaseLoginPage())}
            actionLabel={pending === 'wx-mini' ? '打开中...' : '打开小程序登录入口'}
            busy={pending === 'wx-mini'}
          />
        </div>

        <div className="rounded-[24px] bg-slate-50 p-4">
          <div className="text-sm font-semibold text-ink">用户名密码</div>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            你控制台里已经启用用户名密码登录，这里同时提供账号登录和首次注册。
          </p>

          <div className="mt-3 grid gap-3">
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="输入用户名"
              className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="输入密码"
              className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                onClick={() => void handlePasswordLogin()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
              >
                {pending === 'password' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}
                {pending === 'password' ? '登录中...' : '账号登录'}
              </button>
              <button
                onClick={() => void handlePasswordRegister()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
              >
                {pending === 'register' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserRoundPlus className="h-4 w-4" />}
                {pending === 'register' ? '注册中...' : '首次注册'}
              </button>
            </div>
          </div>
        </div>

        {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div> : null}
      </div>
    </section>
  );
}
