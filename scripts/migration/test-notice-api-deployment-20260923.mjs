// Local integration test of the exact release artifact, with synthetic D1 only.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions,Log,LogLevel} from '../../workers/seekoffer-api/node_modules/miniflare/dist/src/index.js';
const dir=new URL('../../artifacts/notice-api-deploy-20260923/',import.meta.url);
const candidate=fs.readFileSync(new URL('candidate-acceptance-worker.js',dir));
const options=convertV4MiniflareOptions({cf:false,modules:true,script:candidate.toString(),compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],d1Databases:{CORE:'candidate-notice-api'},d1Persist:false,bindings:{MODE:'production',BUSINESS_WRITES_ENABLED:'true',OPERATIONS_WRITES_ENABLED:'true',PUBLIC_READ_ENABLED:'false',ALLOWED_ORIGINS:'https://migration.seekoffer.com.cn',INGEST_ENABLED:'true',SEEKOFFER_INGEST_SECRET:'synthetic-secret-for-local-test-only-20260923'},log:new Log(LogLevel.ERROR),outboundService:()=>{throw Error('EXTERNAL_NETWORK_FORBIDDEN');}});
options.telemetry={enabled:false};
const mf=new Miniflare(options);
try{
 const db=await mf.getD1Database('CORE');
 await db.prepare('CREATE TABLE _runtime_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
 const put=async(size,version)=>{await db.prepare('DELETE FROM _runtime_state').run();await db.batch([db.prepare("INSERT INTO _runtime_state(key,value) VALUES('notice_version',?),('notice_visibility_version',?)").bind(version,'visibility-'+version),db.prepare("WITH RECURSIVE seq(n) AS (SELECT 0 UNION ALL SELECT n+1 FROM seq WHERE n<?) INSERT INTO _runtime_state(key,value) SELECT 'notice_override:notice-'||printf('%05d',n),json_object('id','notice-'||printf('%05d',n),'visible',json('false')) FROM seq").bind(size-1)]);};
 const read=async(query='')=>{const r=await mf.dispatchFetch('https://migration.seekoffer.com.cn/v1/public/notice-overrides'+query);return {status:r.status,body:await r.json(),reads:Number(r.headers.get('x-d1-rows-read')),writes:Number(r.headers.get('x-d1-rows-written')),queries:Number(r.headers.get('x-d1-queries'))};};
 await put(4001,'version-4001');
 const first=await read();assert.equal(first.status,200);assert.equal(first.body.items.length,100);assert.equal(first.body.nextCursor,'notice_override:notice-00099');assert.equal(first.writes,0);assert.ok(first.reads<=120);
 const warm=await read();assert.deepEqual(warm.body,first.body);assert.equal(warm.writes,0);assert.ok(warm.reads<=8);
 const page2=await read('?version=version-4001&after='+encodeURIComponent(first.body.nextCursor));assert.equal(page2.status,200);assert.equal(page2.body.items[0].id,'notice-00100');assert.equal(page2.body.version,'version-4001');
 await put(20000,'version-20000');
 const stale=await read('?version=version-4001');assert.equal(stale.status,409);assert.equal(stale.body.error,'NOTICE_VERSION_CHANGED');assert.ok(stale.reads<=4);
 const large=await read();assert.equal(large.status,200);assert.equal(large.body.items.length,100);assert.equal(large.writes,0);assert.equal(large.reads,first.reads);
 const last=await read('?version=version-20000&after=notice_override%3Anotice-19899');assert.equal(last.status,200);assert.equal(last.body.items.length,100);assert.equal(last.body.items.at(-1).id,'notice-19999');assert.equal(last.body.nextCursor,null);
 const invalid=await read('?after=not-a-cursor');assert.equal(invalid.status,400);assert.equal(invalid.reads,0);
 const forbidden=await mf.dispatchFetch('https://migration.seekoffer.com.cn/v1/public/notice-overrides',{headers:{Origin:'https://untrusted.invalid'}});assert.equal(forbidden.status,403);
 const unauthorized=await mf.dispatchFetch('https://migration.seekoffer.com.cn/v1/internal/ingest-notices',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(unauthorized.status,401);assert.equal(unauthorized.headers.get('x-d1-rows-written'),'0');
 const account=await mf.dispatchFetch('https://migration.seekoffer.com.cn/v1/me/profile');assert.equal(account.status,401);assert.equal(account.headers.get('x-d1-rows-read'),'0');
 const health=await mf.dispatchFetch('https://migration.seekoffer.com.cn/health');assert.equal(health.status,200);assert.equal((await health.json()).mode,'production');
 const result={state:'EXACT_CANDIDATE_WORKERD_VERIFIED',candidateSha256:createHash('sha256').update(candidate).digest('hex'),catalogSizes:[4001,20000],coldRowsRead:first.reads,warmRowsRead:warm.reads,staleRowsRead:stale.reads,queries:first.queries,publicRowsWritten:0,authBoundariesVerified:true};
 fs.writeFileSync(new URL('candidate-verification.json',dir),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await mf.dispose();}
