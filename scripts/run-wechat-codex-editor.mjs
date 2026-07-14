import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const workingDirectory = path.join(repositoryRoot, '.wechat-codex');

function readArgument(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || fallback) : fallback;
}

function getBeijingDateString(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function validateDate(value) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid --target-date value: ${value}`);
  }
  return value;
}

function parseJsonCandidates(output) {
  const normalized = String(output).replace(/\u001b\[[0-9;]*m/g, '');
  const candidates = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse();

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // CloudBase prints progress lines before its final JSON payload.
    }
  }

  for (let index = normalized.indexOf('{'); index >= 0; index = normalized.indexOf('{', index + 1)) {
    try {
      return JSON.parse(normalized.slice(index).trim());
    } catch {
      // Try the next object boundary.
    }
  }
  throw new Error('CloudBase did not return a JSON payload');
}

function findNested(value, predicate, seen = new Set()) {
  if (typeof value === 'string') {
    try {
      return findNested(JSON.parse(value), predicate, seen);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  if (predicate(value)) return value;
  for (const child of Object.values(value)) {
    const result = findNested(child, predicate, seen);
    if (result) return result;
  }
  return null;
}

function invokeCloudBase(event) {
  const executable = process.platform === 'win32' ? process.execPath : 'npx';
  const npxArguments = process.platform === 'win32'
    ? [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js')]
    : [];
  const output = execFileSync(executable, [
    ...npxArguments,
    '--yes',
    '--package',
    '@cloudbase/cli',
    'tcb',
    'fn',
    'invoke',
    'wechat-daily-digest',
    '--params',
    JSON.stringify(event),
    '--json'
  ], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return parseJsonCandidates(output);
}

function validateEditorialFile(editorial) {
  const keys = editorial && typeof editorial === 'object' && !Array.isArray(editorial)
    ? Object.keys(editorial).sort()
    : [];
  if (keys.join(',') !== 'lead,selectedNoticeIds,titleHook') {
    throw new Error('Editorial JSON must contain only titleHook, lead, and selectedNoticeIds');
  }
  if (typeof editorial.titleHook !== 'string' || typeof editorial.lead !== 'string') {
    throw new Error('Editorial titleHook and lead must be strings');
  }
  if (!Array.isArray(editorial.selectedNoticeIds) || editorial.selectedNoticeIds.length < 1) {
    throw new Error('Editorial selectedNoticeIds must contain 1-3 notice IDs');
  }
  return editorial;
}

async function createBrief(targetDate) {
  const payload = invokeCloudBase({
    dryRun: true,
    includeEditorialBrief: true,
    targetDate
  });
  const result = findNested(payload, (value) => value?.ok === true && value?.editorialBrief?.targetDate);
  if (!result) throw new Error('CloudBase response did not contain an editorial brief');

  await mkdir(workingDirectory, { recursive: true });
  const briefPath = path.join(workingDirectory, `brief-${targetDate}.json`);
  await writeFile(briefPath, `${JSON.stringify(result.editorialBrief, null, 2)}\n`, 'utf8');
  return {
    ok: true,
    mode: 'brief',
    targetDate,
    noticeCount: Number(result.editorialBrief.noticeCount || 0),
    briefPath
  };
}

async function publishEditorial(targetDate, editorialPath) {
  const editorial = validateEditorialFile(JSON.parse(await readFile(editorialPath, 'utf8')));
  const payload = invokeCloudBase({ targetDate, force: true, editorial });
  const result = findNested(
    payload,
    (value) => value?.ok === true && value?.targetDate === targetDate && value?.editorialSource
  );
  if (!result) throw new Error('CloudBase response did not contain a publish result');
  if (result.editorialSource !== 'codex') {
    throw new Error(`Unexpected editorial source: ${result.editorialSource}`);
  }

  await mkdir(workingDirectory, { recursive: true });
  const resultPath = path.join(workingDirectory, `result-${targetDate}.json`);
  const auditResult = {
    ok: true,
    targetDate,
    noticeCount: Number(result.noticeCount || 0),
    includedCount: Number(result.includedCount || 0),
    articleTitle: String(result.articleTitle || ''),
    editorialSource: result.editorialSource,
    editorialModel: String(result.editorialModel || ''),
    mediaId: String(result.mediaId || ''),
    thumbMediaId: String(result.thumbMediaId || '')
  };
  await writeFile(resultPath, `${JSON.stringify(auditResult, null, 2)}\n`, 'utf8');
  return { ...auditResult, mode: 'publish', resultPath };
}

const mode = String(process.argv[2] || '').trim();
const targetDate = validateDate(readArgument('--target-date', getBeijingDateString()));

if (mode === 'brief') {
  console.log(JSON.stringify(await createBrief(targetDate)));
} else if (mode === 'publish') {
  const editorialPath = path.resolve(
    repositoryRoot,
    readArgument('--editorial-file', path.join(workingDirectory, `editorial-${targetDate}.json`))
  );
  console.log(JSON.stringify(await publishEditorial(targetDate, editorialPath)));
} else {
  throw new Error('Usage: node scripts/run-wechat-codex-editor.mjs <brief|publish> [--target-date YYYY-MM-DD]');
}
