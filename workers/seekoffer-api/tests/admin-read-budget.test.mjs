import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';

const root=new URL('../../../',import.meta.url);
const out=new URL('artifacts/d1-migration/admin-read-budget-tests.mjs',root);
await build({stdin:{contents:`export {adminAction} from './workers/seekoffer-api/src/admin.ts';
export {cachedAdminRead,adminNoticeStatistics} from './workers/seekoffer-api/src/admin-read-cache.ts';
export {readAnalytics} from './workers/seekoffer-api/src/analytics.ts';
export {createSnapshotWorker} from './workers/seekoffer-api/src/snapshot-worker.ts';`,resolveDir:fileURLToPath(root),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:fileURLToPath(out),logLevel:'silent'});
const {adminAction,cachedAdminRead,adminNoticeStatistics,readAnalytics,createSnapshotWorker}=await import(out);
const admin={email:'synthetic@example.invalid',name:'Synthetic admin',role:'super_admin',status:'active'};
const now=Date.parse('2026-10-06T03:00:00Z');

function adapter(db,queries){
 return{
  prepare(sql){
   let args=[];
   const execute=()=>{queries.push(sql);return{success:true,results:db.prepare(sql).all(...args),meta:{rows_read:1,rows_written:0}};};
   const statement={bind(...values){args=values;return statement;},async all(){return execute();},async run(){return execute();},async first(column){const row=execute().results[0];return column?row?.[column]??null:row??null;},execute};
   return statement;
  },
  async batch(statements){db.exec('BEGIN');try{const result=statements.map(s=>s.execute());db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}
 };
}
function setup(){
 const db=new DatabaseSync(':memory:'),queries=[];
 for(const file of ['0001_business.sql','0002_preview_runtime.sql'])db.exec(fs.readFileSync(new URL('migrations/d1/snapshot/'+file,root),'utf8'));
 const statement=db.prepare('INSERT INTO main__notices(id,school_name,project_name,project_type,created_at,admin_status,admin_deleted_at) VALUES(?,?,?,?,?,?,?)');
 statement.run('published','Synthetic university','Synthetic notice','pre','2026-10-06T02:00:00.000000Z','published',null);
 statement.run('pending','Synthetic university','Synthetic notice','pre','2026-10-05T17:00:00.000000Z','pending',null);
 statement.run('deleted','Synthetic university','Synthetic notice','pre','2026-10-04T02:00:00.000000Z','deleted','2026-10-05T03:00:00.000000Z');
 return{db,queries,core:adapter(db,queries)};
}
const noticeScan=sql=>/FROM main__notices GROUP BY admin_status/.test(sql);

test('one shared scan supplies notice totals, statuses and Beijing daily trends',async()=>{
 const {db,queries,core}=setup();
 const result=await adminNoticeStatistics(core,now);
 assert.deepEqual(result.counts,{deleted:1,pending:1,published:1});assert.equal(result.total,2);assert.equal(result.today,2);
 assert.equal(result.trends.find(d=>d.date==='10-06').notices,2);assert.equal(result.trends.find(d=>d.date==='10-04').notices,1);
 await adminNoticeStatistics(adapter(db,queries),now+1800000);
 assert.equal(queries.filter(noticeScan).length,1);
 await adminNoticeStatistics(core,now+3600001);assert.equal(queries.filter(noticeScan).length,2);db.close();
});

test('two dashboard callers and list polling for an hour scan notices only once',async()=>{
 const {db,queries,core}=setup(),original=Date.now;
 db.exec("WITH RECURSIVE fixture(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM fixture WHERE n<20000) INSERT INTO main__notices(id,school_name,project_name,project_type,created_at) SELECT 'load-'||n,'Synthetic university','Synthetic notice','pre','2026-10-01T00:00:00.000000Z' FROM fixture");
 try{
  for(let tick=0;tick<120;tick++){
   Date.now=()=>now+tick*30000;
   for(let client=0;client<2;client++)await adminAction(core,admin,{resource:'overview',action:'get'},false);
   const list=await adminAction(core,admin,{resource:'notices',action:'list',pageSize:5},false);
   assert.equal(list.total,20002);assert.equal(list.notices.length,5);
  }
  assert.equal(queries.filter(noticeScan).length,1);
  assert.equal(queries.filter(sql=>sql.includes('FROM main__notices')&&sql.includes('strftime')).length,0);
  assert.equal(queries.filter(sql=>sql.startsWith('SELECT count(*) AS n FROM main__notices')).length,0);
  assert.equal(queries.filter(sql=>sql.startsWith('SELECT count(*) AS total')&&sql.includes('main__applications')).length,1);
 }finally{Date.now=original;db.close();}
});

test('cached overview never authorizes a user, and moderation lists still read current rows',async()=>{
 const {db,queries,core}=setup();
 await adminAction(core,admin,{resource:'overview',action:'get'},false);
 queries.length=0;
 await assert.rejects(()=>adminAction(core,{...admin,role:'unknown'},{resource:'overview'},false),/ADMIN_PERMISSION_DENIED/);
 assert.equal(queries.length,0);
 await assert.rejects(()=>adminAction(core,{...admin,role:'readonly_admin'},{resource:'notices',action:'list'},false),/ADMIN_PERMISSION_DENIED/);
 db.prepare("UPDATE main__notices SET admin_status='hidden' WHERE id='published'").run();
 const result=await adminAction(core,admin,{resource:'notices',action:'list',filters:{status:'hidden'}},false);
 assert.equal(result.notices[0].admin_status,'hidden');assert.equal(result.total,1);db.close();
});

test('parallel refreshes share a lease and stale data; failed refreshes back off',async()=>{
 const {db,core}=setup();let loads=0,release;
 const gate=new Promise(resolve=>{release=resolve;});
 const first=cachedAdminRead(core,'concurrent',1000,async()=>{loads++;await gate;return{n:1};},now);
 await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(()=>cachedAdminRead(core,'concurrent',1000,async()=>{loads++;return{n:2};},now),/ADMIN_STATS_REFRESH_IN_PROGRESS/);
 release();await first;assert.equal(loads,1);
 assert.deepEqual(await cachedAdminRead(core,'concurrent',1000,async()=>{loads++;throw new Error('synthetic failure');},now+1001),{n:1});
 assert.deepEqual(await cachedAdminRead(core,'concurrent',1000,async()=>{loads++;return{n:2};},now+2000),{n:1});
 assert.equal(loads,2);db.close();
});

test('daily statistics expire at Beijing midnight instead of retaining yesterday today values',async()=>{
 const {db,core}=setup();let loads=0;
 const before=Date.parse('2026-10-06T15:59:59Z');
 await cachedAdminRead(core,'midnight',3600000,async()=>++loads,before);
 assert.equal(await cachedAdminRead(core,'midnight',3600000,async()=>++loads,before+1001),2);db.close();
});

test('analytics retains live counts but reads the lifetime visitor total only hourly',async()=>{
 const {db,queries,core}=setup();
 db.prepare("INSERT INTO _runtime_state(key,value) VALUES('analytics_started_at',?)").run('2026-10-01T00:00:00.000000Z');
 db.prepare('INSERT INTO main__site_visitors(visitor_id,first_seen_at,last_seen_at) VALUES(?,?,?)').run('synthetic','2026-10-01T00:00:00.000000Z','2026-10-06T02:59:00.000000Z');
 let result;
 for(let i=0;i<120;i++)result=await readAnalytics(core,{ANALYTICS_ENABLED:'true'},now+i*30000);
 assert.equal(result.metrics.totalVisitors,1);assert.equal(result.metrics.onlineVisitors,0);
 assert.equal(queries.filter(sql=>sql==='SELECT count(*) AS n FROM main__site_visitors').length,1);
 assert.equal((await readAnalytics(core,{ANALYTICS_ENABLED:'false'},now)).available,false);db.close();
});

test('quota backoff serves edge hits and repeated rejections do not postpone recovery',async()=>{
 const originalNow=Date.now,originalCaches=globalThis.caches;
 let clock=now,reads=0,entry=null;
 const core={prepare(){return{async all(){reads++;throw new Error('D1 daily row read limit exceeded');}};}};
 globalThis.caches={default:{async match(){return entry?.clone();},async put(){}}};Date.now=()=>clock;
 const worker=createSnapshotWorker(),env={CORE:core,MODE:'production',ALLOWED_ORIGINS:''};
 const request=()=>worker.fetch(new Request('https://migration.seekoffer.com.cn/v1/resources/products'),env);
 try{
  assert.equal((await request()).status,402);assert.equal(reads,1);
  entry=Response.json({items:[]});const hit=await request();assert.equal(hit.status,200);assert.equal(hit.headers.get('X-D1-Queries'),'0');
  entry=null;clock+=59000;assert.equal((await request()).headers.get('Retry-After'),'1');assert.equal(reads,1);
  clock+=1001;assert.equal((await request()).status,402);assert.equal(reads,2);
 }finally{Date.now=originalNow;globalThis.caches=originalCaches;}
});
