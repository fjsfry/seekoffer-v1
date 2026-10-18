import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), login: vi.fn(), logout: vi.fn() }));
vi.mock('../lib/admin-api', () => ({ invokeAdminApi: mocks.invoke, isAdminApiConfigured: () => true }));
vi.mock('../lib/user-session', () => ({ signInWithPasswordAccount: mocks.login, signOutUser: mocks.logout }));

let values: Map<string, string>;
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  values = new Map([['seekoffer-admin-session', JSON.stringify({ email: 'admin@example.test', name: 'Admin', role: 'super_admin', verifiedAt: 1 })]]);
  vi.stubGlobal('window', { localStorage: {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key)
  }, dispatchEvent: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

it('preserves the session cache but blocks verification during a network failure', async () => {
  const { CloudflareApiError } = await import('../lib/cloudflare-api');
  const error = new CloudflareApiError(0, 'NETWORK_UNAVAILABLE');
  mocks.invoke.mockRejectedValueOnce(error);
  const { refreshAdminSession } = await import('../lib/admin-session');
  await expect(refreshAdminSession()).rejects.toBe(error);
  expect(values.has('seekoffer-admin-session')).toBe(true);
  expect(mocks.logout).not.toHaveBeenCalled();
});

it.each([401, 403])('clears cached access only when the server rejects it (%s)', async (status) => {
  const { CloudflareApiError } = await import('../lib/cloudflare-api');
  mocks.invoke.mockRejectedValueOnce(new CloudflareApiError(status, 'ADMIN_REQUIRED'));
  const { refreshAdminSession } = await import('../lib/admin-session');
  await expect(refreshAdminSession()).resolves.toBeNull();
  expect(values.has('seekoffer-admin-session')).toBe(false);
});

it('can retry after service recovery and shares concurrent verification requests', async () => {
  const { refreshAdminSession } = await import('../lib/admin-session');
  mocks.invoke.mockRejectedValueOnce(new Error('network'));
  await expect(refreshAdminSession()).rejects.toThrow('network');
  mocks.invoke.mockResolvedValue({ admin: { email: 'admin@example.test', name: 'Admin', role: 'super_admin' } });
  const results = await Promise.all([refreshAdminSession(), refreshAdminSession()]);
  expect(results[0]?.email).toBe('admin@example.test');
  expect(results[0]).toEqual(results[1]);
  expect(mocks.invoke).toHaveBeenCalledTimes(2);
});

it('does not sign out an authenticated user when the admin service is unavailable', async () => {
  const { CloudflareApiError } = await import('../lib/cloudflare-api');
  mocks.login.mockResolvedValue({});
  mocks.invoke.mockRejectedValue(new CloudflareApiError(503, 'AUTH_VERIFICATION_UNAVAILABLE'));
  const { signInAdmin } = await import('../lib/admin-session');
  await expect(signInAdmin('admin@example.test', 'synthetic')).rejects.toMatchObject({ status: 503 });
  expect(mocks.logout).not.toHaveBeenCalled();
});
