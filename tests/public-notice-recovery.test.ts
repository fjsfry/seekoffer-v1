import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../lib/notice-source', () => ({ baseNoticeProjects: [] }));
vi.mock('../lib/cloudflare-api', async () => {
  const actual = await vi.importActual<typeof import('../lib/cloudflare-api')>('../lib/cloudflare-api');
  return { ...actual, cloudflareRequest: vi.fn() };
});
import { cloudflareRequest, CloudflareApiError } from '../lib/cloudflare-api';
import { fetchPublicNoticeSearch, clearPublicNoticeSearchCache } from '../lib/public-notice-api';
import type { NoticeSearchFilters } from '../lib/notice-query';
const request = vi.mocked(cloudflareRequest);
const filters: NoticeSearchFilters = { keyword: '', schoolName: '', region: '全部', majorKeyword: '', category: '全部', discipline: '全部', schoolRange: '全部', progress: '全部', deadlineQuick: '全部', fresh: '全部', publishDate: '', projectType: '全部', noticeKind: '全部', year: '2026', sortBy: 'publish' };
afterEach(() => { vi.restoreAllMocks(); request.mockReset(); clearPublicNoticeSearchCache(); });

it('fallback expires after 30 seconds instead of hiding recovered service for five minutes', async () => {
  let now = Date.now(); vi.spyOn(Date, 'now').mockImplementation(() => now);
  request.mockRejectedValueOnce(new CloudflareApiError(503, 'READ_BUDGET_EXHAUSTED'));
  const old = await fetchPublicNoticeSearch({ ...filters, keyword: 'recovery' }, 1);
  expect(old.source).toBe('bundled'); expect(old.fallbackReason).toBe('busy');
  now += 31000;
  request.mockResolvedValueOnce({ ...old, source: 'd1', servedAt: new Date(now).toISOString(), fallbackReason: undefined });
  const fresh = await fetchPublicNoticeSearch({ ...filters, keyword: 'recovery' }, 1);
  expect(fresh.source).toBe('cloudflare'); expect(request).toHaveBeenCalledTimes(2);
});

it('manual refresh retains the same query last good page during a temporary outage', async () => {
  const data = { items: [{ id: 'live-notice' }], servedAt: new Date().toISOString(), source: 'd1' };
  request.mockResolvedValueOnce(data);
  await fetchPublicNoticeSearch({ ...filters, keyword: 'last-good' }, 1);
  clearPublicNoticeSearchCache(); request.mockRejectedValueOnce(new TypeError('network'));
  const stale = await fetchPublicNoticeSearch({ ...filters, keyword: 'last-good' }, 1);
  expect(stale.source).toBe('cloudflare'); expect(stale.stale).toBe(true);
  expect(stale.items[0].id).toBe('live-notice'); expect(stale.servedAt).toBe(data.servedAt);
});

it('invalid queries and aborted requests do not get disguised as successful offline search', async () => {
  request.mockRejectedValueOnce(new CloudflareApiError(400, 'INVALID_FILTER'));
  await expect(fetchPublicNoticeSearch({ ...filters, keyword: 'invalid' }, 1)).rejects.toThrow('INVALID_FILTER');
  await expect(fetchPublicNoticeSearch(filters, 1, { signal: AbortSignal.abort() })).rejects.toThrow();
});
