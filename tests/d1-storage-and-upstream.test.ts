import {it,expect,vi,afterEach} from 'vitest';
import {workspaceStorageKey} from '../lib/workspace-storage-scope';
import {createAvailabilityFetch} from '../lib/service-availability';
afterEach(()=>vi.unstubAllEnvs());
it('D1 caches isolate original users and never reuse legacy or guest storage keys',()=>{vi.stubEnv('NEXT_PUBLIC_BACKEND_PROVIDER','d1');const a=workspaceStorageKey('workbench','00000000-0000-4000-8000-000000000001'),b=workspaceStorageKey('workbench','00000000-0000-4000-8000-000000000002');expect(a).not.toBe(b);expect(a).not.toBe('workbench');expect(a).not.toBe(workspaceStorageKey('workbench',''));vi.stubEnv('NEXT_PUBLIC_BACKEND_PROVIDER','supabase');expect(workspaceStorageKey('workbench','')).toBe('workbench');});
it('D1 mode fails before a legacy upstream request is sent',async()=>{vi.stubEnv('NEXT_PUBLIC_BACKEND_PROVIDER','d1');const fetcher=vi.fn(),request=createAvailabilityFetch(fetcher);await expect(request('https://mnotoltpythkayguhnrk.supabase.co/rest/v1/notices')).rejects.toMatchObject({status:503});expect(fetcher).not.toHaveBeenCalled();});
