import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {noticeSyncReceipt} from '../scripts/notice-sync-report.mjs';
import {noticeRunReport, formatNoticeRunSummary, readRunReceipt, saveNoticeRunReport} from '../scripts/summarize-notice-sync-run.mjs';

const version = '11111111-2222-4333-8444-555555555555';
const ingestion = (patch = {}) => ({state: 'PRESENT', value: noticeSyncReceipt({destination: 'd1.main__notices',
  complete: true, noticesReceived: 2126, noticesUpserted: 6, unchanged: 1394, protected: 726,
  rowsRead: 4303, rowsWritten: 67, completedBatches: 355, ...patch})});
const website = (patch = {}) => ({state: 'PRESENT', value: {state: 'WEBSITE_SYNC_VERIFIED', version, total: 9976, ...patch}});
const run = (patch = {}) => noticeRunReport({preflightOutcome: 'success', ingestOutcome: 'success', websiteOutcome: 'success',
  ingestion: ingestion(), website: website(), ...patch});

test('completed ingestion and a failed website remain distinct and never produce a green run', () => {
  const report = run({websiteOutcome: 'failure', website: website({state: 'WEBSITE_SYNC_FAILED', code: 'WEBSITE_HTTP_503',
    failedPath: '/api/public/notices/', transientRetries: 2})});
  assert.equal(report.ok, false); assert.equal(report.ingestion.complete, true);
  assert.equal(report.ingestion.noticesUpserted, 6); assert.equal(report.website.state, 'WEBSITE_SYNC_FAILED');
  assert.match(formatNoticeRunSummary(report), /D1 ingestion completed\. Website verification failed separately/);
});

test('partial ingestion cannot be covered by a healthy website', () => {
  for (const ingestOutcome of ['success', 'failure']) {
    const report = run({ingestOutcome, ingestion: ingestion({complete: false, stoppedReason: 'INGEST_DAILY_BUDGET', remainingCandidates: 800})});
    assert.equal(report.ok, false); assert.equal(report.ingestion.remainingCandidates, 800);
    assert.equal(report.website.state, 'WEBSITE_SYNC_VERIFIED');
  }
});

test('only successful outcomes with complete valid receipts are considered verified', () => {
  assert.equal(run().state, 'SYNC_AND_WEBSITE_VERIFIED');
  for (const change of [{ingestOutcome: 'failure'}, {websiteOutcome: 'failure'}, {preflightOutcome: 'failure'},
    {ingestion: {state: 'MISSING'}}, {website: {state: 'INVALID'}}, {websiteOutcome: 'skipped'},
    {ingestion: {state: 'PRESENT', value: {schemaVersion: 1, destination: 'd1.main__notices', complete: true}}},
    {website: website({version: 'invalid'})}, {ingestion: ingestion({remainingCandidates: 3})}]) {
    assert.equal(run(change).ok, false);
  }
  assert.equal(run({ingestOutcome: 'cancelled', websiteOutcome: 'skipped'}).state, 'CANCELLED');
  const missing = run({ingestOutcome: 'failure', ingestion: {state: 'MISSING'}});
  assert.equal(missing.ingestion.noticesUpserted, undefined);
  assert.match(formatNoticeRunSummary(missing), /no zero-work success is inferred/);
});

test('dry runs explicitly skip website verification and cannot claim database writes', () => {
  const base = {dryRun: true, websiteOutcome: 'skipped', website: {state: 'MISSING'},
    ingestion: ingestion({destination: 'dry-run', noticesUpserted: 0, rowsWritten: 0})};
  assert.equal(run(base).state, 'DRY_RUN_COMPLETE');
  assert.equal(run({...base, ingestion: ingestion({destination: 'dry-run', rowsWritten: 1})}).ok, false);
  assert.equal(run({...base, ingestion: ingestion()}).ok, false);
});

test('retained diagnostic report strips arbitrary fields, query strings, credentials and raw errors', () => {
  const report = run({ingestion: {state: 'PRESENT', value: {...ingestion().value, secret: 'private-token', notices: [{email: 'private-email'}]}},
    website: website({error: 'private-body', requests: [{path: '/api/public/notices/?token=private-query', status: 503,
      error: 'private-cause', code: 'bad private error', sourceCode: 'bad private source', authorization: 'private-token'},
      {path: '/api/public/notices/', status: 503, code: 'WEBSITE_HTTP_503', rowsRead: 107}]})});
  const serialized = JSON.stringify(report);
  assert.ok(!serialized.includes('private-')); assert.ok(!serialized.includes('private '));
  assert.equal(report.website.requests[0].path, null); assert.equal(report.website.requests[1].rowsRead, 107);
});

test('CLI always writes a bounded diagnostic artifact, and a failed stage remains nonzero', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notice-run-report-'));
  try {
    const output = path.join(dir, 'result.json'), summary = path.join(dir, 'summary.md');
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/summarize-notice-sync-run.mjs', import.meta.url))], {
      env: {...process.env, DRY_RUN: 'false', NOTICE_PREFLIGHT_OUTCOME: 'success', NOTICE_INGEST_OUTCOME: 'failure',
        NOTICE_WEBSITE_OUTCOME: 'skipped', NOTICE_SYNC_RECEIPT_PATH: path.join(dir, 'missing.json'),
        NOTICE_WEBSITE_RECEIPT_PATH: path.join(dir, 'also-missing.json'), NOTICE_RUN_RECEIPT_PATH: output, GITHUB_STEP_SUMMARY: summary}, encoding: 'utf8'
    });
    assert.equal(result.status, 1); assert.equal(JSON.parse(fs.readFileSync(output)).state, 'ATTENTION_REQUIRED');
    assert.match(fs.readFileSync(summary, 'utf8'), /failure; receipt missing/);
    const broken = path.join(dir, 'broken.json'); fs.writeFileSync(broken, 'private malformed input');
    assert.deepEqual(readRunReceipt(broken), {state: 'INVALID'});
    fs.writeFileSync(broken, 'x'.repeat(256 * 1024 + 1));
    assert.deepEqual(readRunReceipt(broken), {state: 'INVALID'});
    assert.deepEqual(readRunReceipt(path.join(dir, 'missing.json')), {state: 'MISSING'});
    const input = path.join(dir, 'ingest.json'), websitePath = path.join(dir, 'website.json');
    fs.writeFileSync(input, JSON.stringify(ingestion().value)); fs.writeFileSync(websitePath, JSON.stringify(website().value));
    const good = saveNoticeRunReport({NOTICE_PREFLIGHT_OUTCOME: 'success', NOTICE_INGEST_OUTCOME: 'success', NOTICE_WEBSITE_OUTCOME: 'success',
      NOTICE_SYNC_RECEIPT_PATH: input, NOTICE_WEBSITE_RECEIPT_PATH: websitePath, NOTICE_RUN_RECEIPT_PATH: output});
    assert.equal(good.ok, true); assert.equal(JSON.parse(fs.readFileSync(output)).ok, true);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});
