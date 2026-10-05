import { cloudflareRequest } from './cloudflare-api';
import { buildPublicNoticeSearchResult, type PublicNoticeSearchResponse } from './public-notice-search';
import { filterMainNoticeProjects } from './notice-quality';
import { baseNoticeProjects } from './notice-source';
import { toNoticeListItem, type NoticeListItem } from './notice-record';
import type { NoticeSearchFilters } from './notice-query';
import type { PublicNoticeProject } from './mock-data';

export type PublicNoticeDataSource = 'cloudflare' | 'bundled';

type NoticeByIdsResponse = {
  items: NoticeListItem[];
  source: PublicNoticeDataSource;
};

type DeadlineNoticeResponse = {
  items: NoticeListItem[];
  source: PublicNoticeDataSource;
  servedAt: string;
};

type RemoteNoticeSearchResponse = Omit<PublicNoticeSearchResponse, 'source'> & {
  source?: string;
};

const searchCache = new Map<string, { cachedAt: number; data: PublicNoticeSearchResponse }>();
const CACHE_TTL = 5 * 60_000;

function cacheKey(filters: NoticeSearchFilters, page: number, pageSize: number) {
  return JSON.stringify({ filters, page, pageSize });
}

function buildNoticeSearchParams(filters: NoticeSearchFilters, page: number, pageSize: number) {
  const params = new URLSearchParams();
  const values: Array<[string, string]> = [
    ['page', String(page)],
    ['pageSize', String(pageSize)],
    ['year', filters.year],
    ['sort', filters.sortBy],
    ['q', filters.keyword],
    ['school', filters.schoolName],
    ['region', filters.region],
    ['major', filters.majorKeyword],
    ['category', filters.category],
    ['discipline', filters.discipline],
    ['range', filters.schoolRange],
    ['status', filters.progress],
    ['deadline', filters.deadlineQuick],
    ['fresh', filters.fresh],
    ['date', filters.publishDate],
    ['type', filters.projectType],
    ['kind', filters.noticeKind]
  ];

  values.forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  return params;
}

function bundledCatalog() {
  return filterMainNoticeProjects(baseNoticeProjects);
}

function buildBundledSearchResult(
  filters: NoticeSearchFilters,
  page: number,
  pageSize: number
) {
  return buildPublicNoticeSearchResult(bundledCatalog(), filters, {
    page,
    pageSize,
    source: 'bundled'
  });
}

export function clearPublicNoticeSearchCache() {
  searchCache.clear();
}

export async function fetchPublicNoticeSearch(
  filters: NoticeSearchFilters,
  page: number,
  options: { pageSize?: number; signal?: AbortSignal } = {}
) {
  if (options.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');

  const pageSize = options.pageSize || 16;
  const key = cacheKey(filters, page, pageSize);
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) return cached.data;

  try {
    const params = buildNoticeSearchParams(filters, page, pageSize);
    const result = await cloudflareRequest<RemoteNoticeSearchResponse>(
      `/v1/notices?${params.toString()}`,
      { signal: options.signal }
    );
    const data = { ...result, source: 'cloudflare' as const };
    searchCache.set(key, { cachedAt: Date.now(), data });
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    const data = buildBundledSearchResult(filters, page, pageSize);
    searchCache.set(key, { cachedAt: Date.now(), data });
    return data;
  }
}

export async function fetchPublicNoticesByIds(ids: string[], signal?: AbortSignal): Promise<NoticeByIdsResponse> {
  if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
  const wanted = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).slice(0, 100);
  if (!wanted.length) return { items: [], source: 'cloudflare' };

  try {
    const result = await cloudflareRequest<{ items?: NoticeListItem[] }>(
      '/v1/notices/by-ids',
      { method: 'POST', body: JSON.stringify({ ids: wanted }), signal }
    );
    return { items: Array.isArray(result.items) ? result.items : [], source: 'cloudflare' };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return {
      items: bundledCatalog()
        .filter((row) => wanted.includes(row.id))
        .map(toNoticeListItem),
      source: 'bundled'
    };
  }
}

export async function fetchPublicDeadlineNotices(signal?: AbortSignal): Promise<DeadlineNoticeResponse> {
  const result = await fetchPublicNoticeSearch(
    {
      keyword: '',
      schoolName: '',
      region: '全部',
      majorKeyword: '',
      category: '全部',
      discipline: '全部',
      schoolRange: '全部',
      progress: '报名中',
      deadlineQuick: 'within7days',
      fresh: '全部',
      publishDate: '',
      projectType: '全部',
      noticeKind: '全部',
      year: '2026',
      sortBy: 'deadline'
    },
    1,
    { pageSize: 1000, signal }
  );

  return {
    items: result.items,
    source: result.source,
    servedAt: result.servedAt
  };
}

export async function fetchPublicNoticeById(id: string) {
  const normalizedId = id.trim();
  if (!normalizedId) return null;

  try {
    return await cloudflareRequest<PublicNoticeProject>(
      `/v1/notices/${encodeURIComponent(normalizedId)}`
    );
  } catch {
    return bundledCatalog().find((item) => item.id === normalizedId) || null;
  }
}
