'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { billingOwnerKey } from '@/lib/billing-api';
import { useUserSessionState } from './use-user-session';
export type BillingResource<T> = {
  state: 'guest' | 'loading' | 'ready' | 'error'; data: T | null; error: string;
  ownerKey: string | null; refresh: () => Promise<void>;
};
/** Hide old owner data during render, before an effect cleanup can run. */
export function useBillingResource<T>(loader: (ownerKey: string, signal: AbortSignal) => Promise<T>, resourceId = ''): BillingResource<T> {
  const { session, ready } = useUserSessionState();
  const ownerKey = ready ? billingOwnerKey(session) : null;
  const key = ownerKey ? ownerKey + ':' + resourceId : null;
  const loaderRef = useRef(loader); loaderRef.current = loader;
  const currentKey = useRef(key); currentKey.current = key;
  const runId = useRef(0), controller = useRef<AbortController | null>(null);
  const [result, setResult] = useState<{ key: string; data: T | null; error: string; loading: boolean } | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const run = ++runId.current, abort = new AbortController(); controller.current = abort;
    if (!key || !ownerKey) return;
    setResult({ key, data: null, error: '', loading: true });
    try {
      const data = await loaderRef.current(ownerKey, abort.signal);
      if (!abort.signal.aborted && run === runId.current && currentKey.current === key && billingOwnerKey() === ownerKey) setResult({ key, data, error: '', loading: false });
    } catch {
      if (!abort.signal.aborted && run === runId.current && currentKey.current === key) setResult({ key, data: null, error: '暂时无法读取信息，请重试。', loading: false });
    }
  }, [key, ownerKey]);
  useEffect(() => { void refresh(); return () => { controller.current?.abort(); }; }, [refresh]);
  const visible = result?.key === key ? result : null;
  return { ownerKey, state: !ready ? 'loading' : !ownerKey ? 'guest' : !visible || visible.loading ? 'loading' : visible.error ? 'error' : 'ready',
    data: visible?.data ?? null, error: visible?.error ?? '', refresh };
}
