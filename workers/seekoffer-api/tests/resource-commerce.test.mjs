import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';

const root = new URL('../../../',import.meta.url);
const out = new URL('artifacts/d1-migration/resource-commerce-test-bundle.mjs',root);
await build({entryPoints:[fileURLToPath(new URL('resource-commerce-entry.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',outfile:fileURLToPath(out),logLevel:'silent'});
const commerce = await import(out);

function adapterFor(db) {
  return {
    prepare(sql) {
      let args = [];
      const execute = () => ({success:true,results:db.prepare(sql).all(...args)});
      const statement = {
        bind(...values) { args = values; return statement; },
        async first() { return execute().results[0] || null; },
        async all() { return execute(); },
        async run() { return execute(); },
        execute
      };
      return statement;
    },
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const results = statements.map(statement => statement.execute());
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
  };
}

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON;');
  for (const file of ['0001_business.sql','0002_preview_runtime.sql','0003_payment_transactions.sql','0006_resource_commerce.sql','0007_resource_payment_qrcode.sql']) {
    db.exec(fs.readFileSync(new URL('../../../migrations/d1/snapshot/'+file,import.meta.url),'utf8'));
  }
  const env = {
    MODE:'local',
    BUSINESS_WRITES_ENABLED:'true',
    COMMERCE_LOCAL_PAYMENT_ENABLED:'true',
    COMMERCE_ORDER_IDEMPOTENCY_KEY:'synthetic-commerce-order-key-20261003',
    ALLOWED_ORIGINS:'http://127.0.0.1:3000'
  };
  return {db,adapter:adapterFor(db),env};
}

async function orderFixture() {
  const fixture = setup();
  const created = await commerce.createResourceOrder(fixture.adapter,{productSlug:'complete-application-kit',requestId:'synthetic-request-00000000000001',contactType:'email',contactValue:'buyer@example.invalid',consent:true},null,fixture.env);
  return {...fixture,created};
}

test('catalog exposes published products and never exposes storage object keys',async()=>{
  const {adapter}=setup();
  const result=await commerce.listResourceProducts(adapter);
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].currency,'CNY');
  assert.ok(result.items.every(item=>item.files.every(file=>!('objectKey' in file))));
  const detail=await commerce.readResourceProduct(adapter,'complete-application-kit');
  assert.equal(detail.product.slug,'complete-application-kit');
  assert.equal(detail.product.title,'寻鹿保研资料包');
  assert.equal(detail.product.files[0].filename,'使用说明.txt');
});

test('production cannot create the package order before price configuration is complete',async()=>{
  const {adapter,env}=setup();
  await assert.rejects(
    ()=>commerce.createResourceOrder(adapter,{productSlug:'complete-application-kit',requestId:'synthetic-request-pending-price',contactType:'email',contactValue:'buyer@example.invalid',consent:true},null,{...env,MODE:'production'}),
    error=>error.status===409 && error.message==='NEW_PURCHASES_DISABLED'
  );
});

test('order creation is idempotent and the access token is not included in the public order shape',async()=>{
  const {adapter}=setup();
  const input={productSlug:'complete-application-kit',requestId:'synthetic-request-00000000000002',contactType:'email',contactValue:'buyer@example.invalid',consent:true};
  const [first,second]=await Promise.all([commerce.createResourceOrder(adapter,input,null,{MODE:'local',BUSINESS_WRITES_ENABLED:'true',COMMERCE_LOCAL_PAYMENT_ENABLED:'true',COMMERCE_ORDER_IDEMPOTENCY_KEY:'synthetic-commerce-order-key-20261003'}),commerce.createResourceOrder(adapter,input,null,{MODE:'local',BUSINESS_WRITES_ENABLED:'true',COMMERCE_LOCAL_PAYMENT_ENABLED:'true',COMMERCE_ORDER_IDEMPOTENCY_KEY:'synthetic-commerce-order-key-20261003'})]);
  assert.equal(first.order.orderNo,second.order.orderNo);
  assert.equal(first.accessToken,second.accessToken);
  assert.equal((await adapter.prepare('SELECT count(*) AS n FROM commerce__orders').first()).n,1);
});

