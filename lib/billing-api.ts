'use client';
import { CloudflareApiError, cloudflareRequest } from './cloudflare-api';
import { clerkIssuer, getClerk } from './clerk-browser';
import { getUserSession, watchUserSession, type UserSession } from './user-session';
import { OwnedRequestCache } from './owned-request-cache';
import { getMembershipSnapshot, publishMembership, emptyMembershipSnapshot } from './pro-membership-state';
import { normalizeBillingCatalog, normalizeMembership, normalizeBillingOrder, normalizeOrdersPage,
  type BillingEntitlementResponse, type BillingProvider, type BillingOrder, type BillingFillUsage } from './pro-contract';
export * from './pro-contract';
export const FREE_APPLICATION_LIMIT = 5;
export const FREE_FILL_SESSION_LIMIT = 3;
export type FillSessionAuthorizationResponse = { authorization: { token: string; verificationUrl: string; expiresAt: string }; fillUsage: BillingFillUsage };
export class BillingApiError extends Error {
  constructor(public code: string, public status: number, public traceId = '') {
    super(code === 'AUTH_REQUIRED' || status === 401 ? '登录状态已失效，请重新登录。'
      : code === 'PAYMENT_CONFIGURATION_PENDING' || code === 'PURCHASES_PAUSED' ? '暂时无法购买 Pro，你仍可使用现有功能。'
      : code === 'CATALOG_CHANGED' ? '方案信息已更新，请重新核对。'
      : code === 'ORDER_OUTCOME_UNKNOWN' ? '订单结果正在确认，请勿重复付款。请查看已有订单或联系客服。'
      : code === 'FILL_LIMIT_REACHED' ? '本月资料传入次数已用完。'
      : status === 404 ? '未找到这笔订单，请确认当前登录账号。'
      : '暂时无法读取信息，请重试。');
    this.name = 'BillingApiError';
  }
}
export function billingOwnerKey(session: UserSession | null = getUserSession()): string | null {
  if (!session?.loggedIn || session.authProvider === 'anonymous' || !session.userId || !session.authSubject || !session.authSessionId) return null;
  const clerk = typeof window !== 'undefined' ? window.Clerk : null;
  if (!clerk?.session || clerk.session.id !== session.authSessionId || clerk.user?.id !== session.authSubject) return null;
  return JSON.stringify([clerkIssuer(), session.authSubject, session.authSessionId, session.userId]);
}
const membershipCache = new OwnedRequestCache<BillingEntitlementResponse>();
const privateRequests = new Set<AbortController>();
let observedOwner: string | null = null;
let watching = false;
function observeOwner() {
  const key = billingOwnerKey();
  if (key !== observedOwner) {
    observedOwner = key; membershipCache.select(key);
    publishMembership({ ...emptyMembershipSnapshot, ownerKey: key });
    privateRequests.forEach(controller => controller.abort()); privateRequests.clear();
  }
  return key;
}
function ensureWatcher() {
  if (!watching && typeof window !== 'undefined') { watching = true; watchUserSession(observeOwner); }
  return observeOwner();
}
async function invokeBillingApi(payload: Record<string, unknown>, options: { ownerKey?: string; signal?: AbortSignal } = {}): Promise<unknown> {
  const owner = ensureWatcher();
  if (!owner || options.ownerKey && options.ownerKey !== owner) throw new BillingApiError('AUTH_REQUIRED', 401);
  const controller = new AbortController();
  const signal = options.signal ? AbortSignal.any([controller.signal, options.signal, AbortSignal.timeout(15000)]) : AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
  privateRequests.add(controller);
  try {
    const clerk = await getClerk(), session = clerk.session;
    const token = await session?.getToken();
    if (!token || session !== clerk.session || owner !== observeOwner()) throw new BillingApiError('AUTH_REQUIRED', 401);
    const result = await cloudflareRequest<unknown>('/v1/me/billing', {
      method: 'POST', body: JSON.stringify(payload), headers: { Authorization: `Bearer ${token}` }, signal, cache: 'no-store'
    });
    if (owner !== observeOwner() || signal.aborted) throw new DOMException('Account changed', 'AbortError');
    return result;
  } catch (error) {
    if (error instanceof BillingApiError || error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new BillingApiError(error instanceof CloudflareApiError ? error.code || 'BILLING_UNAVAILABLE' : 'BILLING_UNAVAILABLE', error instanceof CloudflareApiError ? error.status : 503);
  } finally { privateRequests.delete(controller); }
}
export async function fetchBillingPlans(signal?: AbortSignal) {
  try { return normalizeBillingCatalog(await cloudflareRequest<unknown>('/v1/billing/plans', { signal, cache: 'no-cache' })); }
  catch { throw new BillingApiError('CATALOG_UNAVAILABLE', 503); }
}
export async function fetchBillingEntitlement(options: { force?: boolean; ownerKey?: string; signal?: AbortSignal } = {}) {
  const owner = ensureWatcher();
  if (!owner || options.ownerKey && options.ownerKey !== owner) throw new BillingApiError('AUTH_REQUIRED', 401);
  const current = getMembershipSnapshot();
  if (current.ownerKey !== owner || current.state !== 'ready' || options.force) publishMembership({ ownerKey: owner, state: 'loading', data: null, error: '' });
  try {
    const data = await membershipCache.read(owner, async signal => normalizeMembership(await invokeBillingApi({ action: 'get-entitlement' }, { ownerKey: owner, signal })), options.force);
    if (billingOwnerKey() === owner) publishMembership({ ownerKey: owner, state: 'ready', data, error: '' });
    return data;
  } catch (error) {
    if (billingOwnerKey() === owner) publishMembership({ ownerKey: owner, state: 'error', data: null, error: '暂时无法确认会员信息，请重试。' });
    throw error;
  }
}
export async function fetchBillingOrder(orderId: string, options: { ownerKey?: string; signal?: AbortSignal } = {}) {
  const result = await invokeBillingApi({ action: 'get-order', orderId }, options) as { order?: unknown };
  if (!result.order) throw new BillingApiError('ORDER_NOT_FOUND', 404);
  return normalizeBillingOrder(result.order);
}
export async function fetchBillingOrders(options: { ownerKey?: string; signal?: AbortSignal; cursor?: string | null } = {}) {
  return normalizeOrdersPage(await invokeBillingApi({ action: 'list-orders', ...(options.cursor ? { cursor: options.cursor } : {}) }, options));
}
export async function createBillingOrder(planId: string, provider: BillingProvider, options: {
  ownerKey: string; requestId: string; catalogVersion: string; termsVersion: string;
}): Promise<BillingOrder> {
  const response = await invokeBillingApi({ action: 'create-order', planId, provider, requestId: options.requestId,
    catalogVersion: options.catalogVersion, termsVersion: options.termsVersion }, { ownerKey: options.ownerKey }) as { order: unknown };
  return normalizeBillingOrder(response.order);
}
export async function prepareBillingFillSession(requestId: string, fieldCount: number) {
  return invokeBillingApi({ action: 'prepare-fill-session', requestId, fieldCount }) as Promise<FillSessionAuthorizationResponse>;
}
export function clearBillingEntitlementCache() { membershipCache.clear(); publishMembership(emptyMembershipSnapshot); }
export async function canCreateMoreApplications(currentCount: number) {
  if (getUserSession()?.authProvider === 'anonymous') return { allowed: currentCount < FREE_APPLICATION_LIMIT, isPro: false, freeLimit: FREE_APPLICATION_LIMIT };
  const entitlement = await fetchBillingEntitlement({ force: true });
  return { allowed: entitlement.applications.canCreate, isPro: entitlement.isPro, freeLimit: entitlement.freeLimit };
}
