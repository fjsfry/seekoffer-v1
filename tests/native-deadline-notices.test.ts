import {beforeEach, describe, expect, it, vi} from 'vitest';

const read = vi.hoisted(() => vi.fn());
vi.mock('../lib/native-auth-bridge', () => ({nativePublicRequest: read}));

function pageResponse(path: string, total = 82) {
  const query = new URL(path, 'https://local.invalid').searchParams;
  const page = Number(query.get('page'));
  const size = Number(query.get('pageSize'));
  return {
    items: Array.from({length: Math.min(size, Math.max(0, total - (page - 1) * size))}, (_, index) => ({id: `notice-${(page - 1) * size + index}`, schoolName: '合成大学', projectName: '申请通知', deadlineDate: '2026-10-11', tags: []})),
    pagination: {page, pageSize: size, total, totalPages: Math.max(1, Math.ceil(total / size))},
    stats: {total2026: 2000, todayUpdates: 0, deadlineWithin3Days: total},
    facets: {regions: [], schools: [], categories: [], disciplines: [], collegeStats: []},
    sideData: {urgentProjects: [], latestProjects: [], todaySchoolUpdates: {date: '', hasTodayRows: false, rows: []}, latestPublishDate: '', topColleges: []},
    source: 'cloudflare', servedAt: '2026-10-09T00:00:00Z', metadataStale: false
  };
}

beforeEach(() => {vi.resetModules(); read.mockReset();});
describe('upcoming deadline bounded server paging', () => {
  it('returns all matching rows beyond the first 16 and requests only the upcoming window', async () => {
    read.mockImplementation(async (path: string) => pageResponse(path));
    const {nativeDeadlineNotices} = await import('../lib/native-public-notices');
    const rows = await nativeDeadlineNotices();
    expect(rows).toHaveLength(82);
    expect(read).toHaveBeenCalledTimes(3);
    for (const [path] of read.mock.calls) {
      const query = new URL(path, 'https://local.invalid').searchParams;
      expect(query.get('status')).toBe('报名中');
      expect(query.get('deadline')).toBe('within7days');
      expect(query.get('sort')).toBe('deadline');
      expect(query.get('pageSize')).toBe('40');
    }
  });
  it('does not silently truncate a result beyond its explicit bound', async () => {
    read.mockImplementation(async (path: string) => pageResponse(path, 1001));
    const {nativeDeadlineNotices} = await import('../lib/native-public-notices');
    await expect(nativeDeadlineNotices()).rejects.toThrow('较多');
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('fails instead of presenting a partially loaded or changing result as complete', async () => {
    read.mockImplementation(async (path: string) => pageResponse(path, path.includes('page=2&') ? 81 : 82));
    const {nativeDeadlineNotices} = await import('../lib/native-public-notices');
    await expect(nativeDeadlineNotices()).rejects.toThrow('正在更新');
  });
  it('does not request further pages after cancellation', async () => {
    const controller = new AbortController();
    read.mockImplementation(async (path: string) => {controller.abort(); return pageResponse(path);});
    const {nativeDeadlineNotices} = await import('../lib/native-public-notices');
    await expect(nativeDeadlineNotices(controller.signal)).rejects.toMatchObject({name: 'AbortError'});
    expect(read).toHaveBeenCalledTimes(1);
  });
});
