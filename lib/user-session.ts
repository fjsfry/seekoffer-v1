'use client';

import {
  bootstrapCloudflareIdentity,
  cloudflareRequest,
  cloudflareApiErrorMessage,
  CloudflareApiError,
  isCloudflareQuotaError
} from './cloudflare-api';
import {
  clerkErrorMessage,
  getClerk,
  type ClerkInstance,
  type ClerkUser
} from './clerk-browser';

export type UserProfile = {
  nickname: string;
  age: string;
  undergraduateSchool: string;
  major: string;
  grade: string;
  targetMajor: string;
  targetRegion: string;
};

export type AuthProviderType = 'password' | 'otp' | 'anonymous';
export type AuthRequirement = 'session' | 'member';

export type UserSession = {
  loggedIn: boolean;
  authProvider: AuthProviderType;
  profile: UserProfile;
  userId: string | null;
  email: string;
  phone: string;
};

export type CredentialsPayload = {
  identifier: string;
  password: string;
};

export type EmailLoginCodeOptions = {
  shouldCreateUser?: boolean;
};

export type PasswordSignUpResult =
  | {
      status: 'signed_in';
      session: UserSession;
    }
  | {
      status: 'pending_confirmation';
      message: string;
    };

const SESSION_STORAGE_KEY = 'seekoffer-user-session';
const SESSION_EVENT_NAME = 'seekoffer-user-session-updated';
const SESSION_HYDRATED_AT_KEY = 'seekoffer-user-session-hydrated-at';
const SESSION_HYDRATION_TTL_MS = 5 * 60_000;

const defaultProfile: UserProfile = {
  nickname: '',
  age: '',
  undergraduateSchool: '',
  major: '',
  grade: '大四',
  targetMajor: '',
  targetRegion: ''
};

type ClerkProfileRow = {
  id?: string;
  nickname?: string | null;
  age?: string | number | null;
  undergraduate_school?: string | null;
  major?: string | null;
  grade?: string | null;
  target_major?: string | null;
  target_region?: string | null;
  sync_revision?: number | null;
};

let pendingSignUp: { email: string; password: string } | null = null;
let hydrateInFlight: Promise<UserSession | null> | null = null;
let quotaBlockedUntil = 0;
let lastQuotaLogAt = 0;

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function wasSessionHydratedRecently() {
  if (!canUseBrowserStorage()) return false;
  const timestamp = Number(window.localStorage.getItem(SESSION_HYDRATED_AT_KEY));
  return Number.isFinite(timestamp) && timestamp > 0 && Date.now() - timestamp < SESSION_HYDRATION_TTL_MS;
}

function markSessionHydrated() {
  if (!canUseBrowserStorage()) return;
  window.localStorage.setItem(SESSION_HYDRATED_AT_KEY, String(Date.now()));
}

function clearSessionHydrationMarker() {
  if (!canUseBrowserStorage()) return;
  window.localStorage.removeItem(SESSION_HYDRATED_AT_KEY);
}

function emitSessionUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_EVENT_NAME));
  }
}

function normalizeProfile(profile?: Partial<UserProfile>) {
  return { ...defaultProfile, ...(profile || {}) };
}

function normalizeProvider(provider?: unknown): AuthProviderType | null {
  return provider === 'password' || provider === 'otp' || provider === 'anonymous' ? provider : null;
}

export function normalizeEmailIdentifier(value: string) {
  return value.trim().toLowerCase();
}

export function isEmailIdentifier(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmailIdentifier(value));
}

function normalizePhoneIdentifier(value: string) {
  return value.replace(/[^\d+]/g, '');
}

function isPhoneIdentifier(value: string) {
  const trimmed = value.trim();
  if (!trimmed || isEmailIdentifier(trimmed) || !/^[+\d\s\-()]+$/.test(trimmed)) return false;
  return /^\+?\d{6,15}$/.test(normalizePhoneIdentifier(value));
}

