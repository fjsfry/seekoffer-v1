'use client';
import {nativePublicRequest} from './native-auth-bridge';
import type {NoticeSearchFilters} from './notice-query';
import type {PublicNoticeProject} from './mock-data';
import {createNativeNoticeClient} from './native-notice-client';
import {noticeListItemToProject} from './notice-record';

export const nativeNoticeDefaults: NoticeSearchFilters = {keyword:'',schoolName:'',region:'全部',majorKeyword:'',category:'全部',discipline:'全部',schoolRange:'全部',progress:'全部',deadlineQuick:'全部',fresh:'全部',publishDate:'',projectType:'全部',noticeKind:'全部',year:'2026',sortBy:'publish'};
const client = createNativeNoticeClient(path => nativePublicRequest(path));
export function nativeNoticeSearch(filters: NoticeSearchFilters = nativeNoticeDefaults, page = 1, signal?: AbortSignal, options: {refresh?: boolean; pageSize?: number} = {}) {
  return client.search(filters, page, signal, options);
}
export function getNativeNoticeSnapshot(filters: NoticeSearchFilters = nativeNoticeDefaults, page = 1, pageSize = 16) {
  return client.snapshot(filters, page, pageSize);
}
export async function nativeNoticeDetail(id: string): Promise<PublicNoticeProject | null> {
  if (!id || id.length > 180) throw new Error('通知编号无效。');
  const result = await nativePublicRequest('/v1/notices/detail?' + new URLSearchParams({id})) as PublicNoticeProject | null;
  if (result && result.id !== id) throw new Error('通知响应编号不匹配。');
  return result;
}

// Query only the upcoming window, paging to completion rather than filtering
// the first general page. The bound fails explicitly instead of omitting rows.
export async function nativeDeadlineNotices(signal?: AbortSignal, refresh = false) {
  const filters: NoticeSearchFilters = {...nativeNoticeDefaults, progress: '报名中', deadlineQuick: 'within7days', sortBy: 'deadline'};
  const first = await nativeNoticeSearch(filters, 1, signal, {pageSize: 40, refresh});
  if (first.stale || first.metadataStale) throw new Error('截止提醒暂未更新，请重试。');
  if (first.pagination.totalPages > 25) throw new Error('截止通知较多，请到通知库按学校筛选查看。');
  const items = [...first.items];
  for (let start = 2; start <= first.pagination.totalPages; start += 3) {
    const pages = Array.from({length: Math.min(3, first.pagination.totalPages - start + 1)}, (_, index) => start + index);
    const results = await Promise.all(pages.map(page => nativeNoticeSearch(filters, page, signal, {pageSize: 40, refresh})));
    results.forEach((result, index) => {
      if (result.stale || result.metadataStale || result.pagination.total !== first.pagination.total || result.pagination.page !== pages[index]) {
        throw new Error('截止通知正在更新，请重新同步。');
      }
      items.push(...result.items);
    });
  }
  const unique = new Map(items.map(item => [item.id, item]));
  if (unique.size !== first.pagination.total) throw new Error('截止通知正在更新，请重新同步。');
  return [...unique.values()].map(noticeListItemToProject);
}
