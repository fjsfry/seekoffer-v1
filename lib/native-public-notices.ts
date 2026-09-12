'use client';
import {nativePublicRequest} from './native-auth-bridge';
import type {PublicNoticeSearchResponse} from './public-notice-search';
import type {NoticeSearchFilters} from './notice-query';
import type {PublicNoticeProject} from './mock-data';
import {createNativeNoticeMetadata} from './native-notice-metadata';
const mergeMetadata=createNativeNoticeMetadata(path=>nativePublicRequest(path));
export const nativeNoticeDefaults:NoticeSearchFilters={keyword:'',schoolName:'',region:'全部',majorKeyword:'',category:'全部',discipline:'全部',schoolRange:'全部',progress:'全部',deadlineQuick:'全部',fresh:'全部',publishDate:'',projectType:'全部',noticeKind:'全部',year:'2026',sortBy:'publish'};
export async function nativeNoticeSearch(filters:NoticeSearchFilters=nativeNoticeDefaults,page=1,signal?:AbortSignal):Promise<PublicNoticeSearchResponse>{
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 const params=new URLSearchParams({page:String(page),pageSize:'16',year:filters.year,sort:filters.sortBy});
 for(const [field,key]of [['keyword','q'],['schoolName','school'],['region','region'],['majorKeyword','major'],['category','category'],['discipline','discipline'],['schoolRange','range'],['progress','status'],['deadlineQuick','deadline'],['fresh','fresh'],['publishDate','date'],['projectType','type'],['noticeKind','kind']] as const){const v=filters[field].trim();if(v&&v!=='全部')params.set(key,v);}
 const pageData=await nativePublicRequest('/api/public/notices/?'+params) as PublicNoticeSearchResponse;
 if(!pageData||!Array.isArray(pageData.items)||pageData.items.length>16||!pageData.pagination||!Number.isSafeInteger(pageData.pagination.total)||pageData.pagination.total<0||pageData.items.some(i=>typeof i.id!=='string'))throw new Error('通知响应不完整，请稍后重试。');
 const data=await mergeMetadata(pageData,params,signal);
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 if(!data||!Array.isArray(data.items)||data.items.length>16||!data.pagination||!Number.isSafeInteger(data.pagination.total)||data.pagination.total<0||!data.facets||!data.sideData||data.items.some(i=>typeof i.id!=='string'))throw new Error('通知响应不完整，请稍后重试。');return data;
}
export async function nativeNoticeDetail(id:string):Promise<PublicNoticeProject|null>{if(!id||id.length>180)throw new Error('通知编号无效。');const result=await nativePublicRequest('/v1/public/notice-detail?'+new URLSearchParams({id})) as PublicNoticeProject|null;if(result&&result.id!==id)throw new Error('通知响应编号不匹配。');return result;}
