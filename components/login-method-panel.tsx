'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BellRing,
  CalendarCheck,
  CheckCircle2,
  Eye,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserPlus,
  X
} from 'lucide-react';
import {
  SEEKOFFER_SITE_URL,
  SUPABASE_ENABLE_ANONYMOUS,
  SUPABASE_ENABLE_PHONE_AUTH
} from '@/lib/supabase-env';
import {
  isEmailIdentifier,
  resendSignupConfirmationCode,
  sendEmailLoginCode,
  sendPasswordResetEmail,
  signInAsGuest,
  signInWithPasswordAccount,
  signUpWithPasswordAccount,
  verifyEmailLoginCode,
  verifySignupConfirmationCode
} from '@/lib/user-session';

type AuthView = 'password' | 'otp';
type PasswordMode = 'login' | 'register';
type AuthErrorField = 'account' | 'password' | 'passwordConfirm' | 'code' | 'form';

function friendlyAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : '';
  const containsChinese = /[\u3400-\u9fff]/.test(message);
  const containsTechnicalDetail = /(supabase|fetch|jwt|sql|status\s*code|networkerror|failed to fetch)/i.test(message);

  if (message && containsChinese && !containsTechnicalDetail) {
    return message;
  }

  return '当前登录暂时没有完成，请检查网络后重试。';
}

function looksLikePhoneIdentifier(value: string) {
  return /^[+\d\s\-()]{6,}$/.test(value.trim());
}

function AuthFeature({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/14 bg-white/10 text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
        {icon}
      </div>
      <div>
        <div className="text-base font-semibold text-white">{title}</div>
        <p className="mt-1 text-sm leading-6 text-white/72">{description}</p>
      </div>
    </div>
  );
}

