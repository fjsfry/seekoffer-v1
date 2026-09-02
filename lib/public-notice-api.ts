import type { PublicNoticeSearchResponse } from './public-notice-search';
import type { NoticeSearchFilters } from './notice-query';
import type { NoticeListItem } from './notice-record';

type NoticeByIdsResponse = {
  items: NoticeListItem[];
  source: 'supabase' | 'bundled';
};

type DeadlineNoticeResponse = {
  items: NoticeListItem[];
  source: 'supabase' | 'bundled';
  servedAt: string;
};

type ClientCacheEntry<T> = {
  data: T;
  cachedAt: number;
};

const CLIENT_CACHE_TTL_MS = 5 * 60_000;
const CLIENT_CACHE_MAX_ENTRIES = 80;
const noticeSearchCache = new Map<string, ClientCacheEntry<PublicNoticeSearchResponse>>();
let deadlineNoticeCache: ClientCacheEntry<DeadlineNoticeResponse> | null = null;

function readFreshCache<T>(entry: ClientCacheEntry<T> | undefined | null) {
  if (!entry || Date.now() - entry.cachedAt >= CLIENT_CACHE_TTL_MS) {
    return null;
  }
  return entry.data;
}

function writeNoticeSearchCache(key: string, data: PublicNoticeSearchResponse) {
  noticeSearchCache.delete(key);
  noticeSearchCache.set(key, { data, cachedAt: Date.now() });
  if (noticeSearchCache.size > CLIENT_CACHE_MAX_ENTRIES) {
    const oldestKey = noticeSearchCache.keys().next().value;
    if (oldestKey) noticeSearchCache.delete(oldestKey);
  }
}

export function clearPublicNoticeSearchCache() {
  noticeSearchCache.clear();
}

function setIfMeaningful(params: URLSearchParams, key: string, value: string) {
  const normalized = value.trim();
  if (normalized && normalized !== '全部') {
    params.set(key, normalized);
  }
}

export function buildPublicNoticeApiSearchParams(
  filters: NoticeSearchFilters,
  page: number,
  pageSize = 16
) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    year: filters.year,
    sort: filters.sortBy
  });

  setIfMeaningful(params, 'q', filters.keyword);
  setIfMeaningful(params, 'school', filters.schoolName);
  setIfMeaningful(params, 'region', filters.region);
  setIfMeaningful(params, 'major', filters.majorKeyword);
  setIfMeaningful(params, 'category', filters.category);
  setIfMeaningful(params, 'discipline', filters.discipline);
  setIfMeaningful(params, 'range', filters.schoolRange);
  setIfMeaningful(params, 'status', filters.progress);
  setIfMeaningful(params, 'deadline', filters.deadlineQuick);
  setIfMeaningful(params, 'fresh', filters.fresh);
  setIfMeaningful(params, 'date', filters.publishDate);
  setIfMeaningful(params, 'type', filters.projectType);
  setIfMeaningful(params, 'kind', filters.noticeKind);

  return params;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Public notice request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

export async function fetchPublicNoticeSearch(
  filters: NoticeSearchFilters,
  page: number,
  options: { pageSize?: number; signal?: AbortSignal } = {}
) {
  const params = buildPublicNoticeApiSearchParams(
    filters,
    page,
    options.pageSize || 16
  );
  const requestUrl = `/api/public/notices/?${params.toString()}`;
  const cached = readFreshCache(noticeSearchCache.get(requestUrl));
  if (cached) return cached;

  const response = await fetch(requestUrl, {
    method: 'GET',
    signal: options.signal,
    headers: { Accept: 'application/json' }
  });

  const data = await readJsonResponse<PublicNoticeSearchResponse>(response);
  writeNoticeSearchCache(requestUrl, data);
  return data;
}

export async function fetchPublicNoticesByIds(ids: string[], signal?: AbortSignal) {
  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (!uniqueIds.length) return { items: [], source: 'supabase' } as NoticeByIdsResponse;

  const batches = Array.from(
    { length: Math.ceil(uniqueIds.length / 100) },
    (_, index) => uniqueIds.slice(index * 100, (index + 1) * 100)
  );
  const responses = await Promise.all(
    batches.map(async (batch) => {
      const response = await fetch('/api/public/notices/by-ids/', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: batch }),
        signal
      });
      return readJsonResponse<NoticeByIdsResponse>(response);
    })
  );

  return {
    items: responses.flatMap((response) => response.items),
    source: responses.every((response) => response.source === 'supabase')
      ? 'supabase'
      : 'bundled'
  };
}

export async function fetchPublicDeadlineNotices(signal?: AbortSignal) {
  const cached = readFreshCache(deadlineNoticeCache);
  if (cached) return cached;

  const response = await fetch('/api/public/notices/deadlines/', {
    method: 'GET',
    signal,
    headers: { Accept: 'application/json' }
  });

  const data = await readJsonResponse<DeadlineNoticeResponse>(response);
  deadlineNoticeCache = { data, cachedAt: Date.now() };
  return data;
}
