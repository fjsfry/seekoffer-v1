import 'server-only';
import {cache} from 'react';
import type {NoticeListItem} from '../notice-record';
import {ServiceUnavailableError} from '../service-availability';

type Entry = {id: string; visible: boolean; summary?: NoticeListItem};
type Snapshot = {version: string; items: Entry[]};
type Budget = {pages: number; bytes: number; deadline: number; maxPages: number; maxBytes: number};
const base = 'https://migration.seekoffer.com.cn';
const cursorPrefix = 'notice_override:';
const pageByteLimit = 512_000;
const summaryFields = new Set([
  'id', 'schoolName', 'departmentName', 'projectName', 'projectType', 'discipline',
  'publishDate', 'deadlineDate', 'deadlineLevel', 'tags', 'status', 'year',
  'sourceSite', 'sourceLink', 'applyLink', 'collectedAt', 'updatedAt', 'isVerified'
]);
let flight: Promise<Snapshot> | null = null;
let backoffUntil = 0;
let lastVerified: Snapshot | null = null;

function unavailable(code: string): never {
  throw new ServiceUnavailableError(503, code);
}

function configuredLimit(name: string, fallback: number, maximum: number) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) unavailable('NOTICE_UPDATE_BUDGET_INVALID');
  return value;
}

function remainingTime(budget: Budget) {
  const remaining = budget.deadline - Date.now();
  if (remaining <= 0) unavailable('NOTICE_UPDATE_TIME_BUDGET_EXCEEDED');
  return remaining;
}

async function readPage(response: Response, budget: Budget): Promise<unknown> {
  if (!response.body) unavailable('NOTICE_UPDATE_DATA_INVALID');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      remainingTime(budget);
      if (part.done) break;
      size += part.value.byteLength;
      budget.bytes += part.value.byteLength;
      if (size > pageByteLimit) unavailable('NOTICE_UPDATE_PAGE_TOO_LARGE');
      if (budget.bytes > budget.maxBytes) unavailable('NOTICE_UPDATE_BYTE_BUDGET_EXCEEDED');
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder().decode(bytes)); }
    catch { unavailable('NOTICE_UPDATE_DATA_INVALID'); }
  } finally {
    try { await reader.cancel(); } catch { /* Preserve the original validation or network failure. */ }
    reader.releaseLock();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function validatedEntry(value: unknown): Entry {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id || value.id.length > 180 ||
      /[\u0000-\u001f]/.test(value.id) || typeof value.visible !== 'boolean') unavailable('NOTICE_UPDATE_DATA_INVALID');
  // Tombstones cannot carry a formerly public body back into the recovered catalog.
  if (!value.visible) return {id: value.id, visible: false};
  const summary = value.summary;
  if (value.id.startsWith('custom-') || !isRecord(summary) || summary.id !== value.id ||
      Object.keys(summary).some(key => !summaryFields.has(key))) unavailable('NOTICE_UPDATE_DATA_INVALID');
  for (const [key, field] of Object.entries(summary)) {
    const valid = key === 'tags' ? Array.isArray(field) && field.every(tag => typeof tag === 'string') :
      key === 'year' ? typeof field === 'number' && Number.isSafeInteger(field) :
      key === 'isVerified' ? typeof field === 'boolean' : typeof field === 'string';
    if (!valid) unavailable('NOTICE_UPDATE_DATA_INVALID');
  }
  return {id: value.id, visible: true, summary: summary as NoticeListItem};
}

