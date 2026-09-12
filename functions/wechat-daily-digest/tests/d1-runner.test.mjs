import test from 'node:test';
import assert from 'node:assert/strict';
import {invokeD1Digest} from '../../../scripts/wechat-d1-runner.mjs';

test('existing brief command uses D1 without inherited provider or paid model credentials',async()=>{
 let received;
 await invokeD1Digest({dryRun:true},{env:{SUPABASE_URL:'synthetic',OPENAI_API_KEY:'synthetic',WECHAT_MP_APP_SECRET:'synthetic'},run:async options=>{received=options;return{ok:true};}});
 assert.equal(received.env.SEEKOFFER_DIGEST_BACKEND,'d1');
 assert.equal(received.env.OPENAI_API_KEY,'');
 assert.equal(received.env.SUPABASE_URL,undefined);assert.equal(received.env.WECHAT_MP_APP_SECRET,undefined);
});
test('publish is disabled before any network call; no automatic force replacement',async()=>{
 let calls=0;const run=async options=>{calls++;assert.equal(options.event.force,undefined);return{ok:true};};
 await assert.rejects(invokeD1Digest({targetDate:'2026-09-10'},{env:{},run}),/WECHAT_PUBLISH_NOT_ENABLED/);assert.equal(calls,0);
 await invokeD1Digest({targetDate:'2026-09-10'},{env:{SEEKOFFER_DIGEST_PUBLISH_ENABLED:'true'},run});assert.equal(calls,1);
});
test('provider failures cannot leak raw credentials or payloads',async()=>{
 await assert.rejects(invokeD1Digest({dryRun:true},{run:async()=>{throw Error('Authorization: synthetic-private-data');}}),e=>e.message==='D1_DIGEST_OPERATION_FAILED');
});
