import {publicNoticeRows,publicNoticeMetadata,summaryProjectionSql} from '../seekoffer-api/src/public-notice-page';
import {ApiError} from '../seekoffer-api/src/auth';
import {publicVisibility} from '../seekoffer-api/src/notice-sql';
import {liveSummary} from '../seekoffer-api/src/notice-projection';
import {boundedBody} from '../seekoffer-api/src/index';
import routes from '../../artifacts/cloudflare-static-preview/routes.json';
import {GET as extensionCallback} from '../../app/auth/extension-callback/route';
import {publicReadError} from './read-error';
import {reviewedIndex,reviewedVersion} from './reviewed-notices';
import {publicOutageActive,outageScript,outageSnapshotAt} from './notice-outage-window';
import {noticeListItemToProject,type NoticeListItem} from '../../lib/notice-record';
type Env={CORE:D1Database;ASSETS:Fetcher;SEEKOFFER_FRONTEND_PREVIEW_TOKEN:string};
// This preview binding is enforced as SELECT-only; no cache, business or schema writes.
export function readOnlyDatabase(db:D1Database,usage:{reads:number;queries:number}){
 const raw=new WeakMap<object,D1PreparedStatement>();
 const record=<T,>(r:D1Result<T>)=>{usage.reads+=Number(r.meta.rows_read||0);usage.queries++;if(Number(r.meta.rows_written||0)!==0)throw Error('PREVIEW_WRITE_VIOLATION');return r;};
 const wrap=(statement:D1PreparedStatement):D1PreparedStatement=>{const result={bind(...values:unknown[]){return wrap(statement.bind(...values));},async all(){return record(await statement.all());},async first(column?:string){const r=record(await statement.all<Record<string,unknown>>());return column?r.results[0]?.[column]??null:r.results[0]??null;},run(){throw Error('PREVIEW_SQL_READ_ONLY');},raw(){throw Error('PREVIEW_SQL_READ_ONLY');}} as D1PreparedStatement;raw.set(result,statement);return result;};
 return {prepare(sql:string){if(!/^SELECT\s/i.test(sql)||sql.replace(/'(?:''|[^'])*'/g, "''").includes(';'))throw Error('PREVIEW_SQL_READ_ONLY');if(usage.reads>250000)throw new ApiError(503,'PREVIEW_READ_BOUND');return wrap(db.prepare(sql));},async batch(statements:D1PreparedStatement[]){if(statements.some(s=>!raw.has(s)))throw Error('PREVIEW_SQL_SCOPE');return (await db.batch(statements.map(s=>raw.get(s)!))).map(record);},exec(){throw Error('PREVIEW_SQL_READ_ONLY');},dump(){throw Error('PREVIEW_SQL_READ_ONLY');},withSession(){throw Error('PREVIEW_SQL_READ_ONLY');}} as unknown as D1Database;
}
const pending=new Map<string,Promise<{value:unknown;cache:string}>>(),backoff=new Map<string,number>();
async function readCache<T>(_db:D1Database,version:string,name:string,now:number,load:()=>Promise<{value:T;expiresAt:number}>) {
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('static-preview-v1:'+version+name));
 const key='https://seekoffer-preview-cache.invalid/'+Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
 const hit=await caches.default.match(key);if(hit){const value=await hit.json() as {value:T;expiresAt:number};if(value.expiresAt>now)return {value:value.value,cache:'HIT'};}
 if((backoff.get(key)||0)>now)throw new ApiError(503,'PUBLIC_REFRESH_BACKOFF');
 const known=pending.get(key);if(known)return known as Promise<{value:T;cache:string}>;
 const promise=(async()=>{try{const result=await load(),json=JSON.stringify(result);if(new TextEncoder().encode(json).byteLength>512000)throw new ApiError(503,'PUBLIC_AGGREGATE_TOO_LARGE');const ttl=Math.max(1,Math.floor((result.expiresAt-now)/1000));await caches.default.put(key,new Response(json,{headers:{'Cache-Control':'public,max-age='+ttl,'Content-Type':'application/json'}}));return{value:result.value,cache:'MISS'};}catch(error){if(backoff.size>=128)backoff.clear();backoff.set(key,now+30000);throw error;}finally{pending.delete(key);}})();pending.set(key,promise);return promise;
}
const json=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow',...headers}});
export default{async fetch(request:Request,env:Env){
 const auth=request.headers.get('authorization')||'',expected=env.SEEKOFFER_FRONTEND_PREVIEW_TOKEN;
 if(!expected||expected.length<48||auth.length>256)return json({error:'PREVIEW_AUTH_REQUIRED'},401);
 const digest=(s:string)=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));const [a,b]=await Promise.all([digest(auth),digest('Bearer '+expected)]);let diff=0;new Uint8Array(a).forEach((n,i)=>diff|=n^new Uint8Array(b)[i]);if(diff)return json({error:'PREVIEW_AUTH_REQUIRED'},401);
 const usage={reads:0,queries:0};env={...env,CORE:readOnlyDatabase(env.CORE,usage)};
 try{
  const url=new URL(request.url),path=url.pathname.replace(/\/$/,'')||'/';
  if(path==='/_service-recovery.js'&&request.method==='GET')return new Response(publicOutageActive()?outageScript:'',{headers:{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store'}});
  if(path==='/api/public/notices'&&request.method==='GET'){
   const now=Date.now(),version=await reviewedVersion(env.CORE),name='indexed-page-v1:'+JSON.stringify([...url.searchParams].sort(([a],[b])=>a.localeCompare(b))) ;
   // Check the live version before the shared cache, but build the index only on
   // a cache miss. A new isolate must not parse all delta shards for a warm page.
   const result=await readCache(env.CORE,version,name,now,async()=>{const index=await reviewedIndex(env.CORE,version);return{value:index.search(url.searchParams,now),expiresAt:index.expiresAt(now)};});
   return json(result.value,200,{'X-D1-Rows-Read':String(usage.reads),'X-D1-Queries':String(usage.queries),'X-D1-Rows-Written':'0','X-Notice-Version':version,'X-Public-Count-Cache':result.cache});
  }
  if(path==='/api/public/notices/metadata'&&request.method==='GET'){
   const now=Date.now(),version=await reviewedVersion(env.CORE),name='indexed-metadata-v1:'+JSON.stringify([...url.searchParams].sort(([a],[b])=>a.localeCompare(b))) ;
   const result=await readCache(env.CORE,version,name,now,async()=>{const index=await reviewedIndex(env.CORE,version);return{value:index.metadata(url.searchParams,now),expiresAt:index.expiresAt(now)};});
   return json(result.value,200,{'X-D1-Rows-Read':String(usage.reads),'X-D1-Queries':String(usage.queries),'X-D1-Rows-Written':'0','X-Notice-Version':version,'X-Public-Metadata-Cache':result.cache});
  }
  if(path==='/api/public/notices/by-ids'&&request.method==='POST'){
   const body=await boundedBody(request,32768);if(Object.keys(body).some(k=>k!=='ids')||!Array.isArray(body.ids)||body.ids.length>100||body.ids.some(id=>typeof id!=='string'||!id||id.length>180))return json({error:'INVALID_IDS'},400);
   const ids=[...new Set(body.ids)];if(!ids.length)return json({items:[],source:'recovery'});
   const index=await reviewedIndex(env.CORE);return json({items:ids.map(id=>index.byId.get(id as string)).filter(p=>p!==undefined).map(p=>liveSummary(p)),source:'recovery'},200,{'X-D1-Rows-Read':String(usage.reads),'X-D1-Rows-Written':'0'});
  }
  if(path==='/api/public/notices/deadlines'&&request.method==='GET'){
   for(const k of url.searchParams.keys())if(!['cursor','version'].includes(k)||url.searchParams.getAll(k).length!==1)return json({error:'INVALID_FILTER'},400);
   const now=Date.now(),match=/^v1:(\d{13}):(\d{1,6})$/.exec(url.searchParams.get('cursor')||''),index=await reviewedIndex(env.CORE),version=index.version;
   if(url.searchParams.has('cursor')&&!match||!match&&url.searchParams.has('version'))throw new ApiError(400,'INVALID_CURSOR');
   const at=match?Number(match[1]):Math.floor(now/60000)*60000,offset=match?Number(match[2]):0;
   if(at%60000||offset%100||offset>100000||at>now||now-at>180000)throw new ApiError(400,'INVALID_CURSOR');
   if(match&&url.searchParams.get('version')!==version)throw new ApiError(409,'PUBLIC_VERSION_CHANGED');
   const result=await readCache(env.CORE,version,'deadlines-v2:'+at+':'+offset,now,async()=>{
    const rows=index.rows.filter(p=>p.deadlineMs!==null&&p.deadlineMs>at&&p.deadlineMs<=at+7*86400000).slice(offset,offset+101);
    return{value:{items:rows.slice(0,100).map(p=>liveSummary(p,at)),nextCursor:rows.length>100?'v1:'+at+':'+(offset+100):null,version,source:'recovery',servedAt:new Date(at).toISOString()},expiresAt:at+180000};
   });
   if(!publicOutageActive()&&version!==await env.CORE.prepare("SELECT value FROM _runtime_state WHERE key='notice_version'").first('value'))throw new ApiError(409,'PUBLIC_VERSION_CHANGED');
   return json(result.value,200,{'X-Notice-Version':version,'X-Public-Metadata-Cache':result.cache,'X-D1-Rows-Read':String(usage.reads),'X-D1-Rows-Written':'0'});
  }
  if(path==='/api/public/notice-detail'&&request.method==='GET'){
   const id=url.searchParams.get('id');if(!id||id.length>180||[...url.searchParams.keys()].some(k=>k!=='id'))return json({error:'INVALID_ID'},400);
   if(publicOutageActive()){
    const p=(await reviewedIndex(env.CORE)).byId.get(id);if(!p)return json({error:'NOTICE_UNAVAILABLE'},404);
    const item=noticeListItemToProject(liveSummary(p) as NoticeListItem);item.remarks='当前为公开通知应急只读模式，仅展示已审核摘要。正文请点击本页的官方来源链接查看；数据更新时间：北京时间2026年9月11日18:39。';
    return json(item,200,{'X-Public-Mode':'reviewed-snapshot','X-Public-Snapshot-At':outageSnapshotAt,'X-D1-Rows-Read':'0'});
   }
   const response=await fetch('https://migration.seekoffer.com.cn/v1/public/notice-detail?id='+encodeURIComponent(id),{headers:{Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(12000)});
   if(!response.ok)return json({error:response.status===404?'NOTICE_UNAVAILABLE':'DETAIL_UNAVAILABLE'},[401,403,402,404].includes(response.status)?response.status:503);
   const body=await response.text();if(new TextEncoder().encode(body).byteLength>1000000)return json({error:'DETAIL_TOO_LARGE'},503);return new Response(body,{headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
  }
  if(path.startsWith('/download/windows/')||path==='/api/desktop-download/windows')return Response.redirect(new URL('/download/',url).href,303);
  // Reuse the exact production callback validation; only its fixed origin is
  // adapted for this secret-protected preview. PKCE remains in the extension.
  if(path==='/auth/extension-callback'&&request.method==='GET')return extensionCallback(new Request('https://www.seekoffer.com.cn'+url.pathname+url.search));
  if(path.startsWith('/api/'))return json({error:'PREVIEW_ROUTE_NOT_ENABLED'},503);
  if(!['GET','HEAD'].includes(request.method))return json({error:'METHOD_NOT_ALLOWED'},405);
  const mapping=routes as Record<string,{html:string;rsc?:string}>;
  const detail=path==='/notices/detail'||/^\/notices\/[^/]+$/.test(path);
  const route=mapping[path];let asset=detail?'/_detail/index.html':request.headers.get('rsc')==='1'&&route?.rsc?route.rsc:route?.html||url.pathname;
  if(asset.includes('..')||asset.includes('\\'))return json({error:'INVALID_PATH'},400);
  const target=new URL(asset,url),response=await env.ASSETS.fetch(new Request(target,{method:request.method}));
  let result=new Response(response.body,response);result.headers.set('Cache-Control','no-store');result.headers.set('X-Robots-Tag','noindex, nofollow');if(request.headers.get('rsc')==='1'&&route?.rsc)result.headers.set('Content-Type','text/x-component');
  if(publicOutageActive()&&request.method==='GET'&&result.headers.get('Content-Type')?.includes('text/html'))result=new HTMLRewriter().on('head',{element(e){e.append('<script src="/_service-recovery.js" defer></script>',{html:true});}}).transform(result);
  return result;
 }catch(error){const failure=publicReadError(error);return json({error:failure.message},failure.status,{'Retry-After':failure.status===402?'3600':'30'});}
}};
