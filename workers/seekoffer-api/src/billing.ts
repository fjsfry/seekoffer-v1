import {ApiError} from './auth.ts';
import {isoMicro} from './payments/transaction.ts';
const freeFillLimit=3;
type Row=Record<string,unknown>;
const orderColumns='id,plan_id,provider,out_trade_no,amount_cents,currency,status,code_url,checkout_url,expires_at,created_at,paid_at';
function only(body:Row,keys:string[]){if(Object.keys(body).some(k=>!keys.includes(k)))throw new ApiError(400,'UNSUPPORTED_BILLING_FIELD');}
function identifier(value:unknown){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{16,120}$/.test(value))throw new ApiError(400,'INVALID_REQUEST_ID');return value;}
export function billingMonth(now=Date.now()){const local=new Date(now+28800000);return{periodStart:isoMicro(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),1)-28800000),periodEnd:isoMicro(Date.UTC(local.getUTCFullYear(),local.getUTCMonth()+1,1)-28800000)};}
const proSql="EXISTS(SELECT 1 FROM main__user_entitlements e WHERE e.user_id=s.user_id AND e.status='active' AND (e.expires_at IS NULL OR e.expires_at>?))";
const usageSql="(SELECT count(*) FROM main__billing_fill_sessions u WHERE u.user_id=s.user_id AND u.status='consumed' AND u.tier='free' AND u.consumed_at>=? AND u.consumed_at<?)";
function active(row:Row|null,now:number){return row?.status==='active'&&(!row.expires_at||Date.parse(String(row.expires_at))>now);}
export async function billingPlans(db:D1Database){const result=await db.prepare('SELECT id,name,description,price_cents,currency,duration_days,benefits,sort_order,is_recommended FROM main__billing_plans WHERE is_active=1 ORDER BY sort_order,id').all<Row>();return{plans:result.results.map(r=>({...r,benefits:JSON.parse(String(r.benefits)),is_recommended:Boolean(r.is_recommended)})),freeLimit:5,freeFillLimit,providers:{wechat:false,alipay:false},purchasesAvailable:false};}
async function usage(db:D1Database,owner:string,isPro:boolean,now:number){const period=billingMonth(now);const used=await db.prepare("SELECT count(*) AS n FROM main__billing_fill_sessions WHERE user_id=? AND status='consumed' AND tier='free' AND consumed_at>=? AND consumed_at<?").bind(owner,period.periodStart,period.periodEnd).first<number>('n');return{used:used??0,limit:isPro?null:freeFillLimit,remaining:isPro?null:Math.max(0,freeFillLimit-(used??0)),unlimited:isPro,...period};}
export async function billingEntitlement(db:D1Database,owner:string,now=Date.now()){
 const row=await db.prepare('SELECT user_id,plan_id,status,starts_at,expires_at,source_order_id,metadata FROM main__user_entitlements WHERE user_id=?').bind(owner).first<Row>();const isPro=active(row,now);
 const entitlement=row?{...row,status:row.status==='active'&&!isPro?'expired':row.status,metadata:JSON.parse(String(row.metadata||'{}'))}:{user_id:owner,plan_id:null,status:'free',starts_at:null,expires_at:null};
 const [plans,applicationCount,fillUsage,temporary]=await Promise.all([billingPlans(db),db.prepare('SELECT count(*) n FROM main__applications WHERE user_id=?').bind(owner).first<number>('n'),usage(db,owner,isPro,now),db.prepare("SELECT value FROM _runtime_state WHERE key='website_recovery_application_quota'").first<string>('value')]);
 return{...plans,entitlement,isPro,applicationCount:applicationCount??0,fillUsage,temporaryUnlimitedApplications:temporary==='unlimited'};
}
async function sha(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function prepareFill(db:D1Database,owner:string,body:Row,now:number){
 only(body,['action','requestId','fieldCount']);const requestId=identifier(body.requestId),fieldCount=Number(body.fieldCount);if(!Number.isInteger(fieldCount)||fieldCount<1||fieldCount>10)throw new ApiError(400,'INVALID_FIELD_COUNT');
 const existing=await db.prepare('SELECT status,field_count FROM main__billing_fill_sessions WHERE user_id=? AND request_id=?').bind(owner,requestId).first<Row>();if(existing?.status==='consumed')throw new ApiError(409,'FILL_SESSION_ALREADY_CONSUMED');if(existing&&existing.field_count!==fieldCount)throw new ApiError(409,'FILL_REQUEST_CONFLICT');
 const bytes=crypto.getRandomValues(new Uint8Array(32)),token=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');const hash=await sha(token),time=isoMicro(now),expiresAt=isoMicro(now+300000),period=billingMonth(now);
 const sql=`INSERT INTO main__billing_fill_sessions(user_id,request_id,token_hash,field_count,tier,expires_at,created_at,updated_at)
 SELECT ?,?,?,?,CASE WHEN EXISTS(SELECT 1 FROM main__user_entitlements e WHERE e.user_id=? AND e.status='active' AND (e.expires_at IS NULL OR e.expires_at>?)) THEN 'pro' ELSE 'free' END,?,?,?
 WHERE (SELECT count(*) FROM main__billing_fill_sessions WHERE user_id=? AND created_at>=?)<10
 AND (EXISTS(SELECT 1 FROM main__user_entitlements e WHERE e.user_id=? AND e.status='active' AND (e.expires_at IS NULL OR e.expires_at>?)) OR (SELECT count(*) FROM main__billing_fill_sessions WHERE user_id=? AND status='consumed' AND tier='free' AND consumed_at>=? AND consumed_at<?)<3)
 ON CONFLICT(user_id,request_id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at,status='prepared',tier=excluded.tier,updated_at=excluded.updated_at WHERE main__billing_fill_sessions.status<>'consumed' AND main__billing_fill_sessions.field_count=excluded.field_count RETURNING tier`;
 const row=await db.prepare(sql).bind(owner,requestId,hash,fieldCount,owner,time,expiresAt,time,time,owner,isoMicro(now-60000),owner,time,owner,period.periodStart,period.periodEnd).first<Row>();
 if(!row){const entitlement=await billingEntitlement(db,owner,now);if(!entitlement.isPro&&entitlement.fillUsage.remaining===0)throw new ApiError(402,'FILL_LIMIT_REACHED');throw new ApiError(429,'FILL_SESSION_RATE_OR_CONFLICT');}
 return{authorization:{token,verificationUrl:'https://migration.seekoffer.com.cn/v1/billing/consume',expiresAt},fillUsage:await usage(db,owner,row.tier==='pro',now)};
}
export async function consumeFill(db:D1Database,body:Row,now=Date.now(),expectedOwner?:string){
 only(body,['action','token']);if(body.action!==undefined&&body.action!=='consume-fill-session'||typeof body.token!=='string'||!/^[A-Za-z0-9_-]{40,64}$/.test(body.token))throw new ApiError(403,'INVALID_FILL_SESSION');
 const hash=await sha(body.token),row=await db.prepare('SELECT user_id,status,tier,expires_at FROM main__billing_fill_sessions WHERE token_hash=?').bind(hash).first<Row>();if(!row||expectedOwner&&row.user_id!==expectedOwner)throw new ApiError(403,'INVALID_FILL_SESSION');
 const owner=String(row.user_id),time=isoMicro(now),period=billingMonth(now);
 const account=await db.prepare("SELECT u.id FROM main__auth_subjects u LEFT JOIN main__user_moderation m ON m.user_id=u.id WHERE u.id=? AND u.deleted_at IS NULL AND u.email_confirmed_at IS NOT NULL AND (u.banned_until IS NULL OR u.banned_until<=?) AND coalesce(m.status,'active') NOT IN ('banned','blocked','disabled','deleted')").bind(owner,time).first();if(!account)throw new ApiError(403,'ACCOUNT_BLOCKED');
 // A single conditional update serializes monthly quota decisions inside SQLite.
 // It re-evaluates both entitlement and consumed count, even for simultaneous tabs.
 const allowed=`(${proSql} OR ${usageSql}<3)`;
 const result=await db.prepare(`UPDATE main__billing_fill_sessions AS s SET
 status=CASE WHEN expires_at<=? THEN 'expired' WHEN ${allowed} THEN 'consumed' ELSE 'denied' END,
 tier=CASE WHEN ${proSql} THEN 'pro' ELSE 'free' END,
 consumed_at=CASE WHEN expires_at>? AND ${allowed} THEN ? ELSE NULL END,updated_at=?
 WHERE token_hash=? AND user_id=? AND status='prepared' RETURNING status,tier`).bind(time,time,period.periodStart,period.periodEnd,time,time,time,period.periodStart,period.periodEnd,time,time,hash,owner).first<Row>();
 const current=result||await db.prepare('SELECT status,tier FROM main__billing_fill_sessions WHERE token_hash=? AND user_id=?').bind(hash,owner).first<Row>();if(!current)throw new ApiError(403,'INVALID_FILL_SESSION');const isPro=current.tier==='pro';if(current.status!=='consumed')throw new ApiError(current.status==='expired'?410:current.status==='denied'?402:403,current.status==='denied'?'FILL_LIMIT_REACHED':'FILL_SESSION_'+String(current.status).toUpperCase());
 return{allowed:true,reason:result?'consumed':'already_consumed',fillUsage:await usage(db,owner,isPro,now)};
}
export async function billingAction(db:D1Database,owner:string,body:Row,writes:boolean){
 if(body.action==='get-entitlement'){only(body,['action']);return billingEntitlement(db,owner);}
 if(body.action==='list-orders'){only(body,['action']);return{orders:(await db.prepare('SELECT '+orderColumns+' FROM main__billing_orders WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 10').bind(owner).all()).results};}
 if(body.action==='get-order'){only(body,['action','orderId']);const id=identifier(body.orderId);return{order:await db.prepare('SELECT '+orderColumns+' FROM main__billing_orders WHERE id=? AND user_id=?').bind(id,owner).first(),providerReconciliation:'MAINTENANCE'};}
 if(!writes)throw new ApiError(503,'MIGRATION_READ_ONLY');
 if(body.action==='prepare-fill-session')return prepareFill(db,owner,body,Date.now());
 if(body.action==='consume-fill-session')return consumeFill(db,body,Date.now(),owner);
 if(body.action==='create-order')throw new ApiError(503,'PAYMENT_CONFIGURATION_PENDING');
 throw new ApiError(400,'UNSUPPORTED_BILLING_ACTION');
}
