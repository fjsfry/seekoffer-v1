import {ApiError} from './auth.ts';

const PREFIX = 'notice_override:';
const PAGE_SIZE = 100;
const MAX_BYTES = 512000;
const STATE_SQL = "SELECT key,value FROM _runtime_state WHERE key IN ('notice_version','notice_visibility_version')";
const PAGE_SQL = "SELECT key,value FROM _runtime_state WHERE key>? AND key<'notice_override;' ORDER BY key LIMIT 101";
const SUMMARY_TEXT_KEYS = new Set([
  'id', 'schoolName', 'departmentName', 'projectName', 'projectType', 'discipline',
  'publishDate', 'deadlineDate', 'deadlineLevel', 'status', 'sourceSite',
  'sourceLink', 'applyLink', 'collectedAt', 'updatedAt'
]);
type Row = {key: string; value: string};
type State = {version: string; visibilityVersion: string};
type Entry = {id: string; visible: boolean; summary?: Record<string, unknown>};
type Page = {version: string; items: Entry[]; nextCursor: string | null};

function invalid(): never { throw new ApiError(503, 'NOTICE_SOURCE_INVALID'); }
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown, limit: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= limit && !/[\u0000-\u001f]/.test(value);
}
function validId(value: unknown): value is string {
  return text(value, 180) && !value.startsWith('custom-');
}
function validCursor(value: unknown): value is string {
  return text(value, 200) && value.startsWith(PREFIX) && validId(value.slice(PREFIX.length));
}
function results(value: unknown, limit: number): Row[] {
  if (!record(value) || value.success === false || !Array.isArray(value.results) || value.results.length > limit) invalid();
  for (const row of value.results) {
    if (!record(row) || typeof row.key !== 'string' || typeof row.value !== 'string') invalid();
  }
  return value.results as Row[];
}
function state(rows: Row[]): State {
  if (rows.some((row) => !['notice_version', 'notice_visibility_version'].includes(row.key) || !text(row.value, 100)) ||
    new Set(rows.map((row) => row.key)).size !== rows.length) invalid();
  return {
    version: rows.find((row) => row.key === 'notice_version')?.value || 'initial',
    visibilityVersion: rows.find((row) => row.key === 'notice_visibility_version')?.value || 'initial'
  };
}
async function currentState(db: D1Database) {
  return state(results(await db.prepare(STATE_SQL).all<Row>(), 2));
}
function sameState(actual: State, expected: State) {
  if (actual.version !== expected.version || actual.visibilityVersion !== expected.visibilityVersion) {
    throw new ApiError(409, 'NOTICE_VERSION_CHANGED');
  }
}

function entry(value: unknown): Entry {
  if (!record(value) || !validId(value.id) || typeof value.visible !== 'boolean' ||
    Object.keys(value).some((key) => !['id', 'visible', 'summary'].includes(key))) invalid();
  if (!value.visible) {
    if ('summary' in value) invalid();
    return {id: value.id, visible: false};
  }
  const summary = value.summary;
  if (!record(summary) || summary.id !== value.id || summary.sourceSite === '用户手动录入') invalid();
  // Never forward arbitrary JSON from runtime state or the edge cache. Values
  // must match the public list contract; private fields and nested objects fail.
  for (const [key, field] of Object.entries(summary)) {
    if (SUMMARY_TEXT_KEYS.has(key)) { if (typeof field !== 'string') invalid(); }
    else if (key === 'tags') { if (!Array.isArray(field) || field.some((tag) => typeof tag !== 'string')) invalid(); }
    else if (key === 'year') { if (!Number.isSafeInteger(field)) invalid(); }
    else if (key === 'isVerified') { if (typeof field !== 'boolean') invalid(); }
    else invalid();
  }
  return {id: value.id, visible: true, summary: {...summary}};
}
function page(value: unknown, version: string, after: string): Page {
  if (!record(value) || Object.keys(value).some((key) => !['version', 'items', 'nextCursor'].includes(key)) ||
    value.version !== version || !Array.isArray(value.items) || value.items.length > PAGE_SIZE) invalid();
  const items = value.items.map(entry);
  let previous = after || PREFIX;
  for (const item of items) {
    const key = PREFIX + item.id;
    if (key <= previous) invalid();
    previous = key;
  }
  if (value.nextCursor !== null && (items.length !== PAGE_SIZE || value.nextCursor !== previous || !validCursor(value.nextCursor))) invalid();
  return {version, items, nextCursor: value.nextCursor as string | null};
}
function parsedEntry(row: Row): Entry {
  let value: unknown;
  try { value = JSON.parse(row.value); } catch { invalid(); }
  const item = entry(value);
  if (row.key !== PREFIX + item.id) invalid();
  return item;
}
function cacheKey(current: State, after: string) {
  // v2 entries came from an eagerly materialized snapshot and must not be reused
  // by the strict-current-version pagination contract.
  return new Request('https://migration.seekoffer.com.cn/_public-notice-shard/v3/' +
    encodeURIComponent(current.visibilityVersion) + '/' + encodeURIComponent(current.version) + '/' + encodeURIComponent(after || 'first'));
}
async function cachePage(response: Response, version: string, after: string) {
  if (!response.ok || !response.body) invalid();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BYTES) invalid();
      chunks.push(part.value);
    }
  } finally {
    try { await reader.cancel(); } catch { /* A broken cache stream is discarded. */ }
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return page(JSON.parse(new TextDecoder().decode(bytes)), version, after);
}