function normalizeIdentifier(value: string) {
  const trimmed = value.trim();
  if (isEmailIdentifier(trimmed)) return normalizeEmailIdentifier(trimmed);
  return isPhoneIdentifier(trimmed) ? normalizePhoneIdentifier(trimmed) : trimmed.toLowerCase();
}

function readRecordText(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function toObjectRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function extractProfileMetadata(metadata?: Record<string, unknown> | null) {
  if (!metadata) return {};
  return {
    nickname: readRecordText(metadata, 'nickname', 'nickName', 'name', 'display_name'),
    age: readRecordText(metadata, 'age'),
    undergraduateSchool: readRecordText(metadata, 'undergraduateSchool', 'undergraduate_school'),
    major: readRecordText(metadata, 'major'),
    grade: readRecordText(metadata, 'grade'),
    targetMajor: readRecordText(metadata, 'targetMajor', 'target_major'),
    targetRegion: readRecordText(metadata, 'targetRegion', 'target_region')
  } satisfies Partial<UserProfile>;
}

function extractProfileRow(row: ClerkProfileRow | null | undefined) {
  if (!row) return {};
  return {
    nickname: String(row.nickname || ''),
    age: String(row.age || ''),
    undergraduateSchool: String(row.undergraduate_school || ''),
    major: String(row.major || ''),
    grade: String(row.grade || '大四'),
    targetMajor: String(row.target_major || ''),
    targetRegion: String(row.target_region || '')
  } satisfies Partial<UserProfile>;
}

function primaryEmail(user: ClerkUser | null | undefined) {
  if (!user) return '';
  return (
    user.emailAddresses?.find((item) => item.id === user.primaryEmailAddressId)?.emailAddress ||
    user.emailAddresses?.find((item) => item.emailAddress)?.emailAddress ||
    ''
  );
}

export function getAuthProviderLabel(provider: AuthProviderType) {
  return provider === 'otp' ? '邮箱验证码' : provider === 'anonymous' ? '本地试用' : '密码登录';
}

export function isLoggedInSession(session: UserSession | null | undefined) {
  return Boolean(session?.loggedIn);
}

export function isMemberSession(session: UserSession | null | undefined) {
  return Boolean(session?.loggedIn && session.authProvider !== 'anonymous' && session.userId?.trim());
}

export function satisfiesAuthRequirement(
  session: UserSession | null | undefined,
  requirement: AuthRequirement = 'session'
) {
  return requirement === 'member' ? isMemberSession(session) : isLoggedInSession(session);
}

function normalizeErrorText(raw: string) {
  return raw.replace(/\s+/g, ' ').trim();
}

function extractErrorText(error: unknown) {
  if (!error) return '';
  if (typeof error === 'string') return normalizeErrorText(error);
  if (error instanceof Error) return normalizeErrorText(error.message || error.toString());
  const record = toObjectRecord(error);
  if (!record) return '';
  const errors = Array.isArray(record.errors) ? record.errors : [];
  const first = toObjectRecord(errors[0]);
  return normalizeErrorText(
    readRecordText(first || record, 'longMessage', 'message', 'error_description', 'msg', 'error')
  );
}

function formatAuthError(error: unknown, fallback: string) {
  if (error instanceof CloudflareApiError) return cloudflareApiErrorMessage(error, fallback);
  const raw = extractErrorText(error);
  const message = raw.toLowerCase();
  if (/invalid.*(credential|password)|incorrect|identifier/.test(message)) {
    return '邮箱或密码不正确，请检查后重试。';
  }
  if (/already.*(registered|exists)|taken/.test(message)) return '该邮箱已经注册，请直接登录。';
  if (/verification|verify|code|token/.test(message)) return '验证码无效或已过期，请重新发送。';
  if (/rate.?limit|too many/.test(message)) return '操作太频繁了，请稍等一会儿再试。';
  if (/network|fetch|timeout|unavailable|service/.test(message)) return '登录服务暂时不可用，请稍后再试。';
  return clerkErrorMessage(error, raw || fallback);
}

function buildAnonymousSession(existing?: UserSession | null) {
  return {
    loggedIn: true,
    authProvider: 'anonymous' as const,
    profile: normalizeProfile(existing?.profile),
    userId: null,
    email: '',
    phone: ''
  };
}

function buildMemberSession(
  user: ClerkUser,
  provider: Exclude<AuthProviderType, 'anonymous'>,
  profileRow?: ClerkProfileRow | null,
  existing?: UserSession | null
) {
  const nextProfile = normalizeProfile({
    ...(existing?.profile || {}),
    ...extractProfileMetadata(user.publicMetadata),
    ...extractProfileRow(profileRow)
  });
  return {
    loggedIn: true,
    authProvider: provider,
    profile: nextProfile,
    // The Worker APIs are keyed by the D1 business user id, returned by
    // /v1/me/profile after Clerk identity bootstrap.
    userId: String(profileRow?.id || '').trim() || null,
    email: primaryEmail(user),
    phone: user.phoneNumbers?.[0]?.phoneNumber || ''
  } satisfies UserSession;
}

export function getUserSession(): UserSession | null {
  if (!canUseBrowserStorage()) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserSession>;
    const authProvider = normalizeProvider(parsed.authProvider);
    if (!parsed.loggedIn || !authProvider) return null;
    return {
      loggedIn: true,
      authProvider,
      profile: normalizeProfile(parsed.profile),
      userId: typeof parsed.userId === 'string' ? parsed.userId : null,
      email: typeof parsed.email === 'string' ? parsed.email : '',
      phone: typeof parsed.phone === 'string' ? parsed.phone : ''
    };
  } catch {
    return null;
  }
}

