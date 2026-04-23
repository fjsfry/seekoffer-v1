'use client';

import { useState } from 'react';
import {
  KeyRound,
  LoaderCircle,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
  UserRoundPlus
} from 'lucide-react';
import {
  sendEmailLoginCode,
  signInAsGuest,
  signInWithPasswordAccount,
  signUpWithPasswordAccount,
  verifyEmailLoginCode
} from '@/lib/user-session';

function AuthCard({
  icon,
  title,
  description,
  actionLabel,
  onClick,
  pending,
  tone = 'default'
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
  pending?: boolean;
  tone?: 'default' | 'brand';
}) {
  return (
    <div
      className={`rounded-[28px] border p-5 ${
        tone === 'brand' ? 'border-brand/15 bg-brand/5' : 'border-black/5 bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            tone === 'brand' ? 'bg-brand text-white' : 'bg-white text-brand shadow-sm'
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-base font-semibold text-ink">{title}</div>
          <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
        </div>
      </div>

      <button
        onClick={onClick}
        disabled={pending}
        className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
          tone === 'brand'
            ? 'bg-brand text-white hover:bg-brand-deep disabled:bg-brand/70'
            : 'bg-white text-slate-700 shadow-sm hover:bg-slate-100 disabled:bg-slate-100 disabled:text-slate-400'
        }`}
      >
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        {actionLabel}
      </button>
    </div>
  );
}

export function LoginMethodPanel({
  mode = 'modal',
  onSuccess
}: {
  mode?: 'card' | 'popover' | 'modal';
  onSuccess?: () => void;
}) {
  const compact = mode === 'popover';
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [pending, setPending] = useState<
    '' | 'guest' | 'password' | 'register' | 'send-code' | 'verify-code'
  >('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function runTask<T>(
    key: typeof pending,
    task: () => Promise<T>,
    options: {
      closeOnSuccess?: boolean;
      successMessage?: string;
    } = {}
  ) {
    if (pending) {
      return null;
    }

    setPending(key);
    setError('');
    setMessage('');

    try {
      const result = await task();
      if (options.successMessage) {
        setMessage(options.successMessage);
      }

      if (options.closeOnSuccess ?? true) {
        onSuccess?.();
      }

      return result;
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : '当前登录暂时不可用，请稍后重试。');
      return null;
    } finally {
      setPending('');
    }
  }

  async function handlePasswordLogin() {
    if (!identifier.trim() || !password.trim()) {
      setError('请先输入邮箱/手机号和密码。');
      return;
    }

    await runTask('password', () =>
      signInWithPasswordAccount({
        identifier: identifier.trim(),
        password
      })
    );
  }

  async function handlePasswordRegister() {
    if (!identifier.trim() || !password.trim()) {
      setError('请先填写邮箱/手机号和密码，再完成注册。');
      return;
    }

    const result = await runTask(
      'register',
      () =>
        signUpWithPasswordAccount({
          identifier: identifier.trim(),
          password
        }),
      { closeOnSuccess: false }
    );

    if (!result) {
      return;
    }

    if (result.status === 'signed_in') {
      setMessage('注册并登录成功，已自动进入当前会话。');
      onSuccess?.();
      return;
    }

    setMessage(result.message);
  }

  async function handleSendCode() {
    if (!otpEmail.trim()) {
      setError('请先输入邮箱地址。');
      return;
    }

    await runTask('send-code', () => sendEmailLoginCode(otpEmail.trim()), {
      closeOnSuccess: false,
      successMessage: '验证码已发送，请查看你的邮箱并输入 6 位验证码。'
    });
  }

  async function handleVerifyCode() {
    if (!otpEmail.trim() || !otpCode.trim()) {
      setError('请先输入邮箱和验证码。');
      return;
    }

    await runTask('verify-code', () => verifyEmailLoginCode(otpEmail.trim(), otpCode.trim()));
  }

  return (
    <section className={compact ? 'space-y-4' : 'space-y-6'}>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <AuthCard
          icon={<Mail className="h-5 w-5" />}
          title={compact ? '邮箱验证码' : '邮箱验证码登录'}
          description={
            compact
              ? '输入邮箱后发送验证码，适合第一次进入 Seekoffer 或临时登录。'
              : '适合第一次进入 Seekoffer、临时在新设备登录，或者你不想记密码时快速进入当前页面。'
          }
          actionLabel={pending === 'send-code' ? '正在发送...' : '先发送验证码'}
          onClick={() => void handleSendCode()}
          pending={pending === 'send-code'}
          tone="brand"
        />

        <AuthCard
          icon={<Sparkles className="h-5 w-5" />}
          title="先本地试用"
          description="先用本地试用体验通知库、资源库和基础工作台流程，不会立刻要求你绑定正式账号。"
          actionLabel={pending === 'guest' ? '创建中...' : '先进入试用态'}
          onClick={() => void runTask('guest', () => signInAsGuest())}
          pending={pending === 'guest'}
        />
      </div>

      <div className="rounded-[28px] border border-black/5 bg-slate-50 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-brand shadow-sm">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-semibold text-ink">邮箱 / 手机号 + 密码</div>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              适合长期使用 Seekoffer。邮箱和手机号都可以走密码登录，正式账号登录后数据会稳定同步到 Supabase。
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="输入邮箱或手机号"
            className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="输入密码"
            className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => void handlePasswordLogin()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
            >
              {pending === 'password' ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {pending === 'password' ? '登录中...' : '密码登录'}
            </button>
            <button
              onClick={() => void handlePasswordRegister()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
            >
              {pending === 'register' ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <UserRoundPlus className="h-4 w-4" />
              )}
              {pending === 'register' ? '注册中...' : '首次注册'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-black/5 bg-slate-50 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-brand shadow-sm">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-semibold text-ink">邮箱验证码</div>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              使用 Resend 发信，适合快速登录。发送验证码后，直接在当前弹层输入 6 位验证码即可完成登录。
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <input
            value={otpEmail}
            onChange={(event) => setOtpEmail(event.target.value)}
            placeholder="输入接收验证码的邮箱"
            className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none"
          />
          <input
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value)}
            placeholder="输入 6 位邮箱验证码"
            className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => void handleSendCode()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
            >
              {pending === 'send-code' ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {pending === 'send-code' ? '发送中...' : '发送验证码'}
            </button>
            <button
              onClick={() => void handleVerifyCode()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
            >
              {pending === 'verify-code' ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {pending === 'verify-code' ? '验证中...' : '验证码登录'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-dashed border-black/8 bg-white px-4 py-4">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <ShieldCheck className="h-4 w-4 text-brand" />
          登录说明
        </div>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Seekoffer 仍然允许先浏览通知库、院校库和资源库。只有加入申请表、进入工作台、发布 Offer
          这类需要保存个人状态的动作，才会触发登录。
        </p>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          登录成功后会自动回到当前页面，并继续你刚才的动作，不需要重新找入口。
        </p>
      </div>

      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div> : null}
    </section>
  );
}
