'use client';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { billingOwnerKey, fetchBillingEntitlement } from '@/lib/billing-api';
import { emptyMembershipSnapshot, getMembershipSnapshot, subscribeMembership } from '@/lib/pro-membership-state';
import { useUserSessionState } from './use-user-session';
export function useProEntitlement() {
  const { session, ready } = useUserSessionState();
  const ownerKey = ready ? billingOwnerKey(session) : null;
  const snapshot = useSyncExternalStore(subscribeMembership, getMembershipSnapshot, () => emptyMembershipSnapshot);
  const refresh = useCallback(async () => { if (ownerKey) await fetchBillingEntitlement({ ownerKey, force: true }).catch(() => undefined); }, [ownerKey]);
  useEffect(() => { if (ownerKey) void fetchBillingEntitlement({ ownerKey }).catch(() => undefined); }, [ownerKey]);
  const visible = ownerKey && snapshot.ownerKey === ownerKey ? snapshot : null;
  const state = !ready ? 'loading' as const : !ownerKey ? 'guest' as const : !visible || visible.state === 'idle' ? 'loading' as const : visible.state;
  return { ownerKey, state, data: visible?.data ?? null, error: visible?.error ?? '', loading: state === 'loading', refresh };
}
