import fs from 'node:fs';
import path from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const workspaceRoot = process.cwd();
const readSource = (...segments: string[]) =>
  fs.readFileSync(path.join(workspaceRoot, ...segments), 'utf8');

const offersSource = readSource('app', 'offers', 'page.tsx');
const publishSource = readSource('app', 'publish', 'page.tsx');
const communitySource = readSource('app', 'community', 'page.tsx');
const gpaSource = readSource('app', 'gpa', 'gpa-tool-client.tsx');
const flagshipPath = path.join(workspaceRoot, 'app', 'desktop-flagship.css');
const flagshipSource = fs.readFileSync(flagshipPath, 'utf8');
const stylesheet = postcss.parse(flagshipSource, { from: flagshipPath });

function collectDeclarations(rule: Rule, values: Map<string, string>) {
  rule.walkDecls((declaration: Declaration) => {
    values.set(declaration.prop, declaration.value);
  });
}

function baseDeclarations(fragment: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (rule.parent?.type !== 'root') return;
    if (
      !rule.selectors.some(
        (selector) =>
          selector.trim().endsWith(fragment) && !selector.includes('data-zoom-level')
      )
    ) {
      return;
    }
    collectDeclarations(rule, values);
  });
  return values;
}

function baseDeclarationsContaining(fragment: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (rule.parent?.type !== 'root') return;
    if (
      !rule.selectors.some(
        (selector) => selector.includes(fragment) && !selector.includes('data-zoom-level')
      )
    ) {
      return;
    }
    collectDeclarations(rule, values);
  });
  return values;
}

function highZoomDeclarations(fragment: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (
      !rule.selectors.some(
        (selector) =>
          selector.includes(fragment) &&
          /data-zoom-level='(?:150|175|200)'/.test(selector)
      )
    ) {
      return;
    }
    collectDeclarations(rule, values);
  });
  return values;
}

