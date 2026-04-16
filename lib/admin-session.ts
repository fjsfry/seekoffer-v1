'use client';

import { adminAccounts, type AdminRole } from './admin-data';

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
  const account = adminAccounts.find(
    (item) => item.email.toLowerCase() === normalizedEmail && item.password === password
  );

  if (!account) {
    throw new Error('管理员账号或密码不正确。');
  }

  const session: AdminSession = {
    email: account.email,
    name: account.name,
    role: account.role
  };

  writeAdminSession(session);
  return session;
}

export function signOutAdmin() {
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
