import test from 'node:test';
import assert from 'node:assert/strict';
import { orderD1Notices, toD1Notice } from '../scripts/notice-d1-transport.mjs';

test('D1 transport keeps business fields and strips acquisition-only fields', () => {
  const row = toD1Notice({
    id: 'baoyantongzhi-2',
    school_name: '测试大学',
    source_site: '保研通知网',
    source_link: 'ttps://example.com/notice',
    source_record_id: '2',
    quality_tier: 'verified'
  });
  assert.equal(row.source_link, 'https://example.com/notice');
  assert.equal(row.admin_status, 'pending');
  assert.equal(row.is_private, true);
  assert.equal('source_record_id' in row, false);
  assert.equal('quality_tier' in row, false);
});

test('D1 transport orders newest notices first', () => {
  const ordered = orderD1Notices([
    { id: 'baoyanwang-2', school_name: '乙', source_site: '保研信息网', publish_date: '2026-09-01' },
    { id: 'baoyantongzhi-1', school_name: '甲', source_site: '保研通知网', publish_date: '2026-10-01' }
  ]);
  assert.deepEqual(ordered.map((item) => item.id), ['baoyantongzhi-1', 'baoyanwang-2']);
});
