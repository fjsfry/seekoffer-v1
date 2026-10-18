'use client';

import {
  cloudflareApiErrorMessage,
  cloudflareApiOrigin,
  cloudflareRequest,
  CloudflareApiError,
} from './cloudflare-api';

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

export function getAdminErrorMessage(error: unknown, fallback = '操作暂时无法完成，请稍后重试。') {
  if (error instanceof CloudflareApiError) return cloudflareApiErrorMessage(error, fallback);
  if (!(error instanceof Error)) {
    return fallback;
  }

  return toSafeAdminMessage(error.message || fallback);
}

function toSafeAdminMessage(message?: string) {
  if (!message) {
    return '操作暂时无法完成，请稍后重试。';
  }

  if (/failed to fetch|fetch failed|network|timeout|timed out|aborted|load failed/i.test(message)) {
    return '网络连接异常，数据暂未更新，请稍后重试。';
  }

  if (/edge function|api|env|environment|jwt|token|function|\u63a5\u53e3|\u540e\u7aef|\u73af\u5883\u53d8\u91cf|\u767b\u5f55\u901a\u9053/i.test(message)) {
    return '系统服务暂时不可用，请稍后重试。';
  }

  return message;
}

export function isAdminApiConfigured() {
  return Boolean(cloudflareApiOrigin());
}

export async function invokeAdminApi<T>(payload: AdminApiPayload): Promise<AdminApiResponse<T>> {
  if (!isAdminApiConfigured()) {
    throw new Error('当前无法完成登录，请稍后再试或联系管理员。');
  }

  return cloudflareRequest<AdminApiResponse<T>>(
    '/v1/admin',
    { method: 'POST', body: JSON.stringify(payload) },
    true,
    { retryReadOnly: payload.resource === 'me' && !payload.action }
  );
}
