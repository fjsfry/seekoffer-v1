import type {PublicNoticeSearchResponse} from './public-notice-search';

export type NativeNoticeResponse = PublicNoticeSearchResponse & {
  metadataStale?: boolean;
  stale?: boolean;
};

const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
const strings = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === 'string');

// The versioned API now returns its aggregate snapshot together with the page.
// Never request the removed website metadata shards or derive totals from items.
export function validateNativeNoticeResponse(value: unknown, pageSize: number): NativeNoticeResponse {
  const data = value as NativeNoticeResponse | null;
  const page = data?.pagination;
  const facets = data?.facets;
  const side = data?.sideData;
  if (!data || !Array.isArray(data.items) || data.items.length > pageSize ||
      data.items.some(item => !item || typeof item.id !== 'string' || !item.id || typeof item.projectName !== 'string' || typeof item.schoolName !== 'string') ||
      !page || !count(page.total) || !count(page.page) || page.page < 1 ||
      page.pageSize !== pageSize || !count(page.totalPages) || page.totalPages < 1 ||
      page.page > page.totalPages || page.totalPages !== Math.max(1, Math.ceil(page.total / pageSize)) ||
      !data.stats || !Object.values(data.stats).every(count) ||
      !['total2026', 'todayUpdates', 'deadlineWithin3Days'].every(key => count(data.stats[key as keyof typeof data.stats])) ||
      !facets || !strings(facets.regions) || !strings(facets.schools) || !strings(facets.categories) || !strings(facets.disciplines) ||
      !Array.isArray(facets.collegeStats) || facets.collegeStats.some(item => !item || typeof item.schoolName !== 'string' || !count(item.total) || !count(item.active)) ||
      !side || !Array.isArray(side.urgentProjects) || !Array.isArray(side.latestProjects) || !Array.isArray(side.topColleges) ||
      !side.todaySchoolUpdates || !Array.isArray(side.todaySchoolUpdates.rows) || typeof side.latestPublishDate !== 'string' ||
      !Number.isFinite(Date.parse(data.servedAt))) {
    throw new Error('通知响应不完整，请稍后重试。');
  }
  return data;
}
