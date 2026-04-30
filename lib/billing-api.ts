'use client';

import { getSupabaseBrowserClient } from './supabase-browser';
import { SUPABASE_URL } from './supabase-env';

export const FREE_APPLICATION_LIMIT = 5;

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

export type BillingEntitlementResponse = {
  entitlement: BillingEntitlement;
  isPro: boolean;
  applicationCount: number;
  freeLimit: number;
  plans: BillingPlan[];
};

export type CreateBillingOrderResponse = {
  order: BillingOrder;
  plan: BillingPlan;
  payment: {
    provider: BillingProvider;
    mode: 'qr' | 'not_configured';
    codeUrl: string;
    configured: boolean;
    message: string;
  };
};

let entitlementCache: {
  value: BillingEntitlementResponse;
  timestamp: number;
} | null = null;

function getBillingFunctionUrl() {
  if (!SUPABASE_URL) {
    throw new Error('Supabase 环境变量未配置，暂时无法读取 Pro 权益。');
  }

  return `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/billing-api`;
}

async function getAccessToken() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const token = data.session?.access_token || '';
  if (!token) {
    throw new Error('请先登录正式账号后再使用 Pro 相关功能。');
  }

  return token;
}

async function invokeBillingApi<T>(payload: Record<string, unknown>, requiresAuth = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (requiresAuth) {
    headers.Authorization = `Bearer ${await getAccessToken()}`;
  }

  const response = await fetch(getBillingFunctionUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(String(data.error || data.message || 'Pro 服务暂时不可用，请稍后重试。'));
  }

  return data as T;
}

export async function fetchBillingPlans() {
  const response = await invokeBillingApi<{ plans: BillingPlan[]; freeLimit: number }>({ action: 'list-plans' }, false);
  return response;
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

export async function createBillingOrder(planId: string, provider: BillingProvider) {
  const response = await invokeBillingApi<CreateBillingOrderResponse>({
    action: 'create-order',
    planId,
    provider
  });
  return response;
}

export async function fetchBillingOrder(orderId: string) {
  const response = await invokeBillingApi<{ order: BillingOrder | null }>({
    action: 'get-order',
    orderId
  });
  return response.order;
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
