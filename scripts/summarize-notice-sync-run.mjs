import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {noticeSyncReceipt} from './notice-sync-report.mjs';

const outcomes = new Set(['success', 'failure', 'cancelled', 'skipped']);
const paths = new Set(['/v1/public/notice-overrides', '/v1/public/notice-version',
  '/api/public/notices/', '/api/public/notices/metadata/', '/api/public/notice-detail/']);
const code = value => /^[A-Z_0-9]{1,80}$/.test(value || '') ? value : null;
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const outcome = value => outcomes.has(value) ? value : 'skipped';
const isoDate = value => typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}T[\d:.]+Z$/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value) ? value : null;
const ingestCounts = ['mergedProjects', 'noticesReceived', 'noticesUpserted', 'unchanged', 'protected',
  'remainingCandidates', 'rowsRead', 'rowsWritten', 'completedBatches'];

export function readRunReceipt(file) {
  if (!file || !fs.existsSync(file)) return {state: 'MISSING'};
  try {
    if (fs.statSync(file).size > 256 * 1024) return {state: 'INVALID'};
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? {state: 'PRESENT', value} : {state: 'INVALID'};
  } catch { return {state: 'INVALID'}; }
}

function ingestionReceipt(input) {
  if (input.state !== 'PRESENT') return {receiptState: input.state};
  try {
    if (input.value.schemaVersion !== 1 || typeof input.value.complete !== 'boolean' ||
      !['d1.main__notices', 'dry-run'].includes(input.value.destination) ||
      ingestCounts.some(key => count(input.value[key]) === null)) throw Error();
    const clean = noticeSyncReceipt({...input.value, sourceStats: {maxSourcePublishDate: input.value.latestSourceDate}});
    return {receiptState: 'PRESENT', ...clean, at: isoDate(input.value.at)};
  } catch { return {receiptState: 'INVALID'}; }
}

function websiteReceipt(input) {
  if (input.state !== 'PRESENT') return {receiptState: input.state};
  const raw = input.value;
  if (!['WEBSITE_SYNC_VERIFIED', 'WEBSITE_SYNC_FAILED'].includes(raw.state)) return {receiptState: 'INVALID'};
  if (raw.state === 'WEBSITE_SYNC_VERIFIED' && (!uuid(raw.version) || count(raw.total) === null)) return {receiptState: 'INVALID'};
  const requests = Array.isArray(raw.requests) ? raw.requests.slice(0, 32).map(request => ({
    path: paths.has(request?.path) ? request.path : null,
    attempt: count(request?.attempt), status: count(request?.status),
    rowsRead: count(request?.rowsRead), rowsWritten: count(request?.rowsWritten),
    code: code(request?.code), sourceCode: code(request?.sourceCode),
    retryDelayMs: count(request?.retryDelayMs), elapsedMs: count(request?.elapsedMs)
  })) : [];
  return {receiptState: 'PRESENT', at: isoDate(raw.at), state: raw.state, code: code(raw.code),
    version: uuid(raw.version), total: count(raw.total), rowsRead: count(raw.rowsRead),
    latestDate: /^20\d{2}-\d{2}-\d{2}$/.test(raw.latestDate || '') ? raw.latestDate : null,
    detailChecked: raw.detailChecked === true, transientRetries: count(raw.transientRetries),
    failedPath: paths.has(raw.failedPath) ? raw.failedPath : null, requests};
}

// Stage outcomes are independent: a failed website check cannot turn completed
// D1 writes into an ingestion failure, and cannot make the overall run green.
export function noticeRunReport({preflightOutcome, ingestOutcome, websiteOutcome, dryRun = false,
  ingestion = {state: 'MISSING'}, website = {state: 'MISSING'}} = {}) {
  const preflight = outcome(preflightOutcome);
  const ingest = {outcome: outcome(ingestOutcome), ...ingestionReceipt(ingestion)};
  const site = {outcome: outcome(websiteOutcome), ...websiteReceipt(website)};
  const imported = ingest.outcome === 'success' && ingest.receiptState === 'PRESENT' && ingest.complete === true &&
    ingest.remainingCandidates === 0 && !ingest.stoppedReason && (!dryRun || ingest.rowsWritten === 0) &&
    ingest.destination === (dryRun ? 'dry-run' : 'd1.main__notices');
  const verified = site.outcome === 'success' && site.receiptState === 'PRESENT' && site.state === 'WEBSITE_SYNC_VERIFIED';
  const ok = preflight === 'success' && imported && (dryRun ? site.outcome === 'skipped' : verified);
  return {schemaVersion: 1, at: new Date().toISOString(), ok,
    state: ok ? (dryRun ? 'DRY_RUN_COMPLETE' : 'SYNC_AND_WEBSITE_VERIFIED') :
      [preflight, ingest.outcome, site.outcome].includes('cancelled') ? 'CANCELLED' : 'ATTENTION_REQUIRED',
    dryRun, preflight: {outcome: preflight}, ingestion: ingest, website: site, accountDataRead: false};
}

