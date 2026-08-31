import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');

async function readSource(path: string) {
  return (await readFile(resolve(root, path), 'utf8')).replace(/\r\n/g, '\n');
}

describe('desktop product layout contract', () => {
  it('uses measured layout modes and keeps the drawer decision in sync with the DOM', async () => {
    const source = await readSource('components/desktop-home.tsx');
    const css = await readSource('app/desktop-mchose.css');

    expect(source).toContain("type DesktopLayoutMode = 'wide' | 'split' | 'drawer'");
    expect(source).toContain('new ResizeObserver(updateLayoutMode)');
    expect(source).toContain("zoomLevel >= 150 || width < 980");
    expect(source).toContain("data-layout-mode={layoutMode}");
    expect(css).toContain('.desktop-app-shell .desktop-content-region');
    expect(css).toContain('justify-content: center !important');
    expect(css).toContain('margin-inline: auto !important');
    expect(css).toContain("[data-layout-mode='drawer'] .desktop-project-workspace");
  });

  it('keeps loading and empty panes intentional without shimmer or duplicate announcements', async () => {
    const homeSource = await readSource('components/desktop-home.tsx');
    const noticesSource = await readSource('app/notices/page.tsx');
    const css = await readSource('app/desktop-mchose.css');

    expect(homeSource).toContain('className="desktop-inspector-loading"');
    expect(homeSource).toContain('className="desktop-workbench-loading-state"');
    expect(homeSource).not.toContain('desktop-workbench-skeleton');
    expect(css).toContain('.desktop-inspector-loading-icon');
    expect(noticesSource).toContain('function NoticeLoadingState()');
    expect(noticesSource).toContain('aria-busy="true"');
    expect(noticesSource).toContain('aria-hidden="true"');
    expect(noticesSource).not.toContain('className="desktop-notice-side-loading flex min-h-24 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-4"\n      role="status"');
  });

  it('uses persistent icon-and-text navigation without delayed tooltip prompts', async () => {
    const [shell, coherenceCss, legacyCss] = await Promise.all([
      readSource('components/desktop-app-shell.tsx'),
      readSource('app/desktop-app-coherence.css'),
      readSource('app/desktop-qq.css')
    ]);
    const desktopLinkSource = shell.slice(
      shell.indexOf('function DesktopLink('),
      shell.indexOf('function DesktopExternalLinkBridge()')
    );
    const railSource = shell.slice(
      shell.indexOf('<nav\n        ref={primaryRailRef}'),
      shell.indexOf('</nav>', shell.indexOf('<nav\n        ref={primaryRailRef}'))
    );
    expect(shell).not.toContain('desktop-rail-tooltip');
    expect(shell).not.toContain('tooltipLabel');
    expect(shell).not.toContain('RailTooltip');
    expect(shell).not.toContain('DESKTOP_RAIL_TOOLTIP_DELAY_MS');
    expect(desktopLinkSource).toContain('aria-label={ariaLabel}');
    expect(desktopLinkSource).not.toMatch(/\btitle\b/);
    expect(railSource).not.toMatch(/\btitle\s*=/);
    expect(railSource).toContain('className="desktop-nav-group-label"');
    expect(railSource).toContain('<span>{item.label}</span>');
    expect(railSource).toContain('ariaLabel="帮助与反馈"');
    expect(railSource).toContain(
      "aria-label={updaterAttention ? `设置，${updaterAttention.label}` : '设置'}"
    );
    expect(railSource).toContain('aria-keyshortcuts="Control+,"');
    expect(legacyCss).not.toContain(
      '.desktop-primary-nav-item:hover > span:not(.desktop-nav-badge)'
    );
    expect(legacyCss).not.toContain('.desktop-rail-utility-button:hover > span');
    expect(coherenceCss).toContain('--so-rail-w: 188px !important');
    expect(coherenceCss).toContain('display: block !important');
    expect(coherenceCss).toContain("[data-zoom-level='200']");
  });

  it('keeps history controls backed by an app-local index', async () => {
    const shell = await readSource('components/desktop-app-shell.tsx');

    expect(shell).toContain('normalizeDesktopHref');
    expect(shell).toContain('__seekofferHistoryIndex');
    expect(shell).toContain('__seekofferHistoryMax');
  });
});
