import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare, convertV4MiniflareOptions, Log, LogLevel} from 'miniflare';

test('actual Worker and D1 keep override reads bounded across 4,000 and 20,000 records', async () => {
  const bundled = await build({
    entryPoints: [fileURLToPath(new URL('../src/snapshot-worker.ts', import.meta.url))],
    bundle: true, format: 'esm', platform: 'browser', external: ['node:*'], write: false, logLevel: 'silent'
  });
  const options = convertV4MiniflareOptions({
    cf: false, modules: true, script: bundled.outputFiles[0].text,
    compatibilityDate: '2026-09-08', compatibilityFlags: ['nodejs_compat'],
    d1Databases: {CORE: 'synthetic-notice-overrides'}, d1Persist: false,
    log: new Log(LogLevel.ERROR),
    bindings: {MODE: 'local', ALLOWED_ORIGINS: 'http://127.0.0.1', BUSINESS_WRITES_ENABLED: 'false'},
    outboundService: () => { throw Error('EXTERNAL_NETWORK_FORBIDDEN'); }
  });
  options.telemetry = {enabled: false};
  const mf = new Miniflare(options);
  try {
    const db = await mf.getD1Database('CORE');
    await db.prepare('CREATE TABLE _runtime_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
    await db.batch([
      db.prepare("INSERT INTO _runtime_state(key,value) VALUES('notice_version','version-4001'),('notice_visibility_version','visibility-1'),('analytics-token','PRIVATE_SENTINEL'),('notice_override:','PRIVATE_PREFIX_SENTINEL'),('notice_override;','PRIVATE_UPPER_SENTINEL')"),
      db.prepare("WITH RECURSIVE seq(n) AS (SELECT 0 UNION ALL SELECT n+1 FROM seq WHERE n<4000) INSERT INTO _runtime_state(key,value) SELECT 'notice_override:notice-'||printf('%05d',n),json_object('id','notice-'||printf('%05d',n),'visible',json('false')) FROM seq")
    ]);
    const read = async (params = '') => {
      const response = await mf.dispatchFetch('http://127.0.0.1/v1/public/notice-overrides' + params);
      const raw = await response.text();
      assert.ok(!raw.includes('PRIVATE_SENTINEL') && !raw.includes('PRIVATE_PREFIX_SENTINEL') && !raw.includes('PRIVATE_UPPER_SENTINEL'));
      return {status: response.status, body: JSON.parse(raw), reads: Number(response.headers.get('x-d1-rows-read')),
        writes: Number(response.headers.get('x-d1-rows-written')), queries: Number(response.headers.get('x-d1-queries'))};
    };
    const first = await read();
    assert.equal(first.status, 200);
    assert.equal(first.body.items.length, 100);
    assert.equal(first.body.items[0].id, 'notice-00000');
    assert.equal(first.body.nextCursor, 'notice_override:notice-00099');
    assert.ok(first.reads <= 120, JSON.stringify(first));
    assert.ok(first.queries <= 4);
    assert.equal(first.writes, 0);
    const warm = await read();
    assert.deepEqual(warm.body, first.body);
    assert.ok(warm.reads <= 8, JSON.stringify(warm));
    assert.equal(warm.writes, 0);
    const tail = await read('?version=version-4001&after=notice_override%3Anotice-03999');
    assert.equal(tail.body.items.length, 1);
    assert.equal(tail.body.items[0].id, 'notice-04000');
    assert.equal(tail.body.nextCursor, null);

    await db.batch([
      db.prepare("WITH RECURSIVE seq(n) AS (SELECT 4001 UNION ALL SELECT n+1 FROM seq WHERE n<19999) INSERT INTO _runtime_state(key,value) SELECT 'notice_override:notice-'||printf('%05d',n),json_object('id','notice-'||printf('%05d',n),'visible',json('false')) FROM seq"),
      db.prepare("UPDATE _runtime_state SET value='version-20000' WHERE key='notice_version'")
    ]);
    const stale = await read('?version=version-4001');
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error, 'NOTICE_VERSION_CHANGED');
    assert.ok(stale.reads <= 4);
    const large = await read();
    assert.equal(large.status, 200);
    assert.equal(large.body.items.length, 100);
    assert.equal(large.reads, first.reads);
    assert.equal(large.writes, 0);
    const last = await read('?version=version-20000&after=notice_override%3Anotice-19899');
    assert.equal(last.body.items.length, 100);
    assert.equal(last.body.items.at(-1).id, 'notice-19999');
    assert.equal(last.body.nextCursor, null);
    const empty = await read('?version=version-20000&after=notice_override%3Anotice-19999');
    assert.deepEqual(empty.body, {version: 'version-20000', items: [], nextCursor: null});
    const plan = await db.prepare("EXPLAIN QUERY PLAN SELECT key,value FROM _runtime_state WHERE key>? AND key<'notice_override;' ORDER BY key LIMIT 101").bind('notice_override:').all();
    assert.ok(plan.results.some((row) => /SEARCH.*USING INDEX/i.test(row.detail)));
    assert.ok(!plan.results.some((row) => /SCAN _runtime_state|TEMP B-TREE/i.test(row.detail)));
    console.log(JSON.stringify({state: 'OVERRIDE_READER_WORKERD_VERIFIED', catalogSizes: [4001, 20000], coldRowsRead: first.reads,
      warmRowsRead: warm.reads, staleRowsRead: stale.reads, queries: first.queries, publicRowsWritten: 0, indexedRangeScan: true}));
  } finally {
    await mf.dispose();
  }
});
