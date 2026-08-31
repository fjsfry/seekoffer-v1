import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const shellSource = readFileSync(resolve(root, 'components/desktop-app-shell.tsx'), 'utf8');
const layoutSource = readFileSync(resolve(root, 'app/build-surface.desktop.tsx'), 'utf8');
const scheduleSource = readFileSync(resolve(root, 'components/desktop-schedule-workspace.tsx'), 'utf8');
const contactsSource = readFileSync(resolve(root, 'components/desktop-contacts-workspace.tsx'), 'utf8');
const helpSource = readFileSync(resolve(root, 'app/guide/desktop-help-center.tsx'), 'utf8');
const collegeSource = readFileSync(resolve(root, 'app/colleges/page.tsx'), 'utf8');
const cssPath = resolve(root, 'app/desktop-app-coherence.css');
const cssSource = readFileSync(cssPath, 'utf8');
const stylesheet = postcss.parse(cssSource, { from: cssPath });

function declarationsForExact(selector: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (rule.parent?.type !== 'root' || !rule.selectors.includes(selector)) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

function declarationsContaining(...fragments: string[]) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.some((selector) => fragments.every((fragment) => selector.includes(fragment)))) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

function baseDeclarationsContaining(...fragments: string[]) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (rule.parent?.type !== 'root') return;
    if (!rule.selectors.some((selector) =>
      !selector.includes('data-zoom-level') &&
      !selector.includes('data-desktop-zoom-level') &&
      !selector.includes(':hover') &&
      !selector.includes(':active') &&
      !selector.includes(':focus') &&
      !selector.includes(':disabled') &&
      !selector.includes('::') &&
      !selector.includes('[aria-current') &&
      !selector.includes('>') &&
      fragments.every((fragment) => selector.includes(fragment)))) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

