import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';

const root=new URL('../../../',import.meta.url);
const output=new URL('artifacts/d1-migration/fill-binding-runtime-tests.mjs',root);
await build({entryPoints:[fileURLToPath(new URL('fill-binding-entry.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',outfile:fileURLToPath(output),tsconfig:fileURLToPath(new URL('tsconfig.json',root)),logLevel:'silent'});
const {prepareFill,consumeFill,billingEntitlement,fillOwnerHash,createSnapshotWorker,FILL_AUTHORIZATION_URL}=await import(output);
const schema=fs.readFileSync(new URL('migrations/d1/snapshot/0001_business.sql',root),'utf8');
const runtime=fs.readFileSync(new URL('migrations/d1/snapshot/0002_preview_runtime.sql',root),'utf8');
const migration=fs.readFileSync(new URL('migrations/d1/snapshot/0016_bound_fill_grants.sql',root),'utf8');
const ownerA='00000000-0000-4000-8000-000000000001',ownerB='00000000-0000-4000-8000-000000000002';
const applicationA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',applicationB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const now=Date.now(),time=new Date(now).toISOString(),hashA=await fillOwnerHash(ownerA),hashB=await fillOwnerHash(ownerB);
function grant(overrides={}){return{protocol:'seekoffer-fill/v1',grantId:crypto.randomUUID(),userIdHash:hashA,applicationId:applicationA,fieldIds:['name','email'],issuedAt:time,expiresAt:new Date(now+300000).toISOString(),nonce:crypto.randomUUID(),...overrides};}
function setup({migrate=true}={}){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON;'+schema+runtime);
 for(const [owner,subject,application] of [[ownerA,'a',applicationA],[ownerB,'b',applicationB]]){
  db.prepare('INSERT INTO main__auth_subjects(id,email_confirmed_at) VALUES(?,?)').run(owner,time);
  db.prepare('INSERT INTO main__profiles(id) VALUES(?)').run(owner);
  db.prepare('INSERT INTO main__applications(id,user_id,project_id) VALUES(?,?,?)').run(application,owner,'synthetic-project-'+subject);
  db.prepare('INSERT INTO _identity_links VALUES(?,?,?,?)').run('https://clerk.example.invalid',subject,'mnotoltpythkayguhnrk',owner);
 }
 if(migrate)db.exec(migration);
 let beforeStatement=()=>{};
 const adapter={prepare(sql){let args=[];const execute=()=>{beforeStatement(sql);return {success:true,results:db.prepare(sql).all(...args)};};return{bind(...values){args=values;return this;},execute,async first(column){const result=execute().results[0]||null;return column?(result?.[column]??null):result;},async all(){return execute();},async run(){return execute();}};},async batch(statements){db.exec('BEGIN');try{const result=statements.map(statement=>statement.execute());db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}};
 const prepared=async(overrides={},owner=ownerA)=>{const bound=grant(overrides),requestId=crypto.randomUUID();const result=await prepareFill(adapter,owner,{action:'prepare-fill-session',requestId,grant:bound},()=>now);return{...result,requestId,grant:bound};};
 const payload=p=>({action:'consume-fill-session',token:p.authorization.token,requestId:p.requestId,grant:p.grant});
 const consume=(p,owner=ownerA,at=now)=>consumeFill(adapter,payload(p),()=>at,owner);
 const count=()=>db.prepare("SELECT count(*) AS count FROM main__billing_fill_sessions WHERE status='consumed'").get().count;
 const env={CORE:adapter,MODE:'local',ALLOWED_ORIGINS:'http://127.0.0.1:3000',BUSINESS_WRITES_ENABLED:'true'};
 const worker=createSnapshotWorker(async subject=>({issuer:'https://clerk.example.invalid',subject}));
 const request=(path,body,subject='a',extra={})=>worker.fetch(new Request('http://127.0.0.1'+path,{method:'POST',headers:{'Content-Type':'application/json',...(subject?{Authorization:'Bearer '+subject}:{}),...extra},body:JSON.stringify(body)}),env);
 return{db,adapter,prepared,payload,consume,count,request,env,setHook:hook=>{beforeStatement=hook;}};
}
const code=expected=>error=>error.message===expected;

test('real schema prepares an immutable five-minute grant and returns a complete account-bound receipt',async()=>{
 const s=setup();try{const p=await s.prepared({schoolId:'school-001',departmentId:'department-001'});assert.equal(p.authorization.verificationUrl,FILL_AUTHORIZATION_URL);assert.equal(p.authorization.expiresAt,p.grant.expiresAt);assert.equal(s.count(),0);
 const reordered={...p,grant:Object.fromEntries(Object.entries(p.grant).reverse())};const result=await s.consume(reordered);
 assert.equal(result.allowed,true);assert.equal(result.requestId,p.requestId);assert.deepEqual(result.grant,p.grant);for(const key of ['userIdHash','applicationId','grantId','nonce','expiresAt','fieldIds'])assert.deepEqual(result[key],p.grant[key]);assert.equal(result.fillUsage.used,1);assert.equal(s.count(),1);assert.ok(!JSON.stringify(result).includes(p.authorization.token));}finally{s.db.close();}
});

test('legacy field-count prepare and token-only consume fail without writes',async()=>{
 const s=setup();try{await assert.rejects(()=>prepareFill(s.adapter,ownerA,{action:'prepare-fill-session',requestId:crypto.randomUUID(),fieldCount:2},()=>now),code('UNSUPPORTED_BILLING_FIELD'));
 const p=await s.prepared();await assert.rejects(()=>consumeFill(s.adapter,{action:'consume-fill-session',token:p.authorization.token},()=>now),code('AUTH_REQUIRED'));await assert.rejects(()=>consumeFill(s.adapter,{action:'consume-fill-session',token:p.authorization.token},()=>now,ownerA));assert.equal(s.count(),0);}finally{s.db.close();}
});

test('wrong hash, foreign application and unknown application cannot prepare',async()=>{
 const s=setup();try{for(const patch of [{userIdHash:hashB},{applicationId:applicationB},{applicationId:crypto.randomUUID()}])await assert.rejects(()=>s.prepared(patch));assert.equal(s.db.prepare('SELECT count(*) AS n FROM main__billing_fill_sessions').get().n,0);}finally{s.db.close();}
});

for(const [label,patch] of [
 ['unknown field',{fieldIds:['password']}],['duplicate fields',{fieldIds:['name','name']}],['empty fields',{fieldIds:[]}],
 ['too many fields',{fieldIds:Array(11).fill('name')}],['value leakage',{fields:[{id:'name',value:'PRIVATE-SHOULD-NOT-CROSS'}]}],
 ['unknown protocol',{protocol:'seekoffer-fill/v2'}],['bad nonce',{nonce:'x'}],['bad optional identifier',{schoolId:'x'}],
 ['too long TTL',{expiresAt:new Date(now+300001).toISOString()}],['future issuance',{issuedAt:new Date(now+31000).toISOString()}],
 ['expired',{issuedAt:new Date(now-300000).toISOString(),expiresAt:time}],['noncanonical time',{issuedAt:new Date(now).toISOString().replace('.000Z','Z')+'invalid'}]
])test('grant validation rejects '+label+' without creating a session',async()=>{
 const s=setup();try{await assert.rejects(()=>s.prepared(patch));assert.equal(s.db.prepare('SELECT count(*) AS n FROM main__billing_fill_sessions').get().n,0);}finally{s.db.close();}
});

test('wrong authenticated account and modified grant/request cannot consume any quota',async()=>{
 const s=setup();try{const p=await s.prepared();await assert.rejects(()=>s.consume(p,ownerB),code('FILL_SESSION_ACCOUNT_MISMATCH'));
 await assert.rejects(()=>s.consume({...p,grant:{...p.grant,userIdHash:hashB,applicationId:applicationB}},ownerB),code('INVALID_FILL_SESSION'));
 for(const change of [{requestId:crypto.randomUUID()},{grant:{...p.grant,nonce:crypto.randomUUID()}},{grant:{...p.grant,fieldIds:['phone']}},{grant:{...p.grant,applicationId:applicationB}}])await assert.rejects(()=>s.consume({...p,...change}));assert.equal(s.count(),0);assert.equal((await s.consume(p)).allowed,true);}finally{s.db.close();}
});

test('duplicate request, grant or nonce never rotates authorization',async()=>{
 const s=setup();try{const p=await s.prepared();const original=s.db.prepare('SELECT token_hash,bound_grant FROM main__billing_fill_sessions').get();await assert.rejects(()=>prepareFill(s.adapter,ownerA,{action:'prepare-fill-session',requestId:p.requestId,grant:{...p.grant,nonce:crypto.randomUUID()}},()=>now),code('FILL_REQUEST_CONFLICT'));
 await assert.rejects(()=>s.prepared({grantId:p.grant.grantId}),code('FILL_REQUEST_CONFLICT'));await assert.rejects(()=>s.prepared({nonce:p.grant.nonce}),code('FILL_REQUEST_CONFLICT'));assert.deepEqual(s.db.prepare('SELECT token_hash,bound_grant FROM main__billing_fill_sessions').get(),original);assert.equal((await s.consume(p)).allowed,true);}finally{s.db.close();}
});

test('the database rejects binding mutation and consumed-state reactivation',async()=>{
 const s=setup();try{const p=await s.prepared();for(const [column,value] of [['request_id',crypto.randomUUID()],['user_id',ownerB],['token_hash','a'.repeat(64)],['field_count',1],['expires_at','2099-01-01'],['bound_grant',JSON.stringify({...p.grant,nonce:crypto.randomUUID()})]])assert.throws(()=>s.db.prepare('UPDATE main__billing_fill_sessions SET '+column+'=?').run(value),/FILL_SESSION_BINDING_IMMUTABLE/);
 await s.consume(p);assert.throws(()=>s.db.prepare("UPDATE main__billing_fill_sessions SET status='prepared'").run(),/FILL_SESSION_TERMINAL/);}finally{s.db.close();}
});

test('concurrent same-token consumption succeeds exactly once and replay is rejected',async()=>{
 const s=setup();try{const p=await s.prepared();const results=await Promise.allSettled([s.consume(p),s.consume(p),s.consume(p)]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(s.count(),1);for(const result of results.filter(result=>result.status==='rejected'))assert.equal(result.reason.message,'FILL_SESSION_ALREADY_CONSUMED');await assert.rejects(()=>s.consume(p),code('FILL_SESSION_ALREADY_CONSUMED'));}finally{s.db.close();}
});

test('concurrent distinct grants cannot exceed the monthly three-use free quota',async()=>{
 const s=setup();try{const prepared=await Promise.all(Array.from({length:7},()=>s.prepared()));const results=await Promise.allSettled(prepared.map(p=>s.consume(p)));assert.equal(results.filter(result=>result.status==='fulfilled').length,3);assert.equal(s.count(),3);for(const result of results.filter(result=>result.status==='rejected'))assert.equal(result.reason.message,'FILL_LIMIT_REACHED');}finally{s.db.close();}
});

test('prepare rate guard permits at most ten concurrent new requests in a minute',async()=>{
 const s=setup();try{const results=await Promise.allSettled(Array.from({length:14},()=>s.prepared()));assert.equal(results.filter(result=>result.status==='fulfilled').length,10);assert.equal(s.count(),0);}finally{s.db.close();}
});

test('consume rechecks expiry, Pro downgrade and current account/application ownership',async()=>{
 const s=setup();try{const p=await s.prepared();await assert.rejects(()=>s.consume(p,ownerA,now+300000),code('FILL_SESSION_EXPIRED'));assert.equal(s.count(),0);
 s.db.prepare("INSERT INTO main__user_entitlements(user_id,status) VALUES(?,'active')").run(ownerA);const prepared=await Promise.all(Array.from({length:5},()=>s.prepared()));s.db.prepare("UPDATE main__user_entitlements SET status='cancelled' WHERE user_id=?").run(ownerA);const results=await Promise.allSettled(prepared.map(p=>s.consume(p)));assert.equal(results.filter(result=>result.status==='fulfilled').length,3);assert.equal(s.count(),3);}finally{s.db.close();}
});

for(const kind of ['ban','application removal'])test('atomic consume rejects '+kind+' between preliminary checks and the CAS',async()=>{
 const s=setup();try{const p=await s.prepared();s.setHook(sql=>{if(!sql.startsWith('UPDATE main__billing_fill_sessions AS s'))return;s.setHook(()=>{});if(kind==='ban')s.db.prepare('UPDATE main__auth_subjects SET banned_until=? WHERE id=?').run('2099-01-01',ownerA);else s.db.prepare('DELETE FROM main__applications WHERE id=?').run(applicationA);});await assert.rejects(()=>s.consume(p));assert.equal(s.count(),0);assert.equal(s.db.prepare('SELECT status FROM main__billing_fill_sessions').get().status,'prepared');}finally{s.db.close();}
});

test('SQL failure leaves the grant prepared with zero usage and no receipt',async()=>{
 const s=setup();try{const p=await s.prepared();s.db.exec("CREATE TRIGGER fail_consumption BEFORE UPDATE ON main__billing_fill_sessions WHEN NEW.status='consumed' BEGIN SELECT RAISE(ABORT,'synthetic storage failure'); END;");await assert.rejects(()=>s.consume(p));assert.equal(s.count(),0);assert.equal(s.db.prepare('SELECT status FROM main__billing_fill_sessions').get().status,'prepared');}finally{s.db.close();}
});

test('additive migration preserves historical quota while refusing unbound old tokens',async()=>{
 const s=setup({migrate:false});try{const p={requestId:crypto.randomUUID(),grant:grant(),authorization:{token:'y'.repeat(43)}};const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p.authorization.token))).toString('hex');s.db.prepare("INSERT INTO main__billing_fill_sessions(user_id,request_id,token_hash,field_count,status,tier,expires_at,consumed_at) VALUES(?,?,?,2,'consumed','free',?,?)").run(ownerA,crypto.randomUUID(),'a'.repeat(64),p.grant.expiresAt,time);s.db.prepare('INSERT INTO main__billing_fill_sessions(user_id,request_id,token_hash,field_count,expires_at) VALUES(?,?,?,2,?)').run(ownerA,p.requestId,hash,p.grant.expiresAt);
 s.db.exec(migration);assert.equal(s.count(),1);await assert.rejects(()=>s.consume(p),code('FILL_SESSION_BOUND_GRANT_REQUIRED'));
 assert.throws(()=>s.db.prepare("UPDATE main__billing_fill_sessions SET status='consumed',consumed_at=? WHERE request_id=?").run(time,p.requestId),/FILL_SESSION_TERMINAL/);
 assert.equal(s.count(),1);assert.equal(s.db.prepare('SELECT status FROM main__billing_fill_sessions WHERE request_id=?').get(p.requestId).status,'prepared');
 const next=await s.prepared();assert.equal((await s.consume(next)).fillUsage.used,2);assert.equal(s.db.prepare('SELECT count(*) AS n FROM main__billing_fill_sessions').get().n,3);}finally{s.db.close();}
});

test('worker requires authenticated bound requests; public token-only path performs no writes',async()=>{
 const s=setup();try{const p=await s.prepared();assert.equal((await s.request('/v1/billing/consume',{token:p.authorization.token},null)).status,401);assert.equal((await s.request('/v1/me/billing',s.payload(p),null)).status,401);assert.equal((await s.request('/v1/me/billing',s.payload(p),'b')).status,403);assert.equal(s.count(),0);
 const response=await s.request('/v1/me/billing',s.payload(p));assert.equal(response.status,200);assert.deepEqual((await response.json()).grant,p.grant);assert.equal((await s.request('/v1/me/billing',s.payload(p))).status,409);assert.equal(s.count(),1);}finally{s.db.close();}
});

test('production fill maintenance works before migration without blocking entitlement reads',async()=>{
 const s=setup({migrate:false});try{
  s.env.MODE='production';
  const payload={action:'prepare-fill-session',requestId:crypto.randomUUID(),grant:grant()};
  let writes=0;s.setHook(sql=>{if(/^(INSERT|UPDATE|DELETE)/.test(sql))writes++;});
  for(const setting of [undefined,'false','TRUE','1']){
   if(setting===undefined)delete s.env.FILL_SESSION_WRITES_ENABLED;else s.env.FILL_SESSION_WRITES_ENABLED=setting;
   for(const action of ['prepare-fill-session','consume-fill-session']){
    const response=await s.request('/v1/me/billing',{...payload,action});
    assert.equal(response.status,503);assert.equal((await response.json()).error,'FILL_AUTHORIZATION_MAINTENANCE');
   }
  }
  assert.equal(writes,0);
  assert.equal((await s.request('/v1/me/billing',{action:'get-entitlement'})).status,200);
  assert.equal((await s.request('/v1/me/billing',{action:'list-orders'})).status,200);
  assert.equal((await s.request('/v1/billing/consume',{token:'y'.repeat(43)},null)).status,401);
  s.db.exec(migration);s.env.FILL_SESSION_WRITES_ENABLED='true';
  const response=await s.request('/v1/me/billing',payload);assert.equal(response.status,200);
  const authorization=(await response.json()).authorization;
  s.env.FILL_SESSION_WRITES_ENABLED='false';
  assert.equal((await s.request('/v1/me/billing',{...payload,action:'consume-fill-session',token:authorization.token})).status,503);
  assert.equal(s.count(),0);
  s.env.FILL_SESSION_WRITES_ENABLED='true';
  assert.equal((await s.request('/v1/me/billing',{...payload,action:'consume-fill-session',token:authorization.token})).status,200);
  assert.equal(s.count(),1);
 }finally{s.db.close();}
});

test('successful consumption returns its receipt even when any subsequent SELECT would fail',async()=>{
 const s=setup();try{
  const p=await s.prepared();let consumed=false;
  s.setHook(sql=>{if(sql.startsWith('UPDATE main__billing_fill_sessions AS s'))consumed=true;else if(consumed&&sql.startsWith('SELECT'))throw Error('synthetic read outage after CAS');});
  const result=await s.consume(p);assert.equal(result.allowed,true);assert.deepEqual(result.grant,p.grant);assert.equal(result.fillUsage.used,1);assert.equal(result.fillUsage.remaining,2);assert.equal(s.count(),1);
  s.setHook(()=>{});await assert.rejects(()=>s.consume(p),code('FILL_SESSION_ALREADY_CONSUMED'));
 }finally{s.db.close();}
});

test('future Pro starts_at cannot unlock entitlement, preparation or consumption early',async()=>{
 const s=setup();try{
  const prepared=await Promise.all(Array.from({length:4},()=>s.prepared()));
  s.db.prepare("INSERT INTO main__user_entitlements(user_id,status,starts_at,expires_at) VALUES(?,'active',?,?)").run(ownerA,new Date(now+3600000).toISOString(),new Date(now+7200000).toISOString());
  const entitlement=await billingEntitlement(s.adapter,ownerA,now);assert.equal(entitlement.isPro,false);assert.equal(entitlement.fillUsage.unlimited,false);assert.equal(entitlement.entitlement.status,'free');
  for(let i=0;i<3;i++){const consumed=await s.consume(prepared[i]);assert.equal(consumed.fillUsage.unlimited,false);assert.equal(consumed.fillUsage.used,i+1);}
  await assert.rejects(()=>s.consume(prepared[3]),code('FILL_LIMIT_REACHED'));await assert.rejects(()=>s.prepared(),code('FILL_LIMIT_REACHED'));assert.equal(s.count(),3);
 }finally{s.db.close();}
});

test('Pro effective boundary uses the same inclusive start and exclusive expiry for entitlement and consumption',async()=>{
 const s=setup();try{
  s.db.prepare("INSERT INTO main__user_entitlements(user_id,status,starts_at,expires_at) VALUES(?,'active',?,?)").run(ownerA,time,new Date(now+1000).toISOString());
  assert.equal((await billingEntitlement(s.adapter,ownerA,now)).isPro,true);
  const p=await s.prepared();assert.equal(p.fillUsage.unlimited,true);const consumed=await s.consume(p);assert.equal(consumed.fillUsage.unlimited,true);assert.equal(consumed.fillUsage.used,0);
  assert.equal((await billingEntitlement(s.adapter,ownerA,now+1000)).isPro,false);
  const second=await s.prepared();const afterExpiry=await s.consume(second,ownerA,now+1000);assert.equal(afterExpiry.fillUsage.unlimited,false);assert.equal(afterExpiry.fillUsage.used,1);
 }finally{s.db.close();}
});
function timedGrant(at){return grant({issuedAt:new Date(at).toISOString(),expiresAt:new Date(at+300000).toISOString()});}
for(const action of ['prepare','consume'])test(action+' refreshes the clock after async checks and rejects an expired grant',async()=>{
 const s=setup();try{
  let tick=now;const bound=timedGrant(tick),requestId=crypto.randomUUID();
  const prepared=action==='consume'?await prepareFill(s.adapter,ownerA,{action:'prepare-fill-session',requestId,grant:bound},()=>tick):null;
  s.setHook(sql=>{if(sql.startsWith('SELECT id FROM main__applications'))tick=now+300000;});
  if(action==='prepare')await assert.rejects(()=>prepareFill(s.adapter,ownerA,{action:'prepare-fill-session',requestId,grant:bound},()=>tick),code('FILL_SESSION_EXPIRED'));
  else await assert.rejects(()=>consumeFill(s.adapter,{action:'consume-fill-session',requestId,grant:bound,token:prepared.authorization.token},()=>tick,ownerA),code('FILL_SESSION_EXPIRED'));
  assert.equal(s.count(),0);assert.equal(s.db.prepare('SELECT count(*) AS n FROM main__billing_fill_sessions').get().n,action==='consume'?1:0);
 }finally{s.db.close();}
});

test('prepare does not return an expired token when its response reads outlast the grant',async()=>{
 const s=setup();try{
  let tick=now;const bound=timedGrant(tick);
  s.setHook(sql=>{if(sql.startsWith('SELECT count(*) AS n FROM main__billing_fill_sessions'))tick=now+300000;});
  await assert.rejects(()=>prepareFill(s.adapter,ownerA,{action:'prepare-fill-session',requestId:crypto.randomUUID(),grant:bound},()=>tick),code('FILL_SESSION_EXPIRED'));assert.equal(s.count(),0);
 }finally{s.db.close();}
});

for(const fullNewMonth of [false,true])test('delayed consume uses the current China month '+(fullNewMonth?'and rejects its exhausted quota':'for its receipt and consumed timestamp'),async()=>{
 const s=setup();try{
  const before=Date.parse('2026-10-31T15:59:59.900Z'),after=Date.parse('2026-10-31T16:00:00.100Z');let tick=before;
  const bound=timedGrant(tick),requestId=crypto.randomUUID(),prepared=await prepareFill(s.adapter,ownerA,{action:'prepare-fill-session',requestId,grant:bound},()=>tick);
  const historicalTime=new Date(fullNewMonth?after:before-1000).toISOString().replace(/(\.\d{3})Z$/,'$1000Z');
  for(let i=0;i<3;i++)s.db.prepare("INSERT INTO main__billing_fill_sessions(user_id,request_id,token_hash,field_count,status,tier,expires_at,consumed_at) VALUES(?,?,?,1,'consumed','free',?,?)").run(ownerA,crypto.randomUUID(),String(i).repeat(64),bound.expiresAt,historicalTime);
  s.setHook(sql=>{if(sql.startsWith('SELECT id FROM main__applications'))tick=after;});
  const run=()=>consumeFill(s.adapter,{action:'consume-fill-session',requestId,grant:bound,token:prepared.authorization.token},()=>tick,ownerA);
  if(fullNewMonth){await assert.rejects(run,code('FILL_LIMIT_REACHED'));assert.equal(s.count(),3);}
  else{const result=await run();assert.equal(result.fillUsage.used,1);assert.equal(result.fillUsage.periodStart,'2026-10-31T16:00:00.000000Z');assert.equal(Date.parse(s.db.prepare('SELECT consumed_at FROM main__billing_fill_sessions WHERE request_id=?').get(requestId).consumed_at),after);}
 }finally{s.db.close();}
});
