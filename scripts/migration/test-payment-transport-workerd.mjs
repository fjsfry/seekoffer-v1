import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { build } from '../../workers/seekoffer-api/node_modules/esbuild/lib/main.js';
import { Miniflare, convertV4MiniflareOptions, Log, LogLevel } from '../../workers/seekoffer-api/node_modules/miniflare/dist/src/index.js';

const baseline = process.argv.includes('--baseline');
const out = path.resolve('artifacts/d1-migration/payment-transport-workerd.mjs');
await build({ stdin: { contents: `import { queryJianPayPayment } from './workers/seekoffer-api/src/payments/jianpay.mjs';
export default { async fetch(request) { try {
 if(new URL(request.url).pathname==='/legacy') {
   try { new Request('https://synthetic.example.invalid/',{redirect:'error'}); return Response.json({legacyRedirectAccepted:true}); }
   catch(e) { return Response.json({error:/Invalid redirect value/.test(e.message)?'LEGACY_REDIRECT_MODE_REJECTED':'UNEXPECTED_RUNTIME_ERROR'},{status:503}); }
 }
 const value = await queryJianPayPayment({providerOrderId:'SYNTHETIC_PROVIDER_001',merchantOrderNo:'BYP20260910AAAAAAAAAAAA',amountCents:2900},{clientNo:'SYNTHETIC_MERCHANT',merchantKey:'SYNTHETIC_ONLY_KEY_NEVER_USED_EXTERNALLY'});
 return Response.json({status:value.status,amountCents:value.amountCents});
} catch(e) { return Response.json({error:e.code || 'UNEXPECTED_RUNTIME_ERROR'},{status:503}); } } };`, resolveDir: process.cwd() }, bundle: true, format: 'esm', platform: 'browser', external: ['node:*'], outfile: out, logLevel: 'silent' });
let mode = 'normal';
const requests = [];
const options = convertV4MiniflareOptions({ cf: false, modules: true, scriptPath: out, compatibilityDate: '2026-09-08', compatibilityFlags: ['nodejs_compat'], log: new Log(LogLevel.ERROR), outboundService: async request => {
  const url = new URL(request.url);
  requests.push({ origin: url.origin, path: url.pathname });
  assert.equal(url.origin, 'https://jpay.hzjianban.com');
  assert.equal(url.pathname, '/open/payment/pay/info');
  assert.equal(request.method, 'POST');
  const payload = await request.json();
  assert.equal(payload.clientNo, 'SYNTHETIC_MERCHANT');
  assert.match(payload.sign, /^[0-9a-f]{32}$/);
  assert.equal(payload.merchantKey, undefined);
  if (mode.startsWith('redirect-')) return new Response(null, { status: Number(mode.slice(9)), headers: { Location: 'https://untrusted.example.invalid/collect' } });
  if (mode === 'invalid-json') return new Response('synthetic invalid JSON');
  if (mode === 'large') return new Response('x'.repeat(65537));
  return Response.json({ code: 1000, data: { orderId: 'SYNTHETIC_PROVIDER_001', clientNo: 'SYNTHETIC_MERCHANT', merchantOrderNo: 'BYP20260910AAAAAAAAAAAA', amount: 2900, status: 0, payMethod: 'wx' } });
} });
options.telemetry = { enabled: false };
const mf = new Miniflare(options);
try {
  const call = async (route = '/') => { const response = await mf.dispatchFetch(`http://127.0.0.1${route}`); return { status: response.status, body: await response.json() }; };
  const legacy = await call('/legacy');
  assert.equal(legacy.body.error, 'LEGACY_REDIRECT_MODE_REJECTED');
  assert.equal(requests.length, 0);
  if (baseline) {
    console.log(JSON.stringify({ stage: 'PINNED_WORKERD_FAILURE_REPRODUCED', failure: legacy.body.error, outboundAttempts: 0, realProviderRequests: 0 }));
  } else {
    const normal = await call();
    assert.equal(normal.status, 200);
    assert.deepEqual(normal.body, { status: 0, amountCents: 2900 });
    for (const status of [301, 302, 303, 307, 308]) {
      mode = `redirect-${status}`;
      const before = requests.length, response = await call();
      assert.equal(response.body.error, 'provider_redirect_rejected');
      assert.equal(requests.length, before + 1, 'REDIRECT_MUST_NOT_FORWARD_PAYMENT_SIGNATURE');
    }
    mode = 'invalid-json'; assert.equal((await call()).body.error, 'provider_invalid_json');
    mode = 'large'; assert.equal((await call()).body.error, 'provider_response_too_large');
    const receipt = { at: new Date().toISOString(), layer: 'actual-local-workerd', compatibilityDate: '2026-09-08', signedRequestAccepted: true, redirectStatusesRejected: [301, 302, 303, 307, 308], invalidAndOversizedResponsesRejected: true, simulatedProviderRequests: requests.length, realProviderRequests: 0, databaseWrites: 0, paymentsEnabled: false };
    fs.writeFileSync('artifacts/d1-migration/payment-transport-workerd-verification.json', JSON.stringify(receipt, null, 2));
    console.log(JSON.stringify(receipt));
  }
} finally { await mf.dispose(); }
