import test from 'node:test';import assert from 'node:assert/strict';
// @ts-ignore Source-preserved JS gateway; all inputs in this file are synthetic.
import {canonicalizeJianPayParams,signJianPayParams,verifyJianPaySignature,queryJianPayPayment,createJianPayCheckout,validateJianPayPaymentData,validateJianPayRefundData,parseJianPayPaidAt} from '../src/payments/jianpay.mjs';
const credentials={clientNo:'JP_TEST001',merchantKey:'synthetic-merchant-key-for-tests-only'};
const payment={clientNo:credentials.clientNo,orderId:'PAY000001',merchantOrderNo:'BYP20260908ABCDEFGHIJKL',amount:100,status:2,payMethod:'wx',paidAt:'2026-09-08 22:00:00',payUrl:'https://jpay.hzjianban.com/#/pay?orderId=PAY000001'};
test('JianPay signature preserves source canonicalization and rejects amount, merchant, and key tampering',()=>{
 assert.equal(canonicalizeJianPayParams({z:0,b:false,a:'',c:null,sign:'excluded',sign_type:'MD5'}),'b=false&z=0');
 const signed={...payment,sign:signJianPayParams(payment,credentials.merchantKey)};assert.equal(verifyJianPaySignature(signed,credentials.merchantKey),true);
 assert.equal(verifyJianPaySignature({...signed,amount:101},credentials.merchantKey),false);assert.equal(verifyJianPaySignature({...signed,clientNo:'JP_OTHER01'},credentials.merchantKey),false);assert.equal(verifyJianPaySignature(signed,'another-synthetic-key'),false);
});
test('payment and refund identity or amount mismatches are rejected, paid time uses Beijing timezone',()=>{
 const expected={clientNo:credentials.clientNo,providerOrderId:payment.orderId,merchantOrderNo:payment.merchantOrderNo,amountCents:100};assert.equal(validateJianPayPaymentData(payment,expected).paidAt,'2026-09-08T14:00:00.000Z');assert.equal(parseJianPayPaidAt('unknown'),null);
 for(const patch of [{clientNo:'JP_OTHER01'},{orderId:'PAY_OTHER01'},{merchantOrderNo:'BYP20260908XXXXXXXXXXXX'},{amount:101},{status:99}])assert.throws(()=>validateJianPayPaymentData({...payment,...patch},expected));
 const refund={refundId:'REFUND001',refundNo:'REFUND_MERCHANT001',orderId:payment.orderId,clientNo:credentials.clientNo,refundAmount:100,status:1};assert.throws(()=>validateJianPayRefundData(refund,{...expected,amountCents:101}));
});
test('gateway query goes only to the official read endpoint with a signature and no raw key',async()=>{
 let calls=0;const r=await queryJianPayPayment({providerOrderId:payment.orderId,merchantOrderNo:payment.merchantOrderNo,amountCents:100},credentials,{fetchImpl:async(url:string,init:RequestInit)=>{calls++;assert.equal(url,'https://jpay.hzjianban.com/open/payment/pay/info');assert.equal(String(init.body).includes(credentials.merchantKey),false);const body=JSON.parse(String(init.body));assert.equal(verifyJianPaySignature(body,credentials.merchantKey),true);return Response.json({code:1000,data:payment});}});assert.equal(calls,1);assert.equal(r.amountCents,100);
});
test('checkout refuses a provider response that points to an unrelated payment site',async()=>{
 await assert.rejects(()=>createJianPayCheckout({merchantOrderNo:payment.merchantOrderNo,amountCents:100,goodsName:'合成测试商品',payMethod:'wx'},credentials,{fetchImpl:async()=>Response.json({code:1000,data:{...payment,payUrl:'https://evil.invalid/pay'}})}));
});