test('local payment, exactly-once fulfillment and controlled demo download work end to end',async()=>{
  const {db,adapter,created,env}=await orderFixture();
  const payment=await commerce.createResourcePayment(adapter,{orderNo:created.order.orderNo,accessToken:created.accessToken,owner:null,payMethod:'wx'},env,'http://127.0.0.1:3000');
  assert.equal(payment.order.payment.status,'pending');
  const paid=await commerce.simulateResourcePayment(adapter,{orderNo:created.order.orderNo,accessToken:created.accessToken,owner:null});
  assert.equal(paid.order.status,'fulfilled');
  const replay=await commerce.simulateResourcePayment(adapter,{orderNo:created.order.orderNo,accessToken:created.accessToken,owner:null});
  assert.equal(replay.order.status,'fulfilled');
  assert.equal(db.prepare('SELECT count(*) AS n FROM commerce__entitlements').get().n,1);
  const fileId=paid.order.delivery.files[0].id;
  const response=await commerce.downloadResourceFile(adapter,{fileId,accessToken:created.accessToken,owner:null},undefined,'local');
  assert.equal(response.status,200);
  assert.match(await response.text(),/本地演示资源/);
  assert.equal(db.prepare('SELECT count(*) AS n FROM commerce__download_events').get().n,1);
});

test('fulfilled external delivery returns a validated Baidu link and records the delivery event',async()=>{
  const {db,adapter,created,env}=await orderFixture();
  await commerce.createResourcePayment(adapter,{orderNo:created.order.orderNo,accessToken:created.accessToken,owner:null,payMethod:'wx'},env,'http://127.0.0.1:3000');
  const paid=await commerce.simulateResourcePayment(adapter,{orderNo:created.order.orderNo,accessToken:created.accessToken,owner:null});
  const fileId=paid.order.delivery.files[0].id;
  db.prepare("UPDATE commerce__product_files SET storage_provider='external_link',metadata=? WHERE id=?").run(JSON.stringify({url:'https://pan.baidu.com/s/test-package?pwd=test'}),fileId);
  const response=await commerce.downloadResourceFile(adapter,{fileId,accessToken:created.accessToken,owner:null},undefined,'production');
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{delivery:{type:'external_link',url:'https://pan.baidu.com/s/test-package?pwd=test'}});
  assert.equal(db.prepare('SELECT count(*) AS n FROM commerce__download_events').get().n,1);
  db.prepare("UPDATE commerce__product_files SET metadata=? WHERE id=?").run(JSON.stringify({url:'https://example.com/not-allowed'}),fileId);
  await assert.rejects(()=>commerce.downloadResourceFile(adapter,{fileId,accessToken:created.accessToken,owner:null},undefined,'production'),error=>error.status===503&&error.message==='RESOURCE_EXTERNAL_DELIVERY_NOT_CONFIGURED');
});

test('real JianPay checkout returns to the internal order delivery page',async()=>{
  const {adapter,created}=await orderFixture();
  let providerRequest;
  const result=await commerce.createResourcePayment(adapter,{orderNo:created.order.orderNo,accessToken:created.accessToken,owner:null,payMethod:'wx'},
    {MODE:'production',BUSINESS_WRITES_ENABLED:'true',PAYMENT_PROCESSING_ENABLED:'true',PAYMENT_CHECKOUT_ENABLED:'true',JIANPAY_CLIENT_NO:'JP_TEST001',JIANPAY_MERCHANT_KEY:'synthetic-payment-key-for-fixtures',COMMERCE_RETURN_ORIGIN:'https://www.seekoffer.com.cn'},
    'https://migration.seekoffer.com.cn',async(_url,init)=>{
      providerRequest=JSON.parse(String(init.body));
      return Response.json({code:1000,data:{clientNo:'JP_TEST001',orderId:'PAYMENT001',merchantOrderNo:providerRequest.orderNo,amount:providerRequest.amount,status:0,payMethod:'wx',payUrl:'https://jpay.hzjianban.com/#/pay?orderId=PAYMENT001',payQrcodeUrl:'https://jpay.hzjianban.com/open/payment/pay/cashier-qrcode?orderId=PAYMENT001',paidAt:null}});
    });
  const returnUrl=new URL(providerRequest.returnUrl);
  assert.equal(returnUrl.origin,'https://www.seekoffer.com.cn');
  assert.equal(returnUrl.pathname,'/resources/order-success');
  assert.equal(returnUrl.searchParams.get('order'),created.order.orderNo);
  assert.equal(returnUrl.searchParams.get('payment'),'return');
  assert.equal(result.order.payment.status,'pending');
  assert.equal(providerRequest.goodsName,'寻鹿保研资料包');
  assert.equal(result.order.payment.payQrcodeUrl,'https://jpay.hzjianban.com/open/payment/pay/cashier-qrcode?orderId=PAYMENT001');
});

