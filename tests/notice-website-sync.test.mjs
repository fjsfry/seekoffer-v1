import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyNoticeWebsite, websiteFailureReport} from '../scripts/verify-notice-website-sync.mjs';
import {noticeSyncReceipt} from '../scripts/notice-sync-report.mjs';

const version='11111111-2222-4333-8444-555555555555', next='11111111-2222-4333-8444-666666666666';
const rows=Array.from({length:16},(_,i)=>({id:'xingke-'+i,publishDate:'2026-09-12',projectName:'合成通知'}));
function fixture(change=()=>{}) {
  const calls=[];
  const fetchImpl=async(url,options)=>{
    const u=new URL(url);calls.push({path:u.pathname,url,options});
    let data=u.pathname.includes('metadata')?{version,stats:{total2026:20}}:
      u.pathname.includes('notice-detail')?{id:rows[0].id}:
      {metadataVersion:version,items:rows,pagination:{total:20}};
    const r={data,status:200,reads:1,writes:0};change(r,u,calls);
    return new Response(JSON.stringify(r.data),{status:r.status,headers:{'content-type':'application/json','x-d1-rows-read':String(r.reads),'x-d1-rows-written':String(r.writes),'x-public-count-cache':'HIT',...r.headers}});
  };
  return {fetchImpl,calls,sleep:async()=>{}};
}
test('source version, live list, metadata, detail and bounded warm read all agree',async()=>{
  const f=fixture(),r=await verifyNoticeWebsite(f);assert.equal(r.state,'WEBSITE_SYNC_VERIFIED');assert.equal(r.total,20);assert.equal(r.detailChecked,true);
  assert.equal(f.calls.length,4);assert.equal(r.rowsRead,4);
  for(const c of f.calls){assert.equal(c.options.method,undefined);assert.deepEqual(c.options.headers,{Accept:'application/json'});assert.equal(c.options.redirect,'error');}
});
test('402 stops immediately without a retry loop or pretending the website is empty',async()=>{
  const f=fixture(r=>{r.status=402;r.data={error:'SERVICE_QUOTA_EXCEEDED'};});
  await assert.rejects(verifyNoticeWebsite(f),/HTTP_402/);assert.equal(f.calls.length,1);
});
test('repeated version changes cannot be accepted even when every response is 200',async()=>{
  const f=fixture((r,u,calls)=>{if(u.pathname==='/api/public/notices/'&&[4,8].includes(calls.length))r.data={...r.data,metadataVersion:next};});
  await assert.rejects(verifyNoticeWebsite(f),/PUBLIC_VERSION_CHANGED/);assert.equal(f.calls.length,8);
});
test('one concurrent version change retries once then verifies a consistent version',async()=>{
  const f=fixture((r,u,calls)=>{if(u.pathname==='/api/public/notices/'&&calls.length===4)r.data={...r.data,metadataVersion:next};});
  assert.equal((await verifyNoticeWebsite(f)).state,'WEBSITE_SYNC_VERIFIED');assert.equal(f.calls.length,8);
});
test('privacy, order, metadata, missing detail and repeated scans fail verification',async()=>{
  for(const [mutate,error] of [
    [(r,u)=>{if(u.pathname==='/api/public/notices/')r.data={...r.data,items:[{...rows[0],admin_review_note:'never log'},...rows.slice(1)]};},/FIELD_BOUNDARY/],
    [(r,u)=>{if(u.pathname==='/api/public/notices/')r.data={...r.data,items:[{...rows[0],publishDate:'2026-09-10'},...rows.slice(1)]};},/SORT/],
    [(r,u)=>{if(u.pathname.includes('metadata'))r.data={version,stats:{total2026:21}};},/METADATA/],
    [(r,u)=>{if(u.pathname.includes('notice-detail'))r.status=404;},/HTTP_404/],
    [(r,u,calls)=>{if(calls.length===4)r.reads=7000;},/WARM_READ_BOUND/],
    [(r)=>{r.writes=1;},/WRITE_DETECTED/]
  ]) await assert.rejects(verifyNoticeWebsite(fixture(mutate)),error);
});
test('an empty public result is explicit and never requests a detail or fabricates a date',async()=>{
  const f=fixture((r,u)=>{if(u.pathname==='/api/public/notices/')r.data={metadataVersion:version,items:[],pagination:{total:0}};if(u.pathname.includes('metadata'))r.data={version,stats:{total2026:0}};});
  const r=await verifyNoticeWebsite(f);assert.equal(r.total,0);assert.equal(r.detailChecked,false);assert.equal(r.latestDate,null);assert.equal(f.calls.length,3);
});
test('receipt excludes source details, credentials and user data, and retains partial status',()=>{
  const r=noticeSyncReceipt({destination:'d1.main__notices',complete:false,stoppedReason:'INGEST_DAILY_BUDGET',noticesUpserted:299,remainingCandidates:1886,secret:'private',sourceErrors:[{error:'private'}],notices:[{email:'private'}]});
  assert.equal(r.complete,false);assert.equal(r.remainingCandidates,1886);assert.equal(r.noticesUpserted,299);assert.ok(!JSON.stringify(r).includes('private'));
  assert.throws(()=>noticeSyncReceipt({rowsWritten:-1}),/INVALID_SYNC_RECEIPT/);
});

