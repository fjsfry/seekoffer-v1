import {ApiError} from './auth.ts';
import {isoMicro} from './payments/transaction.ts';
type Row=Record<string,unknown>;
export interface WechatLedgerConfig{WECHAT_LEDGER_ENABLED?:string;WECHAT_LEDGER_SECRET?:string}
const table='main__wechat_daily_publications';
const columns=['digest_date','status','notice_count','included_notice_count','notice_ids','article_title','article_digest','content_source_url','content_html','wechat_media_id','wechat_thumb_media_id','error_code','error_message','metadata','created_at','updated_at'];
function only(v:Row,names:string[]){if(Object.keys(v).some(k=>!names.includes(k)))throw new ApiError(400,'UNSUPPORTED_PUBLICATION_FIELD');}
function object(v:unknown):Row{if(!v||typeof v!=='object'||Array.isArray(v))throw new ApiError(400,'INVALID_PUBLICATION_OBJECT');return v as Row;}
function text(v:unknown,max:number){if(typeof v!=='string'||v.length>max||/[\u0000]/.test(v))throw new ApiError(400,'INVALID_PUBLICATION_TEXT');return v;}
function date(v:unknown){const s=text(v,10);if(!/^20\d{2}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s+'T00:00:00Z'))||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)throw new ApiError(400,'INVALID_PUBLICATION_DATE');return s;}
function uuid(v:unknown){const s=text(v,36);if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(s))throw new ApiError(400,'INVALID_PUBLICATION_TOKEN');return s;}
const key=(d:string)=>'wechat_publication:'+d;
async function sha(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function requireWechatLedger(request:Request,config:WechatLedgerConfig){
 if(config.WECHAT_LEDGER_ENABLED!=='true'||!config.WECHAT_LEDGER_SECRET||config.WECHAT_LEDGER_SECRET.length<32)throw new ApiError(503,'WECHAT_LEDGER_MAINTENANCE');
 const supplied=request.headers.get('x-wechat-ledger-secret')||'';if(supplied.length>200)throw new ApiError(401,'WECHAT_LEDGER_AUTH_REQUIRED');
 const [a,b]=await Promise.all([sha(supplied),sha(config.WECHAT_LEDGER_SECRET)]);let different=0;for(let i=0;i<a.length;i++)different|=a.charCodeAt(i)^b.charCodeAt(i);if(different)throw new ApiError(401,'WECHAT_LEDGER_AUTH_REQUIRED');
}
async function read(db:D1Database,d:string){
 const r=await db.prepare('SELECT '+columns.map(c=>'p.'+c).join(',')+',s.value AS ledger_state FROM '+table+' p LEFT JOIN _runtime_state s ON s.key=? WHERE p.digest_date=?').bind(key(d),d).first<Row>();
 if(!r)return null;for(const name of ['notice_ids','metadata'])r[name]=JSON.parse(String(r[name]));return r;
}
function normalizePayload(body:Row,d:string){
 const allowed=['digest_date','status','notice_count','included_notice_count','notice_ids','article_title','article_digest','content_source_url','content_html','error_code','error_message','metadata'];only(body,allowed);
 if(body.digest_date!==d||body.status!=='preparing'||!Number.isSafeInteger(body.notice_count)||Number(body.notice_count)<0||Number(body.notice_count)>4000||!Number.isSafeInteger(body.included_notice_count)||Number(body.included_notice_count)<0||Number(body.included_notice_count)>Number(body.notice_count))throw new ApiError(400,'INVALID_PUBLICATION_COUNTS');
 if(!Array.isArray(body.notice_ids)||body.notice_ids.length!==body.notice_count||new Set(body.notice_ids).size!==body.notice_ids.length)throw new ApiError(400,'INVALID_PUBLICATION_IDS');for(const id of body.notice_ids)text(id,180);
 let u:URL;try{u=new URL(text(body.content_source_url,1500));}catch{throw new ApiError(400,'INVALID_PUBLICATION_SOURCE');}if(u.origin!=='https://www.seekoffer.com.cn'||u.username||u.password||u.hash)throw new ApiError(400,'INVALID_PUBLICATION_SOURCE');
 const value={...body};for(const [name,max]of [['article_title',200],['article_digest',500],['content_html',60000],['error_code',100],['error_message',2000]] as const)value[name]=text(body[name],max);
 const metadata=JSON.stringify(object(body.metadata));if(new TextEncoder().encode(metadata).length>16000)throw new ApiError(413,'PUBLICATION_METADATA_BOUND');value.metadata=metadata;value.notice_ids=JSON.stringify(body.notice_ids);return value;
}
async function atomic(db:D1Database,condition:string,params:unknown[],steps:D1PreparedStatement[]){
 const guard=crypto.randomUUID();try{await db.batch([db.prepare('INSERT INTO _business_transaction_guards(id,valid) VALUES(?,CASE WHEN '+condition+' THEN 1 ELSE 0 END)').bind(guard,...params),...steps,db.prepare('DELETE FROM _business_transaction_guards WHERE id=?').bind(guard)]);}catch(e){if(e instanceof Error&&/CHECK constraint failed: valid=1/.test(e.message))throw new ApiError(409,'PUBLICATION_REVISION_CONFLICT');throw e;}
}
export async function publicationAction(db:D1Database,body:Row,now=Date.now()){
 const d=date(body.date),stateKey=key(d);
 if(body.action==='get'){only(body,['action','date']);return{publication:await read(db,d)};}
 if(body.action==='claim'){
  only(body,['action','date','expected','payload']);const current=await read(db,d),expected=body.expected===null?null:object(body.expected);
  if(expected)only(expected,['updated_at','status','ledger_state']);
  if(current?.status==='preparing')throw new ApiError(409,'PUBLICATION_RECONCILIATION_REQUIRED');
  if((current===null)!==(expected===null)||current&&expected&&(current.updated_at!==expected.updated_at||current.status!==expected.status||current.ledger_state!==expected.ledger_state))throw new ApiError(409,'PUBLICATION_REVISION_CONFLICT');
  const payload=normalizePayload(object(body.payload),d),names=Object.keys(payload),token=crypto.randomUUID(),state=JSON.stringify({token,phase:'preparing'}),stamp=isoMicro(now),day='wechat_jobs_day:'+new Date(now).toISOString().slice(0,10);
  const used=Number(await db.prepare('SELECT value FROM _runtime_state WHERE key=?').bind(day).first('value')||0);if(used>=6)throw new ApiError(402,'PUBLICATION_DAILY_BUDGET');
  let condition='coalesce((SELECT CAST(value AS INTEGER) FROM _runtime_state WHERE key=?),0)<6';const params:unknown[]=[day];
  if(current){condition+=' AND EXISTS(SELECT 1 FROM '+table+' WHERE digest_date=? AND updated_at=? AND status=?) AND (SELECT value FROM _runtime_state WHERE key=?) IS ?';params.push(d,current.updated_at,current.status,stateKey,current.ledger_state);}
  else{condition+=' AND NOT EXISTS(SELECT 1 FROM '+table+' WHERE digest_date=?) AND NOT EXISTS(SELECT 1 FROM _runtime_state WHERE key=?)';params.push(d,stateKey);}
  await atomic(db,condition,params,[
   db.prepare('INSERT INTO '+table+'('+names.join(',')+',updated_at) VALUES('+names.map(()=>'?').join(',')+',?) ON CONFLICT(digest_date) DO UPDATE SET '+names.filter(n=>n!=='digest_date').map(n=>n+'=excluded.'+n).join(',')+',updated_at=excluded.updated_at').bind(...names.map(n=>payload[n]),stamp),
   db.prepare('INSERT INTO _runtime_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(stateKey,state),
   db.prepare("INSERT INTO _runtime_state(key,value) VALUES(?,'1') ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT)").bind(day)
  ]);return{claimed:true,token};
 }
 if(body.action==='complete'){
  only(body,['action','date','token','patch']);const token=uuid(body.token),patch=object(body.patch);only(patch,['status','wechat_media_id','wechat_thumb_media_id','error_code','error_message']);
  if(!['drafted','skipped','failed','uncertain'].includes(String(patch.status)))throw new ApiError(400,'INVALID_PUBLICATION_STATUS');
  const normalized:Row={status:patch.status==='uncertain'?'preparing':patch.status};
  for(const n of ['wechat_media_id','wechat_thumb_media_id','error_code','error_message'])if(n in patch)normalized[n]=text(patch[n],n==='error_message'?2000:200);
  if(patch.status==='drafted'&&(!normalized.wechat_media_id||!normalized.wechat_thumb_media_id))throw new ApiError(400,'PUBLICATION_MEDIA_REQUIRED');
  if(patch.status==='uncertain'){normalized.error_code='PROVIDER_RESULT_UNKNOWN';normalized.error_message='Original provider result needs reconciliation; automatic republishing is blocked.';}
  const fingerprint=await sha(JSON.stringify(normalized)),previous=await db.prepare('SELECT value FROM _runtime_state WHERE key=?').bind(stateKey).first<string>('value');
  if(!previous)throw new ApiError(409,'PUBLICATION_CLAIM_REQUIRED');const parsed=JSON.parse(previous);if(parsed.token!==token)throw new ApiError(409,'PUBLICATION_REVISION_CONFLICT');
  if(parsed.phase!=='preparing'){if(parsed.fingerprint===fingerprint)return{completed:true,replayed:true};throw new ApiError(409,'PUBLICATION_RESULT_CONFLICT');}
  const names=Object.keys(normalized),condition="(SELECT value FROM _runtime_state WHERE key=?)=? AND EXISTS(SELECT 1 FROM "+table+" WHERE digest_date=? AND status='preparing')";
  try{await atomic(db,condition,[stateKey,previous,d],[db.prepare('UPDATE '+table+' SET '+names.map(n=>n+'=?').join(',')+',updated_at=? WHERE digest_date=?').bind(...names.map(n=>normalized[n]),isoMicro(now),d),db.prepare('UPDATE _runtime_state SET value=? WHERE key=?').bind(JSON.stringify({token,phase:patch.status==='uncertain'?'uncertain':'complete',fingerprint}),stateKey)]);}catch(error){if(error instanceof ApiError&&error.message==='PUBLICATION_REVISION_CONFLICT'){const latest=JSON.parse(await db.prepare('SELECT value FROM _runtime_state WHERE key=?').bind(stateKey).first<string>('value')||'{}');if(latest.token===token&&latest.fingerprint===fingerprint)return{completed:true,replayed:true};}throw error;}
  return{completed:true,replayed:false};
 }
 throw new ApiError(400,'UNKNOWN_PUBLICATION_ACTION');
}
