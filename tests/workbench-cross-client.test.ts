import {describe,it,expect} from 'vitest';
import {mergeWorkbenchState,normalizeCustomTodos,normalizeContacts,type WorkbenchState} from '../lib/workbench-state';
import {reconcileWorkbench} from '../lib/workbench-reconciliation';
const empty:WorkbenchState={completedTodoIds:[],customTodos:[],contacts:[]};
describe('shared website and desktop workbench contract',()=>{
 it('preserves extended fields and unrecognized personal fields across repeated serialization',()=>{
  const notes='长备注'.repeat(500);
  const input={...empty,customTodos:[{id:'todo',text:'test',category:'作业',priority:'重要且紧急',completed:false,deletedAt:'2026-09-12T00:00:00Z',note:notes,extension:{version:2,keep:true}}],contacts:[{id:'mentor',mentorName:'test',photoCacheKey:'a'.repeat(64)+'.jpg',photoSourceUrl:'https://example.org/photo.jpg',photoPageUrl:'https://example.org/',photoUpdatedAt:'2026-09-12',contactChannel:'邮件',nextFollowUpDate:'2026-09-15',privacyNotice:'个人记录',deletedAt:'2026-09-12T00:00:00Z',notes,extension:{keep:true}}]};
  let state=mergeWorkbenchState(empty,input as unknown as WorkbenchState);
  for(let i=0;i<3;i++)state=mergeWorkbenchState(empty,JSON.parse(JSON.stringify(state)));
  expect(state.customTodos[0]).toMatchObject(input.customTodos[0]);expect(state.contacts[0]).toMatchObject(input.contacts[0]);expect(state.completedTodoIds).toEqual([]);
 });
 it('a stale copy with a newer clock cannot revive a tombstone',()=>{
  const remote={...empty,customTodos:[{id:'a',text:'deleted',deletedAt:'2026-09-11',updatedAt:'2026-09-11'}]};
  const local={...empty,customTodos:[{id:'a',text:'stale edited',updatedAt:'2099-01-01'}]};
  expect(mergeWorkbenchState(local,remote).customTodos[0].deletedAt).toBe('2026-09-11');
 });
 it('completion and deletion reconcile with the saved baseline',()=>{
  const base={...empty,completedTodoIds:['a'],customTodos:normalizeCustomTodos([{id:'a',text:'t',completed:true}]),contacts:normalizeContacts([{id:'m',mentorName:'test',nextFollowUpDate:'2026-09-13'}])};
  const remote={...empty,customTodos:normalizeCustomTodos([{id:'a',text:'t',completed:false}])};
  const merged=reconcileWorkbench(base,base,remote);expect(merged.completedTodoIds).toEqual([]);expect(merged.customTodos[0].completed).toBe(false);expect(merged.contacts).toEqual([]);
 });
 it('preserves independent offline changes but refuses an edit concurrent with deletion',()=>{
  const base={...empty,customTodos:normalizeCustomTodos([{id:'a',text:'t',priority:'重要不紧急'}])};
  const local={...base,customTodos:normalizeCustomTodos([{id:'a',text:'t',priority:'重要且紧急'}])};
  expect(()=>reconcileWorkbench(base,local,empty)).toThrow('未覆盖任何一方');expect(local.customTodos[0].priority).toBe('重要且紧急');
 });
});
