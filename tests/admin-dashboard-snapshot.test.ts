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

  it('aggregates the dashboard data sources and desktop downloads on the server', () => {
    expect(adminApi).toContain("resource === 'dashboard' && action === 'snapshot'");
    expect(adminApi).toContain('async function getDashboardSnapshot');
    expect(adminApi).toContain('getOverview(service)');
    expect(adminApi).toContain('getAnalyticsOverview(service)');
    expect(adminApi).toContain('listNotices(service');
    expect(adminApi).toContain('listOffers(service');
    expect(adminApi).toContain('listFeedback(service');
    expect(adminApi).toContain("listOffers(service, { page: 1, pageSize: 20 }, false)");
    expect(adminApi).toContain("listFeedback(service, { page: 1, pageSize: 5 }, false)");
    expect(adminApi).toContain('getDesktopDownloadMetrics(service)');
    expect(adminApi).toContain('return { overview, analytics, notices, offers, feedback, downloads }');
    expect(adminApi).toContain('}, false)');
  });

  it('loads desktop download metrics with one fail-soft aggregate RPC', () => {
    const metricHelper = adminApi.slice(
      adminApi.indexOf('async function getDesktopDownloadMetrics'),
      adminApi.indexOf('async function getDashboardSnapshot')
    );
    expect(metricHelper.match(/service\.rpc\('seekoffer_get_desktop_download_metrics'\)/g)).toHaveLength(1);
    expect(metricHelper).toContain('return createEmptyDesktopDownloadMetrics()');
    expect(metricHelper).toContain('sevenDays: normalizeMetricCount(metrics.seven_days)');
    expect(metricHelper).toContain('trackingStartedAt: normalizeTrackingStartDate(metrics.tracking_started_at)');
  });

  it('renders and exports the independent desktop download snapshot field', () => {
    expect(page).toContain('downloads?: DesktopDownloadMetrics');
    expect(page).toContain('setDownloads(downloadMetrics ?? emptyDesktopDownloads)');
    expect(page).toContain('桌面端下载启动');
    expect(page).toContain('官网按钮发起下载次数');
    expect(page).toContain('从 {downloads.trackingStartedAt} 起统计');
    expect(page).toContain('formatNumber(downloads.today)');
    expect(page).toContain('formatNumber(downloads.sevenDays)');
    expect(page).toContain('v{DESKTOP_RELEASE.version}');
    expect(page).toMatch(/downloads,\r?\n\s+trends/);
    expect(page).toContain('xl:grid-cols-3');
  });

  it('does not expose feedback rows to content-only reviewers', () => {
    expect(adminApi).toContain("const canReadFeedback = hasAdminPermission(admin, 'users:write')");
    expect(adminApi).toContain('canReadFeedback');
    expect(adminApi).toContain('Promise.resolve({ feedback: [], total: 0, page: 1, pageSize: 5 })');
    expect(adminApi).toContain('getDashboardSnapshot(service, admin)');
  });

  it('keeps download metrics out of the lightweight shell snapshot', () => {
    const shellSnapshot = adminApi.slice(
      adminApi.indexOf('async function getShellSnapshot'),
      adminApi.indexOf('async function logOperation')
    );
    expect(shellSnapshot).not.toContain('getDesktopDownloadMetrics');
    expect(shellSnapshot).not.toContain('downloads');
  });
});