async function loadVersion(budget: Budget): Promise<Snapshot> {
  const items: Entry[] = [];
  const ids = new Set<string>();
  let cursor: string | null = null;
  let version: string | undefined;
  do {
    const timeout = Math.min(8_000, remainingTime(budget));
    if (budget.pages >= budget.maxPages) unavailable('NOTICE_UPDATE_PAGE_BUDGET_EXCEEDED');
    budget.pages++;
    const params = new URLSearchParams();
    if (cursor) params.set('after', cursor);
    if (version) params.set('version', version);
    const response = await fetch(base + '/v1/public/notice-overrides?' + params, {
      cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(timeout)
    });
    if (!response.ok) {
      try { await response.body?.cancel(); } catch { /* Error bodies are neither trusted nor logged. */ }
      if (response.status === 409) throw new ServiceUnavailableError(409, 'NOTICE_VERSION_CHANGED');
      if (response.status >= 300 && response.status < 400) throw new ServiceUnavailableError(502, 'NOTICE_SOURCE_REDIRECT_REJECTED');
      throw new ServiceUnavailableError(response.status, 'NOTICE_UPDATE_SOURCE_UNAVAILABLE');
    }
    const result = await readPage(response, budget);
    if (!isRecord(result) || typeof result.version !== 'string' || !result.version || result.version.length > 100 ||
        /[\u0000-\u001f]/.test(result.version) || (version && result.version !== version) ||
        !Array.isArray(result.items) || result.items.length > 100) unavailable('NOTICE_UPDATE_DATA_INVALID');
    const next = result.nextCursor;
    // Validate progress even on an empty page or before reusing a verified version.
    if (next !== null && (typeof next !== 'string' || next.length > 200 ||
        !next.startsWith(cursorPrefix) || /[\u0000-\u001f]/.test(next) || next <= (cursor ?? cursorPrefix))) {
      unavailable('NOTICE_CURSOR_INVALID');
    }
    for (const value of result.items) {
      const entry = validatedEntry(value);
      if (ids.has(entry.id)) unavailable('NOTICE_UPDATE_DATA_INVALID');
      ids.add(entry.id);
      items.push(entry);
    }
    // The authoritative first page checks the current version on every request.
    // Reuse only an earlier fully loaded version, never a partially read one.
    if (cursor === null && lastVerified?.version === result.version) return lastVerified;
    cursor = next as string | null;
    version = result.version;
  } while (cursor);
  const complete = {version: version!, items};
  lastVerified = complete;
  return complete;
}

async function load(): Promise<Snapshot> {
  if (process.env.SEEKOFFER_OFFLINE_BUILD === 'true') return {version: 'build-snapshot', items: []};
  if (Date.now() < backoffUntil) unavailable('NOTICE_UPDATE_SOURCE_UNAVAILABLE');
  // Budgets limit round trips, decoded bytes and latency rather than imposing a
  // silent 5,000-record ceiling. Both version attempts share these same budgets.
  const budget: Budget = {
    pages: 0, bytes: 0,
    maxPages: configuredLimit('SEEKOFFER_RECOVERY_MAX_PAGES', 250, 1_000),
    maxBytes: configuredLimit('SEEKOFFER_RECOVERY_MAX_BYTES', 32 * 1024 * 1024, 128 * 1024 * 1024),
    deadline: Date.now() + configuredLimit('SEEKOFFER_RECOVERY_TIMEOUT_MS', 30_000, 120_000)
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await loadVersion(budget); }
    catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        remainingTime(budget);
        unavailable('NOTICE_UPDATE_REQUEST_TIMEOUT');
      }
      if (!(error instanceof ServiceUnavailableError) || error.status !== 409) throw error;
      if (attempt === 1) unavailable('NOTICE_UPDATE_VERSION_UNSTABLE');
    }
  }
  return unavailable('NOTICE_UPDATE_VERSION_UNSTABLE');
}

export const getRecoveryOverrides = cache(async () => {
  if (flight) return flight;
  const current = load().catch(error => { backoffUntil = Date.now() + 5_000; throw error; });
  flight = current;
  try { return await current; }
  finally { if (flight === current) flight = null; }
});

export async function getUpdatedRecoveryDetail(id: string) {
  const response = await fetch(base + '/v1/public/notice-detail?' + new URLSearchParams({id}), {
    cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(8_000)
  });
  if (response.status >= 300 && response.status < 400) throw new ServiceUnavailableError(502, 'NOTICE_SOURCE_REDIRECT_REJECTED');
  if (response.status === 404) return null;
  if (!response.ok) throw new ServiceUnavailableError(response.status, 'NOTICE_DETAIL_UNAVAILABLE');
  const row = await response.json();
  if (!row || row.id !== id) unavailable('NOTICE_DETAIL_INVALID');
  return row;
}
