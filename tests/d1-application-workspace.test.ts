import {describe,it,expect,vi} from 'vitest';
import {createApplicationWorkspace,applicationJournalKey} from '../lib/d1-application-workspace';
import {createD1BackendClient,D1RequestError} from '../lib/d1-backend-client';
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const row=(revision=1)=>({id:'application-a',project_id:'notice-a',sync_revision:revision,is_favorited:true,my_status:'已收藏',priority_level:'中',materials_progress:0,cv_ready:false,transcript_ready:false,ranking_proof_ready:false,recommendation_ready:false,personal_statement_ready:false,contact_supervisor_done:false,submitted_at:'',interview_time:'',result_status:'未出结果',my_notes:'original',custom_reminder_enabled:true});
function setup(){
 const data=new Map<string,string>(),storage={getItem:(key:string)=>data.get(key)||null,setItem:(key:string,v:string)=>{data.set(key,v);}};
 const client={...createD1BackendClient('http://localhost',async()=>'synthetic',vi.fn()),sessionScope:'fixture',applications:vi.fn().mockResolvedValue([row()]),application:vi.fn().mockResolvedValue(row()),updateApplication:vi.fn(),deleteApplication:vi.fn(),addApplication:vi.fn(),createManualProject:vi.fn(),applicationNotices:vi.fn()};
 let current=true;const ws=createApplicationWorkspace(owner,storage,async()=>client,()=>current);
 return {ws,client,storage,data,switchAway:()=>{current=false;}};
}
describe('D1 application journal and concurrency',()=>{
 it('keeps a failed edit across reload, preserves its revision, and never saves during reads',async()=>{
  const {ws,client,storage}=setup();await ws.read();client.updateApplication.mockRejectedValue(new D1RequestError(503));
  await expect(ws.update('application-a',{my_notes:'pending note'})).rejects.toMatchObject({status:503});
  const reload=createApplicationWorkspace(owner,storage,async()=>client,()=>true);expect((await reload.read())[0].my_notes).toBe('pending note');expect(reload.pending().updates).toEqual(['application-a']);
  client.updateApplication.mockResolvedValue({id:'application-a',sync_revision:2});await reload.update('application-a',{my_notes:'pending note'});
  expect(client.updateApplication.mock.calls.map(c=>c[1])).toEqual([1,1]);expect(reload.pending().updates).toEqual([]);expect(reload.cached()[0].my_notes).toBe('pending note');
 });
 it('does not clear cached applications on null, malformed, duplicate or empty responses',async()=>{
  const {ws,client}=setup();await ws.read();for(const value of [null,{},[row(),row()],[]]){client.applications.mockResolvedValue(value);await expect(ws.read()).rejects.toThrow();expect(ws.cached()).toHaveLength(1);}
 });
 it('does not rebase a pending draft silently over a changed server revision',async()=>{
  const {ws,client}=setup();await ws.read();client.updateApplication.mockRejectedValue(new D1RequestError(409));await expect(ws.update('application-a',{my_notes:'mine'})).rejects.toThrow();client.applications.mockResolvedValue([{...row(2),my_notes:'another device'}]);await ws.read();await expect(ws.update('application-a',{my_notes:'mine again'})).rejects.toThrow();expect(client.updateApplication.mock.calls[1][1]).toBe(1);expect(ws.cached()[0].my_notes).toBe('mine again');
 });
 it('a stale read cannot overwrite a completed update',async()=>{
  const {ws,client}=setup();await ws.read();let resolve!:(rows:ReturnType<typeof row>[])=>void;client.applications.mockImplementation(()=>new Promise(r=>{resolve=r;}));const read=ws.read();await vi.waitFor(()=>expect(resolve).toBeTypeOf('function'));
  client.updateApplication.mockResolvedValue({id:'application-a',sync_revision:2});await ws.update('application-a',{my_notes:'new'});resolve([row()]);expect((await read)[0].my_notes).toBe('new');expect(ws.cached()[0].sync_revision).toBe(2);
 });
 it('switching accounts rejects late results and never writes the next account journal',async()=>{
  const {ws,client,storage,data,switchAway}=setup();await ws.read();let resolve!:(r:unknown)=>void;client.updateApplication.mockImplementation(()=>new Promise(r=>{resolve=r;}));const update=ws.update('application-a',{my_notes:'private A'});await vi.waitFor(()=>expect(resolve).toBeTypeOf('function'));switchAway();resolve({id:'application-a',sync_revision:2});await expect(update).rejects.toThrow('账号已切换');expect(data.has(applicationJournalKey(other))).toBe(false);expect(storage.getItem(applicationJournalKey(owner))).toContain('private A');
 });
 it('a failed or mismatched delete retains the application until confirmed',async()=>{
  const {ws,client}=setup();await ws.read();client.deleteApplication.mockResolvedValue({id:'wrong',deleted:true});await expect(ws.remove('application-a')).rejects.toThrow();expect(ws.cached()).toHaveLength(1);expect(ws.pending().deletes).toEqual(['application-a']);client.deleteApplication.mockResolvedValue({id:'application-a',deleted:true});expect(await ws.remove('application-a')).toBe(true);expect(ws.cached()).toEqual([]);client.applications.mockResolvedValue([]);expect(await ws.read()).toEqual([]);
 });
 it('keeps manual creation idempotency until both application and details can be read',async()=>{
  const {ws,client}=setup();const project={schoolName:'Synthetic',projectName:'Manual',projectType:'夏令营'};client.createManualProject.mockResolvedValue({projectId:'custom-synthetic',application:{id:'application-a',sync_revision:1}});client.applications.mockResolvedValue([{...row(),project_id:'custom-synthetic'}]);client.applicationNotices.mockRejectedValue(new D1RequestError(503));await expect(ws.manual(project)).rejects.toThrow();client.applicationNotices.mockResolvedValue({items:[{id:'custom-synthetic'}],unavailableIds:[]});await ws.manual(project);expect(client.createManualProject.mock.calls[0][0]).toBe(client.createManualProject.mock.calls[1][0]);expect(ws.pending().manualCount).toBe(0);
 });
 it('persists an unconfirmed add without claiming success or resending on a normal read',async()=>{
  const {ws,client}=setup();client.addApplication.mockRejectedValue(new D1RequestError(402));await expect(ws.add('notice-b')).rejects.toMatchObject({status:402});expect(ws.pending().adds).toEqual(['notice-b']);await ws.read();expect(client.addApplication).toHaveBeenCalledTimes(1);
 });
 it('explicitly resumes a failed draft using only its application and original revision',async()=>{
  const {ws,client}=setup();await ws.read();client.updateApplication.mockRejectedValue(new D1RequestError(503));await expect(ws.update('application-a',{my_notes:'offline'})).rejects.toThrow();client.updateApplication.mockResolvedValue({id:'application-a',sync_revision:2});
  expect(await ws.resumePending()).toEqual({completed:1,remaining:0});expect(client.application).toHaveBeenCalledWith('application-a');expect(client.applications).toHaveBeenCalledTimes(1);expect(client.updateApplication).toHaveBeenLastCalledWith('application-a',1,{my_notes:'offline'});expect(ws.cached()[0].my_notes).toBe('offline');
 });
 it('recognizes a committed edit after a lost response without writing it twice',async()=>{
  const {ws,client}=setup();await ws.read();client.updateApplication.mockRejectedValue(new D1RequestError(503));await expect(ws.update('application-a',{my_notes:'already saved'})).rejects.toThrow();client.application.mockResolvedValue({...row(2),my_notes:'already saved'});
  expect(await ws.resumePending()).toEqual({completed:1,remaining:0});expect(client.updateApplication).toHaveBeenCalledTimes(1);expect(ws.cached()[0].sync_revision).toBe(2);
 });
 it('stops on a different remote version without overwriting it or replaying later additions',async()=>{
  const {ws,client}=setup();await ws.read();client.updateApplication.mockRejectedValue(new D1RequestError(503));await expect(ws.update('application-a',{my_notes:'mine'})).rejects.toThrow();client.addApplication.mockRejectedValue(new D1RequestError(503));await expect(ws.add('notice-b')).rejects.toThrow();client.application.mockResolvedValue({...row(2),my_notes:'other device'});
  await expect(ws.resumePending()).rejects.toMatchObject({status:409,code:'REVISION_CONFLICT'});expect(client.updateApplication).toHaveBeenCalledTimes(1);expect(client.addApplication).toHaveBeenCalledTimes(1);expect(ws.cached()[0].my_notes).toBe('mine');expect(ws.pending().adds).toEqual(['notice-b']);
 });
 it('resolves a lost delete only after an explicit owner-scoped not-found response',async()=>{
  const {ws,client}=setup();await ws.read();client.deleteApplication.mockRejectedValue(new D1RequestError(503));await expect(ws.remove('application-a')).rejects.toThrow();
  for(const invalid of [null,[],{...row(),id:'wrong'}]){client.application.mockResolvedValue(invalid);await expect(ws.resumePending()).rejects.toMatchObject({status:502});expect(ws.cached()).toHaveLength(1);}
  client.application.mockRejectedValue(new D1RequestError(404));await expect(ws.resumePending()).rejects.toMatchObject({status:404});expect(ws.cached()).toHaveLength(1);
  client.application.mockRejectedValue(new D1RequestError(404,'APPLICATION_NOT_FOUND'));expect(await ws.resumePending()).toEqual({completed:1,remaining:0});expect(client.deleteApplication).toHaveBeenCalledTimes(1);expect(ws.cached()).toEqual([]);
 });
 it('keeps a missing application draft instead of recreating or discarding it',async()=>{
  const {ws,client}=setup();await ws.read();client.updateApplication.mockRejectedValue(new D1RequestError(503));await expect(ws.update('application-a',{my_notes:'important'})).rejects.toThrow();client.application.mockRejectedValue(new D1RequestError(404,'APPLICATION_NOT_FOUND'));
  await expect(ws.resumePending()).rejects.toMatchObject({status:404});expect(ws.pending().updates).toEqual(['application-a']);expect(ws.cached()[0].my_notes).toBe('important');expect(client.addApplication).not.toHaveBeenCalled();
 });
 it('bounds each manual batch without dropping queued edits beyond that batch',async()=>{
  const {ws,client}=setup(),rows=Array.from({length:27},(_,i)=>({...row(),id:'app-'+i,project_id:'notice-'+i}));client.applications.mockResolvedValue(rows);await ws.read();client.updateApplication.mockRejectedValue(new D1RequestError(503));for(const r of rows)await expect(ws.update(r.id,{my_notes:'local-'+r.id})).rejects.toThrow();
  client.application.mockImplementation(async(id:string)=>rows.find(r=>r.id===id));client.updateApplication.mockImplementation(async(id:string)=>({id,sync_revision:2}));expect(await ws.resumePending()).toEqual({completed:20,remaining:7});expect(ws.pending().updates).toHaveLength(7);expect(await ws.resumePending()).toEqual({completed:7,remaining:0});expect(ws.cached()).toHaveLength(27);expect(client.applications).toHaveBeenCalledTimes(1);
 });
 it('stops after a quota error without repeating requests or clearing queued work',async()=>{
  const {ws,client}=setup();await ws.read();client.updateApplication.mockRejectedValue(new D1RequestError(503));await expect(ws.update('application-a',{my_notes:'pending'})).rejects.toThrow();client.addApplication.mockRejectedValue(new D1RequestError(503));await expect(ws.add('notice-b')).rejects.toThrow();client.updateApplication.mockRejectedValue(new D1RequestError(402));
  await expect(ws.resumePending()).rejects.toMatchObject({status:402});expect(client.updateApplication).toHaveBeenCalledTimes(2);expect(client.addApplication).toHaveBeenCalledTimes(1);expect(ws.pending().updates).toHaveLength(1);expect(ws.pending().adds).toHaveLength(1);
 });
 it('does not issue a follow-up read or erase the journal after an account switch',async()=>{
  const {ws,client,storage,switchAway}=setup();client.addApplication.mockRejectedValue(new D1RequestError(503));await expect(ws.add('notice-b')).rejects.toThrow();const original=storage.getItem(applicationJournalKey(owner));client.addApplication.mockImplementation(async()=>{switchAway();return{id:'new-app',sync_revision:1};});
  await expect(ws.resumePending()).rejects.toThrow('账号已切换');expect(client.application).not.toHaveBeenCalled();expect(storage.getItem(applicationJournalKey(owner))).toBe(original);
 });
 it('reuses a manual project request ID and confirms only the exact associated application',async()=>{
  const {ws,client}=setup(),project={schoolName:'Synthetic',projectName:'Private',projectType:'夏令营'};client.createManualProject.mockRejectedValue(new D1RequestError(503));await expect(ws.manual(project)).rejects.toThrow();const requestId=client.createManualProject.mock.calls[0][0];
  client.createManualProject.mockResolvedValue({projectId:'custom-synthetic',application:{id:'application-a',sync_revision:1}});client.application.mockResolvedValue({...row(),project_id:'custom-synthetic'});client.applicationNotices.mockResolvedValue({items:[{id:'custom-synthetic'}],unavailableIds:[]});
  expect(await ws.resumePending()).toEqual({completed:1,remaining:0});expect(client.createManualProject).toHaveBeenLastCalledWith(requestId,project);expect(client.applicationNotices).toHaveBeenCalledWith(['custom-synthetic']);expect(client.applications).not.toHaveBeenCalled();
 });
});
