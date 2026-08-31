import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(projectRoot, 'app/colleges/page.tsx'), 'utf8');
const css = readFileSync(resolve(projectRoot, 'app/colleges/colleges.module.css'), 'utf8');

function cssRule(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`));
  expect(match, `missing CSS rule: ${selector}`).not.toBeNull();
  return match?.[1] ?? '';
}

function cssSection(startMarker: string, endMarker: string) {
  const startIndex = css.indexOf(startMarker);
  const endIndex = css.indexOf(endMarker, startIndex + startMarker.length);
  expect(startIndex, `missing CSS section: ${startMarker}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `missing CSS section boundary: ${endMarker}`).toBeGreaterThan(startIndex);
  return css.slice(startIndex, endIndex);
}

function sourceSection(startMarker: string, endMarker: string) {
  const startIndex = source.indexOf(startMarker);
  const endIndex = source.indexOf(endMarker, startIndex + startMarker.length);
  expect(startIndex, `missing source section: ${startMarker}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `missing source section boundary: ${endMarker}`).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('desktop college mature aligned two-column redesign', () => {
  it('keeps the structural redesign behind the desktop surface branch', () => {
    expect(source).toContain("const isDesktopSurface = process.env.NEXT_PUBLIC_SEEKOFFER_SURFACE === 'desktop'");
    expect(source).toContain("isDesktopSurface ? styles.page : 'desktop-college-page'");
    expect(source).toContain('desktop-college-toolbar product-card');
    expect(source).toContain('desktop-college-card surface-card');
  });

  it('uses the shared page header and keeps search, sorting and filters in a separate toolbar', () => {
    expect(source).toContain('desktop-page-header desktop-page-header--directory');
    expect(source).toContain('desktop-page-header-copy');
    expect(source).toContain('desktop-page-header-title');
    expect(source).toContain('desktop-page-header-count');
    expect(source).not.toContain('className={styles.headerIcon}');
    expect(source).toContain('desktop-college-page-toolbar');
    expect(source).toContain('desktop-college-page-toolbar-controls');
    expect(source).toContain('placeholder="搜索院校名称"');
    expect(source).toContain('共 {filteredColleges.length} 所院校');
    expect(source).toContain('function DesktopCollegeFilters');
    expect(source).toContain('sortBy={sortBy}');
    expect(source).toContain('onSortChange={setSortBy}');
    expect(source).toContain('popover="auto"');
    expect(source).toContain('toggleCollegePopover');
    expect(source).toContain('aria-live="polite"');
    expect(source.indexOf('desktop-college-page-toolbar')).toBeGreaterThan(
      source.indexOf('</header>')
    );
    const headerRule = cssRule('.pageHeader');
    const titleRule = cssRule('.pageHeader h1');
    const headerControlsRule = cssRule('.headerControls');
    const toolbarRule = cssRule('.toolbar');
    const searchRule = cssRule('.searchBox');

    expect(headerRule).toContain('min-height: 88px');
    expect(headerRule).toContain('padding: 12px 20px');
    expect(headerRule).toContain('align-items: center');
    expect(titleRule).toContain('font-size: 28px');
    expect(titleRule).toContain('line-height: 36px');
    expect(titleRule).toContain('font-weight: 600');
    expect(headerControlsRule).toContain('display: grid');
    expect(headerControlsRule).toContain('grid-template-columns: minmax(280px, 1fr) 148px');
    expect(headerControlsRule).toContain('align-items: center');
    expect(toolbarRule).toContain('min-height: 106px');
    expect(toolbarRule).toContain('padding: 20px');
    expect(toolbarRule).toContain('border-radius: 12px');
    expect(searchRule).toContain('min-width: 0');
    expect(searchRule).toContain('min-height: 48px');
    expect(cssRule('.filterAnchor')).toContain('width: 140px');
    expect(cssRule('.filterTrigger')).toContain('width: 140px');
    expect(css).toMatch(/\.filterTrigger,\s*\.resetButton\s*\{[^}]*height:\s*48px;[^}]*min-height:\s*48px/);
    expect(css).toContain('.filterPopover:popover-open');
    expect(source).toContain('className={styles.filterPopoverBody}');
    expect(cssRule('.filterPopover')).toContain('overflow: hidden');
    expect(cssRule('.filterPopover:popover-open')).toContain('grid-template-rows: auto minmax(0, 1fr) auto');
    expect(cssRule('.filterPopoverBody')).toContain('overflow-y: auto');
  });

  it('uses two evenly aligned cards per wide row with a shared geometry', () => {
    const desktopCardSource = sourceSection(
      'function DesktopCollegeCard',
      'function DesktopCollegePagination',
    );

    expect(source).toContain('function DesktopCollegeCard');
    expect(desktopCardSource).toContain('<h2 title={item.name}>{item.name}</h2>');
    expect(desktopCardSource).toContain('查看报名通知');
    expect(desktopCardSource).toContain('学校官网');
    expect(desktopCardSource).not.toContain('{item.focus || item.domain}');
    expect(desktopCardSource).toMatch(/className=\{styles\.noticeLabel\}[\s\S]*?报名通知/);
    expect(desktopCardSource).toContain('<span>条正在报名</span>');
    expect(desktopCardSource).toContain('<time dateTime={stats.latestPublishDate || undefined}>');
    expect(desktopCardSource).toContain('<span>共 {stats.total} 条</span>');
    expect(desktopCardSource).toContain("? '查看报名通知'");
    expect(desktopCardSource).toContain("? '查看历史通知'");
    expect(desktopCardSource).toContain(": '查看全部通知'");
    expect(desktopCardSource).toContain("data-active={hasActiveNotices ? 'true' : 'false'}");
    expect(desktopCardSource).not.toContain('<small>');
    expect(desktopCardSource).not.toContain('stats.nearDeadline');
    expect(desktopCardSource).not.toContain('近 7 天');

    // Keep the website card independent: its legacy near-deadline summary is
    // intentionally outside the desktop-only component contract.
    expect(source).toContain('<strong>{stats.nearDeadline}</strong> 条近 7 天截止');

    const gridRule = cssRule('.collegeGrid');
    const cardRule = cssRule('.collegeCard');
    const logoRule = cssRule('.collegeLogo');
    const identityRule = cssRule('.collegeIdentity');
    const statsRule = cssRule('.collegeStats');
    const noticeLabelRule = cssRule('.noticeLabel');
    const noticePrimaryRule = cssRule('.noticePrimary');
    const noticeValueRule = cssRule('.noticePrimary strong');
    const noticeSecondaryRule = cssRule('.noticeSecondary');
    const actionsRule = cssRule('.collegeActions');
    const actionRule = cssRule('.collegeActions a');
    const secondaryActionRule = cssRule('.collegeActions a:last-child');
    const titleRule = cssRule('.collegeTitleLine h2');
    const dateRule = cssRule('.collegeIdentity time');
    const logoWidth = logoRule.match(/width:\s*(\d+)px/);
    const logoHeight = logoRule.match(/height:\s*(\d+)px/);

    expect(gridRule).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(gridRule).toContain('align-items: stretch');
    expect(gridRule).toContain('gap: 16px');
    expect(cardRule).toContain('min-height: 240px');
    expect(cardRule).toContain('height: 100%');
    expect(cardRule).toContain('grid-template-columns: 88px minmax(0, 1fr)');
    expect(cardRule).toContain('grid-template-rows: minmax(88px, auto) 44px 44px');
    expect(cardRule).toContain('align-items: center');
    expect(cardRule).toContain('padding: 20px');
    expect(cardRule).toContain('border-radius: var(--product-radius-panel, 12px)');
    expect(cardRule).toContain('box-shadow: none');
    expect(cardRule).toContain('background: var(--so-surface, #fff)');
    expect(logoWidth, 'college logo needs an explicit width').not.toBeNull();
    expect(logoHeight, 'college logo needs an explicit height').not.toBeNull();
    expect(Number(logoWidth?.[1])).toBe(88);
    expect(Number(logoHeight?.[1])).toBe(88);
    expect(titleRule).toContain('font-size: 20px');
    expect(titleRule).toContain('line-height: 30px');
    expect(dateRule).toContain('font-size: 14px');
    expect(dateRule).toContain('line-height: 22px');
    expect(logoRule).toContain('grid-row: 1');
    expect(logoRule).toContain('align-self: start');
    expect(identityRule).toContain('grid-column: 2');
    expect(identityRule).toContain('grid-row: 1');
    expect(identityRule).toContain('align-self: start');
    expect(statsRule).toContain('grid-column: 1 / -1');
    expect(statsRule).toContain('grid-row: 2');
    expect(statsRule).toContain('grid-template-columns: auto auto minmax(0, 1fr)');
    expect(statsRule).toContain('grid-template-rows: auto');
    expect(statsRule).toContain('align-items: baseline');
    expect(statsRule).toContain('align-self: stretch');
    expect(actionsRule).toContain('grid-column: 1 / -1');
    expect(actionsRule).toContain('grid-row: 3');
    expect(actionsRule).toContain('display: grid');
    expect(actionsRule).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(actionsRule).toContain('grid-template-rows: 44px');
    expect(actionsRule).toContain('align-self: stretch');
    expect(actionsRule).toContain('align-content: stretch');
    expect(actionRule).toContain('width: 100%');
    expect(actionRule).toContain('min-height: 44px');
    expect(secondaryActionRule).toContain('min-height: 44px');

    // The registration summary is a single quiet information panel, matching
    // the notice-library card hierarchy without returning the removed near-7-day copy.
    expect(statsRule).toContain('padding: 0 14px');
    expect(statsRule).toContain('border-radius: 12px');
    expect(statsRule).toContain('background: var(--so-surface-subtle');
    expect(statsRule).not.toContain('gradient');
    expect(noticeLabelRule).toContain('padding: 0');
    expect(noticeLabelRule).toContain('border-radius: 0');
    expect(noticeLabelRule).toContain('background: transparent');
    expect(noticeLabelRule).toContain('color: var(--so-text-secondary');
    expect(noticeLabelRule).toContain('grid-column: 1');
    expect(noticeLabelRule).toContain('grid-row: 1');
    expect(noticeSecondaryRule).toContain('grid-column: 3');
    expect(noticeSecondaryRule).toContain('grid-row: 1');
    expect(noticeSecondaryRule).toContain('text-align: left');
    expect(noticeSecondaryRule).toContain('padding: 0 0 0 10px');
    expect(noticeSecondaryRule).toContain('border-left: 1px solid color-mix');
    expect(noticePrimaryRule).toContain('grid-column: 2');
    expect(noticePrimaryRule).toContain('grid-row: 1');
    expect(noticeValueRule).toContain('display: inline-flex');
    expect(noticeValueRule).toContain('width: 3ch');
    expect(noticeValueRule).toContain('min-width: 3ch');
    expect(noticeValueRule).toContain('justify-content: center');
    expect(noticeValueRule).toContain('text-align: center');
    expect(noticeValueRule).toContain('color: var(--so-text');
    expect(noticeValueRule).toContain('font-variant-numeric: tabular-nums');
    expect(cssRule('.noticeSecondary span')).toContain('font-variant-numeric: tabular-nums');
    expect(css).toMatch(/\.groupBadge\s*\{[^}]*background:\s*var\(--so-surface-muted/);

    // Match the notice-library hierarchy: one dark-teal primary action, then a
    // quiet white secondary action with a thin neutral outline.
    expect(actionRule).toContain('background: var(--so-brand-strong');
    expect(actionRule).toContain('color: #fff');
    expect(actionRule).toContain('border: 1px solid var(--so-brand-strong');
    expect(secondaryActionRule).toContain('background: var(--so-surface, #fff)');
    expect(secondaryActionRule).toContain('border-color: var(--so-border');
    expect(secondaryActionRule).toContain('color: var(--so-brand-strong');
    expect(cssRule('.collegeCard:hover')).toContain('box-shadow: none');
    expect(css).toMatch(/\.noticeAction\.noticeAction\[data-active='false'\][\s\S]*?background:\s*var\(--so-surface/);
    expect(cssRule('.emptyResult')).toContain('place-items: center');
  });

  it('keeps pagination controls truly centered between equal outer tracks', () => {
    const paginationRule = cssRule('.pagination');
    const paginationControlsRule = cssRule('.pagination > div');
    const paginationJumpRule = cssRule('.pagination > label');

    expect(paginationRule).toContain(
      'grid-template-columns: minmax(150px, 1fr) auto minmax(150px, 1fr)',
    );
    expect(paginationRule).toContain('align-items: center');
    expect(paginationControlsRule).toContain('justify-content: center');
    expect(paginationJumpRule).toContain('justify-self: end');
  });

  it('reflows header, card facts, notice statistics and actions before they can overlap', () => {
    const singleColumnLayout = cssSection(
      '@container college-page (max-width: 1080px)',
      '@container college-page (max-width: 900px)',
    );
    const mediumCardLayout = cssSection(
      '@container college-page (max-width: 820px)',
      '@container college-page (max-width: 620px)',
    );
    const narrowCardLayout = cssSection(
      '@container college-page (max-width: 620px)',
      '@container college-page (max-width: 440px)',
    );
    const zoomCardLayout = cssSection(
      ":global(.desktop-app-shell:is([data-zoom-level='150'], [data-zoom-level='175'], [data-zoom-level='200'])) .page",
      '@media (prefers-reduced-motion: reduce)',
    );
    const highZoomCardLayout = cssSection(
      ":global(.desktop-app-shell:is([data-zoom-level='175'], [data-zoom-level='200'])) .headerControls",
      '@media (prefers-reduced-motion: reduce)',
    );
    const containerBreakpoints = css.match(/@container college-page \(max-width: \d+px\)/g) ?? [];
    expect(containerBreakpoints.length).toBeGreaterThanOrEqual(2);
    expect(singleColumnLayout).toMatch(
      /\.collegeGrid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(singleColumnLayout).toMatch(
      /\.collegeCard\s*\{[^}]*grid-template-columns:\s*\d+px minmax\(0, 1fr\) \d+px/,
    );
    expect(css).toMatch(/@container college-page \(max-width: \d+px\)[\s\S]*?\.headerControls\s*\{/);
    expect(css).toMatch(/@container college-page \(max-width: \d+px\)[\s\S]*?\.collegeCard\s*\{/);
    expect(css).toMatch(/@container college-page \(max-width: \d+px\)[\s\S]*?\.collegeStats\s*\{/);
    expect(css).toMatch(/@container college-page \(max-width: \d+px\)[\s\S]*?\.collegeActions\s*\{/);
    expect(css).toContain("[data-zoom-level='150']");
    expect(css).toContain("[data-zoom-level='175']");
    expect(css).toContain("[data-zoom-level='200']");
    expect(css).toMatch(/data-zoom-level='200'[\s\S]*?\.collegeGrid/);
    expect(mediumCardLayout).toMatch(/\.collegeCard\s*\{[^}]*min-height:\s*240px/);
    expect(mediumCardLayout).toMatch(
      /\.collegeStats\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-row:\s*2/,
    );
    expect(mediumCardLayout).toMatch(
      /\.collegeActions\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-row:\s*3/,
    );

    // Every responsive form keeps the same semantic single-line summary.
    // This prevents intermediate resize and zoom frames from briefly stacking
    // or overlapping the label, active count and total.
    for (const responsiveLayout of [mediumCardLayout, narrowCardLayout, zoomCardLayout]) {
      expect(responsiveLayout).toMatch(
        /\.collegeStats\s*\{[^}]*grid-template-columns:\s*auto auto minmax\(0, 1fr\);[^}]*grid-template-rows:\s*auto;/,
      );
      expect(responsiveLayout).toMatch(
        /\.noticeLabel\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1/,
      );
      expect(responsiveLayout).toMatch(
        /\.noticePrimary\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1/,
      );
      expect(responsiveLayout).toMatch(
        /\.noticeSecondary\s*\{[^}]*grid-column:\s*3;[^}]*grid-row:\s*1/,
      );
      expect(responsiveLayout).not.toMatch(
        /\.collegeStats\s*\{[^}]*grid-template-rows:\s*auto auto/,
      );
    }

    // The 175-200% refinement inherits the explicit three-column/one-row
    // contract above and must never reintroduce a stacked second row.
    expect(highZoomCardLayout).toMatch(
      /\.collegeStats\s*\{[^}]*grid-template-columns:\s*auto auto minmax\(0, 1fr\)/,
    );
    expect(highZoomCardLayout).toMatch(
      /\.noticeLabel\s*\{[^}]*grid-column:\s*1/,
    );
    expect(highZoomCardLayout).not.toMatch(/grid-row:\s*2/);
    expect(highZoomCardLayout).not.toMatch(
      /\.collegeStats\s*\{[^}]*grid-template-rows:\s*auto auto/,
    );

    expect(narrowCardLayout).toMatch(
      /\.collegeCard\s*\{[^}]*min-height:\s*0;[^}]*grid-template-columns:\s*\d+px minmax\(0, 1fr\);[^}]*grid-template-rows:\s*auto auto auto/,
    );
    expect(narrowCardLayout).toMatch(
      /\.collegeActions\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-row:\s*3;[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);[^}]*grid-template-rows:\s*auto/,
    );
    expect(zoomCardLayout).toMatch(
      /\.collegeCard\s*\{[^}]*min-height:\s*0;[^}]*grid-template-columns:\s*\d+px minmax\(0, 1fr\);[^}]*grid-template-rows:\s*auto auto auto/,
    );
    expect(zoomCardLayout).toMatch(
      /\.collegeStats\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-row:\s*2/,
    );
    expect(zoomCardLayout).toMatch(
      /\.collegeActions\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-row:\s*3;[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);[^}]*grid-template-rows:\s*auto/,
    );
    expect(cssRule('.collegeIdentity')).toContain('min-width: 0');
    expect(cssRule('.collegeActions')).toContain('min-width: 0');
  });

  it('makes the current page explicit for assistive technology', () => {
    expect(source).toContain('aria-current={currentPage === pageNumber ? \'page\' : undefined}');
    expect(source).toContain('aria-label="院校库分页"');
  });
});
