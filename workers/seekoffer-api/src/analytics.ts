import {ApiError} from './auth.ts';
import {isoMicro} from './payments/transaction.ts';

type Row=Record<string,unknown>;
export interface AnalyticsConfig {ANALYTICS_ENABLED?:string;ANALYTICS_EVENTS_PER_DAY?:string}
const visitorPattern=/^v_[a-zA-Z0-9_-]{16,90}$/;
const sessionPattern=/^s_[a-zA-Z0-9_-]{16,90}$/;
function text(value:unknown,max:number){if(typeof value!=='string'||value.length>max||/[\u0000-\u001f]/.test(value))throw new ApiError(400,'INVALID_ANALYTICS_EVENT');return value;}
async function hash(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function analyticsLimit(config:AnalyticsConfig){const n=Number(config.ANALYTICS_EVENTS_PER_DAY||400);if(!Number.isSafeInteger(n)||n<1||n>1000)throw new ApiError(503,'ANALYTICS_BUDGET_NOT_CONFIGURED');return n;}

// Source event IDs are allocated from the preserved PostgreSQL sequence. Using
// SQLite max(id)+1 would collide with historical records that are still paused.
export async function recordPageview(db:D1Database,body:Row,config:AnalyticsConfig,now=Date.now()){
 if(config.ANALYTICS_ENABLED!=='true')throw new ApiError(503,'ANALYTICS_MAINTENANCE');
 if(Object.keys(body).some(k=>!['requestId','visitorId','sessionId','eventType','path','title','referrer','locale','timezone'].includes(k))||body.eventType!=='pageview')throw new ApiError(400,'INVALID_ANALYTICS_EVENT');
 const requestId=text(body.requestId,36),visitor=text(body.visitorId,96),session=text(body.sessionId,96),path=text(body.path,320);
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requestId)||!visitorPattern.test(visitor)||!sessionPattern.test(session)||!path.startsWith('/')||path.startsWith('//')||/[?#\\]/.test(path)||path.startsWith('/admin'))throw new ApiError(400,'INVALID_ANALYTICS_EVENT');
 const title=text(body.title||'',180),locale=text(body.locale||'',40),timezone=text(body.timezone||'',80);
 let referrer='';if(body.referrer){let u:URL;try{u=new URL(text(body.referrer,2048));}catch{throw new ApiError(400,'INVALID_ANALYTICS_EVENT');}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new ApiError(400,'INVALID_ANALYTICS_EVENT');referrer=u.origin;}
 const fingerprint=await hash(JSON.stringify([visitor,session,path,title,referrer,locale,timezone]));
 const key='analytics_request:'+requestId,nonce=crypto.randomUUID(),receipt=JSON.stringify({fingerprint,nonce});
 const old=await db.prepare('SELECT value FROM _runtime_state WHERE key=?').bind(key).first<{value:string}>();
 if(old){if(JSON.parse(old.value).fingerprint!==fingerprint)throw new ApiError(409,'ANALYTICS_REQUEST_CONFLICT');return{recorded:false,deduplicated:true};}
 const day='analytics_events_day:'+new Date(now).toISOString().slice(0,10),stamp=isoMicro(now),since=isoMicro(now-30000),limit=analyticsLimit(config);
 const sequence='main__site_visit_events';
 const ready=await db.prepare('SELECT CAST(next_value AS TEXT) value FROM _business_sequences WHERE name=?').bind(sequence).first<{value:string}>();if(!ready||BigInt(ready.value)>=9223372036854775807n)throw new ApiError(503,'ANALYTICS_SEQUENCE_NOT_READY');
 const gate='EXISTS(SELECT 1 FROM _runtime_state WHERE key=? AND value=?)';
 const rows=await db.batch([
  db.prepare(`INSERT INTO _runtime_state(key,value) SELECT ?,? WHERE coalesce((SELECT CAST(value AS INTEGER) FROM _runtime_state WHERE key=?),0)<? AND NOT EXISTS(SELECT 1 FROM main__site_visit_events WHERE visitor_id=? AND created_at>=? AND session_id=? AND path=? AND event_type='pageview') ON CONFLICT(key) DO NOTHING RETURNING key`).bind(key,receipt,day,limit,visitor,since,session,path),
  db.prepare(`INSERT INTO main__site_visitors(visitor_id,first_seen_at,last_seen_at,last_path,last_title,last_referrer,last_locale,last_timezone,first_session_id,last_session_id,visit_count,page_view_count,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,1,1,? WHERE ${gate} ON CONFLICT(visitor_id) DO UPDATE SET last_seen_at=excluded.last_seen_at,last_path=excluded.last_path,last_title=excluded.last_title,last_referrer=excluded.last_referrer,last_locale=excluded.last_locale,last_timezone=excluded.last_timezone,last_session_id=excluded.last_session_id,visit_count=visit_count+(last_session_id<>excluded.last_session_id),page_view_count=page_view_count+1,updated_at=excluded.updated_at`).bind(visitor,stamp,stamp,path,title,referrer,locale,timezone,session,session,stamp,key,receipt),
  db.prepare(`INSERT INTO main__site_visit_events(id,visitor_id,session_id,event_type,path,title,referrer,locale,timezone,created_at) SELECT next_value,?,?,'pageview',?,?,?,?,?,? FROM _business_sequences WHERE name=? AND ${gate}`).bind(visitor,session,path,title,referrer,locale,timezone,stamp,sequence,key,receipt),
  db.prepare(`UPDATE _business_sequences SET next_value=next_value+1 WHERE name=? AND ${gate}`).bind(sequence,key,receipt),
  db.prepare(`INSERT INTO _runtime_state(key,value) SELECT ?,'1' WHERE ${gate} ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT)`).bind(day,key,receipt),
  db.prepare(`INSERT INTO _runtime_state(key,value) SELECT 'analytics_started_at',? WHERE ${gate} ON CONFLICT(key) DO NOTHING`).bind(stamp,key,receipt)
 ]);
 if(rows[0].results.length)return{recorded:true,deduplicated:false};
 const after=await db.prepare('SELECT value FROM _runtime_state WHERE key=?').bind(key).first<{value:string}>();
 if(after&&JSON.parse(after.value).fingerprint!==fingerprint)throw new ApiError(409,'ANALYTICS_REQUEST_CONFLICT');
 const used=Number(await db.prepare('SELECT value FROM _runtime_state WHERE key=?').bind(day).first('value')||0);
 if(!after&&used>=limit)throw new ApiError(402,'ANALYTICS_DAILY_BUDGET');
 return{recorded:false,deduplicated:true};
}

export const unavailableAnalytics={available:false,reason:'访问统计暂停；历史日志尚未迁完，指标不可用不代表零。',metrics:{onlineVisitors:null,totalVisitors:null,todayVisitors:null,todayPageViews:null,activeWindowMinutes:6},onlineVisitors:[],recentVisitors:[]};
export async function readAnalytics(db:D1Database,config:AnalyticsConfig,now=Date.now()){
 if(config.ANALYTICS_ENABLED!=='true')return unavailableAnalytics;
 const started=await db.prepare("SELECT value FROM _runtime_state WHERE key='analytics_started_at'").first<{value:string}>();
 if(!started)return{...unavailableAnalytics,reason:'访问采集已就绪，尚未收到第一条有效记录。'};
 const today=isoMicro(Date.parse(new Date(now+28800000).toISOString().slice(0,10)+'T00:00:00+08:00')),cutoff=isoMicro(now-6*60000),since=started.value>today?started.value:today;
 const columns='visitor_id,first_seen_at,last_seen_at,last_path,last_title,last_referrer,last_locale,last_timezone,visit_count,page_view_count';
 const results=await db.batch([
  db.prepare('SELECT count(*) AS n FROM main__site_visitors'),
  db.prepare('SELECT count(*) AS n FROM main__site_visitors WHERE last_seen_at>=?').bind(today),
  db.prepare('SELECT count(*) AS n FROM main__site_visitors WHERE last_seen_at>=?').bind(cutoff),
  db.prepare("SELECT count(*) AS n FROM main__site_visit_events WHERE created_at>=? AND event_type='pageview'").bind(since),
  db.prepare('SELECT '+columns+' FROM main__site_visitors WHERE last_seen_at>=? ORDER BY last_seen_at DESC LIMIT 20').bind(cutoff),
  db.prepare('SELECT '+columns+' FROM main__site_visitors ORDER BY last_seen_at DESC LIMIT 20'),
  db.prepare('SELECT value FROM _runtime_state WHERE key=?').bind('analytics_events_day:'+new Date(now).toISOString().slice(0,10))
 ]);
 const used=Number((results[6].results[0] as Row|undefined)?.value||0),limit=analyticsLimit(config);
 return{available:true,reason:'访客累计来自已迁入的访客档案；今日浏览仅统计恢复采集后已记录的访问。历史访问日志仍按要求暂停，采集达到日上限后停止，不能视为完整流量。',coverage:{startedAt:started.value,todayFrom:since,historicalEventsComplete:false,dailyAccepted:used,dailyLimit:limit,budgetReached:used>=limit},metrics:{totalVisitors:Number((results[0].results[0] as Row).n),todayVisitors:Number((results[1].results[0] as Row).n),onlineVisitors:Number((results[2].results[0] as Row).n),todayPageViews:Number((results[3].results[0] as Row).n),activeWindowMinutes:6},onlineVisitors:results[4].results,recentVisitors:results[5].results};
}
