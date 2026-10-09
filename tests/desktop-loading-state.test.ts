import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(__dirname, '..');
const source = (file: string) => readFileSync(resolve(projectRoot, file), 'utf8');

describe('desktop application loading state', () => {
  const home = source('components/desktop-home.tsx');
  const notices = source('app/notices/page.tsx');
  const shell = source('components/desktop-app-shell.tsx');

  it('uses content-shaped initial loading without replacing usable application rows', () => {
    expect(home).toContain('const initialLoading = loading && applications.length === 0');
    expect(home).toContain('{initialLoading ? (\n                <DesktopLoadingState');
    expect(home).toContain('variant="applications"');
    expect(home).toContain('title="正在同步申请"');
    expect(home).toContain('正在读取项目、材料与截止时间');
    expect(home).toContain('desktop-project-toolbar desktop-application-context-toolbar');
    expect(home.indexOf('desktop-project-toolbar desktop-application-context-toolbar')).toBeLessThan(home.indexOf('variant="applications"'));
    expect(home).toContain('hasHardLoadError ? (');
    expect(home).not.toContain('desktop-workbench-loading-state');
  });

  it('keeps the second application pane static and silent', () => {
    const detailLoading = home.slice(home.indexOf('title="正在整理项目详情"') - 90, home.indexOf('title="正在整理项目详情"') + 140);
    expect(detailLoading).toContain('variant="detail"');
    expect(detailLoading).toContain('showHeading={false}');
    expect(home).not.toContain('desktop-inspector-loading-icon');
  });

  it('keeps notice filters and cached data in place while refreshing', () => {
    expect(notices).toContain('nativeData ? !nativeResult && (isLoading || nativeSnapshot.key !== nativeQueryKey)');
    expect(notices).toContain('isLoading && projects.length === 0');
    expect(notices).toContain('setIsLoading(!cached)');
    expect(notices).toContain('variant="notices"');
    expect(notices).toContain('if (isDesktopSurface) {\n    return (\n      <DesktopLoadingState');
    expect(notices).toContain('disabled={isLoading || isRefreshing}');
    expect(notices).toContain('aria-busy={showRefreshActivity}');
    expect(notices).toContain('isDesktopSurface && showRefreshActivity ? (');
    expect(notices).toContain('isRefreshing && (!isDesktopSurface || !isNoticeLoading)');
  });

  it('covers local lazy routes without making up cloud synchronization', () => {
    for (const variant of ['settings', 'schedule', 'resources', 'help']) {
      expect(shell).toContain(`variant="${variant}" />`);
    }
    const fallbacks = shell.slice(shell.indexOf('const DesktopSettingsPage'), shell.indexOf('type DesktopNavItem'));
    expect(fallbacks).toContain('desktop-page-header-title');
    expect(fallbacks).not.toContain('云端');
    expect(fallbacks).not.toContain('setTimeout');
    expect(fallbacks).not.toContain('desktop-route-loading');
  });

  it('keeps reads and writes recoverable rather than leaving a permanent pending panel', () => {
    const panel = source('components/notice-workbench-panel.tsx');
    expect(panel).toContain('if (active) setReady(true)');
    expect(panel).toContain('if (loadError && !row)');
    expect(panel).toContain('setRetryToken((value) => value + 1)');
    expect(panel).toContain('if (!row || savingRef.current)');
    expect(panel).toContain('savingRef.current = false');
    expect(panel).toContain('暂未确认保存结果，当前备注仍保留，请刷新状态后确认。');
    expect(panel).toContain('aria-busy={saving}');
  });
});