test('one transient list failure retries only that read, preserving full version and detail validation',async()=>{
  const delays=[];
  const f=fixture((r,u,calls)=>{if(calls.length===1){r.status=503;r.data={error:'temporarily unavailable'};}});
  const result=await verifyNoticeWebsite({...f,sleep:async ms=>delays.push(ms)});
  assert.equal(result.state,'WEBSITE_SYNC_VERIFIED');assert.equal(result.transientRetries,1);
  assert.equal(f.calls.length,5);assert.deepEqual(delays,[2000]);
  assert.equal(f.calls[0].url,f.calls[1].url);
  assert.equal(result.requests[0].status,503);assert.equal(result.requests[0].code,'WEBSITE_HTTP_503');
});

test('persistent 502/503/504 fail after at most two retries with the failing endpoint retained',async()=>{
  for(const status of [502,503,504]){
    const f=fixture(r=>{r.status=status;r.data={message:'private upstream details must not be logged'};});
    let failure;try{await verifyNoticeWebsite(f);}catch(error){failure=websiteFailureReport(error);}
    assert.equal(f.calls.length,3);assert.equal(failure.code,'WEBSITE_HTTP_'+status);
    assert.equal(failure.failedPath,'/api/public/notices/');assert.equal(failure.transientRetries,2);
    assert.equal(failure.requests.length,3);assert.ok(!JSON.stringify(failure).includes('private upstream'));
  }
});

test('all endpoints and a version restart share one transient retry budget',async()=>{
  const f=fixture((r,u,calls)=>{
    if([1,4,5].includes(calls.length))r.status=503;
    if(calls.length===3)r.status=409;
  });
  await assert.rejects(verifyNoticeWebsite(f),error=>{
    assert.equal(error.message,'WEBSITE_HTTP_503');assert.equal(error.verification.transientRetries,2);return true;
  });
  assert.equal(f.calls.length,5);
});

test('capacity growth and an unavailable legacy overlay do not affect the production serving check',async()=>{
  const f=fixture((r,u)=>{
    assert.equal(u.origin,'https://www.seekoffer.com.cn');
    assert.ok(!u.pathname.includes('notice-overrides'));
    if(u.pathname==='/api/public/notices/')r.data.pagination.total=50000;
    if(u.pathname.includes('metadata'))r.data.stats.total2026=50000;
  });
  const report=await verifyNoticeWebsite(f);
  assert.equal(report.total,50000);
  assert.equal(f.calls.length,4);
});

test('the version checked by live metadata rejects a consistently stale list',async()=>{
  const f=fixture((r,u)=>{
    if(u.pathname==='/api/public/notices/')r.data.metadataVersion=next;
    if(u.pathname.includes('metadata')){
      assert.equal(u.searchParams.get('version'),next);
      r.status=409;
    }
  });
  await assert.rejects(verifyNoticeWebsite(f),/WEBSITE_HTTP_409/);
  assert.equal(f.calls.length,4);
});

test('invalid versions, dates, duplicates and inconsistent warm content remain failures',async()=>{
  const scenarios=[
    [(r,u)=>{if(u.pathname==='/api/public/notices/')r.data.metadataVersion='snapshot';},/INVALID_SOURCE_VERSION/],
    [(r,u)=>{if(u.pathname==='/api/public/notices/')r.data.pagination.total=-1;},/INVALID_WEBSITE_PAGE/],
    [(r,u)=>{if(u.pathname==='/api/public/notices/')r.data.items=[rows[0],rows[0],...rows.slice(2)];},/WEBSITE_DUPLICATE_ID/],
    [(r,u)=>{if(u.pathname==='/api/public/notices/')r.data.items=[{...rows[0],publishDate:undefined},...rows.slice(1)];},/PUBLIC_SORT_OR_FIELD_BOUNDARY/],
    [(r,u,c)=>{if(c.length===4)r.data.items=[{...rows[0],id:'different-id'},...rows.slice(1)];},/WEBSITE_ITEMS_CHANGED_WITHOUT_VERSION/],
    [(r,u,c)=>{if(c.length===4)r.data.items=[{...rows[0],secret:'private'},...rows.slice(1)];},/PUBLIC_SORT_OR_FIELD_BOUNDARY/],
    [(r,u,c)=>{if(c.length===4)r.reads=-1;},/WEBSITE_WARM_READ_BOUND/]
  ];
  for(const [mutate,code] of scenarios)await assert.rejects(verifyNoticeWebsite(fixture(mutate)),code);
});