test('a late successful callback on an expired order is held for review',async()=>{
  const {db,adapter,created,env}=await orderFixture();
  await commerce.createResourcePayment(adapter,{orderNo:created.order.orderNo,accessToken:created.accessToken,owner:null,payMethod:'wx'},env,'http://127.0.0.1:3000');
  const payment=await adapter.prepare('SELECT merchant_order_no,provider_order_id,amount_cents FROM commerce__payments WHERE order_id=(SELECT id FROM commerce__orders WHERE order_no=?)').bind(created.order.orderNo).first();
  db.prepare("UPDATE commerce__orders SET expires_at='2020-01-01T00:00:00.000000Z' WHERE order_no=?").run(created.order.orderNo);
  const payload={sign_type:'MD5',clientNo:'JP_TEST001',merchantOrderNo:payment.merchant_order_no,orderId:payment.provider_order_id,amount:payment.amount_cents,status:2,payMethod:'wx',paidAt:'2026-10-03 12:00:00'};
  payload.sign=commerce.signJianPayParams(payload,'synthetic-payment-key-for-fixtures');
  const result=await commerce.applyResourceJianPayNotification(adapter,payload,{clientNo:'JP_TEST001',merchantKey:'synthetic-payment-key-for-fixtures'});
  assert.equal(result.fulfillment,'needs_review');
  assert.equal((await adapter.prepare('SELECT status FROM commerce__orders WHERE order_no=?').bind(created.order.orderNo).first()).status,'expired');
  assert.equal((await adapter.prepare('SELECT status FROM commerce__payments WHERE merchant_order_no=?').bind(payment.merchant_order_no).first()).status,'needs_review');
  assert.equal(db.prepare('SELECT count(*) AS n FROM commerce__entitlements').get().n,0);
});

test('wrong amount and wrong access token cannot fulfill or download',async()=>{
  const {adapter,created,env}=await orderFixture();
  await commerce.createResourcePayment(adapter,{orderNo:created.order.orderNo,accessToken:created.accessToken,owner:null,payMethod:'wx'},env,'http://127.0.0.1:3000');
  const payment=await adapter.prepare('SELECT merchant_order_no,provider_order_id FROM commerce__payments WHERE order_id=(SELECT id FROM commerce__orders WHERE order_no=?)').bind(created.order.orderNo).first();
  await assert.rejects(()=>commerce.applyResourceJianPayNotification(adapter,{sign_type:'MD5',clientNo:'JP_TEST001',merchantOrderNo:payment.merchant_order_no,orderId:payment.provider_order_id,amount:100,status:2,payMethod:'wx',sign:'0'.repeat(32)},{clientNo:'JP_TEST001',merchantKey:'synthetic-payment-key-for-fixtures'}),error=>error.status===401);
  await assert.rejects(()=>commerce.readOrderForAccess(adapter,created.order.orderNo,'wrong-access-token-000000000000000000000000',null),error=>error.status===400||error.status===404);
  assert.equal((await adapter.prepare('SELECT status FROM commerce__orders WHERE order_no=?').bind(created.order.orderNo).first()).status,'pending');
});

test('verified JianPay callback fulfills an RCP payment and duplicate callback is harmless',async()=>{
  const {adapter,created,env}=await orderFixture();
  await commerce.createResourcePayment(adapter,{orderNo:created.order.orderNo,accessToken:created.accessToken,owner:null,payMethod:'wx'},env,'http://127.0.0.1:3000');
  const payment=await adapter.prepare('SELECT merchant_order_no,provider_order_id,amount_cents FROM commerce__payments WHERE order_id=(SELECT id FROM commerce__orders WHERE order_no=?)').bind(created.order.orderNo).first();
  const payload={sign_type:'MD5',clientNo:'JP_TEST001',merchantOrderNo:payment.merchant_order_no,orderId:payment.provider_order_id,amount:payment.amount_cents,status:2,payMethod:'wx',paidAt:'2026-10-03 12:00:00'};
  payload.sign=commerce.signJianPayParams(payload,'synthetic-payment-key-for-fixtures');
  const first=await commerce.applyResourceJianPayNotification(adapter,payload,{clientNo:'JP_TEST001',merchantKey:'synthetic-payment-key-for-fixtures'});
  const second=await commerce.applyResourceJianPayNotification(adapter,payload,{clientNo:'JP_TEST001',merchantKey:'synthetic-payment-key-for-fixtures'});
  assert.equal(first.fulfillment,'fulfilled');
  assert.equal(second.fulfillment,'already_fulfilled');
  assert.equal((await adapter.prepare('SELECT count(*) AS n FROM commerce__entitlements').first()).n,1);
});
