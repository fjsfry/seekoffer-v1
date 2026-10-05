import type {D1Database} from '@cloudflare/workers-types';
import {ApiError} from '../auth.ts';
import {PaymentTransaction,isoMicro,addDaysExact} from './transaction.ts';
// @ts-ignore Preserved server-only gateway module, tested independently.
import {isJianPayCheckoutUrl} from './jianpay.mjs';

const PRICES:Record<string,number>={pro_30:2900,pro_90:6900,pro_365:16900};
type Row=Record<string,any>;
type VerifiedOwner={userId:string;verifiedEmail:string;sourceRef:'mnotoltpythkayguhnrk'};
const tokenPattern=/^[A-Za-z0-9_-]{32,160}$/;
async function hash(s:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function deterministicToken(key:string,value:string){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(value))))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
async function retry<T>(work:()=>Promise<T>):Promise<T>{for(let i=0;i<3;i++){try{return await work();}catch(e){if(!(e instanceof ApiError)||e.message!=='PAYMENT_TRANSACTION_CONFLICT'||i===2)throw e;}}throw new ApiError(503,'ORDER_CONFLICT');}

// owner is supplied only by the server's verified original-UUID identity path.
// Source autofill auth accounts are never relinked by email or silently reused.
async function ensureSubject(t:PaymentTransaction,owner:VerifiedOwner){
 if(owner.sourceRef!=='mnotoltpythkayguhnrk'||!/^[0-9a-f-]{36}$/.test(owner.userId))throw new ApiError(403,'ORDER_IDENTITY_SCOPE');
 const original=await t.row('SELECT * FROM main__auth_subjects WHERE id=?',[owner.userId]);
 if(!original||original.deleted_at||!original.email_confirmed_at||(original.banned_until&&Date.parse(original.banned_until)>Date.now()))throw new ApiError(403,'ORDER_IDENTITY_UNAVAILABLE');
 const marker='autofill_main_identity:'+owner.userId,link=await t.row('SELECT value FROM _runtime_state WHERE key=?',[marker]),existing=await t.row('SELECT id FROM autofill__auth_subjects WHERE id=?',[owner.userId]);
 if(existing&&link?.value!==owner.sourceRef)throw new ApiError(409,'AUTOFILL_IDENTITY_REQUIRES_REVIEW');
 if(!existing){t.add('INSERT INTO autofill__auth_subjects(id,created_at,email_confirmed_at) VALUES(?,?,?)',[owner.userId,original.created_at,original.email_confirmed_at]);t.add('INSERT INTO _runtime_state(key,value) VALUES(?,?)',[marker,owner.sourceRef]);}
}

export async function readAutofillOrder(db:D1Database,orderNo:string,accessToken:string,owner:string|null,paymentAvailable=false){
 if(!/^BY[0-9]{8}[A-Z0-9]{8}$/.test(orderNo)||!tokenPattern.test(accessToken))throw new ApiError(400,'INVALID_ORDER_ACCESS');
 const row=await db.prepare('SELECT * FROM autofill__commercial_orders WHERE order_no=? AND access_token_hash=?').bind(orderNo,await hash(accessToken)).first<Row>();
 if(!row)throw new ApiError(404,'ORDER_NOT_FOUND');
 if(row.delivery_mode==='account'&&row.user_id!==owner)throw new ApiError(owner?403:401,'ORDER_ACCOUNT_MISMATCH');
 const now=isoMicro(),payments=(await db.prepare('SELECT id,status,pay_method,provider_order_id,pay_url,expires_at FROM autofill__commercial_payments WHERE order_id=? ORDER BY created_at DESC,id DESC LIMIT 2').bind(row.id).all<Row>()).results,p=payments[0];
 // Expiry is calculated on reads. Creation/confirmation use the transactional path.
 const pending=Boolean(await db.prepare("SELECT 1 AS active FROM autofill__commercial_payments WHERE order_id=? AND status IN ('creating','create_unknown','pending') AND expires_at>? LIMIT 1").bind(row.id,now).first());
 const status=['pending','contacted'].includes(row.status)&&row.expires_at<=now&&!pending?'expired':row.status;
 let delivery:Row|null=null;
 if(status==='fulfilled'&&row.delivery_mode==='account'){
  const e=await db.prepare('SELECT status,valid_until FROM autofill__account_entitlements WHERE user_id=?').bind(row.user_id).first<Row>();const active=e?.status==='active'&&e.valid_until>now;delivery={mode:'account',credited:Boolean(active),status:e?.status==='active'&&!active?'expired':e?.status||'not_entitled',expiresAt:e?.valid_until||null};
 }else if(status==='fulfilled'&&row.payment_provider==='jianpay'&&row.delivery_version===1)delivery={mode:'code',version:1,codeHint:row.delivery_code_hint};
 return{orderNo:row.order_no,status,planId:row.plan_id,amountCents:row.amount_cents,currency:row.currency,createdAt:row.created_at,expiresAt:row.expires_at,paidAt:row.paid_at,fulfilledAt:row.fulfilled_at,refundedAt:row.refunded_at,paymentAvailable,payment:p?{id:p.id,status:p.status,payMethod:p.pay_method,providerOrderId:p.provider_order_id,payUrl:paymentAvailable&&['creating','create_unknown','pending'].includes(p.status)&&p.expires_at>now&&isJianPayCheckoutUrl(p.pay_url)?p.pay_url:null,expiresAt:p.expires_at}:null,delivery};
}