function ingestionLabel(stage) {
  if (stage.outcome === 'skipped') return 'Not run';
  if (stage.receiptState !== 'PRESENT') return `${stage.outcome}; receipt ${stage.receiptState.toLowerCase()}`;
  return `${stage.complete ? 'Complete' : 'Incomplete'}; step ${stage.outcome}`;
}
function websiteLabel(stage, dryRun) {
  if (stage.outcome === 'skipped') return dryRun ? 'Skipped for dry run' : 'Not run';
  if (stage.receiptState !== 'PRESENT') return `${stage.outcome}; receipt ${stage.receiptState.toLowerCase()}`;
  return `${stage.state === 'WEBSITE_SYNC_VERIFIED' ? 'Verified' : 'Failed'}; step ${stage.outcome}`;
}
export function formatNoticeRunSummary(report) {
  const ingest = report.ingestion, site = report.website;
  const lines = ['### Notice sync result', '', `Overall: **${report.state}**`, '',
    '| Stage | Result |', '| --- | --- |', `| Preflight | ${report.preflight.outcome} |`,
    `| Acquisition / D1 ingestion | ${ingestionLabel(ingest)} |`,
    `| Public website verification | ${websiteLabel(site, report.dryRun)} |`, ''];
  if (ingest.receiptState === 'PRESENT') lines.push(
    `Processed ${ingest.noticesReceived}; changed ${ingest.noticesUpserted}; unchanged ${ingest.unchanged}; protected ${ingest.protected}; remaining ${ingest.remainingCandidates}.`, '',
    `Ingestion reads ${ingest.rowsRead}, writes ${ingest.rowsWritten}; completed batches ${ingest.completedBatches}.`, '');
  if (ingest.stoppedReason) lines.push(`Ingestion stop: ${ingest.stoppedReason}.`, '');
  if (site.code) lines.push(`Website error: ${site.code}; endpoint: ${site.failedPath || 'unreported'}.`, '');
  if (ingest.complete && site.outcome === 'failure') lines.push('D1 ingestion completed. Website verification failed separately; completed writes are retained. A website check must not be repaired by replaying ingestion.', '');
  if ([ingest, site].some(stage => stage.outcome !== 'skipped' && stage.receiptState !== 'PRESENT')) lines.push('A receipt is missing or invalid. Its stage result is unknown beyond the Actions step outcome; no zero-work success is inferred.', '');
  lines.push('The retained diagnostic artifact contains only aggregate results and public endpoint status codes; no notices, account data, credentials or raw response bodies.', '');
  return lines.join('\n');
}

export function saveNoticeRunReport(env = process.env) {
  const report = noticeRunReport({preflightOutcome: env.NOTICE_PREFLIGHT_OUTCOME, ingestOutcome: env.NOTICE_INGEST_OUTCOME,
    websiteOutcome: env.NOTICE_WEBSITE_OUTCOME, dryRun: env.DRY_RUN === 'true',
    ingestion: readRunReceipt(env.NOTICE_SYNC_RECEIPT_PATH), website: readRunReceipt(env.NOTICE_WEBSITE_RECEIPT_PATH)});
  if (env.NOTICE_RUN_RECEIPT_PATH) fs.writeFileSync(env.NOTICE_RUN_RECEIPT_PATH, JSON.stringify(report, null, 2), {mode: 0o600});
  if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, formatNoticeRunSummary(report));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const report = saveNoticeRunReport();
  console.log(JSON.stringify(report));
  if (!report.ok) process.exitCode = 1;
}
