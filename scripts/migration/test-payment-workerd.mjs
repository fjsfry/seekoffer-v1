// Actual local workerd + D1 binding; synthetic records only, all external fetches blocked.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {Miniflare,Log,LogLevel,convertV4MiniflareOptions} from '../../workers/seekoffer-api/node_modules/miniflare/dist/src/index.js';
import {signJianPayParams} from '../../workers/seekoffer-api/src/payments/jianpay.mjs';
let outboundCalls=0;const key='synthetic-local-workerd-merchant-key';
const options=convertV4MiniflareOptions({cf:false,modules:true,scriptPath:path.resolve('artifacts/d1-worker-payment-runtime/acceptance-worker.js'),compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],d1Databases:{CORE:'synthetic-payment-test'},d1Persist:false,bindings:{MODE:'local',ALLOWED_ORIGINS:'http://127.0.0.1',BUSINESS_WRITES_ENABLED:'true',PAYMENT_PROCESSING_ENABLED:'true',JIANPAY_CLIENT_NO:'JP_TEST001',JIANPAY_MERCHANT_KEY:key},outboundService:()=>{outboundCalls++;return new Response('blocked',{status:503});},log:new Log(LogLevel.ERROR)});
options.telemetry={enabled:false};
const mf=new Miniflare(options);
try{
 const db=await mf.getD1Database('CORE'),schema=JSON.parse(fs.readFileSync('artifacts/d1-migration/payment-runtime-schema-statements.json','utf8'));
 for(let i=0;i<schema.length;i+=20)await db.batch(schema.slice(i,i+20).map(sql=>db.prepare(sql)));
 const subject='00000000-0000-4000-8000-000000000099',oid=crypto.randomUUID(),pid=crypto.randomUUID();
 await db.batch([
  db.prepare('INSERT INTO autofill__auth_subjects(id) VALUES(?)').bind(subject),
  db.prepare("INSERT INTO autofill__commercial_orders(id,order_no,plan_id,amount_cents,contact_type,contact_value,consent_at,delivery_code_hash,delivery_code_hint,delivery_version,delivery_mode,user_id) VALUES(?,'BY2026090800000001','pro_30',100,'email','synthetic@example.invalid','2026-09-08T00:00:00.000000Z',?,'SYNTHETIC-TEST',1,'account',?)").bind(oid,'a'.repeat(64),subject),
  db.prepare("INSERT INTO autofill__commercial_payments(id,order_id,merchant_order_no,pay_method,amount_cents,status) VALUES(?,?,'BYP20260908000000000001','wx',100,'pending')").bind(pid,oid)
 ]);
 const payload={clientNo:'JP_TEST001',orderId:'PAY_WORKERD_00001',merchantOrderNo:'BYP20260908000000000001',amount:100,status:2,sign_type:'MD5'};
 const invoke=sign=>mf.dispatchFetch('http://127.0.0.1/v1/payments/jianpay/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,sign})});
 const bad=await invoke('0'.repeat(32));assert.equal(bad.status,401);
 const good=await invoke(signJianPayParams(payload,key));assert.equal(good.status,200);assert.equal(await good.text(),'success');
 const repeated=await invoke(signJianPayParams(payload,key));assert.equal(repeated.status,200);assert.equal(await repeated.text(),'success');
 const grants=await db.prepare('SELECT count(*) AS n FROM autofill__account_entitlement_grants').first('n');assert.equal(grants,1);
 const license=await db.prepare('SELECT status FROM autofill__license_codes').first('status');assert.equal(license,'disabled');
 const events=await db.prepare('SELECT min(id) AS first,max(id) AS last,count(*) AS n FROM autofill__license_events').first();assert.deepEqual(events,{first:148,last:150,n:3});
 assert.equal(outboundCalls,0);
 const receipt={at:new Date().toISOString(),layer:'local-workerd-real-D1-binding',syntheticOnly:true,invalidSignatureStatus:bad.status,validCallbackStatus:good.status,repeatCallbackStatus:repeated.status,exactlyOnceGrant:true,codeDisabledForAccountDelivery:true,sourceSequenceGapsPreserved:true,externalFetches:outboundCalls,remoteDatabaseWrites:0,state:'LOCAL_WORKERD_PAYMENT_CALLBACK_PASSED'};
 fs.writeFileSync('artifacts/d1-migration/payment-workerd-verification.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}finally{await mf.dispose();}
