import test from 'node:test';import assert from 'node:assert/strict';import { DatabaseSync } from 'node:sqlite';import { readFileSync } from 'node:fs';
// @ts-expect-error Migration tool intentionally runs as native ESM.
import {convertValue,transformRow,batchRows,budgetAllows,assertRemoteTarget,nextD1Reset} from '../../../scripts/migration/transform.mjs';
// @ts-expect-error Native ESM.
import {importLocalSnapshot} from '../../../scripts/migration/local-import.mjs';
// @ts-expect-error Native ESM.
import {clerkIdentityPlan} from '../../../scripts/migration/clerk-import-plan.mjs';
const schema=readFileSync(new URL('../../../migrations/d1/0001_core_prototype.sql',import.meta.url),'utf8');
test('preserves integer, decimal, NULL, empty text, binary bytes and timestamp origin',()=>{
  assert.equal(convertValue('9223372036854775807','int8'),'9223372036854775807');assert.equal(convertValue('12.3400','numeric'),'12.3400');assert.equal(convertValue(null,'text'),null);assert.equal(convertValue('','text'),'');assert.deepEqual(convertValue('\\x00ff','bytea'),{hex:'00ff'});
  const t=convertValue('2026-09-08T00:01:02+08:00','timestamptz');assert.equal(t.utc,'2026-09-07T16:01:02.000Z');assert.equal(t.raw,'2026-09-08T00:01:02+08:00');
});
test('rejects unsafe numbers, unmapped types, missing and extra fields',()=>{
  assert.throws(()=>convertValue(9223372036854775807,'int8'),/LOSSY/);assert.throws(()=>convertValue({},'geometry'),/UNMAPPED/);assert.throws(()=>transformRow({},[{name:'id',type:'text'}]),/MISSING/);assert.throws(()=>transformRow({id:'a',extra:1},[{name:'id',type:'text'}]),/UNMAPPED/);
});
test('counts bindings per column rather than 100 rows and enforces byte budgets',()=>{
  assert.deepEqual(batchRows(Array.from({length:101},()=>['a']),21).map((b:unknown[])=>b.length),[...Array(25).fill(4),1]);assert.throws(()=>batchRows([['x'.repeat(100_000)]],1),/TRANSPORT/);
  assert.equal(budgetAllows({usedWrites:99990,usedReads:0,maxWrites:100000,maxReads:5000000,reserveWrites:10,reserveReads:0},{rows:1,indexCount:1,checkpointWrites:1,validationRows:1,lookupRows:1}),false);
  assert.equal(nextD1Reset('2026-09-08T10:00:00+08:00'),'2026-09-09T00:00:00.000Z');
});
test('missing Chrome/target attestation cannot reach a remote import',()=>{assert.throws(()=>assertRemoteTarget(null,{}),/NOT_VERIFIED/);});
test('local checkpoint resume is idempotent; source drift never overwrites target',()=>{
  const db=new DatabaseSync(':memory:');db.exec(schema);const rows=Array.from({length:40},(_,i)=>({id:'n'+i,big:'9007199254740993',optional:null}));
  const snapshot={id:'snapshot-a',layer:'synthetic-fixture',sourceProjectRef:'mnotoltpythkayguhnrk',tables:[{schema:'public',name:'synthetic_records',primaryKey:['id'],columns:[{name:'id',type:'text'},{name:'big',type:'int8'},{name:'optional',type:'text'}],rows}]};
  const budget={usedWrites:0,usedReads:0,maxWrites:40,maxReads:10000,reserveWrites:0,reserveReads:0};
  assert.equal(importLocalSnapshot(db,snapshot,budget).status,'budget-stop');budget.maxWrites=1000;assert.equal(importLocalSnapshot(db,snapshot,budget).status,'local-verified');assert.equal((db.prepare('SELECT count(*) AS n FROM migration_source_records').get() as {n:number}).n,40);
  importLocalSnapshot(db,snapshot,budget);assert.equal((db.prepare('SELECT count(*) AS n FROM migration_source_records').get() as {n:number}).n,40);snapshot.tables[0].rows[0].big='9007199254740994';assert.throws(()=>importLocalSnapshot(db,snapshot,budget),/SNAPSHOT_CHANGED/);db.close();
});
test('Clerk plan namespaces old UUID and explicitly preserves unverified email',()=>{
  const user={id:'original-uuid',email:'fixture@example.invalid',encrypted_password:'$2b$12$synthetic-placeholder',email_confirmed_at:null};const plan=clerkIdentityPlan('mnotoltpythkayguhnrk',user);assert.equal(plan.externalId,'mnotoltpythkayguhnrk:original-uuid');assert.deepEqual(plan.emailAddressIdentificationStatus,['reserved']);assert.equal(plan.passwordHasher,'bcrypt');assert.throws(()=>clerkIdentityPlan('ovkjwtkqsijgbgzltclx',user),/SCOPE/);
});
