import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {createHash} from 'node:crypto';
const fixture=vi.hoisted(()=>({catalog:JSON.stringify([{id:'a',schoolName:'北京大学',projectName:'2026预推免通知',tags:[],deadlineDate:''},{id:'b',schoolName:'清华大学',projectName:'2026预推免通知',tags:[],deadlineDate:''}])}));
vi.mock('server-only',()=>({}));
vi.mock('node:fs',()=>({readFileSync:(path:string)=>path.endsWith('manifest.json')?JSON.stringify({sourceRef:'mnotoltpythkayguhnrk',publicWhitelistOnly:true,catalogSha256:createHash('sha256').update(fixture.catalog).digest('hex'),count:2,version:'fixture',observedAt:'2026-09-09'}):path.endsWith('catalog.json')?Buffer.from(fixture.catalog):JSON.stringify({id:'a',projectName:'OLD_BODY'})}));
beforeEach(()=>{vi.resetModules();vi.stubEnv('SEEKOFFER_OFFLINE_BUILD','false');});afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs();});
const response=(version:string,items:unknown[]=[],nextCursor:string|null=null)=>Response.json({version,items,nextCursor});
it('hiding a bundled notice removes it from the catalog and prevents detail resurrection',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(response('v1')).mockResolvedValueOnce(response('v2',[{id:'a',visible:false}])).mockResolvedValueOnce(response('v2',[{id:'a',visible:false}]));vi.stubGlobal('fetch',fetcher);
 const m=await import('../lib/server/recovery-public-catalog');expect((await m.getLiveRecoveryCatalog()).items.map(x=>x.id)).toEqual(['a','b']);expect((await m.getLiveRecoveryCatalog()).items.map(x=>x.id)).toEqual(['b']);expect(await m.getRecoveryDetail('a')).toBeNull();expect(fetcher).toHaveBeenCalledTimes(3);
});
it('a 402 does not return a stale catalog and backoff suppresses repeated origin attempts',async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response('{}',{status:402}));vi.stubGlobal('fetch',fetcher);const m=await import('../lib/server/recovery-public-catalog');await expect(m.getLiveRecoveryCatalog()).rejects.toMatchObject({status:402});await expect(m.getRecoveryDetail('a')).rejects.toThrow();expect(fetcher).toHaveBeenCalledTimes(1);
});
it('a detail withdrawn between overlay and detail reads cannot use the old bundled body',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(response('v2',[{id:'a',visible:true,summary:{id:'a'}}])).mockResolvedValueOnce(new Response('{}',{status:404}));vi.stubGlobal('fetch',fetcher);const m=await import('../lib/server/recovery-public-catalog');expect(await m.getRecoveryDetail('a')).toBeNull();expect(String(fetcher.mock.calls[1][0])).toContain('/notice-detail?id=a');
});
it('mixed versions and malformed pagination fail without silently returning partial data',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(response('v1',[],'notice_override:a')).mockResolvedValueOnce(response('v2'));vi.stubGlobal('fetch',fetcher);const m=await import('../lib/server/recovery-notice-overrides');await expect(m.getRecoveryOverrides()).rejects.toThrow('NOTICE_UPDATE_DATA_INVALID');
});
it('only the build process offline flag bypasses overlay network access',async()=>{
 vi.stubEnv('SEEKOFFER_OFFLINE_BUILD','true');const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);const m=await import('../lib/server/recovery-public-catalog');expect((await m.getLiveRecoveryCatalog()).items).toHaveLength(2);expect(fetcher).not.toHaveBeenCalled();
});

const tombstone = (id: string) => ({id, visible: false});
it('loads more than 5,000 overrides while pinning every continuation to one version', async () => {
  const calls: URL[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const url = new URL(input); calls.push(url);
    const start = url.searchParams.has('after') ? Number(url.searchParams.get('after')!.slice(16)) + 1 : 0;
    const end = Math.min(start + 100, 5_101);
    if (start) expect(url.searchParams.get('version')).toBe('v1');
    return response('v1', Array.from({length: end - start}, (_, index) => tombstone(String(start + index).padStart(5, '0'))),
      end < 5_101 ? 'notice_override:' + String(end - 1).padStart(5, '0') : null);
  }));
  const m = await import('../lib/server/recovery-notice-overrides');
  const result = await m.getRecoveryOverrides();
  expect(result.items).toHaveLength(5_101);
  expect(result.items.at(-1)?.id).toBe('05100');
  expect(calls).toHaveLength(52);
});

