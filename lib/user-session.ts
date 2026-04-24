'use client';

import type { AuthChangeEvent } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from './supabase-browser';
import { SEEKOFFER_SITE_URL, SUPABASE_ENABLE_PHONE_AUTH, isSupabaseConfigured } from './supabase-env';

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

const defaultProfile: UserProfile = {
  nickname: '',
  age: '',
  undergraduateSchool: '',
  major: '',
  grade: '大四',
  targetMajor: '',
  targetRegion: ''
};

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function emitSessionUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_EVENT_NAME));
  }
}

function normalizeProfile(profile?: Partial<UserProfile>) {
  return {
    ...defaultProfile,
    ...(profile || {})
  };
}

function normalizeProvider(provider?: unknown): AuthProviderType {
  if (provider === 'otp' || provider === 'anonymous') {
    return provider;
  }

  return 'password';
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
  if (!trimmed || isEmailIdentifier(trimmed)) {
    return false;
  }

  if (!/^[+\d\s\-()]+$/.test(trimmed)) {
    return false;
  }

  const normalized = normalizePhoneIdentifier(value);
  return /^\+?\d{6,15}$/.test(normalized);
}

function normalizeIdentifier(value: string) {
  const trimmed = value.trim();
  if (isEmailIdentifier(trimmed)) {
    return normalizeEmailIdentifier(trimmed);
  }

  return isPhoneIdentifier(trimmed) ? normalizePhoneIdentifier(trimmed) : trimmed.toLowerCase();
}

function readRecordText(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }

    if (typeof value === 'number') {
      return String(value);
    }
  }

  return '';
}

function toObjectRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function extractProfileMetadata(metadata?: Record<string, unknown> | null) {
  if (!metadata) {
    return {};
  }

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

export function getAuthProviderLabel(provider: AuthProviderType) {
  if (provider === 'otp') {
    return '邮箱验证码';
  }

  if (provider === 'anonymous') {
    return '本地试用';
  }

  return '密码登录';
}

export function isLoggedInSession(session: UserSession | null | undefined) {
  return Boolean(session?.loggedIn);
}

export function isMemberSession(session: UserSession | null | undefined) {
  return Boolean(session?.loggedIn && session.authProvider !== 'anonymous');
}

export function satisfiesAuthRequirement(
  session: UserSession | null | undefined,
  requirement: AuthRequirement = 'session'
) {
  if (requirement === 'member') {
    return isMemberSession(session);
  }

  return isLoggedInSession(session);
}

function normalizeErrorText(raw: string) {
  return raw.replace(/\s+/g, ' ').trim();
}

function extractErrorText(error: unknown) {
  if (!error) {
    return '';
  }

  if (typeof error === 'string') {
    return normalizeErrorText(error);
  }

  if (error instanceof Error) {
    return normalizeErrorText(error.message || error.toString());
  }

  if (typeof error === 'object') {
    const record = toObjectRecord(error);
    if (record) {
      const nested = readRecordText(record, 'error_description', 'message', 'msg', 'error');
      if (nested) {
        return normalizeErrorText(nested);
      }
    }
  }

  return '';
}

function formatAuthError(error: unknown, fallback: string) {
  const message = extractErrorText(error).toLowerCase();
  if (!message) {
    return fallback;
  }

  if (/supabase|environment variables|missing/.test(message)) {
    return '网页登录配置未完成：缺少 Supabase 环境变量。';
  }

  if (/invalid login credentials|invalid_credentials/.test(message)) {
    return '账号或密码不正确，请检查后重试。';
  }

  if (/email not confirmed|email_not_confirmed/.test(message)) {
    return '邮箱还未完成验证，请先打开验证邮件。';
  }

  if (/password should be at least/.test(message)) {
    return '密码长度不够，请至少使用 6 位。';
  }

  if (
    /phone provider is not configured|unsupported phone provider|phone logins are disabled|phone signups are disabled/.test(
      message
    )
  ) {
    return '当前还没有配置短信服务，手机号登录暂时不可用。';
  }

  if (/user already registered|already been registered/.test(message)) {
    return '该账号已经注册，可以直接登录。';
  }

  if (/otp|token/.test(message)) {
    return '验证码无效或已过期，请重新发送。';
  }

  return extractErrorText(error) || fallback;
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

function ensurePasswordIdentifierSupported(identifier: string) {
  if (isPhoneIdentifier(identifier) && !SUPABASE_ENABLE_PHONE_AUTH) {
    throw new Error('当前暂未开放手机号登录，请先使用邮箱注册，或改用邮箱验证码登录。');
  }
}

function buildMemberSession(user: {
  id: string;
  email?: string | null;
  phone?: string | null;
  user_metadata?: Record<string, unknown> | null;
}, provider: AuthProviderType, existing?: UserSession | null) {
  const metadataProfile = extractProfileMetadata(user.user_metadata);

  return {
    loggedIn: true,
    authProvider: provider,
    profile: normalizeProfile({
      ...(existing?.profile || {}),
      ...metadataProfile
    }),
    userId: user.id,
    email: user.email || existing?.email || '',
    phone: user.phone || existing?.phone || ''
  } satisfies UserSession;
}

export function getUserSession(): UserSession | null {
  if (!canUseBrowserStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<UserSession>;
    if (!parsed || !parsed.loggedIn) {
      return null;
    }

    return {
      loggedIn: true,
      authProvider: normalizeProvider(parsed.authProvider),
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
  if (!canUseBrowserStorage()) {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } else {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  emitSessionUpdate();
}

async function getSupabaseUser() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user;
}

export async function hydrateSupabaseSession() {
  const current = getUserSession();

  if (!isSupabaseConfigured()) {
    return current;
  }

  try {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      if (current?.authProvider === 'anonymous') {
        return current;
      }

      writeUserSession(null);
      return null;
    }

    const user = await getSupabaseUser();
    if (!user) {
      writeUserSession(null);
      return null;
    }

    const provider = current?.authProvider === 'otp' ? 'otp' : 'password';
    const nextSession = buildMemberSession(user, provider, current);
    writeUserSession(nextSession);
    return nextSession;
  } catch (error) {
    console.error('[Seekoffer][auth] hydrateSupabaseSession failed', error);
    return current;
  }
}

async function persistMemberSession(provider: AuthProviderType) {
  const current = getUserSession();
  const user = await getSupabaseUser();
  if (!user) {
    throw new Error('当前登录状态无效，请重新登录。');
  }

  const nextSession = buildMemberSession(user, provider, current);
  writeUserSession(nextSession);
  return nextSession;
}

export async function signInWithPasswordAccount(payload: CredentialsPayload) {
  if (!isSupabaseConfigured()) {
    throw new Error('网页登录配置未完成：缺少 Supabase 环境变量。');
  }

  const identifier = normalizeIdentifier(payload.identifier);
  ensurePasswordIdentifierSupported(identifier);
  const supabase = getSupabaseBrowserClient();

  try {
    const credentials = isPhoneIdentifier(identifier)
      ? { phone: normalizePhoneIdentifier(identifier), password: payload.password }
      : { email: identifier, password: payload.password };

    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) {
      throw error;
    }

    return persistMemberSession('password');
  } catch (error) {
    console.error('[Seekoffer][auth] signInWithPasswordAccount failed', error);
    throw new Error(formatAuthError(error, '密码登录暂时不可用，请稍后重试。'));
  }
}

export async function signUpWithPasswordAccount(payload: CredentialsPayload): Promise<PasswordSignUpResult> {
  if (!isSupabaseConfigured()) {
    throw new Error('网页登录配置未完成：缺少 Supabase 环境变量。');
  }

  const identifier = normalizeIdentifier(payload.identifier);
  ensurePasswordIdentifierSupported(identifier);
  const nicknameSeed = isEmailIdentifier(identifier)
    ? identifier.split('@')[0]
    : normalizePhoneIdentifier(identifier).slice(-4);

  const supabase = getSupabaseBrowserClient();

  try {
    const credentials = isPhoneIdentifier(identifier)
      ? {
          phone: normalizePhoneIdentifier(identifier),
          password: payload.password,
          options: {
            data: {
              nickname: nicknameSeed
            }
          }
        }
      : {
          email: identifier,
          password: payload.password,
          options: {
            emailRedirectTo: SEEKOFFER_SITE_URL,
            data: {
              nickname: nicknameSeed
            }
          }
        };

    const { data, error } = await supabase.auth.signUp(credentials);
    if (error) {
      throw error;
    }

    if (data.session) {
      const session = await persistMemberSession('password');
      return {
        status: 'signed_in',
        session
      };
    }

    return {
      status: 'pending_confirmation',
      message: isPhoneIdentifier(identifier)
        ? '注册成功，请使用短信验证码完成后续验证。'
        : '注册成功，请先打开邮箱中的验证邮件，再回来登录。'
    };
  } catch (error) {
    console.error('[Seekoffer][auth] signUpWithPasswordAccount failed', error);
    throw new Error(formatAuthError(error, '注册失败，请稍后再试。'));
  }
}

export async function sendEmailLoginCode(email: string) {
  if (!isSupabaseConfigured()) {
    throw new Error('网页登录配置未完成：缺少 Supabase 环境变量。');
  }

  const normalizedEmail = normalizeEmailIdentifier(email);
  if (!isEmailIdentifier(normalizedEmail)) {
    throw new Error('请输入正确的邮箱地址。');
  }

  const supabase = getSupabaseBrowserClient();

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: SEEKOFFER_SITE_URL,
        shouldCreateUser: true
      }
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('[Seekoffer][auth] sendEmailLoginCode failed', error);
    throw new Error(formatAuthError(error, '验证码发送失败，请稍后重试。'));
  }
}

