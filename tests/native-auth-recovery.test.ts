import { beforeEach, describe, expect, it, vi } from 'vitest';
const ipc = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke: ipc }));

const session = { accessToken: 'synthetic-token', expiresAt: 1000, subject: 'user_synthetic', email: 'synthetic@example.invalid', sessionId: 'synthetic-session' };
beforeEach(() => { vi.resetModules(); ipc.mockReset(); });

describe('native account recovery', () => {
  it('invalidates unusable cloud credentials while exposing a specific re-login state', async () => {
    const bridge = await import('../lib/native-auth-bridge');
    const state = await import('../lib/desktop-auth-state');
    ipc.mockResolvedValueOnce(session);
    const browser = await bridge.loadNativeClerkBrowser();
    const identityListener = vi.fn();
    browser.addListener(identityListener);
    ipc.mockRejectedValueOnce('NATIVE_REAUTHENTICATION_REQUIRED');
    await expect(browser.session!.getToken()).rejects.toMatchObject({ code: 'NATIVE_REAUTHENTICATION_REQUIRED' });
    expect(browser.session).toBeNull();
    expect(state.getDesktopAuthState().status).toBe('reauth-required');
    // Expiration must not broadcast an explicit sign-out that removes the cached owner.
    expect(identityListener).not.toHaveBeenCalled();
  });

  it('signs out directly even when hydration requires reauthentication', async () => {
    const bridge = await import('../lib/native-auth-bridge');
    ipc.mockRejectedValueOnce('NATIVE_REAUTHENTICATION_REQUIRED');
    await expect(bridge.loadNativeClerkBrowser()).rejects.toThrow();
    ipc.mockResolvedValueOnce(undefined);
    await bridge.signOutNativeSession();
    expect(ipc.mock.calls.map(call => call[0])).toEqual(['native_auth_session', 'native_auth_sign_out']);
    expect((await import('../lib/desktop-auth-state')).getDesktopAuthState().status).toBe('signed-out');
  });

  it('does not let an old hydration response restore a signed-out identity', async () => {
    const bridge = await import('../lib/native-auth-bridge');
    let finish!: (value: typeof session) => void;
    ipc.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const loading = bridge.loadNativeClerkBrowser();
    ipc.mockResolvedValueOnce(undefined);
    await bridge.signOutNativeSession();
    finish(session); await loading;
    expect(bridge.getNativeClerkBrowser().user).toBeNull();
  });

  it('ignores late login completion after an explicit sign-out', async () => {
    const bridge = await import('../lib/native-auth-bridge');
    let finish!: (value: typeof session) => void;
    ipc.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const login = bridge.startNativeLogin();
    ipc.mockResolvedValueOnce(undefined);
    await bridge.signOutNativeSession();
    finish(session);
    await expect(login).rejects.toMatchObject({ code: 'NATIVE_LOGIN_CANCELLED' });
    expect(bridge.getNativeClerkBrowser().session).toBeNull();
  });

  it('keeps an offline owner distinct from an invalidated login and can retry', async () => {
    const bridge = await import('../lib/native-auth-bridge');
    const state = await import('../lib/desktop-auth-state');
    ipc.mockResolvedValueOnce(session);
    await bridge.loadNativeClerkBrowser();
    ipc.mockRejectedValueOnce('NATIVE_AUTH_UNAVAILABLE');
    await expect(bridge.loadNativeClerkBrowser()).rejects.toThrow('暂时无法连接');
    expect(state.getDesktopAuthState().status).toBe('offline');
    expect(bridge.getNativeClerkBrowser().user?.id).toBe(session.subject);
    ipc.mockResolvedValueOnce(session);
    await expect(bridge.loadNativeClerkBrowser()).resolves.toMatchObject({ user: { id: session.subject } });
  });
});
