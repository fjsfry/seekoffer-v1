'use client';

import { CloudflareApiError, cloudflareRequest } from './cloudflare-api';

export const FREE_APPLICATION_LIMIT = 5;
export const FREE_FILL_SESSION_LIMIT = 3;

export type BillingProvider = 'wechat' | 'alipay';

export type BillingPlan = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  duration_days: number;
  benefits: string[];
  sort_order: number;
  is_recommended: boolean;
};

export type BillingProviderReadiness = Record<
  BillingProvider,
  {
    available: boolean;
    label: string;
  }
>;

export type BillingEntitlement = {
  user_id: string;
  plan_id: string | null;
  status: 'free' | 'active' | 'expired' | 'cancelled';
  starts_at: string | null;
  expires_at: string | null;
  source_order_id?: string | null;
  metadata?: Record<string, unknown>;
};

export type BillingOrder = {
  id: string;
  plan_id: string;
  provider: BillingProvider | 'manual';
  out_trade_no: string;
  amount_cents: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'closed' | 'refunded' | 'expired';
  code_url: string;
  checkout_url: string;
  expires_at: string;
  created_at?: string;
  paid_at?: string | null;
};

export type BillingFillUsage = {
  used: number;
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
  periodStart: string;
  periodEnd: string;
};

export type BillingPlansResponse = {
  plans: BillingPlan[];
  freeLimit: number;
  freeFillLimit: number;
  providers: BillingProviderReadiness;
};

export type BillingEntitlementResponse = BillingPlansResponse & {
  entitlement: BillingEntitlement;
  isPro: boolean;
  applicationCount: number;
  fillUsage: BillingFillUsage;
};

export type CreateBillingOrderResponse = {
  order: BillingOrder;
  plan: BillingPlan;
  payment: {
    provider: BillingProvider;
    mode: 'qr' | 'processing';
    codeUrl: string;
    configured: boolean;
    message: string;
  };
};

export type FillSessionAuthorizationResponse = {
  authorization: {
    token: string;
    verificationUrl: string;
    expiresAt: string;
  };
  fillUsage: BillingFillUsage;
};

export class BillingApiError extends Error {
  code: string;
  status: number;
  traceId: string;

  constructor(code: string, status: number, traceId = '') {
    super(getBillingErrorMessage(code));
    this.name = 'BillingApiError';
    this.code = code;
    this.status = status;
    this.traceId = traceId;
  }
}

const billingErrorMessages: Record<string, string> = {
  missing_auth_token: '请先登录账号后再继续。',
  invalid_auth_token: '登录状态已失效，请重新登录后再试。',
  fill_limit_reached: '本月免费填报次数已用完，升级 Pro 后可不限次数使用。',
  fill_session_rate_limited: '操作太频繁，请稍等一分钟再试。',
  fill_session_expired: '本次安全授权已过期，请回到寻鹿重新发送字段。',
  fill_session_invalid_token: '本次安全授权无效，请回到寻鹿重新发送字段。',
  fill_session_already_consumed: '本次字段已发送，请直接打开插件使用。',
  payment_provider_unavailable: '当前支付方式暂不可用，请稍后再试。',
  payment_order_creation_failed: '订单没有创建成功，请稍后再试。',
  order_rate_limited: '短时间内创建订单过多，请十分钟后再试。',
  idempotency_conflict: '订单信息已更新，请刷新页面后重新选择。',
  idempotent_order_not_reusable: '该订单已结束，请重新选择方案。',
  plan_not_found: '所选套餐已下架，请刷新页面后重新选择。',
  invalid_provider: '请选择可用的支付方式。',
  invalid_order_id: '订单信息无效，请刷新页面后重试。',
  billing_api_error: '当前暂时无法完成操作，请稍后再试。'
};

let entitlementCache: {
  value: BillingEntitlementResponse;
  timestamp: number;
} | null = null;

function getBillingErrorMessage(code: string) {
  return billingErrorMessages[code] || '当前暂时无法完成操作，请稍后再试。';
}

function createIdempotencyKey(prefix: string) {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

async function invokeBillingApi<T>(
  payload: Record<string, unknown>,
  options: { requiresAuth?: boolean; timeoutMs?: number } = {}
): Promise<T> {
  void options.timeoutMs;
  try {
    if (payload.action === 'list-plans') {
      return await cloudflareRequest<T>('/v1/billing/plans', {}, false);
    }
    return await cloudflareRequest<T>(
      '/v1/me/billing',
      { method: 'POST', body: JSON.stringify(payload) },
      options.requiresAuth !== false
    );
  } catch (error) {
    if (error instanceof BillingApiError) throw error;
    const code = error instanceof CloudflareApiError ? String(error.code || 'billing_api_error') : 'billing_api_error';
    const status = error instanceof CloudflareApiError ? error.status : 503;
    throw new BillingApiError(code, status);
  }
}

export async function fetchBillingPlans() {
  return invokeBillingApi<BillingPlansResponse>({ action: 'list-plans' }, { requiresAuth: false });
}

export async function fetchBillingEntitlement(options: { force?: boolean } = {}) {
  if (!options.force && entitlementCache && Date.now() - entitlementCache.timestamp < 60_000) {
    return entitlementCache.value;
  }

  const response = await invokeBillingApi<BillingEntitlementResponse>({ action: 'get-entitlement' });
  entitlementCache = {
    value: response,
    timestamp: Date.now()
  };
  return response;
}

export async function prepareBillingFillSession(requestId: string, fieldCount: number) {
  return invokeBillingApi<FillSessionAuthorizationResponse>({
    action: 'prepare-fill-session',
    requestId,
    fieldCount
  });
}

export async function createBillingOrder(
  planId: string,
  provider: BillingProvider,
  options: { idempotencyKey?: string } = {}
) {
  return invokeBillingApi<CreateBillingOrderResponse>(
    {
      action: 'create-order',
      planId,
      provider,
      idempotencyKey: options.idempotencyKey || createIdempotencyKey('order')
    },
    { timeoutMs: 30_000 }
  );
}

export async function fetchBillingOrder(orderId: string) {
  const response = await invokeBillingApi<{ order: BillingOrder | null }>({
    action: 'get-order',
    orderId
  });
  return response.order;
}

export async function fetchBillingOrders() {
  const response = await invokeBillingApi<{ orders: BillingOrder[] }>({ action: 'list-orders' });
  return response.orders;
}

export function clearBillingEntitlementCache() {
  entitlementCache = null;
}

export async function canCreateMoreApplications(currentCount: number) {
  if (currentCount < FREE_APPLICATION_LIMIT) {
    return {
      allowed: true,
      isPro: false,
      freeLimit: FREE_APPLICATION_LIMIT
    };
  }

  try {
    const entitlement = await fetchBillingEntitlement();
    return {
      allowed: entitlement.isPro,
      isPro: entitlement.isPro,
      freeLimit: entitlement.freeLimit || FREE_APPLICATION_LIMIT
    };
  } catch {
    return {
      allowed: false,
      isPro: false,
      freeLimit: FREE_APPLICATION_LIMIT
    };
  }
}

export function formatPlanPrice(cents: number) {
  return `¥${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
