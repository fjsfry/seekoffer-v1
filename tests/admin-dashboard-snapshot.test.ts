import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const page = readFileSync(resolve(root, 'app/admin/dashboard/page.tsx'), 'utf8');
const adminApi = readFileSync(resolve(root, 'supabase/functions/admin-api/index.ts'), 'utf8');

describe('admin dashboard snapshot', () => {
  it('loads the dashboard through one Edge Function request', () => {
    expect(page).toContain("{ resource: 'dashboard', action: 'snapshot' }");
    expect(page).not.toContain("resource: 'overview', action: 'get'");
    expect(page).not.toContain("resource: 'analytics', action: 'overview'");
    expect(page).not.toContain('const [overview, analyticsData, notices, offers, feedback] = await Promise.all');
  });

  it('aggregates the five existing dashboard data sources on the server', () => {
    expect(adminApi).toContain("resource === 'dashboard' && action === 'snapshot'");
    expect(adminApi).toContain('async function getDashboardSnapshot');
    expect(adminApi).toContain('getOverview(service)');
    expect(adminApi).toContain('getAnalyticsOverview(service)');
    expect(adminApi).toContain('listNotices(service');
    expect(adminApi).toContain('listOffers(service');
    expect(adminApi).toContain('listFeedback(service');
    expect(adminApi).toContain("listOffers(service, { page: 1, pageSize: 20 }, false)");
    expect(adminApi).toContain("listFeedback(service, { page: 1, pageSize: 5 }, false)");
    expect(adminApi).toContain('}, false)');
  });

  it('does not expose feedback rows to content-only reviewers', () => {
    expect(adminApi).toContain("const canReadFeedback = hasAdminPermission(admin, 'users:write')");
    expect(adminApi).toContain('canReadFeedback');
    expect(adminApi).toContain('Promise.resolve({ feedback: [], total: 0, page: 1, pageSize: 5 })');
    expect(adminApi).toContain('getDashboardSnapshot(service, admin)');
  });
});
