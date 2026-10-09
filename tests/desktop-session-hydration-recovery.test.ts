import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ hydrate: vi.fn(), signOut: vi.fn() }));
vi.mock('../lib/backend-mode', () => ({ isD1Backend: () => true }));
vi.mock('../lib/supabase-browser', () => ({ getSupabaseBrowserClient: vi.fn() }));
vi.mock('../lib/supabase-env', () => ({ SEEKOFFER_SITE_URL: 'https://www.seekoffer.com.cn', SUPABASE_ENABLE_PHONE_AUTH: false, isSupabaseConfigured: () => false }));
vi.mock('../lib/clerk-d1-session', () => ({ hydrateClerkD1Session: auth.hydrate, signOutClerkSession: auth.signOut, watchClerkIdentity: vi.fn(), D1SessionChangedError: class extends Error {} }));
const storage = new Map<string, string>();
const cached = { loggedIn: true, authProvider: 'password', userId: '00000000-0000-4000-8000-000000000001', email: 'synthetic@example.invalid', phone: '', profile: { nickname: '本机资料', age: '', undergraduateSchool: '', major: '', grade: '大四', targetMajor: '', targetRegion: '' } };
beforeEach(() => {
  vi.resetModules(); auth.hydrate.mockReset(); auth.signOut.mockReset().mockResolvedValue(undefined);
  vi.stubEnv('NEXT_PUBLIC_SEEKOFFER_SURFACE', 'desktop');
  storage.clear(); storage.set('seekoffer-d1-user-session', JSON.stringify(cached));
  storage.set('seekoffer-workbench-synthetic-owner', 'retained-draft');
  const target = new EventTarget();
  vi.stubGlobal('window', Object.assign(target, { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) } }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('desktop cached account and cloud connection', () => {
  it('keeps local identity and drafts accessible when seven-day reauthorization is due', async () => {
    const state = await import('../lib/desktop-auth-state');
    auth.hydrate.mockRejectedValue(state.nativeAuthError('NATIVE_REAUTHENTICATION_REQUIRED'));
    const user = await import('../lib/user-session');
    expect(await user.hydrateSupabaseSession()).toEqual(cached);
    expect(state.getDesktopAuthState().status).toBe('reauth-required');
    expect(user.getSessionHydrationError()).toContain('重新');
    expect(storage.get('seekoffer-workbench-synthetic-owner')).toBe('retained-draft');
    await expect(user.confirmD1UserSession()).rejects.toMatchObject({ code: 'NATIVE_REAUTHENTICATION_REQUIRED' });
  });

  it('treats a missing native credential as re-login, not a verified cloud account', async () => {
    auth.hydrate.mockResolvedValue(null);
    const user = await import('../lib/user-session');
    await user.hydrateSupabaseSession();
    expect(user.getUserSession()?.userId).toBe(cached.userId);
    expect((await import('../lib/desktop-auth-state')).getDesktopAuthState().status).toBe('reauth-required');
  });

  it('clears only the profile identity on explicit sign-out and does not hydrate first', async () => {
    const user = await import('../lib/user-session');
    await user.signOutUser();
    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(auth.hydrate).not.toHaveBeenCalled();
    expect(user.getUserSession()).toBeNull();
    expect(storage.get('seekoffer-workbench-synthetic-owner')).toBe('retained-draft');
  });

  it('restores connected state only after validating the account profile', async () => {
    const state = await import('../lib/desktop-auth-state');
    state.setDesktopAuthState('reauth-required');
    auth.hydrate.mockResolvedValue(cached);
    const user = await import('../lib/user-session');
    await user.confirmD1UserSession();
    expect(state.getDesktopAuthState().status).toBe('ready');
    expect(user.getSessionHydrationError()).toBe('');
  });
});