export async function createAutofillOrder(db:D1Database,body:Row,owner:VerifiedOwner|null,config:{enabled:boolean;idempotencyKey?:string}){
 if(!config.enabled)throw new ApiError(503,'NEW_PURCHASES_DISABLED');
 if(!config.idempotencyKey||config.idempotencyKey.length<32)throw new ApiError(503,'ORDER_IDEMPOTENCY_NOT_CONFIGURED');
 if(Object.keys(body).some(k=>!['planId','contactType','contactValue','note','consent','requestId','deliveryMode'].includes(k))||!PRICES[body.planId]||body.consent!==true||!tokenPattern.test(body.requestId||''))throw new ApiError(400,'INVALID_ORDER_REQUEST');
 const mode=body.deliveryMode||'code';if(!['code','account'].includes(mode))throw new ApiError(400,'INVALID_DELIVERY_MODE');if(mode==='account'&&!owner)throw new ApiError(401,'AUTH_REQUIRED');
 const contactType=mode==='account'?'email':body.contactType,raw=mode==='account'?owner!.verifiedEmail:body.contactValue;
 if(typeof raw!=='string')throw new ApiError(400,'INVALID_CONTACT');const contact=raw.normalize('NFKC').trim();
 if(contact.length>254||!({email:/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,wechat:/^[a-zA-Z][-_a-zA-Z0-9]{2,31}$/,qq:/^[1-9][0-9]{4,11}$/} as Record<string,RegExp>)[contactType]?.test(contact))throw new ApiError(400,'INVALID_CONTACT');
 if(body.note!==undefined&&(typeof body.note!=='string'||body.note.length>500))throw new ApiError(400,'INVALID_NOTE');
 const normalized={mode,owner:mode==='account'?owner!.userId:null,plan:body.planId,contactType,contact:contactType==='email'?contact.toLowerCase():contact,note:(body.note||'').trim()},requestHash=await hash(JSON.stringify(normalized)),accessToken=await deterministicToken(config.idempotencyKey,'autofill-order-v1:'+body.requestId),key='autofill_order_request:'+await hash(body.requestId),accessHash=await hash(accessToken);
 const orderNo=await retry(async()=>{
  const t=await PaymentTransaction.begin(db),prior=await t.row('SELECT value FROM _runtime_state WHERE key=?',[key]);
  if(prior){const value=JSON.parse(prior.value);if(value.requestHash!==requestHash)throw new ApiError(409,'ORDER_REQUEST_REUSED');const existing=await t.row('SELECT access_token_hash FROM autofill__commercial_orders WHERE order_no=?',[value.orderNo]);if(existing?.access_token_hash!==accessHash)throw new ApiError(409,'ORDER_CREDENTIAL_KEY_CHANGED');return value.orderNo;}
  const now=isoMicro(),budget='autofill_orders_day:'+now.slice(0,10),count=Number((await t.row('SELECT value FROM _runtime_state WHERE key=?',[budget]))?.value||0);if(count>=100)throw new ApiError(402,'ORDER_DAILY_BUDGET');
  if(mode==='account')await ensureSubject(t,owner!);
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',suffix=[...crypto.getRandomValues(new Uint8Array(8))].map(n=>alphabet[n&31]).join(''),date=new Date(Date.now()+28800000).toISOString().slice(0,10).replaceAll('-',''),orderNo='BY'+date+suffix,id=crypto.randomUUID();
  t.add('INSERT INTO autofill__commercial_orders(id,order_no,plan_id,amount_cents,contact_type,contact_value,note,access_token_hash,consent_at,expires_at,delivery_mode,user_id,metadata) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,orderNo,body.planId,PRICES[body.planId],contactType,normalized.contact,normalized.note||null,accessHash,now,addDaysExact(now,7),mode,normalized.owner,JSON.stringify({delivery_mode:mode,request_hash:requestHash,identity_source:normalized.owner?'main_original_uuid':null})]);
  await t.event('autofill__license_events',{order_id:id,event_type:'order_created',event_data:JSON.stringify({plan_id:body.planId,amount_cents:PRICES[body.planId],delivery_mode:mode})});
  t.add('INSERT INTO _runtime_state(key,value) VALUES(?,?)',[key,JSON.stringify({requestHash,orderNo})]);t.add('INSERT INTO _runtime_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[budget,String(count+1)]);await t.commit();return orderNo;
 });
 return{order:await readAutofillOrder(db,orderNo,accessToken,owner?.userId||null,false),accessToken};
}
