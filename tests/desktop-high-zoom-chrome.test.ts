import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';
import { clampDesktopFloatingSurface } from '@/lib/desktop-floating-surface';

const projectRoot = resolve(import.meta.dirname, '..');
const flagshipSource = readFileSync(resolve(projectRoot, 'app/desktop-flagship.css'), 'utf8');
const qqSource = readFileSync(resolve(projectRoot, 'app/desktop-qq.css'), 'utf8');
const shellSource = readFileSync(resolve(projectRoot, 'components/desktop-app-shell.tsx'), 'utf8');
const homeSource = readFileSync(resolve(projectRoot, 'components/desktop-home.tsx'), 'utf8');
const confirmSource = readFileSync(resolve(projectRoot, 'components/desktop-confirm-dialog.tsx'), 'utf8');
const updaterSource = readFileSync(resolve(projectRoot, 'components/desktop-update-provider.tsx'), 'utf8');
const layoutSource = readFileSync(resolve(projectRoot, 'app/build-surface.desktop.tsx'), 'utf8');
const stylesheet = postcss.parse(flagshipSource, { from: 'app/desktop-flagship.css' });

function declarations(fragment: string, highZoom = false) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (
      !rule.selectors.some(
        (selector) =>
          selector.includes(fragment) &&
          (!highZoom || /data-(?:desktop-)?zoom-level='(?:150|175|200)'/.test(selector))
      )
    ) {
      return;
    }
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

function px(value: string | undefined) {
  const match = value?.match(/^(\d+(?:\.\d+)?)px$/);
  return match ? Number(match[1]) : Number.NaN;
}

