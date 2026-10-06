import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';

const root=new URL('../../../',import.meta.url),out=new URL('artifacts/d1-migration/d1-read-budget-tests.mjs',root);
await build({stdin:{contents:`export * from './workers/seekoffer-api/src/d1-read-budget.ts';
export {noticeSql} from './workers/seekoffer-api/src/notice-sql.ts';
export {publicNoticePage} from './workers/seekoffer-api/src/public-notice-page.ts';
export {createSnapshotWorker} from './workers/seekoffer-api/src/snapshot-worker.ts';`,resolveDir:fileURLToPath(root),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:fileURLToPath(out),logLevel:'silent'});
const {createReadBudget,isBudgetedScan,readScanBudget,scanBudgetLimit,SCAN_RESERVATION,noticeSql,publicNoticePage,createSnapshotWorker}=await import(out);
const config={D1_READ_BUDGET_ENABLED:'true',D1_SCAN_ROWS_PER_DAY:'2500000'};
const sql='SELECT count(*) FROM main__notices';
const result=rows=>({success:true,results:[],meta:{rows_read:rows,rows_written:0}});
function fixture(limit='2500000'){
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE _runtime_state(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
 let failSettlement=false;const queries=[];
 const core={prepare(query){let values=[];const all=async()=>{
  queries.push(query);if(failSettlement&&query.startsWith('UPDATE _runtime_state'))throw new Error('synthetic settlement failure');
  return{...result(1),results:db.prepare(query).all(...values)};
 };const s={bind(...v){values=v;return s;},all,async first(column){const row=(await all()).results[0];return column?row?.[column]:row;}};return s;}};
 const policy={...config,D1_SCAN_ROWS_PER_DAY:limit};
 return{db,core,queries,policy,budget:()=>createReadBudget(core,policy),failSettlement:()=>{failSettlement=true;}};
}

test('large scans are guarded while indexed identity, owner and notice lookups are preserved',()=>{
 for(const query of [sql,'SELECT catalog_projection FROM main__notices n WHERE n.year=? ORDER BY n.publish_date DESC LIMIT ?','SELECT sum(created_at>=?) FROM main__applications','SELECT count(*) FROM main__site_visitors','SELECT count(*) FROM commerce__orders WHERE created_at>=?'])assert.equal(isBudgetedScan(query),true,query);
 for(const query of ['SELECT value FROM _runtime_state WHERE key=?','SELECT id FROM main__profiles WHERE id=?','SELECT * FROM main__notices n WHERE n.id=?','SELECT * FROM main__applications WHERE user_id=?','SELECT catalog_projection FROM main__notices WHERE school_name IN (?,?)','SELECT count(*) FROM main__site_visitors WHERE last_seen_at>=?','SELECT count(*) FROM main__site_visit_events WHERE created_at>=?','UPDATE main__notices SET admin_status=? WHERE id=?'])assert.equal(isBudgetedScan(query),false,query);
 assert.throws(()=>scanBudgetLimit({D1_SCAN_ROWS_PER_DAY:'5000000'}),/READ_BUDGET_NOT_CONFIGURED/);
});

test('600 cold searches cannot continue scanning after the shared daily budget is spent',async()=>{
 const f=fixture();let executions=0,rejected=0;
 for(let i=0;i<600;i++){
  try{await f.budget()([sql],async()=>{executions++;return[result(20000)];});}
  catch(error){assert.equal(error.message,'READ_BUDGET_EXHAUSTED');rejected++;}
 }
 const state=await readScanBudget(f.core,f.policy);
 assert.ok(rejected>0);assert.ok(executions*20000<2500000);assert.ok(state.usedOrReserved<=2500000);assert.equal(state.usedOrReserved,executions*20004);
 await f.budget()(['SELECT * FROM main__profiles WHERE id=?'],async()=>[result(1)]);
 assert.equal((await readScanBudget(f.core,f.policy)).usedOrReserved,state.usedOrReserved);f.db.close();
});

test('concurrent isolates reserve before execution and a batch is rejected before any SQL runs',async()=>{
 const f=fixture('100000');let release,started=0;
 const gate=new Promise(resolve=>{release=resolve;});
 const first=f.budget()([sql],async()=>{started++;await gate;return[result(10)];});
 await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(()=>f.budget()([sql],async()=>{started++;return[result(10)];}),/READ_BUDGET_EXHAUSTED/);
 release();await first;assert.equal(started,1);
 await assert.rejects(()=>f.budget()([sql,sql],async()=>{started++;return[result(1),result(1)];}),/READ_BUDGET_EXHAUSTED/);
 assert.equal(started,1);f.db.close();
});

test('failures and missing usage metadata retain reservations instead of allowing free retries',async()=>{
 const f=fixture('200000');
 await assert.rejects(()=>f.budget()([sql],async()=>{throw new Error('synthetic query failure');}),/synthetic query failure/);
 assert.equal((await readScanBudget(f.core,f.policy)).usedOrReserved,SCAN_RESERVATION);
 await f.budget()([sql],async()=>[{success:true,results:[]}]);
 assert.equal((await readScanBudget(f.core,f.policy)).usedOrReserved,200004);
 await assert.rejects(()=>f.budget()([sql],async()=>[result(1)]),/READ_BUDGET_EXHAUSTED/);f.db.close();
});

test('a lost settlement leaves the conservative reservation and larger scans debit their actual cost',async()=>{
 const f=fixture();f.failSettlement();await f.budget()([sql],async()=>[result(10)]);
 assert.equal((await readScanBudget(f.core,f.policy)).usedOrReserved,SCAN_RESERVATION);f.db.close();
 const g=fixture();await g.budget()([sql],async()=>[result(150000)]);
 assert.equal((await readScanBudget(g.core,g.policy)).usedOrReserved,150004);g.db.close();
});

test('budget reset uses UTC midnight, matching the Cloudflare daily window',async()=>{
 const f=fixture('100000'),original=Date.now;
 try{
  Date.now=()=>Date.parse('2026-10-06T23:59:59Z');await f.budget()([sql],async()=>[result(100000)]);
  await assert.rejects(()=>f.budget()([sql],async()=>[result(1)]),/READ_BUDGET_EXHAUSTED/);
  assert.equal((await readScanBudget(f.core,f.policy)).resetsAt,'2026-10-07T00:00:00.000Z');
  Date.now=()=>Date.parse('2026-10-07T00:00:00Z');await f.budget()([sql],async()=>[result(10)]);
  assert.equal((await readScanBudget(f.core,f.policy)).usedOrReserved,14);
 }finally{Date.now=original;f.db.close();}
});

test('equivalent notice filters share counts without folding distinct years or searches',()=>{
 assert.equal(noticeSql(new URLSearchParams('year=2026&status=全部&q=&page=1')).countKey,noticeSql(new URLSearchParams('page=2')).countKey);
 assert.equal(noticeSql(new URLSearchParams('q=CS&region=全部')).countKey,noticeSql(new URLSearchParams('q=cs')).countKey);
 assert.notEqual(noticeSql(new URLSearchParams('year=全部')).countKey,noticeSql(new URLSearchParams()).countKey);
});

test('the default public page reuses metadata totals instead of another full count scan',async()=>{
 const queries=[];
 const db={prepare(query){queries.push(query);const statement={bind(){return statement;},async first(){return'fixture-version';},async all(){return{results:[]};}};return statement;}};
 const cache=async(_db,_version,name,_now,load)=>{
  if(name==='metadata:global')return{value:{stats:{total2026:123},sideData:{},facets:{},expiresAt:Date.now()+10000},cache:'HIT'};
  return{...await load(),cache:'MISS'};
 };
 const page=await publicNoticePage(db,new URLSearchParams(),Date.now(),cache);
 assert.equal(page.body.pagination.total,123);assert.ok(!queries.some(q=>q.includes('count(*)')));
});

test('Worker enforces scan protection but still serves health and rejects unauthenticated admin access',async()=>{
 const f=fixture('100000');
 await f.budget()([sql],async()=>[result(100000)]);
 const worker=createSnapshotWorker(),env={CORE:f.core,MODE:'production',ALLOWED_ORIGINS:'',...f.policy};
 const health=await worker.fetch(new Request('https://migration.seekoffer.com.cn/health'),env);
 assert.equal(health.status,200);assert.equal((await health.json()).scanBudgetEnabled,true);
 const denied=await worker.fetch(new Request('https://migration.seekoffer.com.cn/v1/admin',{method:'POST',body:'{}'}),env);
 assert.equal(denied.status,401);f.db.close();
});

test('production enables the budget and deployment runs quota regressions first',()=>{
 const production=JSON.parse(fs.readFileSync(new URL('workers/seekoffer-api/wrangler.production.jsonc',root),'utf8'));
 assert.equal(production.vars.D1_READ_BUDGET_ENABLED,'true');assert.ok(scanBudgetLimit(production.vars)<=3000000);
 const pkg=JSON.parse(fs.readFileSync(new URL('workers/seekoffer-api/package.json',root),'utf8'));
 assert.match(pkg.scripts['predeploy:production'],/test:quota/);
});

test('order retrieval and payment callbacks remain outside discretionary scan budgets',async()=>{
 const f=fixture('100000');await f.budget()([sql],async()=>[result(100000)]);
 for(const query of ['SELECT * FROM commerce__orders WHERE order_no=?','SELECT * FROM commerce__payments WHERE merchant_order_no=? AND provider=?',"SELECT * FROM commerce__payments WHERE order_id=? AND status='pending' ORDER BY created_at DESC LIMIT 1"]){
  assert.equal(isBudgetedScan(query),false);await f.budget()([query],async()=>[result(1)]);
 }
 f.db.close();
});

test('readiness probe requires server credentials and cannot return cached health as D1 readiness',async()=>{
 const f=fixture(),worker=createSnapshotWorker(),secret='synthetic-ingest-key-0123456789abcdef';
 const env={CORE:f.core,MODE:'production',ALLOWED_ORIGINS:'https://www.seekoffer.com.cn',INGEST_ENABLED:'true',SEEKOFFER_INGEST_SECRET:secret,...f.policy};
 const url='https://migration.seekoffer.com.cn/v1/internal/d1-status';
 assert.equal((await worker.fetch(new Request(url,{method:'POST'}),env)).status,401);
 assert.equal(f.queries.length,0);
 const ok=await worker.fetch(new Request(url,{method:'POST',headers:{'x-seekoffer-ingest-secret':secret}}),env);
 assert.equal(ok.status,200);assert.equal(ok.headers.get('Cache-Control'),'no-store');assert.equal((await ok.json()).budget.limit,2500000);assert.equal(f.queries.length,1);
 const denied=await worker.fetch(new Request(url,{method:'POST',headers:{Origin:'https://www.seekoffer.com.cn','x-seekoffer-ingest-secret':secret}}),env);
 assert.equal(denied.status,403);f.db.close();
});

test('a cached profile must never override an explicit account ban',async()=>{
 const original=globalThis.caches;
 globalThis.caches={default:{async match(){return Response.json({nickname:'private stale profile'});}}};
 const core={prepare(){return{bind(){return this;},async all(){return{...result(1),results:[{id:'synthetic',moderation_status:'banned',email_confirmed_at:'2026-10-01'}]};}};}};
 try{
  const worker=createSnapshotWorker(async()=>({issuer:'https://clerk.seekoffer.com.cn',subject:'synthetic'}));
  const response=await worker.fetch(new Request('https://migration.seekoffer.com.cn/v1/me/profile',{headers:{Authorization:'Bearer synthetic'}}),{CORE:core,MODE:'production',ALLOWED_ORIGINS:'',...config});
  assert.equal(response.status,403);assert.equal((await response.json()).error,'ACCOUNT_BLOCKED');
 }finally{globalThis.caches=original;}
});
