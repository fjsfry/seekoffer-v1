import {test} from 'node:test';import assert from 'node:assert/strict';
import {toD1Notice,orderD1Notices,ingestionShouldRetry,validateD1IngestReceipt} from '../scripts/notice-d1-transport.mjs';
test('explicit source metadata boundary preserves IDs and moderation without resetting reminders',()=>{
 const row=toD1Notice({id:'xingke-abc',source_record_id:'abc',last_checked_source:'official',quality_tier:'clean',quality_reasons:[],reminder_7d_sent:false,admin_status:'hidden',is_private:true,requirements:'原始正文'});
 assert.deepEqual(row,{id:'xingke-abc',admin_status:'hidden',is_private:true,requirements:'原始正文'});
 assert.throws(()=>toD1Notice({id:'xingke-abc',created_by:'private-owner'}),/UNMAPPED/);
 assert.throws(()=>toD1Notice({id:'custom-abc'}),/UNEXPECTED/);
});
test('quota and conflict responses stop; temporary failures retry only under bounded caller policy',()=>{
 for(const status of [401,402,403,404,409])assert.equal(ingestionShouldRetry(status),false);
 assert.equal(ingestionShouldRetry(429,'INGEST_DAILY_BUDGET'),false);
 assert.equal(ingestionShouldRetry(503),true);
});

test('successful ingestion accounts for changed, unchanged and protected records',()=>{
 const receipt=validateD1IngestReceipt({ok:true,noticesReceived:6,noticesUpserted:1,unchanged:2,protected:3,private:'excluded'},6);
 assert.deepEqual(receipt,{noticesReceived:6,noticesUpserted:1,unchanged:2,protected:3});
 assert.equal(validateD1IngestReceipt({ok:true,noticesReceived:6,noticesUpserted:0,unchanged:0,protected:6},6).noticesUpserted,0);
});

test('2xx malformed, partial or dry-run receipts cannot silently complete an import',()=>{
 const valid={ok:true,noticesReceived:6,noticesUpserted:1,unchanged:2,protected:3};
 for(const payload of [null,{},[],{...valid,ok:false},{...valid,dryRun:true},{...valid,noticesReceived:5},
   {...valid,noticesUpserted:0},{...valid,protected:-1},{...valid,unchanged:'2'}]) {
   assert.throws(()=>validateD1IngestReceipt(payload,6),error=>error.message==='INVALID_INGEST_RECEIPT'&&error.retryable===false);
 }
});
test('prioritize newest records with a stable order without truncating older candidates',()=>{
 const rows=Array.from({length:3000},(_,i)=>({id:'xingke-'+i,publish_date:i===2500?'2026-09-10':'2026-09-08'}));
 const ordered=orderD1Notices(rows);assert.equal(ordered.length,3000);assert.equal(ordered[0].id,'xingke-2500');
});
test('source URL scheme typo enters review rather than being published',()=>{
 const row=toD1Notice({id:'xingke-27386',source_link:'ttps://example.edu.cn/notice',admin_status:'published'});
 assert.equal(row.source_link,'https://example.edu.cn/notice');assert.equal(row.admin_status,'pending');assert.equal(row.is_private,true);
 assert.match(row.admin_review_note,/source_url_scheme_typo/);
});

test('malformed source links are retained privately without blocking other notices', () => {
 for (const link of ['/notice/1', '详见官网', 'javascript:alert(1)', 'https://user:pass@example.edu.cn/']) {
  const rows = orderD1Notices([
   {id:'xingke-bad', source_link:link, apply_link:'https://example.edu.cn/apply', admin_status:'published'},
   {id:'xingke-good', source_link:'https://example.edu.cn/notice', admin_status:'published'}
  ]);
  const bad = rows.find(row => row.id === 'xingke-bad');
  assert.equal(bad.source_link, '');
  assert.equal(bad.apply_link, 'https://example.edu.cn/apply');
  assert.equal(bad.admin_status, 'pending');
  assert.equal(bad.is_private, true);
  assert.ok(bad.remarks.includes(link));
  assert.equal(rows.find(row => row.id === 'xingke-good').admin_status, 'published');
 }
});

test('invalid application links do not erase valid sources or weaken hidden moderation', () => {
 const row = toD1Notice({id:'xingke-review', source_link:'https://example.edu.cn/', apply_link:'待公布', admin_status:'hidden'});
 assert.equal(row.source_link, 'https://example.edu.cn/');
 assert.equal(row.apply_link, '');
 assert.equal(row.admin_status, 'hidden');
 assert.equal(row.is_private, true);
});
