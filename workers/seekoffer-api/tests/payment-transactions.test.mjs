import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {fileURLToPath} from 'node:url';import {DatabaseSync} from 'node:sqlite';import {build} from 'esbuild';
const root=new URL('../../../',import.meta.url),out=new URL('artifacts/d1-migration/payment-transactions-test-bundle.mjs',root);
await build({entryPoints:[fileURLToPath(new URL('payment-entry.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',outfile:fileURLToPath(out),logLevel:'silent'});
const {applyPaymentState,applyJianPayNotification,applyRefundState,refundAction,prepareRefund,recentlyVerified,PaymentTransaction,addDaysExact,signJianPayParams,createSnapshotWorker}=await import(out);
const key='synthetic-payment-key-for-fixtures',client='JP_TEST001',subject='00000000-0000-4000-8000-000000000010';
function setup(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON;');for(const file of ['0001_business.sql','0002_preview_runtime.sql','0003_payment_transactions.sql'])db.exec(fs.readFileSync(new URL('migrations/d1/snapshot/'+file,root),'utf8'));
 const queries=[];const adapter={prepare(sql){let args=[];const execute=()=>{queries.push(sql);return {success:true,results:db.prepare(sql).all(...args)};};return {bind(...v){args=v;return this;},async first(){return execute().results[0]||null;},async all(){return execute();},execute};},async batch(statements){db.exec('BEGIN');try{const results=statements.map(s=>s.execute());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}};
 function order(n=1,mode='code',status='pending'){
  if(mode==='account')db.prepare('INSERT INTO autofill__auth_subjects(id) VALUES(?) ON CONFLICT DO NOTHING').run(subject);
  const id=crypto.randomUUID(),pid=crypto.randomUUID(),suffix=String(n).padStart(12,'0'),merchant='BYP20260908'+suffix;
  db.prepare('INSERT INTO autofill__commercial_orders(id,order_no,plan_id,amount_cents,contact_type,contact_value,consent_at,delivery_code_hash,delivery_code_hint,delivery_version,delivery_mode,user_id,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'BY20260908'+String(n).padStart(8,'0'),'pro_30',100,'email','synthetic@example.invalid','2026-09-08T00:00:00.000000Z',n.toString(16).padStart(64,'0'),'SYNTHETIC-'+n,1,mode,mode==='account'?subject:null,status);
  db.prepare('INSERT INTO autofill__commercial_payments(id,order_id,merchant_order_no,pay_method,amount_cents,status) VALUES(?,?,?,?,?,?)').run(pid,id,merchant,'wx',100,'pending');
  return {id,pid,payload:{clientNo:client,merchantOrderNo:merchant,orderId:'PAY_SYNTHETIC_'+n,amount:100,status:2,sign_type:'MD5'}};
 }
 const notify=p=>applyJianPayNotification(adapter,{...p,sign:signJianPayParams(p,key)},{clientNo:client,merchantKey:key});
 return {db,adapter,queries,order,notify};
}

const refundOperator={userId:subject,role:'super_admin',recentlyVerified:true};
const refundConfig={PAYMENT_PROCESSING_ENABLED:'true',REFUNDS_ENABLED:'true',JIANPAY_CLIENT_NO:client,JIANPAY_MERCHANT_KEY:key};
const refundRequest=n=>({action:'create',orderNo:'BY20260908'+String(n).padStart(8,'0'),refundNo:'BYR20260911'+String(n).padStart(12,'0'),amountCents:100,reason:'Synthetic refund test'});
function refundProvider({lost=false,amount=100,status=2}={}){const calls=[];const fetcher=async(url,options)=>{const body=JSON.parse(options.body);calls.push({path:new URL(url).pathname,body});assert.equal(new URL(url).origin,'https://jpay.hzjianban.com');assert.match(body.sign,/^[a-f0-9]{32}$/);if(lost&&url.endsWith('/create'))throw Error('synthetic response lost');return Response.json({code:1000,data:{clientNo:client,orderId:'PAY_SYNTHETIC_1',refundId:'REFUND_SYNTHETIC_1',refundNo:body.refundNo,refundAmount:amount,status}});};return{fetcher,calls};}

test('refund creation is committed once across concurrent retries, without leaking private fields',async()=>{
 const {db,adapter,order,notify}=setup();const o=order();await notify(o.payload);const provider=refundProvider();
 const results=await Promise.all([refundAction(adapter,refundRequest(1),refundOperator,refundConfig,provider.fetcher),refundAction(adapter,refundRequest(1),refundOperator,refundConfig,provider.fetcher)]);
 assert.equal(provider.calls.length,1);assert.equal(db.prepare('SELECT count(*) n FROM autofill__commercial_refunds').get().n,1);assert.equal(db.prepare('SELECT status FROM autofill__commercial_orders').get().status,'refunded');
 const state=await refundAction(adapter,{action:'status',refundNo:refundRequest(1).refundNo},refundOperator,refundConfig,provider.fetcher);assert.equal(state.status,'succeeded');for(const word of ['contact_value','operator_id','Synthetic refund test',key])assert.ok(!JSON.stringify(results).includes(word));
 await assert.rejects(()=>refundAction(adapter,{...refundRequest(1),reason:'Changed retry'},refundOperator,refundConfig,provider.fetcher),e=>e.status===409);assert.equal(provider.calls.length,1);db.close();
});
test('lost refund response cannot recreate a provider refund; query resumes exactly one reversal',async()=>{
 const {db,adapter,order,notify}=setup();const o=order(1,'account');await notify(o.payload);const provider=refundProvider({lost:true});
 await assert.rejects(()=>refundAction(adapter,refundRequest(1),refundOperator,refundConfig,provider.fetcher),e=>e.message==='REFUND_OUTCOME_UNCERTAIN');
 assert.equal(db.prepare('SELECT status FROM autofill__commercial_refunds').get().status,'create_unknown');assert.equal(db.prepare('SELECT status FROM autofill__account_entitlements').get().status,'active');
 await refundAction(adapter,refundRequest(1),refundOperator,refundConfig,provider.fetcher);assert.equal(provider.calls.length,1);
 const query={action:'query',refundNo:refundRequest(1).refundNo};assert.equal((await refundAction(adapter,query,refundOperator,refundConfig,provider.fetcher)).status,'succeeded');
 const revision=db.prepare('SELECT version FROM _business_revisions').get().version;
 await refundAction(adapter,query,refundOperator,refundConfig,provider.fetcher);assert.equal(provider.calls.length,2);assert.equal(db.prepare('SELECT version FROM _business_revisions').get().version,revision);assert.equal(db.prepare('SELECT count(*) n FROM main__user_entitlements').get().n,0);db.close();
});
test('refund amount mismatch and missing recent verification produce no charge or entitlement change',async()=>{
 const {db,adapter,order,notify,queries}=setup();const o=order();await notify(o.payload);const provider=refundProvider({amount:101});
 const prior=queries.length;await assert.rejects(()=>refundAction(adapter,refundRequest(1),{...refundOperator,recentlyVerified:false},refundConfig,provider.fetcher),e=>e.status===403);assert.equal(queries.length,prior);
 await assert.rejects(()=>refundAction(adapter,refundRequest(1),refundOperator,{...refundConfig,REFUNDS_ENABLED:'false'},provider.fetcher),e=>e.status===503);assert.equal(provider.calls.length,0);
 await assert.rejects(()=>refundAction(adapter,{...refundRequest(1),amountCents:101},refundOperator,refundConfig,provider.fetcher),e=>e.status===409);assert.equal(provider.calls.length,0);
 await assert.rejects(()=>refundAction(adapter,refundRequest(1),refundOperator,refundConfig,provider.fetcher),e=>e.message==='REFUND_OUTCOME_UNCERTAIN');assert.equal(db.prepare('SELECT status FROM autofill__license_codes').get().status,'active');db.close();
});
test('refund query cooldown and daily preparation budget stop before more external operations',async()=>{
 const {db,adapter,order,notify}=setup();const o=order();await notify(o.payload);const provider=refundProvider({status:1});await refundAction(adapter,refundRequest(1),refundOperator,refundConfig,provider.fetcher);
 await assert.rejects(()=>refundAction(adapter,{action:'query',refundNo:refundRequest(1).refundNo},refundOperator,refundConfig,provider.fetcher),e=>e.status===429);assert.equal(provider.calls.length,1);
 const o2=order(2);await notify(o2.payload);db.prepare('UPDATE _runtime_state SET value=? WHERE key=?').run('20','autofill_refunds_day:'+new Date().toISOString().slice(0,10));
 await assert.rejects(()=>refundAction(adapter,refundRequest(2),refundOperator,refundConfig,provider.fetcher),e=>e.status===402);assert.equal(db.prepare('SELECT status FROM autofill__commercial_payments WHERE id=?').get(o2.pid).status,'succeeded');assert.equal(provider.calls.length,1);db.close();
});
test('duplicate payment refund leaves the original paid license active',async()=>{
 const {db,adapter,order,notify}=setup();const o=order();await notify(o.payload);const second=crypto.randomUUID(),merchant='BYP20260908000000000002';
 db.prepare("INSERT INTO autofill__commercial_payments(id,order_id,merchant_order_no,pay_method,amount_cents,status,provider_order_id) VALUES(?,?,?,'wx',100,'duplicate_succeeded','PAY_DUPLICATE_1')").run(second,o.id,merchant);
 const prepared=await prepareRefund(adapter,{...refundRequest(1),merchantOrderNo:merchant,operatorId:subject});assert.equal(prepared.row.affects_order,0);assert.equal(prepared.row.affects_entitlement,0);
 await applyRefundState(adapter,{refundNo:prepared.row.refund_no,providerRefundId:'REFUND_DUPLICATE_1',providerOrderId:'PAY_DUPLICATE_1',providerStatus:2,amountCents:100,payloadHash:'f'.repeat(64)});
 assert.equal(db.prepare('SELECT status FROM autofill__commercial_orders').get().status,'fulfilled');assert.equal(db.prepare('SELECT status FROM autofill__license_codes').get().status,'active');db.close();
});
test('refund preparation rolls back counter, status and ledger on audit failure',async()=>{
 const {db,adapter,order,notify}=setup();const o=order();await notify(o.payload);db.exec("CREATE TRIGGER synthetic_refund_audit_failure BEFORE INSERT ON autofill__commercial_payment_events WHEN NEW.event_type='refund_prepared' BEGIN SELECT RAISE(ABORT,'fixture'); END;");
 await assert.rejects(()=>prepareRefund(adapter,{...refundRequest(1),operatorId:subject}));assert.equal(db.prepare('SELECT count(*) n FROM autofill__commercial_refunds').get().n,0);assert.equal(db.prepare('SELECT status FROM autofill__commercial_payments').get().status,'succeeded');assert.equal(db.prepare("SELECT count(*) n FROM _runtime_state WHERE key LIKE 'autofill_refunds_day:%'").get().n,0);db.close();
});
test('sensitive operations require signed factor age, not token freshness',()=>{
 const base={issuer:'https://clerk.seekoffer.com.cn',subject:'user_synthetic',sessionId:'sess_synthetic'};
 assert.equal(recentlyVerified(base),false);for(const ages of [[-1,-1],[5,-1],[NaN,0],['0',-1],[0]])assert.equal(recentlyVerified({...base,factorVerificationAge:ages}),false);
 assert.equal(recentlyVerified({...base,factorVerificationAge:[0,-1]}),true);assert.equal(recentlyVerified({...base,factorVerificationAge:[120,0]}),true);
});
test('paid callback atomically issues one code, preserves sequence gaps and safely repeats',async()=>{
 const {db,order,notify}=setup(),o=order();const result=await notify(o.payload);assert.equal(result.fulfillment,'fulfilled');
 assert.equal(db.prepare('SELECT count(*) AS n FROM autofill__license_codes').get().n,1);assert.deepEqual(db.prepare('SELECT id FROM autofill__license_events ORDER BY id').all().map(r=>r.id),[148,149,150]);assert.equal(db.prepare('SELECT id FROM autofill__commercial_payment_events').get().id,63);
 assert.equal((await notify(o.payload)).fulfillment,'already_fulfilled');assert.equal(db.prepare('SELECT count(*) AS n FROM autofill__license_events').get().n,3);assert.equal(db.prepare('SELECT count(*) AS n FROM _business_transaction_guards').get().n,0);db.close();
});
test('simultaneous callbacks and query retries cannot grant the same order twice',async()=>{
 const {db,order,notify}=setup(),o=order(1,'account');const results=await Promise.all([notify(o.payload),notify(o.payload)]);assert.deepEqual(results.map(r=>r.fulfillment).sort(),['already_fulfilled','fulfilled']);assert.equal(db.prepare('SELECT count(*) AS n FROM autofill__account_entitlement_grants').get().n,1);assert.equal(db.prepare('SELECT status FROM autofill__license_codes').get().status,'disabled');assert.equal(db.prepare('SELECT id FROM autofill__account_entitlement_events').get().id,37);db.close();
});
test('account renewals accumulate and preserve microseconds without mixing the main identity pool',async()=>{
 const {db,order,notify}=setup(),first=order(1,'account'),second=order(2,'account');
 db.prepare("INSERT INTO autofill__account_entitlements(id,user_id,status,plan_id,valid_until) VALUES(?,?,'active','pro_30',?)").run(crypto.randomUUID(),subject,'2030-01-01T01:02:03.123456Z');
 await Promise.all([notify(first.payload),notify(second.payload)]);const entitlement=db.prepare('SELECT valid_until,version FROM autofill__account_entitlements').get();assert.equal(entitlement.valid_until,'2030-03-02T01:02:03.123456Z');assert.equal(entitlement.version,2);assert.equal(db.prepare('SELECT count(*) AS n FROM main__user_entitlements').get().n,0);assert.equal(db.prepare('SELECT count(*) AS n FROM main__auth_subjects').get().n,0);db.close();
});
test('bad signature reads no database; validly signed wrong amounts or merchant IDs cannot fulfill',async()=>{
 const {db,adapter,queries,order,notify}=setup(),o=order();await assert.rejects(()=>applyJianPayNotification(adapter,{...o.payload,sign:'0'.repeat(32)},{clientNo:client,merchantKey:key}),e=>e.status===401);assert.equal(queries.length,0);
 await assert.rejects(()=>notify({...o.payload,amount:101}),e=>e.status===409);await assert.rejects(()=>notify({...o.payload,clientNo:'JP_OTHER'}),e=>e.status===400);assert.equal(db.prepare('SELECT status FROM autofill__commercial_orders').get().status,'pending');assert.equal(db.prepare('SELECT count(*) AS n FROM autofill__license_codes').get().n,0);db.close();
});
test('canceled paid orders are retained for reconciliation and never auto-granted',async()=>{
 const {db,order,notify}=setup(),o=order(1,'code','canceled');assert.equal((await notify(o.payload)).fulfillment,'needs_review');assert.equal(db.prepare('SELECT status FROM autofill__commercial_orders').get().status,'canceled');assert.equal(db.prepare('SELECT count(*) AS n FROM autofill__license_codes').get().n,0);assert.equal(db.prepare('SELECT event_type FROM autofill__commercial_payment_events').get().event_type,'payment_needs_review');db.close();
});
test('all data and sequence increments roll back if any entitlement or audit write fails',async()=>{
 const {db,order,notify}=setup(),o=order(1,'account');db.exec("CREATE TRIGGER synthetic_fail_audit BEFORE INSERT ON autofill__license_events BEGIN SELECT RAISE(ABORT,'fixture failure'); END;");await assert.rejects(()=>notify(o.payload));
 for(const table of ['autofill__license_codes','autofill__account_entitlements','autofill__account_entitlement_grants','autofill__account_entitlement_events','autofill__license_events','autofill__commercial_payment_events'])assert.equal(db.prepare('SELECT count(*) AS n FROM '+table).get().n,0,table);
 assert.equal(db.prepare('SELECT status FROM autofill__commercial_orders').get().status,'pending');assert.equal(db.prepare("SELECT next_value FROM _business_sequences WHERE name='autofill__license_events'").get().next_value,148);assert.equal(db.prepare('SELECT version FROM _business_revisions').get().version,0);db.close();
});
test('late unpaid or paid callbacks cannot downgrade a refund in progress',async()=>{
 const {db,order,notify}=setup(),o=order();await notify(o.payload);db.prepare("UPDATE autofill__commercial_payments SET status='refunding' WHERE id=?").run(o.pid);await notify({...o.payload,status:1});assert.equal(db.prepare('SELECT status FROM autofill__commercial_payments').get().status,'refunding');await notify(o.payload);assert.equal(db.prepare('SELECT status FROM autofill__commercial_payments').get().status,'refunding');db.close();
});
test('second successful payment for a fulfilled order is recorded without issuing another benefit',async()=>{
 const {db,order,notify}=setup(),o=order();await notify(o.payload);const merchant='BYP20260908'+'9'.repeat(12);db.prepare("INSERT INTO autofill__commercial_payments(id,order_id,merchant_order_no,amount_cents,pay_method,status) VALUES(?,?,?,100,'wx','pending')").run(crypto.randomUUID(),o.id,merchant);
 assert.equal((await notify({...o.payload,merchantOrderNo:merchant,orderId:'PAY_DUPLICATE_001'})).fulfillment,'duplicate_paid');assert.equal(db.prepare('SELECT count(*) AS n FROM autofill__license_codes').get().n,1);db.close();
});
function refund(db,o,n=1,flags=[1,1]){const refundNo='BYR20260908'+String(n).padStart(12,'0');db.prepare('INSERT INTO autofill__commercial_refunds(id,order_id,payment_id,refund_no,amount_cents,affects_order,affects_entitlement,reason,metadata) VALUES(?,?,?,?,100,?,?,?,?)').run(crypto.randomUUID(),o.id,o.pid,refundNo,...flags,'合成测试退款',JSON.stringify({prior_payment_status:flags[0]?'succeeded':'duplicate_succeeded'}));return {refundNo,providerRefundId:'REFUND_PROVIDER_'+n,providerOrderId:o.payload.orderId,providerStatus:2,amountCents:100,payloadHash:String(n).padStart(64,'0')};}
test('successful code refund revokes its activations exactly once and late status cannot undo it',async()=>{
 const {db,adapter,order,notify}=setup(),o=order();const paid=await notify(o.payload);db.prepare('INSERT INTO autofill__license_activations(license_id,install_hash,activation_token_hash) VALUES(?,?,?)').run(paid.licenseId,'a'.repeat(64),'b'.repeat(64));const r=refund(db,o);
 assert.equal((await applyRefundState(adapter,r)).orderStatus,'refunded');assert.equal(db.prepare('SELECT status FROM autofill__license_codes').get().status,'revoked');assert.ok(db.prepare('SELECT revoked_at FROM autofill__license_activations').get().revoked_at);
 const count=db.prepare('SELECT count(*) AS n FROM autofill__license_events').get().n;assert.equal((await applyRefundState(adapter,{...r,providerStatus:1})).replayed,true);assert.equal(db.prepare('SELECT count(*) AS n FROM autofill__license_events').get().n,count);db.close();
});
test('refund removes only its grant; the last refunded account grant revokes devices',async()=>{
 const {db,adapter,order,notify}=setup(),a=order(1,'account'),b=order(2,'account');await notify(a.payload);await notify(b.payload);
 const entitlement=db.prepare('SELECT id,valid_until FROM autofill__account_entitlements').get();db.prepare('INSERT INTO autofill__account_entitlement_devices(entitlement_id,user_id,install_hash,activation_token_hash) VALUES(?,?,?,?)').run(entitlement.id,subject,'a'.repeat(64),'b'.repeat(64));
 await applyRefundState(adapter,refund(db,a,1));const after=db.prepare('SELECT status,valid_until FROM autofill__account_entitlements').get();assert.equal(after.status,'active');assert.equal(after.valid_until,addDaysExact(entitlement.valid_until,-30));assert.equal(db.prepare('SELECT revoked_at FROM autofill__account_entitlement_devices').get().revoked_at,null);
 await applyRefundState(adapter,refund(db,b,2));assert.equal(db.prepare('SELECT status FROM autofill__account_entitlements').get().status,'refunded');assert.ok(db.prepare('SELECT revoked_at FROM autofill__account_entitlement_devices').get().revoked_at);assert.equal(db.prepare("SELECT count(*) AS n FROM autofill__account_entitlement_events WHERE event_type='account_refunded'").get().n,2);db.close();
});
test('duplicate-charge refunds preserve the original order and benefit; failed refunds restore prior status',async()=>{
 const {db,adapter,order,notify}=setup(),o=order();await notify(o.payload);const duplicate={...o,pid:crypto.randomUUID(),payload:{...o.payload,merchantOrderNo:'BYP20260908'+'9'.repeat(12),orderId:'PAY_DUPLICATE_002'}};
 db.prepare("INSERT INTO autofill__commercial_payments(id,order_id,merchant_order_no,amount_cents,pay_method,status) VALUES(?,?,?,100,'wx','pending')").run(duplicate.pid,o.id,duplicate.payload.merchantOrderNo);await notify(duplicate.payload);
 const r=refund(db,duplicate,9,[0,0]);assert.equal((await applyRefundState(adapter,{...r,providerStatus:3,errorMessage:'synthetic failure'})).paymentStatus,'duplicate_succeeded');assert.equal((await applyRefundState(adapter,r)).orderStatus,'fulfilled');assert.equal(db.prepare('SELECT status FROM autofill__license_codes').get().status,'active');db.close();
});
test('refund mismatch and mid-transaction failure leave order, entitlement and refund unchanged',async()=>{
 const {db,adapter,order,notify}=setup(),o=order(1,'account');await notify(o.payload);const r=refund(db,o);await assert.rejects(()=>applyRefundState(adapter,{...r,amountCents:101}),e=>e.status===409);
 db.exec("CREATE TRIGGER synthetic_refund_failure BEFORE INSERT ON autofill__account_entitlement_events WHEN NEW.event_type='account_refunded' BEGIN SELECT RAISE(ABORT,'fixture failure'); END;");await assert.rejects(()=>applyRefundState(adapter,r));assert.equal(db.prepare('SELECT status FROM autofill__commercial_refunds').get().status,'creating');assert.equal(db.prepare('SELECT status FROM autofill__commercial_orders').get().status,'fulfilled');assert.equal(db.prepare('SELECT status FROM autofill__account_entitlements').get().status,'active');db.close();
});
test('renewal-code refund reverses duration without revoking the original code activation',async()=>{
 const {db,adapter,order,notify}=setup(),o=order();const paid=await notify(o.payload),base=crypto.randomUUID();
 db.prepare("INSERT INTO autofill__license_codes(id,code_hash,code_hint,plan_id,duration_days,entitlement_expires_at,metadata) VALUES(?,?,?,'pro_30',30,?,?)").run(base,'f'.repeat(64),'BASE-SYNTHETIC','2030-04-01T00:00:00.654321Z','{"renewal_count":1,"large":9007199254740993}');db.prepare('INSERT INTO autofill__license_activations(license_id,install_hash,activation_token_hash) VALUES(?,?,?)').run(base,'a'.repeat(64),'b'.repeat(64));db.prepare('UPDATE autofill__license_codes SET metadata=? WHERE id=?').run(JSON.stringify({renewed_license_id:base}),paid.licenseId);
 await applyRefundState(adapter,refund(db,o));const code=db.prepare('SELECT status,entitlement_expires_at,metadata FROM autofill__license_codes WHERE id=?').get(base);assert.equal(code.status,'active');assert.equal(code.entitlement_expires_at,'2030-03-02T00:00:00.654321Z');assert.ok(code.metadata.includes('9007199254740993'));assert.equal(db.prepare('SELECT revoked_at FROM autofill__license_activations').get().revoked_at,null);db.close();
});
test('callback HTTP handler acknowledges only committed verified events and stays disabled in preview',async()=>{
 const {db,adapter,queries,order}=setup(),o=order(),worker=createSnapshotWorker();
 const env={CORE:adapter,MODE:'local',ALLOWED_ORIGINS:'http://127.0.0.1',BUSINESS_WRITES_ENABLED:'true',PAYMENT_PROCESSING_ENABLED:'false',JIANPAY_CLIENT_NO:client,JIANPAY_MERCHANT_KEY:key};
 const post=(signature=true)=>new Request('http://127.0.0.1/v1/payments/jianpay/notify',{method:'POST',headers:{'Content-Type':'application/json','X-Preview-Access':'synthetic-preview-key-for-tests-only'},body:JSON.stringify({...o.payload,sign:signature?signJianPayParams(o.payload,key):'0'.repeat(32)})});
 assert.equal((await worker.fetch(post(),env)).status,503);assert.equal(queries.length,0);env.PAYMENT_PROCESSING_ENABLED='true';assert.equal((await worker.fetch(post(false),env)).status,401);assert.equal(queries.length,0);
 const accepted=await worker.fetch(post(),env);assert.equal(accepted.status,200);assert.equal(await accepted.text(),'success');assert.equal(db.prepare('SELECT status FROM autofill__commercial_orders').get().status,'fulfilled');
 env.MODE='preview';env.PREVIEW_ACCESS_TOKEN='synthetic-preview-key-for-tests-only';assert.equal((await worker.fetch(post(),env)).status,503);db.close();
});

test('historical checkout HTTP requires its proof, hides private fields, and cannot create charges',async()=>{
 const {db,adapter,order,queries}=setup(),o=order();const token='SYNTHETIC_HISTORICAL_CHECKOUT_TOKEN_000001';const digest=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');db.prepare('UPDATE autofill__commercial_orders SET access_token_hash=?,note=? WHERE id=?').run(digest,'PRIVATE_CUSTOMER_NOTE',o.id);
 const worker=createSnapshotWorker(),env={CORE:adapter,MODE:'local',ALLOWED_ORIGINS:'http://127.0.0.1',BUSINESS_WRITES_ENABLED:'true',PAYMENT_PROCESSING_ENABLED:'false'};
 const call=body=>worker.fetch(new Request('http://127.0.0.1/v1/commercial-order',{method:'POST',headers:{Origin:'http://127.0.0.1','Content-Type':'application/json'},body:JSON.stringify(body)}),env);
 assert.equal((await call({action:'create'})).status,503);assert.equal(queries.length,0);
 const orderNo=db.prepare('SELECT order_no FROM autofill__commercial_orders WHERE id=?').get(o.id).order_no;
 assert.equal((await call({action:'status',orderNo,accessToken:'0'.repeat(43)})).status,404);
 const r=await call({action:'status',orderNo,accessToken:token});assert.equal(r.status,200);const text=await r.text();assert.ok(!text.includes(token));assert.ok(!text.includes('PRIVATE_CUSTOMER_NOTE'));assert.ok(!text.includes('contact_value'));assert.equal(JSON.parse(text).order.paymentAvailable,false);
 assert.equal((await call({action:'status',orderNo,accessToken:token,user_id:subject})).status,400);db.close();
});
