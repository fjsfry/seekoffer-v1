'use client';

import { invoke } from '@tauri-apps/api/core';
import type { ClerkBrowser } from './clerk-d1-session';
import { nativeAuthError, requiresNativeReauthentication, setDesktopAuthState } from './desktop-auth-state';

type NativeSession = { accessToken: string; expiresAt: number; subject: string; email: string; sessionId: string };
let snapshot: NativeSession | null = null;
let generation = 0;
let loading: Promise<ClerkBrowser> | null = null;
const listeners = new Set<() => void>();
const event = 'seekoffer-native-auth-changed';
const browser: ClerkBrowser = {
  load: async () => {}, session: null, user: null,
  addListener(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  signOut: async () => signOutNativeSession()
};

function update(value: NativeSession | null, notifyIdentity = true) {
  const old = snapshot?.sessionId;
  snapshot = value;
  browser.user = value ? { id: value.subject, primaryEmailAddress: { emailAddress: value.email } } : null;
  browser.session = value ? {
    id: value.sessionId,
    getToken: async () => {
      const revision = generation;
      const current = await readSession();
      if (revision !== generation || (current && current.sessionId !== value.sessionId)) {
        throw nativeAuthError('NATIVE_SESSION_CHANGED');
      }
      if (!current) {
        if (revision === generation && !current) {
          update(null, false);
          setDesktopAuthState('reauth-required', nativeAuthError('NATIVE_LOGIN_EXPIRED').message);
        }
        throw nativeAuthError('NATIVE_LOGIN_EXPIRED');
      }
      snapshot = current;
      return current.accessToken;
    }
  } : null;
  if (notifyIdentity && old !== value?.sessionId) {
    listeners.forEach(fn => fn());
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(event));
  }
}

async function readSession(): Promise<NativeSession | null> {
  const revision = generation;
  try { return await invoke<NativeSession | null>('native_auth_session'); }
  catch (raw) {
    const error = nativeAuthError(raw);
    if (revision !== generation) throw nativeAuthError('NATIVE_SESSION_CHANGED');
    if (requiresNativeReauthentication(error)) {
      // Expiration suspends cloud access, but does not sign out the cached owner.
      update(null, false);
      setDesktopAuthState('reauth-required', error.message);
    } else setDesktopAuthState('offline', error.message);
    throw error;
  }
}

export function getNativeClerkBrowser(): ClerkBrowser { return browser; }

export function loadNativeClerkBrowser(): Promise<ClerkBrowser> {
  if (loading) return loading;
  const revision = generation;
  const task = readSession().then(current => {
    if (revision === generation) update(current, false);
    return browser;
  }).finally(() => { if (loading === task) loading = null; });
  loading = task;
  return task;
}

export async function signOutNativeSession() {
  // Never hydrate/refresh an expired credential as a prerequisite to removing it.
  generation += 1;
  loading = null;
  await invoke('native_auth_sign_out');
  update(null);
  setDesktopAuthState('signed-out');
}

export async function startNativeLogin() {
  const revision = generation;
  try {
    const value = await invoke<NativeSession>('native_auth_login');
    if (revision !== generation) throw nativeAuthError('NATIVE_LOGIN_CANCELLED');
    generation += 1;
    loading = null;
    update(value);
    setDesktopAuthState('ready');
  } catch (error) { throw nativeAuthError(error); }
}

export async function nativePublicRequest(path: string, options: { method?: string; body?: unknown } = {}) {
  return invoke<unknown>('native_public_request', { path, method: options.method || 'GET', body: options.body ?? null });
}
