import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {noticeSyncReceipt} from '../scripts/notice-sync-report.mjs';

const envKeys = [
  'SEEKOFFER_INGEST_BACKEND', 'SEEKOFFER_INGEST_SECRET', 'INGEST_BATCH_SIZE',
  'INGEST_MAX_ATTEMPTS', 'INGEST_RETRY_BASE_DELAY_MS', 'INGEST_RETRY_MAX_DELAY_MS', 'DRY_RUN'
];
const savedEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
let ingest;
let originalFetch;

before(async () => {
  process.env.SEEKOFFER_INGEST_BACKEND = 'd1';
  process.env.SEEKOFFER_INGEST_SECRET = 'test-secret-that-is-long-enough-for-the-caller';
  process.env.INGEST_BATCH_SIZE = '6';
  process.env.INGEST_MAX_ATTEMPTS = '1';
  process.env.INGEST_RETRY_BASE_DELAY_MS = '1';
  process.env.INGEST_RETRY_MAX_DELAY_MS = '1';
  process.env.DRY_RUN = 'false';
  ingest = await import(`../scripts/sync-baoyan-notices-to-supabase.mjs?isolation-test=${Date.now()}`);
  originalFetch = globalThis.fetch;
});

after(() => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function notice(id, patch = {}) {
  return {
    id,
    school_name: '清华大学',
    department_name: '计算机学院',
    project_name: '2026 年夏令营通知',
    source_site: '保研通知网',
    source_link: `https://example.edu.cn/notice/${id}`,
    publish_date: '2026-10-01',
    requirements: '请查看公开通知。',
    ...patch
  };
}

function successResponse(count) {
  return new Response(JSON.stringify({ok: true, noticesReceived: count, noticesUpserted: count, unchanged: 0, protected: 0}), {
    status: 200,
    headers: {'content-type': 'application/json', 'x-d1-rows-read': String(count), 'x-d1-rows-written': String(count)}
  });
}

test('deterministic invalid record is recursively isolated and valid records continue', async () => {
  const calls = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init.body));
    calls.push(body.notices.map(row => row.id));
    if (body.notices.some(row => typeof row.requirements !== 'string')) {
      return new Response(JSON.stringify({error: 'INVALID_INGEST_TEXT'}), {status: 400});
    }
    return successResponse(body.notices.length);
  };

  const result = await ingest.pushProjectsToSupabase([
    notice('baoyantongzhi-good-a'),
    notice('baoyantongzhi-bad', {requirements: {unexpected: true}}),
    notice('baoyantongzhi-good-b')
  ], {syncMode: 'incremental'});

  assert.equal(result.complete, true);
  assert.equal(result.remainingCandidates, 0);
  assert.equal(result.noticesReceived, 3);
  assert.equal(result.noticesUpserted, 2);
  assert.equal(result.quarantinedCount, 1);
  assert.deepEqual(result.quarantined, [{id: 'baoyantongzhi-bad', code: 'INVALID_INGEST_TEXT'}]);
  assert.ok(calls.length >= 3, `expected recursive isolation calls, got ${calls.length}`);
  assert.ok(calls.some(ids => ids.length === 1 && ids[0] === 'baoyantongzhi-bad'));
  assert.ok(calls.some(ids => ids.length === 1 && ids[0] === 'baoyantongzhi-good-a'));
  assert.ok(calls.some(ids => ids.length === 1 && ids[0] === 'baoyantongzhi-good-b'));
});

test('transient or quota failures are never quarantined and retain incomplete semantics', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({error: 'INGEST_DAILY_BUDGET'}), {status: 402});
  const result = await ingest.pushProjectsToSupabase([
    notice('baoyantongzhi-a'), notice('baoyantongzhi-b')
  ], {syncMode: 'incremental'});
  assert.equal(result.complete, false);
  assert.equal(result.stoppedReason, 'SERVICE_QUOTA_EXCEEDED');
  assert.equal(result.remainingCandidates, 2);
  assert.equal(result.quarantinedCount, 0);
  assert.deepEqual(result.quarantined, []);
});

test('only known deterministic record codes are eligible for isolation', () => {
  for (const code of ['INVALID_INGEST_TEXT', 'INVALID_INGEST_ARRAY', 'INVALID_INGEST_HISTORY', 'INGEST_HISTORY_CAPACITY_REVIEW']) {
    assert.equal(ingest.isDeterministicRecordIngestError({ingestCode: code}), true);
  }
  for (const code of ['INGEST_CONFLICT', 'INGEST_DAILY_BUDGET', 'INVALID_INGEST_RECEIPT', 'NETWORK_FAILURE']) {
    assert.equal(ingest.isDeterministicRecordIngestError({ingestCode: code}), false);
  }
});

test('receipt keeps bounded sanitized repair metadata while preserving the full count', () => {
  const receipt = noticeSyncReceipt({destination: 'd1.main__notices', complete: true,
    mergedProjects: 3, noticesReceived: 3, noticesUpserted: 2, unchanged: 0, protected: 0,
    remainingCandidates: 0, rowsRead: 3, rowsWritten: 2, completedBatches: 2,
    quarantinedCount: 2, quarantined: [
      {id: 'baoyantongzhi-bad', code: 'INVALID_INGEST_TEXT'},
      {id: 'bad id with private text', code: 'private detail'}
    ]});
  assert.equal(receipt.quarantinedCount, 2);
  assert.deepEqual(receipt.quarantined, [
    {id: 'baoyantongzhi-bad', code: 'INVALID_INGEST_TEXT'},
    {id: 'record-2', code: 'INVALID_INGEST_RECORD'}
  ]);
});
