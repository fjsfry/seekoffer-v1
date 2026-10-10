import {ApiError} from './auth.ts';
import {isoMicro} from './payments/transaction.ts';
import {cachedAdminRead} from './admin-read-cache.ts';
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

export type DownloadMonitorOptions = {
 page?: number;
 pageSize?: number;
 windowDays?: number;
 query?: string;
};

function normalizeMonitorOptions(options:DownloadMonitorOptions={}){
 const page=Math.min(Math.max(Number(options.page||1),1),100000);
 const pageSize=Math.min(Math.max(Number(options.pageSize||20),1),50);
 const windowDays=options.windowDays===0?0:[7,30,90].includes(Number(options.windowDays))?Number(options.windowDays):30;
 const query=typeof options.query==='string'?options.query.trim().slice(0,120):'';
 return{page,pageSize,windowDays,query};
}

function beijingMidnight(now=Date.now()){
 const date=new Date(now+8*60*60*1000).toISOString().slice(0,10);
 return Date.parse(`${date}T00:00:00+08:00`);
}

function downloadWindow(days:number){
 const to=new Date().toISOString(),from=days?new Date(Date.now()-days*86400000).toISOString():null;
 return{from,to};
}

export async function readDownloadMonitor(db:D1Database,config:DownloadConfig={},options:DownloadMonitorOptions={}){
 const normalized=normalizeMonitorOptions(options),cacheName=`download-monitor:${normalized.page}:${normalized.pageSize}:${normalized.windowDays}:${encodeURIComponent(normalized.query)}`;
 return cachedAdminRead(db,cacheName,60_000,async()=>{
  const now=Date.now(),today=new Date(beijingMidnight(now)).toISOString(),sevenDays=new Date(beijingMidnight(now)-6*86400000).toISOString(),trendStart=new Date(beijingMidnight(now)-13*86400000).toISOString();
  const listWindow=downloadWindow(normalized.windowDays),terms:string[]=[],values:unknown[]=[];
  if(listWindow.from){terms.push('created_at>=?');values.push(listWindow.from);}
  if(normalized.query){terms.push("(instr(lower(attempt_id),lower(?))>0 OR instr(lower(release_version),lower(?))>0 OR instr(lower(platform),lower(?))>0 OR instr(lower(source),lower(?))>0)");values.push(normalized.query,normalized.query,normalized.query,normalized.query);}
  const where=terms.length?' WHERE '+terms.join(' AND '):'';
  const [summary,trend,versions,countRow,records]=await Promise.all([
   db.prepare('SELECT count(*) AS total,sum(created_at>=?) AS today,sum(created_at>=?) AS last_seven_days,sum(created_at>=?) AS last_thirty_days,max(created_at) AS latest_at,min(created_at) AS first_at FROM main__desktop_download_attempts').bind(today,sevenDays,new Date(beijingMidnight(now)-29*86400000).toISOString()).first<Record<string,number|string|null>>(),
   db.prepare("SELECT strftime('%m-%d',created_at,'+8 hours') AS day,count(*) AS n FROM main__desktop_download_attempts WHERE created_at>=? GROUP BY day ORDER BY day").bind(trendStart).all<{day:string;n:number}>(),
   db.prepare('SELECT release_version AS version,count(*) AS n,max(created_at) AS latest_at FROM main__desktop_download_attempts WHERE created_at>=? GROUP BY release_version ORDER BY n DESC,latest_at DESC LIMIT 10').bind(new Date(beijingMidnight(now)-29*86400000).toISOString()).all<{version:string;n:number;latest_at:string}>(),
   db.prepare('SELECT count(*) AS total FROM main__desktop_download_attempts'+where).bind(...values).first<{total:number}>(),
   db.prepare('SELECT id,attempt_id,release_version,platform,source,created_at FROM main__desktop_download_attempts'+where+' ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?').bind(...values,normalized.pageSize,(normalized.page-1)*normalized.pageSize).all<Record<string,unknown>>()
  ]);
  const trendMap=new Map(trend.results.map(row=>[row.day,Number(row.n||0)]));
  const days=Array.from({length:14},(_,index)=>{const date=new Date(beijingMidnight(now)-(13-index)*86400000).toISOString().slice(5,10);return{date,count:trendMap.get(date)||0};});
  const total=Number(countRow?.total||0);
  return{
   checkedAt:new Date().toISOString(),
   tracking:{enabled:config.DESKTOP_DOWNLOAD_TRACKING_ENABLED==='true',releaseVersion:config.DESKTOP_PUBLIC_RELEASE_VERSION||null,platform:'windows_x86_64',source:'website_download_page'},
   metrics:{total:Number(summary?.total||0),today:Number(summary?.today||0),lastSevenDays:Number(summary?.last_seven_days||0),lastThirtyDays:Number(summary?.last_thirty_days||0),latestAt:summary?.latest_at?String(summary.latest_at):null,firstAt:summary?.first_at?String(summary.first_at):null},
   trend:days,
   versions:versions.results.map(row=>({version:String(row.version),count:Number(row.n||0),latestAt:String(row.latest_at)})),
   records:{items:records.results.map(row=>({id:Number(row.id),attemptId:String(row.attempt_id),releaseVersion:String(row.release_version),platform:String(row.platform),source:String(row.source),createdAt:String(row.created_at)})),total,page:normalized.page,pageSize:normalized.pageSize,pages:Math.max(1,Math.ceil(total/normalized.pageSize)),window:listWindow,query:normalized.query}
  };
 });
}