describe('desktop community and tools flagship contract', () => {
  it('exposes stable semantic hooks without changing the data workflow', () => {
    for (const className of [
      'desktop-offers-header',
      'desktop-offers-toolbar',
      'desktop-offers-feed-list',
      'desktop-offers-feed-row',
      'desktop-offers-loading-row',
      'desktop-offer-dialog-panel',
      'desktop-discussion-form'
    ]) {
      expect(offersSource).toContain(className);
    }

    for (const className of [
      'desktop-publish-header',
      'desktop-publish-layout',
      'desktop-publish-form',
      'desktop-publish-field-grid',
      'desktop-publish-aside'
    ]) {
      expect(publishSource).toContain(className);
    }

    expect(communitySource).toContain('desktop-community-reading');
    expect(communitySource).toContain('desktop-community-rules');

    for (const className of [
      'desktop-gpa-header',
      'desktop-gpa-summary',
      'desktop-gpa-tabs',
      'desktop-gpa-panel',
      'desktop-gpa-table-scroll',
      'desktop-gpa-material-row',
      'desktop-gpa-backup-pane'
    ]) {
      expect(gpaSource).toContain(className);
    }
  });

  it('renders Offer 圈 as a compact feed with static structured loading', () => {
    const layout = baseDeclarations('.desktop-offers-layout');
    const row = baseDeclarations('.desktop-offers-feed-row');
    const loadingRow = baseDeclarations('.desktop-offers-loading-row');
    const dialog = baseDeclarationsContaining('.desktop-offer-dialog-panel');

    expect(layout.get('grid-template-columns')).toBe('minmax(0, 1fr) 276px');
    expect(layout.get('gap')).toBe('0');
    expect(row.get('border-radius')).toBe('0');
    expect(row.get('box-shadow')).toBe('none');
    expect(row.get('transform')).toBe('none');
    expect(loadingRow.get('min-height')).toBe('92px');
    expect(dialog.get('border-radius')).toBe('var(--so-radius-popup)');
    expect(offersSource).not.toContain('animate-pulse');
  });

  it('uses a single primary publish form and a measured community reading column', () => {
    const publishLayout = baseDeclarations('.desktop-publish-layout');
    const publishFields = baseDeclarations('.desktop-publish-field-grid');
    const publishInput = baseDeclarations('.desktop-publish-field > :is(input, select)');
    const communityReading = baseDeclarations('.desktop-community-reading');

    expect(publishLayout.get('grid-template-columns')).toBe('minmax(0, 1fr) 300px');
    expect(publishFields.get('grid-template-columns')).toBe('minmax(0, 1fr)');
    expect(publishInput.get('height')).toBe('40px');
    expect(communityReading.get('width')).toBe('min(100%, 900px)');
    expect(communityReading.get('box-shadow')).toBe('none');
  });

  it('keeps portaled Offer dialogs inside the desktop surface and corrected zoom viewport', () => {
    const dialogRoot = baseDeclarations('.desktop-offer-dialog');
    const dialogPanel = baseDeclarationsContaining(
      ':is(.desktop-offer-dialog-panel, .desktop-discussion-dialog-panel)'
    );
    const unsafePortalSelectors: string[] = [];

    stylesheet.walkRules((rule: Rule) => {
      for (const selector of rule.selectors) {
        if (!/desktop-(?:offer|discussion)-dialog/.test(selector)) continue;
        if (!selector.includes('.seekoffer-desktop-surface')) unsafePortalSelectors.push(selector);
      }
    });

    expect(unsafePortalSelectors).toEqual([]);
    expect(dialogRoot.get('width')).toBe('var(--desktop-zoomed-viewport-width, 100%)');
    expect(dialogRoot.get('height')).toBe('var(--desktop-zoomed-viewport-height, 100%)');
    expect(dialogPanel.get('width')).toContain('--desktop-zoomed-viewport-width');
    expect(dialogPanel.get('max-height')).toContain('--desktop-zoomed-viewport-height');
    expect(dialogPanel.get('border-radius')).toBe('var(--so-radius-popup)');
  });

  it('flattens GPA hero, tabs, summaries, forms and tables', () => {
    const title = baseDeclarations('.desktop-gpa-title');
    const tabs = baseDeclarations('.desktop-gpa-tabs');
    const tab = baseDeclarations('.desktop-gpa-tab');
    const summary = baseDeclarations('.desktop-gpa-summary');
    const metric = baseDeclarations('.desktop-gpa-metric');
    const panel = baseDeclarations('.desktop-gpa-panel');
    const tableScroll = baseDeclarations('.desktop-gpa-table-scroll');
    const field = baseDeclarations('.desktop-gpa-field :is(input, select)');

    expect(title.get('font-size')).toBe('24px');
    expect(tabs.get('border-radius')).toBe('0');
    expect(tab.get('border-radius')).toBe('0');
    expect(summary.get('gap')).toBe('0');
    expect(metric.get('border-radius')).toBe('0');
    expect(metric.get('box-shadow')).toBe('none');
    expect(panel.get('border-radius')).toBe('var(--so-radius-card)');
    expect(tableScroll.get('max-width')).toBe('100%');
    expect(tableScroll.get('overflow')).toBe('auto');
    expect(field.get('height')).toBe('40px');
  });

  it('collapses every dense desktop column at 150 to 200 percent zoom', () => {
    expect(highZoomDeclarations('.desktop-offers-layout').get('grid-template-columns')).toBe(
      'minmax(0, 1fr)'
    );
    expect(highZoomDeclarations('.desktop-publish-layout').get('grid-template-columns')).toBe(
      'minmax(0, 1fr)'
    );
    expect(highZoomDeclarations('.desktop-gpa-courses-pane').get('grid-template-columns')).toBe(
      'minmax(0, 1fr)'
    );
    expect(highZoomDeclarations('.desktop-gpa-material-row').get('grid-template-columns')).toBe(
      'minmax(0, 1fr)'
    );
  });

  it('rejects visual shortcuts that make the desktop UI feel generated', () => {
    expect(flagshipSource).not.toMatch(/\[class\*=/);
    expect(flagshipSource).not.toMatch(/font-weight:\s*(?:550|650|720|750)\b/);
    expect(flagshipSource).not.toMatch(/font-size:\s*11px\b/);
    expect(flagshipSource).not.toMatch(/(?:linear|radial|conic)-gradient\s*\(/);
    expect(flagshipSource).not.toMatch(/transition(?:-property)?:\s*all\b/);
  });
});
