import {ApiError} from './auth.ts';
import {isoMicro} from './payments/transaction.ts';
export type DownloadConfig={DESKTOP_DOWNLOAD_TRACKING_ENABLED?:string;DESKTOP_PUBLIC_RELEASE_VERSION?:string};
export async function recordDownload(db:D1Database,body:Record<string,unknown>,config:DownloadConfig,now=Date.now()){
 if(config.DESKTOP_DOWNLOAD_TRACKING_ENABLED!=='true')throw new ApiError(503,'DOWNLOAD_ANALYTICS_MAINTENANCE');
 const version=config.DESKTOP_PUBLIC_RELEASE_VERSION;if(!version||!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(version))throw new ApiError(503,'DOWNLOAD_RELEASE_NOT_CONFIGURED');
 const id=body.attemptId;if(Object.keys(body).some(k=>k!=='attemptId')||typeof id!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))throw new ApiError(400,'INVALID_DOWNLOAD_ATTEMPT');
 const read=()=>db.prepare('SELECT release_version FROM main__desktop_download_attempts WHERE attempt_id=?').bind(id).first<{release_version:string}>();
 const existing=await read();if(existing){if(existing.release_version!==version)throw new ApiError(409,'DOWNLOAD_ATTEMPT_CONFLICT');return{recorded:false,deduplicated:true};}
 if(!await db.prepare("SELECT name FROM _business_sequences WHERE name='main__desktop_download_attempts'").first())throw new ApiError(503,'DOWNLOAD_SEQUENCE_NOT_READY');
 const key='download_attempt:'+id,nonce=crypto.randomUUID(),day='download_events_day:'+new Date(now).toISOString().slice(0,10),gate='EXISTS(SELECT 1 FROM _runtime_state WHERE key=? AND value=?)';
 const result=await db.batch([
  db.prepare('INSERT INTO _runtime_state(key,value) SELECT ?,? WHERE coalesce((SELECT CAST(value AS INTEGER) FROM _runtime_state WHERE key=?),0)<100 ON CONFLICT(key) DO NOTHING RETURNING key').bind(key,nonce,day),
  db.prepare("INSERT INTO main__desktop_download_attempts(id,attempt_id,release_version,platform,source,created_at) SELECT next_value,?,?,'windows_x86_64','website_download_page',? FROM _business_sequences WHERE name='main__desktop_download_attempts' AND "+gate).bind(id,version,isoMicro(now),key,nonce),
  db.prepare("UPDATE _business_sequences SET next_value=next_value+1 WHERE name='main__desktop_download_attempts' AND "+gate).bind(key,nonce),
  db.prepare('INSERT INTO _runtime_state(key,value) SELECT ?,\'1\' WHERE '+gate+' ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT)').bind(day,key,nonce),
 ]);
 if(result[0].results.length)return{recorded:true,deduplicated:false};
 const stored=await read();if(stored){if(stored.release_version!==version)throw new ApiError(409,'DOWNLOAD_ATTEMPT_CONFLICT');return{recorded:false,deduplicated:true};}
 throw new ApiError(402,'DOWNLOAD_DAILY_BUDGET');
}
