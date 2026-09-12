import { ServiceUnavailableError, publicServiceErrorResponse } from '@/lib/service-availability';
import { getPublicNoticeCatalog } from '@/lib/server/public-notice-catalog';
import { publicNoticeSearchResponse } from '@/lib/server/notice-search-result-cache';
import {
  noticeDeadlineOptions,
  noticeFreshOptions,
  noticeProgressOptions,
  noticeRangeOptions,
  noticeSortOptions,
  type NoticeSearchFilters
} from '@/lib/notice-query';
import { noticeKindFilters, noticeTypeFilters } from '@/lib/notice-analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function boundedText(value: string | null, maxLength: number, fallback = '') {
  const text = (value || fallback).trim();
  if (text.length > maxLength) throw new ServiceUnavailableError(400, 'invalid_filter');
  return text;
}

function pickAllowed<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T
) {
  if (value === null || value === '') return fallback;
  if (!allowed.includes(value as T)) throw new ServiceUnavailableError(400, 'invalid_enum');
  return value as T;
}

function parseNumber(value: string | null, fallback: number, maximum: number) {
  if (value === null || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) throw new ServiceUnavailableError(400, 'invalid_page');
  return parsed;
}

function parsePublicNoticeSearchRequest(url: string) {
  const searchParams = new URL(url).searchParams;
  const allowed = new Set(['q','school','region','major','category','discipline','range','status','deadline','fresh','date','type','kind','year','sort','page','pageSize']);
  for (const key of searchParams.keys()) {
    if (!allowed.has(key) || searchParams.getAll(key).length !== 1) throw new ServiceUnavailableError(400, 'invalid_filter');
  }
  const filters: NoticeSearchFilters = {
    keyword: boundedText(searchParams.get('q'), 80),
    schoolName: boundedText(searchParams.get('school'), 100),
    region: boundedText(searchParams.get('region'), 30, '全部') || '全部',
    majorKeyword: boundedText(searchParams.get('major'), 80),
    category: boundedText(searchParams.get('category'), 40, '全部') || '全部',
    discipline:
      boundedText(searchParams.get('discipline'), 100, '全部') || '全部',
    schoolRange: pickAllowed(
      searchParams.get('range'),
      noticeRangeOptions,
      '全部'
    ),
    progress: pickAllowed(
      searchParams.get('status'),
      noticeProgressOptions,
      '全部'
    ),
    deadlineQuick: pickAllowed(
      searchParams.get('deadline'),
      noticeDeadlineOptions,
      '全部'
    ),
    fresh: pickAllowed(searchParams.get('fresh'), noticeFreshOptions, '全部'),
    publishDate: boundedText(searchParams.get('date'), 10),
    projectType: pickAllowed(searchParams.get('type'), noticeTypeFilters, '全部'),
    noticeKind: pickAllowed(searchParams.get('kind'), noticeKindFilters, '全部'),
    year: pickAllowed(searchParams.get('year'), ['2026', '全部'] as const, '2026'),
    sortBy: pickAllowed(searchParams.get('sort'), noticeSortOptions, 'publish')
  };

  return {
    filters,
    page: parseNumber(searchParams.get('page'), 1, 100000),
    pageSize: parseNumber(searchParams.get('pageSize'), 16, 40)
  };
}

export async function GET(request: Request) {
  try {
  const query = parsePublicNoticeSearchRequest(request.url);
  const catalog = await getPublicNoticeCatalog();
  return await publicNoticeSearchResponse(catalog, query.filters, {
    page: query.page,
    pageSize: query.pageSize
  });
  } catch (error) { return publicServiceErrorResponse(error); }
}