function writeUserSession(session: UserSession | null) {
  if (!canUseBrowserStorage()) return;
  if (session) window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  else window.localStorage.removeItem(SESSION_STORAGE_KEY);
  emitSessionUpdate();
}

async function readCloudflareProfile() {
  return cloudflareRequest<ClerkProfileRow | null>('/v1/me/profile', {}, true);
}

async function persistClerkSession(
  clerk: ClerkInstance,
  provider: Exclude<AuthProviderType, 'anonymous'>
) {
  const user = clerk.user || clerk.session?.user;
  if (!user) throw new Error('当前登录状态无效，请重新登录。');
  let profile: ClerkProfileRow | null;
  try {
    // Profile is a read path. Bootstrapping on every page load used to turn a
    // harmless session hydration into a D1 write and made quota incidents much
    // worse. Only provision an identity when the API explicitly asks for it.
    profile = await readCloudflareProfile();
  } catch (error) {
    if (!(error instanceof CloudflareApiError) || error.status !== 403 ||
      !['IDENTITY_MAPPING_REQUIRED', 'EMAIL_VERIFICATION_REQUIRED'].includes(error.code || '')) {
      throw error;
    }
    await bootstrapCloudflareIdentity();
    profile = await readCloudflareProfile();
  }
  const next = buildMemberSession(user, provider, profile, getUserSession());
  if (!next.userId) throw new Error('账号资料还在初始化，请稍后刷新页面。');
  writeUserSession(next);
  markSessionHydrated();
  return next;
}

export async function hydrateCloudflareSession() {
  if (hydrateInFlight) return hydrateInFlight;

  const current = getUserSession();
  if (Date.now() < quotaBlockedUntil) return current;
  hydrateInFlight = (async () => {
    try {
      const clerk = await getClerk();
      if (!clerk.session || !clerk.user) {
        if (current?.authProvider === 'anonymous') return current;
        writeUserSession(null);
        return null;
      }
      if (current?.userId && current.authProvider !== 'anonymous' && wasSessionHydratedRecently()) {
        return current;
      }
      const provider = current?.authProvider === 'otp' ? 'otp' : 'password';
      return await persistClerkSession(clerk, provider);
    } catch (error) {
      // Quota and network failures must not erase a valid local session. The
      // next explicit login or refresh can retry once the service recovers.
      if (isCloudflareQuotaError(error)) {
        quotaBlockedUntil = Date.now() + 5 * 60_000;
        if (Date.now() - lastQuotaLogAt > 60_000) {
          lastQuotaLogAt = Date.now();
          console.warn('[Seekoffer][auth] D1 quota reached; hydration is paused temporarily.');
        }
      } else {
        console.error('[Seekoffer][auth] hydrateCloudflareSession failed', error);
      }
      return current;
    } finally {
      hydrateInFlight = null;
    }
  })();
  return hydrateInFlight;
}

