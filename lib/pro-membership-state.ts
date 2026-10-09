import type { BillingEntitlementResponse } from './pro-contract';
export type MembershipSnapshot = { ownerKey: string | null; state: 'idle' | 'loading' | 'ready' | 'error'; data: BillingEntitlementResponse | null; error: string };
export const emptyMembershipSnapshot: MembershipSnapshot = { ownerKey: null, state: 'idle', data: null, error: '' };
let snapshot = emptyMembershipSnapshot;
const listeners = new Set<() => void>();
export function getMembershipSnapshot() { return snapshot; }
export function subscribeMembership(callback: () => void) { listeners.add(callback); return () => { listeners.delete(callback); }; }
export function publishMembership(value: MembershipSnapshot) { snapshot = value; listeners.forEach(callback => callback()); }
