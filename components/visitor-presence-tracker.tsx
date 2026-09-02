'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { SUPABASE_URL } from '@/lib/supabase-env';

const visitorStorageKey = 'seekoffer-visitor-id';
const sessionStorageKey = 'seekoffer-session-id';
const HEARTBEAT_INTERVAL_MS = 5 * 60_000;
let inMemoryVisitorId = '';
let inMemorySessionId = '';

function randomId(prefix: 'v' | 's') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function readPersistentVisitorId() {
  try {
    const existing = window.localStorage.getItem(visitorStorageKey);
    if (existing?.startsWith('v_')) {
      inMemoryVisitorId = existing;
      return existing;
    }

    const next = randomId('v');
    window.localStorage.setItem(visitorStorageKey, next);
    inMemoryVisitorId = next;
    return next;
  } catch {
    inMemoryVisitorId ||= randomId('v');
    return inMemoryVisitorId;
  }
}

function readSessionId() {
  try {
    const existing = window.sessionStorage.getItem(sessionStorageKey);
    if (existing?.startsWith('s_')) {
      inMemorySessionId = existing;
      return existing;
    }

    const next = randomId('s');
    window.sessionStorage.setItem(sessionStorageKey, next);
    inMemorySessionId = next;
    return next;
  } catch {
    inMemorySessionId ||= randomId('s');
    return inMemorySessionId;
  }
}

function buildPayload(eventType: 'pageview' | 'heartbeat', pathname: string) {
  return {
    visitorId: readPersistentVisitorId(),
    sessionId: readSessionId(),
    eventType,
    path: pathname || window.location.pathname || '/',
    title: document.title || '',
    referrer: document.referrer || '',
    locale: navigator.language || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  };
}

function sendPresence(eventType: 'pageview' | 'heartbeat', pathname: string) {
  if (!SUPABASE_URL) return;

  const url = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/analytics-api`;
  const body = JSON.stringify(buildPayload(eventType, pathname));

  if (navigator.sendBeacon && eventType === 'heartbeat') {
    navigator.sendBeacon(url, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
    return;
  }

  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body,
    keepalive: true
  }).catch(() => {
    // Presence analytics should never interrupt a user's browsing flow.
  });
}

export function VisitorPresenceTracker() {
  const pathname = usePathname() || '/';

  useEffect(() => {
    if (pathname.startsWith('/admin')) return;

    sendPresence('pageview', pathname);
    const sendHeartbeatWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        sendPresence('heartbeat', pathname);
      }
    };
    const interval = window.setInterval(sendHeartbeatWhenVisible, HEARTBEAT_INTERVAL_MS);

    document.addEventListener('visibilitychange', sendHeartbeatWhenVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', sendHeartbeatWhenVisible);
    };
  }, [pathname]);

  return null;
}
