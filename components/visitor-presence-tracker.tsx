'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SUPABASE_URL } from '@/lib/supabase-env';
import { ANALYTICS_PREFERENCE_EVENT, readAnalyticsPreference } from '@/lib/privacy-preference';

const visitorStorageKey = 'seekoffer-visitor-id';
const sessionStorageKey = 'seekoffer-session-id';

function randomId(prefix: 'v' | 's') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function readPersistentVisitorId() {
  try {
    const existing = window.localStorage.getItem(visitorStorageKey);
    if (existing?.startsWith('v_')) return existing;

    const next = randomId('v');
    window.localStorage.setItem(visitorStorageKey, next);
    return next;
  } catch {
    return randomId('v');
  }
}

function readSessionId() {
  try {
    const existing = window.sessionStorage.getItem(sessionStorageKey);
    if (existing?.startsWith('s_')) return existing;

    const next = randomId('s');
    window.sessionStorage.setItem(sessionStorageKey, next);
    return next;
  } catch {
    return randomId('s');
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
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    return;
  }

  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true
  }).catch(() => {
    // Presence analytics should never interrupt a user's browsing flow.
  });
}

export function VisitorPresenceTracker() {
  const pathname = usePathname() || '/';
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);

  useEffect(() => {
    const updatePreference = () => setAnalyticsAllowed(readAnalyticsPreference() === 'accepted');
    updatePreference();
    window.addEventListener(ANALYTICS_PREFERENCE_EVENT, updatePreference);
    return () => window.removeEventListener(ANALYTICS_PREFERENCE_EVENT, updatePreference);
  }, []);

  useEffect(() => {
    if (pathname.startsWith('/admin') || !analyticsAllowed) return;

    sendPresence('pageview', pathname);
    const interval = window.setInterval(() => sendPresence('heartbeat', pathname), 45_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendPresence('heartbeat', pathname);
      }
    };
    const handlePageHide = () => sendPresence('heartbeat', pathname);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [analyticsAllowed, pathname]);

  return null;
}
