import {ApiError} from './auth.ts';
import {FILL_AUTHORIZATION_URL,fillRequestId,validateFillGrant,validateOwnedFillGrant,type FillGrant} from './fill-grant.ts';
import {isoMicro} from './payments/transaction.ts';
const freeFillLimit=3;
type Row=Record<string,unknown>;
const orderColumns='id,plan_id,provider,out_trade_no,amount_cents,currency,status,code_url,checkout_url,expires_at,created_at,paid_at';
function only(body:Row,keys:string[]){if(Object.keys(body).some(k=>!keys.includes(k)))throw new ApiError(400,'UNSUPPORTED_BILLING_FIELD');}
export function billingMonth(now=Date.now()){const local=new Date(now+28800000);return{periodStart:isoMicro(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),1)-28800000),periodEnd:isoMicro(Date.UTC(local.getUTCFullYear(),local.getUTCMonth()+1,1)-28800000)};}
function active(row:Row|null,now:number){return row?.status==='active'&&(!row.starts_at||Date.parse(String(row.starts_at))<=now)&&(!row.expires_at||Date.parse(String(row.expires_at))>now);}
export async function billingPlans(db:D1Database){const result=await db.prepare('SELECT id,name,description,price_cents,currency,duration_days,benefits,sort_order,is_recommended FROM main__billing_plans WHERE is_active=1 ORDER BY sort_order,id').all<Row>();return{plans:result.results.map(r=>({...r,benefits:JSON.parse(String(r.benefits)),is_recommended:Boolean(r.is_recommended)})),freeLimit:5,freeFillLimit,providers:{wechat:false,alipay:false},purchasesAvailable:false};}
async function usage(db:D1Database,owner:string,isPro:boolean,now:number){const period=billingMonth(now);const used=await db.prepare("SELECT count(*) AS n FROM main__billing_fill_sessions WHERE user_id=? AND status='consumed' AND tier='free' AND consumed_at>=? AND consumed_at<?").bind(owner,period.periodStart,period.periodEnd).first<number>('n');return{used:used??0,limit:isPro?null:freeFillLimit,remaining:isPro?null:Math.max(0,freeFillLimit-(used??0)),unlimited:isPro,...period};}
export async function billingEntitlement(db:D1Database,owner:string,now=Date.now()){
 const row=await db.prepare('SELECT user_id,plan_id,status,starts_at,expires_at,source_order_id,metadata FROM main__user_entitlements WHERE user_id=?').bind(owner).first<Row>();const isPro=active(row,now);
 const entitlement=row?{...row,status:row.status==='active'&&!isPro?(row.starts_at&&Date.parse(String(row.starts_at))>now?'free':'expired'):row.status,metadata:JSON.parse(String(row.metadata||'{}'))}:{user_id:owner,plan_id:null,status:'free',starts_at:null,expires_at:null};
 const [plans,applicationCount,fillUsage,temporary]=await Promise.all([billingPlans(db),db.prepare('SELECT count(*) n FROM main__applications WHERE user_id=?').bind(owner).first<number>('n'),usage(db,owner,isPro,now),db.prepare("SELECT value FROM _runtime_state WHERE key='website_recovery_application_quota'").first<string>('value')]);
 return{...plans,entitlement,isPro,applicationCount:applicationCount??0,fillUsage,temporaryUnlimitedApplications:temporary==='unlimited'};
}
async function sha(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
function activeAccountSql(owner: string, time: string) {
 return `EXISTS(SELECT 1 FROM main__auth_subjects u LEFT JOIN main__user_moderation m ON m.user_id=u.id
 WHERE u.id=${owner} AND u.deleted_at IS NULL AND u.email_confirmed_at IS NOT NULL
 AND (u.banned_until IS NULL OR u.banned_until<=${time}) AND coalesce(m.status,'active') NOT IN ('banned','blocked','disabled','deleted'))`;
}
function currentProSql(owner: string, time: string) {
 return `EXISTS(SELECT 1 FROM main__user_entitlements e WHERE e.user_id=${owner} AND e.status='active' AND (e.starts_at IS NULL OR julianday(e.starts_at)<=julianday(${time})) AND (e.expires_at IS NULL OR julianday(e.expires_at)>julianday(${time})))`;
}
async function checkFillOwner(db:D1Database,owner:string,applicationId:string,time:string){
 const account=await db.prepare(`SELECT 1 AS allowed WHERE ${activeAccountSql('?1','?2')}`).bind(owner,time).first();
 if(!account)throw new ApiError(403,'ACCOUNT_BLOCKED');
 const application=await db.prepare('SELECT id FROM main__applications WHERE id=? AND user_id=?').bind(applicationId,owner).first();
 if(!application)throw new ApiError(403,'FILL_SESSION_APPLICATION_NOT_FOUND');
}
export async function prepareFill(db:D1Database,owner:string,body:Row,clock:()=>number=Date.now){
 let now=clock();
 only(body,['action','requestId','grant']);
 if(body.action!=='prepare-fill-session')throw new ApiError(400,'UNSUPPORTED_BILLING_ACTION');
 const requestId=fillRequestId(body.requestId),grant=await validateOwnedFillGrant(owner,body.grant,now);
 const serialized=JSON.stringify(grant);
 await checkFillOwner(db,owner,grant.applicationId,isoMicro(now));
 const bytes=crypto.getRandomValues(new Uint8Array(32)),token=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
 const tokenHash=await sha(token);
 // Eligibility reads and hashing can outlive the grant or cross a quota month.
 now=clock();validateFillGrant(grant,now);
 const time=isoMicro(now),period=billingMonth(now);
 // Every mutable eligibility check is repeated inside the INSERT. Concurrent
 // requests cannot bypass rate/quota guards or rebind a request/grant/nonce.
 const pro=currentProSql('?1','?5');
 const row=await db.prepare(`INSERT INTO main__billing_fill_sessions
 (user_id,request_id,token_hash,field_count,tier,expires_at,created_at,updated_at,bound_grant)
 SELECT ?1,?2,?3,?4,CASE WHEN ${pro} THEN 'pro' ELSE 'free' END,?6,?5,?5,?7
 WHERE ${activeAccountSql('?1','?5')}
 AND EXISTS(SELECT 1 FROM main__applications WHERE id=?8 AND user_id=?1)
 AND (SELECT count(*) FROM main__billing_fill_sessions WHERE user_id=?1 AND created_at>=?9)<10
 AND (${pro} OR (SELECT count(*) FROM main__billing_fill_sessions WHERE user_id=?1 AND status='consumed' AND tier='free' AND consumed_at>=?10 AND consumed_at<?11)<3)
 ON CONFLICT DO NOTHING RETURNING tier`).bind(owner,requestId,tokenHash,grant.fieldIds.length,time,isoMicro(Date.parse(grant.expiresAt)),serialized,grant.applicationId,isoMicro(now-60000),period.periodStart,period.periodEnd).first<Row>();
 if(!row){
  const duplicate=await db.prepare(`SELECT status FROM main__billing_fill_sessions WHERE (user_id=?1 AND request_id=?2)
   OR json_extract(bound_grant,'$.grantId')=?3 OR json_extract(bound_grant,'$.nonce')=?4 LIMIT 1`).bind(owner,requestId,grant.grantId,grant.nonce).first<Row>();
  if(duplicate)throw new ApiError(409,'FILL_REQUEST_CONFLICT');
  await checkFillOwner(db,owner,grant.applicationId,time);
  const entitlement=await billingEntitlement(db,owner,now);
  if(!entitlement.isPro&&entitlement.fillUsage.remaining===0)throw new ApiError(402,'FILL_LIMIT_REACHED');
  throw new ApiError(429,'FILL_SESSION_RATE_OR_CONFLICT');
 }
 const fillUsage=await usage(db,owner,row.tier==='pro',now);
 validateFillGrant(grant,clock());
 return{authorization:{token,verificationUrl:FILL_AUTHORIZATION_URL,expiresAt:grant.expiresAt},fillUsage};
}
export async function consumeFill(db:D1Database,body:Row,clock:()=>number=Date.now,expectedOwner?:string){
 let now=clock();
 // A possession-only token never proves which extension account is consuming it.
 if(!expectedOwner)throw new ApiError(401,'AUTH_REQUIRED');
 only(body,['action','token','requestId','grant']);
 if(body.action!=='consume-fill-session'||typeof body.token!=='string'||!/^[A-Za-z0-9_-]{40,64}$/.test(body.token))throw new ApiError(403,'INVALID_FILL_SESSION');
 const requestId=fillRequestId(body.requestId),grant=await validateOwnedFillGrant(expectedOwner,body.grant,now);
 const hash=await sha(body.token),serialized=JSON.stringify(grant),owner=expectedOwner;
 const stored=await db.prepare('SELECT status,bound_grant,expires_at FROM main__billing_fill_sessions WHERE token_hash=? AND user_id=? AND request_id=?').bind(hash,owner,requestId).first<Row>();
 if(!stored)throw new ApiError(403,'INVALID_FILL_SESSION');
 if(!stored.bound_grant)throw new ApiError(403,'FILL_SESSION_BOUND_GRANT_REQUIRED');
 if(stored.bound_grant!==serialized)throw new ApiError(403,'FILL_SESSION_GRANT_MISMATCH');
 if(stored.status==='consumed')throw new ApiError(409,'FILL_SESSION_ALREADY_CONSUMED');
 if(stored.status!=='prepared'||Date.parse(String(stored.expires_at))<=now)throw new ApiError(410,'FILL_SESSION_EXPIRED');
 await checkFillOwner(db,owner,grant.applicationId,isoMicro(now));
 now=clock();validateFillGrant(grant,now);
 const time=isoMicro(now),period=billingMonth(now);
 const pro=currentProSql('s.user_id','?5');
 // One SQLite statement is the consumption transaction. Account/application
 // ownership, single-use state, immutable binding, expiry and current monthly
 // quota are checked by the same CAS that increments usage through consumed_at.
 const consumed=await db.prepare(`UPDATE main__billing_fill_sessions AS s SET status='consumed',
 tier=CASE WHEN ${pro} THEN 'pro' ELSE 'free' END,consumed_at=?5,updated_at=?5
 WHERE token_hash=?3 AND user_id=?1 AND request_id=?2 AND bound_grant=?4 AND status='prepared' AND expires_at>?5
 AND ${activeAccountSql('s.user_id','?5')}
 AND EXISTS(SELECT 1 FROM main__applications a WHERE a.id=?6 AND a.user_id=s.user_id)
 AND (${pro} OR (SELECT count(*) FROM main__billing_fill_sessions u WHERE u.user_id=s.user_id AND u.status='consumed' AND u.tier='free' AND u.consumed_at>=?7 AND u.consumed_at<?8)<3)
 RETURNING request_id,bound_grant,tier,
 (SELECT count(*) FROM main__billing_fill_sessions u WHERE u.user_id=?1 AND u.token_hash<>?3
 AND u.status='consumed' AND u.tier='free' AND u.consumed_at>=?7 AND u.consumed_at<?8) AS other_free_used`).bind(owner,requestId,hash,serialized,time,grant.applicationId,period.periodStart,period.periodEnd).first<Row>();
 if(!consumed){
  const current=await db.prepare('SELECT status,expires_at FROM main__billing_fill_sessions WHERE token_hash=? AND user_id=? AND request_id=?').bind(hash,owner,requestId).first<Row>();
  if(!current)throw new ApiError(403,'INVALID_FILL_SESSION');
  if(current.status==='consumed')throw new ApiError(409,'FILL_SESSION_ALREADY_CONSUMED');
  if(Date.parse(String(current.expires_at))<=now||current.status!=='prepared')throw new ApiError(410,'FILL_SESSION_EXPIRED');
  await checkFillOwner(db,owner,grant.applicationId,time);
  throw new ApiError(402,'FILL_LIMIT_REACHED');
 }
 const bound=JSON.parse(String(consumed.bound_grant)) as FillGrant;
 // RETURNING counts only other rows, excluding this immutable unique token.
 // Its result is identical before/after this row's update, avoiding SQLite's
 // self-referential RETURNING timing ambiguity. No fallible read follows CAS.
 const isPro=consumed.tier==='pro',used=Number(consumed.other_free_used)+(isPro?0:1);
 const fillUsage={used,limit:isPro?null:freeFillLimit,remaining:isPro?null:Math.max(0,freeFillLimit-used),unlimited:isPro,...period};
 return{allowed:true,reason:'consumed',requestId:String(consumed.request_id),userIdHash:bound.userIdHash,
  applicationId:bound.applicationId,grantId:bound.grantId,nonce:bound.nonce,expiresAt:bound.expiresAt,
  fieldIds:bound.fieldIds,grant:bound,fillUsage};
}
export async function billingAction(db:D1Database,owner:string,body:Row,writes:boolean){
 if(body.action==='get-entitlement'){only(body,['action']);return billingEntitlement(db,owner);}
 if(body.action==='list-orders'){only(body,['action']);return{orders:(await db.prepare('SELECT '+orderColumns+' FROM main__billing_orders WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 10').bind(owner).all()).results};}
 if(body.action==='get-order'){only(body,['action','orderId']);const id=fillRequestId(body.orderId);return{order:await db.prepare('SELECT '+orderColumns+' FROM main__billing_orders WHERE id=? AND user_id=?').bind(id,owner).first(),providerReconciliation:'MAINTENANCE'};}
 if(!writes)throw new ApiError(503,'MIGRATION_READ_ONLY');
 if(body.action==='prepare-fill-session')return prepareFill(db,owner,body);
 if(body.action==='consume-fill-session')return consumeFill(db,body,Date.now,owner);
 if(body.action==='create-order')throw new ApiError(503,'PAYMENT_CONFIGURATION_PENDING');
 throw new ApiError(400,'UNSUPPORTED_BILLING_ACTION');
}
