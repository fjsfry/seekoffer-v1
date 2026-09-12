import 'server-only';
import {cache} from 'react';
import type {NoticeListItem} from '../notice-record';
import {ServiceUnavailableError} from '../service-availability';
type Entry={id:string;visible:boolean;summary?:NoticeListItem};
const base='https://migration.seekoffer.com.cn';
let flight:Promise<{version:string;items:Entry[]}>|null=null,backoffUntil=0;
let lastVerified:{version:string;items:Entry[]}|null=null;
async function load(){
 if(process.env.SEEKOFFER_OFFLINE_BUILD==='true')return{version:'build-snapshot',items:[]};
 if(Date.now()<backoffUntil)throw new ServiceUnavailableError(503,'NOTICE_UPDATE_SOURCE_UNAVAILABLE');
 const items:Entry[]=[];let cursor:string|null=null,version:string|undefined;
 do{
  const params=new URLSearchParams();if(cursor)params.set('after',cursor);if(version)params.set('version',version);
  const r=await fetch(base+'/v1/public/notice-overrides?'+params,{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(8000)});
  if(r.status>=300&&r.status<400)throw new ServiceUnavailableError(502,'NOTICE_SOURCE_REDIRECT_REJECTED');
  if(!r.ok)throw new ServiceUnavailableError(r.status,'NOTICE_UPDATE_SOURCE_UNAVAILABLE');
  const result=await r.json() as {version:string;items:Entry[];nextCursor:string|null};
  if(typeof result.version!=='string'||version&&result.version!==version||!Array.isArray(result.items)||result.items.length>100||result.nextCursor!==null&&(typeof result.nextCursor!=='string'||!result.nextCursor||!result.nextCursor.startsWith('notice_override:')))throw new ServiceUnavailableError(503,'NOTICE_UPDATE_DATA_INVALID');
  // Page one checks the current D1 version and visibility state on every request.
  // Only a fully loaded earlier version may avoid fetching the remaining shards.
  for(const entry of result.items){if(!entry||typeof entry.id!=='string'||typeof entry.visible!=='boolean'||entry.visible&&entry.summary?.id!==entry.id)throw new ServiceUnavailableError(503,'NOTICE_UPDATE_DATA_INVALID');items.push(entry);}
  if(cursor===null&&lastVerified?.version===result.version)return lastVerified;
  if(items.length>5000)throw new ServiceUnavailableError(503,'SNAPSHOT_REFRESH_REQUIRED');if(result.nextCursor&&cursor&&result.nextCursor<=cursor)throw new ServiceUnavailableError(503,'NOTICE_CURSOR_INVALID');
  cursor=result.nextCursor;version=result.version;
 }while(cursor);
 const complete={version:version||'initial',items};lastVerified=complete;return complete;
}
export const getRecoveryOverrides=cache(async()=>{
 if(flight)return flight;const current=load().catch(error=>{backoffUntil=Date.now()+5000;throw error;});flight=current;try{return await current;}finally{if(flight===current)flight=null;}
});
export async function getUpdatedRecoveryDetail(id:string){
 const r=await fetch(base+'/v1/public/notice-detail?'+new URLSearchParams({id}),{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(8000)});if(r.status>=300&&r.status<400)throw new ServiceUnavailableError(502,'NOTICE_SOURCE_REDIRECT_REJECTED');if(r.status===404)return null;if(!r.ok)throw new ServiceUnavailableError(r.status,'NOTICE_DETAIL_UNAVAILABLE');const row=await r.json();if(!row||row.id!==id)throw new ServiceUnavailableError(503,'NOTICE_DETAIL_INVALID');return row;
}
