import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPublicNoticeApiSearchParams } from '@/lib/public-notice-api';
import {
  buildPublicNoticeSearchResult,
  clampNoticePageSize
} from '@/lib/public-notice-search';
import type { NoticeSearchFilters } from '@/lib/notice-query';
import { filterMainNoticeProjects } from '@/lib/notice-quality';
import { baseNoticeProjects } from '@/lib/notice-source';

const root = process.cwd();
const catalogSource = readFileSync(
  resolve(root, 'lib/server/public-notice-catalog.ts'),
  'utf8'
);
const cloudbaseSource = readFileSync(resolve(root, 'lib/cloudbase-data.ts'), 'utf8');
const noticeQuerySource = readFileSync(resolve(root, 'lib/notice-query.ts'), 'utf8');
const workbenchPageSource = readFileSync(resolve(root, 'app/me/page.tsx'), 'utf8');
const publicPages = ['app/page.tsx', 'app/notices/page.tsx', 'app/colleges/page.tsx'].map(
  (file) => readFileSync(resolve(root, file), 'utf8')
);

const filters: NoticeSearchFilters = {
  keyword: '人工智能',
  schoolName: '',
  region: '北京',
  majorKeyword: '计算机',
  category: '工学',
  discipline: '全部',
  schoolRange: '985',
  progress: '报名中',
  deadlineQuick: 'within7days',
  fresh: '全部',
  publishDate: '',
  projectType: '预推免',
  noticeKind: '申请通知',
  year: '2026',
  sortBy: 'deadline'
};

describe('public notice API v2 contracts', () => {
  it('uses canonical trailing-slash API URLs', () => {
    const clientSource = readFileSync(resolve(root, 'lib/public-notice-api.ts'), 'utf8');
    expect(clientSource).toContain('const requestUrl = `/api/public/notices/?${params.toString()}`');
    expect(clientSource).toContain('fetch(requestUrl');
    expect(clientSource).toContain("fetch('/api/public/notices/by-ids/'");
    expect(clientSource).toContain("fetch('/api/public/notices/deadlines/'");
  });

  it('keeps a bounded five-minute client cache for repeat navigation', () => {
    const clientSource = readFileSync(resolve(root, 'lib/public-notice-api.ts'), 'utf8');
    expect(clientSource).toContain('const CLIENT_CACHE_TTL_MS = 5 * 60_000');
    expect(clientSource).toContain('const CLIENT_CACHE_MAX_ENTRIES = 80');
    expect(clientSource).toContain('readFreshCache(noticeSearchCache.get(requestUrl))');
    expect(clientSource).toContain('writeNoticeSearchCache(requestUrl, data)');
    expect(clientSource).toContain('export function clearPublicNoticeSearchCache()');
  });

  it('caps page size at 40 and preserves combined URL filters', () => {
    expect(clampNoticePageSize(0)).toBe(1);
    expect(clampNoticePageSize(16)).toBe(16);
    expect(clampNoticePageSize(500)).toBe(40);

    const params = buildPublicNoticeApiSearchParams(filters, 3, 16);
    expect(params.get('page')).toBe('3');
    expect(params.get('pageSize')).toBe('16');
    expect(params.get('q')).toBe('人工智能');
    expect(params.get('region')).toBe('北京');
    expect(params.get('major')).toBe('计算机');
    expect(params.get('range')).toBe('985');
    expect(params.get('status')).toBe('报名中');
    expect(params.get('sort')).toBe('deadline');
  });

  it('returns only the current page and never serializes detail or admin fields', () => {
    const catalog = filterMainNoticeProjects(baseNoticeProjects).filter(
      (item) => Number(item.year) === 2026
    );
    const result = buildPublicNoticeSearchResult(
      catalog,
      { ...filters, keyword: '', majorKeyword: '', region: '全部', schoolRange: '全部', progress: '全部', deadlineQuick: '全部', projectType: '全部', noticeKind: '全部', category: '全部' },
      {
        page: 1,
        pageSize: 16,
        source: 'bundled',
        now: new Date('2026-09-02T12:00:00+08:00')
      }
    );

    expect(result.items.length).toBeLessThanOrEqual(16);
    expect(result.pagination.pageSize).toBe(16);
    const serialized = JSON.stringify(result);
    expect(Buffer.byteLength(serialized, 'utf8')).toBeLessThan(100_000);

    for (const item of result.items) {
      expect(item).not.toHaveProperty('requirements');
      expect(item).not.toHaveProperty('materialsRequired');
      expect(item).not.toHaveProperty('contactInfo');
      expect(item).not.toHaveProperty('changeLog');
      expect(item).not.toHaveProperty('historyRecords');
      expect(item).not.toHaveProperty('adminReviewNote');
    }
  });

  it('uses explicit server projections and leaves no browser full-catalog query', () => {
    expect(catalogSource).toContain(".select(NOTICE_CATALOG_COLUMNS)");
    expect(catalogSource).toContain(".select(NOTICE_DETAIL_COLUMNS)");
    expect(catalogSource).not.toContain(".select('*')");
    const recordSource = readFileSync(resolve(root, 'lib/notice-record.ts'), 'utf8');
    const catalogProjection = recordSource.match(/NOTICE_CATALOG_COLUMNS = \[([\s\S]*?)\]\.join/)?.[1] || '';
    expect(catalogProjection).not.toContain("'requirements'");
    expect(catalogProjection).not.toContain("'remarks'");
    expect(cloudbaseSource).not.toContain('readRemotePublicNotices');
    expect(cloudbaseSource).not.toContain('PUBLIC_NOTICE_QUERY_LIMIT');
    expect(noticeQuerySource).not.toContain("from './notice-source'");
    expect(workbenchPageSource).not.toContain("from '@/lib/notice-source'");

    for (const source of publicPages) {
      expect(source).not.toContain('fetchPublicNotices');
      expect(source).not.toContain('baseNoticeProjects');
    }
  });
});
