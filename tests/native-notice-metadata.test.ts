import {describe,it,expect,vi} from 'vitest';
import {createNativeNoticeMetadata} from '../lib/native-notice-metadata';
import type {PublicNoticeSearchResponse} from '../lib/public-notice-search';
const page={items:[{id:'synthetic-notice'}],pagination:{page:1,pageSize:16,total:1,totalPages:1},source:'recovery',metadataVersion:'v1'} as unknown as PublicNoticeSearchResponse&{metadataVersion:string};
function part(section:string,version='v1'){return{section,version,servedAt:'2026-09-12T00:00:00Z',expiresAt:Date.parse('2026-09-12T00:01:00Z'),...(section==='summary'?{stats:{total2026:1},sideData:{urgentProjects:[],latestProjects:[]}}:section==='facets'?{facets:{schools:['合成学校'],regions:['北京']}}:{collegeStats:[],topColleges:[]})};}
describe('native versioned notification contract',()=>{
 it('assembles split metadata; warm paging shares requests without fetching a catalog',async()=>{
  const read=vi.fn(async(path:string)=>{const q=new URL(path,'https://example.invalid').searchParams;return part(q.get('section')!,q.get('version')!);});const merge=createNativeNoticeMetadata(read,()=>1000);
  const [first,second]=await Promise.all([merge(page,new URLSearchParams()),merge({...page,pagination:{...page.pagination,page:2}},new URLSearchParams())]);
  expect(first.facets.schools).toEqual(['合成学校']);expect(second.pagination.page).toBe(2);expect(read).toHaveBeenCalledTimes(3);
  await merge(page,new URLSearchParams());expect(read).toHaveBeenCalledTimes(3);
  await merge({...page,metadataVersion:'v2'},new URLSearchParams());expect(read).toHaveBeenCalledTimes(6);
  expect(read.mock.calls.every(([url])=>url.startsWith('/api/public/notices/metadata/?'))).toBe(true);
 });
 it('keys region/category facets separately and rejects mixed revisions',async()=>{
  const read=vi.fn(async(path:string)=>{const q=new URL(path,'https://example.invalid').searchParams;return part(q.get('section')!,q.get('version')!);});const merge=createNativeNoticeMetadata(read);
  await merge(page,new URLSearchParams({region:'北京'}));await merge(page,new URLSearchParams({region:'上海'}));expect(read).toHaveBeenCalledTimes(4);
  const wrong=createNativeNoticeMetadata(async(path)=>part(new URL(path,'https://example.invalid').searchParams.get('section')!,'old'));
  await expect(wrong(page,new URLSearchParams())).rejects.toThrow('版本');
 });
 it('rejects expired metadata instead of reviving withdrawn public summaries',async()=>{
  const expired=createNativeNoticeMetadata(async(path)=>{const section=new URL(path,'https://example.invalid').searchParams.get('section')!;const p=part(section);return{...p,expiresAt:Date.parse(p.servedAt)-1};});
  await expect(expired(page,new URLSearchParams())).rejects.toThrow('版本');
 });
 it('keeps complete legacy responses and stops on failure or superseded search',async()=>{
  const read=vi.fn(async()=>{throw Error('PUBLIC_QUOTA_RESTRICTED');});const merge=createNativeNoticeMetadata(read);
  const old={...page,metadataVersion:undefined};expect(await merge(old,new URLSearchParams())).toBe(old);expect(read).not.toHaveBeenCalled();
  const controller=new AbortController();controller.abort();await expect(merge(page,new URLSearchParams(),controller.signal)).rejects.toMatchObject({name:'AbortError'});expect(read).not.toHaveBeenCalled();
  await expect(merge(page,new URLSearchParams())).rejects.toThrow('PUBLIC_QUOTA_RESTRICTED');expect(read).toHaveBeenCalledTimes(3);
 });
});
