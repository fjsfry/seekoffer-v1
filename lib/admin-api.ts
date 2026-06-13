'use client';

import { getSupabaseBrowserClient } from './supabase-browser';
import { SUPABASE_URL, isSupabaseConfigured } from './supabase-env';

export type AdminApiPayload = {
  resource: string;
  action?: string;
  id?: string;
  ids?: string[];
  status?: string;
  note?: string;
  key?: string;
  value?: unknown;
  notice?: Record<string, unknown>;
  page?: number;
  pageSize?: number;
  filters?: Record<string, unknown>;
  sort?: string;
};

export type AdminApiResponse<T> = T & {
  error?: string;
  message?: string;
};

const ADMIN_API_TIMEOUT_MS = 12_000;

export function getAdminErrorMessage(error: unknown, fallback = '操作暂时无法完成，请稍后重试。') {
  if (!(error instanceof Error)) {
    return fallback;
  }

  return toSafeAdminMessage(error.message || fallback);
}

function toSafeAdminMessage(message?: string) {
  if (!message) {
    return '操作暂时无法完成，请稍后重试。';
  }

  if (/supabase|edge function|api|env|environment|jwt|token|function|\u63a5\u53e3|\u540e\u7aef|\u73af\u5883\u53d8\u91cf|\u767b\u5f55\u901a\u9053/i.test(message)) {
    return '系统服务暂时不可用，请稍后重试。';
  }

  return message;
}

export function isAdminApiConfigured() {
  return isSupabaseConfigured() && Boolean(SUPABASE_URL);
}

export async function invokeAdminApi<T>(payload: AdminApiPayload): Promise<AdminApiResponse<T>> {
  if (!isAdminApiConfigured()) {
    throw new Error('当前无法完成登录，请稍后再试或联系管理员。');
  }

  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error('登录状态已失效，请重新登录。');
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), ADMIN_API_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/admin-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('操作响应超时，请稍后重试。');
    }
    throw new Error('网络连接不稳定，请稍后重试。');
  } finally {
    window.clearTimeout(timeout);
  }

  const body = (await response.json().catch(() => ({}))) as AdminApiResponse<T>;
  if (!response.ok) {
    throw new Error(toSafeAdminMessage(body.message || body.error));
  }

  return body;
}
