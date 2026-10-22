import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';
import {unstable_splitSqlQuery as splitSqlQuery} from 'wrangler';

const root=new URL('../../../',import.meta.url);
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const applicationId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(owner))).toString('hex');
const bundle=await build({entryPoints:[fileURLToPath(new URL('fill-binding-worker.ts',import.meta.url))],bundle:true,platform:'browser',format:'esm',write:false,logLevel:'silent'});
const base=fs.readFileSync(new URL('migrations/d1/snapshot/0001_business.sql',root),'utf8');
const runtime=fs.readFileSync(new URL('migrations/d1/snapshot/0002_preview_runtime.sql',root),'utf8');
const migration=fs.readFileSync(new URL('migrations/d1/snapshot/0016_bound_fill_grants.sql',root),'utf8');

test('workerd D1 executes immutable binding migration and serializes concurrent quota consumption',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-01',d1Databases:{CORE:'fill-binding-isolated'},outboundService:()=>{throw Error('External network is forbidden in this test');}}));
 try{
  const db=await mf.getD1Database('CORE');
  for(const sql of [base,runtime,migration])await db.batch(splitSqlQuery(sql).map(statement=>db.prepare(statement)));
  await db.prepare('INSERT INTO main__auth_subjects(id,email_confirmed_at) VALUES(?,?)').bind(owner,new Date().toISOString()).run();
  await db.prepare('INSERT INTO main__applications(id,user_id,project_id) VALUES(?,?,?)').bind(applicationId,owner,'synthetic-project').run();
  const call=(body,identity=owner)=>mf.dispatchFetch('http://localhost/test',{method:'POST',headers:{'Content-Type':'application/json','x-fixture-owner':identity},body:JSON.stringify(body)});
  const prepared=[];
  for(let i=0;i<5;i++){
   const issuedAt=new Date(),grant={protocol:'seekoffer-fill/v1',grantId:crypto.randomUUID(),userIdHash:hash,applicationId,fieldIds:['name','email'],issuedAt:issuedAt.toISOString(),expiresAt:new Date(+issuedAt+300000).toISOString(),nonce:crypto.randomUUID()};
   const requestId=crypto.randomUUID();const response=await call({action:'prepare-fill-session',requestId,grant});const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));prepared.push({action:'consume-fill-session',requestId,grant,token:result.authorization.token});
  }
  assert.equal((await call(prepared[0],other)).status,403);
  assert.equal((await db.prepare("SELECT count(*) n FROM main__billing_fill_sessions WHERE status='consumed'").first()).n,0);
  const responses=await Promise.all(prepared.map(payload=>call(payload)));
  assert.equal(responses.filter(response=>response.status===200).length,3);
  assert.equal(responses.filter(response=>response.status===402).length,2);
  assert.equal((await db.prepare("SELECT count(*) n FROM main__billing_fill_sessions WHERE status='consumed'").first()).n,3);
  const receipts=await Promise.all(responses.map(response=>response.json()));
  const successfulReceipts=receipts.filter((_,index)=>responses[index].status===200);
  assert.deepEqual(successfulReceipts.map(receipt=>receipt.fillUsage.used).sort(),[1,2,3]);
  assert.deepEqual(successfulReceipts.map(receipt=>receipt.fillUsage.remaining).sort(),[0,1,2]);
  const success=responses.findIndex(response=>response.status===200);assert.deepEqual(receipts[success].grant,prepared[success].grant);
  assert.equal((await call(prepared[success])).status,409);
  await db.prepare("INSERT INTO main__user_entitlements(user_id,status,starts_at) VALUES(?,'active',?)").bind(owner,new Date(Date.now()+3600000).toISOString()).run();
  assert.equal((await call({action:'prepare-fill-session',requestId:crypto.randomUUID(),grant:{...prepared[0].grant,grantId:crypto.randomUUID(),nonce:crypto.randomUUID()}})).status,402);
  const otherApplication='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  await db.prepare('INSERT INTO main__auth_subjects(id,email_confirmed_at) VALUES(?,?)').bind(other,new Date().toISOString()).run();
  await db.prepare('INSERT INTO main__applications(id,user_id,project_id) VALUES(?,?,?)').bind(otherApplication,other,'synthetic-other').run();
  const otherHash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(other))).toString('hex');
  const otherGrant={...prepared[0].grant,userIdHash:otherHash,applicationId:otherApplication,grantId:crypto.randomUUID(),nonce:crypto.randomUUID()},otherRequest=crypto.randomUUID();
  const otherAuthorization=await (await call({action:'prepare-fill-session',requestId:otherRequest,grant:otherGrant},other)).json();
  const sameToken={action:'consume-fill-session',requestId:otherRequest,grant:otherGrant,token:otherAuthorization.authorization.token};
  const sameResponses=await Promise.all(Array.from({length:3},()=>call(sameToken,other)));
  assert.equal(sameResponses.filter(response=>response.status===200).length,1);assert.equal(sameResponses.filter(response=>response.status===409).length,2);
  assert.equal((await sameResponses.find(response=>response.status===200).json()).fillUsage.used,1);
  await assert.rejects(()=>db.prepare('UPDATE main__billing_fill_sessions SET bound_grant=? WHERE request_id=?').bind(JSON.stringify({...prepared[success].grant,nonce:crypto.randomUUID()}),prepared[success].requestId).run(),/FILL_SESSION_BINDING_IMMUTABLE/);
 }finally{await mf.dispose();}
});

test('workerd migration rejects a late legacy consumption and preserves historical usage',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-01',d1Databases:{CORE:'fill-binding-migration-isolated'},outboundService:()=>{throw Error('External network is forbidden in this test');}}));
 try{
  const db=await mf.getD1Database('CORE');
  for(const sql of [base,runtime])await db.batch(splitSqlQuery(sql).map(statement=>db.prepare(statement)));
  const now=new Date().toISOString(),expiresAt=new Date(Date.now()+300000).toISOString();
  await db.prepare('INSERT INTO main__auth_subjects(id,email_confirmed_at) VALUES(?,?)').bind(owner,now).run();
  await db.prepare('INSERT INTO main__applications(id,user_id,project_id) VALUES(?,?,?)').bind(applicationId,owner,'synthetic-project').run();
  await db.prepare("INSERT INTO main__billing_fill_sessions(user_id,request_id,token_hash,field_count,status,tier,expires_at,consumed_at) VALUES(?,'legacy-consumed-session',?,1,'consumed','free',?,?)").bind(owner,'a'.repeat(64),expiresAt,now).run();
  await db.prepare("INSERT INTO main__billing_fill_sessions(user_id,request_id,token_hash,field_count,status,tier,expires_at) VALUES(?,'legacy-prepared-session',?,1,'prepared','free',?)").bind(owner,'b'.repeat(64),expiresAt).run();
  await db.batch(splitSqlQuery(migration).map(statement=>db.prepare(statement)));
  await assert.rejects(()=>db.prepare("UPDATE main__billing_fill_sessions SET status='consumed',consumed_at=? WHERE request_id='legacy-prepared-session'").bind(now).run(),/FILL_SESSION_TERMINAL/);
  const rows=(await db.prepare('SELECT request_id,status,consumed_at,bound_grant FROM main__billing_fill_sessions ORDER BY request_id').all()).results;
  assert.deepEqual(rows,[{request_id:'legacy-consumed-session',status:'consumed',consumed_at:now,bound_grant:null},{request_id:'legacy-prepared-session',status:'prepared',consumed_at:null,bound_grant:null}]);
 }finally{await mf.dispose();}
});
