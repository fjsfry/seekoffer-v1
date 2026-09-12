import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ error: null as unknown, queried: [] as string[] }));
vi.mock('@/lib/user-session', () => ({ getUserSession: () => ({ userId:'fixture-user', authProvider:'supabase', profile:{} }), updateUserProfile: vi.fn() }));
vi.mock('@/lib/public-notice-api', () => ({ fetchPublicNoticesByIds: async (ids: string[]) => { mocks.queried.push(...ids); return {items:[],source:'supabase'}; } }));
vi.mock('@/lib/billing-api', () => ({ canCreateMoreApplications: vi.fn() }));
vi.mock('@/lib/supabase-browser', () => ({ getSupabaseBrowserClient: () => ({ from: () => {
  const query = { select:()=>query,eq:()=>query,order:()=>query,upsert:()=>Promise.resolve({error:mocks.error}),maybeSingle:()=>Promise.resolve({data:null,error:mocks.error}),then:(fn:(r:unknown)=>unknown)=>Promise.resolve({data:[],error:mocks.error}).then(fn) };
  return query;
} }) }));
const storage = new Map<string,string>();
beforeEach(() => {
  vi.resetModules();mocks.error=null;mocks.queried=[];storage.clear();
  storage.set('seekoffer-my-application-table',JSON.stringify({items:[{userProjectId:'application-fixture',userId:'fixture-user',projectId:'notice-fixture',myNotes:'保留原笔记',myStatus:'已收藏'}]}));
  vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>storage.get(k)||null,setItem:(k:string,v:string)=>storage.set(k,v)},dispatchEvent:vi.fn()});
  vi.spyOn(console,'warn').mockImplementation(()=>{});
});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('workspace emergency preservation without production writes',()=>{
  it('retains applications and notes after an authoritative empty response and missing notice',async()=>{
    const {fetchApplicationRows}=await import('@/lib/cloudbase-data');const rows=await fetchApplicationRows();
    expect(rows).toHaveLength(1);expect(rows[0].item.myNotes).toBe('保留原笔记');expect(rows[0].noticeAvailable).toBe(false);expect(mocks.queried).toEqual(['notice-fixture']);
  });
  it('rejects a failed save while retaining edited local data after a 402',async()=>{
    mocks.error={status:402,message:'fixture restriction'};
    const {updateUserProject}=await import('@/lib/cloudbase-data');
    await expect(updateUserProject('application-fixture',{myNotes:'待同步笔记'})).rejects.toMatchObject({status:402});
    expect(JSON.parse(storage.get('seekoffer-my-application-table')!).items[0].myNotes).toBe('待同步笔记');
  });
});
