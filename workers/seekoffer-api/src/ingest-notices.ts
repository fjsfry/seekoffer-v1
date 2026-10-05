import {ApiError} from './auth.ts';
import {overrideStatements} from './notice-overrides.ts';
import {createNoticeProjection} from './notice-projection.ts';
import {prepareNoticeOrder} from './notice-order';

const textFields=['school_name','department_name','project_name','project_type','discipline','publish_date','deadline_date','event_start_date','event_end_date','apply_link','source_link','requirements','exam_interview_info','contact_info','remarks','status','deadline_level','source_site'] as const;
const arrays=['materials_required','tags'] as const;
const metadata=['collected_at','updated_at','last_checked_at','change_log','history_records','admin_status','admin_review_note','admin_deleted_at','is_private','is_verified','year','source_detail_complete'];
const ignoredCompare=new Set(['updated_at','collected_at','last_checked_at','deadline_level','change_log','history_records']);
type Row=Record<string,unknown>;
function object(v:unknown):Row{if(!v||Array.isArray(v)||typeof v!=='object')throw new ApiError(400,'INVALID_INGEST_OBJECT');return v as Row;}
function text(v:unknown,max:number){if(v===undefined||v===null)return '';if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw new ApiError(400,'INVALID_INGEST_TEXT');return v.trim();}
export async function requireIngestSecret(request:Request,secret?:string){
 if(!secret||secret.length<32)throw new ApiError(503,'INGEST_CREDENTIAL_PENDING');
 const supplied=request.headers.get('x-seekoffer-ingest-secret')||'';
 if(supplied.length>512)throw new ApiError(401,'INGEST_AUTH_REQUIRED');
 const digest=(s:string)=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));const [a,b]=await Promise.all([digest(supplied),digest(secret)]);let diff=0;new Uint8Array(a).forEach((n,i)=>diff|=n^new Uint8Array(b)[i]);if(diff)throw new ApiError(401,'INGEST_AUTH_REQUIRED');
}
export function normalizeIngestNotice(input:unknown,now:string):Row{
 const body=object(input);if(Object.keys(body).some(k=>!['id',...textFields,...arrays,...metadata].includes(k)))throw new ApiError(400,'UNSUPPORTED_INGEST_FIELD');
 if(body.source_detail_complete!==undefined&&typeof body.source_detail_complete!=='boolean')throw new ApiError(400,'INVALID_INGEST_BOOLEAN');
 const id=text(typeof body.id==='number'?String(body.id):body.id,180);if(!id||id.startsWith('custom-'))throw new ApiError(400,'INVALID_INGEST_ID');
 const row:Row={id};for(const key of textFields)row[key]=text(body[key],['requirements','exam_interview_info'].includes(key)?50000:['remarks','contact_info'].includes(key)?10000:1000);
 if(!row.school_name||!row.project_name||!row.source_site)throw new ApiError(400,'INGEST_SOURCE_REQUIRED');
 if(!row.source_link&&body.admin_status!=='pending'&&body.admin_status!=='hidden')throw new ApiError(400,'INGEST_SOURCE_REQUIRED');
 for(const key of ['source_link','apply_link'])if(row[key]){let u:URL;try{u=new URL(String(row[key]));}catch{throw new ApiError(400,'INVALID_SOURCE_URL');}if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw new ApiError(400,'INVALID_SOURCE_URL');}
 if(row.source_site==='用户手动录入')throw new ApiError(400,'PRIVATE_NOTICE_INGEST_FORBIDDEN');
 for(const key of arrays){const value=body[key]??[];if(!Array.isArray(value)||value.length>100)throw new ApiError(400,'INVALID_INGEST_ARRAY');row[key]=JSON.stringify(value.map(v=>text(v,1000)));}
 if(body.year!==undefined&&(!Number.isInteger(body.year)||Number(body.year)<2020||Number(body.year)>2100))throw new ApiError(400,'INVALID_INGEST_YEAR');row.year=body.year??2026;
 for(const key of ['is_private','is_verified'])if(body[key]!==undefined&&typeof body[key]!=='boolean')throw new ApiError(400,'INVALID_INGEST_BOOLEAN');
 row.is_verified=body.is_verified?1:0;row.status=row.status||'报名中';row.deadline_level=row.deadline_level||'future';
 const status=body.admin_status??'published';if(!['published','pending','hidden','rejected'].includes(String(status)))throw new ApiError(400,'INVALID_INGEST_REVIEW_STATE');
 row.admin_status=status;row.is_private=body.is_private||status!=='published'?1:0;row.admin_review_note=text(body.admin_review_note,2000);
 if(body.admin_deleted_at!==undefined&&body.admin_deleted_at!==null)throw new ApiError(400,'INGEST_DELETE_FORBIDDEN');
 for(const k of ['change_log','history_records']){const value=body[k]??[];if(!Array.isArray(value)||JSON.stringify(value).length>100000)throw new ApiError(400,'INVALID_INGEST_HISTORY');row[k]=JSON.stringify(value);}
 for(const k of ['collected_at','updated_at','last_checked_at'])row[k]=text(body[k],100)||now;
 const deadlineYear=String(row.deadline_date).match(/\b(20\d{2})\b/);if(!row.is_private&&deadlineYear&&Number(deadlineYear[1])<Number(row.year))throw new ApiError(400,'OUTDATED_DEADLINE');
 // Keep incomplete acquisitions for administrator review, outside every public
 // projection. One incomplete school/department must not block other sources.
 if(!row.is_private&&row.admin_status==='published'){
  const projectRow:Row={...row,is_verified:Boolean(row.is_verified)};
  for(const key of [...arrays,'change_log','history_records'])projectRow[key]=JSON.parse(String(row[key]));
  if(!createNoticeProjection(projectRow,0,0)){
   row.admin_status='pending';row.is_private=1;
   row.admin_review_note=[row.admin_review_note,'auto_quality:public_projection_required'].filter(Boolean).join(';');
  }
 }
 return row;
}
export async function ingestNotices(db:D1Database,input:Row,now=new Date().toISOString()){
 if(Object.keys(input).some(k=>!['notices','source','summary','dryRun'].includes(k))||input.dryRun!==undefined&&typeof input.dryRun!=='boolean'||!Array.isArray(input.notices)||input.notices.length<1||input.notices.length>6)throw new ApiError(400,'INGEST_BATCH_LIMIT');
 const source=text(input.source,100)||'d1-delta-ingest',incoming=input.notices.map(n=>normalizeIngestNotice(n,now));
 if(new Set(incoming.map(n=>n.id)).size!==incoming.length)throw new ApiError(400,'DUPLICATE_INGEST_ID');
 const found=await db.prepare('SELECT * FROM main__notices WHERE id IN ('+incoming.map(()=>'?').join(',')+')').bind(...incoming.map(n=>n.id)).all<Row>();
 const previous=new Map(found.results.map(n=>[n.id,n]));const changes:{before:Row|null;after:Row;patch:Row}[]=[];let unchanged=0,protectedCount=0;
 for(const [index,row] of incoming.entries()){
  const before=previous.get(row.id)||null;
  // Crawler refresh cannot undo any withdrawal or overwrite a manually managed record.
  if(before&&(before.created_by||before.is_private||before.admin_status!=='published'||before.admin_deleted_at||before.admin_reviewed_by)){protectedCount++;continue;}
  if(before&&row.is_private){protectedCount++;continue;}
  const patch:Row={};for(const [key,value]of Object.entries(row))if(key!=='id'&&!ignoredCompare.has(key)&&(!before||before[key]!==value))patch[key]=value;
  if(before){
   // List-only fallback data must not erase a previously acquired detail body.
   const original=input.notices[index] as Row;
   if(original.source_detail_complete===false)for(const key of ['requirements','materials_required','exam_interview_info','contact_info','is_verified','tags'])delete patch[key];
   for(const key of ['deadline_date','event_start_date','event_end_date'])if(!row[key])delete patch[key];
   // A crawler cannot change administrator review decisions in either direction.
   for(const key of ['admin_status','is_private','admin_review_note'])delete patch[key];
  }
  if(before&&!Object.keys(patch).length){unchanged++;continue;}
  if(before){for(const k of ['admin_status','is_private','admin_review_note'])delete patch[k];patch.updated_at=now;patch.updated_at_ts=now;patch.last_checked_at=now;
   // Keep historical arrays intact and append a compact field audit for real changes.
   const history=JSON.parse(String(before.change_log||'[]'));if(!Array.isArray(history))throw new ApiError(503,'INGEST_HISTORY_INVALID');history.push({at:now,source,fields:Object.keys(patch).filter(k=>!['updated_at','updated_at_ts','last_checked_at'].includes(k))});const serialized=JSON.stringify(history);if(serialized.length>500000)throw new ApiError(503,'INGEST_HISTORY_CAPACITY_REVIEW');patch.change_log=serialized;
  }
  const after=before?{...before,...patch}:{...row,created_by:null,admin_deleted_at:null,admin_reviewed_by:'',updated_at_ts:now};changes.push({before,after,patch});
 }
 if(input.dryRun===true)return{ok:true,dryRun:true,noticesReceived:incoming.length,wouldUpsert:changes.length,unchanged,protected:protectedCount};
 if(!changes.length)return{ok:true,noticesReceived:incoming.length,noticesUpserted:0,unchanged,protected:protectedCount};
 const day=now.slice(0,10),counterKey='notice_ingest_day:'+day,guard=crypto.randomUUID(),statements:D1PreparedStatement[]=[];
 const ordering=await prepareNoticeOrder(db,changes,true);statements.push(...ordering.begin);
 // The daily counter is telemetry only. The owner removed the application-level
 // count cap; Cloudflare quota errors still propagate and stop the caller.
 const conditions:string[]=[],params:unknown[]=[];
 for(const {before,after}of changes){if(before){const keys=Object.keys(before);conditions.push('EXISTS(SELECT 1 FROM main__notices WHERE '+keys.map(k=>'"'+k+'" IS ?').join(' AND ')+')');params.push(...keys.map(k=>before[k]));}else{conditions.push('NOT EXISTS(SELECT 1 FROM main__notices WHERE id=?)');params.push(after.id);}}
 // One guard per row stays below D1's 100 bind limit, inside the same atomic batch.
 let offset=0;for(let i=0;i<changes.length;i++){const n=changes[i].before?Object.keys(changes[i].before!).length:1;statements.push(db.prepare('INSERT INTO _business_transaction_guards(id,valid) VALUES(?,CASE WHEN '+conditions[i]+' THEN 1 ELSE 0 END)').bind(guard+':'+i,...params.slice(offset,offset+n)));offset+=n;}
 for(const {before,after,patch}of changes){
  const keys=Object.keys(before?patch:after);
  statements.push(before?db.prepare('UPDATE main__notices SET '+keys.map(k=>'"'+k+'"=?').join(',')+' WHERE id=?').bind(...keys.map(k=>patch[k]),after.id):db.prepare('INSERT INTO main__notices('+keys.map(k=>'"'+k+'"').join(',')+') VALUES('+keys.map(()=>'?').join(',')+')').bind(...keys.map(k=>after[k])));
  statements.push(...overrideStatements(db,before,after,true,ordering.orders.get(String(after.id))));
 }
 statements.push(db.prepare('INSERT INTO _runtime_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+? AS TEXT)').bind(counterKey,String(changes.length),changes.length));
 statements.push(db.prepare('INSERT INTO main__crawler_runs(source,notices_received,notices_upserted,success,summary) VALUES(?,?,?,1,?)').bind(source,incoming.length,changes.length,JSON.stringify({unchanged,protected:protectedCount,version:1})));
 for(let i=0;i<changes.length;i++)statements.push(db.prepare('DELETE FROM _business_transaction_guards WHERE id=?').bind(guard+':'+i));
 statements.push(...ordering.end);
 try{await db.batch(statements);}catch(e){if(e instanceof Error&&/CHECK constraint failed/.test(e.message))throw new ApiError(409,'INGEST_CONFLICT');throw e;}
 return{ok:true,noticesReceived:incoming.length,noticesUpserted:changes.length,unchanged,protected:protectedCount};
}
