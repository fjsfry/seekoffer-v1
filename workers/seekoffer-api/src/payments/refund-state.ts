import {ApiError} from '../auth.ts';import {PaymentTransaction,isoMicro,addDaysExact} from './transaction.ts';
type Row=Record<string,any>;
type RefundState={refundNo:string;providerRefundId:string|null;providerOrderId:string;providerStatus:number;amountCents:number;payloadHash:string;errorMessage?:string};
const json=JSON.stringify;
async function reverseAccount(t:PaymentTransaction,order:Row,now:string){
 if(order.delivery_mode!=='account')return;
 const grant=await t.row('SELECT * FROM autofill__account_entitlement_grants WHERE order_id=?',[order.id]);if(!grant||grant.status==='refunded')return;
 const entitlement=await t.row('SELECT * FROM autofill__account_entitlements WHERE id=?',[grant.entitlement_id]);
 t.add("UPDATE autofill__account_entitlement_grants SET status='refunded',refunded_at=?,updated_at=?,metadata=json_patch(metadata,?) WHERE id=?",[now,now,json({refund_order_status:'refunded'}),grant.id]);if(!entitlement)return;
 const remaining=await t.rows("SELECT plan_id FROM autofill__account_entitlement_grants WHERE entitlement_id=? AND status='active' AND id<>? ORDER BY granted_at DESC,created_at DESC",[entitlement.id,grant.id]);
 let until=now,status='refunded';if(remaining.length){const reduced=addDaysExact(entitlement.valid_until,-grant.duration_days);until=reduced>now?reduced:now;status=until>now?'active':'expired';}
 t.add('UPDATE autofill__account_entitlements SET status=?,plan_id=?,valid_until=?,version=version+1,updated_at=?,metadata=json_patch(metadata,?) WHERE id=?',[status,remaining[0]?.plan_id||entitlement.plan_id,until,now,json({last_refunded_order_no:order.order_no,last_refunded_at:now}),entitlement.id]);
 if(status!=='active')t.add("UPDATE autofill__account_entitlement_devices SET revoked_at=coalesce(revoked_at,?),last_checked_at=?,updated_at=?,metadata=json_patch(metadata,?) WHERE entitlement_id=? AND revoked_at IS NULL",[now,now,now,json({revoked_by:'account_refund'}),entitlement.id]);
 await t.event('autofill__account_entitlement_events',{entitlement_id:entitlement.id,grant_id:grant.id,user_id:grant.user_id,order_id:order.id,event_type:'account_refunded',event_data:json({reversed_days:grant.duration_days,remaining_grants:remaining.length,status,valid_until:until})});
}
async function reverseOrder(t:PaymentTransaction,order:Row,reference:string,reason:string,now:string){
 if(order.status==='refunded')return;
 if(!['paid','fulfilled'].includes(order.status))throw new ApiError(409,'REFUND_REQUIRES_PAID_ORDER');
 let renewal=false;
 if(order.license_id){
  const code=await t.row('SELECT * FROM autofill__license_codes WHERE id=?',[order.license_id]);
  if(code){
   const metadata=JSON.parse(code.metadata),renewedId=metadata.renewed_license_id;
   if(typeof renewedId==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(renewedId)){
    const renewed=await t.row('SELECT * FROM autofill__license_codes WHERE id=?',[renewedId]);
    if(renewed&&renewed.status==='active'&&renewed.entitlement_expires_at){
     renewal=true;const reduced=addDaysExact(renewed.entitlement_expires_at,-code.duration_days),expiry=reduced>now?reduced:now,meta=JSON.parse(renewed.metadata);
     let count=0;if(/^\d+$/.test(String(meta.renewal_count))){const previous=Number(meta.renewal_count);if(!Number.isSafeInteger(previous)||previous>2147483647)throw new ApiError(503,'RENEWAL_COUNT_OUT_OF_RANGE');count=Math.max(0,previous-1);}
     t.add('UPDATE autofill__license_codes SET entitlement_expires_at=?,updated_at=?,metadata=json_patch(metadata,?) WHERE id=?',[expiry,now,json({renewal_count:count,last_renewal_refunded_at:now,last_reversed_renewal_license_id:code.id}),renewed.id]);
     await t.event('autofill__license_events',{license_id:renewed.id,order_id:order.id,event_type:'renewal_reversed',event_data:json({renewal_license_id:code.id,reversed_days:code.duration_days,expires_at:expiry})});
    }
   }
   t.add("UPDATE autofill__license_codes SET status='revoked',updated_at=? WHERE id=?",[now,code.id]);
   if(!renewal)t.add('UPDATE autofill__license_activations SET revoked_at=coalesce(revoked_at,?) WHERE license_id=?',[now,code.id]);
   await t.event('autofill__license_events',{license_id:code.id,order_id:order.id,event_type:'revoked',event_data:json({reason:'refunded',renewal_reversal:renewal})});
  }
 }
 t.add("UPDATE autofill__commercial_orders SET status='refunded',refunded_at=?,updated_at=?,metadata=json_patch(metadata,?) WHERE id=?",[now,now,json({refund_reference:reference,refund_reason:reason,renewal_reversal:renewal}),order.id]);
 await reverseAccount(t,order,now);
 await t.event('autofill__license_events',{license_id:order.license_id,order_id:order.id,event_type:'order_refunded',event_data:json({recorded_after_external_refund:true,renewal_reversal:renewal})});
}
async function applyOnce(db:D1Database,input:RefundState,now:string){
 const t=await PaymentTransaction.begin(db),r=await t.row('SELECT * FROM autofill__commercial_refunds WHERE refund_no=?',[input.refundNo]);if(!r)throw new ApiError(404,'REFUND_NOT_FOUND');
 const p=await t.row('SELECT * FROM autofill__commercial_payments WHERE id=?',[r.payment_id]),o=await t.row('SELECT * FROM autofill__commercial_orders WHERE id=?',[r.order_id]);if(!p||!o)throw new ApiError(404,'REFUND_PARENT_NOT_FOUND');
 if(r.amount_cents!==input.amountCents||p.provider_order_id!==input.providerOrderId)throw new ApiError(409,'REFUND_PAYMENT_MISMATCH');
 if(r.provider_refund_id&&input.providerRefundId&&r.provider_refund_id!==input.providerRefundId)throw new ApiError(409,'PROVIDER_REFUND_MISMATCH');
 if(r.status==='succeeded')return {refundStatus:r.status,orderStatus:o.status,paymentStatus:p.status,replayed:true};
 const status=input.providerStatus===2?'succeeded':input.providerStatus===3?'failed':'processing',meta=JSON.parse(r.metadata),prior=['succeeded','duplicate_succeeded','needs_review'].includes(meta.prior_payment_status)?meta.prior_payment_status:'succeeded';
 const paymentStatus=status==='succeeded'?'refunded':status==='failed'?prior:'refunding';let orderStatus=o.status;
 t.add('UPDATE autofill__commercial_refunds SET provider_refund_id=coalesce(?,provider_refund_id),provider_status=?,status=?,error_message=?,last_queried_at=?,refunded_at=?,updated_at=? WHERE id=?',[input.providerRefundId,input.providerStatus,status,input.errorMessage||null,now,status==='succeeded'?now:r.refunded_at,now,r.id]);
 if(status==='succeeded'&&r.affects_entitlement){await reverseOrder(t,o,input.providerRefundId||r.refund_no,r.reason,now);orderStatus='refunded';}
 else if(status==='succeeded'&&r.affects_order){orderStatus='refunded';t.add("UPDATE autofill__commercial_orders SET status='refunded',refunded_at=?,updated_at=?,metadata=json_patch(metadata,?) WHERE id=?",[now,now,json({refund_reference:input.providerRefundId||r.refund_no,refund_reason:r.reason,refund_without_entitlement:true}),o.id]);await reverseAccount(t,o,now);}
 t.add('UPDATE autofill__commercial_payments SET status=?,failure_code=?,updated_at=? WHERE id=?',[paymentStatus,status==='failed'?'refund_failed':null,now,p.id]);
 await t.event('autofill__commercial_payment_events',{payment_id:p.id,order_id:o.id,source:'refund',event_type:'refund_state_changed',provider_status:input.providerStatus,payload_hash:input.payloadHash,event_data:json({refund_id:r.id,status})},true);
 await t.commit();return {refundStatus:status,orderStatus,paymentStatus,replayed:false};
}
export async function applyRefundState(db:D1Database,input:RefundState,now=isoMicro()){
 if(!/^BYR\d{8}[A-Z0-9]{12}$/.test(input.refundNo)||!Number.isInteger(input.providerStatus)||input.providerStatus<0||input.providerStatus>3||!Number.isInteger(input.amountCents)||input.amountCents<100||input.amountCents>1000000||!/^[a-f0-9]{64}$/.test(input.payloadHash)||typeof input.providerOrderId!=='string'||input.providerOrderId.length<6||input.providerOrderId.length>200||input.providerRefundId!==null&&(typeof input.providerRefundId!=='string'||input.providerRefundId.length<6||input.providerRefundId.length>200)||input.errorMessage!==undefined&&(typeof input.errorMessage!=='string'||input.errorMessage.length>500))throw new ApiError(400,'INVALID_REFUND_STATE');
 for(let attempt=0;attempt<3;attempt++){try{return await applyOnce(db,input,now);}catch(e){if(!(e instanceof ApiError)||e.message!=='PAYMENT_TRANSACTION_CONFLICT'||attempt===2)throw e;}}
 throw new ApiError(503,'REFUND_STATE_UNAVAILABLE');
}
