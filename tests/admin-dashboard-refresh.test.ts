import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const dashboardSource = readFileSync(resolve(root, 'app/admin/dashboard/page.tsx'), 'utf8');

describe('admin dashboard refresh policy', () => {
  it('refreshes no more than every five minutes and only while visible', () => {
    expect(dashboardSource).toContain('const DASHBOARD_REFRESH_INTERVAL_MS = 5 * 60_000');
    expect(dashboardSource).toContain("document.visibilityState !== 'visible'");
    expect(dashboardSource).toContain("document.visibilityState === 'visible'");
    expect(dashboardSource).toContain("document.addEventListener('visibilitychange', refreshWhenVisible)");
    expect(dashboardSource).not.toContain('}, 30_000)');
  });

  it('preserves the last successful snapshot when a refresh fails', () => {
    expect(dashboardSource).toContain('setDataError(errorMessage)');
    expect(dashboardSource).not.toContain('setOverviewMetrics(emptyOverview);');
    expect(dashboardSource).not.toContain('setPendingNotices([]);');
    expect(dashboardSource).not.toContain('setPendingOffers([]);');
    expect(dashboardSource).not.toContain('setLatestFeedback([]);');
  });

  it('deduplicates concurrent refreshes and preserves the manual refresh control', () => {
    expect(dashboardSource).toContain('const refreshInFlightRef = useRef<Promise<void> | null>(null)');
    expect(dashboardSource).toContain('if (refreshInFlightRef.current)');
    expect(dashboardSource).toContain('refreshInFlightRef.current = request');
    expect(dashboardSource).toContain('onClick={() => void loadDashboard()}');
    expect(dashboardSource).toContain('disabled={isRefreshing}');
  });
});
