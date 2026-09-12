'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { accountServiceFetch } from '@/lib/service-availability';
import { SUPABASE_URL } from '@/lib/supabase-env';
import {isD1Backend} from '@/lib/backend-mode';
import {createAnalyticsPresence} from '@/lib/client/analytics-presence';

const visitorStorageKey = 'seekoffer-visitor-id';
const sessionStorageKey = 'seekoffer-session-id';
const seenPageviews = new Map<string, number>();
let inMemoryVisitorId = '';
let inMemorySessionId = '';
let d1Presence:ReturnType<typeof createAnalyticsPresence>|undefined;

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

  const key = pathname;
  const now = Date.now();
  if (now - (seenPageviews.get(key) || 0) < 30_000) return;
  seenPageviews.set(key, now);
  if (seenPageviews.size > 100) seenPageviews.delete(seenPageviews.keys().next().value!);
  void accountServiceFetch(url, {
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
    if(isD1Backend()){
      if(process.env.NEXT_PUBLIC_ANALYTICS_RECOVERY!=='true'||pathname.startsWith('/admin')||document.visibilityState!=='visible')return;
      d1Presence??=createAnalyticsPresence(fetch,{getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)});
      void d1Presence({...buildPayload('pageview',pathname),eventType:'pageview',title:document.title.slice(0,180)});
      return;
    }
    if (pathname.startsWith('/admin')) return;

    sendPresence('pageview', pathname);
    // Emergency mode: retain deduplicated pageviews, disable optional heartbeat.
  }, [pathname]);

  return null;
}