function ensureEmailIdentifier(value: string) {
  const identifier = normalizeIdentifier(value);
  if (!isEmailIdentifier(identifier)) throw new Error('请输入正确的邮箱地址。');
  return identifier;
}

async function activateCreatedSession(clerk: ClerkInstance, sessionId?: string | null) {
  if (!sessionId) throw new Error('认证服务没有返回有效会话，请重试。');
  await clerk.setActive({ session: sessionId });
}

export async function signInWithPasswordAccount(payload: CredentialsPayload) {
  const identifier = ensureEmailIdentifier(payload.identifier);
  try {
    const clerk = await getClerk();
    const activeEmail = primaryEmail(clerk.user);
    if (clerk.session && clerk.user) {
      if (activeEmail && activeEmail.toLowerCase() === identifier.toLowerCase()) {
        // Clerk rejects a second sign-in attempt while the same session is
        // active. Reuse it and only reconcile the D1 profile.
        return await persistClerkSession(clerk, 'password');
      }
      // The login form is explicitly asking for another account. Clear the
      // stale session before creating the requested one.
      await clerk.signOut();
    }
    const result = await clerk.client.signIn.create({ identifier, password: payload.password });
    if (result.status !== 'complete') throw new Error('邮箱或密码不正确，请检查后重试。');
    await activateCreatedSession(clerk, result.createdSessionId);
    return await persistClerkSession(clerk, 'password');
  } catch (error) {
    console.error('[Seekoffer][auth] signInWithPasswordAccount failed', error);
    if (isCloudflareQuotaError(error)) {
      throw new Error('今日数据服务额度已用尽，登录资料已保留，请稍后重试。');
    }
    throw new Error(formatAuthError(error, '密码登录暂时不可用，请稍后重试。'));
  }
}

export async function signUpWithPasswordAccount(payload: CredentialsPayload): Promise<PasswordSignUpResult> {
  const identifier = ensureEmailIdentifier(payload.identifier);
  try {
    const clerk = await getClerk();
    const result = await clerk.client.signUp.create({
      emailAddress: identifier,
      password: payload.password
    });
    if (result.status === 'complete') {
      await activateCreatedSession(clerk, result.createdSessionId);
      return { status: 'signed_in', session: await persistClerkSession(clerk, 'password') };
    }
    pendingSignUp = { email: identifier, password: payload.password };
    await clerk.client.signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    return {
      status: 'pending_confirmation',
      message: '注册验证码已发送，请输入邮件里的 6 位数字完成注册。'
    };
  } catch (error) {
    console.error('[Seekoffer][auth] signUpWithPasswordAccount failed', error);
    throw new Error(formatAuthError(error, '注册失败，请稍后再试。'));
  }
}

export async function resendSignupConfirmationCode(email: string) {
  const normalizedEmail = ensureEmailIdentifier(email);
  try {
    const clerk = await getClerk();
    if (!pendingSignUp || pendingSignUp.email !== normalizedEmail) {
      throw new Error('注册流程已过期，请重新填写注册信息。');
    }
    await clerk.client.signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
  } catch (error) {
    console.error('[Seekoffer][auth] resendSignupConfirmationCode failed', error);
    throw new Error(formatAuthError(error, '注册验证码发送失败，请稍后重试。'));
  }
}

