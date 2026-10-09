'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchBillingPlans, type BillingPlansResponse } from '@/lib/billing-api';
export function useProCatalog() {
  const [data, setData] = useState<BillingPlansResponse | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    setState('loading'); setData(null);
    try {
      const result = await fetchBillingPlans(abort.signal);
      if (!abort.signal.aborted) { setData(result); setState('ready'); }
    } catch { if (!abort.signal.aborted) setState('error'); }
  }, []);
  useEffect(() => { void refresh(); return () => controller.current?.abort(); }, [refresh]);
  useEffect(() => {
    if (!data) return;
    const timer = window.setTimeout(() => void refresh(), Math.max(1000, Date.parse(data.validUntil) - Date.now()));
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', visible); };
  }, [data, refresh]);
  return { data, state, refresh };
}
