import {it,expect,vi} from 'vitest';
import {inspectLegacyApplications,inspectLegacyWorkbenchStorage} from '../lib/legacy-application-recovery';
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const row={userId:owner,userProjectId:'old-application',projectId:'old-notice',myNotes:'原备注',myStatus:'已收藏'};
it('recovers exact owner candidates from the old key without changing bytes or writing',()=>{
  const raw=JSON.stringify({items:[row]}),getItem=vi.fn((key:string)=>key==='seekoffer-my-application-table'?raw:null),setItem=vi.fn();
  const storage={getItem,setItem};const result=inspectLegacyApplications(storage,owner);
  expect(result.candidates[0].record).toEqual(row);expect(result.candidates[0].storageKey).toBe('seekoffer-my-application-table');expect(setItem).not.toHaveBeenCalled();
});
it('never exposes another account or silently assigns guest records to the current account',()=>{
  const result=inspectLegacyApplications({getItem:key=>key==='seekoffer-my-application-table'?JSON.stringify([row,{...row,userId:other,myNotes:'foreign'},{...row,userId:'local-user'},{...row,userId:undefined}]):null},owner);
  expect(result.candidates).toHaveLength(1);expect(result.foreignAccountCount).toBe(1);expect(result.unassignedCount).toBe(2);expect(JSON.stringify(result.candidates)).not.toContain('foreign');
});
it('reports unreadable data and unsupported fields instead of discarding or exporting secrets',()=>{
  const r=inspectLegacyApplications({getItem:key=>key.endsWith(':guest')?'malformed':key==='seekoffer-my-application-table:'+owner?JSON.stringify([{...row,access_token:'NEVER_EXPORT'}]):null},owner);
  expect(r.candidates).toEqual([]);expect(r.invalidCount).toBe(1);expect(r.unreadableKeys).toHaveLength(1);expect(JSON.stringify(r)).not.toContain('NEVER_EXPORT');
});
it('preserves long notes and conflicting candidates without silently truncating or merging them',()=>{
  const note='长'.repeat(30000),r=inspectLegacyApplications({getItem:key=>['seekoffer-my-application-table','seekoffer-my-application-table:'+owner].includes(key)?JSON.stringify([{...row,myNotes:note}]):null},owner);
  expect(r.candidates).toHaveLength(2);expect(r.candidates[0].record.myNotes).toBe(note);
});
it('does not inspect any storage until a valid original account UUID is provided',()=>{
  const getItem=vi.fn();expect(()=>inspectLegacyApplications({getItem},'guest')).toThrow();expect(getItem).not.toHaveBeenCalled();
});
it('finds the newer account-suffixed storage format that is absent from both the global and D1 keys',()=>{
  const getItem=vi.fn((key:string)=>key==='seekoffer-my-application-table:'+owner?JSON.stringify({version:2,owner:{kind:'member',userId:owner},items:[row]}):null);
  const r=inspectLegacyApplications({getItem},owner);expect(r.candidates).toHaveLength(1);expect(r.candidates[0].record).toEqual(row);
});
it('honors the container owner even if a row claims the current user',()=>{
  const getItem=(key:string)=>key==='seekoffer-my-application-table:'+owner?JSON.stringify({owner:{kind:'member',userId:other},items:[row]}):null;
  const r=inspectLegacyApplications({getItem},owner);expect(r.candidates).toEqual([]);expect(r.foreignAccountCount).toBe(1);
});
it('does not adopt an explicitly local or anonymous container',()=>{
  const r=inspectLegacyApplications({getItem:key=>key==='seekoffer-my-application-table:local'?JSON.stringify([row]):null},owner);
  expect(r.candidates).toEqual([]);expect(r.unassignedCount).toBe(1);
});
it('counts the original account-scoped workbench cache without reading other account keys or writing',()=>{
  const getItem=vi.fn((key:string)=>key==='seekoffer-workbench-custom-todos:owner:'+owner?JSON.stringify([{id:'old-todo',text:'owned'}]):key==='seekoffer-workbench-mentor-contacts'?JSON.stringify([{id:'unassigned'}]):null);
  const r=inspectLegacyWorkbenchStorage({getItem},owner);expect(r[0].ownedCount).toBe(1);expect(r[2].unassignedCount).toBe(1);expect(getItem).toHaveBeenCalledTimes(6);expect(getItem.mock.calls.some(([key])=>key.includes(other))).toBe(false);
});
