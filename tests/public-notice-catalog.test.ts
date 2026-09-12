import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({ cache: new Map<string, unknown>(), calls: [] as { columns: string; ids?: string[]; id?: string }[], rows: [] as Record<string, unknown>[], status: 200 }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: (fn: (...a: unknown[]) => unknown, keys: string[]) => async (...args: unknown[]) => {
  const key = JSON.stringify([keys, args]);
  if (!state.cache.has(key)) state.cache.set(key, await fn(...args));
  return state.cache.get(key);
} }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: () => {
  const call: { columns: string; ids?: string[]; id?: string } = { columns: '' }; state.calls.push(call);
  const result = (rows: unknown) => ({ data: state.status === 200 ? rows : null, error: state.status === 200 ? null : { message: 'upstream' }, status: state.status });
  const query = {
    select: (columns: string) => { call.columns = columns; return query; },
    eq: (key: string, value: string) => { if (key === 'id') call.id = value; return query; },
    is: () => query, order: () => query, gte: () => query, lt: () => query,
    in: (_key: string, ids: string[]) => { call.ids = ids; return query; },
    range: (from: number, to: number) => Promise.resolve(result(state.rows.slice(from, to + 1))),
    maybeSingle: () => Promise.resolve(result(state.rows.find(row => row.id === call.id) || null)),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result(state.rows.filter(row => call.ids?.includes(String(row.id))))).then(resolve)
  }; return query;
} }) }));
import { getPublicNoticeCatalog, getPublicNoticesByIds, getCachedNoticeById } from '@/lib/server/public-notice-catalog';
import { NOTICE_SHARD_BYTES } from '@/lib/server/notice-snapshot-cache';
describe('emergency public read boundaries', () => {
 beforeEach(() => {
  state.cache.clear(); state.calls.length = 0; state.status = 200;
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'fixture');
  state.rows = Array.from({length: 205}, (_, i) => ({ id: 'id-' + i, school_name: '北京大学', department_name: '计算机学院', project_name: '2026年计算机推免招生通知 ' + i, project_type: '预推免', discipline: '计算机科学与技术', publish_date: '2026-09-07', deadline_date: '2026-09-20', year: 2026, source_link: 'https://example.edu.cn/n/' + i }));
 });
 afterEach(() => vi.unstubAllEnvs());
 it('queries only requested IDs, batches over 100, deduplicates and never scans the catalog', async () => {
  const result = await getPublicNoticesByIds([...state.rows.map(r => String(r.id)), 'id-0']);
  expect(result.items).toHaveLength(205); expect(state.calls.map(c => c.ids?.length)).toEqual([100,100,5]);
  expect(state.calls.every(c => !!c.ids && !c.columns.includes('requirements'))).toBe(true);
 });
 it('does not query for an empty ID list', async () => { await getPublicNoticesByIds([]); expect(state.calls).toHaveLength(0); });
 it('uses one immutable manifest across shards and serves a warm request without another scan', async () => {
  state.rows = Array.from({length:820},(_,i)=>({...state.rows[0],id:'shard-'+i}));
  const first = await getPublicNoticeCatalog(); const calls = state.calls.length;
  const second = await getPublicNoticeCatalog();
  expect(first.items).toHaveLength(820); expect(second.version).toBe(first.version); expect(state.calls.length).toBe(calls);
  expect([...state.cache.keys()].filter(k=>k.includes('immutable-shard')).length).toBeGreaterThan(1);
  for (const [key, value] of state.cache) if(key.includes('immutable-shard')) expect(Buffer.byteLength(JSON.stringify(value))).toBeLessThanOrEqual(NOTICE_SHARD_BYTES);
 });
 it('fails closed on an evicted shard without rescanning or substituting another version', async () => {
  await getPublicNoticeCatalog(); const before=state.calls.length;
  const key=[...state.cache.keys()].find(k=>k.includes('immutable-shard'))!;state.cache.delete(key);
  await expect(getPublicNoticeCatalog()).rejects.toMatchObject({status:503});expect(state.calls.length).toBe(before);
 });
 it('serves authoritative empty results and no bundled seed', async () => { state.rows = []; expect((await getPublicNoticeCatalog()).items).toEqual([]); });
 it.each([401,403,402,503])('preserves HTTP %s and caches the failure to bound origin retries', async status => {
  state.status = status;
  await expect(getPublicNoticeCatalog()).rejects.toMatchObject({ status });
  await expect(getPublicNoticeCatalog()).rejects.toMatchObject({ status });
  expect(state.calls).toHaveLength(1);
 });
 it('details query one record; a withdrawn record remains absent after cache invalidation', async () => {
  expect((await getCachedNoticeById('id-0'))?.id).toBe('id-0');
  expect(state.calls).toHaveLength(1); expect(state.calls[0].id).toBe('id-0');
  state.rows = state.rows.filter(r=>r.id !== 'id-0'); state.cache.clear();
  expect(await getCachedNoticeById('id-0')).toBeNull();
  expect((await getPublicNoticeCatalog()).items.some(i=>i.id === 'id-0')).toBe(false);
 });
 it('rejects missing credentials instead of enabling an old public fallback', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', ''); await expect(getPublicNoticeCatalog()).rejects.toMatchObject({ status:503 });
 });
});
