import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const shell = readFileSync(resolve(root, 'components/admin-shell.tsx'), 'utf8');
const adminApi = readFileSync(resolve(root, 'supabase/functions/admin-api/index.ts'), 'utf8');

describe('admin shell refresh policy', () => {
  it('uses one visible-only five-minute snapshot request outside the dashboard', () => {
    expect(shell).toContain("normalizedPathname === '/admin/dashboard'");
    expect(shell).toContain("{ resource: 'shell', action: 'snapshot' }");
    expect(shell).toContain("document.visibilityState !== 'visible'");
    expect(shell).toContain('window.setInterval(refreshWhenVisible, 5 * 60_000)');
    expect(shell).not.toContain('}, 60_000)');
    expect(shell).not.toContain("resource: 'overview', action: 'get'");
    expect(shell).not.toContain("resource: 'analytics', action: 'overview'");
    expect(shell).toContain('ADMIN_DASHBOARD_SNAPSHOT_EVENT');
    expect(shell).toContain('syncDashboardSnapshot');
  });

  it('provides the matching server aggregate resource', () => {
    expect(adminApi).toContain("resource === 'shell' && action === 'snapshot'");
    expect(adminApi).toContain('async function getShellSnapshot');
    const shellSnapshot = adminApi.slice(
      adminApi.indexOf('async function getShellSnapshot'),
      adminApi.indexOf('async function logOperation')
    );
    expect(shellSnapshot).not.toContain('getOverview(service)');
    expect(shellSnapshot).not.toContain('getAnalyticsOverview(service)');
    expect(shellSnapshot).toContain('pendingNotices');
    expect(shellSnapshot).toContain('todayPageViews');
  });
});