function PrimaryButton({
  icon,
  pending,
  children
}: {
  icon: React.ReactNode;
  pending?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="group inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#0f5b5b] via-[#0d6764] to-[#064849] px-5 text-lg font-semibold text-white shadow-[0_22px_46px_rgba(6,72,73,0.26)] transition hover:-translate-y-0.5 hover:shadow-[0_26px_56px_rgba(6,72,73,0.32)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : icon}
      {children}
      {!pending ? <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" /> : null}
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
    <div className="mt-3 flex h-[64px] items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 shadow-[0_10px_30px_rgba(15,38,50,0.04)] transition focus-within:border-brand/55 focus-within:ring-4 focus-within:ring-brand/10">
      <span className="text-slate-400">{icon}</span>
      {children}
    </div>
  );
}

export function LoginMethodPanel({
  mode = 'modal',
  allowGuest = SUPABASE_ENABLE_ANONYMOUS,
  onClose,
  onSuccess
}: {
  mode?: 'card' | 'popover' | 'modal' | 'desktop';
  allowGuest?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
}) {
  const compact = mode !== 'modal';
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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [pending, setPending] = useState<
    | ''
    | 'guest'
    | 'password'
    | 'register'
    | 'resend-signup'
    | 'verify-signup'
    | 'reset-password'
    | 'send-code'
    | 'verify-code'
  >('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState<AuthErrorField>('form');

  const accountLabel = SUPABASE_ENABLE_PHONE_AUTH ? '邮箱或手机号' : '邮箱';
  const accountPlaceholder = SUPABASE_ENABLE_PHONE_AUTH ? '请输入邮箱或手机号' : '请输入邮箱地址';
  const isEmailAccount = isEmailIdentifier(account);
  const passwordPending = pending === 'password' || pending === 'register' || pending === 'verify-signup';
  const passwordActionLabel =
    passwordMode === 'login' ? '立即登录并查看进度' : signupCodeSent ? '完成注册并查看全部申请' : '发送注册验证码';
  const formIntro = useMemo(() => {
    if (passwordMode === 'register') {
      return signupCodeSent
        ? '注册验证码已发送，输入 6 位数字后即可完成账号确认。'
        : '使用邮箱和密码创建 SeekOffer 账号，注册邮件会发送 6 位验证码。';
    }

    if (activeView === 'otp') {
      return '输入邮箱验证码即可登录，适合忘记密码或临时登录。';
    }

    return '使用邮箱和密码登录你的 SeekOffer 账号。';
  }, [activeView, passwordMode, signupCodeSent]);

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
    setErrorField('form');
  }

  function showError(message: string, field: AuthErrorField = 'form') {
    setMessage('');
    setError(message);
    setErrorField(field);
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
      showError(`请先输入${accountLabel}。`, 'account');
      return '';
    }

    if ((options.emailOnly || !SUPABASE_ENABLE_PHONE_AUTH) && !isEmailIdentifier(value)) {
      if (looksLikePhoneIdentifier(value) && !SUPABASE_ENABLE_PHONE_AUTH) {
        showError('当前暂未开放手机号登录，请使用邮箱完成登录或注册。', 'account');
        return '';
      }

      showError('请输入完整的邮箱地址，例如 name@example.com。', 'account');
      return '';
    }

    return value;
  }

  async function runWithTimeout<T>(task: () => Promise<T>, timeoutMs = 25000) {
    let timer: number | undefined;

    try {
      return await Promise.race([
        task(),
        new Promise<never>((_, reject) => {
          timer = window.setTimeout(() => {
            reject(new Error('认证服务响应超时，请稍后重试。'));
          }, timeoutMs);
        })
      ]);
    } finally {
      if (timer) {
        window.clearTimeout(timer);
      }
    }
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
      const result = await runWithTimeout(task);
      if (options.successMessage) {
        setMessage(options.successMessage);
      }

      if (options.closeOnSuccess ?? true) {
        onSuccess?.();
      }

      return result;
    } catch (taskError) {
      showError(friendlyAuthErrorMessage(taskError));
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

    if (passwordMode === 'register' && signupCodeSent) {
      if (!signupCode.trim()) {
        showError('请输入注册邮件中的 6 位验证码。', 'code');
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

    if (!password.trim()) {
      showError('请输入密码。', 'password');
      return;
    }

    if (password.length < 6) {
      showError('密码至少需要 6 位。', 'password');
      return;
    }

    if (passwordMode === 'register' && password !== passwordConfirm) {
      showError('两次输入的密码不一致。', 'passwordConfirm');
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

  async function handlePasswordReset() {
    const email = validateAccount({ emailOnly: true });
    if (!email) {
      return;
    }

    await runTask('reset-password', () => sendPasswordResetEmail(email), {
      closeOnSuccess: false,
      successMessage: '密码重置邮件已发送，请打开邮箱里的链接完成重设。也可以切换到“验证码”直接登录。'
    });
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
      showError('请输入邮箱中的 6 位验证码。', 'code');
      return;
    }

    await runTask('verify-code', () => verifyEmailLoginCode(email, otpCode.trim()));
  }

  function switchToLogin(nextView: AuthView = 'password') {
    resetFeedback();
    resetSignupChallenge();
    setPasswordMode('login');
    setActiveView(nextView);
  }

  function switchToRegister() {
    resetFeedback();
    resetSignupChallenge();
    setActiveView('password');
    setPasswordMode('register');
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

  function openLegalPage(path: '/terms' | '/privacy') {
    const href = `${SEEKOFFER_SITE_URL.replace(/\/$/, '')}${path}`;
    if ('__TAURI_INTERNALS__' in window) {
      void import('@tauri-apps/plugin-opener').then(({ openUrl }) => openUrl(href));
      return;
    }

    window.open(href, '_blank', 'noopener,noreferrer');
  }

  function handleDesktopLoginTabKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (pending) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();

    const tablist = event.currentTarget;
    const nextView =
      event.key === 'Home'
        ? 'password'
        : event.key === 'End'
          ? 'otp'
          : activeView === 'password'
            ? 'otp'
            : 'password';
    switchToLogin(nextView);
    const nextIndex = nextView === 'password' ? 0 : 1;
    window.requestAnimationFrame(() => {
      const tabs = tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      tabs[nextIndex]?.focus();
    });
  }

  if (mode === 'desktop') {
    const registering = passwordMode === 'register';
    const desktopHeading = registering ? '创建寻鹿账号' : '登录寻鹿';
    const desktopDescription = registering
      ? signupCodeSent
        ? '输入邮件中的 6 位验证码，完成账号确认'
        : '使用邮箱创建账号，申请进度自动同步'
      : '继续管理你的申请、材料与截止提醒';
    const desktopActionLabel =
      activeView === 'otp'
        ? '验证并登录'
        : registering
          ? signupCodeSent
            ? '完成注册'
            : '发送注册验证码'
          : '登录';
    const desktopSubmitBusy = activeView === 'otp'
      ? pending === 'verify-code'
      : passwordPending;
    const desktopSubmitDisabled = Boolean(pending) || (activeView === 'otp' && otpCode.length !== 6);

    return (
      <section
        className="desktop-login-method-panel"
        aria-labelledby="desktop-login-title"
        data-auth-view={activeView}
        data-auth-mode={registering ? 'register' : 'login'}
        data-feedback-state={desktopSubmitBusy ? 'pending' : error ? 'error' : message ? 'success' : 'idle'}
      >
        <header className="desktop-login-card-header">
          <h1 id="desktop-login-title">{desktopHeading}</h1>
          <p>{desktopDescription}</p>
        </header>

        <form
          className="desktop-login-form"
          onSubmit={handleFormSubmit}
          aria-busy={Boolean(pending)}
        >
          {!registering ? (
            <div
              className="desktop-login-tabs"
              role="tablist"
              aria-label="登录方式"
              onKeyDown={handleDesktopLoginTabKeyDown}
            >
              <button
                id="desktop-login-tab-password"
                type="button"
                role="tab"
                aria-selected={activeView === 'password'}
                aria-controls="desktop-login-tabpanel"
                tabIndex={activeView === 'password' ? 0 : -1}
                data-state={activeView === 'password' ? 'active' : 'idle'}
                onClick={() => switchToLogin('password')}
                disabled={Boolean(pending)}
              >
                密码登录
              </button>
              <button
                id="desktop-login-tab-otp"
                type="button"
                role="tab"
                aria-selected={activeView === 'otp'}
                aria-controls="desktop-login-tabpanel"
                tabIndex={activeView === 'otp' ? 0 : -1}
                data-state={activeView === 'otp' ? 'active' : 'idle'}
                onClick={() => switchToLogin('otp')}
                disabled={Boolean(pending)}
              >
                验证码登录
              </button>
            </div>
          ) : (
            <div className="desktop-register-context">
              <span>{signupCodeSent ? '验证注册邮箱' : '邮箱注册'}</span>
              <button type="button" onClick={() => switchToLogin('password')}>
                返回登录
              </button>
            </div>
          )}

          <div
            id="desktop-login-tabpanel"
            className="desktop-login-fields"
            role={!registering ? 'tabpanel' : undefined}
            aria-labelledby={!registering ? `desktop-login-tab-${activeView}` : undefined}
          >
            <label className="desktop-login-field">
              <span className="sr-only">邮箱地址</span>
              <span className="desktop-login-field-icon" aria-hidden="true">
                <Mail />
              </span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                value={account}
                readOnly={signupCodeSent}
                disabled={Boolean(pending)}
                onChange={(event) => {
                  setAccount(event.target.value);
                  resetFeedback();
                  resetSignupChallenge();
                }}
                placeholder="邮箱地址"
                aria-invalid={Boolean(error) && errorField === 'account'}
                aria-describedby={message || error ? 'desktop-auth-feedback' : undefined}
              />
            </label>

            {account.trim() && !isEmailAccount ? (
              <p className="desktop-login-field-hint">{helperText}</p>
            ) : null}

            {activeView === 'password' && !signupCodeSent ? (
              <>
                <label className="desktop-login-field">
                  <span className="sr-only">密码</span>
                  <span className="desktop-login-field-icon" aria-hidden="true">
                    <KeyRound />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={registering ? 'new-password' : 'current-password'}
                    disabled={Boolean(pending)}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      resetFeedback();
                    }}
                    placeholder={registering ? '设置密码（至少 6 位）' : '请输入密码'}
                    aria-invalid={Boolean(error) && errorField === 'password'}
                    aria-describedby={message || error ? 'desktop-auth-feedback' : undefined}
                  />
                  <button
                    type="button"
                    className="desktop-login-field-action"
                    onClick={() => setShowPassword((current) => !current)}
                    disabled={Boolean(pending)}
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    title={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    <Eye />
                  </button>
                </label>

                {registering ? (
                  <label className="desktop-login-field">
                    <span className="sr-only">确认密码</span>
                    <span className="desktop-login-field-icon" aria-hidden="true">
                      <ShieldCheck />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      disabled={Boolean(pending)}
                      value={passwordConfirm}
                      onChange={(event) => {
                        setPasswordConfirm(event.target.value);
                        resetFeedback();
                      }}
                      placeholder="再次输入密码"
                      aria-invalid={Boolean(error) && errorField === 'passwordConfirm'}
                      aria-describedby={message || error ? 'desktop-auth-feedback' : undefined}
                    />
                  </label>
                ) : (
                  <div className="desktop-login-assist">
                    <button
                      type="button"
                      onClick={() => void handlePasswordReset()}
                      disabled={Boolean(pending)}
                    >
                      {pending === 'reset-password' ? '正在发送…' : '忘记密码？'}
                    </button>
                  </div>
                )}
              </>
            ) : null}

            {activeView === 'password' && registering && signupCodeSent ? (
              <div className="desktop-login-code-block">
                <p>
                  验证码已发送至 <strong>{signupEmail || account}</strong>
                </p>
                <div>
                  <label className="desktop-login-field">
                    <span className="sr-only">注册验证码</span>
                    <span className="desktop-login-field-icon" aria-hidden="true">
                      <ShieldCheck />
                    </span>
                    <input
                      value={signupCode}
                      onChange={(event) => {
                        setSignupCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                        resetFeedback();
                      }}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      disabled={Boolean(pending)}
                      placeholder="6 位注册验证码"
                      aria-invalid={Boolean(error) && errorField === 'code'}
                      aria-describedby={message || error ? 'desktop-auth-feedback' : undefined}
                    />
                  </label>
                  <button
                    type="button"
                    className="desktop-login-code-action"
                    onClick={() => void handleResendSignupCode()}
                    disabled={Boolean(pending) || signupResendIn > 0}
                  >
                    {pending === 'resend-signup' ? <LoaderCircle className="desktop-login-spinner" aria-hidden="true" /> : null}
                    {signupResendIn > 0 ? `${signupResendIn}s` : '重新发送'}
                  </button>
                </div>
              </div>
            ) : null}

            {activeView === 'otp' ? (
              <div className="desktop-login-code-row">
                <label className="desktop-login-field">
                  <span className="sr-only">邮箱验证码</span>
                  <span className="desktop-login-field-icon" aria-hidden="true">
                    <ShieldCheck />
                  </span>
                  <input
                    value={otpCode}
                    onChange={(event) => {
                      setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                      resetFeedback();
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    disabled={Boolean(pending)}
                    placeholder="6 位邮箱验证码"
                    aria-invalid={Boolean(error) && errorField === 'code'}
                    aria-describedby={message || error ? 'desktop-auth-feedback' : undefined}
                  />
                </label>
                <button
                  type="button"
                  className="desktop-login-code-action"
                  onClick={() => void handleSendCode()}
                  disabled={Boolean(pending) || resendIn > 0 || !isEmailAccount}
                >
                  {pending === 'send-code' ? <LoaderCircle className="desktop-login-spinner" aria-hidden="true" /> : null}
                  {resendIn > 0 ? `${resendIn}s` : otpSent ? '重新发送' : '发送验证码'}
                </button>
              </div>
            ) : null}
          </div>

          <div
            className="desktop-login-feedback-slot"
            aria-live="polite"
            aria-atomic="true"
            data-feedback-state={message ? 'success' : error ? 'error' : 'idle'}
          >
            {message ? (
              <div id="desktop-auth-feedback" className="desktop-login-feedback desktop-login-feedback--success" role="status">
                {message}
              </div>
            ) : error ? (
              <div id="desktop-auth-feedback" className="desktop-login-feedback desktop-login-feedback--error" role="alert">
                {error}
              </div>
            ) : (
              <span aria-hidden="true" />
            )}
          </div>

          <button
            type="submit"
            className="desktop-login-primary"
            disabled={desktopSubmitDisabled}
            aria-busy={desktopSubmitBusy}
            data-feedback-state={desktopSubmitBusy ? 'pending' : 'idle'}
          >
            {desktopSubmitBusy ? <LoaderCircle className="desktop-login-spinner" aria-hidden="true" /> : null}
            <span>{desktopSubmitBusy ? '正在处理…' : desktopActionLabel}</span>
          </button>

          <p className="desktop-login-legal">
            继续即表示你已阅读并同意
            <button type="button" onClick={() => openLegalPage('/terms')}>《用户协议》</button>
            与
            <button type="button" onClick={() => openLegalPage('/privacy')}>《隐私政策》</button>
          </p>

          <div className="desktop-login-register-link">
            {registering ? (
              <>
                <span>已有账号？</span>
                <button type="button" onClick={() => switchToLogin('password')}>现在登录</button>
              </>
            ) : (
              <>
                <span>还没有账号？</span>
                <button type="button" onClick={switchToRegister}>立即注册</button>
              </>
            )}
          </div>

          <div className="desktop-login-security-note" role="note" aria-label="账号安全说明">
            <ShieldCheck aria-hidden="true" />
            <p>
              <strong>安全登录</strong>
              <span>账号信息仅用于身份验证与申请数据同步</span>
            </p>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section
      className={`relative w-full overflow-hidden border border-white/75 bg-white shadow-[0_36px_120px_rgba(15,38,50,0.22)] ${
        compact
          ? 'max-h-[92vh] overflow-y-auto rounded-t-[28px] sm:max-w-[560px] sm:rounded-[30px]'
          : 'max-w-[1120px] rounded-[34px] lg:grid lg:grid-cols-[480px_minmax(0,1fr)]'
      }`}
    >
      <aside className="relative hidden min-h-[720px] overflow-hidden bg-[radial-gradient(circle_at_80%_18%,rgba(103,232,249,0.22),transparent_26%),linear-gradient(145deg,#073f41,#0b6764_48%,#063536)] px-14 py-14 text-white lg:block">
        <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_72%_26%,rgba(255,255,255,0.45)_0_3px,transparent_4px),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.42)_0_3px,transparent_4px)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_40%_86%,rgba(116,255,190,0.28),transparent_24%)]" />
        <div className="pointer-events-none absolute -bottom-20 left-0 right-0 h-64 rounded-[50%] bg-[#0b4c4d]" />
        <div className="pointer-events-none absolute -bottom-28 left-20 h-60 w-96 rounded-[50%] bg-emerald-300/20 blur-2xl" />

        <div className="relative z-20">
          <div className="flex items-center gap-4">
            <Image src="/logo.png" alt="SeekOffer" width={58} height={58} className="h-14 w-14 rounded-2xl bg-white object-cover shadow-lg" />
            <div>
              <div className="text-2xl font-semibold tracking-tight">SeekOffer</div>
            </div>
          </div>

          <h3 className="mt-20 text-[36px] font-semibold leading-[1.25] tracking-tight">
            一个账号
            <br />
            掌握你的申请<span className="text-emerald-200">全进度</span>
          </h3>
          <p className="mt-5 text-base leading-7 text-white/72">科学规划 · 高效跟进 · 结果尽在掌握</p>

          <div className="relative z-20 mt-12 space-y-8">
            <AuthFeature
              icon={<CalendarCheck className="h-6 w-6" />}
              title="全流程申请管理"
              description="从选校到录取，关键节点清晰可见"
            />
            <AuthFeature
              icon={<BarChart3 className="h-6 w-6" />}
              title="进度可视化"
              description="实时更新状态，重要提醒不错过"
            />
            <AuthFeature
              icon={<BellRing className="h-6 w-6" />}
              title="关键信息提醒"
              description="截止时间、材料反馈及时通知"
            />
          </div>

          {allowGuest ? (
            <button
              type="button"
              onClick={() => void runTask('guest', () => signInAsGuest())}
              disabled={pending === 'guest'}
              className="mt-12 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-white/34 bg-white/10 px-5 text-base font-semibold text-white transition hover:bg-white/16 disabled:opacity-60"
            >
              {pending === 'guest' ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
              {pending === 'guest' ? '进入中...' : '先试用态浏览'}
            </button>
          ) : null}
        </div>

        <div className="pointer-events-none absolute bottom-14 left-24 z-0 h-40 w-56 rotate-[-8deg] rounded-[28px] border border-white/24 bg-white/12 p-6 opacity-55 shadow-[0_22px_60px_rgba(0,0,0,0.2)] backdrop-blur">
          <div className="h-4 w-28 rounded-full bg-white/55" />
          <div className="mt-5 h-3 w-36 rounded-full bg-emerald-100/55" />
          <div className="mt-4 h-3 w-24 rounded-full bg-white/40" />
          <CheckCircle2 className="absolute -right-4 -bottom-4 h-14 w-14 rounded-full bg-white p-3 text-emerald-500 shadow-2xl" />
        </div>
      </aside>

      <form className="relative px-7 py-8 sm:px-12 sm:py-11 lg:px-14" onSubmit={handleFormSubmit}>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-6 top-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
            aria-label="关闭"
          >
            <X className="h-6 w-6" />
          </button>
        ) : null}

        <div className="pr-12">
          <div className="grid grid-cols-2 border-b border-slate-200 text-center">
            <button
              type="button"
              onClick={() => switchToLogin('password')}
              className={`relative min-h-16 text-2xl font-semibold transition ${
                passwordMode === 'login' ? 'text-brand' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              登录
              {passwordMode === 'login' ? <span className="absolute bottom-[-1px] left-8 right-8 h-0.5 rounded-full bg-brand" /> : null}
            </button>
            <button
              type="button"
              onClick={switchToRegister}
              className={`relative min-h-16 text-2xl font-semibold transition ${
                passwordMode === 'register' ? 'text-brand' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              注册
              {passwordMode === 'register' ? <span className="absolute bottom-[-1px] left-8 right-8 h-0.5 rounded-full bg-brand" /> : null}
            </button>
          </div>
        </div>

        <p className="mt-9 text-base leading-7 text-slate-600">{formIntro}</p>

        <div className="mt-7 inline-flex rounded-2xl bg-slate-100 p-1">
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
            密码
          </button>
          <button
            type="button"
            onClick={() => switchToLogin('otp')}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition ${
              activeView === 'otp' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Mail className="h-4 w-4" />
            验证码
          </button>
        </div>

        <div className="mt-8 space-y-6">
          <label className="block">
            <span className="text-base font-medium text-slate-800">{accountLabel}</span>
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
                className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400"
              />
            </IconInput>
            <span className={`mt-2 block text-sm ${isEmailAccount ? 'text-emerald-600' : account.trim() ? 'text-amber-700' : 'text-slate-500'}`}>
              {helperText}
            </span>
          </label>

          {activeView === 'password' ? (
            <div className="space-y-6">
              {!signupCodeSent ? (
                <>
                  <label className="block">
                    <span className="text-base font-medium text-slate-800">密码</span>
                    <IconInput icon={<KeyRound className="h-5 w-5" />}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={passwordMode === 'login' ? 'current-password' : 'new-password'}
                        value={password}
                        onChange={(event) => {
                          setPassword(event.target.value);
                          resetFeedback();
                        }}
                        placeholder="请输入密码"
                        className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="text-slate-400 transition hover:text-slate-600"
                        aria-label={showPassword ? '隐藏密码' : '显示密码'}
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                    </IconInput>
                  </label>

                  {passwordMode === 'register' ? (
                    <label className="block">
                      <span className="text-base font-medium text-slate-800">确认密码</span>
                      <IconInput icon={<KeyRound className="h-5 w-5" />}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={passwordConfirm}
                          onChange={(event) => {
                            setPasswordConfirm(event.target.value);
                            resetFeedback();
                          }}
                          placeholder="再次输入密码"
                          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400"
                        />
                      </IconInput>
                    </label>
                  ) : (
                    <div className="flex items-center justify-between gap-3 text-base">
                      <label className="inline-flex items-center gap-3 text-slate-500">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(event) => setRememberMe(event.target.checked)}
                          className="h-5 w-5 rounded border-slate-300"
                        />
                        记住我
                      </label>
                      <button
                        type="button"
                        onClick={() => void handlePasswordReset()}
                        disabled={pending === 'reset-password'}
                        className="inline-flex items-center gap-1 font-semibold text-brand transition hover:text-brand-deep disabled:text-slate-400"
                      >
                        {pending === 'reset-password' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                        {pending === 'reset-password' ? '发送中...' : '忘记密码？'}
                      </button>
                    </div>
                  )}
                </>
              ) : null}

              {passwordMode === 'register' && signupCodeSent ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <div className="flex items-start gap-2 text-sm leading-6 text-emerald-800">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      注册验证码已发送至 <strong>{signupEmail || account}</strong>，请输入邮件里的 6 位数字完成注册。
                    </span>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <input
                      value={signupCode}
                      onChange={(event) => {
                        setSignupCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                        resetFeedback();
                      }}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6 位注册验证码"
                      className="h-[52px] min-w-0 flex-1 rounded-xl border border-emerald-200 bg-white px-4 text-base outline-none transition placeholder:text-slate-400 focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
                    />
                    <button
                      type="button"
                      onClick={() => void handleResendSignupCode()}
                      disabled={pending === 'resend-signup' || signupResendIn > 0}
                      className="inline-flex h-[52px] shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:text-emerald-400"
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
                    <ArrowRight className="h-5 w-5" />
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
            <div className="space-y-6">
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
                    className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400"
                  />
                </IconInput>
                <button
                  type="button"
                  onClick={() => void handleSendCode()}
                  disabled={pending === 'send-code' || resendIn > 0}
                  className="mt-3 inline-flex h-[64px] shrink-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:text-slate-400"
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
          {!message && !error ? (
            <p className="text-sm leading-6 text-slate-500">
              登录即代表你已同意 <span className="font-semibold text-brand">《用户协议》</span> 与{' '}
              <span className="font-semibold text-brand">《隐私政策》</span>
            </p>
          ) : null}
        </div>

        <div className="mt-3">
          {passwordMode === 'login' ? (
            <button
              type="button"
              onClick={switchToRegister}
              className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-base font-semibold text-slate-600 transition hover:border-brand/40 hover:text-brand"
            >
              还没有账号？<span className="ml-2 text-brand">立即注册</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchToLogin('password')}
              className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-base font-semibold text-slate-600 transition hover:border-brand/40 hover:text-brand"
            >
              已有账号？<span className="ml-2 text-brand">现在登录</span>
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
