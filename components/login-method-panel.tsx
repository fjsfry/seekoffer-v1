'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  LogIn,
  Mail,
  ShieldCheck,
  UserPlus
} from 'lucide-react';
import { SUPABASE_ENABLE_ANONYMOUS, SUPABASE_ENABLE_PHONE_AUTH } from '@/lib/supabase-env';
import {
  isEmailIdentifier,
  sendEmailLoginCode,
  signInAsGuest,
  signInWithPasswordAccount,
  signUpWithPasswordAccount,
  verifyEmailLoginCode
} from '@/lib/user-session';

type AuthView = 'password' | 'otp';
type PasswordMode = 'login' | 'register';

function looksLikePhoneIdentifier(value: string) {
  return /^[+\d\s\-()]{6,}$/.test(value.trim());
}

function FeatureRow({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-gold">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-white">{title}</div>
        <p className="mt-1 text-sm leading-6 text-white/68">{description}</p>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  icon,
  children,
  onClick
}: {
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${
        active ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function PrimaryButton({
  icon,
  pending,
  children,
  type = 'submit',
  onClick
}: {
  icon: React.ReactNode;
  pending?: boolean;
  children: React.ReactNode;
  type?: 'button' | 'submit';
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={pending}
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(23,73,77,0.18)] transition hover:bg-brand-deep disabled:bg-brand/70"
    >
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
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
  const [activeView, setActiveView] = useState<AuthView>('password');
  const [passwordMode, setPasswordMode] = useState<PasswordMode>('login');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [pending, setPending] = useState<
    '' | 'guest' | 'password' | 'register' | 'send-code' | 'verify-code'
  >('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const accountLabel = SUPABASE_ENABLE_PHONE_AUTH ? '邮箱或手机号' : '邮箱';
  const accountPlaceholder = SUPABASE_ENABLE_PHONE_AUTH ? 'name@example.com / 手机号' : 'name@example.com';
  const isEmailAccount = isEmailIdentifier(account);
  const passwordActionLabel = passwordMode === 'login' ? '密码登录' : '创建账号';
  const passwordPending = pending === 'password' || pending === 'register';
  const idleHint =
    activeView === 'otp'
      ? '验证码登录仅用于已经完成邮箱确认的账号；第一次使用请先切到“密码”创建账号。'
      : passwordMode === 'register'
        ? '首次注册会发送邮箱确认邮件，完成确认后即可使用密码或验证码登录。'
        : '已注册账号可直接密码登录；想用 6 位登录码时可以切换到“验证码”。';

  const helperText = useMemo(() => {
    if (!account.trim()) {
      return SUPABASE_ENABLE_PHONE_AUTH ? '输入邮箱或手机号继续' : '请输入邮箱继续';
    }

    if (isEmailAccount) {
      return '邮箱格式正确';
    }

    if (!SUPABASE_ENABLE_PHONE_AUTH && looksLikePhoneIdentifier(account)) {
      return '当前暂未开放手机号登录，请使用邮箱';
    }

    return '请输入完整的邮箱地址';
  }, [account, isEmailAccount]);

  useEffect(() => {
    if (resendIn <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => setResendIn((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  function resetFeedback() {
    setError('');
    setMessage('');
  }

  function validateAccount(options: { emailOnly?: boolean } = {}) {
    const value = account.trim();
    if (!value) {
      setError(`请先输入${accountLabel}。`);
      return '';
    }

    if ((options.emailOnly || !SUPABASE_ENABLE_PHONE_AUTH) && !isEmailIdentifier(value)) {
      if (looksLikePhoneIdentifier(value) && !SUPABASE_ENABLE_PHONE_AUTH) {
        setError('当前暂未开放手机号登录，请使用邮箱完成登录或注册。');
        return '';
      }

      setError('请输入完整的邮箱地址，例如 name@example.com。');
      return '';
    }

    return value;
  }

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
    resetFeedback();

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

  async function handlePasswordSubmit() {
    const identifier = validateAccount();
    if (!identifier) {
      return;
    }

    if (!password.trim()) {
      setError('请输入密码。');
      return;
    }

    if (password.length < 6) {
      setError('密码至少需要 6 位。');
      return;
    }

    if (passwordMode === 'register' && password !== passwordConfirm) {
      setError('两次输入的密码不一致。');
      return;
    }

    if (passwordMode === 'login') {
      await runTask('password', () => signInWithPasswordAccount({ identifier, password }));
      return;
    }

    const result = await runTask(
      'register',
      () => signUpWithPasswordAccount({ identifier, password }),
      { closeOnSuccess: false }
    );

    if (!result) {
      return;
    }

    if (result.status === 'signed_in') {
      setMessage('注册成功，已经自动进入当前会话。');
      onSuccess?.();
      return;
    }

    setMessage(result.message);
  }

  async function handleSendCode() {
    const email = validateAccount({ emailOnly: true });
    if (!email || resendIn > 0) {
      return;
    }

    const result = await runTask('send-code', () => sendEmailLoginCode(email), {
      closeOnSuccess: false,
      successMessage: '登录码已发送。邮件里应显示 6 位数字；如果看到“确认注册”，请先完成首次邮箱确认。'
    });

    if (result === null) {
      setOtpSent(false);
      setResendIn(0);
      return;
    }

    setOtpSent(true);
    setResendIn(60);
  }

  async function handleVerifyCode() {
    const email = validateAccount({ emailOnly: true });
    if (!email) {
      return;
    }

    if (!otpCode.trim()) {
      setError('请输入邮箱中的 6 位验证码。');
      return;
    }

    await runTask('verify-code', () => verifyEmailLoginCode(email, otpCode.trim()));
  }

  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeView === 'password') {
      void handlePasswordSubmit();
      return;
    }

    if (otpCode.trim()) {
      void handleVerifyCode();
      return;
    }

    void handleSendCode();
  }

  return (
    <section
      className={`overflow-hidden border border-black/8 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)] ${
        compact ? 'rounded-3xl' : 'rounded-[28px] lg:grid lg:grid-cols-[320px_minmax(0,1fr)]'
      }`}
    >
      <aside className="bg-brand px-5 py-6 text-white sm:px-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/78">
          Seekoffer Account
        </div>
        <h3 className="mt-4 text-2xl font-semibold leading-tight">一个账号，接住你的申请进度</h3>
        <p className="mt-3 text-sm leading-7 text-white/70">
          登录后，申请表、待办、手动项目和个人资料会持续同步。你刚才的动作会在登录后继续执行。
        </p>

        <div className="mt-6 space-y-5">
          <FeatureRow
            icon={<ShieldCheck className="h-4 w-4" />}
            title="邮箱优先"
            description="当前生产环境使用邮箱密码和邮箱验证码，避免手机号通道未开通造成失败。"
          />
          <FeatureRow
            icon={<CheckCircle2 className="h-4 w-4" />}
            title="状态同步"
            description="登录后的申请表、工作台待办和资料会进入 Supabase。"
          />
        </div>

        {SUPABASE_ENABLE_ANONYMOUS ? (
          <button
            type="button"
            onClick={() => void runTask('guest', () => signInAsGuest())}
            disabled={pending === 'guest'}
            className="mt-8 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/18 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/16 disabled:text-white/50"
          >
            {pending === 'guest' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {pending === 'guest' ? '进入中...' : '先以试用态浏览'}
          </button>
        ) : null}
      </aside>

      <form className="px-5 py-6 sm:px-7" onSubmit={handleFormSubmit}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-brand">正式账号</div>
            <h3 className="mt-1 text-2xl font-semibold leading-tight text-ink">登录或创建你的 Seekoffer 账号</h3>
          </div>
          <div className="inline-flex rounded-2xl bg-slate-100 p-1">
            <ModeButton
              active={activeView === 'password'}
              icon={<KeyRound className="h-4 w-4" />}
              onClick={() => {
                resetFeedback();
                setActiveView('password');
              }}
            >
              密码
            </ModeButton>
            <ModeButton
              active={activeView === 'otp'}
              icon={<Mail className="h-4 w-4" />}
              onClick={() => {
                resetFeedback();
                setActiveView('otp');
              }}
            >
              验证码
            </ModeButton>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{accountLabel}</span>
            <input
              type={SUPABASE_ENABLE_PHONE_AUTH ? 'text' : 'email'}
              inputMode={SUPABASE_ENABLE_PHONE_AUTH ? 'text' : 'email'}
              autoComplete="email"
              value={account}
              onChange={(event) => {
                setAccount(event.target.value);
                resetFeedback();
              }}
              placeholder={accountPlaceholder}
              className="mt-2 h-12 w-full rounded-xl border border-black/8 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
            />
            <span
              className={`mt-2 block text-xs ${
                isEmailAccount ? 'text-emerald-600' : account.trim() ? 'text-amber-700' : 'text-slate-500'
              }`}
            >
              {helperText}
            </span>
          </label>

          {activeView === 'password' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    resetFeedback();
                    setPasswordMode('login');
                  }}
                  className={`min-h-10 rounded-xl text-sm font-semibold transition ${
                    passwordMode === 'login' ? 'bg-white text-ink shadow-sm' : 'text-slate-500'
                  }`}
                >
                  登录
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetFeedback();
                    setPasswordMode('register');
                  }}
                  className={`min-h-10 rounded-xl text-sm font-semibold transition ${
                    passwordMode === 'register' ? 'bg-white text-ink shadow-sm' : 'text-slate-500'
                  }`}
                >
                  注册
                </button>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">密码</span>
                <input
                  type="password"
                  autoComplete={passwordMode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    resetFeedback();
                  }}
                  placeholder="至少 6 位"
                  className="mt-2 h-12 w-full rounded-xl border border-black/8 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
                />
              </label>

              {passwordMode === 'register' ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">确认密码</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={passwordConfirm}
                    onChange={(event) => {
                      setPasswordConfirm(event.target.value);
                      resetFeedback();
                    }}
                    placeholder="再次输入密码"
                    className="mt-2 h-12 w-full rounded-xl border border-black/8 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
                  />
                </label>
              ) : null}

              <PrimaryButton
                icon={passwordMode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                pending={passwordPending}
              >
                {passwordPending ? '处理中...' : passwordActionLabel}
              </PrimaryButton>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  value={otpCode}
                  onChange={(event) => {
                    setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                    resetFeedback();
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6 位验证码"
                  className="h-12 min-w-0 flex-1 rounded-xl border border-black/8 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
                />
                <button
                  type="button"
                  onClick={() => void handleSendCode()}
                  disabled={pending === 'send-code' || resendIn > 0}
                  className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-black/8 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:text-slate-400"
                >
                  {pending === 'send-code' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {resendIn > 0 ? `${resendIn}s` : otpSent ? '重发' : '发送'}
                </button>
              </div>

              <PrimaryButton icon={<ShieldCheck className="h-4 w-4" />} pending={pending === 'verify-code'}>
                {pending === 'verify-code' ? '验证中...' : '验证码登录'}
              </PrimaryButton>
            </div>
          )}
        </div>

        <div className="mt-5 min-h-11">
          {message ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
              {error}
            </div>
          ) : null}
          {!message && !error ? (
            <p className="text-sm leading-6 text-slate-500">
              {idleHint}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
