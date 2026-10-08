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
export {readAnalytics,recordPageview} from './workers/seekoffer-api/src/analytics.ts';
export {buildPageview,postPageview,analyticsResumeAt} from './lib/visitor-analytics.ts';
export {formatMetric,isStatisticsFresh} from './lib/admin-statistics.ts';
export {createSnapshotWorker} from './workers/seekoffer-api/src/snapshot-worker.ts';`,resolveDir:fileURLToPath(root),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:fileURLToPath(out),logLevel:'silent'});
const {adminAction,cachedAdminRead,adminNoticeStatistics,readAnalytics,recordPageview,buildPageview,postPageview,analyticsResumeAt,formatMetric,isStatisticsFresh,createSnapshotWorker}=await import(out);
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

const pageview = (overrides={}) => buildPageview({
 requestId:crypto.randomUUID(),visitorId:'v_1234567890abcdef',sessionId:'s_1234567890abcdef',
 path:'/resources/?order=private#secret',title:'Synthetic page',referrer:'https://example.invalid/path?secret=1',
 locale:'zh-CN',timezone:'Asia/Shanghai',...overrides
});
function setupAnalytics(){
 const fixture=setup();
 fixture.db.exec("CREATE TABLE _business_sequences(name TEXT PRIMARY KEY, next_value INTEGER NOT NULL); INSERT INTO _business_sequences VALUES('main__site_visit_events',106396)");
 return fixture;
}

test('the actual browser payload is accepted and increments real analytics atomically',async()=>{
 const {db,core}=setupAnalytics(),payload=pageview(),config={ANALYTICS_ENABLED:'true',ANALYTICS_EVENTS_PER_DAY:'300'};
 assert.equal(payload.path,'/resources/');assert.equal(payload.referrer,'https://example.invalid');
 const result=await postPageview('https://example.invalid/v1/analytics',payload,async(_url,init)=>{
  assert.equal(init.credentials,'omit');
  return Response.json(await recordPageview(core,JSON.parse(init.body),config,now));
 });
 assert.equal(result.ok,true);
 const stats=await readAnalytics(core,config,now);
 assert.equal(stats.metrics.todayPageViews,1);assert.equal(stats.metrics.todayVisitors,1);
 assert.equal(stats.metrics.onlineVisitors,1);assert.equal(stats.metrics.totalVisitors,1);
 assert.equal(stats.coverage.dailyAccepted,1);assert.equal(stats.generatedAt,new Date(now).toISOString());
 assert.equal(Date.parse(stats.lastReceivedAt),now);
 assert.equal(db.prepare('SELECT id FROM main__site_visit_events').get().id,106396);db.close();
});

test('idempotency and duplicate route views never double count and budgets still stop writes',async()=>{
 const {db,core}=setupAnalytics(),config={ANALYTICS_ENABLED:'true',ANALYTICS_EVENTS_PER_DAY:'1'},payload=pageview();
 await recordPageview(core,payload,config,now);
 assert.equal((await recordPageview(core,payload,config,now+1)).deduplicated,true);
 await assert.rejects(()=>recordPageview(core,{...payload,path:'/notices/'},config,now+1),/ANALYTICS_REQUEST_CONFLICT/);
 await assert.rejects(()=>recordPageview(core,pageview({path:'/notices/'}),config,now+1),/ANALYTICS_DAILY_BUDGET/);
 assert.equal(db.prepare('SELECT count(*) n FROM main__site_visit_events').get().n,1);
 assert.equal(db.prepare('SELECT page_view_count n FROM main__site_visitors').get().n,1);
 const stats=await readAnalytics(core,config,now+2);
 assert.equal(stats.coverage.budgetReached,true);
 assert.equal(stats.coverage.budgetResetsAt,'2026-10-07T00:00:00.000Z');db.close();
});

test('unsupported legacy payloads fail before any database access and optional strings are bounded',async()=>{
 const {db,core,queries}=setupAnalytics();
 await assert.rejects(()=>recordPageview(core,{...pageview(),requestId:undefined},{ANALYTICS_ENABLED:'true'},now),/INVALID_ANALYTICS_EVENT/);
 await assert.rejects(()=>recordPageview(core,{...pageview(),eventType:'heartbeat'},{ANALYTICS_ENABLED:'true'},now),/INVALID_ANALYTICS_EVENT/);
 assert.equal(queries.length,0);
 assert.equal(pageview({path:'/admin/dashboard'}),null);assert.equal(pageview({path:'//other.invalid'}),null);
 assert.equal(pageview({title:'x'.repeat(300),referrer:'invalid'}).title.length,180);
 assert.equal(pageview({referrer:'javascript:alert(1)'}).referrer,'');db.close();
});

test('route replays within 30 seconds are deduplicated, later real visits count again',async()=>{
 const {db,core}=setupAnalytics(),config={ANALYTICS_ENABLED:'true',ANALYTICS_EVENTS_PER_DAY:'300'};
 await recordPageview(core,pageview(),config,now);
 assert.equal((await recordPageview(core,pageview(),config,now+1000)).deduplicated,true);
 assert.equal((await recordPageview(core,pageview(),config,now+31000)).recorded,true);
 assert.equal(db.prepare('SELECT count(*) n FROM main__site_visit_events').get().n,2);
 assert.equal(db.prepare('SELECT page_view_count n FROM main__site_visitors').get().n,2);
 const plan=db.prepare('EXPLAIN QUERY PLAN SELECT 1 FROM main__site_visit_events WHERE visitor_id=? AND created_at>=? AND session_id=? AND path=?').all('v_1234567890abcdef','2026-10-06','s_1234567890abcdef','/resources/');
 assert.ok(plan.some(row=>row.detail.includes('main__site_visit_events_visitor_created_idx')));db.close();
});

test('an expired analytics snapshot is marked unavailable when its refresh fails',async()=>{
 const {db,core}=setupAnalytics(),config={ANALYTICS_ENABLED:'true'};
 await recordPageview(core,pageview(),config,now);
 await readAnalytics(core,config,now);
 const broken={...core,prepare(sql){if(sql.includes("key='analytics_started_at'"))throw new Error('synthetic outage');return core.prepare(sql);}};
 const stale=await readAnalytics(broken,config,now+180000);
 assert.equal(stale.available,false);assert.equal(stale.metrics.todayPageViews,1);
 assert.equal(stale.generatedAt,new Date(now).toISOString());db.close();
});

test('collector failures back off; unsuccessful responses are never treated as recorded',async()=>{
 assert.equal(analyticsResumeAt(402,'ANALYTICS_DAILY_BUDGET',null,now),Date.parse('2026-10-07T00:00:00Z'));
 assert.equal(analyticsResumeAt(503,'SERVICE_UNAVAILABLE','120',now),now+120000);
 assert.equal(analyticsResumeAt(400,'INVALID_ANALYTICS_EVENT',null,now),now+300000);
 for(const status of [400,402,429,503]) {
  const result=await postPageview('https://example.invalid',pageview(),async()=>Response.json({error:'synthetic'},{status}));
  assert.equal(result.ok,false);
 }
 assert.equal((await postPageview('https://example.invalid',pageview(),async()=>Response.json({}))).ok,false);
});

test('unknown statistics do not become zero and stale or previous-day snapshots are identified',()=>{
 assert.equal(formatMetric(null),'--');assert.equal(formatMetric(undefined),'--');assert.equal(formatMetric(NaN),'--');
 assert.equal(formatMetric(0),'0');assert.equal(formatMetric(12090),'12,090');
 assert.equal(isStatisticsFresh(new Date(now).toISOString(),60,now+59000),true);
 assert.equal(isStatisticsFresh(new Date(now).toISOString(),60,now+120000),false);
 assert.equal(isStatisticsFresh('2026-10-06T15:59:59Z',3600,Date.parse('2026-10-06T16:00:01Z')),false);
 assert.equal(isStatisticsFresh(undefined,60,now),false);
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
