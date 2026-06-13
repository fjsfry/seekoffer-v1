'use client';

import type { AdminRole } from './admin-data';
import { invokeAdminApi, isAdminApiConfigured } from './admin-api';
import { getSupabaseBrowserClient } from './supabase-browser';

export type AdminSession = {
  email: string;
  name: string;
  role: AdminRole;
  verifiedAt?: number;
};

const ADMIN_SESSION_KEY = 'seekoffer-admin-session';
const ADMIN_EVENT_NAME = 'seekoffer-admin-session-updated';
const ADMIN_SESSION_TTL_MS = 5 * 60 * 1000;
let refreshInFlight: Promise<AdminSession | null> | null = null;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function emitAdminSessionUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ADMIN_EVENT_NAME));
  }
}

export function getAdminSession(): AdminSession | null {
  return readAdminSessionFromStorage();
}

function readAdminSessionFromStorage(): AdminSession | null {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as AdminSession;
    if (!parsed?.email || !parsed?.role) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function getFreshAdminSession() {
  const session = readAdminSessionFromStorage();
  if (!session?.verifiedAt) {
    return null;
  }

  if (Date.now() - session.verifiedAt > ADMIN_SESSION_TTL_MS) {
    return null;
  }

  return session;
}

function isSameAdminSession(left: AdminSession | null, right: AdminSession | null) {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.email === right.email && left.name === right.name && left.role === right.role;
}

function writeAdminSession(session: AdminSession | null) {
  if (!canUseStorage()) {
    return;
  }

  const previous = readAdminSessionFromStorage();
  if (session) {
    window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
  }

  if (!isSameAdminSession(previous, session)) {
    emitAdminSessionUpdate();
  }
}

export async function signInAdmin(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!isAdminApiConfigured()) {
    throw new Error('当前无法完成登录，请稍后再试或联系管理员。');
  }

  const supabase = getSupabaseBrowserClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password
  });

  if (signInError) {
    throw new Error('管理员账号或密码不正确。');
  }

  const session = await refreshAdminSession({ force: true });
  if (!session) {
    await supabase.auth.signOut().catch(() => undefined);
    throw new Error('当前账号没有后台访问权限。');
  }

  return session;
}

export async function refreshAdminSession(options: { force?: boolean } = {}) {
  if (!isAdminApiConfigured()) {
    writeAdminSession(null);
    return null;
  }

  if (!options.force) {
    const cachedSession = getFreshAdminSession();
    if (cachedSession) {
      return cachedSession;
    }
  }

  if (!options.force && refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const { admin } = await invokeAdminApi<{
        admin: {
          email: string;
          name: string;
          role: AdminRole;
        };
      }>({ resource: 'me' });

      const session: AdminSession = {
        email: admin.email,
        name: admin.name || admin.email,
        role: admin.role,
        verifiedAt: Date.now()
      };

      writeAdminSession(session);
      return session;
    } catch {
      writeAdminSession(null);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export function signOutAdmin() {
  if (isAdminApiConfigured()) {
    getSupabaseBrowserClient().auth.signOut().catch(() => undefined);
  }

  writeAdminSession(null);
}

export function watchAdminSession(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handler = () => callback();
  window.addEventListener('storage', handler);
  window.addEventListener(ADMIN_EVENT_NAME, handler as EventListener);

  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(ADMIN_EVENT_NAME, handler as EventListener);
  };
}
