'use client';

import { useEffect, useState } from 'react';
import { fetchBillingEntitlement, type BillingEntitlementResponse } from '@/lib/billing-api';
import { useUserSessionState } from './use-user-session';

type ProEntitlementState = {
  loading: boolean;
  error: string;
  data: BillingEntitlementResponse | null;
  refresh: () => Promise<void>;
};

export function useProEntitlement(): ProEntitlementState {
  const { loggedIn, isMember, ready } = useUserSessionState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<BillingEntitlementResponse | null>(null);

  async function loadEntitlement(options: { force: boolean }) {
    setLoading(true);
    setError('');
    try {
      setData(await fetchBillingEntitlement({ force: options.force }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Pro 权益读取失败。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function run() {
      await Promise.resolve();
      if (!active) {
        return;
      }

      if (!ready || !loggedIn || !isMember) {
        setData(null);
        setError('');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const entitlement = await fetchBillingEntitlement();
        if (active) {
          setData(entitlement);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : 'Pro 权益读取失败。');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void run();
    return () => {
      active = false;
    };
  }, [ready, loggedIn, isMember]);

  return {
    loading,
    error,
    data,
    refresh: () => loadEntitlement({ force: true })
  };
}
