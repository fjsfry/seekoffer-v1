import test from 'node:test';
import assert from 'node:assert/strict';
import {probeD1} from '../scripts/d1-readiness-core.mjs';
import {ingestionShouldRetry} from '../scripts/notice-d1-transport.mjs';

const input={baseUrl:'https://migration.seekoffer.com.cn',secret:'synthetic-secret-0123456789abcdef'};
const budget={enabled:true,remaining:2400000,usedOrReserved:100000,limit:2500000,resetsAt:'2026-10-07T00:00:00.000Z',scope:'guarded-scans-only'};

test('readiness uses an authenticated uncached D1 probe, not cached product data',async()=>{
 const receipt=await probeD1({...input,fetcher:async(url,init)=>{
  assert.equal(url.pathname,'/v1/internal/d1-status');assert.equal(init.method,'POST');assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');assert.equal(init.headers['x-seekoffer-ingest-secret'],input.secret);
  return Response.json({available:true,probeRowsRead:1,probeRowsWritten:1,budget},{headers:{'X-D1-Rows-Read':'1'}});
 }});
 assert.equal(receipt.ready,true);assert.equal(receipt.rowsRead,'1');assert.ok(!JSON.stringify(receipt).includes(input.secret));
 const cachedProducts=await probeD1({...input,fetcher:async()=>Response.json({items:[]})});assert.equal(cachedProducts.ready,false);
 for(const probeRowsRead of [undefined,0]){const zero=await probeD1({...input,fetcher:async()=>Response.json({available:true,probeRowsRead,probeRowsWritten:1,budget})});assert.equal(zero.ready,false);}
 const readOnly=await probeD1({...input,fetcher:async()=>Response.json({available:true,probeRowsRead:1,budget})});assert.equal(readOnly.ready,false);
});

test('provider exhaustion and local protective budget are deferred without acquisition or retries',async()=>{
 const provider=await probeD1({...input,fetcher:async()=>Response.json({error:'SERVICE_QUOTA_EXCEEDED'},{status:402})});
 assert.equal(provider.ready,false);assert.equal(provider.deferred,true);assert.equal(provider.reason,'D1_SERVICE_QUOTA_EXCEEDED');
 const protectedBudget=await probeD1({...input,fetcher:async()=>Response.json({available:true,probeRowsRead:1,probeRowsWritten:1,budget:{...budget,remaining:1000}})});
 assert.equal(protectedBudget.reason,'D1_SCAN_BUDGET_EXHAUSTED');assert.equal(protectedBudget.deferred,true);
 assert.equal(ingestionShouldRetry(503,'READ_BUDGET_EXHAUSTED'),false);
});

test('bad credentials, unrelated failures and unexpected destinations fail closed',async()=>{
 for(const status of [401,403,500]){const receipt=await probeD1({...input,fetcher:async()=>Response.json({error:'OTHER_ERROR'},{status})});assert.equal(receipt.ready,false);assert.equal(receipt.deferred,false);}
 let calls=0;const fetcher=async()=>{calls++;return Response.json({});};
 await assert.rejects(()=>probeD1({...input,secret:'',fetcher}),/CREDENTIAL_MISSING/);
 await assert.rejects(()=>probeD1({...input,baseUrl:'https://untrusted.example',fetcher}),/ORIGIN_NOT_ALLOWED/);assert.equal(calls,0);
});
