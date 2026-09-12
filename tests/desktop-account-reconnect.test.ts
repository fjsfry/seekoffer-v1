import {beforeEach,describe,it,vi,expect} from 'vitest';
const mocks=vi.hoisted(()=>({owner:'owner-a',confirm:vi.fn(),prepare:vi.fn()}));
vi.mock('../lib/backend-mode',()=>({isD1Backend:()=>true}));
vi.mock('../lib/user-session',()=>({getUserSession:()=>({userId:mocks.owner}),confirmD1UserSession:mocks.confirm}));
vi.mock('../lib/clerk-d1-session',()=>({prepareExplicitD1SignInRetry:mocks.prepare,D1SessionChangedError:class extends Error{}}));
import {reconnectDesktopAccount} from '../lib/desktop-account-reconnect';
beforeEach(()=>{mocks.owner='owner-a';mocks.prepare.mockReset();mocks.confirm.mockReset().mockResolvedValue({userId:'owner-a'});});
describe('explicit desktop account reconnect',()=>{
 it('restores the verified binding before returning and joins concurrent requests',async()=>{const a=reconnectDesktopAccount('owner-a'),b=reconnectDesktopAccount('owner-a');expect(a).toBe(b);await a;expect(mocks.confirm).toHaveBeenCalledOnce();expect(mocks.prepare).toHaveBeenCalledOnce();});
 it('does not silently accept a changed account or swallow a quota failure',async()=>{await expect(reconnectDesktopAccount('owner-b')).rejects.toThrow();expect(mocks.confirm).not.toHaveBeenCalled();mocks.confirm.mockResolvedValueOnce({userId:'owner-b'});await expect(reconnectDesktopAccount('owner-a')).rejects.toThrow();mocks.prepare.mockImplementationOnce(()=>{throw Error('QUOTA_COOLDOWN');});await expect(reconnectDesktopAccount('owner-a')).rejects.toThrow('QUOTA_COOLDOWN');expect(mocks.confirm).toHaveBeenCalledTimes(1);});
});
