'use client';

import { getClerkToken } from './clerk-browser';

export class CloudflareApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, code?: string) {
    super(code || 'CLOUDFLARE_API_REQUEST_FAILED');
    this.name = 'CloudflareApiError';
    this.status = status;
    this.code = code;
  }
}

export function isCloudflareQuotaError(error: unknown): error is CloudflareApiError {
  return error instanceof CloudflareApiError && error.status === 402 && error.code === 'SERVICE_QUOTA_EXCEEDED';
}

export function cloudflareApiErrorMessage(error: unknown, fallback = '系统服务暂时不可用，请稍后重试。') {
  if (isCloudflareQuotaError(error)) {
    return '今日数据服务额度已用尽，资料已保留，服务会在额度恢复后自动继续。';
  }

  if (error instanceof CloudflareApiError && error.code === 'AUTH_REQUIRED') {
    return '登录状态已失效，请重新登录。';
  }

  return fallback;
}

export function cloudflareApiOrigin() {
  const configured = process.env.NEXT_PUBLIC_D1_API_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return 'http://127.0.0.1:8787';
  }
  return 'https://migration.seekoffer.com.cn';
}

export async function cloudflareRequest<T>(path: string, init: RequestInit = {}, authenticated = false) {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (authenticated) {
    const token = await getClerkToken();
    if (!token) throw new CloudflareApiError(401, 'AUTH_REQUIRED');
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${cloudflareApiOrigin()}${path}`, {
    ...init,
    headers,
    signal: init.signal || AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new CloudflareApiError(response.status, body?.error);
  }
  return response.json() as Promise<T>;
}

export async function bootstrapCloudflareIdentity() {
  return cloudflareRequest<{ ready: boolean }>('/v1/me/bootstrap', { method: 'POST', body: '{}' }, true);
}
