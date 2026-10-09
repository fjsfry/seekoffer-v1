'use client';

import type { AuthRequirement } from './user-session';

export type AuthIntent =
  | {
      type: 'open-workspace';
      returnTo?: string;
      reason?: string;
      requiredAuth?: AuthRequirement;
    }
  | {
      type: 'add-project';
      projectId: string;
      returnTo?: string;
      reason?: string;
      requiredAuth?: AuthRequirement;
    }
  | {
      type: 'publish-offer';
      returnTo?: string;
      reason?: string;
      requiredAuth?: 'member';
    };

const AUTH_INTENT_EVENT = 'seekoffer-open-auth-modal';
const AUTH_INTENT_STORAGE_KEY = 'seekoffer-auth-intent';

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeRequiredAuth(requiredAuth?: unknown): AuthRequirement {
  return requiredAuth === 'member' ? 'member' : 'session';
}

export function openAuthModal(intent?: AuthIntent | null) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(AUTH_INTENT_EVENT, {
      detail: intent ?? null
    })
  );
}

export function watchAuthModal(callback: (intent: AuthIntent | null) => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<AuthIntent | null>;
    callback(customEvent.detail ?? null);
  };

  window.addEventListener(AUTH_INTENT_EVENT, handler as EventListener);
  return () => {
    window.removeEventListener(AUTH_INTENT_EVENT, handler as EventListener);
  };
}

export function writeAuthIntent(intent: AuthIntent | null) {
  if (!canUseBrowserStorage()) {
    return;
  }

  if (!intent) {
    window.localStorage.removeItem(AUTH_INTENT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_INTENT_STORAGE_KEY, JSON.stringify(intent));
}

export function readAuthIntent() {
  if (!canUseBrowserStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_INTENT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<AuthIntent> | null;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
      return null;
    }

    if (parsed.type === 'add-project' && typeof parsed.projectId === 'string') {
      return {
        type: 'add-project',
        projectId: parsed.projectId,
        returnTo: typeof parsed.returnTo === 'string' ? parsed.returnTo : '',
        reason: typeof parsed.reason === 'string' ? parsed.reason : '',
        requiredAuth: normalizeRequiredAuth(parsed.requiredAuth)
      } satisfies AuthIntent;
    }

    if (parsed.type === 'open-workspace') {
      return {
        type: 'open-workspace',
        returnTo: typeof parsed.returnTo === 'string' ? parsed.returnTo : '',
        reason: typeof parsed.reason === 'string' ? parsed.reason : '',
        requiredAuth: normalizeRequiredAuth(parsed.requiredAuth)
      } satisfies AuthIntent;
    }

    if (parsed.type === 'publish-offer') {
      return {
        type: 'publish-offer',
        returnTo: typeof parsed.returnTo === 'string' ? parsed.returnTo : '',
        reason: typeof parsed.reason === 'string' ? parsed.reason : '',
        requiredAuth: 'member'
      } satisfies AuthIntent;
    }
  } catch {
    return null;
  }

  return null;
}

export function clearAuthIntent() {
  writeAuthIntent(null);
}
