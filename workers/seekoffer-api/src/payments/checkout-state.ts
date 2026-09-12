import type {D1Database} from '@cloudflare/workers-types';
import {ApiError} from '../auth.ts';
import {PaymentTransaction,isoMicro} from './transaction.ts';
// @ts-ignore Preserved gateway validation with source provenance.
import {isJianPayCheckoutUrl} from './jianpay.mjs';
type Row=Record<string,any>;
const hex=(s:unknown)=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
async function transaction<T>(db:D1Database,fn:(t:PaymentTransaction)=>Promise<T>){for(let i=0;i<3;i++){try{const t=await PaymentTransaction.begin(db),result=await fn(t);await t.commit();return result;}catch(e){if(!(e instanceof ApiError)||e.message!=='PAYMENT_TRANSACTION_CONFLICT'||i===2)throw e;}}throw new ApiError(503,'CHECKOUT_CONFLICT');}
export async function prepareAutofillCheckout(db:D1Database,input:{orderNo:string;accessTokenHash:string;owner:string|null;payMethod:string;merchantOrderNo:string;deliveryCodeHash:string;deliveryCodeHint:string;requestHash:string}){
 if(!/^BY[0-9]{8}[A-Z0-9]{8}$/.test(input.orderNo)||!/^BYP[0-9]{8}[A-Z0-9]{12}$/.test(input.merchantOrderNo)||!['wx','alipay'].includes(input.payMethod)||![input.accessTokenHash,input.deliveryCodeHash,input.requestHash].every(hex)||input.deliveryCodeHint.length<5||input.deliveryCodeHint.length>24)throw new ApiError(400,'INVALID_CHECKOUT_PREPARATION');
 return transaction(db,async t=>{
  const now=isoMicro(),o=await t.row('SELECT * FROM autofill__commercial_orders WHERE order_no=? AND access_token_hash=?',[input.orderNo,input.accessTokenHash]);if(!o)throw new ApiError(404,'ORDER_NOT_FOUND');if(o.delivery_mode==='account'&&o.user_id!==input.owner)throw new ApiError(403,'ORDER_ACCOUNT_MISMATCH');
  if(!['pending','contacted'].includes(o.status)||o.expires_at<=now)throw new ApiError(409,'ORDER_NOT_PAYABLE');
  // A network-ambiguous attempt is held for reconciliation, even after local expiry.
  // Creating a second external charge while the first outcome is unknown is unsafe.
  const uncertain=await t.row("SELECT * FROM autofill__commercial_payments WHERE order_id=? AND status='create_unknown' ORDER BY created_at DESC LIMIT 1",[o.id]);if(uncertain)return{...uncertain,createdNow:false};
  if(o.delivery_code_hash&&(o.delivery_code_hash!==input.deliveryCodeHash||o.delivery_code_hint!==input.deliveryCodeHint||o.delivery_version!==1))throw new ApiError(409,'ORDER_DELIVERY_MISMATCH');
  const pending=await t.row("SELECT * FROM autofill__commercial_payments WHERE order_id=? AND status IN ('creating','pending') AND expires_at>? ORDER BY created_at DESC LIMIT 1",[o.id,now]);if(pending)return{...pending,createdNow:false};
  const live=await t.row("SELECT id FROM autofill__commercial_payments WHERE order_id=? AND status IN ('succeeded','duplicate_succeeded','refunding','refunded','needs_review') LIMIT 1",[o.id]);if(live)throw new ApiError(409,'ORDER_REQUIRES_RECONCILIATION');
  // Limit preparations globally; the D1 counter and the payment are committed together.
  const day='autofill_checkout_day:'+now.slice(0,10),n=Number((await t.row('SELECT value FROM _runtime_state WHERE key=?',[day]))?.value||0);if(n>=100)throw new ApiError(402,'CHECKOUT_DAILY_BUDGET');
  t.add('INSERT INTO _runtime_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[day,String(n+1)]);
  t.add("UPDATE autofill__commercial_orders SET delivery_code_hash=?,delivery_code_hint=?,delivery_version=1,payment_provider='jianpay',updated_at=? WHERE id=?",[input.deliveryCodeHash,input.deliveryCodeHint,now,o.id]);
  t.add("UPDATE autofill__commercial_payments SET status='closed',failure_code=coalesce(failure_code,'local_checkout_expired'),updated_at=? WHERE order_id=? AND status IN ('creating','pending') AND expires_at<=?",[now,o.id,now]);
  const id=crypto.randomUUID();t.add("INSERT INTO autofill__commercial_payments(id,order_id,merchant_order_no,pay_method,amount_cents,currency,status,metadata) VALUES(?,?,?,?,?,?,'creating',?)",[id,o.id,input.merchantOrderNo,input.payMethod,o.amount_cents,o.currency,'{"delivery_version":1}']);
  await t.event('autofill__commercial_payment_events',{payment_id:id,order_id:o.id,source:'create',event_type:'payment_prepared',payload_hash:input.requestHash,event_data:JSON.stringify({pay_method:input.payMethod,amount_cents:o.amount_cents})},true);
  return{id,order_id:o.id,merchant_order_no:input.merchantOrderNo,pay_method:input.payMethod,amount_cents:o.amount_cents,status:'creating',provider_order_id:null,pay_url:null,createdNow:true};
 });
}
export async function finalizeAutofillCheckout(db:D1Database,input:{paymentId:string;providerOrderId:string;payUrl:string;providerStatus:number;payloadHash:string}){
 if(input.providerOrderId.length<6||input.providerOrderId.length>200||input.payUrl.length>2048||!isJianPayCheckoutUrl(input.payUrl)||!Number.isInteger(input.providerStatus)||input.providerStatus<0||input.providerStatus>4||!hex(input.payloadHash))throw new ApiError(400,'INVALID_CHECKOUT_RESULT');
 return transaction(db,async t=>{
  const p=await t.row('SELECT * FROM autofill__commercial_payments WHERE id=?',[input.paymentId]);if(!p)throw new ApiError(404,'PAYMENT_NOT_FOUND');if(p.provider_order_id&&p.provider_order_id!==input.providerOrderId)throw new ApiError(409,'PROVIDER_ORDER_MISMATCH');
  if(!['creating','create_unknown','pending'].includes(p.status))return p;
  const status=input.providerStatus===3?'failed':input.providerStatus===4?'closed':'pending';
  t.add('UPDATE autofill__commercial_payments SET provider_order_id=?,pay_url=?,provider_status=?,status=?,failure_code=?,updated_at=? WHERE id=?',[input.providerOrderId,input.payUrl,input.providerStatus,status,['failed','closed'].includes(status)?'provider_create_status_'+input.providerStatus:null,isoMicro(),p.id]);
  await t.event('autofill__commercial_payment_events',{payment_id:p.id,order_id:p.order_id,source:'create',event_type:'payment_created',provider_status:input.providerStatus,payload_hash:input.payloadHash,event_data:JSON.stringify({status})},true);
  // A create response reporting paid does not issue an entitlement: only the
  // separately verified callback/query transaction can fulfill the order.
  return{...p,status,provider_order_id:input.providerOrderId,pay_url:input.payUrl};
 });
}
export async function recordAutofillCheckoutFailure(db:D1Database,input:{paymentId:string;failureCode:string;payloadHash:string;definitive:boolean}){
 if(!/^[a-z_]{3,100}$/.test(input.failureCode)||!hex(input.payloadHash))throw new ApiError(400,'INVALID_CHECKOUT_FAILURE');
 return transaction(db,async t=>{
  const p=await t.row('SELECT * FROM autofill__commercial_payments WHERE id=?',[input.paymentId]);if(!p)throw new ApiError(404,'PAYMENT_NOT_FOUND');let status=p.status;
  if(input.definitive&&['creating','create_unknown'].includes(status)&&!p.provider_order_id){status='failed';t.add('UPDATE autofill__commercial_payments SET status=?,failure_code=?,updated_at=? WHERE id=?',[status,input.failureCode,isoMicro(),p.id]);}
  else if(!input.definitive&&status==='creating'){status='create_unknown';t.add('UPDATE autofill__commercial_payments SET status=?,failure_code=?,expires_at=max(expires_at,?),updated_at=? WHERE id=?',[status,input.failureCode,isoMicro(Date.now()+600000),isoMicro(),p.id]);}
  await t.event('autofill__commercial_payment_events',{payment_id:p.id,order_id:p.order_id,source:'create',event_type:input.definitive?'payment_create_failed':'payment_create_unknown',payload_hash:input.payloadHash,event_data:JSON.stringify({failure_code:input.failureCode})},true);return{paymentId:p.id,status};
 });
}
