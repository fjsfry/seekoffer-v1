import {ApiError} from '../auth.ts';
import {PaymentTransaction,isoMicro} from './transaction.ts';
import {applyRefundState} from './refund-state.ts';
// @ts-ignore Source-preserved server-only gateway; credentials never reach clients.
import {createJianPayRefund,queryJianPayRefund} from './jianpay.mjs';

type Row=Record<string,any>;
export type RefundConfig={PAYMENT_PROCESSING_ENABLED?:string;REFUNDS_ENABLED?:string;JIANPAY_CLIENT_NO?:string;JIANPAY_MERCHANT_KEY?:string};
export type RefundOperator={userId:string;role:string;recentlyVerified:boolean};
const digest=async(s:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');
function fields(body:Row,names:string[]){if(Object.keys(body).some(k=>!names.includes(k)))throw new ApiError(400,'UNSUPPORTED_REFUND_FIELD');}
function refundNo(value:unknown):asserts value is string{if(typeof value!=='string'||!/^BYR\d{8}[A-Z0-9]{12}$/.test(value))throw new ApiError(400,'INVALID_REFUND_NUMBER');}
function publicResult(row:Row,replayed=true){return{refundNo:row.refund_no,status:row.status,amountCents:row.amount_cents,affectsOrder:Boolean(row.affects_order),affectsEntitlement:Boolean(row.affects_entitlement),refundedAt:row.refunded_at||null,replayed};}
async function transaction<T>(db:D1Database,fn:(t:PaymentTransaction)=>Promise<T>){
 for(let attempt=0;attempt<3;attempt++)try{const t=await PaymentTransaction.begin(db),result=await fn(t);await t.commit();return result;}catch(e){if(!(e instanceof ApiError)||e.message!=='PAYMENT_TRANSACTION_CONFLICT'||attempt===2)throw e;}
 throw new ApiError(503,'REFUND_TRANSACTION_UNAVAILABLE');
}
async function reserveBudget(t:PaymentTransaction,key:string,limit:number){const raw=(await t.row('SELECT value FROM _runtime_state WHERE key=?',[key]))?.value;const n=Number(raw||0);if(!Number.isSafeInteger(n)||n<0)throw new ApiError(503,'REFUND_BUDGET_INVALID');if(n>=limit)throw new ApiError(402,'REFUND_DAILY_BUDGET');t.add('INSERT INTO _runtime_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[key,String(n+1)]);}

export async function prepareRefund(db:D1Database,input:{orderNo:string;refundNo:string;merchantOrderNo?:string;reason:string;amountCents:number;operatorId:string}){
 refundNo(input.refundNo);
 if(!/^BY\d{8}[A-Z0-9]{8}$/.test(input.orderNo)||input.merchantOrderNo!==undefined&&!/^BYP\d{8}[A-Z0-9]{12}$/.test(input.merchantOrderNo)||typeof input.reason!=='string'||input.reason.trim().length<3||input.reason.trim().length>500||/[\u0000-\u001f]/.test(input.reason)||!Number.isSafeInteger(input.amountCents)||input.amountCents<100||input.amountCents>1000000)throw new ApiError(400,'INVALID_REFUND_REQUEST');
 const reason=input.reason.trim(),requestHash=await digest(JSON.stringify([input.orderNo,input.refundNo,input.merchantOrderNo||null,reason,input.amountCents]));
 return transaction(db,async t=>{
  const old=await t.row('SELECT * FROM autofill__commercial_refunds WHERE refund_no=?',[input.refundNo]);
  if(old){if(JSON.parse(old.metadata).request_hash!==requestHash)throw new ApiError(409,'REFUND_REQUEST_CONFLICT');return{row:old,createdNow:false};}
  const order=await t.row('SELECT * FROM autofill__commercial_orders WHERE order_no=?',[input.orderNo]);if(!order)throw new ApiError(404,'ORDER_NOT_FOUND');
  if(order.payment_provider!=='jianpay'||!order.payment_reference||!['paid','fulfilled','canceled','refunded'].includes(order.status))throw new ApiError(409,'ORDER_NOT_REFUNDABLE');
  const p=await t.row("SELECT * FROM autofill__commercial_payments WHERE order_id=? AND "+(input.merchantOrderNo?'merchant_order_no=?':'provider_order_id=?')+" AND status IN ('succeeded','duplicate_succeeded','needs_review','refunding','refunded') ORDER BY created_at DESC LIMIT 1",[order.id,input.merchantOrderNo||order.payment_reference]);
  if(!p||!p.provider_order_id)throw new ApiError(409,'SUCCESSFUL_PAYMENT_NOT_FOUND');if(p.amount_cents!==input.amountCents||p.currency!=='CNY')throw new ApiError(409,'REFUND_AMOUNT_MISMATCH');
  const active=await t.row("SELECT * FROM autofill__commercial_refunds WHERE payment_id=? AND status IN ('creating','create_unknown','processing','succeeded') ORDER BY created_at DESC LIMIT 1",[p.id]);
  if(active)return{row:active,createdNow:false};
  if(p.status==='refunded'||p.status==='refunding')throw new ApiError(409,'REFUND_RECONCILIATION_REQUIRED');
  const now=isoMicro();await reserveBudget(t,'autofill_refunds_day:'+now.slice(0,10),20);
  const row={id:crypto.randomUUID(),order_id:order.id,payment_id:p.id,refund_no:input.refundNo,amount_cents:p.amount_cents,status:'creating',affects_order:p.provider_order_id===order.payment_reference?1:0,affects_entitlement:p.provider_order_id===order.payment_reference&&order.status==='fulfilled'&&order.license_id?1:0,reason,provider_refund_id:null,refunded_at:null,provider_order_id:p.provider_order_id};
  t.add("INSERT INTO autofill__commercial_refunds(id,order_id,payment_id,refund_no,amount_cents,status,affects_order,affects_entitlement,reason,metadata) VALUES(?,?,?,?,?,'creating',?,?,?,?)",[row.id,row.order_id,row.payment_id,row.refund_no,row.amount_cents,row.affects_order,row.affects_entitlement,reason,JSON.stringify({prior_payment_status:p.status,request_hash:requestHash,operator_id:input.operatorId})]);
  t.add("UPDATE autofill__commercial_payments SET status='refunding',updated_at=? WHERE id=?",[now,p.id]);
  await t.event('autofill__commercial_payment_events',{payment_id:p.id,order_id:order.id,source:'refund',event_type:'refund_prepared',payload_hash:requestHash,event_data:JSON.stringify({refund_id:row.id,amount_cents:row.amount_cents,affects_order:row.affects_order,affects_entitlement:row.affects_entitlement,operator_id:input.operatorId})},true);
  return{row,createdNow:true};
 });
}
async function unknownOutcome(db:D1Database,number:string){
 return transaction(db,async t=>{const r=await t.row('SELECT * FROM autofill__commercial_refunds WHERE refund_no=?',[number]);if(!r||r.status!=='creating')return;
  t.add("UPDATE autofill__commercial_refunds SET status='create_unknown',error_message='provider_outcome_uncertain',updated_at=? WHERE id=?",[isoMicro(),r.id]);
  await t.event('autofill__commercial_payment_events',{payment_id:r.payment_id,order_id:r.order_id,source:'refund',event_type:'refund_state_changed',payload_hash:await digest(number+':provider_outcome_uncertain'),event_data:JSON.stringify({refund_id:r.id,status:'create_unknown'})},true);
 });
}
export async function refundAction(db:D1Database,body:Row,operator:RefundOperator,config:RefundConfig,fetcher:typeof fetch=fetch){
 if(operator.role!=='super_admin'||!operator.userId)throw new ApiError(403,'REFUND_OPERATOR_REQUIRED');
 if(!['status','create','query'].includes(body.action))throw new ApiError(400,'INVALID_REFUND_ACTION');
 fields(body,body.action==='create'?['action','orderNo','refundNo','merchantOrderNo','reason','amountCents']:['action','refundNo']);refundNo(body.refundNo);
 if(body.action==='status'){const row=await db.prepare('SELECT * FROM autofill__commercial_refunds WHERE refund_no=?').bind(body.refundNo).first<Row>();if(!row)throw new ApiError(404,'REFUND_NOT_FOUND');return publicResult(row);}
 if(config.PAYMENT_PROCESSING_ENABLED!=='true'||config.REFUNDS_ENABLED!=='true')throw new ApiError(503,'REFUNDS_DISABLED');
 if(!operator.recentlyVerified)throw new ApiError(403,'RECENT_AUTHENTICATION_REQUIRED');
 if(!config.JIANPAY_CLIENT_NO||!config.JIANPAY_MERCHANT_KEY)throw new ApiError(503,'PAYMENT_CONFIGURATION_PENDING');
 const credentials={clientNo:config.JIANPAY_CLIENT_NO,merchantKey:config.JIANPAY_MERCHANT_KEY};let result:any;
 if(body.action==='create'){
  const prepared=await prepareRefund(db,{orderNo:body.orderNo,refundNo:body.refundNo,merchantOrderNo:body.merchantOrderNo,reason:body.reason,amountCents:body.amountCents,operatorId:operator.userId});
  if(!prepared.createdNow)return publicResult(prepared.row);
  try{result=await createJianPayRefund({providerOrderId:prepared.row.provider_order_id,refundNo:prepared.row.refund_no,amountCents:prepared.row.amount_cents,reason:prepared.row.reason},credentials,{fetchImpl:fetcher});}
  catch{await unknownOutcome(db,prepared.row.refund_no);throw new ApiError(503,'REFUND_OUTCOME_UNCERTAIN');}
 }else{
  const reserved=await transaction(db,async t=>{
   const r=await t.row('SELECT * FROM autofill__commercial_refunds WHERE refund_no=?',[body.refundNo]);if(!r)throw new ApiError(404,'REFUND_NOT_FOUND');
   if(r.status==='succeeded'||r.status==='failed')return{row:r,terminal:true};
   if(r.last_queried_at&&Date.parse(r.last_queried_at)>Date.now()-30000)throw new ApiError(429,'REFUND_QUERY_COOLDOWN');
   const p=await t.row('SELECT provider_order_id FROM autofill__commercial_payments WHERE id=?',[r.payment_id]);if(!p?.provider_order_id)throw new ApiError(409,'REFUND_PAYMENT_MISSING');
   const now=isoMicro();await reserveBudget(t,'autofill_refund_queries_day:'+now.slice(0,10),100);t.add('UPDATE autofill__commercial_refunds SET last_queried_at=? WHERE id=?',[now,r.id]);return{row:{...r,provider_order_id:p.provider_order_id},terminal:false};
  });
  if(reserved.terminal)return publicResult(reserved.row);
  const r=reserved.row;try{result=await queryJianPayRefund({refundNo:r.refund_no,providerRefundId:r.provider_refund_id,providerOrderId:r.provider_order_id,amountCents:r.amount_cents},credentials,{fetchImpl:fetcher});}catch{throw new ApiError(503,'REFUND_QUERY_UNAVAILABLE');}
 }
 await applyRefundState(db,{refundNo:result.refundNo,providerRefundId:result.providerRefundId,providerOrderId:result.providerOrderId,providerStatus:result.status,amountCents:result.amountCents,payloadHash:result.payloadHash});
 const row=await db.prepare('SELECT * FROM autofill__commercial_refunds WHERE refund_no=?').bind(result.refundNo).first<Row>();if(!row)throw new ApiError(503,'REFUND_RESULT_UNAVAILABLE');return publicResult(row,false);
}
