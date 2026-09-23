import test, {afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import type {D1Database, D1PreparedStatement} from '@cloudflare/workers-types';
import {readNoticeOverrides, readNoticeVersion} from '../src/notice-override-reader.ts';

const VERSION = '11111111-2222-4333-8444-555555555555';
const NEXT_VERSION = '11111111-2222-4333-8444-666666666666';
const PREFIX = 'notice_override:';
const originalCache = Object.getOwnPropertyDescriptor(globalThis, 'caches');
const databases: DatabaseSync[] = [];
afterEach(() => {
  for (const db of databases.splice(0)) db.close();
  if (originalCache) Object.defineProperty(globalThis, 'caches', originalCache);
  else Reflect.deleteProperty(globalThis, 'caches');
});

function id(index: number) { return 'notice-' + String(index).padStart(5, '0'); }
function item(index: number) {
  return {id: id(index), visible: true, summary: {id: id(index), projectName: '合成通知', sourceSite: '合成公开来源'}};
}
function fixture(count: number) {
  const sqlite = new DatabaseSync(':memory:');
  databases.push(sqlite);
  sqlite.exec('CREATE TABLE _runtime_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  const insert = sqlite.prepare('INSERT INTO _runtime_state(key,value) VALUES(?,?)');
  sqlite.exec('BEGIN');
  for (let i = 0; i < count; i++) insert.run(PREFIX + id(i), JSON.stringify(item(i)));
  insert.run('notice_version', VERSION);
  insert.run('notice_visibility_version', 'visibility-1');
  insert.run('analytics-private-token', 'DO_NOT_EXPOSE_PRIVATE_RUNTIME_STATE');
  insert.run('notice_ingest_day:2026-09-23', 'DO_NOT_EXPOSE_INGEST_COUNTER');
  insert.run('notice_override:', 'DO_NOT_EXPOSE_PREFIX_SENTINEL');
  insert.run('notice_override;', 'DO_NOT_EXPOSE_UPPER_BOUND');
  sqlite.exec('COMMIT');
  const calls: {sql: string; params: unknown[]; rows: number}[] = [];
  const hooks: {beforeBatch?: () => void; afterBatch?: () => void} = {};
  function prepared(sql: string, params: unknown[] = []): D1PreparedStatement {
    return {
      bind(...values: unknown[]) { return prepared(sql, values); },
      async all() {
        assert.ok(sql.startsWith('SELECT '), 'public reader must remain read-only');
        const values = sqlite.prepare(sql).all(...params as string[]);
        calls.push({sql, params, rows: values.length});
        return {results: values, success: true, meta: {rows_read: values.length, rows_written: 0}};
      },
      async run() { throw Error('DATABASE_WRITE_FORBIDDEN'); }
    } as unknown as D1PreparedStatement;
  }
  const db = {
    prepare: prepared,
    async batch(statements: D1PreparedStatement[]) {
      hooks.beforeBatch?.();
      const value = await Promise.all(statements.map((statement) => statement.all()));
      hooks.afterBatch?.();
      return value;
    }
  } as unknown as D1Database;
  return {db, sqlite, calls, hooks,
    updateVersion(value = NEXT_VERSION) { sqlite.prepare("UPDATE _runtime_state SET value=? WHERE key='notice_version'").run(value); },
    updateVisibility() { sqlite.prepare("UPDATE _runtime_state SET value='visibility-2' WHERE key='notice_visibility_version'").run(); },
    get pages() { return calls.filter((call) => call.sql.includes('LIMIT 101')); },
    get rowsRead() { return calls.reduce((sum, call) => sum + call.rows, 0); }
  };
}

function cacheFixture() {
  const values = new Map<string, string>();
  const matches: string[] = [], puts: string[] = [];
  const cache = {
    async match(request: Request) {
      matches.push(request.url);
      const value = values.get(request.url);
      return value === undefined ? undefined : new Response(value);
    },
    async put(request: Request, response: Response) {
      puts.push(request.url);
      values.set(request.url, await response.text());
    }
  };
  Object.defineProperty(globalThis, 'caches', {configurable: true, value: {default: cache}});
  return {cache, values, matches, puts};
}

test('first and subsequent pages stay bounded beyond 4,000 and 20,000 overrides', async () => {
  for (const count of [4001, 20000]) {
    const f = fixture(count), cache = cacheFixture();
    const first = await readNoticeOverrides(f.db, new URLSearchParams());
    assert.equal(first.items.length, 100);
    assert.equal(first.items[0].id, id(0));
    assert.equal(first.nextCursor, PREFIX + id(99));
    assert.equal(f.pages.length, 1);
    assert.deepEqual(f.pages[0].params, [PREFIX]);
    assert.equal(f.pages[0].rows, 101);
    assert.equal(f.rowsRead, 107);
    assert.ok(!JSON.stringify(first).includes('DO_NOT_EXPOSE'));
    assert.equal(cache.puts.length, 1, 'only the requested page is cached');
    assert.ok(cache.puts[0].includes('/v3/'));
    const second = await readNoticeOverrides(f.db, new URLSearchParams({after: first.nextCursor!, version: VERSION}));
    assert.equal(second.items[0].id, id(100));
    assert.equal(second.nextCursor, PREFIX + id(199));
    assert.equal(f.rowsRead, 214);
    assert.equal(f.pages.length, 2);
  }
});

test('keyset traversal returns every row exactly once, with last and empty pages', async () => {
  const f = fixture(4501);
  let after: string | null = null;
  const ids: string[] = [];
  do {
    const params = new URLSearchParams({version: VERSION});
    if (after) params.set('after', after);
    const result = await readNoticeOverrides(f.db, params);
    ids.push(...result.items.map((row) => row.id));
    after = result.nextCursor;
  } while (after);
  assert.deepEqual(ids, Array.from({length: 4501}, (_, index) => id(index)));
  assert.equal(f.pages.length, 46);
  assert.ok(f.pages.every((query) => query.rows <= 101));
  const empty = await readNoticeOverrides(f.db, new URLSearchParams({after: PREFIX + id(4500), version: VERSION}));
  assert.deepEqual(empty, {version: VERSION, items: [], nextCursor: null});
  const blank = fixture(0);
  assert.deepEqual(await readNoticeOverrides(blank.db, new URLSearchParams()), {version: VERSION, items: [], nextCursor: null});
  for (const count of [100, 200]) {
    const exact = fixture(count);
    const last = await readNoticeOverrides(exact.db, new URLSearchParams(count === 200 ? {after: PREFIX + id(99)} : {}));
    assert.equal(last.items.length, 100);
    assert.equal(last.nextCursor, null);
  }
});

test('warm cache uses only four state rows and a stale requested version never reaches cache', async () => {
  const f = fixture(4501), c = cacheFixture();
  const initial = await readNoticeOverrides(f.db, new URLSearchParams());
  const before = f.rowsRead;
  assert.deepEqual(await readNoticeOverrides(f.db, new URLSearchParams()), initial);
  assert.equal(f.rowsRead - before, 4);
  assert.equal(f.pages.length, 1);
  assert.equal(c.puts.length, 1);
  f.updateVersion();
  const matches = c.matches.length;
  await assert.rejects(readNoticeOverrides(f.db, new URLSearchParams({version: VERSION})), {status: 409, message: 'NOTICE_VERSION_CHANGED'});
  assert.equal(c.matches.length, matches);
  assert.equal(f.pages.length, 1);
});

test('legacy v2 cache shards are ignored', async () => {
  const f = fixture(1), c = cacheFixture();
  const oldKey = 'https://migration.seekoffer.com.cn/_public-notice-shard/v2/visibility-1/' + VERSION + '/first';
  c.values.set(oldKey, JSON.stringify({version: VERSION, items: [], nextCursor: null}));
  assert.equal((await readNoticeOverrides(f.db, new URLSearchParams())).items.length, 1);
  assert.ok(c.matches.every((key) => key.includes('/v3/')));
});

test('version or visibility changes during a cached read reject the stale response', async () => {
  for (const kind of ['version', 'visibility']) {
    const f = fixture(1), c = cacheFixture();
    await readNoticeOverrides(f.db, new URLSearchParams());
    const original = c.cache.match;
    c.cache.match = async (request) => {
      const hit = await original(request);
      if (kind === 'version') f.updateVersion(); else f.updateVisibility();
      return hit;
    };
    await assert.rejects(readNoticeOverrides(f.db, new URLSearchParams()), {status: 409, message: 'NOTICE_VERSION_CHANGED'});
    assert.equal(f.pages.length, 1);
  }
});

test('concurrent changes before, after, or during cache publication cannot mix snapshots', async () => {
  for (const phase of ['beforeBatch', 'afterBatch', 'cachePut']) {
    for (const kind of ['version', 'visibility']) {
      const f = fixture(1), c = cacheFixture();
      const update = () => kind === 'version' ? f.updateVersion() : f.updateVisibility();
      if (phase === 'cachePut') {
        const original = c.cache.put;
        c.cache.put = async (...args) => { await original(...args); update(); };
      } else f.hooks[phase as 'beforeBatch' | 'afterBatch'] = update;
      await assert.rejects(readNoticeOverrides(f.db, new URLSearchParams()), {status: 409, message: 'NOTICE_VERSION_CHANGED'});
      assert.equal(f.pages.length, 1);
    }
  }
});

test('cache failures and corrupt cached bodies fall back to one bounded database page', async () => {
  for (const fault of ['match', 'put', 'json', 'private', 'oversized', 'cursor']) {
    const f = fixture(1), c = cacheFixture();
    if (fault === 'match') c.cache.match = async () => { throw Error('cache unavailable'); };
    if (fault === 'put') c.cache.put = async () => { throw Error('cache unavailable'); };
    if (fault === 'json') c.cache.match = async () => new Response('invalid JSON');
    if (fault === 'oversized') c.cache.match = async () => new Response('x'.repeat(512001));
    if (fault === 'private') c.cache.match = async () => Response.json({version: VERSION, items: [{...item(0), secret: 'PRIVATE_SENTINEL'}], nextCursor: null});
    if (fault === 'cursor') c.cache.match = async () => Response.json({version: VERSION, items: [item(0)], nextCursor: PREFIX + id(0)});
    const result = await readNoticeOverrides(f.db, new URLSearchParams());
    assert.equal(result.items[0].id, id(0));
    assert.equal(f.pages.length, 1);
    assert.ok(!JSON.stringify(result).includes('PRIVATE_SENTINEL'));
  }
});

test('malformed database payloads fail closed without exposing private fields', async () => {
  const valid = item(0);
  const payloads = [
    'not JSON', JSON.stringify({...valid, email: 'PRIVATE_SENTINEL'}),
    JSON.stringify({...valid, summary: {...valid.summary, admin_review_note: 'PRIVATE_SENTINEL'}}),
    JSON.stringify({...valid, summary: {...valid.summary, projectName: {secret: 'PRIVATE_SENTINEL'}}}),
    JSON.stringify({...valid, summary: {...valid.summary, tags: [{secret: 'PRIVATE_SENTINEL'}]}}),
    JSON.stringify({...valid, id: 'different-id'}), JSON.stringify({...valid, visible: false}),
    JSON.stringify({...valid, summary: {...valid.summary, sourceSite: '用户手动录入'}}),
    JSON.stringify({...valid, id: 'custom-private', summary: {id: 'custom-private'}})
  ];
  for (const payload of payloads) {
    const f = fixture(1);
    f.sqlite.prepare('UPDATE _runtime_state SET value=? WHERE key=?').run(payload, PREFIX + id(0));
    await assert.rejects(readNoticeOverrides(f.db, new URLSearchParams()), (error: unknown) => {
      assert.equal((error as Error).message, 'NOTICE_SOURCE_INVALID');
      assert.ok(!String(error).includes('PRIVATE_SENTINEL'));
      return true;
    });
  }
  const hidden = fixture(1);
  hidden.sqlite.prepare('UPDATE _runtime_state SET value=? WHERE key=?').run(JSON.stringify({id: id(0), visible: false}), PREFIX + id(0));
  assert.deepEqual((await readNoticeOverrides(hidden.db, new URLSearchParams())).items, [{id: id(0), visible: false}]);
});

test('invalid cursors and duplicate or unknown query parameters are rejected before reads', async () => {
  for (const query of ['after=analytics-private-token', 'after=notice_override:', 'after=notice_override%3Acustom-private',
    'after=notice_override%3Aone%00', 'version=', 'version=a&version=b', 'after=a&after=b', 'random=x', 'version=' + 'x'.repeat(101)]) {
    const f = fixture(1);
    await assert.rejects(readNoticeOverrides(f.db, new URLSearchParams(query)), {status: 400, message: 'INVALID_CURSOR'});
    assert.equal(f.calls.length, 0);
  }
});

test('version-only read has a constant two-row cost with no override or cache access', async () => {
  const f = fixture(20000), c = cacheFixture();
  assert.deepEqual(await readNoticeVersion(f.db), {version: VERSION});
  assert.equal(f.rowsRead, 2);
  assert.equal(f.pages.length, 0);
  assert.equal(c.matches.length, 0);
  assert.equal(c.puts.length, 0);
});
