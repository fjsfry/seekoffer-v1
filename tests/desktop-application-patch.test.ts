import {describe,it,expect} from 'vitest';
import {desktopApplicationPatch} from '../lib/desktop-application-patch';
import type {UserProjectRecord} from '../lib/mock-data';

describe('desktop application partial writes',()=>{
 const row={myNotes:'保留的完整备注',myStatus:'已提交',materialsProgress:40,cvReady:true,userId:'owner',projectId:'notice'} as UserProjectRecord;
 it('never sends material, status or identity fields with a note edit',()=>{
  expect(desktopApplicationPatch(row,{myNotes:row.myNotes})).toEqual({my_notes:row.myNotes});
 });
 it('retains an explicitly empty note and does not substitute a default',()=>{
  expect(desktopApplicationPatch({...row,myNotes:''},{myNotes:''})).toEqual({my_notes:''});
 });
 it('includes the derived progress only when passed by the material update caller',()=>{
  expect(desktopApplicationPatch(row,{cvReady:true,materialsProgress:40})).toEqual({cv_ready:true,materials_progress:40});
 });
 it('rejects unsupported fields rather than silently dropping them',()=>{
  expect(()=>desktopApplicationPatch(row,{myNotes:'x',unknown:'y'} as Partial<UserProjectRecord>)).toThrow('不支持');
  expect(()=>desktopApplicationPatch(row,{userId:'owner'})).toThrow('没有可保存');
 });
});
