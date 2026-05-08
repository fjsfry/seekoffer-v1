'use client';

import type { AdminRole } from './admin-data';
import { invokeAdminApi, isAdminApiConfigured } from './admin-api';
import { getSupabaseBrowserClient } from './supabase-browser';

export type AdminSession = {
  email: string;
  name: string;
  role: AdminRole;
};

const ADMIN_SESSION_KEY = 'seekoffer-admin-session';
const ADMIN_EVENT_NAME = 'seekoffer-admin-session-updated';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function emitAdminSessionUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ADMIN_EVENT_NAME));
  }
}

export function getAdminSession(): AdminSession | null {
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

function writeAdminSession(session: AdminSession | null) {
  if (!canUseStorage()) {
    return;
  }

  if (session) {
    window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
  }

  emitAdminSessionUpdate();
}

export async function signInAdmin(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!isAdminApiConfigured()) {
    throw new Error('后台真实 API 未配置，已禁止使用前端演示账号登录。');
  }

  const supabase = getSupabaseBrowserClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password
  });

  if (signInError) {
    throw new Error(signInError.message || '管理员账号或密码不正确。');
  }

  const session = await refreshAdminSession();
  if (!session) {
    await supabase.auth.signOut().catch(() => undefined);
    throw new Error('管理员权限校验未通过。');
  }

  return session;
}

export async function refreshAdminSession() {
  if (!isAdminApiConfigured()) {
    writeAdminSession(null);
    return null;
  }

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
      role: admin.role
    };

    writeAdminSession(session);
    return session;
  } catch {
    writeAdminSession(null);
    return null;
  }
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
