import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { generateKeyPair, exportJWK, SignJWT } from '../../workers/seekoffer-api/node_modules/jose/dist/webapi/index.js';
import { build } from '../../workers/seekoffer-api/node_modules/esbuild/lib/main.js';
import { Miniflare, convertV4MiniflareOptions, Log, LogLevel } from '../../workers/seekoffer-api/node_modules/miniflare/dist/src/index.js';

const out = path.resolve('artifacts/d1-migration');
const a = '00000000-0000-4000-8000-000000000001', b = '00000000-0000-4000-8000-000000000002';
const app = '00000000-0000-4000-8000-000000000010';
const candidateMode = process.argv.includes('--candidate');
const candidateDir = path.resolve('artifacts/d1-worker-desktop-resume');
const scriptPath = candidateMode ? path.join(candidateDir,'acceptance-worker.js') : path.join(out,'workspace-resume-worker.mjs');
let candidateSha256;
if(candidateMode){
  candidateSha256=createHash('sha256').update(fs.readFileSync(scriptPath)).digest('hex');
  assert.equal(candidateSha256,JSON.parse(fs.readFileSync(path.join(candidateDir,'manifest.json'),'utf8')).candidateSha256);
}else await build({ stdin: { contents: `import {createSnapshotWorker} from './workers/seekoffer-api/src/snapshot-worker.ts'; import {ApiError} from './workers/seekoffer-api/src/auth.ts'; export default createSnapshotWorker(async token=>{if(!['user_a','user_b'].includes(token))throw new ApiError(401,'INVALID_IDENTITY'); return {issuer:'https://clerk.seekoffer.com.cn',subject:token};});`, resolveDir: process.cwd() }, bundle: true, format: 'esm', platform: 'browser', external: ['node:*'], outfile: scriptPath, logLevel: 'silent' });
await build({ stdin: { contents: `export {createApplicationWorkspace} from './lib/d1-application-workspace'; export {createD1BackendClient} from './lib/d1-backend-client';`, resolveDir: process.cwd() }, bundle: true, format: 'esm', platform: 'node', outfile: path.join(out, 'workspace-resume-client.mjs'), logLevel: 'silent' });
const { createApplicationWorkspace, createD1BackendClient } = await import(pathToFileURL(path.join(out, 'workspace-resume-client.mjs')));
const issuer='https://clerk.seekoffer.com.cn',origin='https://www.seekoffer.com.cn';
const keys=await generateKeyPair('RS256'),jwk={...await exportJWK(keys.publicKey),kid:'synthetic-resume-key',alg:'RS256',use:'sig'},signed=new Map();
for(const subject of ['user_a','user_b'])signed.set(subject,await new SignJWT({sid:'synthetic-session',azp:origin,sts:'active'}).setProtectedHeader({alg:'RS256',kid:jwk.kid}).setSubject(subject).setIssuer(issuer).setAudience('seekoffer').setIssuedAt().setExpirationTime('5m').sign(keys.privateKey));
let interceptedKeyRequests=0;
const options = convertV4MiniflareOptions({ cf: false, modules: true, scriptPath, compatibilityDate: '2026-09-08', compatibilityFlags: ['nodejs_compat'], d1Databases: { CORE: 'synthetic-workspace-resume' }, d1Persist: false, log: new Log(LogLevel.ERROR), bindings: { MODE: 'production', BUSINESS_WRITES_ENABLED: 'true', ALLOWED_ORIGINS: origin, PAYMENT_PROCESSING_ENABLED: 'false', INGEST_ENABLED: 'false',CLERK_ISSUER:issuer,CLERK_AUDIENCE:'seekoffer',AUTHORIZED_PARTIES:origin }, outboundService: request => {
  if(candidateMode&&request.url===issuer+'/.well-known/jwks.json'){interceptedKeyRequests++;return Response.json({keys:[jwk]});}
  throw Error('EXTERNAL_FETCH_FORBIDDEN');
} });
options.telemetry = { enabled: false };
const mf = new Miniflare(options);
const dispatch=(url,init={})=>{
  const headers=new Headers(init.headers),authorization=headers.get('Authorization');
  if(candidateMode&&authorization?.startsWith('Bearer ')&&signed.has(authorization.slice(7)))headers.set('Authorization','Bearer '+signed.get(authorization.slice(7)));
  return mf.dispatchFetch(url,{...init,headers});
};
try {
  const db = await mf.getD1Database('CORE');
  const parsed = spawnSync('python', ['-c', "import json,sqlite3,pathlib,sys\na=[];b=''\nfor p in sys.argv[1:]:\n for c in pathlib.Path(p).read_text('utf-8-sig'):\n  b+=c\n  if c==';' and sqlite3.complete_statement(b):a.append(b);b=''\nprint(json.dumps(a))", 'migrations/d1/snapshot/0001_business.sql', 'migrations/d1/snapshot/0002_preview_runtime.sql'], { windowsHide: true, encoding: 'utf8', maxBuffer: 1000000 });
  assert.equal(parsed.status, 0); const statements = JSON.parse(parsed.stdout);
  for (let i = 0; i < statements.length; i += 20) await db.batch(statements.slice(i, i + 20).map(s => db.prepare(s)));
  for (const [id, subject] of [[a, 'user_a'], [b, 'user_b']]) await db.batch([
    db.prepare('INSERT INTO main__auth_subjects(id,email_confirmed_at) VALUES(?,?)').bind(id, '2026-09-01'),
    db.prepare('INSERT INTO main__profiles(id) VALUES(?)').bind(id),
    db.prepare('INSERT INTO _identity_links VALUES(?,?,?,?)').bind('https://clerk.seekoffer.com.cn', subject, 'mnotoltpythkayguhnrk', id)
  ]);
  await db.prepare('INSERT INTO main__applications(id,user_id,project_id,my_notes) VALUES(?,?,?,?)').bind(app, a, 'synthetic-unavailable-notice', 'synthetic original').run();
  const url = 'https://migration.seekoffer.com.cn/v1/me/applications/' + app;
  const own = await dispatch(url, { headers: { Authorization: 'Bearer user_a' } });
  assert.equal(own.status, 200); const ownRow = await own.json();
  assert.equal(ownRow.id, app); assert.equal(ownRow.user_id, undefined);
  const readQueries = Number(own.headers.get('x-d1-queries')), readWrites = Number(own.headers.get('x-d1-rows-written'));
  assert.equal(readQueries, 2); assert.equal(readWrites, 0);
  assert.equal((await dispatch(url, { headers: { Authorization: 'Bearer user_b' } })).status, 404);
  assert.equal((await dispatch(url)).status, 401);
  assert.equal((await dispatch(url,{headers:{Authorization:'Bearer invalid'}})).status,401);
  assert.equal((await dispatch(url + '?user_id=' + b, { headers: { Authorization: 'Bearer user_a' } })).status, 400);
  let mode = 'normal'; const requests = [];
  const client = createD1BackendClient('https://migration.seekoffer.com.cn', async () => 'user_a', async (input, init) => {
    const pathname = new URL(input).pathname, method = init.method || 'GET'; requests.push({ pathname, method });
    if (mode === 'offline' && method === 'PUT') throw new TypeError('SYNTHETIC_OFFLINE');
    const response = await dispatch(String(input), init);
    if (mode === 'lost' && ['PUT', 'DELETE'].includes(method)) { assert.equal(response.status, 200); throw new TypeError('SYNTHETIC_RESPONSE_LOST'); }
    return response;
  });
  const values = new Map(), storage = { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v) };
  const ws = createApplicationWorkspace(a, storage, async () => client, () => true);
  await ws.read(); mode = 'lost'; await assert.rejects(ws.update(app, { my_notes: 'synthetic saved before response loss' }));
  mode = 'normal'; const putCount = requests.filter(r => r.method === 'PUT').length;
  assert.deepEqual(await ws.resumePending(), { completed: 1, remaining: 0 }); assert.equal(requests.filter(r => r.method === 'PUT').length, putCount);
  mode = 'offline'; await assert.rejects(ws.update(app, { my_notes: 'synthetic offline edit' })); mode = 'normal';
  assert.deepEqual(await ws.resumePending(), { completed: 1, remaining: 0 }); assert.equal(await db.prepare('SELECT my_notes FROM main__applications WHERE id=?').bind(app).first('my_notes'), 'synthetic offline edit');
  mode = 'offline'; await assert.rejects(ws.update(app, { my_notes: 'synthetic conflicting local edit' })); mode = 'normal';
  await db.prepare('UPDATE main__applications SET my_notes=?,sync_revision=sync_revision+1 WHERE id=?').bind('synthetic other device', app).run();
  await assert.rejects(ws.resumePending(), e => e.status === 409); assert.equal(await db.prepare('SELECT my_notes FROM main__applications WHERE id=?').bind(app).first('my_notes'), 'synthetic other device');
  // A fresh owner journal models an independent device, without editing any real cache.
  const second = new Map(), secondWs = createApplicationWorkspace(a, { getItem: k => second.get(k) || null, setItem: (k, v) => second.set(k, v) }, async () => client, () => true);
  await secondWs.read(); mode = 'lost'; await assert.rejects(secondWs.remove(app)); mode = 'normal';
  const deleteCount = requests.filter(r => r.method === 'DELETE').length;
  assert.deepEqual(await secondWs.resumePending(), { completed: 1, remaining: 0 }); assert.equal(secondWs.cached().length, 0); assert.equal(requests.filter(r => r.method === 'DELETE').length, deleteCount);
  assert.equal(ws.cached()[0].my_notes, 'synthetic conflicting local edit');
  assert.ok(requests.every(r => r.pathname.startsWith('/v1/me/applications')));
  if(candidateMode)assert.equal(interceptedKeyRequests,1);
  const receipt = { at: new Date().toISOString(), layer: 'actual-client-journal-to-local-workerd-D1',candidateMode,candidateSha256,realJWTVerification: candidateMode,interceptedKeyRequests, syntheticOnly: true, remoteWrites: 0, externalRequests: 0, singleApplicationReadQueries: readQueries, singleApplicationReadWrites: readWrites, anonymousRejected: true, otherOwnerNotFound: true, lostUpdateNotRepeated: true, lostDeleteNotRepeated: true, offlineEditResumed: true, otherDeviceChangesPreserved: true, entireNoticeCatalogRequested: false };
  fs.writeFileSync(path.join(out, candidateMode?'workspace-resume-candidate-verification.json':'workspace-resume-workerd-verification.json'), JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt));
} finally { await mf.dispose(); }
