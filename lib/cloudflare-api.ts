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

  if (error instanceof CloudflareApiError) {
    if (error.status === 401) return '登录状态已失效，请重新登录。';
    if (error.status === 403) return error.code === 'ACCOUNT_BLOCKED'
      ? '当前账号暂时无法使用，请联系管理员。'
      : '当前账号没有执行此操作的权限。';
    if (error.code === 'NETWORK_UNAVAILABLE' || error.code === 'REQUEST_TIMEOUT') {
      return '连接暂时中断，请检查网络后重试。登录状态和已保存的数据不会因此清除。';
    }
    if (error.status >= 500) return '服务暂时繁忙，请稍后重试。';
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

export async function cloudflareRequest<T>(path: string, init: RequestInit = {}, authenticated = false, options: { retryReadOnly?: boolean } = {}) {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (authenticated) {
    const token = await getClerkToken();
    if (!token) throw new CloudflareApiError(401, 'AUTH_REQUIRED');
    headers.set('Authorization', `Bearer ${token}`);
  }

  const canRetry = options.retryReadOnly || ['GET', 'HEAD'].includes((init.method || 'GET').toUpperCase());
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(`${cloudflareApiOrigin()}${path}`, {
        ...init,
        headers,
        signal: init.signal || AbortSignal.timeout(15000)
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new CloudflareApiError(response.status, body?.error);
      }
      return await response.json() as T;
    } catch (error) {
      if (init.signal?.aborted) throw error;
      const failure = error instanceof CloudflareApiError ? error : new CloudflareApiError(
        0, error instanceof Error && /timeout|abort/i.test(error.name) ? 'REQUEST_TIMEOUT' : 'NETWORK_UNAVAILABLE'
      );
      if (!canRetry || attempt > 0) throw failure;
      if (failure.status === 401 && authenticated) {
        const token = await getClerkToken({ skipCache: true });
        if (!token) throw new CloudflareApiError(401, 'AUTH_REQUIRED');
        headers.set('Authorization', `Bearer ${token}`);
      } else if (failure.status === 0 || [502, 503, 504].includes(failure.status)) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      } else {
        throw failure;
      }
    }
  }
}

export async function bootstrapCloudflareIdentity() {
  return cloudflareRequest<{ ready: boolean }>('/v1/me/bootstrap', { method: 'POST', body: '{}' }, true);
}
