import {it,expect,vi,beforeEach,afterEach} from 'vitest';
const mocks=vi.hoisted(()=>({client:vi.fn(),applications:vi.fn(),notices:vi.fn(),legacy:vi.fn()}));
vi.mock('../lib/clerk-d1-session',()=>({d1ClientForUser:mocks.client,updateD1Profile:vi.fn(),D1SessionChangedError:class extends Error{}}));
vi.mock('../lib/user-session',()=>({getUserSession:()=>({loggedIn:true,authProvider:'password',userId:'00000000-0000-4000-8000-000000000001'}),updateUserProfile:vi.fn()}));
vi.mock('../lib/supabase-browser',()=>({getSupabaseBrowserClient:mocks.legacy}));
const row={id:'application-a',project_id:'notice-a',sync_revision:1,is_favorited:true,my_status:'已收藏',priority_level:'中',materials_progress:0,cv_ready:false,transcript_ready:false,ranking_proof_ready:false,recommendation_ready:false,personal_statement_ready:false,contact_supervisor_done:false,submitted_at:'',interview_time:'',result_status:'未出结果',my_notes:'private cached note',custom_reminder_enabled:true};
beforeEach(()=>{vi.resetModules();vi.stubEnv('NEXT_PUBLIC_BACKEND_PROVIDER','d1');const data=new Map();vi.stubGlobal('window',{localStorage:{getItem:(key:string)=>data.get(key)||null,setItem:(key:string,value:string)=>data.set(key,value)}});mocks.applications.mockReset().mockResolvedValue([row]);mocks.notices.mockReset().mockResolvedValue({items:[],unavailableIds:['notice-a']});mocks.client.mockReset().mockResolvedValue({applications:mocks.applications,applicationNotices:mocks.notices,sessionScope:'synthetic-a'});mocks.legacy.mockReset();});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('auth rejection never displays a cached private application as an offline fallback',async()=>{
 const {fetchApplicationRows}=await import('../lib/cloudbase-data');const {D1RequestError}=await import('../lib/d1-backend-client');expect(await fetchApplicationRows()).toHaveLength(1);
 for(const status of [401,403]){mocks.applications.mockRejectedValue(new D1RequestError(status));await expect(fetchApplicationRows()).rejects.toMatchObject({status});}
 expect(mocks.legacy).not.toHaveBeenCalled();
});
it('503 preserves the same verified owner record and shows an explicit offline state',async()=>{
 const {fetchApplicationRows}=await import('../lib/cloudbase-data');const {D1RequestError}=await import('../lib/d1-backend-client');await fetchApplicationRows();mocks.applications.mockRejectedValue(new D1RequestError(503));const rows=await fetchApplicationRows();expect(rows[0].item.myNotes).toBe('private cached note');expect(rows[0].syncStatus).toBe('offline');expect(rows[0].noticeAvailable).toBe(false);expect(mocks.legacy).not.toHaveBeenCalled();
});
