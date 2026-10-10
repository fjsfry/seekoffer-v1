import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';

const root = new URL('../../../',import.meta.url);
const out = new URL('artifacts/d1-migration/admin-observability-test-bundle.mjs',root);
await build({entryPoints:[fileURLToPath(new URL('admin-observability-entry.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',outfile:fileURLToPath(out),logLevel:'silent'});
const api = await import(out);

function adapterFor(db){
 return {prepare(sql){let args=[];const statement={bind(...values){args=values;return statement;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return{results:db.prepare(sql).all(...args)};},async run(){return{success:true,meta:{changes:db.prepare(sql).run(...args).changes}};}};return statement;},async batch(statements){db.exec('BEGIN');try{const results=statements.map(statement=>({results:db.prepare(statement.sql).all(...statement.args)}));db.exec('COMMIT');return results;}catch(error){db.exec('ROLLBACK');throw error;}}};
}

function setup(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON;');
 for(const file of ['0001_business.sql','0002_preview_runtime.sql','0003_payment_transactions.sql','0006_resource_commerce.sql','0007_resource_payment_qrcode.sql','0008_payment_monitor_indexes.sql','0014_admin_observability_indexes.sql'])db.exec(fs.readFileSync(new URL('../../../migrations/d1/snapshot/'+file,import.meta.url),'utf8'));
 return {db,adapter:adapterFor(db)};
}

function orderFixture(db,status='fulfilled'){
 const id='order-fixture-001',now='2026-10-10T01:00:00.000000Z',hash='a'.repeat(64),access='b'.repeat(64);
 db.prepare(`INSERT INTO commerce__orders(id,order_no,request_id_hash,access_token_hash,product_id,product_version,title_snapshot,amount_cents,currency,contact_type,contact_value,status,payment_provider,consent_at,expires_at,paid_at,fulfilled_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,'SO2026101012345678',hash,access,'resource_complete_application_kit_v1',1,'寻鹿保研资料包',990,'CNY','email','buyer@example.invalid',status,'jianpay',now,'2026-10-11T01:00:00.000000Z',now,now,now,now);
 db.prepare(`INSERT INTO commerce__payments(id,order_id,provider,merchant_order_no,provider_order_id,pay_method,amount_cents,currency,status,provider_status,request_hash,payload_hash,expires_at,paid_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('payment-fixture-001',id,'jianpay','RCP20261010123456789012','JIANPAY-001','wx',990,'CNY','succeeded',2,'c'.repeat(64),'d'.repeat(64),'2026-10-11T01:00:00.000000Z',now,now,now);
 db.prepare(`INSERT INTO commerce__payment_events(id,payment_id,order_id,source,event_type,provider_status,payload_hash,event_data,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).run('event-fixture-001','payment-fixture-001',id,'callback','payment_succeeded',2,'e'.repeat(64),'{}',now);
}

test('payment monitor returns every order row and an auditable event timeline',async()=>{
 const {db,adapter}=setup();orderFixture(db);const result=await api.readPaymentMonitor(adapter,{JIANPAY_CLIENT_NO:'client',JIANPAY_MERCHANT_KEY:'key'},{page:1,pageSize:20,windowDays:0});
 assert.equal(result.orderList.total,1);assert.equal(result.orderList.items[0].orderNo,'SO2026101012345678');assert.equal(result.orderList.items[0].payment.status,'succeeded');assert.equal(result.orderList.items[0].callbackCount,1);
 const detail=await api.readPaymentMonitorOrder(adapter,'SO2026101012345678');assert.equal(detail.events.length,1);assert.equal(detail.events[0].eventType,'payment_succeeded');db.close();
});

test('download monitor exposes real counters, daily trend, versions and paginated records',async()=>{
 const {db,adapter}=setup();
 for(const [id,version,date] of [['00000000-0000-4000-8000-000000000001','1.0.0','2026-10-10T01:00:00.000000Z'],['00000000-0000-4000-8000-000000000002','1.0.0','2026-10-09T01:00:00.000000Z']])db.prepare('INSERT INTO main__desktop_download_attempts(id,attempt_id,release_version,platform,source,created_at) VALUES(?,?,?,?,?,?)').run(date.endsWith('01:00:00.000000Z')&&id.endsWith('2')?2:1,id,version,'windows_x86_64','website_download_page',date);
 const result=await api.readDownloadMonitor(adapter,{DESKTOP_DOWNLOAD_TRACKING_ENABLED:'true',DESKTOP_PUBLIC_RELEASE_VERSION:'1.0.0'},{page:1,pageSize:20,windowDays:30});
 assert.equal(result.metrics.total,2);assert.equal(result.records.total,2);assert.equal(result.versions[0].version,'1.0.0');assert.equal(result.trend.some(row=>row.count===2),false);assert.equal(result.records.items.length,2);db.close();
});
