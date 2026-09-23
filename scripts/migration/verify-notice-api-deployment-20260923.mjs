import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const base = 'https://migration.seekoffer.com.cn';
const previousVersion = '51db5cb4-19ac-4957-834b-1d44d2bccbef';
const dir = path.resolve('artifacts/notice-api-deploy-20260923');
async function read(url) {
  const response = await fetch(url, {headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});
  const body = await response.json();
  return {response,body};
}
function metrics(response) {
  return {status:response.status,reads:Number(response.headers.get('x-d1-rows-read')),writes:Number(response.headers.get('x-d1-rows-written')),queries:Number(response.headers.get('x-d1-queries'))};
}
const first=await read(base+'/v1/public/notice-overrides');
assert.equal(first.response.status,200);
assert.ok(typeof first.body.version==='string'&&first.body.version.length>0);
assert.equal(first.body.items.length,100);
assert.ok(typeof first.body.nextCursor==='string'&&first.body.nextCursor.startsWith('notice_override:'));
assert.equal(metrics(first.response).writes,0);
const continuation=await read(base+'/v1/public/notice-overrides?version='+encodeURIComponent(first.body.version)+'&after='+encodeURIComponent(first.body.nextCursor));
assert.equal(continuation.response.status,200);
assert.equal(continuation.body.version,first.body.version);
assert.equal(continuation.body.items.length,100);
assert.equal(metrics(continuation.response).writes,0);
const warm=await read(base+'/v1/public/notice-overrides');
assert.equal(warm.response.status,200);
assert.deepEqual(warm.body,first.body);
assert.equal(metrics(warm.response).writes,0);
assert.ok(metrics(warm.response).reads<=8,JSON.stringify(metrics(warm.response)));
const stale=await read(base+'/v1/public/notice-overrides?version='+previousVersion);
assert.equal(stale.response.status,409);
assert.equal(stale.body.error,'NOTICE_VERSION_CHANGED');
assert.equal(metrics(stale.response).writes,0);
assert.ok(metrics(stale.response).reads<=4,JSON.stringify(metrics(stale.response)));
const health=await read(base+'/health');
assert.equal(health.response.status,200);
const result={at:new Date().toISOString(),state:'NOTICE_API_DEPLOYMENT_LIVE_VERIFIED',first:{...metrics(first.response),items:first.body.items.length,version:first.body.version,nextCursor:Boolean(first.body.nextCursor)},continuation:{...metrics(continuation.response),items:continuation.body.items.length},warm:{...metrics(warm.response),items:warm.body.items.length},stale:{...metrics(stale.response),error:stale.body.error},health:health.body};
fs.writeFileSync(path.join(dir,'live-verification.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
