import 'server-only';
import {createHash} from 'node:crypto';
import {getDeadlineTimestamp} from '../deadline-display';
import type {PublicNoticeProject} from '../mock-data';
import type {NoticeSearchFilters} from '../notice-query';
import {buildPublicNoticeSearchResult,type PublicNoticeDataSource} from '../public-notice-search';

type Catalog={items:PublicNoticeProject[];version?:string;source:PublicNoticeDataSource};
function expiresAt(items:PublicNoticeProject[],now:number){
 let expiry=Math.min(now+60_000,(Math.floor((now+8*3600000)/86400000)+1)*86400000-8*3600000);
 for(const item of items){const stamp=getDeadlineTimestamp(item.deadlineDate);if(stamp===Number.MAX_SAFE_INTEGER)continue;for(const days of [0,1,3,7]){const boundary=stamp-days*86400000;if(boundary>now&&boundary<expiry)expiry=boundary;}}
 return expiry;
}

// Caller MUST fetch and verify the current public version first. No cookies,
// credentials or private rows are accepted. The key includes every query input.
export async function publicNoticeSearchResponse(catalog:Catalog,filters:NoticeSearchFilters,options:{page:number;pageSize:number}){
 const now=Date.now(),headers={'Cache-Control':'no-store',...(catalog.version?{'X-Notice-Version':catalog.version}:{})};
 const cache=typeof caches==='undefined'?undefined:(caches as CacheStorage&{default?:Cache}).default;
 const key=catalog.version?new Request('https://www.seekoffer.com.cn/_internal-public-search/v1/'+createHash('sha256').update(JSON.stringify({version:catalog.version,source:catalog.source,filters,...options})).digest('hex')):null;
 if(cache&&key){try{const hit=await cache.match(key);if(hit){const expiry=Number(hit.headers.get('X-Public-Expires-At'));if(expiry>now)return new Response(hit.body,{headers:{...headers,'Content-Type':'application/json','X-Public-Result-Cache':'HIT'}});}}catch{/* A cache failure cannot authorize stale public content. */}}
 const result=buildPublicNoticeSearchResult(catalog.items,filters,{...options,source:catalog.source,now:new Date(now)});
 const body=JSON.stringify(result),expiry=expiresAt(catalog.items,now),seconds=Math.floor((expiry-Date.now())/1000);
 let stored=false;
 if(cache&&key&&seconds>0&&new TextEncoder().encode(body).length<=512000){try{await cache.put(key,new Response(body,{headers:{'Content-Type':'application/json','Cache-Control':'public,max-age='+seconds,'X-Public-Expires-At':String(expiry)}}));stored=true;}catch{/* Explicitly report an uncached response. */}}
 return new Response(body,{headers:{...headers,'Content-Type':'application/json','X-Public-Result-Cache':stored?'MISS-STORED':'UNCACHED'}});
}
