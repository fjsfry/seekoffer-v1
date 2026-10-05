import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyNoticeWebsite } from '../scripts/verify-notice-website-sync.mjs';

test('website verification checks D1 list, ordering, detail and cache repeat', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('/v1/notices/baoyantongzhi-1')) {
      return new Response(JSON.stringify({ id: 'baoyantongzhi-1', projectName: '测试项目' }), { status: 200 });
    }
    return new Response(
      JSON.stringify({
        items: [{ id: 'baoyantongzhi-1', publishDate: '2026-10-01', schoolName: '测试大学' }],
        pagination: { total: 1 }
      }),
      { status: 200 }
    );
  };
  const result = await verifyNoticeWebsite({ fetchImpl });
  assert.equal(result.state, 'WEBSITE_SYNC_VERIFIED');
  assert.equal(result.total, 1);
  assert.equal(result.detailChecked, true);
  assert.equal(calls.length, 3);
});
