import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
const mocks=vi.hoisted(()=>({read:vi.fn(),save:vi.fn(),legacy:vi.fn(),scope:'session-a'}));
vi.mock('../lib/clerk-d1-session',()=>({d1ClientForUser:async()=>({sessionScope:mocks.scope,workbench:mocks.read,saveWorkbench:mocks.save})}));
vi.mock('../lib/supabase-browser',()=>({getSupabaseBrowserClient:mocks.legacy}));
beforeEach(()=>{vi.resetModules();vi.stubEnv('NEXT_PUBLIC_BACKEND_PROVIDER','d1');mocks.scope='session-a';const storage=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)||null,setItem:(key:string,value:string)=>storage.set(key,value)});mocks.read.mockReset();mocks.save.mockReset();mocks.legacy.mockReset();});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
const owner='00000000-0000-4000-8000-000000000001';
describe('D1 workbench synchronization',()=>{
 it('hydrates without writing and skips saving a state already equal to the cloud baseline',async()=>{mocks.read.mockResolvedValue({completed_todo_ids:['r'],custom_todos:[],mentor_contacts:[],sync_revision:3});const {hydrateWorkbenchState,saveWorkbenchState}=await import('../lib/workbench-state');const state=await hydrateWorkbenchState(owner,{completedTodoIds:[],customTodos:[],contacts:[]});await saveWorkbenchState(owner,state);expect(mocks.save).not.toHaveBeenCalled();expect(mocks.legacy).not.toHaveBeenCalled();});
 it('preserves local edits on failed saves and does not advance the revision',async()=>{mocks.read.mockResolvedValue({completed_todo_ids:[],custom_todos:[],mentor_contacts:[],sync_revision:3});mocks.save.mockRejectedValue(Error('maintenance'));const {hydrateWorkbenchState,saveWorkbenchState}=await import('../lib/workbench-state');const local={completedTodoIds:[],customTodos:[{id:'local',text:'keep this local draft'}],contacts:[]};const state=await hydrateWorkbenchState(owner,local);await expect(saveWorkbenchState(owner,state)).rejects.toThrow('maintenance');expect(local.customTodos[0].text).toBe('keep this local draft');mocks.save.mockResolvedValue({sync_revision:4});await saveWorkbenchState(owner,state);expect(mocks.save.mock.calls.map(c=>c[0])).toEqual([3,3]);});
 it('rejects an incomplete response instead of clearing local notes',async()=>{mocks.read.mockResolvedValue({custom_todos:[],sync_revision:1});const {hydrateWorkbenchState}=await import('../lib/workbench-state');const local={completedTodoIds:['keep'],customTodos:[],contacts:[]};await expect(hydrateWorkbenchState(owner,local)).rejects.toThrow('不完整');expect(local.completedTodoIds).toEqual(['keep']);expect(mocks.save).not.toHaveBeenCalled();});
 it('null cloud state retains local drafts and creates only on an explicit save',async()=>{mocks.read.mockResolvedValue(null);mocks.save.mockResolvedValue({sync_revision:1});const {hydrateWorkbenchState,saveWorkbenchState}=await import('../lib/workbench-state');const local={completedTodoIds:[],customTodos:[{id:'draft',text:'local'}],contacts:[]};expect(await hydrateWorkbenchState(owner,local)).toBe(local);expect(mocks.save).not.toHaveBeenCalled();await saveWorkbenchState(owner,local);expect(mocks.save.mock.calls[0][0]).toBe(0);});
});

