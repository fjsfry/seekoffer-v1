import {ApiError} from './auth.ts';
import {normalizeLegacyApplication,legacyApplicationFields,legacyUuid} from '../../../lib/legacy-application-record';
const columns=legacyApplicationFields.map(f=>f[1]);
const MAX_DAILY=400;
async function digest(text:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function applicationId(owner:string,project:string,sourceId:string){if(legacyUuid.test(sourceId))return sourceId.toLowerCase();const hex=(await digest('seekoffer:legacy-application:v1:'+owner+':'+project)).split('');hex[12]='8';hex[16]='8';const s=hex.join('');return[s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20,32)].join('-');}
type Checkpoint={version:number;sourceHash:string;applicationId:string;originalLocalId:string};
export async function recoverLegacyApplications(db:D1Database,owner:string,body:Record<string,unknown>){
  if(Object.keys(body).some(k=>k!=='records')||!Array.isArray(body.records)||body.records.length<1||body.records.length>8)throw new ApiError(400,'INVALID_RECOVERY_BATCH');
  const grant=await db.prepare('SELECT value FROM _runtime_state WHERE key=?').bind('legacy_recovery_allow:'+owner).first<{value:string}>();
  let permission:{enabled:boolean;maxRecords:number;expiresAt:string}|null=null;try{permission=grant?JSON.parse(grant.value):null;}catch{}
  if(permission?.enabled!==true||!Number.isInteger(permission.maxRecords)||permission.maxRecords<1||permission.maxRecords>400||!(Date.parse(permission.expiresAt)>Date.now()))throw new ApiError(403,'LEGACY_RECOVERY_NOT_AUTHORIZED');
  const dailyKey='legacy_recovery_day:'+new Date().toISOString().slice(0,10),ownerKey='legacy_recovery_used:'+owner;
  const records=[];const projects=new Set<string>();
  for(const raw of body.records){let row;try{row=normalizeLegacyApplication(raw,owner);}catch(e){throw new ApiError(400,e instanceof Error?e.message:'INVALID_LEGACY_RECORD');}if(projects.has(row.projectId))throw new ApiError(400,'DUPLICATE_RECOVERY_PROJECT');projects.add(row.projectId);records.push({...row,sourceHash:await digest(row.fingerprint),key:'legacy_recovery:'+owner+':'+await digest(row.projectId),id:await applicationId(owner,row.projectId,row.sourceId)});}
  const marks=records.map(()=>'?').join(',');
  const checkpoints=await db.prepare('SELECT key,value FROM _runtime_state WHERE key IN ('+marks+')').bind(...records.map(r=>r.key)).all<{key:string;value:string}>();
  const known=new Map(checkpoints.results.map(r=>[r.key,JSON.parse(r.value) as Checkpoint]));
  const existing=await db.prepare('SELECT id,project_id,'+columns.join(',')+' FROM main__applications WHERE user_id=? AND project_id IN ('+marks+')').bind(owner,...records.map(r=>r.projectId)).all<Record<string,unknown>>();
  const byProject=new Map(existing.results.map(r=>[r.project_id,r]));const conflicts=new Set<string>();const statements:D1PreparedStatement[]=[];
  const budget='CAST(coalesce((SELECT value FROM _runtime_state WHERE key=?),\'0\') AS INTEGER)<? AND CAST(coalesce((SELECT value FROM _runtime_state WHERE key=?),\'0\') AS INTEGER)<?';
  for(const row of records){
    if(known.has(row.key))continue;const prior=byProject.get(row.projectId);
    if(prior&&columns.some(c=>prior[c]!==row.fields[c])){conflicts.add(row.projectId);continue;}
    const id=prior?String(prior.id):row.id;row.id=id;const checkpoint=JSON.stringify({version:1,sourceHash:row.sourceHash,applicationId:id,originalLocalId:row.sourceId});
    if(prior){
      statements.push(db.prepare('INSERT INTO _runtime_state(key,value) SELECT ?,? WHERE '+budget+' AND EXISTS(SELECT 1 FROM main__applications WHERE user_id=? AND id=? AND '+columns.map(c=>c+' IS ?').join(' AND ')+') ON CONFLICT(key) DO NOTHING').bind(row.key,checkpoint,dailyKey,MAX_DAILY,ownerKey,permission.maxRecords,owner,id,...columns.map(c=>row.fields[c])));
    }else{
      statements.push(db.prepare('INSERT INTO main__applications(id,user_id,project_id,'+columns.join(',')+') SELECT '+Array(3+columns.length).fill('?').join(',')+' WHERE '+budget+' AND NOT EXISTS(SELECT 1 FROM _runtime_state WHERE key=?) ON CONFLICT DO NOTHING RETURNING id').bind(id,owner,row.projectId,...columns.map(c=>row.fields[c]),dailyKey,MAX_DAILY,ownerKey,permission.maxRecords,row.key));
      statements.push(db.prepare('INSERT INTO _runtime_state(key,value) SELECT ?,? WHERE changes()>0 ON CONFLICT(key) DO NOTHING').bind(row.key,checkpoint));
    }
    statements.push(db.prepare('INSERT INTO _runtime_state(key,value) SELECT ?,\'1\' WHERE changes()>0 ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT)').bind(ownerKey));
    statements.push(db.prepare('INSERT INTO _runtime_state(key,value) SELECT ?,\'1\' WHERE changes()>0 ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT)').bind(dailyKey));
  }
  if(statements.length)await db.batch(statements);
  const after=await db.prepare('SELECT key,value FROM _runtime_state WHERE key IN ('+marks+')').bind(...records.map(r=>r.key)).all<{key:string;value:string}>();const saved=new Map(after.results.map(r=>[r.key,JSON.parse(r.value) as Checkpoint]));
  const current=await db.prepare('SELECT id,project_id FROM main__applications WHERE user_id=? AND project_id IN ('+marks+')').bind(owner,...records.map(r=>r.projectId)).all<{id:string;project_id:string}>();const present=new Map(current.results.map(r=>[r.project_id,r.id]));
  const counters=await db.prepare('SELECT key,value FROM _runtime_state WHERE key IN (?,?)').bind(dailyKey,ownerKey).all<{key:string;value:string}>();const used=new Map(counters.results.map(r=>[r.key,Number(r.value)]));const remaining=Math.max(0,Math.min(MAX_DAILY-(used.get(dailyKey)||0),permission.maxRecords-(used.get(ownerKey)||0)));
  return {items:records.map(row=>{const mark=saved.get(row.key);const status=mark?(mark.sourceHash!==row.sourceHash?'source_conflict':present.get(row.projectId)!==mark.applicationId?'deleted_after_recovery':known.has(row.key)?'already_recovered':byProject.has(row.projectId)?'already_present':'imported'):conflicts.has(row.projectId)||present.has(row.projectId)?'remote_conflict':remaining===0?'budget_paused':'record_conflict';return{projectId:row.projectId,status,applicationId:mark?.applicationId};}),sourceRetained:true,remaining};
}
