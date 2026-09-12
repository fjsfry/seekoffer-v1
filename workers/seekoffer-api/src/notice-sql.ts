import {ApiError} from './auth.ts';
export const publicVisibility="n.is_private=0 AND n.admin_status='published' AND n.admin_deleted_at IS NULL";
const projection=(key:string)=>`json_extract(n.catalog_projection,'$.${key}')`;
function text(params:URLSearchParams,key:string,max:number,fallback=''){
  if(params.getAll(key).length>1)throw new ApiError(400,'DUPLICATE_FILTER');
  const s=(params.get(key)||fallback).trim();if(s.length>max||/[\u0000-\u001f]/.test(s))throw new ApiError(400,'INVALID_FILTER');return s;
}
function pick(p:URLSearchParams,k:string,values:string[],fallback:string){const s=text(p,k,100,fallback);if(!values.includes(s))throw new ApiError(400,'INVALID_ENUM');return s;}
function integer(p:URLSearchParams,k:string,fallback:number,max:number){const s=p.get(k);if(s===null||s==='')return fallback;const n=Number(s);if(!Number.isSafeInteger(n)||n<1||n>max)throw new ApiError(400,'INVALID_PAGE');return n;}
export function noticeSql(params:URLSearchParams,now=Date.now()){
  const allowed=new Set(['page','pageSize','year','sort','q','school','region','major','category','discipline','range','status','deadline','fresh','date','type','kind']);
  for(const key of params.keys())if(!allowed.has(key)||params.getAll(key).length>1)throw new ApiError(400,'UNKNOWN_OR_DUPLICATE_FILTER');
  const page=integer(params,'page',1,100000),pageSize=integer(params,'pageSize',16,40);
  const where=[publicVisibility,'n.catalog_projection IS NOT NULL'];const values:unknown[]=[];
  const eq=(key:string,val:string)=>{if(val&&val!=='全部'){where.push(projection(key)+'=?');values.push(val);}};
  const year=pick(params,'year',['2026','全部'],'2026');if(year!=='全部'){where.push('n.year=?');values.push(Number(year));}
  const keyword=text(params,'q',80).toLowerCase();if(keyword){
    const broad=keyword.length>=4||/[a-z0-9]/i.test(keyword);
    where.push('(instr('+projection('primary')+',?)>0'+(broad?' OR instr('+projection('secondary')+',?)>0':'')+')');values.push(keyword);if(broad)values.push(keyword);
  }
  for(const [param,key,max]of [['school','schoolText',100],['major','major',80]] as const){const v=text(params,param,max).toLowerCase();if(v&&v!=='全部'){where.push('instr('+projection(key)+',?)>0');values.push(v);}}
  eq('category',text(params,'category',40));eq('discipline',text(params,'discipline',100));
  eq('range',pick(params,'range',['全部','985','211','双一流','其他'],'全部'));
  eq('type',pick(params,'type',['全部','夏令营','预推免','推免'],'全部'));eq('kind',pick(params,'kind',['全部','申请通知','宣讲会','入营名单'],'全部'));
  const region=text(params,'region',30);if(region&&region!=='全部'){where.push('('+projection('region')+'=? OR EXISTS (SELECT 1 FROM json_each(n.tags) WHERE value=?))');values.push(region,region);}
  const deadline=projection('deadlineMs'),rawStatus=projection('rawStatus');
  const status=pick(params,'status',['全部','报名中','未开始','已结束'],'全部');
  // Keep the existing rolling 24-hour / 3-day / 7-day deadline semantics and Beijing date-only cutoff.
  const effectiveStatus=`CASE WHEN ${deadline}<=? THEN '已截止' WHEN ${deadline}<=? THEN '即将截止' ELSE coalesce(nullif(${rawStatus},''),'报名中') END`;
  if(status==='报名中'){where.push(`(${deadline} IS NULL OR ${deadline}>?) AND (${effectiveStatus}) IN ('报名中','即将截止')`);values.push(now,now,now+7*86400000);}
  else if(status==='未开始'){where.push(`(${effectiveStatus})='未开始'`);values.push(now,now+7*86400000);}
  else if(status==='已结束'){where.push(`(${deadline}<=? OR (${effectiveStatus}) IN ('已截止','已结束','活动中'))`);values.push(now,now,now+7*86400000);}
  const quick=pick(params,'deadline',['全部','today','within3days','within7days'],'全部');if(quick!=='全部'){where.push(`${deadline}>? AND ${deadline}<=?`);values.push(now,now+({'today':1,'within3days':3,'within7days':7}[quick]||0)*86400000);}
  const fresh=pick(params,'fresh',['全部','today'],'全部');if(fresh==='today'){where.push('n.publish_date=?');values.push(new Date(now+8*3600000).toISOString().slice(0,10));}
  const date=text(params,'date',10);if(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new ApiError(400,'INVALID_DATE');where.push('n.publish_date=?');values.push(date);}
  const sort=pick(params,'sort',['publish','updated','deadline','school'],'publish');
  const orders:Record<string,string>={publish:'n.publish_date DESC,'+projection('sourceRank'),updated:projection('updatedSort')+' DESC,'+projection('sourceRank'),school:projection('schoolRank')+','+projection('sourceRank'),deadline:`CASE WHEN ${deadline}<=${Math.trunc(now)} THEN 1 ELSE 0 END,coalesce(${deadline},9007199254740991),`+projection('sourceRank')};
  const countKey=[...params.entries()].filter(([k])=>!['page','pageSize','sort'].includes(k)).sort(([a],[b])=>a.localeCompare(b));
  return {page,pageSize,where:where.join(' AND '),values,order:orders[sort],countKey:JSON.stringify(countKey),cacheMilliseconds:status!=='全部'||quick!=='全部'||fresh==='today'?60000:3600000};
}
export async function cachedCount(db:D1Database,query:ReturnType<typeof noticeSql>,now:number){
  const state=await db.prepare("SELECT value FROM _runtime_state WHERE key='notice_version'").first<{value:string}>();if(!state)throw new ApiError(503,'NOTICE_PROJECTION_PENDING');
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(state.value+'|'+query.countKey));const key=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
  const cached=await db.prepare('SELECT result_json,expires_at FROM _notice_query_cache WHERE cache_key=? AND data_version=?').bind(key,state.value).first<{result_json:string|null;expires_at:number}>();
  if(cached?.result_json&&cached.expires_at>now)return {total:JSON.parse(cached.result_json).total as number,cache:'HIT',version:state.value};
  const lease=await db.prepare(`INSERT INTO _notice_query_cache(cache_key,data_version,expires_at,lock_until,result_json) VALUES(?,?,0,?,NULL)
    ON CONFLICT(cache_key) DO UPDATE SET lock_until=excluded.lock_until,data_version=excluded.data_version
    WHERE _notice_query_cache.lock_until<=? RETURNING cache_key`).bind(key,state.value,now+15000,now).first();
  if(!lease)throw new ApiError(503,'COUNT_REFRESH_IN_PROGRESS');
  try{
    const row=await db.prepare('SELECT count(*) AS total FROM main__notices n WHERE '+query.where).bind(...query.values).first<{total:number}>();const total=row?.total||0;
    await db.prepare('UPDATE _notice_query_cache SET result_json=?,expires_at=?,lock_until=0 WHERE cache_key=?').bind(JSON.stringify({total}),now+query.cacheMilliseconds,key).run();
    return {total,cache:'MISS',version:state.value};
  }catch(error){
    // Leave the finite lease in place: a source failure must not trigger a retry from every request.
    throw error;
  }
}
