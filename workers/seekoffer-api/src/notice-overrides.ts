import {ApiError} from './auth.ts';
import {createNoticeProjection} from './notice-projection.ts';
import {NOTICE_DETAIL_COLUMNS,mapNoticeRowToProject} from '../../../lib/notice-record';
import {publicVisibility} from './notice-sql.ts';
const prefix='notice_override:';
function normalized(row:Record<string,unknown>){const copy={...row};for(const key of ['tags','materials_required','change_log','history_records'])if(typeof copy[key]==='string'){try{copy[key]=JSON.parse(copy[key] as string);}catch{throw new ApiError(503,'NOTICE_SOURCE_INVALID');}}copy.is_verified=Boolean(copy.is_verified);return copy;}
export function overrideStatements(db:D1Database,before:Record<string,unknown>|null,after:Record<string,unknown>,crawler=false,order?:{sourceRank:number;schoolRank:number}){
 const visible=after.admin_status==='published'&&!after.is_private&&!after.admin_deleted_at;
 const wasVisible=before?.admin_status==='published'&&!before?.is_private&&!before?.admin_deleted_at;
 const id=String(after.id);if(visible&&(after.source_site==='用户手动录入'||id.startsWith('custom-')))throw new ApiError(403,'PRIVATE_PROJECT_CANNOT_BE_PUBLISHED');
 if(visible&&!order)throw new ApiError(503,'NOTICE_ORDER_REQUIRED');
 const projection=visible?createNoticeProjection(normalized(after),order!.sourceRank,order!.schoolRank):null;
 if(visible&&!projection)throw new ApiError(400,'NOTICE_NOT_ELIGIBLE_FOR_PUBLIC_CATALOG');
 const statements:D1PreparedStatement[]=[];
 if(visible||wasVisible)statements.push(db.prepare('INSERT INTO _runtime_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(prefix+id,JSON.stringify(visible?{id,visible:true,summary:projection!.summary}:{id,visible:false})));
 else statements.push(db.prepare('UPDATE _runtime_state SET value=? WHERE key=?').bind(JSON.stringify({id,visible:false}),prefix+id));
 statements.push(db.prepare('UPDATE main__notices SET catalog_projection=? WHERE id=?').bind(projection?JSON.stringify(projection):null,id));
 statements.push(db.prepare("INSERT INTO _runtime_state(key,value) VALUES('notice_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(crypto.randomUUID()));
 // Moderator changes revoke every previous public snapshot. Crawler updates
 // never republish or hide managed records, so readers may finish a cached page
 // sequence from immediately before a crawler batch.
 if(!crawler)statements.push(db.prepare("INSERT INTO _runtime_state(key,value) VALUES('notice_visibility_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(crypto.randomUUID()));
 return statements;
}
export async function readNoticeOverrides(db:D1Database,params:URLSearchParams){
 const after=params.get('after')||'';if(after.length>200||after&&!after.startsWith(prefix)||[...params.keys()].some(k=>params.getAll(k).length!==1||!['after','version'].includes(k))||(params.get('version')||'').length>100)throw new ApiError(400,'INVALID_CURSOR');
 const state=await db.prepare("SELECT key,value FROM _runtime_state WHERE key IN ('notice_version','notice_visibility_version')").all<{key:string;value:string}>();
 const get=(rows:{key:string;value:string}[],key:string)=>String(rows.find(r=>r.key===key)?.value||'initial');
 const current=get(state.results,'notice_version'),visibility=get(state.results,'notice_visibility_version');
 const requested=params.get('version')||current;
 const cacheKey=(version:string,visibilityVersion:string,cursor:string)=>new Request('https://migration.seekoffer.com.cn/_public-notice-shard/v2/'+encodeURIComponent(visibilityVersion)+'/'+encodeURIComponent(version)+'/'+encodeURIComponent(cursor||'first'));
 const edgeCache=typeof caches!=='undefined'?(caches as CacheStorage & {default:Cache}).default:null;
 try{const hit=await edgeCache?.match(cacheKey(requested,visibility,after));if(hit)return await hit.json();}catch{/* A cache failure uses the bounded snapshot below. */}
 if(requested!==current)throw new ApiError(409,'NOTICE_VERSION_CHANGED');
 // One transaction captures the bounded overlay and its version, then creates
 // all <=100-item shards before returning page one. Never scan the notice table.
 const rows=await db.batch([db.prepare("SELECT key,value FROM _runtime_state WHERE key IN ('notice_version','notice_visibility_version')"),db.prepare("SELECT key,value FROM _runtime_state WHERE key>='notice_override:' AND key<'notice_override;' ORDER BY key LIMIT 4001")]);
 const states=rows[0].results as {key:string;value:string}[],version=get(states,'notice_version'),safeVersion=get(states,'notice_visibility_version');
 if(params.has('version')&&params.get('version')!==version)throw new ApiError(409,'NOTICE_VERSION_CHANGED');
 const entries=rows[1].results as {key:string;value:string}[];
 if(entries.length>4000)throw new ApiError(503,'SNAPSHOT_REFRESH_REQUIRED');
 let selected:{version:string;items:unknown[];nextCursor:string|null}|undefined;
 for(let offset=0;offset<Math.max(entries.length,1);offset+=100){
  const cursor=offset?entries[offset-1].key:'';
  const result={version,items:entries.slice(offset,offset+100).map(r=>JSON.parse(r.value)),nextCursor:entries.length>offset+100?entries[offset+99].key:null};
  if(cursor===after)selected=result;
  const bytes=JSON.stringify(result);
  if(new TextEncoder().encode(bytes).length>512000)throw new ApiError(503,'NOTICE_SHARD_TOO_LARGE');
  try{await edgeCache?.put(cacheKey(version,safeVersion,cursor),new Response(bytes,{headers:{'Content-Type':'application/json','Cache-Control':'public,max-age=300'}}));}catch{/* Cache is optional; version checks remain mandatory. */}
 }
 if(!selected)throw new ApiError(400,'INVALID_CURSOR');
 return selected;
}
export async function readOverrideDetail(db:D1Database,id:string){
 if(!id||id.length>180)throw new ApiError(400,'INVALID_ID');const row=await db.prepare('SELECT '+NOTICE_DETAIL_COLUMNS+' FROM main__notices n WHERE n.id=? AND '+publicVisibility+" AND n.source_site<>'用户手动录入' AND n.id NOT LIKE 'custom-%'").bind(id).first<Record<string,unknown>>();if(!row)throw new ApiError(404,'NOTICE_UNAVAILABLE');return mapNoticeRowToProject(normalized(row));
}