const empty={completedTodoIds:[],customTodos:[],contacts:[]};
const row=(todos:{id:string;text:string;note?:string}[],revision=1,done:string[]=[])=>({completed_todo_ids:done,custom_todos:todos,mentor_contacts:[],sync_revision:revision});
describe('persisted three-way workbench reconciliation',()=>{
 it('does not resurrect another device deletion or unchecked completion after reloading the module',async()=>{
  mocks.read.mockResolvedValue(row([{id:'a',text:'original'}],1,['a']));
  const first=await import('../lib/workbench-state');const local=await first.hydrateWorkbenchState(owner,empty);
  vi.resetModules();mocks.read.mockResolvedValue(row([],2));const next=await import('../lib/workbench-state');
  const merged=await next.hydrateWorkbenchState(owner,local);expect(merged).toEqual(empty);await next.saveWorkbenchState(owner,merged);expect(mocks.save).not.toHaveBeenCalled();
 });
 it('keeps offline additions and local deletions while importing independent cloud changes',async()=>{
  mocks.read.mockResolvedValue(row([{id:'a',text:'original'},{id:'b',text:'old'}]));const api=await import('../lib/workbench-state');await api.hydrateWorkbenchState(owner,empty);
  mocks.read.mockResolvedValue(row([{id:'a',text:'original'},{id:'b',text:'remote edit'}],2));
  const merged=await api.hydrateWorkbenchState(owner,{...empty,customTodos:[{id:'b',text:'old'},{id:'c',text:'offline new'}]});
  expect(merged.customTodos).toEqual([{id:'b',text:'remote edit',category:'申请',priority:'重要不紧急'},{id:'c',text:'offline new',category:'申请',priority:'重要不紧急'}]);
 });
 it('holds conflicting changes and keeps the old baseline and draft intact',async()=>{
  mocks.read.mockResolvedValue(row([{id:'a',text:'original'}]));const api=await import('../lib/workbench-state');await api.hydrateWorkbenchState(owner,empty);
  const before=localStorage.getItem('seekoffer:workbench-baseline:v1:'+owner),local={...empty,customTodos:[{id:'a',text:'offline'}]};mocks.read.mockResolvedValue(row([{id:'a',text:'remote'}],2));
  await expect(api.hydrateWorkbenchState(owner,local)).rejects.toThrow('未覆盖任何一方');expect(local.customTodos[0].text).toBe('offline');expect(localStorage.getItem('seekoffer:workbench-baseline:v1:'+owner)).toBe(before);expect(mocks.save).not.toHaveBeenCalled();
 });
 it('merges separate fields of the same task but rejects delete-versus-edit',async()=>{
  mocks.read.mockResolvedValue(row([{id:'a',text:'original',note:'old'}]));const api=await import('../lib/workbench-state');await api.hydrateWorkbenchState(owner,empty);
  mocks.read.mockResolvedValue(row([{id:'a',text:'remote',note:'old'}],2));
  expect((await api.hydrateWorkbenchState(owner,{...empty,customTodos:[{id:'a',text:'original',note:'offline'}]})).customTodos).toEqual([{id:'a',text:'remote',note:'offline',category:'申请',priority:'重要不紧急'}]);
  mocks.read.mockResolvedValue(row([],3));await expect(api.hydrateWorkbenchState(owner,{...empty,customTodos:[{id:'a',text:'remote',note:'offline'}]})).rejects.toThrow('未覆盖任何一方');
 });
 it('serializes rapid saves with successive revisions',async()=>{
  mocks.read.mockResolvedValue(row([]));const api=await import('../lib/workbench-state');await api.hydrateWorkbenchState(owner,empty);
  let release!:(value:unknown)=>void;mocks.save.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;})).mockResolvedValueOnce({sync_revision:3});
  const first=api.saveWorkbenchState(owner,{...empty,completedTodoIds:['a']});await vi.waitFor(()=>expect(mocks.save).toHaveBeenCalledTimes(1));
  const second=api.saveWorkbenchState(owner,{...empty,completedTodoIds:['a','b']});await Promise.resolve();expect(mocks.save).toHaveBeenCalledTimes(1);release({sync_revision:2});await Promise.all([first,second]);expect(mocks.save.mock.calls.map(call=>call[0])).toEqual([1,2]);
 });
 it('stops queued saves after quota failure and handles a lost response by reading once without writing again',async()=>{
  mocks.read.mockResolvedValue(row([]));const api=await import('../lib/workbench-state');await api.hydrateWorkbenchState(owner,empty);
  let fail!:(error:Error)=>void;mocks.save.mockImplementationOnce(()=>new Promise((_resolve,reject)=>{fail=reject;}));
  const a=api.saveWorkbenchState(owner,{...empty,completedTodoIds:['a']});await vi.waitFor(()=>expect(mocks.save).toHaveBeenCalledTimes(1));const b=api.saveWorkbenchState(owner,{...empty,completedTodoIds:['a','b']});const done=Promise.allSettled([a,b]);await Promise.resolve();fail(Error('402'));expect((await done).every(value=>value.status==='rejected')).toBe(true);expect(mocks.save).toHaveBeenCalledTimes(1);
  mocks.read.mockResolvedValue(row([],2,['a']));const merged=await api.hydrateWorkbenchState(owner,{...empty,completedTodoIds:['a']});await api.saveWorkbenchState(owner,merged);expect(mocks.save).toHaveBeenCalledTimes(1);
 });
 it('requires a fresh baseline after session change and isolates another owner',async()=>{
  mocks.read.mockResolvedValue(row([]));const api=await import('../lib/workbench-state');await api.hydrateWorkbenchState(owner,empty);mocks.scope='session-b';
  await expect(api.saveWorkbenchState(owner,{...empty,completedTodoIds:['a']})).rejects.toThrow('基线');
  await expect(api.saveWorkbenchState('different-owner',{...empty,completedTodoIds:['a']})).rejects.toThrow('基线');expect(mocks.save).not.toHaveBeenCalled();
 });
 it('does not replace corrupted stored baselines or draft data with an empty result',async()=>{
  localStorage.setItem('seekoffer:workbench-baseline:v1:'+owner,'{invalid');mocks.read.mockResolvedValue(row([]));const api=await import('../lib/workbench-state');
  await expect(api.hydrateWorkbenchState(owner,empty)).rejects.toThrow('无法读取');expect(localStorage.getItem('seekoffer:workbench-baseline:v1:'+owner)).toBe('{invalid');expect(mocks.save).not.toHaveBeenCalled();
 });
});
