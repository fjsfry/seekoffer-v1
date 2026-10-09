import {ApiError} from './auth.ts';

export const ADMIN_AGGREGATE_TTL=60*60*1000;
const CACHE_VERSION='admin-read-v1';
const REFRESH_BACKOFF=5*60*1000;

// Only call after administrator authorization. These entries share storage,
// not keys or HTTP responses, with the public notice cache.
export async function cachedAdminRead<T>(db:D1Database,name:string,ttl:number,load:()=>Promise<T>,now=Date.now()):Promise<T>{
 const key=CACHE_VERSION+':'+name;
 const row=await db.prepare('SELECT result_json,expires_at FROM _notice_query_cache WHERE cache_key=? AND data_version=?').bind(key,CACHE_VERSION).first<{result_json:string|null;expires_at:number}>();
 if(row?.result_json&&row.expires_at>now)return JSON.parse(row.result_json) as T;
 const lease=await db.prepare('INSERT INTO _notice_query_cache(cache_key,data_version,expires_at,lock_until,result_json) VALUES(?,?,0,?,NULL) ON CONFLICT(cache_key) DO UPDATE SET lock_until=excluded.lock_until WHERE lock_until<=? RETURNING cache_key').bind(key,CACHE_VERSION,now+REFRESH_BACKOFF,now).first();
 if(!lease){
  if(row?.result_json)return JSON.parse(row.result_json) as T;
  throw new ApiError(503,'ADMIN_STATS_REFRESH_IN_PROGRESS');
 }
 try{
  const result=await load(),json=JSON.stringify(result);
  if(new TextEncoder().encode(json).byteLength>131072)throw new ApiError(503,'ADMIN_STATS_TOO_LARGE');
  const midnight=Date.parse(new Date(now+28800000).toISOString().slice(0,10)+'T00:00:00+08:00')+86400000;
  const expiresAt=Math.min((Math.floor(now/ttl)+1)*ttl,midnight);
  await db.prepare('UPDATE _notice_query_cache SET result_json=?,expires_at=?,lock_until=0 WHERE cache_key=? AND data_version=?').bind(json,expiresAt,key,CACHE_VERSION).run();
  return result;
 }catch(error){
  // Retain the lease on failure so each polling client cannot retry a full scan.
  if(row?.result_json)return JSON.parse(row.result_json) as T;
  throw error;
 }
}

export function adminNoticeStatistics(db:D1Database,now=Date.now()){
 return cachedAdminRead(db,'notice-statistics',ADMIN_AGGREGATE_TTL,async()=>{
  const start=Date.parse(new Date(now+28800000).toISOString().slice(0,10)+'T00:00:00+08:00');
  const days=Array.from({length:7},(_,i)=>start+(i-6)*86400000);
  const values=[new Date(start).toISOString(),...days.flatMap(day=>[new Date(day).toISOString(),new Date(day+86400000).toISOString()])];
  const daily=days.map((_,i)=>`sum(created_at>=? AND created_at<?) AS day${i}`);
  // A single scan supplies overview totals, moderation badges and the chart.
  const rows=await db.prepare('SELECT admin_status AS status,count(*) AS n,sum(admin_deleted_at IS NULL) AS total,sum(admin_deleted_at IS NULL AND created_at>=?) AS today,'+daily.join(',')+' FROM main__notices GROUP BY admin_status').bind(...values).all<Record<string,number|string>>();
  const counts:Record<string,number>={};
  let total=0,today=0;
  const trends=days.map(day=>({date:new Date(day+28800000).toISOString().slice(5,10),notices:0}));
  for(const row of rows.results){
   counts[String(row.status)]=Number(row.n||0);total+=Number(row.total||0);today+=Number(row.today||0);
   trends.forEach((trend,i)=>{trend.notices+=Number(row['day'+i]||0);});
  }
  return{counts,total,today,trends,generatedAt:new Date(now).toISOString()};
 },now);
}
