'use client';

import { getCloudbaseApp } from './cloudbase-web';

export type UserProfile = {
  nickname: string;
  age: string;
  undergraduateSchool: string;
  major: string;
  grade: string;
  targetMajor: string;
  targetRegion: string;
};

export type AuthProviderType = 'wechat' | 'password' | 'anonymous';

export type UserSession = {
  loggedIn: boolean;
  authProvider: AuthProviderType;
  profile: UserProfile;
};

type CredentialsPayload = {
  username: string;
  password: string;
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
  if (provider === 'password' || provider === 'anonymous') {
    return provider;
  }

  return 'wechat';
}

function isAnonymousCloudUser(user: Record<string, any> | null | undefined) {
  if (!user) {
    return true;
  }

  return Boolean(user.is_anonymous) || user.name === 'anonymous' || user.loginType === 'ANONYMOUS';
}

function extractCloudNickname(userInfo: Record<string, any> | null | undefined) {
  if (!userInfo) {
    return '';
  }

  return (
    userInfo.nickName ||
    userInfo.nickname ||
    userInfo.name ||
    userInfo.username ||
    userInfo.email ||
    userInfo.phone_number ||
    userInfo.user_metadata?.nickName ||
    userInfo.user_metadata?.nickname ||
    userInfo.user_metadata?.name ||
    ''
  );
}

async function resolveCloudUserInfo(auth: Record<string, any>) {
  if (typeof auth.getUserInfo === 'function') {
    const userInfo = await auth.getUserInfo();
    if (userInfo) {
      return userInfo as Record<string, any>;
    }
  }

  if (typeof auth.getUser === 'function') {
    const result = await auth.getUser();
    const user = result?.data?.user || result?.user;
    if (user) {
      return user as Record<string, any>;
    }
  }

  return null;
}

function normalizeErrorText(raw: string) {
  return raw.replace(/\s+/g, ' ').trim();
}

function extractErrorText(error: unknown): string {
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
    const record = error as Record<string, any>;
    const nested = record.error_description || record.message || record.msg || record.error;

    if (typeof nested === 'string') {
      return normalizeErrorText(nested);
    }

    try {
      return normalizeErrorText(JSON.stringify(record));
    } catch {
      return '';
    }
  }

  return '';
}