it('discards incomplete pages and restarts at page one once after a version conflict', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(response('v1', [tombstone('old')], 'notice_override:old'))
    .mockResolvedValueOnce(new Response('{}', {status: 409}))
    .mockResolvedValueOnce(response('v2', [tombstone('new')], 'notice_override:new'))
    .mockResolvedValueOnce(response('v2', [tombstone('newer')]));
  vi.stubGlobal('fetch', fetcher);
  const m = await import('../lib/server/recovery-notice-overrides');
  expect(await m.getRecoveryOverrides()).toEqual({version: 'v2', items: [tombstone('new'), tombstone('newer')]});
  const urls = fetcher.mock.calls.map(([url]) => new URL(url));
  expect(urls[1].searchParams.get('version')).toBe('v1');
  expect(urls[2].search).toBe('');
  expect(urls[3].searchParams.get('version')).toBe('v2');
});

it('repeated version conflicts fail closed and suppress another origin loop', async () => {
  const fetcher = vi.fn(async () => new Response('{}', {status: 409}));
  vi.stubGlobal('fetch', fetcher);
  const m = await import('../lib/server/recovery-notice-overrides');
  await expect(m.getRecoveryOverrides()).rejects.toThrow('NOTICE_UPDATE_VERSION_UNSTABLE');
  await expect(m.getRecoveryOverrides()).rejects.toThrow('NOTICE_UPDATE_SOURCE_UNAVAILABLE');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('checks advancing cursors on empty pages and before returning a warm version', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(response('v1'))
    .mockResolvedValueOnce(response('v1', [], 'notice_override:'));
  vi.stubGlobal('fetch', fetcher);
  const m = await import('../lib/server/recovery-notice-overrides');
  await m.getRecoveryOverrides();
  await expect(m.getRecoveryOverrides()).rejects.toThrow('NOTICE_CURSOR_INVALID');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it.each(['notice_override:a', 'notice_override:0'])('rejects repeated or reversed empty-page cursors (%s)', async next => {
  const fetcher = vi.fn().mockResolvedValueOnce(response('v1', [], 'notice_override:a'))
    .mockResolvedValueOnce(response('v1', [], next));
  vi.stubGlobal('fetch', fetcher);
  const m = await import('../lib/server/recovery-notice-overrides');
  await expect(m.getRecoveryOverrides()).rejects.toThrow('NOTICE_CURSOR_INVALID');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('shares page budgets across the one permitted version restart', async () => {
  vi.stubEnv('SEEKOFFER_RECOVERY_MAX_PAGES', '2');
  const fetcher = vi.fn().mockResolvedValueOnce(response('v1', [], 'notice_override:a'))
    .mockResolvedValueOnce(new Response('{}', {status: 409}));
  vi.stubGlobal('fetch', fetcher);
  const m = await import('../lib/server/recovery-notice-overrides');
  await expect(m.getRecoveryOverrides()).rejects.toThrow('NOTICE_UPDATE_PAGE_BUDGET_EXCEEDED');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('bounds accumulated response bytes even when each page is small', async () => {
  const first = {version: 'v1', items: [tombstone('a')], nextCursor: 'notice_override:a'};
  vi.stubEnv('SEEKOFFER_RECOVERY_MAX_BYTES', String(new TextEncoder().encode(JSON.stringify(first)).byteLength + 1));
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(first)).mockResolvedValueOnce(response('v1', [tombstone('b')]));
  vi.stubGlobal('fetch', fetcher);
  const m = await import('../lib/server/recovery-notice-overrides');
  await expect(m.getRecoveryOverrides()).rejects.toThrow('NOTICE_UPDATE_BYTE_BUDGET_EXCEEDED');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('cancels oversized streamed pages before parsing or accepting them', async () => {
  const cancel = vi.fn();
  const body = new ReadableStream({start(controller) { controller.enqueue(new Uint8Array(512_001)); }, cancel});
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
  const m = await import('../lib/server/recovery-notice-overrides');
  await expect(m.getRecoveryOverrides()).rejects.toThrow('NOTICE_UPDATE_PAGE_TOO_LARGE');
  expect(cancel).toHaveBeenCalledOnce();
});

it('enforces a total elapsed-time budget without returning a partial catalog', async () => {
  vi.stubEnv('SEEKOFFER_RECOVERY_TIMEOUT_MS', '10');
  let now = 1_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  const fetcher = vi.fn(async () => { now += 11; return response('v1'); });
  vi.stubGlobal('fetch', fetcher);
  const m = await import('../lib/server/recovery-notice-overrides');
  await expect(m.getRecoveryOverrides()).rejects.toThrow('NOTICE_UPDATE_TIME_BUDGET_EXCEEDED');
  expect(fetcher).toHaveBeenCalledOnce();
});

it.each(['0', '-1', 'NaN', '1.5', '1001'])('rejects an invalid configured page budget (%s) before any read', async value => {
  vi.stubEnv('SEEKOFFER_RECOVERY_MAX_PAGES', value);
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const m = await import('../lib/server/recovery-notice-overrides');
  await expect(m.getRecoveryOverrides()).rejects.toThrow('NOTICE_UPDATE_BUDGET_INVALID');
  expect(fetcher).not.toHaveBeenCalled();
});

it('fails closed on duplicate entries and private fields in public summaries', async () => {
  for (const items of [
    [tombstone('same'), tombstone('same')],
    [{id: 'a', visible: true, summary: {id: 'a', admin_review_note: 'PRIVATE'}}],
    [{id: 'custom-private', visible: true, summary: {id: 'custom-private'}}],
    [{id: 'a', visible: true, summary: {id: 'a', schoolName: {admin_review_note: 'PRIVATE'}}}],
    [{id: 'a', visible: true, summary: {id: 'a', tags: [{email: 'PRIVATE'}]}}]
  ]) {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response('v1', items)));
    const m = await import('../lib/server/recovery-notice-overrides');
    await expect(m.getRecoveryOverrides()).rejects.toThrow('NOTICE_UPDATE_DATA_INVALID');
  }
});

it('retains only tombstone fields for withdrawn notices and never serves a stale success after failure', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response('v1', [{id: 'a', visible: false, summary: {id: 'a', requirements: 'PRIVATE'}}]))
    .mockResolvedValueOnce(new Response('{}', {status: 503}));
  vi.stubGlobal('fetch', fetcher);
  const m = await import('../lib/server/recovery-notice-overrides');
  expect(await m.getRecoveryOverrides()).toEqual({version: 'v1', items: [tombstone('a')]});
  await expect(m.getRecoveryOverrides()).rejects.toMatchObject({status: 503});
});

it('reuses only a complete version after one new authoritative first-page check', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(response('v1', [tombstone('a')], 'notice_override:a'))
    .mockResolvedValueOnce(response('v1', [tombstone('b')]))
    .mockResolvedValueOnce(response('v1', [tombstone('a')], 'notice_override:a'));
  vi.stubGlobal('fetch', fetcher);
  const m = await import('../lib/server/recovery-notice-overrides');
  const complete = await m.getRecoveryOverrides();
  expect(await m.getRecoveryOverrides()).toBe(complete);
  expect(complete.items).toHaveLength(2);
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('a fetch or response-body timeout has an explicit bounded failure and is not retried', async () => {
  for (const fetcher of [
    vi.fn(async () => { throw new DOMException('upstream details', 'TimeoutError'); }),
    vi.fn(async () => new Response(new ReadableStream({start(controller) { controller.error(new DOMException('upstream details', 'TimeoutError')); }})))
  ]) {
    vi.resetModules(); vi.stubGlobal('fetch', fetcher);
    const m = await import('../lib/server/recovery-notice-overrides');
    await expect(m.getRecoveryOverrides()).rejects.toThrow('NOTICE_UPDATE_REQUEST_TIMEOUT');
    expect(fetcher).toHaveBeenCalledOnce();
  }
});

it.each([null, [], {}, {version: 'v1', items: [], nextCursor: 'bad'}])('rejects malformed data without a partial or stale result', async value => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(value)));
  const m = await import('../lib/server/recovery-notice-overrides');
  await expect(m.getRecoveryOverrides()).rejects.toMatchObject({status: 503});
});
