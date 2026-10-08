import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root=new URL('../../../',import.meta.url),out=new URL('artifacts/d1-migration/public-notice-resilience.mjs',root);
await build({stdin:{contents:`export {publicNoticePage} from './workers/seekoffer-api/src/public-notice-page.ts';export {createReadBudget} from './workers/seekoffer-api/src/d1-read-budget.ts';export * from './workers/seekoffer-api/src/notice-feed-query.ts';export {assertWorkbenchOwner} from './workers/seekoffer-api/src/workbench-compatibility.ts';`,resolveDir:fileURLToPath(root),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:fileURLToPath(out),logLevel:'silent'});
const {publicNoticePage,createReadBudget,noticeFeedSql,assertWorkbenchOwner}=await import(out);
function fixture(exhausted=false){
 const db=new DatabaseSync(':memory:'),now=Date.now(),queries=[];
 db.exec(`CREATE TABLE _runtime_state(key TEXT PRIMARY KEY,value TEXT NOT NULL);INSERT INTO _runtime_state VALUES('notice_version','v1');
 CREATE TABLE _notice_query_cache(cache_key TEXT PRIMARY KEY,data_version TEXT,expires_at INTEGER,lock_until INTEGER,result_json TEXT CHECK(result_json IS NULL OR length(result_json)<=131072));
 CREATE TABLE main__notices(id TEXT PRIMARY KEY,is_private INTEGER,admin_status TEXT,admin_deleted_at TEXT,catalog_projection TEXT,year INTEGER,publish_date TEXT,tags TEXT);`);
 db.exec(fs.readFileSync(new URL('migrations/d1/snapshot/0013_public_notice_feed.sql',root),'utf8'));
 for(let i=0;i<48;i++)db.prepare('INSERT INTO main__notices VALUES(?,0,\'published\',NULL,?,2026,\'2026-10-08\',\'[]\')').run('notice-'+i,JSON.stringify({summary:{id:'notice-'+i,projectName:'Engineering '+i,year:2026,publishDate:'2026-10-08',deadlineDate:'2026-12-31'},primary:'engineering '+i,sourceRank:i,rawStatus:'报名中'}));
 const key=createHash('sha256').update('public-sql-v1:public-metadata-v3:metadata:global').digest('hex');
 db.prepare('INSERT INTO _notice_query_cache VALUES(?,?,?,?,?)').run(key,'public-metadata-v3',now+3600000,0,JSON.stringify({stats:{total2026:48},sideData:{},facets:{},expiresAt:now+3600000}));
 if(exhausted)db.prepare('INSERT INTO _runtime_state VALUES(?,?)').run('d1_scan_budget:v1:'+new Date(now).toISOString().slice(0,10),'2500000');
 const raw={prepare(sql){let values=[];const all=async()=>{queries.push(sql);const results=db.prepare(sql).all(...values);return{results,success:true,meta:{rows_read:/FROM main__notices/.test(sql)?Math.max(results.length,1):1,rows_written:/^(INSERT|UPDATE|DELETE)/.test(sql)?1:0}};};const s={bind(...v){values=v;return s;},all,run:all,async first(column){const row=(await all()).results[0];return column?row?.[column]:row;}};return s;}};
 const budget=createReadBudget(raw,{D1_READ_BUDGET_ENABLED:'true',D1_SCAN_ROWS_PER_DAY:'1500000'});
 const core={prepare(sql){let values=[];const all=async()=>(await budget([sql],()=>raw.prepare(sql).bind(...values).all().then(result=>[result])))[0];const s={bind(...v){values=v;return s;},all,run:all,async first(column){const row=(await all()).results[0];return column?row?.[column]:row;}};return s;}};
 return{db,core,queries,now};
}

test('exact feed query uses its index without a temporary sort',()=>{
 const f=fixture();
 const plan=f.db.prepare('EXPLAIN QUERY PLAN '+noticeFeedSql(16,0)).all(2026).map(row=>row.detail).join('\n');
 assert.match(plan,/main__notices_public_feed_v3_idx/);assert.doesNotMatch(plan,/TEMP B-TREE/);f.db.close();
});

test('exhausted reporting allowance cannot block browsing or a bounded search',async()=>{
 const f=fixture(true);
 const first=await publicNoticePage(f.core,new URLSearchParams(),f.now);
 assert.equal(first.body.items.length,16);assert.equal(first.cache.rows,'MISS');
 const readQueries=f.queries.filter(sql=>sql.startsWith('SELECT catalog_projection FROM main__notices')).length;
 const second=await publicNoticePage(f.core,new URLSearchParams('year=2026&status=全部'),f.now+1);
 assert.equal(second.cache.rows,'HIT');assert.equal(f.queries.filter(sql=>sql.startsWith('SELECT catalog_projection FROM main__notices')).length,readQueries);
 const search=await publicNoticePage(f.core,new URLSearchParams('q=engineering'),f.now+2);
 assert.equal(search.body.items.length,16);assert.equal(search.body.pagination.total,48);
 const laterPage=await publicNoticePage(f.core,new URLSearchParams('q=engineering&page=2'),f.now+3);
 assert.equal(laterPage.cache.count,'HIT');assert.equal(laterPage.body.items[0].id,'notice-16');
 assert.equal(f.queries.filter(sql=>sql.startsWith('SELECT /* public-notice-search-v1 */')).length,1);
 const hydration=f.queries.find(sql=>sql.startsWith('SELECT n.id,'));
 const plan=f.db.prepare('EXPLAIN QUERY PLAN '+hydration).all(...Array.from({length:16},(_,i)=>'notice-'+i),2026,'engineering','engineering').map(row=>row.detail).join('\n');
 assert.match(plan,/USING INDEX sqlite_autoindex_main__notices_1/);assert.doesNotMatch(plan,/SCAN n/);
 assert.ok(!f.queries.some(sql=>sql.includes('count(*)')));f.db.close();
});

test('cached search IDs do not resurrect deleted or private notices',async()=>{
 const f=fixture();
 await publicNoticePage(f.core,new URLSearchParams('q=engineering'),f.now);
 f.db.exec("UPDATE main__notices SET admin_status='unpublished' WHERE id='notice-0';UPDATE main__notices SET is_private=1 WHERE id='notice-1';UPDATE _runtime_state SET value='v2' WHERE key='notice_version'");
 const page=await publicNoticePage(f.core,new URLSearchParams('q=engineering'),f.now+1);
 assert.equal(page.cache.count,'HIT');assert.ok(!page.body.items.some(item=>['notice-0','notice-1'].includes(item.id)));f.db.close();
});

test('normal page cache invalidates on moderation version changes',async()=>{
 const f=fixture();await publicNoticePage(f.core,new URLSearchParams(),f.now);
 f.db.exec("UPDATE main__notices SET admin_status='unpublished' WHERE id='notice-0';UPDATE _runtime_state SET value='v2' WHERE key='notice_version'");
 const page=await publicNoticePage(f.core,new URLSearchParams(),f.now+1);
 assert.equal(page.cache.rows,'MISS');assert.equal(page.body.items[0].id,'notice-1');
 assert.equal(f.db.prepare('SELECT count(*) n FROM _public_notice_cache').get().n,1);f.db.close();
});

test('expired aggregate metadata cannot force repeated search scans',async()=>{
 const f=fixture(true);f.db.exec('UPDATE _notice_query_cache SET expires_at=expires_at-7200000');
 const first=await publicNoticePage(f.core,new URLSearchParams('q=engineering'),f.now);
 const second=await publicNoticePage(f.core,new URLSearchParams('q=engineering&page=2'),f.now+1);
 assert.equal(first.body.metadataStale,true);assert.equal(second.cache.count,'HIT');
 assert.equal(f.queries.filter(sql=>sql.startsWith('SELECT /* public-notice-search-v1 */')).length,1);f.db.close();
});

test('search allowance is still enforced and essential browsing is isolated',async()=>{
 const f=fixture(true);
 f.db.prepare('INSERT INTO _runtime_state VALUES(?,?)').run('d1_search_budget:v1:'+new Date(f.now).toISOString().slice(0,10),'1000000');
 await assert.rejects(()=>publicNoticePage(f.core,new URLSearchParams('q=uncached'),f.now),/READ_BUDGET_EXHAUSTED/);
 assert.equal((await publicNoticePage(f.core,new URLSearchParams(),f.now+1)).body.items.length,16);f.db.close();
});

test('a queued workspace request cannot write into a different account after switching sessions',()=>{
 const request=owner=>new Request('https://example.test/v1/me/workbench',{headers:{'X-Workspace-Owner':owner}});
 assert.doesNotThrow(()=>assertWorkbenchOwner(request('owner-a'),'owner-a'));
 assert.throws(()=>assertWorkbenchOwner(request('owner-a'),'owner-b'),/WORKSPACE_OWNER_CHANGED/);
 assert.doesNotThrow(()=>assertWorkbenchOwner(new Request('https://example.test/v1/me/workbench'),'owner-a'));
});