export async function verifyEmailLoginCode(email: string, token: string) {
  if (!isSupabaseConfigured()) {
    throw new Error('网页登录配置未完成：缺少 Supabase 环境变量。');
  }

  const normalizedEmail = normalizeEmailIdentifier(email);
  const normalizedToken = token.trim();
  if (!isEmailIdentifier(normalizedEmail)) {
    throw new Error('请输入正确的邮箱地址。');
  }

  if (!normalizedToken) {
    throw new Error('请先输入邮箱验证码。');
  }

  const supabase = getSupabaseBrowserClient();

  try {
    const { error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedToken,
      type: 'email'
    });

    if (error) {
      throw error;
    }

    return persistMemberSession('otp');
  } catch (error) {
    console.error('[Seekoffer][auth] verifyEmailLoginCode failed', error);
    throw new Error(formatAuthError(error, '验证码校验失败，请重新发送后再试。'));
  }
}

export async function signInAsGuest() {
  const current = getUserSession();
  const nextSession = buildAnonymousSession(current);
  writeUserSession(nextSession);
  return nextSession;
}

export async function signOutUser() {
  try {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
    }
  } catch {
    // Ignore and continue clearing the local session.
  }

  writeUserSession(null);
}

export function updateUserProfile(patch: Partial<UserProfile>) {
  const current = getUserSession();
  if (!current) {
    return null;
  }

  const next: UserSession = {
    ...current,
    profile: normalizeProfile({
      ...current.profile,
      ...patch
    })
  };

  writeUserSession(next);
  return next;
}

export function watchUserSession(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handler = () => callback();
  window.addEventListener(SESSION_EVENT_NAME, handler);
  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener(SESSION_EVENT_NAME, handler);
    window.removeEventListener('storage', handler);
  };
}

export function watchSupabaseAuthState(callback: (event: AuthChangeEvent) => void) {
  if (typeof window === 'undefined' || !isSupabaseConfigured()) {
    return () => undefined;
  }

  const supabase = getSupabaseBrowserClient();
  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange(async (event) => {
    await hydrateSupabaseSession();
    callback(event);
  });

  return () => {
    subscription.unsubscribe();
  };
}
