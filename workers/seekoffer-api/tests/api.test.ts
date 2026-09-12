import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
import {generateKeyPair,SignJWT} from 'jose';import worker,{type Env} from '../src/index.ts';import {verifyIdentity,resolveOwner} from '../src/auth.ts';
function dbAdapter(db:DatabaseSync){return {prepare(sql:string){let args:unknown[]=[];const query={bind(...input:unknown[]){args=input;return query;},async first(){return db.prepare(sql).get(...args as never[])||null;},async all(){return {results:db.prepare(sql).all(...args as never[]),success:true};}};return query;}} as unknown as D1Database;}
const schema=readFileSync(new URL('../../../migrations/d1/0001_core_prototype.sql',import.meta.url),'utf8');
test('SQLite source verifies public pagination/projection, hidden rows and indexed plan',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(schema);const ref='mnotoltpythkayguhnrk';
 for(let i=0;i<45;i++){const summary=JSON.stringify({id:'n'+i,projectName:'中文通知'+i,admin_review_note:'private-field'});db.prepare('INSERT INTO notices VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(ref,'n'+i,'北京大学','学院','中文通知'+i,'预推免','计算机','北京','985','申请通知',2026,'2026-09-08',null,null,'中文通知'+i,summary,summary,i===44?1:0,null,i===43?'hidden':'published',null);}
 const env:Env={CORE:dbAdapter(db),MODE:'local',LEGACY_PROJECT_REF:ref,ALLOWED_ORIGINS:'http://127.0.0.1:3000'};
 const response=await worker.fetch(new Request('http://127.0.0.1/v1/notices?page=2'),env);assert.equal(response.status,200);const body=await response.json() as {items:Record<string,unknown>[];pagination:{total:number}};assert.equal(body.items.length,16);assert.equal(body.pagination.total,43);assert.ok(body.items.every(i=>!('admin_review_note'in i)));
 assert.equal((await worker.fetch(new Request('http://127.0.0.1/v1/notices/n43'),env)).status,404);
 assert.equal((await worker.fetch(new Request('http://127.0.0.1/v1/notices?q='+encodeURIComponent('很长的中文搜索词'.repeat(4))),env)).status,200);
 assert.equal((await worker.fetch(new Request('http://127.0.0.1/v1/notices?pageSize=41'),env)).status,400);
 assert.equal((await worker.fetch(new Request('http://127.0.0.1/v1/me/applications'),env)).status,401);
 assert.equal((await worker.fetch(new Request('https://public.example/health'),env)).status,503);
 const plan=db.prepare("EXPLAIN QUERY PLAN SELECT summary_json FROM notices WHERE legacy_project_ref=? AND year=? AND is_private=0 AND admin_status='published' AND deleted_at IS NULL ORDER BY publish_date DESC,id LIMIT 16").all(ref,2026);assert.ok(JSON.stringify(plan).includes('notices_public_date'));db.close();
});
test('preview fails closed without its separate authorization',async()=>{
 const env={MODE:'preview',LEGACY_PROJECT_REF:'mnotoltpythkayguhnrk',ALLOWED_ORIGINS:''} as Env;
 assert.equal((await worker.fetch(new Request('https://preview.example/health'),env)).status,503);env.PREVIEW_ACCESS_TOKEN='synthetic-only-preview-token-123456789';assert.equal((await worker.fetch(new Request('https://preview.example/health'),env)).status,401);
});
test('real RS256 verification rejects forged issuer, audience, expiry and authorized party',async()=>{
 const keys=await generateKeyPair('RS256');const config={CLERK_ISSUER:'https://clerk.example.invalid',CLERK_AUDIENCE:'seekoffer',AUTHORIZED_PARTIES:'http://127.0.0.1:3000'};
 const sign=(claims:Record<string,unknown>={})=>new SignJWT({sub:'subject-a',sid:'sess_synthetic',azp:'http://127.0.0.1:3000',...claims}).setProtectedHeader({alg:'RS256'}).setIssuer(config.CLERK_ISSUER).setAudience(config.CLERK_AUDIENCE).setIssuedAt().setExpirationTime('2m').sign(keys.privateKey);
 const good=await sign();assert.equal((await verifyIdentity(good,config,async()=>keys.publicKey)).subject,'subject-a');
 for(const claims of [{sid:undefined},{sid:''},{sts:'pending'},{sts:'revoked'}]){const rejected=await sign(claims);await assert.rejects(()=>verifyIdentity(rejected,config,async()=>keys.publicKey));}
 await assert.rejects(()=>verifyIdentity(good,{...config,CLERK_ISSUER:'https://wrong.example'},async()=>keys.publicKey));
 await assert.rejects(()=>verifyIdentity(good,{...config,CLERK_AUDIENCE:'wrong'},async()=>keys.publicKey));
 await assert.rejects(()=>verifyIdentity(good,{...config,AUTHORIZED_PARTIES:'https://other.example'},async()=>keys.publicKey));
 const wrong=await generateKeyPair('RS256');await assert.rejects(()=>verifyIdentity(good,config,async()=>wrong.publicKey));
 const expired=await new SignJWT({sub:'subject-a',azp:config.AUTHORIZED_PARTIES}).setProtectedHeader({alg:'RS256'}).setIssuer(config.CLERK_ISSUER).setAudience('seekoffer').setIssuedAt(1).setExpirationTime(2).sign(keys.privateKey);await assert.rejects(()=>verifyIdentity(expired,config,async()=>keys.publicKey));
});
test('same legacy UUID in independent projects does not merge; blocked mapping cannot access business data',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(schema);db.prepare('INSERT INTO business_users VALUES(?,?,?)').run('mnotoltpythkayguhnrk','same-uuid',0);db.prepare('INSERT INTO business_users VALUES(?,?,?)').run('bqzchxacykhdmoczysfe','same-uuid',1);
 db.prepare('INSERT INTO identity_links VALUES(?,?,?,?)').run('issuer','a','mnotoltpythkayguhnrk','same-uuid');db.prepare('INSERT INTO identity_links VALUES(?,?,?,?)').run('issuer','b','bqzchxacykhdmoczysfe','same-uuid');
 assert.equal(await resolveOwner(dbAdapter(db),{issuer:'issuer',subject:'a'},'mnotoltpythkayguhnrk'),'same-uuid');await assert.rejects(()=>resolveOwner(dbAdapter(db),{issuer:'issuer',subject:'a'},'bqzchxacykhdmoczysfe'));await assert.rejects(()=>resolveOwner(dbAdapter(db),{issuer:'issuer',subject:'b'},'bqzchxacykhdmoczysfe'));db.close();
});