describe('desktop app coherence authority', () => {
  it('is imported last and defines one shared desktop design vocabulary', () => {
    const imports = [...layoutSource.matchAll(/import ['"]\.\/(desktop[^'"]*\.css)['"];?/g)]
      .map((match) => match[1]);
    expect(imports.at(-1)).toBe('desktop-app-coherence.css');
    for (const token of [
      '--app-page-max: 1280px',
      '--app-page-gap: 16px',
      '--app-page-title-size: 28px',
      '--app-body-size: 14px',
      '--app-control-h: 36px',
      '--app-search-h: 40px',
      '--app-radius-control: 8px',
      '--app-radius-panel: 12px',
      '--app-primary-bg: #0f6b61',
      '--app-primary-bg-hover: #0c5e56'
    ]) {
      expect(cssSource).toContain(token);
    }
  });

  it('renders grouped icon-and-text navigation and removes delayed tooltips', () => {
    expect(shellSource).toContain('const primaryNavigationGroups');
    expect(shellSource).toContain("label: '申请管理'");
    expect(shellSource).toContain("label: '信息与资源'");
    expect(shellSource).toContain('className="desktop-nav-group-label"');
    expect(shellSource).toContain('<span>{item.label}</span>');
    expect(shellSource).toContain('aria-current={ariaCurrent}');
    expect(shellSource).toContain('aria-keyshortcuts="Control+,"');
    expect(shellSource).not.toContain('desktop-rail-tooltip');
    expect(shellSource).not.toContain('tooltipLabel');
    expect(shellSource).not.toContain('DESKTOP_RAIL_TOOLTIP_DELAY_MS');
  });

  it('uses a notice-library-scale rail and visible single-line labels at every zoom level', () => {
    const shell = declarationsForExact('.desktop-app-shell:is(.desktop-app-shell)');
    const navItem = baseDeclarationsContaining('.desktop-primary-nav-item', '.desktop-rail-utility-button');
    const groupLabel = declarationsForExact(
      '.desktop-app-shell:is(.desktop-app-shell) .desktop-nav-group-label'
    );
    const labels = declarationsContaining('.desktop-primary-nav-item > span:not(.desktop-nav-badge)');
    const highLabels = declarationsContaining("data-zoom-level='200'", '.desktop-primary-nav-item > span');
    const highUtilities = declarationsContaining("data-zoom-level='200'", '.desktop-rail-utilities > *');

    expect(shell.get('--so-rail-w')).toBe('188px');
    expect(navItem.get('height')).toBe('48px');
    expect(navItem.get('width')).toBe('100%');
    expect(navItem.get('justify-content')).toBe('flex-start');
    expect(navItem.get('font-size')).toBe('15px');
    expect(navItem.get('line-height')).toBe('22px');
    expect(navItem.get('border-radius')).toBe('var(--product-radius-control)');
    expect(cssSource).toMatch(
      /FINAL NOTICE-LIBRARY PARITY AUTHORITY[\s\S]*?\.desktop-primary-nav-item,[\s\S]*?\.desktop-rail-utility-button[\s\S]*?> svg \{[\s\S]*?width:\s*22px/,
    );
    expect(groupLabel.get('font-size')).toBe('13px');
    expect(labels.get('display')).toBe('block');
    expect(highLabels.get('display')).toBe('block');
    expect(highLabels.get('white-space')).toBe('nowrap');
    expect(highLabels.get('overflow')).toBe('hidden');
    expect(highUtilities.get('display')).toBe('flex');
    expect(cssSource).toContain("[data-desktop-zoom-level='125']");
    expect(cssSource).toContain("[data-zoom-level='150']");
    expect(cssSource).toContain('--so-rail-w: 148px !important');
    expect(cssSource).toContain('--so-rail-w: 140px !important');
  });

  it('unifies top-level headings, headers, primary actions and search controls', () => {
    expect(cssSource).toContain('#schedule-page-title');
    expect(cssSource).toContain('#contacts-page-title');
    expect(cssSource).toContain('.desktop-notice-hero h1');
    expect(cssSource).toContain('.desktop-college-hero h1');
    expect(cssSource).toContain('.desktop-resource-hero h1');
    expect(cssSource).toContain('.desktop-help-hero h1');
    expect(cssSource).toContain('.desktop-settings-header h1');
    expect(cssSource).toContain('.desktop-application-context-header h1');
    expect(scheduleSource).toContain('desktop-page-primary-action');
    expect(contactsSource).toContain('desktop-page-primary-action');
    expect(helpSource).toContain('className="desktop-help-search-toolbar"');
    expect(helpSource.indexOf('className="desktop-help-search-toolbar"'))
      .toBeGreaterThan(helpSource.indexOf('</header>'));

    const primaryAction = baseDeclarationsContaining('.desktop-page-primary-action');
    expect(primaryAction.get('height')).toBe('var(--app-control-h)');
    expect(primaryAction.get('border-radius')).toBe('var(--product-radius-control)');
    expect(primaryAction.get('background')).toBe('var(--app-primary-bg)');
    expect(collegeSource).toContain('desktop-college-card-actions-final');
    expect(cssSource).toContain('.desktop-notice-card-buttons');
    expect(cssSource).toContain('--app-primary-bg: var(--product-action-bg) !important');
  });

  it('keeps settings and help header geometry aligned with their parent layouts', () => {
    expect(cssSource).toContain('grid-template-rows: var(--app-page-header-h) minmax(0, 1fr) !important');
    expect(cssSource).toContain('width: calc(100% - 40px) !important');
    expect(cssSource).toContain('margin: 18px 20px 0 !important');
    expect(cssSource).toContain('.desktop-help-center .desktop-help-hero');
    expect(cssSource).toContain('grid-template-rows: none !important');
    expect(cssSource).toContain('height: auto !important');
    expect(cssSource).toContain('.desktop-help-center.desktop-guide-center');
    expect(cssSource).toContain('grid-template-columns: minmax(0, 1fr) !important');
    expect(cssSource).toContain('white-space: nowrap !important');
    expect(cssSource).toContain('grid-auto-rows: max-content !important');
  });

  it('keeps visible type readable and uses standard weights', () => {
    const sizes: number[] = [];
    const weights: number[] = [];
    stylesheet.walkDecls((declaration: Declaration) => {
      const value = declaration.value.replace(/\s*!important\s*$/, '').trim();
      if (declaration.prop === 'font-size' && /^\d+(?:\.\d+)?px$/.test(value)) {
        sizes.push(Number.parseFloat(value));
      }
      if (declaration.prop === 'font-weight' && /^\d+$/.test(value)) {
        weights.push(Number(value));
      }
    });
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11);
    expect(weights.length).toBeGreaterThan(0);
    expect(weights.every((weight) => [400, 500, 600].includes(weight))).toBe(true);
  });
});
