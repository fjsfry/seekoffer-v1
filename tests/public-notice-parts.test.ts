import {beforeEach,describe,expect,it,vi} from 'vitest';
import {clearPublicMetadataParts,mergePublicNoticeParts} from '@/lib/public-notice-parts';
import {fetchPublicDeadlineNotices} from '@/lib/public-notice-api';
import type {PublicNoticeSearchResponse} from '@/lib/public-notice-search';
const request=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/service-availability',()=>({publicNoticeFetch:request,ServiceUnavailableError:class extends Error{constructor(public status:number,code?:string){super(code||String(status));}}}));
const base={items:[],pagination:{page:1,pageSize:16,total:0,totalPages:1},source:'recovery',servedAt:new Date().toISOString(),metadataVersion:'v1'} as unknown as PublicNoticeSearchResponse&{metadataVersion:string};
function part(section:string,version='v1'){return{section,version,expiresAt:Date.now()+60000,servedAt:new Date().toISOString(),...(section==='summary'?{stats:{total2026:24,todayUpdates:2,deadlineWithin3Days:3},sideData:{urgentProjects:[],latestProjects:[],todaySchoolUpdates:{date:'2026-09-11',hasTodayRows:true,rows:[]},latestPublishDate:'2026-09-11'}}:section==='facets'?{facets:{regions:['北京'],schools:['北京大学'],categories:['工学'],disciplines:['计算机']}}:{collegeStats:[],topColleges:[]})};}
beforeEach(()=>{request.mockReset();clearPublicMetadataParts();});
describe('versioned public metadata and deadline pagination',()=>{
 it('merges only the current version and reuses bounded public metadata across pages',async()=>{
  request.mockImplementation(async (u:string)=>{const p=new URL(u,'https://example.invalid').searchParams;return Response.json(part(p.get('section')!,p.get('version')!));});
  const result=await mergePublicNoticeParts(base,new URLSearchParams());expect(result.stats.total2026).toBe(24);expect(result.facets.schools).toEqual(['北京大学']);expect(request).toHaveBeenCalledTimes(3);
  await mergePublicNoticeParts(base,new URLSearchParams());expect(request).toHaveBeenCalledTimes(3);
  await mergePublicNoticeParts({...base,metadataVersion:'v2'},new URLSearchParams());expect(request).toHaveBeenCalledTimes(6);
 });
 it('rejects mixed versions and does not silently reuse an old withdrawn catalog',async()=>{request.mockImplementation(async (u:string)=>Response.json(part(new URL(u,'https://example.invalid').searchParams.get('section')!,'old-version')));await expect(mergePublicNoticeParts(base,new URLSearchParams())).rejects.toThrow('PUBLIC_METADATA_VERSION_CHANGED');});
 it('retains backward compatibility with the existing complete website response',async()=>{const existing={...base,metadataVersion:undefined};expect(await mergePublicNoticeParts(existing,new URLSearchParams())).toBe(existing);expect(request).not.toHaveBeenCalled();});
 it('follows all deadline pages without discarding records over a single batch',async()=>{let n=0;request.mockImplementation(async()=>{const page=n++;return Response.json({items:Array.from({length:page<2?100:5},(_,i)=>({id:String(page*100+i)})),source:'recovery',version:'v1',servedAt:'2026-09-11',nextCursor:page<2?'page-'+(page+1):null});});const result=await fetchPublicDeadlineNotices();expect(result.items).toHaveLength(205);expect(request).toHaveBeenCalledTimes(3);});
 it('stops at a changed snapshot or 402 without retrying or returning partial success',async()=>{request.mockResolvedValueOnce(Response.json({items:[{id:'1'}],source:'recovery',version:'v1',nextCursor:'next'})).mockResolvedValueOnce(Response.json({error:'SERVICE_QUOTA_EXCEEDED'},{status:402}));await expect(fetchPublicDeadlineNotices()).rejects.toMatchObject({status:402});expect(request).toHaveBeenCalledTimes(2);});
});
