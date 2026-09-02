import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(resolve(process.cwd(), 'app/notices/page.tsx'), 'utf8');

describe('public notice page v2 API migration', () => {
  it('loads the notice list through the same-origin public API adapter', () => {
    expect(pageSource).toContain('fetchPublicNoticeSearch');
    expect(pageSource).toContain("from '@/lib/public-notice-api'");
    expect(pageSource).toContain('fetchPublicNoticeSearch(apiFilterValues, requestedPage');
    expect(pageSource).toContain('pageSize: PAGE_SIZE');
    expect(pageSource).toContain('signal: controller.signal');

    expect(pageSource).not.toContain('fetchPublicNotices');
    expect(pageSource).not.toContain('baseNoticeProjects');
    expect(pageSource).not.toContain("from '@/lib/notice-source'");
    expect(pageSource).not.toContain('filterMainNoticeProjects');
  });

  it('debounces both free-text filters for 350 milliseconds', () => {
    expect(pageSource).toContain('setDebouncedKeyword(keyword), 350');
    expect(pageSource).toContain('setDebouncedMajorKeyword(majorKeyword), 350');
    expect(pageSource).toContain('keyword: debouncedKeyword');
    expect(pageSource).toContain('majorKeyword: debouncedMajorKeyword');
  });

  it('aborts superseded requests and ignores late responses', () => {
    expect(pageSource).toContain('const controller = new AbortController()');
    expect(pageSource).toContain('requestSequenceRef.current !== requestId');
    expect(pageSource).toContain('return () => controller.abort()');
    expect(pageSource).toContain("error.name === 'AbortError'");
  });

  it('renders records, counts, side data, and facets from the API response', () => {
    expect(pageSource).toContain('const visibleResponse = responseMatchesQuery ? searchResponse : null');
    expect(pageSource).toContain('visibleResponse?.items || []');
    expect(pageSource).toContain('visibleResponse?.pagination.total || 0');
    expect(pageSource).toContain('visibleResponse?.pagination.totalPages || 1');
    expect(pageSource).toContain('visibleResponse.stats.total2026');
    expect(pageSource).toContain('visibleResponse.stats.todayUpdates');
    expect(pageSource).toContain('visibleResponse.stats.deadlineWithin3Days');
    expect(pageSource).toContain('visibleResponse?.sideData.urgentProjects');
    expect(pageSource).toContain('visibleResponse?.sideData.todaySchoolUpdates');
    expect(pageSource).toContain('visibleResponse?.facets.categories');
    expect(pageSource).toContain('visibleResponse?.facets.disciplines');
    expect(pageSource).toContain('visibleResponse?.facets.regions');
    expect(pageSource).toContain('visibleResponse?.facets.schools');

    expect(pageSource).not.toContain('filteredProjects.slice(');
    expect(pageSource).not.toContain('projects.filter((item)');
  });

  it('keeps URL, pagination, and scroll restoration while refreshing the same query', () => {
    expect(pageSource).toContain('parseNoticeListUrlState(searchParams)');
    expect(pageSource).toContain('buildNoticeListHref(filterValues, currentPage, advancedOpen');
    expect(pageSource).toContain("window.history.replaceState(null, '', nextHref)");
    expect(pageSource).toContain('readNoticeListPosition()');
    expect(pageSource).toContain('window.scrollTo({');
    expect(pageSource).toContain('setReloadToken((value) => value + 1)');
    expect(pageSource).not.toMatch(/cacheBust|cache_bust|[?&]_[=:]/i);
  });

  it('uses the shared notice-query presentation helpers', () => {
    expect(pageSource).toContain('getNoticeCardTags,');
    expect(pageSource).toContain('getNoticeCityTag,');
    expect(pageSource).toContain('getNoticeCityTag(project)');
  });
});