describe('desktop chrome and overlays at native 960px high zoom', () => {
  it('keeps every required title-bar control plus a 32px drag target inside the 200% layout viewport', () => {
    const topbar = declarations('.desktop-topbar', true);
    const brand = declarations('.desktop-titlebar-brand', true);
    const drag = declarations('.desktop-titlebar-drag', true);
    const action = declarations('.desktop-search-trigger', true);
    const controls = declarations('.desktop-window-controls', true);
    const caption = declarations('.desktop-caption-button', true);

    expect(shellSource).toContain('desktop-titlebar-actions');
    expect(topbar.get('width')).toBe('100%');
    expect(topbar.get('min-width')).toBe('0');
    expect(topbar.get('max-width')).toBe('100%');
    expect(topbar.get('overflow')).toBe('hidden');
    expect(drag.get('min-width')).toBe('32px');
    expect(drag.get('flex')).toBe('1 1 32px');

    const requiredWidth =
      px(brand.get('width')) +
      px(drag.get('min-width')) +
      px(action.get('min-width')) * 2 + // search and reminder
      px(controls.get('width')) +
      20; // four title-bar gaps and one action-group gap
    for (const zoom of [1.5, 1.75, 2]) {
      expect(requiredWidth, `${zoom * 100}% title bar`).toBeLessThanOrEqual(960 / zoom);
    }
    expect(px(action.get('min-width'))).toBeGreaterThanOrEqual(34);
    expect(px(caption.get('width')) * 3).toBe(px(controls.get('width')));

    for (const retained of [
      '.desktop-brand-mark',
      '.desktop-search-trigger',
      '.desktop-toolbar-icon',
      '.desktop-window-controls',
      '.desktop-caption-button'
    ]) {
      expect(declarations(retained, true).get('display')).not.toBe('none');
    }
  });

  it('uses corrected root-zoom viewport variables for every final fixed drawer and dialog', () => {
    expect(flagshipSource).not.toMatch(/\b100v(?:w|h)\b/);

    const correctedSurfaces: Array<[string, string]> = [
      ['.desktop-reminder-center', 'width'],
      ['.desktop-reminder-center', 'height'],
      ['.desktop-reminder-backdrop', 'width'],
      ['.desktop-reminder-backdrop', 'height'],
      ['.desktop-route-progress', 'width'],
      ['.desktop-command-dialog', 'width'],
      ['.desktop-command-backdrop', 'width'],
      ['.desktop-command-backdrop', 'height'],
      ['.desktop-quick-add-backdrop', 'width'],
      ['.desktop-quick-add-backdrop', 'height'],
      ['.desktop-quick-add-dialog', 'width'],
      ['.desktop-quick-add-dialog', 'max-height'],
      [".desktop-project-workspace[data-layout-mode='drawer']", 'width'],
      [".desktop-project-workspace[data-layout-mode='drawer']", 'height'],
      ['.desktop-inspector-backdrop', 'width'],
      ['.desktop-inspector-backdrop', 'height'],
      ['.desktop-feedback-toast', 'width'],
      ['.desktop-feedback-toast', 'top'],
      ['.desktop-window-error', 'width'],
      ['.desktop-window-error', 'left'],
      ['.desktop-zoom-error', 'width'],
      ['.desktop-zoom-error', 'top'],
      ['.desktop-offer-dialog-panel', 'width'],
      ['.desktop-offer-dialog-panel', 'max-height'],
      ['.desktop-global-dialog-backdrop', 'width'],
      ['.desktop-global-dialog-backdrop', 'height'],
      ['.desktop-global-dialog-panel', 'width'],
      ['.desktop-global-dialog-panel', 'max-height'],
      ['.desktop-update-toast', 'width'],
      ['.desktop-update-toast', 'max-height']
    ];

    for (const [selector, property] of correctedSurfaces) {
      const value = declarations(selector).get(property) || '';
      expect(value, `${selector} ${property}`).toContain('--desktop-zoomed-viewport-');
      expect(value, `${selector} ${property}`).not.toMatch(/\b100v(?:w|h)\b/);
    }

    for (const selector of [
      '.desktop-reminder-center',
      '.desktop-reminder-backdrop',
      '.desktop-command-backdrop',
      '.desktop-offer-dialog',
      '.desktop-discussion-dialog'
    ]) {
      const fixedSurface = declarations(selector);
      expect(fixedSurface.get('right'), `${selector} right`).toBe('auto');
      expect(fixedSurface.get('bottom'), `${selector} bottom`).toBe('auto');
    }
    expect(declarations('.desktop-reminder-center').get('left'))
      .toContain('--desktop-zoomed-viewport-width');
    expect(declarations('.desktop-reminder-backdrop').get('left')).toBe('var(--so-rail-w)');
    expect(declarations('.desktop-command-backdrop').get('top')).toBe('0');
    expect(declarations('.desktop-command-backdrop').get('left')).toBe('0');
    expect(declarations('.desktop-global-dialog-backdrop').get('inset')).toBe('auto');
    expect(declarations('.desktop-quick-add-backdrop').get('inset')).toBe('auto');

    expect(declarations('.desktop-project-workspace[data-layout-mode=', true).get('width'))
      .toContain('--desktop-zoom-drawer-width');
    expect(declarations('.desktop-auth-shell').get('min-height'))
      .toContain('--desktop-zoomed-viewport-height');
    const authForm = declarations('.desktop-auth-form-region', true);
    expect(authForm.get('place-items')).toBe('start center');
    expect(authForm.get('align-content')).toBe('start');
    expect(authForm.get('overflow')).toBe('auto');

    for (const [zoom, width, height] of [
      ['150', '66.666667vw', '66.666667vh'],
      ['175', '57.142857vw', '57.142857vh'],
      ['200', '50vw', '50vh']
    ]) {
      expect(qqSource).toContain(`data-desktop-zoom-level='${zoom}'`);
      expect(qqSource).toContain(`--desktop-zoomed-viewport-width: ${width}`);
      expect(qqSource).toContain(`--desktop-zoomed-viewport-height: ${height}`);
    }
  });

  it('makes the login scroll owner discoverable and keeps focused controls inside view at 175-200%', () => {
    const region = declarations('.desktop-auth-form-region', true);
    const scrollbar = declarations('.desktop-auth-form-region::-webkit-scrollbar', true);
    const thumb = declarations('.desktop-auth-form-region::-webkit-scrollbar-thumb', true);
    const focusedControl = declarations('.desktop-login-field', true);

    expect(region.get('overflow-y')).toBe('auto');
    expect(region.get('scrollbar-gutter')).toBe('stable');
    expect(region.get('scrollbar-width')).toBe('auto');
    expect(scrollbar.get('width')).toBe('12px');
    expect(thumb.get('min-height')).toBe('44px');
    expect(focusedControl.get('scroll-margin-block')).toBe('16px');
  });

  it('covers document.body portals with semantic corrected-viewport classes', () => {
    expect(confirmSource).toContain('desktop-global-dialog-backdrop');
    expect(confirmSource).toContain('desktop-global-dialog-panel');
    expect(updaterSource).toContain('desktop-global-dialog-backdrop');
    expect(updaterSource).toContain('desktop-global-dialog-panel');
    expect(updaterSource).toContain('desktop-update-toast');
    expect(updaterSource).not.toMatch(/text-\[(?:11|11\.5)px\]/);
    expect(updaterSource).not.toMatch(/max-[wh]-\[calc\(100v[wh]/);
    expect(flagshipSource).toContain(
      '.seekoffer-desktop-surface :is(.desktop-offer-dialog, .desktop-discussion-dialog)'
    );
  });

  it('clamps a project context menu to the corrected layout viewport at 150/175/200%', () => {
    expect(homeSource).toContain('document.documentElement.clientWidth');
    expect(homeSource).toContain('document.documentElement.clientHeight');
    expect(homeSource).toContain('menu.getBoundingClientRect()');
    expect(homeSource).not.toContain('window.innerWidth - menuWidth');
    expect(homeSource).not.toContain('window.innerHeight - menuHeight');

    for (const zoom of [1.5, 1.75, 2]) {
      const viewportWidth = 960 / zoom;
      const viewportHeight = 720 / zoom;
      const position = clampDesktopFloatingSurface(
        viewportWidth - 1,
        viewportHeight - 1,
        viewportWidth,
        viewportHeight,
        248,
        286
      );
      expect(position.left).toBeGreaterThanOrEqual(8);
      expect(position.top).toBeGreaterThanOrEqual(8);
      expect(position.left + 248).toBeLessThanOrEqual(viewportWidth - 8);
      expect(position.top + 286).toBeLessThanOrEqual(viewportHeight - 8);
    }

    expect(declarations('.desktop-project-context-menu').get('max-height'))
      .toContain('--desktop-zoomed-viewport-height');
  });

  it('keeps high-zoom settings in a single content column with an independently scrollable category strip', () => {
    const layout = declarations('.desktop-settings-layout', true);
    const nav = declarations('.desktop-settings-nav', true);
    const item = declarations('.desktop-settings-nav-item', true);
    const content = declarations('.desktop-settings-content', true);

    expect(layout.get('grid-template-columns')).toBe('minmax(0, 1fr)');
    expect(layout.get('grid-template-rows')).toBe('45px minmax(0, 1fr)');
    expect(layout.get('overflow')).toBe('hidden');
    expect(nav.get('max-width')).toBe('100%');
    expect(nav.get('flex-direction')).toBe('row');
    expect(nav.get('overflow-x')).toBe('auto');
    expect(nav.get('overflow-y')).toBe('hidden');
    expect(item.get('min-width')).toBe('max-content');
    expect(content.get('min-width')).toBe('0');
    expect(content.get('overflow-x')).toBe('hidden');
    expect(content.get('overflow-y')).toBe('auto');
  });

  it('collapses My Day to one readable column without relying on viewport media queries', () => {
    const content = declarations('.desktop-home-content', true);
    const workspace = declarations('.desktop-home-workspace', true);
    const weekStrip = declarations('.desktop-week-strip', true);
    const weekDays = declarations('.desktop-week-days', true);
    const todayCommand = declarations('.desktop-today-command', true);

    expect(content.get('min-width')).toBe('0');
    expect(content.get('max-width')).toBe('100%');
    expect(content.get('overflow-x')).toBe('hidden');
    expect(workspace.get('grid-template-columns')).toBe('minmax(0, 1fr)');
    expect(weekStrip.get('grid-template-columns')).toBe('28px minmax(0, 1fr) 28px');
    expect(weekDays.get('grid-template-columns')).toBe('repeat(7, minmax(0, 1fr))');
    expect(todayCommand.get('display')).toBe('none');
  });

  it('stacks schedule quick-add fields explicitly at every high zoom level', () => {
    const quickAddRows = declarations('.desktop-schedule-quick-add > div:nth-child', true);
    const quickAdd = declarations('.desktop-schedule-quick-add', true);

    expect(quickAdd.get('min-width')).toBe('0');
    expect(quickAdd.get('max-width')).toBe('100%');
    expect(quickAddRows.get('grid-template-columns')).toBe('minmax(0, 1fr)');
  });

  it('wins the CSS import cascade with standard 12px captions and 500/600/700 weights', () => {
    expect(layoutSource.indexOf("'./desktop-flagship.css'"))
      .toBeGreaterThan(layoutSource.indexOf("'./desktop-mchose.css'"));

    for (const selector of [
      '.desktop-project-context-menu-heading span',
      '.desktop-project-material-meta-hint',
      '.desktop-project-identity small',
      '.desktop-project-deadline small',
      '.desktop-project-material-meta-grid label > span',
      '.desktop-project-material-toggle',
      '.desktop-project-mentor-summary-meta',
      '.desktop-project-table-header',
      '.desktop-zoom-menu header span',
      '.desktop-command-group-label'
    ]) {
      expect(declarations(selector).get('font-size'), selector).toBe('12px');
      expect(['500', '600']).toContain(declarations(selector).get('font-weight'));
    }

    for (const selector of [
      '.desktop-project-next-action-copy > strong',
      '.desktop-project-related-actions > :is(button, a)',
      '.desktop-feedback-copy strong',
      '.desktop-project-activity-list strong',
      '.desktop-login-primary',
      '.desktop-register-context',
      '.desktop-register-context button',
      '.desktop-login-assist',
      '.desktop-login-assist button',
      '.desktop-login-legal',
      '.desktop-login-legal button',
      '.desktop-login-register-link button',
      '.desktop-login-code-action',
      '.desktop-auth-trust strong',
      '.desktop-startup-recovery button'
    ]) {
      expect(declarations(selector).get('font-weight'), selector).toBe('600');
    }
    expect(declarations('.desktop-startup-content h1').get('font-weight')).toBe('700');
    expect(flagshipSource).not.toMatch(/font-weight:\s*(?:650|750)\b/);
  });
});
