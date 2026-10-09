import {describe, expect, it, vi} from 'vitest';
import {createNativeNoticeClient, NATIVE_NOTICE_FRESH_MS, NATIVE_NOTICE_MAX_AGE_MS} from '../lib/native-notice-client';
import {validateNativeNoticeResponse} from '../lib/native-notice-metadata';
import type {NoticeSearchFilters} from '../lib/notice-query';

const filters: NoticeSearchFilters = {keyword:'',schoolName:'',region:'全部',majorKeyword:'',category:'全部',discipline:'全部',schoolRange:'全部',progress:'全部',deadlineQuick:'全部',fresh:'全部',publishDate:'',projectType:'全部',noticeKind:'全部',year:'2026',sortBy:'publish'};
function response(id = 'one', total = 1) {
  return {
    items: total ? [{id, projectName: '招生通知', schoolName: '合成大学'}] : [],
    pagination: {page: 1, pageSize: 16, total, totalPages: Math.max(1, Math.ceil(total / 16))},
    stats: {total2026: 500, todayUpdates: 3, deadlineWithin3Days: 7},
    facets: {regions: ['北京'], schools: ['合成大学'], categories: ['理工'], disciplines: ['计算机'], collegeStats: [{schoolName: '合成大学', total: 80, active: 25}]},
    sideData: {urgentProjects: [], latestProjects: [], todaySchoolUpdates: {date: '', hasTodayRows: false, rows: []}, latestPublishDate: '', topColleges: []},
    source: 'cloudflare', servedAt: new Date().toISOString(), metadataStale: false
  };
}

describe('native notice recovery contract', () => {
  it('reads the versioned API once and shares complete metadata on warm navigation', async () => {
    const read = vi.fn<(_: string) => Promise<unknown>>().mockResolvedValue(response());
    const client = createNativeNoticeClient(read);
    const [one, two] = await Promise.all([client.search(filters), client.search(filters)]);
    expect(one).toBe(two);
    expect(one.facets.collegeStats[0].total).toBe(80);
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0][0]).toMatch(/^\/v1\/notices\?/);
    await client.search(filters);
    expect(read).toHaveBeenCalledTimes(1);
    expect(client.snapshot(filters)).toBe(one);
  });

  it('treats authoritative zero as empty, and rejects incomplete metadata instead of inventing zero', async () => {
    expect(validateNativeNoticeResponse(response('none', 0), 16).pagination.total).toBe(0);
    expect(() => validateNativeNoticeResponse({...response(), facets: undefined}, 16)).toThrow('不完整');
    expect(() => validateNativeNoticeResponse({...response(), stats: {}}, 16)).toThrow('不完整');
    expect(() => validateNativeNoticeResponse({...response(), pagination: {...response().pagination, totalPages: 0}}, 16)).toThrow('不完整');
    expect(validateNativeNoticeResponse({...response(), metadataStale: true}, 16).metadataStale).toBe(true);
  });

  it('keeps query and page caches isolated and rejects invalid bounds before reading', async () => {
    const read = vi.fn(async () => response());
    const client = createNativeNoticeClient(read);
    await client.search(filters);
    expect(client.snapshot({...filters, keyword: '清华'})).toBeNull();
    expect(client.snapshot(filters, 2)).toBeNull();
    await client.search({...filters, keyword: '清华'});
    expect(read).toHaveBeenCalledTimes(2);
    await expect(client.search(filters, 0)).rejects.toThrow('页码');
    await expect(client.search(filters, 1, undefined, {pageSize: 41})).rejects.toThrow('页码');
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('retains a bounded stale snapshot on network failure and expires it without resetting its age', async () => {
    let now = 0;
    const read = vi.fn<(_: string) => Promise<unknown>>().mockResolvedValueOnce(response()).mockRejectedValue(new Error('offline'));
    const client = createNativeNoticeClient(read, () => now);
    await client.search(filters);
    now = NATIVE_NOTICE_FRESH_MS + 1;
    expect(client.snapshot(filters)?.stale).toBe(true);
    const stale = await client.search(filters);
    expect(stale.stale).toBe(true);
    expect(stale.metadataStale).toBe(true);
    await client.search(filters);
    expect(read).toHaveBeenCalledTimes(2);
    now = NATIVE_NOTICE_MAX_AGE_MS + 1;
    expect(client.snapshot(filters)).toBeNull();
    await expect(client.search(filters)).rejects.toThrow('offline');
  });

  it('forced retry bypasses freshness and a later success clears stale state', async () => {
    const read = vi.fn<(_: string) => Promise<unknown>>().mockResolvedValueOnce(response('old')).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response('new'));
    const client = createNativeNoticeClient(read);
    await client.search(filters);
    expect((await client.search(filters, 1, undefined, {refresh: true})).stale).toBe(true);
    const recovered = await client.search(filters, 1, undefined, {refresh: true});
    expect(recovered.items[0].id).toBe('new');
    expect(recovered.stale).not.toBe(true);
  });

  it('aborted navigation never populates its cache after native IO completes', async () => {
    let complete!: (value: unknown) => void;
    const client = createNativeNoticeClient(() => new Promise(resolve => {complete = resolve;}));
    const controller = new AbortController();
    const pending = client.search(filters, 1, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({name: 'AbortError'});
    complete(response());
    await Promise.resolve();
    await Promise.resolve();
    expect(client.snapshot(filters)).toBeNull();
  });

  it('one cancelled consumer does not cancel another page sharing the same request', async () => {
    let complete!: (value: unknown) => void;
    const client = createNativeNoticeClient(() => new Promise(resolve => {complete = resolve;}));
    const controller = new AbortController();
    const cancelled = client.search(filters, 1, controller.signal);
    const active = client.search(filters);
    controller.abort();
    await expect(cancelled).rejects.toMatchObject({name: 'AbortError'});
    complete(response());
    await expect(active).resolves.toMatchObject({pagination: {total: 1}});
    expect(client.snapshot(filters)).not.toBeNull();
  });
});
