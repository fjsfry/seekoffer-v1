import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const cssPath = resolve(root, 'app/desktop-app-coherence.css');
const cssSource = readFileSync(cssPath, 'utf8');
const scheduleSource = readFileSync(resolve(root, 'components/desktop-schedule-workspace.tsx'), 'utf8');
const contactsSource = readFileSync(resolve(root, 'components/desktop-contacts-workspace.tsx'), 'utf8');
const externalMarkSource = readFileSync(resolve(root, 'components/external-site-mark.tsx'), 'utf8');
const stylesheet = postcss.parse(cssSource, { from: cssPath });

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
    if (!rule.selectors.some((selector) =>
      !selector.includes(':hover') &&
      !selector.includes(':focus') &&
      fragments.every((fragment) => selector.includes(fragment)))) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

function declarationsEnding(selectorSuffix: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.some((selector) => selector.trim().endsWith(selectorSuffix))) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

function rgb(hex: string) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
}

function luminance(hex: string) {
  const channels = rgb(hex).map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(left: string, right: string) {
  const a = luminance(left);
  const b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('desktop global alignment and visual hierarchy', () => {
  it('uses one centered 1320px content spine while preserving the full workbench', () => {
    expect(cssSource).toContain('--app-route-max: 1320px');
    const route = declarationsContaining('.desktop-route-content:not(.desktop-qq-workbench)');
    expect(route.get('width')).toBe('min(100%, var(--app-route-max))');
    expect(route.get('max-width')).toBe('var(--app-route-max)');
    expect(route.get('margin-inline')).toBe('auto');
    expect(cssSource).not.toContain('.desktop-qq-workbench) {\n  width: min(100%, var(--app-route-max))');
  });

  it('centers page-header groups vertically but keeps reading content left aligned', () => {
    const embeddedCopy = declarationsContaining('.desktop-page-header--embedded', '.desktop-page-header-copy');
    const headerCopy = declarationsContaining('.desktop-page-header-copy');
    const headerActions = declarationsContaining('.desktop-page-header-actions');
    expect(embeddedCopy.get('align-self')).toBe('center');
    expect(headerCopy.get('align-self')).toBe('center');
    expect(headerActions.get('align-self')).toBe('center');

    const rootCenteringViolations: string[] = [];
    stylesheet.walkRules((rule: Rule) => {
      if (!rule.selectors.includes('.desktop-app-shell:is(.desktop-app-shell)')) return;
      rule.walkDecls('text-align', (declaration: Declaration) => {
        if (declaration.value === 'center') rootCenteringViolations.push(rule.selector);
      });
    });
    expect(rootCenteringViolations).toEqual([]);
  });

  it('centers controls and badges locally without centering toolbars or card copy', () => {
    const primary = declarationsContaining('.desktop-page-primary-action');
    const badge = declarationsContaining('.desktop-page-header-count');
    const noticeAction = declarationsContaining('.desktop-notice-card-buttons', 'button');
    expect(primary.get('align-items')).toBe('center');
    expect(primary.get('justify-content')).toBe('center');
    expect(badge.get('align-items')).toBe('center');
    expect(badge.get('justify-content')).toBe('center');
    expect(noticeAction.get('align-items')).toBe('center');
    expect(noticeAction.get('justify-content')).toBe('center');
    expect(declarationsEnding('.desktop-page-header').get('justify-content')).not.toBe('center');
    expect(declarationsEnding('.desktop-notice-filters').get('justify-content')).not.toBe('center');
    expect(declarationsEnding('.desktop-resource-toolbar').get('justify-content')).not.toBe('center');
    expect(declarationsEnding('.desktop-college-page-toolbar').get('justify-content')).not.toBe('center');
    expect(declarationsEnding('.desktop-help-search-toolbar').get('justify-content')).not.toBe('center');
  });

  it('fills fixed work pages and centers empty states only inside their own panes', () => {
    expect(scheduleSource).toContain('desktop-schedule-list');
    expect(scheduleSource).toContain('desktop-schedule-empty');
    expect(contactsSource).toContain('desktop-contacts-list');
    expect(contactsSource).toContain('desktop-contacts-empty');

    const fixedParent = declarationsContaining('.desktop-route-content:has(> .desktop-core-page--fixed');
    const scheduleList = declarationsContaining('.desktop-schedule-list:has(> .desktop-schedule-empty)');
    const contactsList = declarationsContaining('.desktop-contacts-list:has(> .desktop-contacts-empty)');
    const projectList = declarationsContaining('.desktop-project-table-body:has(> .desktop-project-empty)');
    const inspector = declarationsContaining('.desktop-project-workspace:has(> .desktop-inspector-empty)');
    expect(fixedParent.get('grid-template-rows')).toBe('minmax(0, 1fr)');
    expect(scheduleList.get('grid-template-rows')).toBe('minmax(0, 1fr)');
    expect(contactsList.get('display')).toBe('grid');
    expect(contactsList.get('grid-template-rows')).toBe('minmax(0, 1fr)');
    expect(projectList.get('grid-template-columns')).toBe('minmax(0, 1fr)');
    expect(projectList.get('grid-template-rows')).toBe('minmax(0, 1fr)');
    expect(inspector.get('grid-template-columns')).toBe('minmax(0, 1fr)');
    expect(inspector.get('grid-template-rows')).toBe('minmax(0, 1fr)');
  });

  it('centers settings in its content pane and vertically balances the support drawer', () => {
    const settings = declarationsContaining('.desktop-settings-section');
    const support = declarationsContaining('.desktop-guide-support-overlay');
    expect(settings.get('width')).toBe('min(100%, 820px)');
    expect(settings.get('margin-inline')).toBe('auto');
    expect(support.get('align-items')).toBe('center');
    expect(support.get('justify-content')).not.toBe('center');
  });

  it('uses flat static surfaces, quiet hover feedback and overlay-only depth', () => {
    const header = declarationsContaining('.desktop-page-header');
    const toolbar = declarationsContaining('.desktop-resource-toolbar');
    const card = baseDeclarationsContaining('.desktop-notice-card');
    const hoveredCard = declarationsContaining('.desktop-notice-card', ':hover');
    const primary = declarationsContaining('.desktop-page-primary-action');
    const stage = declarationsContaining('.desktop-view-stage');
    expect(header.get('box-shadow')).toBe('none');
    expect(toolbar.get('box-shadow')).toBe('none');
    expect(card.get('box-shadow')).toBe('none');
    expect(hoveredCard.get('box-shadow')).toBe('none');
    expect(primary.get('box-shadow')).toBe('none');
    expect(stage.get('border-color')).toBe('transparent');
    expect(stage.get('box-shadow')).toBe('none');
    expect(cssSource).toMatch(
      /data-desktop-theme='dark'[\s\S]*?\.desktop-view-stage\s*\{[^}]*border-color:\s*transparent !important[^}]*box-shadow:\s*none !important/
    );
    expect(cssSource).toMatch(
      /html\.seekoffer-desktop-surface\s+:is\([\s\S]*?\.desktop-global-dialog-panel[\s\S]*?\)\s*\{[^}]*box-shadow:\s*var\(--so-shadow-dialog\) !important/
    );
  });

  it('keeps small helper text readable in light and dark themes', () => {
    expect(cssSource).toContain('--so-text-secondary: #646a73');
    expect(cssSource).toContain('--so-text-secondary: #c5c9d0 !important');
    expect(contrast('#646a73', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#c5c9d0', '#202329')).toBeGreaterThanOrEqual(4.5);
    expect(cssSource).toContain('--so-surface-stage: #1c1f24 !important');
  });

  it('keeps official marks on a neutral image tile in dark mode', () => {
    expect(externalMarkSource).toContain('className={`external-site-mark relative flex');
    expect(externalMarkSource).toContain("data-mark-kind={shouldUseImage ? 'image' : 'badge'}");
    const imageMark = declarationsContaining(".external-site-mark[data-mark-kind='image']");
    expect(imageMark.get('background')).toBe('#ffffff');
    expect(imageMark.get('box-shadow')).toBe('none');
  });
});
