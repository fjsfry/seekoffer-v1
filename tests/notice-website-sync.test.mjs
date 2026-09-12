import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyNoticeWebsite} from '../scripts/verify-notice-website-sync.mjs';
import {noticeSyncReceipt} from '../scripts/notice-sync-report.mjs';

const version='11111111-2222-4333-8444-555555555555', next='11111111-2222-4333-8444-666666666666';
const rows=Array.from({length:16},(_,i)=>({id:'xingke-'+i,publishDate:'2026-09-12',projectName:'合成通知'}));
function fixture(change=()=>{}) {
  const calls=[];
  const fetchImpl=async(url,options)=>{
    const u=new URL(url);calls.push({path:u.pathname,url,options});
    let data=u.pathname.endsWith('notice-overrides')?{version,items:[]}:
      u.pathname.includes('metadata')?{version,stats:{total2026:20}}:
      u.pathname.includes('notice-detail')?{id:rows[0].id}:
      {metadataVersion:version,items:rows,pagination:{total:20}};
    const r={data,status:200,reads:1,writes:0};change(r,u,calls);
    return new Response(JSON.stringify(r.data),{status:r.status,headers:{'content-type':'application/json','x-d1-rows-read':String(r.reads),'x-d1-rows-written':String(r.writes),'x-public-count-cache':'HIT'}});
  };
  return {fetchImpl,calls,sleep:async()=>{}};
}
test('source version, live list, metadata, detail and bounded warm read all agree',async()=>{
  const f=fixture(),r=await verifyNoticeWebsite(f);assert.equal(r.state,'WEBSITE_SYNC_VERIFIED');assert.equal(r.total,20);assert.equal(r.detailChecked,true);
  assert.equal(f.calls.length,6);assert.equal(r.rowsRead,6);
  for(const c of f.calls){assert.equal(c.options.method,undefined);assert.deepEqual(c.options.headers,{Accept:'application/json'});assert.equal(c.options.redirect,'error');}
});
test('402 stops immediately without a retry loop or pretending the website is empty',async()=>{
  const f=fixture(r=>{r.status=402;r.data={error:'SERVICE_QUOTA_EXCEEDED'};});
  await assert.rejects(verifyNoticeWebsite(f),/HTTP_402/);assert.equal(f.calls.length,1);
});
test('a stale website cannot be accepted even when every response is 200',async()=>{
  const f=fixture((r,u)=>{if(u.pathname==='/api/public/notices/')r.data={...r.data,metadataVersion:next};});
  await assert.rejects(verifyNoticeWebsite(f),/PUBLIC_VERSION_CHANGED/);assert.equal(f.calls.length,4);
});
test('one concurrent version change retries once then verifies a consistent version',async()=>{
  const f=fixture((r,u,calls)=>{if(calls.length===2)r.data={...r.data,metadataVersion:next};});
  assert.equal((await verifyNoticeWebsite(f)).state,'WEBSITE_SYNC_VERIFIED');assert.equal(f.calls.length,8);
});
test('privacy, order, metadata, missing detail and repeated scans fail verification',async()=>{
  for(const [mutate,error] of [
    [(r,u)=>{if(u.pathname==='/api/public/notices/')r.data={...r.data,items:[{...rows[0],admin_review_note:'never log'},...rows.slice(1)]};},/FIELD_BOUNDARY/],
    [(r,u)=>{if(u.pathname==='/api/public/notices/')r.data={...r.data,items:[{...rows[0],publishDate:'2026-09-10'},...rows.slice(1)]};},/SORT/],
    [(r,u)=>{if(u.pathname.includes('metadata'))r.data={version,stats:{total2026:21}};},/METADATA/],
    [(r,u)=>{if(u.pathname.includes('notice-detail'))r.status=404;},/HTTP_404/],
    [(r,u,calls)=>{if(calls.length===6)r.reads=7000;},/WARM_READ_BOUND/],
    [(r)=>{r.writes=1;},/WRITE_DETECTED/]
  ]) await assert.rejects(verifyNoticeWebsite(fixture(mutate)),error);
});
test('an empty public result is explicit and never requests a detail or fabricates a date',async()=>{
  const f=fixture((r,u)=>{if(u.pathname==='/api/public/notices/')r.data={metadataVersion:version,items:[],pagination:{total:0}};if(u.pathname.includes('metadata'))r.data={version,stats:{total2026:0}};});
  const r=await verifyNoticeWebsite(f);assert.equal(r.total,0);assert.equal(r.detailChecked,false);assert.equal(r.latestDate,null);assert.equal(f.calls.length,5);
});
test('receipt excludes source details, credentials and user data, and retains partial status',()=>{
  const r=noticeSyncReceipt({destination:'d1.main__notices',complete:false,stoppedReason:'INGEST_DAILY_BUDGET',noticesUpserted:299,remainingCandidates:1886,secret:'private',sourceErrors:[{error:'private'}],notices:[{email:'private'}]});
  assert.equal(r.complete,false);assert.equal(r.remainingCandidates,1886);assert.equal(r.noticesUpserted,299);assert.ok(!JSON.stringify(r).includes('private'));
  assert.throws(()=>noticeSyncReceipt({rowsWritten:-1}),/INVALID_SYNC_RECEIPT/);
});
