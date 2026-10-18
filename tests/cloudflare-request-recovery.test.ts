import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { token } = vi.hoisted(() => ({ token: vi.fn() }));
vi.mock('../lib/clerk-browser', () => ({ getClerkToken: token }));
import { cloudflareRequest } from '../lib/cloudflare-api';
import { invokeAdminApi } from '../lib/admin-api';

beforeEach(() => { vi.useFakeTimers(); token.mockReset().mockResolvedValue('valid'); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('recovers a profile read after a transient network failure', async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce(Response.json({ id: 'user' }));
  vi.stubGlobal('fetch', fetcher);
  const result = cloudflareRequest('/v1/me/profile', {}, true);
  await vi.advanceTimersByTimeAsync(500);
  await expect(result).resolves.toEqual({ id: 'user' });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('refreshes a rejected token once before retrying the read', async () => {
  const authorizations: string[] = [];
  token.mockResolvedValueOnce('old').mockResolvedValueOnce('fresh');
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    authorizations.push(init.headers.get('Authorization'));
    return authorizations.length === 1 ? Response.json({ error: 'INVALID_IDENTITY' }, { status: 401 }) : Response.json({ id: 'user' });
  }));
  await cloudflareRequest('/v1/me/profile', {}, true);
  expect(token).toHaveBeenLastCalledWith({ skipCache: true });
  expect(authorizations).toEqual(['Bearer old', 'Bearer fresh']);
});

it.each([402, 403, 429])('does not retry quota, permission or rate-limit failures (%s)', async (status) => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ error: 'REJECTED' }, { status }));
  vi.stubGlobal('fetch', fetcher);
  await expect(cloudflareRequest('/v1/me/profile', {}, true)).rejects.toMatchObject({ status });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('never automatically repeats a write after an ambiguous network failure', async () => {
  const fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  vi.stubGlobal('fetch', fetcher);
  await expect(invokeAdminApi({ resource: 'notices', action: 'update', id: 'notice' })).rejects.toMatchObject({ code: 'NETWORK_UNAVAILABLE' });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('bounds administrator identity retries and keeps the typed error', async () => {
  const fetcher = vi.fn().mockImplementation(async () => Response.json({ error: 'AUTH_VERIFICATION_UNAVAILABLE' }, { status: 503 }));
  vi.stubGlobal('fetch', fetcher);
  const result = expect(invokeAdminApi({ resource: 'me' })).rejects.toMatchObject({ status: 503, code: 'AUTH_VERIFICATION_UNAVAILABLE' });
  await vi.advanceTimersByTimeAsync(500);
  await result;
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('honors caller cancellation without retrying', async () => {
  const controller = new AbortController();
  controller.abort();
  const fetcher = vi.fn().mockRejectedValue(controller.signal.reason);
  vi.stubGlobal('fetch', fetcher);
  await expect(cloudflareRequest('/v1/me/profile', { signal: controller.signal })).rejects.toBe(controller.signal.reason);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
