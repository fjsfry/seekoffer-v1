'use client';

import { useMemo, useState } from 'react';
import {
  ArrowRight,
  KeyRound,
  LoaderCircle,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRoundPlus
} from 'lucide-react';
import { SUPABASE_ENABLE_ANONYMOUS, SUPABASE_ENABLE_PHONE_AUTH } from '@/lib/supabase-env';
import {
  sendEmailLoginCode,
  signInAsGuest,
  signInWithPasswordAccount,
  signUpWithPasswordAccount,
  verifyEmailLoginCode
} from '@/lib/user-session';

type AuthView = 'password' | 'otp';

function AccentBullet({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white/72 px-4 py-3 backdrop-blur">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink">{title}</div>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

function AuthActionButton({
  icon,
  children,
  pending,
  tone = 'primary',
  onClick
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  pending?: boolean;
  tone?: 'primary' | 'secondary';
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold transition ${
        tone === 'primary'
          ? 'bg-brand text-white shadow-[0_18px_40px_rgba(15,118,110,0.18)] hover:bg-brand-deep disabled:bg-brand/70'
          : 'border border-black/8 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400'
      }`}
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
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [pending, setPending] = useState<
    '' | 'guest' | 'password' | 'register' | 'send-code' | 'verify-code'
  >('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const passwordTitle = SUPABASE_ENABLE_PHONE_AUTH ? '邮箱 / 手机号 + 密码' : '邮箱 + 密码';
  const passwordPlaceholder = SUPABASE_ENABLE_PHONE_AUTH ? '输入邮箱或手机号' : '输入常用邮箱';

  const viewCopy = useMemo(() => {
    if (activeView === 'otp') {
      return {
        badge: '快速回到当前流程',
        title: '用邮箱验证码，把当前操作无缝接回来',
        description:
          '适合第一次进入 Seekoffer、换设备临时登录，或者你不想记密码的时候。发送验证码后，直接在当前弹层完成验证即可。'
      };
    }

    return {
      badge: '长期沉淀申请进度',
      title: '创建正式账号，把申请表、待办和个人资料都稳定保存下来',
      description: SUPABASE_ENABLE_PHONE_AUTH
        ? '邮箱和手机号都可以走密码登录。正式账号会把你的申请节奏、工作台和后续动作持续同步到 Supabase。'
        : '当前先开放邮箱密码登录和邮箱验证码登录。正式账号会把你的申请节奏、工作台和后续动作持续同步到 Supabase。'
    };
  }, [activeView]);

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
      setError(`请先填写${passwordTitle}所需的信息。`);
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
      setError(`请先填写${passwordTitle}所需的信息，再完成注册。`);
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
      setMessage('注册成功，已经自动进入当前会话。');
      onSuccess?.();
      return;
    }

    setMessage(result.message);
  }

  async function handleSendCode() {
    if (!otpEmail.trim()) {
      setError('请先输入接收验证码的邮箱。');
      return;
    }

    await runTask('send-code', () => sendEmailLoginCode(otpEmail.trim()), {
      closeOnSuccess: false,
      successMessage: '验证码已发送，请查看邮箱并输入 6 位验证码。'
    });
  }

  async function handleVerifyCode() {
    if (!otpEmail.trim() || !otpCode.trim()) {
      setError('请先输入邮箱和 6 位验证码。');
      return;
    }

    await runTask('verify-code', () => verifyEmailLoginCode(otpEmail.trim(), otpCode.trim()));
  }

  return (
    <section className={compact ? 'space-y-4' : 'space-y-5'}>
      <div className={`grid gap-5 ${compact ? '' : 'lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]'}`}>
        <div className="rounded-[32px] border border-black/6 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">
            正式登录
          </div>

          <div className="mt-4 flex flex-wrap gap-2 rounded-[22px] bg-slate-100 p-1.5">
            <button
              type="button"
              onClick={() => setActiveView('password')}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                activeView === 'password' ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <KeyRound className="h-4 w-4" />
              {passwordTitle}
            </button>
            <button
              type="button"
              onClick={() => setActiveView('otp')}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                activeView === 'otp' ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Mail className="h-4 w-4" />
              邮箱验证码
            </button>
          </div>

          <div className="mt-5 rounded-[28px] border border-brand/10 bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.12),transparent_55%),linear-gradient(180deg,#ffffff_0%,#f7fafc_100%)] p-5 sm:p-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-600">
              <Sparkles className="h-4 w-4 text-brand" />
              {viewCopy.badge}
            </div>

            <h3 className="mt-4 text-[24px] font-semibold leading-tight tracking-tight text-ink sm:text-[28px]">
              {viewCopy.title}
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{viewCopy.description}</p>

            {!SUPABASE_ENABLE_PHONE_AUTH && activeView === 'password' ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                当前生产环境还没开放手机号登录。为了避免注册失败，请直接使用邮箱注册或邮箱验证码登录。
              </div>
            ) : null}

            {activeView === 'password' ? (
              <div className="mt-5 grid gap-3">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">{passwordTitle}</span>
                  <input
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder={passwordPlaceholder}
                    className="w-full rounded-2xl border border-black/6 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand/40 focus:ring-4 focus:ring-brand/10"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">密码</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="设置至少 6 位密码"
                    className="w-full rounded-2xl border border-black/6 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand/40 focus:ring-4 focus:ring-brand/10"
                  />
                </label>

                <div className="grid gap-3 pt-2 sm:grid-cols-2">
                  <AuthActionButton
                    icon={<LogIn className="h-4 w-4" />}
                    pending={pending === 'password'}
                    onClick={() => void handlePasswordLogin()}
                  >
                    {pending === 'password' ? '登录中...' : '密码登录'}
                  </AuthActionButton>
                  <AuthActionButton
                    icon={<UserRoundPlus className="h-4 w-4" />}
                    pending={pending === 'register'}
                    tone="secondary"
                    onClick={() => void handlePasswordRegister()}
                  >
                    {pending === 'register' ? '注册中...' : '首次注册'}
                  </AuthActionButton>
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">邮箱</span>
                  <input
                    value={otpEmail}
                    onChange={(event) => setOtpEmail(event.target.value)}
                    placeholder="输入接收验证码的邮箱"
                    className="w-full rounded-2xl border border-black/6 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand/40 focus:ring-4 focus:ring-brand/10"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">6 位验证码</span>
                  <input
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value)}
                    placeholder="输入邮箱里的 6 位验证码"
                    className="w-full rounded-2xl border border-black/6 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand/40 focus:ring-4 focus:ring-brand/10"
                  />
                </label>

                <div className="grid gap-3 pt-2 sm:grid-cols-2">
                  <AuthActionButton
                    icon={<Mail className="h-4 w-4" />}
                    pending={pending === 'send-code'}
                    tone="secondary"
                    onClick={() => void handleSendCode()}
                  >
                    {pending === 'send-code' ? '发送中...' : '发送验证码'}
                  </AuthActionButton>
                  <AuthActionButton
                    icon={<ShieldCheck className="h-4 w-4" />}
                    pending={pending === 'verify-code'}
                    onClick={() => void handleVerifyCode()}
                  >
                    {pending === 'verify-code' ? '验证中...' : '验证码登录'}
                  </AuthActionButton>
                </div>
              </div>
            )}

            {message ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {message}
              </div>
            ) : null}
            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[32px] border border-brand/10 bg-[linear-gradient(160deg,rgba(15,118,110,0.12)_0%,rgba(255,255,255,0.98)_42%,rgba(248,250,252,0.96)_100%)] p-5 sm:p-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">
              Seekoffer 登录价值
            </div>
            <h3 className="mt-4 text-[22px] font-semibold leading-tight text-ink">
              不只是“进站登录”，而是把你的申请流程稳定接住
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              登录成功后，你刚才在通知库、申请表和工作台里的动作会直接续上，不需要重新找入口。
            </p>

            <div className="mt-5 space-y-3">
              <AccentBullet
                icon={<ShieldCheck className="h-4 w-4" />}
                title="动作不中断"
                description="登录成功后自动回到当前页面，并继续你刚才的关键动作。"
              />
              <AccentBullet
                icon={<KeyRound className="h-4 w-4" />}
                title="申请进度稳定保存"
                description="申请表、个人资料、手动项目和后续工作台状态会持续沉淀。"
              />
              <AccentBullet
                icon={<Mail className="h-4 w-4" />}
                title="邮箱体系更稳"
                description="当前生产环境优先开放邮箱登录与邮箱验证码，避免手机号未开通带来的失败体验。"
              />
            </div>
          </div>

          {SUPABASE_ENABLE_ANONYMOUS ? (
            <div className="rounded-[28px] border border-black/6 bg-slate-50 p-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                <Sparkles className="h-4 w-4 text-brand" />
                还想先试一下
              </div>
              <h4 className="mt-4 text-lg font-semibold text-ink">先用本地试用态浏览内容</h4>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                你仍然可以先浏览通知库、资源库和基础工作台。真正需要保存个人动作时，再升级到正式账号。
              </p>
              <button
                onClick={() => void runTask('guest', () => signInAsGuest())}
                disabled={pending === 'guest'}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-black/8 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:text-slate-400"
              >
                {pending === 'guest' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {pending === 'guest' ? '进入中...' : '先进入试用态'}
              </button>
            </div>
          ) : null}

          <div className="rounded-[28px] border border-dashed border-black/8 bg-white px-5 py-4">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
              <ShieldCheck className="h-4 w-4 text-brand" />
              登录说明
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Seekoffer 仍然允许你先浏览通知库、院校库和资源库。只有加入申请表、进入工作台、发布 Offer
              这类需要保存个人状态的动作，才会要求你完成正式登录。
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              如果你是第一次注册，优先使用邮箱更稳。完成注册后，后续可以一直用密码登录，也可以改用邮箱验证码快速回来。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
