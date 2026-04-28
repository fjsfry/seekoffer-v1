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

export function isAdminApiConfigured() {
  return isSupabaseConfigured() && Boolean(SUPABASE_URL);
}

export async function invokeAdminApi<T>(payload: AdminApiPayload): Promise<AdminApiResponse<T>> {
  if (!isAdminApiConfigured()) {
    throw new Error('Supabase 环境变量未配置，后台真实 API 暂不可用。');
  }

  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error('请先使用 Supabase 管理员账号登录后台。');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify(payload)
  });

  const body = (await response.json().catch(() => ({}))) as AdminApiResponse<T>;
  if (!response.ok) {
    throw new Error(body.message || body.error || '后台 API 请求失败。');
  }

  return body;
}
