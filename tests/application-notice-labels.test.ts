import {describe,it,expect} from 'vitest';
import {readApplicationNoticeLabels,rememberApplicationNoticeLabels} from '../lib/application-notice-labels';
describe('private application notice labels',()=>{
 it('retains only identifying labels for the same owner and removes explicit withdrawals',()=>{
  const data=new Map<string,string>();const store={getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>{data.set(k,v);}};
  rememberApplicationNoticeLabels(store,'owner-a',['n'],[{id:'n',schoolName:'学校',departmentName:'学院',projectName:'标题',remarks:'BODY_MUST_NOT_BE_CACHED',created_by:'ADMIN_MUST_NOT_BE_CACHED'}],[]);
  expect(readApplicationNoticeLabels(store,'owner-a').n.schoolName).toBe('学校');expect(readApplicationNoticeLabels(store,'owner-b')).toEqual({});expect([...data.values()][0]).not.toContain('MUST_NOT_BE_CACHED');
  rememberApplicationNoticeLabels(store,'owner-a',['n'],[],['n']);expect(readApplicationNoticeLabels(store,'owner-a')).toEqual({});
 });
});
