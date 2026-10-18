import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { getClerk } = vi.hoisted(() => ({ getClerk: vi.fn() }));
vi.mock('../lib/clerk-browser', () => ({ getClerk, clerkErrorMessage: (_error: unknown, fallback: string) => fallback }));
import { sendEmailLoginCode, signInWithPasswordAccount } from '../lib/user-session';

beforeEach(() => { getClerk.mockReset(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

it('uses the email factor returned by the identity service to send the code', async () => {
  const prepareFirstFactor = vi.fn().mockResolvedValue({});
  const create = vi.fn().mockResolvedValue({
    supportedFirstFactors: [{ strategy: 'password' }, { strategy: 'email_code', emailAddressId: 'idn_verified_email' }],
    prepareFirstFactor
  });
  getClerk.mockResolvedValue({ client: { signIn: { create } } });
  await sendEmailLoginCode('User@example.test');
  expect(create).toHaveBeenCalledWith({ identifier: 'user@example.test' });
  expect(prepareFirstFactor).toHaveBeenCalledExactlyOnceWith({ strategy: 'email_code', emailAddressId: 'idn_verified_email' });
});

it('does not send an invalid request when email-code login is not supported', async () => {
  const prepareFirstFactor = vi.fn();
  getClerk.mockResolvedValue({ client: { signIn: { create: vi.fn().mockResolvedValue({ supportedFirstFactors: [{ strategy: 'password' }], prepareFirstFactor }) } } });
  await expect(sendEmailLoginCode('user@example.test')).rejects.toThrow('请使用密码登录');
  expect(prepareFirstFactor).not.toHaveBeenCalled();
});

it('reports a token network failure as a connection problem, not an invalid verification code', async () => {
  getClerk.mockRejectedValue(new Error('Network error fetching session token'));
  await expect(signInWithPasswordAccount({ identifier: 'user@example.test', password: 'synthetic' })).rejects.toThrow('登录服务暂时不可用');
});
