import {test} from 'node:test';import assert from 'node:assert/strict';
import {toD1Notice,orderD1Notices,ingestionShouldRetry} from '../scripts/notice-d1-transport.mjs';
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
test('prioritize newest records with a stable order without truncating older candidates',()=>{
 const rows=Array.from({length:3000},(_,i)=>({id:'xingke-'+i,publish_date:i===2500?'2026-09-10':'2026-09-08'}));
 const ordered=orderD1Notices(rows);assert.equal(ordered.length,3000);assert.equal(ordered[0].id,'xingke-2500');
});
test('source URL scheme typo enters review rather than being published',()=>{
 const row=toD1Notice({id:'xingke-27386',source_link:'ttps://example.edu.cn/notice',admin_status:'published'});
 assert.equal(row.source_link,'https://example.edu.cn/notice');assert.equal(row.admin_status,'pending');assert.equal(row.is_private,true);
 assert.match(row.admin_review_note,/source_url_scheme_typo/);
});
