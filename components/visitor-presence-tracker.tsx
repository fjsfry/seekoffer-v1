'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { cloudflareApiOrigin } from '@/lib/cloudflare-api';
import { analyticsResumeAt, buildPageview, postPageview } from '@/lib/visitor-analytics';

const pauseKey = 'seekoffer-analytics-pause-v1';
const memoryIds: Partial<Record<'v' | 's', string>> = {};
let pausedUntil = 0;
let lastPageview = { path: '', at: 0 };

function readId(prefix: 'v' | 's') {
  if (memoryIds[prefix]) return memoryIds[prefix]!;
  const key = prefix === 'v' ? 'seekoffer-visitor-id' : 'seekoffer-session-id';
  const next = () => prefix + '_' + crypto.randomUUID().replace(/-/g, '');
  let id: string;
  try {
    const storage = prefix === 'v' ? window.localStorage : window.sessionStorage;
    const existing = storage.getItem(key);
    id = existing && new RegExp('^' + prefix + '_[a-zA-Z0-9_-]{16,90}$').test(existing) ? existing : next();
    storage.setItem(key, id);
  } catch { id = next(); }
  memoryIds[prefix] = id;
  return id;
}

async function recordVisit(path: string) {
  const now = Date.now();
  try {
    const stored = Number(window.localStorage.getItem(pauseKey));
    if (Number.isFinite(stored) && stored <= now + 86400000) pausedUntil = Math.max(pausedUntil, stored);
  } catch { /* Memory backoff still works when storage is unavailable. */ }
  if (now < pausedUntil || (lastPageview.path === path && now - lastPageview.at < 30000)) return;
  const payload = buildPageview({
    requestId: crypto.randomUUID(), visitorId: readId('v'), sessionId: readId('s'), path,
    title: document.title, referrer: document.referrer, locale: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  if (!payload) return;
  lastPageview = { path, at: now };
  try {
    const result = await postPageview(cloudflareApiOrigin() + '/v1/analytics', payload);
    if (result.ok) return;
    pausedUntil = analyticsResumeAt(result.status, result.code, result.retryAfter, Date.now());
  } catch { pausedUntil = Date.now() + 60000; }
  try { window.localStorage.setItem(pauseKey, String(pausedUntil)); } catch { /* Optional storage. */ }
}

export function VisitorPresenceTracker() {
  const pathname = usePathname() || '/';
  useEffect(() => {
    if (pathname.startsWith('/admin')) return;
    let sent = false;
    const onVisible = () => {
      if (sent || document.visibilityState !== 'visible') return;
      sent = true;
      // No timer heartbeat: only real, visible route visits consume the daily budget.
      void recordVisit(pathname).catch(() => {});
    };
    const timer = window.setTimeout(onVisible, 0);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pathname]);
  return null;
}