function formatAuthError(error: unknown, fallback: string) {
  const message = extractErrorText(error);

  if (!message) {
    return fallback;
  }

  if (/publishable|access.?key|api.?key/i.test(message)) {
    return '网页登录配置未完成：缺少 CloudBase Publishable Key。';
  }

  if (/domain|origin|security|forbidden|illegal|非法来源/i.test(message)) {
    return '当前访问域名还没有加入 CloudBase 安全来源，请稍等配置生效或检查控制台域名配置。';
  }

  if (/provider|oauth|wx_open|not support/i.test(message)) {
    return 'CloudBase 登录方式尚未完全就绪，请检查微信开放平台登录和网页回调配置。';
  }

  return message;
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
      profile: normalizeProfile(parsed.profile)
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

function persistCloudSession(userInfo: Record<string, any> | null | undefined, provider: AuthProviderType) {
  const current = getUserSession();
  const next: UserSession = {
    loggedIn: true,
    authProvider: provider,
    profile: normalizeProfile({
      ...(current?.profile || {}),
      nickname: extractCloudNickname(userInfo) || current?.profile.nickname || ''
    })
  };

  writeUserSession(next);
  return next;
}

async function getAuthInstance() {
  const app = await getCloudbaseApp();
  return app.auth({ persistence: 'local' });
}

export async function hydrateCloudbaseSession() {
  if (!canUseBrowserStorage()) {
    return getUserSession();
  }

  try {
    const auth = await getAuthInstance();
    const loginState = await auth.getLoginState();
    const cloudUser = loginState?.user as Record<string, any> | undefined;

    if (!cloudUser) {
      return getUserSession();
    }

    if (isAnonymousCloudUser(cloudUser)) {
      const current = getUserSession();
      return current?.authProvider === 'anonymous' ? current : getUserSession();
    }

    const userInfo = await resolveCloudUserInfo(auth);
    const current = getUserSession();
    return persistCloudSession(userInfo, current?.authProvider === 'password' ? 'password' : 'wechat');
  } catch (error) {
    console.error('[Seekoffer][auth] hydrateCloudbaseSession failed', error);
    return getUserSession();
  }
}

export async function signInWithWechat() {
  const auth = await getAuthInstance();

  try {
    if (typeof auth.signInWithOAuth === 'function') {
      for (const provider of ['wechat', 'wx_open']) {
        try {
          const oauthResult = await auth.signInWithOAuth({ provider });
          const oauthError = oauthResult?.error;

          if (oauthError) {
            throw oauthError;
          }

          const redirectUrl = oauthResult?.data?.url || oauthResult?.url;
          if (redirectUrl && typeof window !== 'undefined') {
            window.location.assign(redirectUrl);
            return null;
          }
        } catch (providerError) {
          if (provider === 'wx_open') {
            throw providerError;
          }
        }
      }
    }

    if (typeof auth.signInWithWechat === 'function') {
      await auth.signInWithWechat();
      const userInfo = await resolveCloudUserInfo(auth);
      return persistCloudSession(userInfo, 'wechat');
    }

    if (typeof auth.toDefaultLoginPage === 'function') {
      const result = await auth.toDefaultLoginPage();
      const loginError = result?.error;

      if (loginError) {
        throw loginError;
      }

      return null;
    }

    throw new Error('当前环境尚未开启网页微信登录。');
  } catch (error) {
    console.error('[Seekoffer][auth] signInWithWechat failed', error);
    throw new Error(formatAuthError(error, '微信登录暂时不可用，请稍后重试。'));
  }
}

export async function signInWithPasswordAccount(payload: CredentialsPayload) {
  const auth = await getAuthInstance();

  try {
    await auth.signInWithPassword({
      username: payload.username,
      password: payload.password
    });

    const userInfo = await resolveCloudUserInfo(auth);
    return persistCloudSession(userInfo, 'password');
  } catch (error) {
    console.error('[Seekoffer][auth] signInWithPasswordAccount failed', error);
    throw new Error(formatAuthError(error, '用户名或密码登录失败，请稍后重试。'));
  }
}

export async function signUpWithPasswordAccount(payload: CredentialsPayload) {
  const auth = await getAuthInstance();

  try {
    await auth.signUp({
      username: payload.username,
      password: payload.password,
      nickname: payload.username
    });

    return signInWithPasswordAccount(payload);
  } catch (error) {
    console.error('[Seekoffer][auth] signUpWithPasswordAccount failed', error);
    throw new Error(formatAuthError(error, '用户名注册失败，请稍后重试。'));
  }
}

export async function signInAsGuest() {
  const auth = await getAuthInstance();

  try {
    if (typeof auth.signInAnonymously === 'function') {
      await auth.signInAnonymously({});
    } else if (typeof auth.anonymousAuthProvider === 'function') {
      await auth.anonymousAuthProvider().signIn();
    } else {
      throw new Error('当前环境未开启匿名登录。');
    }

    const userInfo = await resolveCloudUserInfo(auth);
    return persistCloudSession(userInfo, 'anonymous');
  } catch (error) {
    console.error('[Seekoffer][auth] signInAsGuest failed', error);
    throw new Error(formatAuthError(error, '匿名试用暂时不可用，请稍后重试。'));
  }
}

export async function openCloudbaseLoginPage() {
  const auth = await getAuthInstance();

  try {
    if (typeof auth.toDefaultLoginPage !== 'function') {
      throw new Error('当前环境尚未提供 CloudBase 默认登录页。');
    }

    const result = await auth.toDefaultLoginPage();
    const loginError = result?.error;

    if (loginError) {
      throw loginError;
    }
  } catch (error) {
    console.error('[Seekoffer][auth] openCloudbaseLoginPage failed', error);
    throw new Error(formatAuthError(error, '更多登录方式暂时不可用，请稍后重试。'));
  }
}

export async function signOutUser() {
  try {
    const auth = await getAuthInstance();
    await auth.signOut();
    if (typeof auth.anonymousAuthProvider === 'function') {
      await auth.anonymousAuthProvider().signIn();
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
