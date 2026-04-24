'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BellRing,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  Mail,
  ShieldCheck,
  UserPlus
} from 'lucide-react';
import { SUPABASE_ENABLE_ANONYMOUS, SUPABASE_ENABLE_PHONE_AUTH } from '@/lib/supabase-env';
import {
  isEmailIdentifier,
  resendSignupConfirmationCode,
  sendEmailLoginCode,
  signInAsGuest,
  signInWithPasswordAccount,
  signUpWithPasswordAccount,
  verifyEmailLoginCode,
  verifySignupConfirmationCode
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
    <div className="flex gap-4">
      <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/16 text-emerald-100">
        {icon}
      </div>
      <div>
        <div className="text-base font-semibold text-white">{title}</div>
        <p className="mt-1 text-sm leading-6 text-white/74">{description}</p>
      </div>
    </div>
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
      className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-base font-semibold text-white shadow-[0_16px_30px_rgba(23,73,77,0.18)] transition hover:bg-brand-deep disabled:bg-brand/70"
    >
      {pending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

function IconInput({
  icon,
  children
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2 flex h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 transition focus-within:border-brand/50 focus-within:ring-4 focus-within:ring-brand/10">
      <span className="text-slate-400">{icon}</span>
      {children}
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
  const [activeView, setActiveView] = useState<AuthView>('password');
  const [passwordMode, setPasswordMode] = useState<PasswordMode>('login');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [signupCode, setSignupCode] = useState('');
  const [signupCodeSent, setSignupCodeSent] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [signupResendIn, setSignupResendIn] = useState(0);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [pending, setPending] = useState<
    '' | 'guest' | 'password' | 'register' | 'resend-signup' | 'verify-signup' | 'send-code' | 'verify-code'
  >('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const accountLabel = SUPABASE_ENABLE_PHONE_AUTH ? '邮箱或手机号' : '邮箱';
  const accountPlaceholder = SUPABASE_ENABLE_PHONE_AUTH ? '请输入邮箱或手机号' : '请输入邮箱地址';
  const isEmailAccount = isEmailIdentifier(account);
  const passwordActionLabel = passwordMode === 'login' ? '立即登录' : signupCodeSent ? '完成注册' : '发送注册验证码';
  const passwordPending = pending === 'password' || pending === 'register' || pending === 'verify-signup';
  const idleHint =
    activeView === 'otp'
      ? '已完成注册后，可用邮箱验证码直接登录，不需要输入密码。'
      : passwordMode === 'register'
        ? '注册会发送 6 位邮箱验证码；输入后即完成账号确认并登录。'
        : '登录后会自动继续你刚才的动作，申请表和待办也会同步保存。';

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

  useEffect(() => {
    if (signupResendIn <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => setSignupResendIn((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [signupResendIn]);

  function resetFeedback() {
    setError('');
    setMessage('');
  }

  function resetSignupChallenge() {
    setSignupCode('');
    setSignupCodeSent(false);
    setSignupEmail('');
    setSignupResendIn(0);
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

    if (signupCodeSent) {
      if (!signupCode.trim()) {
        setError('请输入注册邮件中的 6 位验证码。');
        return;
      }

      const result = await runTask(
        'verify-signup',
        () => verifySignupConfirmationCode(signupEmail || identifier, signupCode.trim()),
        { successMessage: '注册完成，已经进入当前会话。' }
      );

      if (result) {
        resetSignupChallenge();
      }

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

    setSignupEmail(identifier);
    setSignupCode('');
    setSignupCodeSent(true);
    setSignupResendIn(60);
    setMessage(result.message);
  }

  async function handleResendSignupCode() {
    if (signupResendIn > 0) {
      return;
    }

    const email = signupEmail || validateAccount({ emailOnly: true });
    if (!email) {
      return;
    }

    const result = await runTask('resend-signup', () => resendSignupConfirmationCode(email), {
      closeOnSuccess: false,
      successMessage: '新的注册验证码已发送，请查看邮箱里的 6 位数字。'
    });

    if (result !== null) {
      setSignupEmail(email);
      setSignupCodeSent(true);
      setSignupResendIn(60);
    }
  }

  async function handleSendCode() {
    const email = validateAccount({ emailOnly: true });
    if (!email || resendIn > 0) {
      return;
    }

    const result = await runTask('send-code', () => sendEmailLoginCode(email), {
      closeOnSuccess: false,
      successMessage: '登录验证码已发送，请查看邮箱里的 6 位数字。'
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
      className={`overflow-hidden border border-slate-100 bg-white shadow-[0_20px_70px_rgba(18,32,38,0.08)] ${
        compact ? 'rounded-[24px]' : 'rounded-[24px] lg:grid lg:grid-cols-[360px_minmax(0,1fr)]'
      }`}
    >
      <aside className="relative hidden overflow-hidden bg-brand px-9 py-10 text-white lg:block">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="寻鹿 Seekoffer" width={42} height={42} className="h-10 w-10 rounded-xl bg-white object-cover" />
            <div className="text-xl font-semibold">寻鹿 Seekoffer</div>
          </div>

          <h3 className="mt-12 text-[30px] font-semibold leading-tight">
            一个账号，
            <br />
            接住你的申请进度
          </h3>

          <div className="mt-10 space-y-9">
            <FeatureRow
              icon={<ShieldCheck className="h-5 w-5" />}
              title="安全可靠"
              description="数据加密保护，信息安全无忧。"
            />
            <FeatureRow
              icon={<BellRing className="h-5 w-5" />}
              title="高效同步"
              description="多端同步进度，随时继续申请。"
            />
          </div>

          {SUPABASE_ENABLE_ANONYMOUS ? (
            <button
              type="button"
              onClick={() => void runTask('guest', () => signInAsGuest())}
              disabled={pending === 'guest'}
              className="mt-12 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/8 px-4 text-sm font-semibold text-white transition hover:bg-white/14 disabled:text-white/50"
            >
              {pending === 'guest' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {pending === 'guest' ? '进入中...' : '先以试用态浏览'}
            </button>
          ) : null}
        </div>

        <div className="absolute inset-x-0 bottom-0 h-44 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.14),transparent_24%),linear-gradient(180deg,transparent,rgba(5,45,48,0.72))]" />
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-brand-deep/55" />
        <div className="absolute bottom-12 left-10 text-6xl text-white/12">鹿</div>
        <div className="absolute -bottom-7 left-0 right-0 h-24 rounded-[50%] bg-brand-deep/70" />
      </aside>

      <form className="px-6 py-7 sm:px-10 sm:py-10" onSubmit={handleFormSubmit}>
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              resetFeedback();
              if (passwordMode === 'register') {
                resetSignupChallenge();
                setActiveView('password');
              }
              setPasswordMode('login');
            }}
            className={`min-h-12 rounded-xl text-base font-semibold transition ${
              passwordMode === 'login' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => {
              resetFeedback();
              resetSignupChallenge();
              setActiveView('password');
              setPasswordMode('register');
            }}
            className={`min-h-12 rounded-xl text-base font-semibold transition ${
              passwordMode === 'register' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            注册
          </button>
        </div>

        <div className="mt-8 inline-flex rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              resetFeedback();
              setActiveView('password');
            }}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition ${
              activeView === 'password' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <LockKeyhole className="h-4 w-4" />
            {passwordMode === 'register' ? '密码注册' : '密码'}
          </button>
          <button
            type="button"
            onClick={() => {
              resetFeedback();
              resetSignupChallenge();
              setPasswordMode('login');
              setActiveView('otp');
            }}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition ${
              activeView === 'otp' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Mail className="h-4 w-4" />
            验证码
          </button>
        </div>

        <div className="mt-7 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{accountLabel}</span>
            <IconInput icon={<Mail className="h-5 w-5" />}>
              <input
                type={SUPABASE_ENABLE_PHONE_AUTH ? 'text' : 'email'}
                inputMode={SUPABASE_ENABLE_PHONE_AUTH ? 'text' : 'email'}
                autoComplete="email"
                value={account}
                onChange={(event) => {
                  setAccount(event.target.value);
                  resetFeedback();
                  resetSignupChallenge();
                }}
                placeholder={accountPlaceholder}
                className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </IconInput>
            <span
              className={`mt-2 block text-xs ${
                isEmailAccount ? 'text-emerald-600' : account.trim() ? 'text-amber-700' : 'text-slate-500'
              }`}
            >
              {helperText}
            </span>
          </label>

          {activeView === 'password' ? (
            <div className="space-y-5">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">密码</span>
                <IconInput icon={<KeyRound className="h-5 w-5" />}>
                  <input
                    type="password"
                    autoComplete={passwordMode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      resetFeedback();
                      resetSignupChallenge();
                    }}
                    placeholder="请输入密码"
                    className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                </IconInput>
              </label>

              {passwordMode === 'register' ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">确认密码</span>
                  <IconInput icon={<KeyRound className="h-5 w-5" />}>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={passwordConfirm}
                      onChange={(event) => {
                        setPasswordConfirm(event.target.value);
                        resetFeedback();
                        resetSignupChallenge();
                      }}
                      placeholder="再次输入密码"
                      className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                    />
                  </IconInput>
                </label>
              ) : (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <label className="inline-flex items-center gap-2 text-slate-500">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                    下次自动登录
                  </label>
                  <button type="button" className="font-semibold text-brand">
                    忘记密码？
                  </button>
                </div>
              )}

              {passwordMode === 'register' && signupCodeSent ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <div className="flex items-start gap-2 text-sm leading-6 text-emerald-800">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      注册验证码已发送至 <strong>{signupEmail || account}</strong>，请输入邮件里的 6 位数字完成注册。
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={signupCode}
                      onChange={(event) => {
                        setSignupCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                        resetFeedback();
                      }}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6 位注册验证码"
                      className="h-12 min-w-0 flex-1 rounded-xl border border-emerald-200 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
                    />
                    <button
                      type="button"
                      onClick={() => void handleResendSignupCode()}
                      disabled={pending === 'resend-signup' || signupResendIn > 0}
                      className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:text-emerald-400"
                    >
                      {pending === 'resend-signup' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                      {signupResendIn > 0 ? `${signupResendIn}s` : '重发'}
                    </button>
                  </div>
                </div>
              ) : null}

              <PrimaryButton
                icon={
                  passwordMode === 'login' ? (
                    <LogIn className="h-5 w-5" />
                  ) : signupCodeSent ? (
                    <ShieldCheck className="h-5 w-5" />
                  ) : (
                    <UserPlus className="h-5 w-5" />
                  )
                }
                pending={passwordPending}
              >
                {passwordPending ? '处理中...' : passwordActionLabel}
              </PrimaryButton>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex gap-3">
                <IconInput icon={<ShieldCheck className="h-5 w-5" />}>
                  <input
                    value={otpCode}
                    onChange={(event) => {
                      setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                      resetFeedback();
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6 位验证码"
                    className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                </IconInput>
                <button
                  type="button"
                  onClick={() => void handleSendCode()}
                  disabled={pending === 'send-code' || resendIn > 0}
                  className="mt-2 inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:text-slate-400"
                >
                  {pending === 'send-code' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {resendIn > 0 ? `${resendIn}s` : otpSent ? '重发' : '发送'}
                </button>
              </div>

              <PrimaryButton icon={<ShieldCheck className="h-5 w-5" />} pending={pending === 'verify-code'}>
                {pending === 'verify-code' ? '验证中...' : '验证码登录'}
              </PrimaryButton>
            </div>
          )}
        </div>

        <div className="mt-5 min-h-12">
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
          {!message && !error ? <p className="text-sm leading-6 text-slate-500">{idleHint}</p> : null}
        </div>

        <div className="mt-4 text-center text-sm text-slate-500">
          {passwordMode === 'login' ? (
            <>
              还没有账号？
              <button
                type="button"
                onClick={() => {
                  resetFeedback();
                  resetSignupChallenge();
                  setActiveView('password');
                  setPasswordMode('register');
                }}
                className="ml-2 font-semibold text-brand"
              >
                立即注册
              </button>
            </>
          ) : (
            <>
              已有账号？
              <button
                type="button"
                onClick={() => {
                  resetFeedback();
                  resetSignupChallenge();
                  setPasswordMode('login');
                }}
                className="ml-2 font-semibold text-brand"
              >
                现在登录
              </button>
            </>
          )}
        </div>
      </form>
    </section>
  );
}