test('401/402/403/404/429 never retry or get downgraded to successful verification',async()=>{
  for(const status of [401,402,403,404,429]){
    const f=fixture(r=>{r.status=status;});
    await assert.rejects(verifyNoticeWebsite(f),new RegExp('HTTP_'+status));assert.equal(f.calls.length,1);
  }
});

test('transient network failures retry without logging raw exception details',async()=>{
  for(const makeError of [()=>new DOMException('private request details','TimeoutError'),()=>new TypeError('private request details',{cause:{code:'ECONNRESET'}})]){
    const f=fixture();let calls=0;
    const result=await verifyNoticeWebsite({...f,fetchImpl:async(...args)=>{if(++calls===1)throw makeError();return f.fetchImpl(...args);}});
    assert.equal(result.transientRetries,1);assert.equal(result.requests[0].status,null);
    assert.ok(!JSON.stringify(result).includes('private request details'));
  }
});

test('unknown fetch errors and invalid JSON fail without retrying or leaking response details',async()=>{
  for(const fetchImpl of [async()=>{throw new TypeError('private implementation detail');},async()=>new Response('private malformed response')]){
    let calls=0,failure;
    try{await verifyNoticeWebsite({fetchImpl:async(...args)=>{calls++;return fetchImpl(...args);},sleep:async()=>{}});}catch(error){failure=websiteFailureReport(error);}
    assert.equal(calls,1);assert.equal(failure.code,'READ_VERIFICATION_FAILED');
    assert.ok(!JSON.stringify(failure).includes('private'));
  }
});

test('Retry-After is respected within the wait budget, longer backoff remains a failure',async()=>{
  const delays=[],f=fixture((r,u,calls)=>{if(calls.length===1){r.status=503;r.headers={'retry-after':'4'};}});
  assert.equal((await verifyNoticeWebsite({...f,sleep:async ms=>delays.push(ms)})).state,'WEBSITE_SYNC_VERIFIED');
  assert.deepEqual(delays,[4000]);
  const long=fixture(r=>{r.status=503;r.headers={'retry-after':'120'};});
  await assert.rejects(verifyNoticeWebsite(long),/HTTP_503/);assert.equal(long.calls.length,1);
});

test('production 30-second Retry-After permits recovery past the 60-second index backoff',async()=>{
  const delays=[],f=fixture((r,u,calls)=>{
    if(calls.length<=2){r.status=503;r.headers={'retry-after':'30'};r.data={error:calls.length===1?'PUBLIC_DATABASE_READ_FAILED':'PUBLIC_REFRESH_BACKOFF',cause:'private internal details'};}
  });
  const result=await verifyNoticeWebsite({...f,sleep:async ms=>delays.push(ms)});
  assert.equal(result.state,'WEBSITE_SYNC_VERIFIED');assert.deepEqual(delays,[30000,30000]);
  assert.equal(f.calls.length,6);assert.equal(result.transientRetries,2);
  assert.equal(result.requests[0].retryAfterMs,30000);
  assert.equal(result.requests[1].sourceCode,'PUBLIC_REFRESH_BACKOFF');
  assert.ok(!JSON.stringify(result).includes('private internal details'));
});

test('known quota category stops even if an upstream incorrectly wraps it in 503',async()=>{
  const f=fixture(r=>{r.status=503;r.data={error:'PUBLIC_READ_QUOTA_EXCEEDED'};r.headers={'retry-after':'30'};});
  await assert.rejects(verifyNoticeWebsite(f),/HTTP_503/);assert.equal(f.calls.length,1);
});

test('a timeout while reading a body retries the same endpoint; exceeding a payload bound never does',async()=>{
  const f=fixture();let reads=0;
  const r=await verifyNoticeWebsite({...f,fetchImpl:async(...args)=>{
    if(++reads===1)return new Response(new ReadableStream({start(controller){controller.error(new DOMException('body timeout','TimeoutError'));}}));
    return f.fetchImpl(...args);
  }});
  assert.equal(r.transientRetries,1);assert.equal(reads,5);
  let oversized=0;
  await assert.rejects(verifyNoticeWebsite({fetchImpl:async()=>{oversized++;return new Response('x'.repeat(512001));},sleep:async()=>{}}),/WEBSITE_PAYLOAD_BOUND/);
  assert.equal(oversized,1);
});