// A version check never loads overrides. It stays cheap as the catalog grows.
export async function readNoticeVersion(db: D1Database) {
  return {version: (await currentState(db)).version};
}

export async function readNoticeOverrides(db: D1Database, params: URLSearchParams): Promise<Page> {
  const after = params.get('after') || '';
  const requested = params.get('version');
  if ((after && !validCursor(after)) || (params.has('version') && !text(requested, 100)) ||
    [...params.keys()].some((key) => params.getAll(key).length !== 1 || !['after', 'version'].includes(key))) {
    throw new ApiError(400, 'INVALID_CURSOR');
  }
  const initial = await currentState(db);
  // Reject a stale requested version before consulting any cached page.
  if (requested !== null && requested !== initial.version) throw new ApiError(409, 'NOTICE_VERSION_CHANGED');
  const edgeCache = typeof caches === 'undefined' ? null : (caches as CacheStorage & {default: Cache}).default;
  const key = cacheKey(initial, after);
  let cached: Page | undefined;
  try {
    const hit = await edgeCache?.match(key);
    if (hit) cached = await cachePage(hit, initial.version, after);
  } catch { /* Cache failures/corruption fall back to the bounded D1 page. */ }
  if (cached) {
    // Moderation or ingestion may change while awaiting Cache API/body reads.
    sameState(await currentState(db), initial);
    return cached;
  }

  // One transactional read captures the state and at most 101 override records.
  // Binding an empty first cursor would include unrelated runtime state keys.
  const rows = await db.batch([db.prepare(STATE_SQL), db.prepare(PAGE_SQL).bind(after || PREFIX)]);
  if (!Array.isArray(rows) || rows.length !== 2) invalid();
  sameState(state(results(rows[0], 2)), initial);
  const entries = results(rows[1], PAGE_SIZE + 1);
  let previous = after || PREFIX;
  for (const row of entries) {
    if (!validCursor(row.key) || row.key <= previous) invalid();
    previous = row.key;
  }
  const selected = entries.slice(0, PAGE_SIZE);
  const result = page({version: initial.version, items: selected.map(parsedEntry),
    nextCursor: entries.length > PAGE_SIZE ? selected[PAGE_SIZE - 1].key : null}, initial.version, after);
  const encoded = JSON.stringify(result);
  if (new TextEncoder().encode(encoded).byteLength > MAX_BYTES) throw new ApiError(503, 'NOTICE_SHARD_TOO_LARGE');
  try {
    await edgeCache?.put(key, new Response(encoded, {headers: {'Content-Type': 'application/json', 'Cache-Control': 'public,max-age=300'}}));
  } catch { /* Cache is optional; no stale data is served on a cache failure. */ }
  sameState(await currentState(db), initial);
  return result;
}