export async function verifySignupConfirmationCode(email: string, token: string) {
  const normalizedEmail = ensureEmailIdentifier(email);
  if (!token.trim()) throw new Error('请先输入注册邮件中的 6 位验证码。');
  try {
    const clerk = await getClerk();
    if (!pendingSignUp || pendingSignUp.email !== normalizedEmail) {
      throw new Error('注册流程已过期，请重新填写注册信息。');
    }
    const result = await clerk.client.signUp.attemptEmailAddressVerification({ code: token.trim() });
    if (result.status !== 'complete') throw new Error('验证码无效或已过期，请重新发送。');
    await activateCreatedSession(clerk, result.createdSessionId);
    pendingSignUp = null;
    return await persistClerkSession(clerk, 'password');
  } catch (error) {
    console.error('[Seekoffer][auth] verifySignupConfirmationCode failed', error);
    throw new Error(formatAuthError(error, '注册验证码校验失败，请重新发送后再试。'));
  }
}

export async function sendPasswordResetEmail(email: string) {
  // Keep the existing dialog simple: Clerk's email-code first factor gives the
  // user an immediate way back into the account without a second reset page.
  await sendEmailLoginCode(email, { shouldCreateUser: false });
}

export async function sendEmailLoginCode(email: string, options: EmailLoginCodeOptions = {}) {
  const normalizedEmail = ensureEmailIdentifier(email);
  void options;
  try {
    const clerk = await getClerk();
    const result = await clerk.client.signIn.create({ identifier: normalizedEmail });
    await result.prepareFirstFactor({ strategy: 'email_code' });
  } catch (error) {
    console.error('[Seekoffer][auth] sendEmailLoginCode failed', error);
    throw new Error(formatAuthError(error, '验证码发送失败，请稍后重试。'));
  }
}

export async function verifyEmailLoginCode(email: string, token: string) {
  ensureEmailIdentifier(email);
  if (!token.trim()) throw new Error('请先输入邮箱验证码。');
  try {
    const clerk = await getClerk();
    const result = await clerk.client.signIn.attemptFirstFactor({
      strategy: 'email_code',
      code: token.trim()
    });
    if (result.status !== 'complete') throw new Error('验证码无效或已过期，请重新发送。');
    await activateCreatedSession(clerk, result.createdSessionId);
    return await persistClerkSession(clerk, 'otp');
  } catch (error) {
    console.error('[Seekoffer][auth] verifyEmailLoginCode failed', error);
    throw new Error(formatAuthError(error, '验证码校验失败，请重新发送后再试。'));
  }
}

export async function signInAsGuest() {
  const nextSession = buildAnonymousSession(getUserSession());
  writeUserSession(nextSession);
  return nextSession;
}

export async function signOutUser() {
  try {
    const clerk = await getClerk();
    await clerk.signOut();
  } catch {
    // A local session must still be cleared if the Clerk network is unavailable.
  }
  pendingSignUp = null;
  clearSessionHydrationMarker();
  writeUserSession(null);
}

export function updateUserProfile(patch: Partial<UserProfile>) {
  const current = getUserSession();
  if (!current) return null;
  const next = {
    ...current,
    profile: normalizeProfile({ ...current.profile, ...patch })
  } satisfies UserSession;
  writeUserSession(next);
  return next;
}

export function watchUserSession(callback: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  const handler = () => callback();
  window.addEventListener(SESSION_EVENT_NAME, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(SESSION_EVENT_NAME, handler);
    window.removeEventListener('storage', handler);
  };
}

export function watchCloudflareAuthState(callback: (event?: string) => void) {
  if (typeof window === 'undefined') return () => undefined;
  let dispose: (() => void) | undefined;
  let cancelled = false;
  let lastIdentity = '';
  let timer: number | undefined;
  void getClerk()
    .then((clerk) => {
      if (cancelled || !clerk.addListener) return;
      dispose = clerk.addListener(() => {
        const identity = `${clerk.session?.id || ''}:${clerk.user?.id || ''}`;
        if (identity === lastIdentity) return;
        lastIdentity = identity;
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          void hydrateCloudflareSession().finally(() => callback('session_changed'));
        }, 250);
      });
    })
    .catch(() => undefined);
  return () => {
    cancelled = true;
    if (timer) window.clearTimeout(timer);
    dispose?.();
  };
}
