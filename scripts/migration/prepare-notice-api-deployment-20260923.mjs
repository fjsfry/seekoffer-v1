import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {transform} from '../../workers/seekoffer-api/node_modules/esbuild/lib/main.js';

const worker = 'seekoffer-api-isolated-preview';
const expectedVersion = '51db5cb4-19ac-4957-834b-1d44d2bccbef';
const expectedLiveEntrySha = '197f013356e21979a1ec8f2aff2a7bb991451e07ed1485a703fdcf309b7c4dc8';
const root = process.cwd();
const dir = path.join(root, 'artifacts', 'notice-api-deploy-20260923');
const livePath = path.join(dir, 'live-acceptance-worker.js');
const candidatePath = path.join(dir, 'candidate-acceptance-worker.js');

function hash(value) { return createHash('sha256').update(value).digest('hex'); }
async function sourceReaderJavaScript() {
  const sourcePath = path.join(root, 'workers', 'seekoffer-api', 'src', 'notice-override-reader.ts');
  const source = fs.readFileSync(sourcePath, 'utf8')
    .replace(/^import \{ApiError\} from '\.\/auth\.ts';\r?\n/, '')
    .replace(/\bexport\s+(?=(?:async\s+)?function\b)/g, '');
  const output = (await transform(source, {loader:'ts',target:'es2022'})).code;
  assert.ok(!/^(?:import|export)\s/m.test(output), 'READER_MODULE_BOUNDARY');
  assert.match(output, /async function readNoticeOverrides\(db, params\)/, 'READER_FUNCTION_MISSING');
  assert.match(output, /LIMIT 101/, 'READER_PAGE_BOUND_MISSING');
  assert.match(output, /NOTICE_VERSION_CHANGED/, 'READER_VERSION_GUARD_MISSING');
  assert.ok(output.includes('_public-notice-shard/v3/'), 'READER_CACHE_NAMESPACE_MISSING');
  return output;
}
async function spliceReader(live) {
  assert.equal(hash(live), expectedLiveEntrySha, 'LIVE_ENTRY_CHANGED');
  const start = live.indexOf('async function readNoticeOverrides(db, params) {');
  const end = live.indexOf('\nasync function readOverrideDetail', start);
  assert.ok(start > 0 && end > start, 'LIVE_READER_REGION_NOT_FOUND');
  assert.equal(live.indexOf('async function readNoticeOverrides(db, params) {', start + 1), -1, 'DUPLICATE_LIVE_READER');
  const compiled = await sourceReaderJavaScript();
  const replacement = `const readNoticeOverrides = (() => {\n${compiled}\nreturn readNoticeOverrides;\n})();`;
  const candidate = live.slice(0, live.lastIndexOf('\n', start) + 1) + replacement + live.slice(end);
  assert.ok(!candidate.includes('SNAPSHOT_REFRESH_REQUIRED'), 'OLD_CAPACITY_GUARD_REMAINS');
  assert.match(candidate, /LIMIT 101/);
  assert.ok(candidate.includes('_public-notice-shard/v3/'));
  assert.equal(candidate.slice(0, live.lastIndexOf('\n', start) + 1), live.slice(0, live.lastIndexOf('\n', start) + 1));
  assert.equal(candidate.slice(candidate.indexOf('\nasync function readOverrideDetail')), live.slice(end));
  return {candidate, oldRegionSha: hash(live.slice(start, end)), newRegionSha: hash(replacement), oldRegionBytes: end - start, newRegionBytes: replacement.length};
}

const live = fs.readFileSync(livePath, 'utf8');
const result = await spliceReader(live);
fs.writeFileSync(candidatePath, result.candidate);
const state = JSON.parse(fs.readFileSync(path.join(dir, 'live-state.json'), 'utf8'));
assert.equal(state.current.versions[0].version_id, expectedVersion, 'LIVE_STATE_VERSION_CHANGED');
assert.equal(state.modules.find((module) => module.name === 'acceptance-worker.js')?.sha256, expectedLiveEntrySha, 'LIVE_STATE_ENTRY_CHANGED');
const receipt = {
  at: new Date().toISOString(), worker, expectedVersion, oldEntrySha256: hash(live), newEntrySha256: hash(result.candidate),
  oldRegionSha256: result.oldRegionSha, newRegionSha256: result.newRegionSha, oldRegionBytes: result.oldRegionBytes,
  newRegionBytes: result.newRegionBytes, secretBindingsPreservedByName: state.settings.bindings
    .filter((binding) => binding.type === 'secret_text').map((binding) => binding.name).sort(),
  d1BindingId: state.settings.bindings.find((binding) => binding.name === 'CORE')?.id,
  route: state.domains.find((domain) => domain.service === worker)?.hostname || null,
  databaseWrites: 0, state: 'PREFLIGHT_PASSED'
};
fs.writeFileSync(path.join(dir, 'candidate-preflight.json'), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt));
