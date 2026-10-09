import {describe, expect, it} from 'vitest';
import {validateNativeNoticeResponse} from '../lib/native-notice-metadata';

// Explicit read-only contract smoke; normal unit runs never depend on production.
describe.skipIf(process.env.SEEKOFFER_PUBLIC_API_SMOKE !== '1')('live desktop public API compatibility', () => {
  it('accepts the production list, full college aggregates and canonical detail', async () => {
    const response = await fetch('https://migration.seekoffer.com.cn/v1/notices?page=1&pageSize=16&year=2026&sort=publish');
    expect(response.status).toBe(200);
    const data = validateNativeNoticeResponse(await response.json(), 16);
    expect(data.pagination.total).toBeGreaterThan(data.items.length);
    expect(data.facets.collegeStats.length).toBeGreaterThan(data.items.length);
    const detail = await fetch('https://migration.seekoffer.com.cn/v1/notices/detail?' + new URLSearchParams({id: data.items[0].id}));
    expect(detail.status).toBe(200);
    expect((await detail.json() as {id: string}).id).toBe(data.items[0].id);
  }, 30000);
  it('accepts deadline server filters and a forty-row bounded page', async () => {
    const response = await fetch('https://migration.seekoffer.com.cn/v1/notices?' + new URLSearchParams({page: '1', pageSize: '40', year: '2026', status: '报名中', deadline: 'within7days', sort: 'deadline'}));
    expect(response.status).toBe(200);
    const data = validateNativeNoticeResponse(await response.json(), 40);
    expect(data.pagination.pageSize).toBe(40);
    expect(data.pagination.totalPages).toBeLessThanOrEqual(25);
  }, 30000);
});
