import type {NoticeSearchFilters} from './notice-query';
import {validateNativeNoticeResponse, type NativeNoticeResponse} from './native-notice-metadata';

export const NATIVE_NOTICE_FRESH_MS = 5 * 60_000;
export const NATIVE_NOTICE_MAX_AGE_MS = 15 * 60_000;
const RETRY_MS = 15_000;
type Options = {refresh?: boolean; pageSize?: number};
type CacheEntry = {data: NativeNoticeResponse; savedAt: number; retryAt: number};
type Flight = {promise: Promise<NativeNoticeResponse>; consumers: number};

export function nativeNoticeQuery(filters: NoticeSearchFilters, page: number, pageSize = 16) {
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 40) {
    throw new Error('通知页码无效。');
  }
  const params = new URLSearchParams({page: String(page), pageSize: String(pageSize), year: filters.year, sort: filters.sortBy});
  for (const [field, key] of [['keyword','q'],['schoolName','school'],['region','region'],['majorKeyword','major'],['category','category'],['discipline','discipline'],['schoolRange','range'],['progress','status'],['deadlineQuick','deadline'],['fresh','fresh'],['publishDate','date'],['projectType','type'],['noticeKind','kind']] as const) {
    const value = filters[field].trim();
    if (value && value !== '全部') params.set(key, value);
  }
  return params.toString();
}

function abortError() { return new DOMException('Aborted', 'AbortError'); }

export function createNativeNoticeClient(read: (path: string) => Promise<unknown>, now = Date.now) {
  const cache = new Map<string, CacheEntry>();
  const flights = new Map<string, Flight>();
  function snapshot(filters: NoticeSearchFilters, page = 1, pageSize = 16) {
    const key = nativeNoticeQuery(filters, page, pageSize);
    const entry = cache.get(key);
    if (!entry) return null;
    if (now() - entry.savedAt >= NATIVE_NOTICE_MAX_AGE_MS) { cache.delete(key); return null; }
    const freshness = entry.data.metadataStale ? 30_000 : NATIVE_NOTICE_FRESH_MS;
    const stale = entry.data.stale || now() - entry.savedAt >= freshness;
    return stale ? {...entry.data, stale: true, metadataStale: true} : entry.data;
  }
  async function search(filters: NoticeSearchFilters, page = 1, signal?: AbortSignal, options: Options = {}) {
    if (signal?.aborted) throw abortError();
    const pageSize = options.pageSize ?? 16;
    const key = nativeNoticeQuery(filters, page, pageSize);
    const cached = snapshot(filters, page, pageSize);
    if (!options.refresh && cached && (!cached.stale || (cache.get(key)?.retryAt ?? 0) > now())) return cached;
    let flight = flights.get(key);
    if (!flight || flight.consumers === 0) {
      const created: Flight = {promise: Promise.resolve(null as never), consumers: 0};
      created.promise = (async () => {
        try {
          const data = validateNativeNoticeResponse(await read('/v1/notices?' + key), pageSize);
          if (created.consumers > 0) {
            cache.delete(key);
            // Edge-cached responses retain servedAt. Do not make an old result
            // fresh for another full interval just because it arrived again.
            cache.set(key, {data, savedAt: Math.min(now(), Date.parse(data.servedAt)), retryAt: 0});
            if (cache.size > 32) cache.delete(cache.keys().next().value!);
          }
          return data;
        } catch (error) {
          const fallback = snapshot(filters, page, pageSize);
          const entry = cache.get(key);
          if (fallback && entry) {
            entry.data = {...entry.data, stale: true, metadataStale: true};
            entry.retryAt = now() + RETRY_MS;
            return entry.data;
          }
          throw error;
        } finally {
          if (flights.get(key) === created) flights.delete(key);
        }
      })();
      flight = created;
      flights.set(key, flight);
    }
    const current = flight;
    current.consumers += 1;
    return new Promise<NativeNoticeResponse>((resolve, reject) => {
      let done = false;
      const finish = (value?: NativeNoticeResponse, error?: unknown) => {
        if (done) return;
        done = true;
        current.consumers -= 1;
        signal?.removeEventListener('abort', abort);
        if (error) reject(error); else resolve(value!);
      };
      const abort = () => finish(undefined, abortError());
      signal?.addEventListener('abort', abort, {once: true});
      if (signal?.aborted) abort();
      current.promise.then(value => finish(value), error => finish(undefined, error));
    });
  }
  return {search, snapshot};
}
