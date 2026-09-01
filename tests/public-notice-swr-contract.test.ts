import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const dataSource = readFileSync(resolve(root, 'lib/cloudbase-data.ts'), 'utf8');
const noticesSource = readFileSync(resolve(root, 'app/notices/page.tsx'), 'utf8');
const collegesSource = readFileSync(resolve(root, 'app/colleges/page.tsx'), 'utf8');
const reminderSource = readFileSync(resolve(root, 'components/desktop-reminder-center.tsx'), 'utf8');

describe('public notice stale-while-revalidate contract', () => {
  it('uses one versioned shared cache with bounded freshness and retry windows', () => {
    expect(dataSource).toContain("PUBLIC_NOTICE_CACHE_KEY = 'public-notices:v1:year=2026:published'");
    expect(dataSource).toContain('PUBLIC_NOTICE_CACHE_TTL_MS = 5 * 60_000');
    expect(dataSource).toContain('PUBLIC_NOTICE_CACHE_RETRY_MS = 15_000');
    expect(dataSource).toContain("PUBLIC_NOTICE_RUNTIME_CACHE_KEY = '__seekofferPublicNoticeCacheV1__'");
    expect(dataSource).toContain('const publicNoticeRuntimeScope = globalThis as PublicNoticeRuntimeScope');
    expect(dataSource).toContain('createStaleWhileRevalidateCache<PublicNoticeProject[]>');
    expect(dataSource).not.toContain('publicNoticeCachePromise');
  });

  it('treats an empty moderated remote result as authoritative', () => {
    expect(dataSource).toContain('const remoteProjects = await readRemotePublicNotices()');
    expect(dataSource).toContain('return sortProjectsByFreshness(filterMainNoticeProjects(remoteProjects))');
    expect(dataSource).not.toMatch(/if\s*\(\s*!remoteProjects\.length\s*\)/);
  });

  it('hydrates notices and college statistics synchronously before silent revalidation', () => {
    expect(noticesSource).toContain('useState(() => getPublicNoticeSnapshot())');
    expect(noticesSource).toContain('const result = await loadPublicNotices({ refresh: reloadToken > 0 })');
    expect(collegesSource).toContain('useState(() => getPublicNoticeSnapshot())');
    expect(collegesSource).toContain('const result = await loadPublicNotices({ refresh: options.force === true })');
    expect(collegesSource).not.toContain('fetchPublicNotices({ refresh: true })');
    expect(collegesSource).toContain('loadProjects({ force: true })');
  });

  it('lets the reminder timer share TTL revalidation instead of forcing another sweep', () => {
    expect(reminderSource).toContain('await fetchPublicNotices();');
    expect(reminderSource).not.toContain('fetchPublicNotices({ refresh: true })');
    expect(reminderSource).toContain("document.visibilityState !== 'visible'");
    expect(reminderSource).toContain('!navigator.onLine');
  });

  it('retains the moderated paginated query contract', () => {
    expect(dataSource).toContain(".eq('year', NOTICE_TARGET_YEAR)");
    expect(dataSource).toContain(".eq('is_private', false)");
    expect(dataSource).toContain(".eq('admin_status', 'published')");
    expect(dataSource).toContain(".is('admin_deleted_at', null)");
    expect(dataSource).toContain('.range(from, to)');
  });
});
