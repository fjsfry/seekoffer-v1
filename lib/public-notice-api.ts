import { publicNoticeFetch, ServiceUnavailableError } from './service-availability';
import type { PublicNoticeSearchResponse } from './public-notice-search';
import type { NoticeSearchFilters } from './notice-query';
import type { NoticeListItem } from './notice-record';
import {mergePublicNoticeParts,clearPublicMetadataParts} from './public-notice-parts';

type NoticeByIdsResponse = {
  items: NoticeListItem[];
  source: 'supabase' | 'bundled' | 'recovery';
};

type DeadlineNoticeResponse = {
  items: NoticeListItem[];
  source: 'supabase' | 'bundled' | 'recovery';
  servedAt: string;
};

export function clearPublicNoticeSearchCache() { clearPublicMetadataParts(); /* Server caches still revalidate by version. */ }

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
    throw new ServiceUnavailableError(response.status);
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

  const response = await publicNoticeFetch(requestUrl, {
    method: 'GET',
    signal: options.signal,
    headers: { Accept: 'application/json' }
  });

  const data = await readJsonResponse<PublicNoticeSearchResponse>(response);

  return mergePublicNoticeParts(data,params,options.signal);
}

export async function fetchPublicNoticesByIds(ids: string[], signal?: AbortSignal) {
  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (!uniqueIds.length) return { items: [], source: 'supabase' } as NoticeByIdsResponse;

  const batches = Array.from(
    { length: Math.ceil(uniqueIds.length / 100) },
    (_, index) => uniqueIds.slice(index * 100, (index + 1) * 100)
  );
  const responses: NoticeByIdsResponse[] = [];
  for (const batch of batches) {
    const response = await publicNoticeFetch('/api/public/notices/by-ids/', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: batch }), signal
    });
    responses.push(await readJsonResponse<NoticeByIdsResponse>(response));
  }

  return {
    items: responses.flatMap((response) => response.items),
    source: responses.every((response) => response.source === 'supabase')
      ? 'supabase'
      : responses.every(response=>response.source==='recovery')?'recovery':'bundled'
  };
}

export async function fetchPublicDeadlineNotices(signal?: AbortSignal) {

  const response = await publicNoticeFetch('/api/public/notices/deadlines/', {
    method: 'GET',
    signal,
    headers: { Accept: 'application/json' }
  });

  const data = await readJsonResponse<DeadlineNoticeResponse&{nextCursor?:string|null;version?:string}>(response);
  let next=data.nextCursor;const seen=new Set<string>();const ids=new Set(data.items.map(i=>i.id));
  while(next){
    if(typeof next!=='string'||next.length>120||seen.has(next)||seen.size>=100||!data.version)throw new ServiceUnavailableError(503,'DEADLINE_PAGINATION_INVALID');seen.add(next);
    const page=await publicNoticeFetch('/api/public/notices/deadlines/?'+new URLSearchParams({cursor:next,version:data.version}),{method:'GET',signal,headers:{Accept:'application/json'}});
    const batch=await readJsonResponse<DeadlineNoticeResponse&{nextCursor?:string|null;version?:string}>(page);
    if(batch.version!==data.version||batch.source!==data.source||batch.items.some(i=>ids.has(i.id)))throw new ServiceUnavailableError(503,'DEADLINE_VERSION_CHANGED');
    batch.items.forEach(i=>ids.add(i.id));data.items.push(...batch.items);next=batch.nextCursor;
  }
  return data;
}
