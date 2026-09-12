import {ApiError} from '../auth.ts';
import {createAutofillOrder,readAutofillOrder} from './orders.ts';
import {prepareAutofillCheckout,finalizeAutofillCheckout,recordAutofillCheckoutFailure} from './checkout-state.ts';
import {applyPaymentState} from './payment-state.ts';
import {PaymentTransaction,isoMicro} from './transaction.ts';
// @ts-ignore Server-only preserved provider implementation; never bundled in clients.
import {createJianPayCheckout,queryJianPayPayment} from './jianpay.mjs';
type Row=Record<string,unknown>;
export type CommercialConfig={PAYMENT_PROCESSING_ENABLED?:string;PAYMENT_CHECKOUT_ENABLED?:string;ORDER_IDEMPOTENCY_KEY?:string;JIANPAY_CLIENT_NO?:string;JIANPAY_MERCHANT_KEY?:string};
export type CommercialOwner={userId:string;verifiedEmail:string;sourceRef:'mnotoltpythkayguhnrk'};
function only(body:Row,keys:string[]){if(Object.keys(body).some(k=>!keys.includes(k)))throw new ApiError(400,'UNSUPPORTED_ORDER_FIELD');}
const hash=async(s:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(n=>n.toString(16).padStart(2,'0')).join('');
export async function deliveryProof(orderNo:string,token:string){
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('baoyan-autofill:license-delivery:v1\n'+orderNo+'\n'+token)));
 const chars=[...bytes.slice(0,20)].map(n=>alphabet[n&31]).join(''),code='BYA1'+chars;
 return{codeHash:await hash(code),codeHint:code.slice(0,4)+'…'+code.slice(-4)};
}
async function reserveQuery(db:D1Database,paymentId:string){
 for(let i=0;i<3;i++){try{
  const t=await PaymentTransaction.begin(db),now=isoMicro(),p=await t.row('SELECT last_queried_at FROM autofill__commercial_payments WHERE id=?',[paymentId]);
  if(!p)throw new ApiError(404,'PAYMENT_NOT_FOUND');if(p.last_queried_at&&Date.parse(p.last_queried_at)>Date.now()-30000)throw new ApiError(429,'PAYMENT_QUERY_COOLDOWN');
  const key='payment_queries_day:'+now.slice(0,10),n=Number((await t.row('SELECT value FROM _runtime_state WHERE key=?',[key]))?.value||0);if(n>=100)throw new ApiError(402,'PAYMENT_QUERY_BUDGET');
  t.add('UPDATE autofill__commercial_payments SET last_queried_at=? WHERE id=?',[now,paymentId]);t.add('INSERT INTO _runtime_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[key,String(n+1)]);await t.commit();return;
 }catch(e){if(!(e instanceof ApiError)||e.message!=='PAYMENT_TRANSACTION_CONFLICT'||i===2)throw e;}}
}
export async function commercialAction(db:D1Database,body:Row,owner:CommercialOwner|null,config:CommercialConfig,origin:string,fetcher:typeof fetch=fetch){
 const enabled=config.PAYMENT_PROCESSING_ENABLED==='true'&&config.PAYMENT_CHECKOUT_ENABLED==='true';
 if(body.action==='create_account'||body.action==='create'){
  if(!enabled)throw new ApiError(503,'NEW_PURCHASES_DISABLED');
  only(body,['action','planId','contactType','contactValue','note','consent','requestId','website']);
  if(body.website!==undefined&&body.website!=='')throw new ApiError(400,'INVALID_ORDER_REQUEST');
  const {action,website,...input}=body;void website;
  const result=await createAutofillOrder(db,{...input,deliveryMode:action==='create_account'?'account':'code'},owner,{enabled,idempotencyKey:config.ORDER_IDEMPOTENCY_KEY});
  return{...result,deliveryMode:action==='create_account'?'account':'code'};
 }
 only(body,['action','orderNo','accessToken',...(body.action==='create_payment'?['payMethod']:[])]);
 if(typeof body.orderNo!=='string'||typeof body.accessToken!=='string')throw new ApiError(400,'INVALID_ORDER_ACCESS');
 const {orderNo,accessToken}=body,order=await readAutofillOrder(db,orderNo,accessToken,owner?.userId||null,enabled);
 if(body.action==='status')return{order};
 if(!['create_payment','reconcile_payment'].includes(String(body.action)))throw new ApiError(400,'UNSUPPORTED_ORDER_ACTION');
 if(!enabled)throw new ApiError(503,'NEW_PURCHASES_DISABLED');
 if(!config.JIANPAY_CLIENT_NO||!config.JIANPAY_MERCHANT_KEY)throw new ApiError(503,'PAYMENT_CONFIGURATION_PENDING');
 const credentials={clientNo:config.JIANPAY_CLIENT_NO,merchantKey:config.JIANPAY_MERCHANT_KEY};
 if(body.action==='create_payment'){
  if(!['wx','alipay'].includes(String(body.payMethod)))throw new ApiError(400,'INVALID_PAYMENT_METHOD');
  const proof=await deliveryProof(orderNo,accessToken),alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',suffix=[...crypto.getRandomValues(new Uint8Array(12))].map(n=>alphabet[n&31]).join('');
  const merchantOrderNo='BYP'+new Date(Date.now()+28800000).toISOString().slice(0,10).replaceAll('-','')+suffix;
  const prepared=await prepareAutofillCheckout(db,{orderNo,accessTokenHash:await hash(accessToken),owner:owner?.userId||null,payMethod:String(body.payMethod),merchantOrderNo,deliveryCodeHash:proof.codeHash,deliveryCodeHint:proof.codeHint,requestHash:await hash(JSON.stringify([orderNo,body.payMethod]))});
  if(prepared.createdNow){
   if(typeof prepared.id!=='string')throw new ApiError(503,'PAYMENT_PREPARATION_INCOMPLETE');
   let result;
   try{result=await createJianPayCheckout({merchantOrderNo:prepared.merchant_order_no,payMethod:prepared.pay_method,amountCents:prepared.amount_cents,goodsName:'寻鹿闪填 '+order.planId,notifyUrl:'https://migration.seekoffer.com.cn/v1/payments/jianpay/notify',returnUrl:origin+'/order/success/?order='+encodeURIComponent(orderNo)+'&payment=return'},credentials,{fetchImpl:fetcher});}
   catch(e){const code=typeof(e as {code?:string})?.code==='string'&&/^[a-z_]{3,100}$/.test((e as {code:string}).code)?(e as {code:string}).code:'provider_failure';await recordAutofillCheckoutFailure(db,{paymentId:prepared.id,failureCode:code,payloadHash:await hash(code),definitive:false});throw new ApiError(503,'CHECKOUT_OUTCOME_UNCERTAIN');}
   await finalizeAutofillCheckout(db,{paymentId:prepared.id,providerOrderId:result.providerOrderId,payUrl:result.payUrl,providerStatus:result.status,payloadHash:result.payloadHash});
  }
  return{order:await readAutofillOrder(db,orderNo,accessToken,owner?.userId||null,enabled)};
 }
 const p=await db.prepare('SELECT p.id,p.provider_order_id,p.merchant_order_no,p.amount_cents,p.status FROM autofill__commercial_payments p JOIN autofill__commercial_orders o ON o.id=p.order_id WHERE o.order_no=? AND o.access_token_hash=? ORDER BY p.created_at DESC,p.id DESC LIMIT 1').bind(orderNo,await hash(accessToken)).first<{id:string;provider_order_id:string|null;merchant_order_no:string;amount_cents:number;status:string}>();
 if(!p?.provider_order_id)throw new ApiError(409,'PAYMENT_RECONCILIATION_REQUIRED');
 if(['refunded','refunding','duplicate_succeeded','needs_review'].includes(p.status))return{order};
 await reserveQuery(db,p.id);
 let result;try{result=await queryJianPayPayment({providerOrderId:p.provider_order_id,merchantOrderNo:p.merchant_order_no,amountCents:p.amount_cents},credentials,{fetchImpl:fetcher});}catch{throw new ApiError(503,'PAYMENT_RECONCILIATION_UNAVAILABLE');}
 const state=await applyPaymentState(db,{merchantOrderNo:p.merchant_order_no,providerOrderId:p.provider_order_id,amountCents:result.amountCents,providerStatus:result.status,source:'query',payloadHash:result.payloadHash,paidAt:result.paidAt});
 return{order:await readAutofillOrder(db,orderNo,accessToken,owner?.userId||null,enabled),fulfillmentState:state.fulfillment};
}
