import { getPublicNoticeCatalog } from '@/lib/server/public-notice-catalog';
import { buildPublicNoticeSearchResult } from '@/lib/public-notice-search';
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

const responseHeaders = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600'
};

function boundedText(value: string | null, maxLength: number, fallback = '') {
  return (value || fallback).trim().slice(0, maxLength);
}

function pickAllowed<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T
) {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function parseNumber(value: string | null, fallback: number) {
  if (value === null || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePublicNoticeSearchRequest(url: string) {
  const searchParams = new URL(url).searchParams;
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
    page: parseNumber(searchParams.get('page'), 1),
    pageSize: parseNumber(searchParams.get('pageSize'), 16)
  };
}

export async function GET(request: Request) {
  const query = parsePublicNoticeSearchRequest(request.url);
  const catalog = await getPublicNoticeCatalog();
  const result = buildPublicNoticeSearchResult(catalog.items, query.filters, {
    page: query.page,
    pageSize: query.pageSize,
    source: catalog.source
  });

  return Response.json(result, { headers: responseHeaders });
}
