import {ApiError} from '../auth.ts';
import {PaymentTransaction,isoMicro,addDaysExact} from './transaction.ts';
// @ts-ignore Preserved server-only gateway module, tested independently.
import {verifyJianPaySignature,validateJianPayPaymentData,sha256Payload} from './jianpay.mjs';
type Row=Record<string,any>;
type PaymentState={merchantOrderNo:string;providerOrderId:string;amountCents:number;providerStatus:number;source:'callback'|'query'|'operator';payloadHash:string;paidAt?:string|null};
const durations:Record<string,number>={pro_30:30,pro_90:90,pro_365:365};
function json(value:unknown){return JSON.stringify(value);}
function metadata(value:string){const parsed=JSON.parse(value);if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw new ApiError(503,'INVALID_STORED_METADATA');return parsed;}
async function grantAccount(t:PaymentTransaction,order:Row,licenseId:string,now:string){
 if(order.delivery_mode!=='account'||!order.user_id)return;
 if(await t.row('SELECT id FROM autofill__account_entitlement_grants WHERE order_id=?',[order.id]))return;
 let entitlement=await t.row('SELECT * FROM autofill__account_entitlements WHERE user_id=?',[order.user_id]);
 if(!entitlement){entitlement={id:crypto.randomUUID(),valid_until:now,metadata:'{}'};t.add("INSERT INTO autofill__account_entitlements(id,user_id,status,plan_id,valid_until,max_devices,source_order_id,metadata) VALUES(?,?,'expired',?,?,2,?,?)",[entitlement.id,order.user_id,order.plan_id,now,order.id,json({source:'verified_account_payment'})]);}
 const duration=durations[order.plan_id];if(!duration)throw new ApiError(400,'INVALID_ORDER_PLAN');
 const previous=entitlement.valid_until,until=addDaysExact(previous>now?previous:now,duration),grant=crypto.randomUUID();
 t.add("INSERT INTO autofill__account_entitlement_grants(id,entitlement_id,user_id,order_id,plan_id,duration_days,status,previous_valid_until,granted_until,granted_at,metadata) VALUES(?,?,?,?,?,?,'active',?,?,?,?)",[grant,entitlement.id,order.user_id,order.id,order.plan_id,duration,previous,until,now,json({payment_provider:'jianpay'})]);
 t.add("UPDATE autofill__account_entitlements SET status='active',plan_id=?,valid_until=?,max_devices=max(max_devices,2),source_order_id=?,version=version+1,updated_at=?,metadata=json_patch(metadata,?) WHERE id=?",[order.plan_id,until,order.id,now,json({last_order_no:order.order_no,last_granted_at:now}),entitlement.id]);
 await t.event('autofill__account_entitlement_events',{entitlement_id:entitlement.id,grant_id:grant,user_id:order.user_id,order_id:order.id,event_type:'account_granted',event_data:json({plan_id:order.plan_id,duration_days:duration,valid_until:until})});
 t.add("UPDATE autofill__license_codes SET status='disabled',updated_at=?,metadata=json_patch(metadata,?) WHERE id=? AND status='active'",[now,json({account_delivery_only:true,disabled_at:now,disabled_reason:'account_entitlement_credited'}),licenseId]);
}
async function applyOnce(db:D1Database,input:PaymentState,now:string){
 const t=await PaymentTransaction.begin(db);
 const p=await t.row("SELECT * FROM autofill__commercial_payments WHERE provider='jianpay' AND merchant_order_no=?",[input.merchantOrderNo]);if(!p)throw new ApiError(404,'PAYMENT_NOT_FOUND');
 const o=await t.row('SELECT * FROM autofill__commercial_orders WHERE id=?',[p.order_id]);if(!o)throw new ApiError(404,'ORDER_NOT_FOUND');
 if(p.amount_cents!==input.amountCents||o.amount_cents!==input.amountCents||p.currency!=='CNY'||o.currency!=='CNY')throw new ApiError(409,'PAYMENT_AMOUNT_MISMATCH');
 if(p.provider_order_id&&p.provider_order_id!==input.providerOrderId)throw new ApiError(409,'PROVIDER_ORDER_MISMATCH');
 const queried=['query','operator'].includes(input.source)?now:p.last_queried_at;
 const event=async(type:string,status:number,data:unknown)=>t.event('autofill__commercial_payment_events',{payment_id:p.id,order_id:o.id,source:input.source,event_type:type,provider_status:status,payload_hash:input.payloadHash,event_data:json(data)},true);
 let fulfillment='not_fulfilled',paymentStatus=p.status,orderStatus=o.status,licenseId=o.license_id;
 if(input.providerStatus!==2){
  if(!['succeeded','duplicate_succeeded','refunded','refunding'].includes(p.status)){
   paymentStatus=input.providerStatus===3?'failed':input.providerStatus===4?'closed':'pending';
   t.add('UPDATE autofill__commercial_payments SET provider_order_id=?,provider_status=?,status=?,last_queried_at=?,failure_code=?,updated_at=? WHERE id=?',[input.providerOrderId,input.providerStatus,paymentStatus,queried,['failed','closed'].includes(paymentStatus)?'provider_status_'+input.providerStatus:null,now,p.id]);
  }
  await event('payment_state_changed',input.providerStatus,{status:paymentStatus});
 }else{
  const paidMs=input.paidAt?Date.parse(input.paidAt):NaN,clock=Date.parse(now);const paid=Number.isFinite(paidMs)&&paidMs<=clock+600000&&paidMs>=Date.parse(p.created_at)-86400000?isoMicro(paidMs):now;
  if(o.license_id||['fulfilled','refunded'].includes(o.status)){
   const same=o.payment_provider==='jianpay'&&[input.providerOrderId,input.merchantOrderNo].includes(o.payment_reference);
   fulfillment=same?'already_fulfilled':'duplicate_paid';paymentStatus=same?(o.status==='refunded'?'refunded':p.status==='refunding'?'refunding':'succeeded'):'duplicate_succeeded';
   t.add('UPDATE autofill__commercial_payments SET provider_order_id=?,provider_status=2,status=?,paid_at=coalesce(paid_at,?),last_queried_at=?,failure_code=?,updated_at=? WHERE id=?',[input.providerOrderId,paymentStatus,paid,queried,same?null:'duplicate_paid_order',now,p.id]);
   if(!same)await event('duplicate_payment',2,{existing_payment_reference:o.payment_reference});
  }else if(o.status==='canceled'||!o.delivery_code_hash||!o.delivery_code_hint||o.delivery_version!==1){
   fulfillment='needs_review';paymentStatus='needs_review';orderStatus=o.status==='canceled'?'canceled':'paid';
   t.add("UPDATE autofill__commercial_payments SET provider_order_id=?,provider_status=2,status='needs_review',paid_at=coalesce(paid_at,?),failure_code='paid_order_requires_review',updated_at=? WHERE id=?",[input.providerOrderId,paid,now,p.id]);
   t.add("UPDATE autofill__commercial_orders SET status=?,payment_provider='jianpay',payment_reference=coalesce(payment_reference,?),paid_at=coalesce(paid_at,?),updated_at=? WHERE id=?",[orderStatus,input.providerOrderId,paid,now,o.id]);await event('payment_needs_review',2,{order_status:orderStatus});
  }else{
   const duration=durations[o.plan_id];if(!duration)throw new ApiError(400,'INVALID_ORDER_PLAN');licenseId=crypto.randomUUID();paymentStatus='succeeded';orderStatus='fulfilled';fulfillment='fulfilled';
   t.add('INSERT INTO autofill__license_codes(id,code_hash,code_hint,plan_id,duration_days,max_devices,label,metadata) VALUES(?,?,?,?,?,2,?,?)',[licenseId,o.delivery_code_hash,o.delivery_code_hint,o.plan_id,duration,'order:'+o.order_no,json({source:'jianpay_checkout_v1',order_id:o.id,order_no:o.order_no,payment_id:p.id})]);
   t.add("UPDATE autofill__commercial_orders SET status='fulfilled',payment_provider='jianpay',payment_reference=?,license_id=?,paid_at=coalesce(paid_at,?),fulfilled_at=?,updated_at=? WHERE id=?",[input.providerOrderId,licenseId,paid,now,now,o.id]);
   t.add("UPDATE autofill__commercial_payments SET provider_order_id=?,provider_status=2,status='succeeded',paid_at=coalesce(paid_at,?),last_queried_at=?,failure_code=NULL,updated_at=? WHERE id=?",[input.providerOrderId,paid,queried,now,p.id]);
   await grantAccount(t,o,licenseId,now);
   for(const [type,data]of [['issued',{plan_id:o.plan_id,duration_days:duration}],['order_paid',{payment_provider:'jianpay',payment_id:p.id}],['order_fulfilled',{max_devices:2,delivery_version:1}]])await t.event('autofill__license_events',{license_id:licenseId,order_id:o.id,event_type:type,event_data:json(data)});
   await event('payment_succeeded',2,{license_id:licenseId});
  }
 }
 await t.commit();return {orderStatus,paymentStatus,fulfillment,licenseId};
}
export async function applyPaymentState(db:D1Database,input:PaymentState,now=isoMicro()){
 if(!/^BYP\d{8}[A-Z0-9]{12}$/.test(input.merchantOrderNo)||typeof input.providerOrderId!=='string'||input.providerOrderId.length<6||input.providerOrderId.length>200||!Number.isInteger(input.amountCents)||input.amountCents<100||input.amountCents>1000000||!Number.isInteger(input.providerStatus)||input.providerStatus<0||input.providerStatus>4||!['callback','query','operator'].includes(input.source)||!/^[a-f0-9]{64}$/.test(input.payloadHash))throw new ApiError(400,'INVALID_PAYMENT_STATE');
 for(let attempt=0;attempt<3;attempt++){try{return await applyOnce(db,input,now);}catch(e){if(!(e instanceof ApiError)||e.message!=='PAYMENT_TRANSACTION_CONFLICT'||attempt===2)throw e;}}
 throw new ApiError(503,'PAYMENT_STATE_UNAVAILABLE');
}
export async function applyJianPayNotification(db:D1Database,payload:Record<string,unknown>,credentials:{clientNo:string;merchantKey:string}){
 if(payload.sign_type!=='MD5'||!verifyJianPaySignature(payload,credentials.merchantKey))throw new ApiError(401,'INVALID_PAYMENT_SIGNATURE');
 let payment;try{payment=validateJianPayPaymentData(payload,{clientNo:credentials.clientNo});}catch{throw new ApiError(400,'INVALID_PROVIDER_PAYMENT');}
 return applyPaymentState(db,{merchantOrderNo:payment.merchantOrderNo,providerOrderId:payment.providerOrderId,amountCents:payment.amountCents,providerStatus:payment.status,source:'callback',payloadHash:sha256Payload(payload),paidAt:payment.paidAt});
}
