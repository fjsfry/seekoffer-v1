import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type AtRule, type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');
const noticeSource = readFileSync(resolve(projectRoot, 'app/notices/page.tsx'), 'utf8').replace(/\r\n/g, '\n');
const layoutSource = readFileSync(resolve(projectRoot, 'app/build-surface.desktop.tsx'), 'utf8').replace(/\r\n/g, '\n');
const finalCssPath = resolve(projectRoot, 'app/desktop-notice-alignment.css');
const finalCssSource = readFileSync(finalCssPath, 'utf8').replace(/\r\n/g, '\n');
const stylesheet = postcss.parse(finalCssSource, { from: finalCssPath });

function hasResponsiveAncestor(node: Rule | AtRule): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (parent.type === 'atrule' && ['media', 'container'].includes(parent.name)) return true;
  if (parent.type === 'rule' || parent.type === 'atrule') return hasResponsiveAncestor(parent);
  return false;
}

function declarationsForBaseSelector(fragment: string) {
  const declarations = new Map<string, string>();

  stylesheet.walkRules((rule: Rule) => {
    if (hasResponsiveAncestor(rule)) return;
    const matchingSelectors = rule.selectors.filter(
      (selector) =>
        selector.trim().endsWith(fragment) &&
        !selector.includes('data-zoom-level') &&
        !selector.includes("data-density='compact'") &&
        !selector.includes("data-density='comfortable'") &&
        !/:hover|:focus|:active/.test(selector),
    );
    if (!matchingSelectors.length) return;

    rule.nodes.forEach((node) => {
      if (node.type === 'decl') {
        const declaration = node as Declaration;
        declarations.set(declaration.prop, declaration.value);
      }
    });
  });

  return declarations;
}

function responsiveSection(params: RegExp) {
  const sections: string[] = [];
  stylesheet.walkAtRules((atRule: AtRule) => {
    if (atRule.name === 'media' && params.test(atRule.params)) {
      sections.push(atRule.toString());
    }
  });
  expect(sections.length, `missing media query matching ${params}`).toBeGreaterThan(0);
  return sections.join('\n');
}

function horizontalPaddingIs20(declarations: Map<string, string>) {
  if (declarations.get('padding-inline') === '20px') return true;
  if (declarations.get('padding-left') === '20px' && declarations.get('padding-right') === '20px') {
    return true;
  }

  const shorthand = declarations.get('padding')?.trim().split(/\s+/) ?? [];
  return (
    shorthand[0] === '20px' &&
    (shorthand.length === 1 || shorthand[1] === '20px' || shorthand[3] === '20px')
  );
}

function normalizeGridAreas(value: string | undefined) {
  return value?.replace(/["']/g, '').split(/\s+/).filter(Boolean).join(' ') ?? '';
}

describe('desktop notice-library alignment contract', () => {
  it('loads the notice authority after the legacy flagship skin', () => {
    const flagshipImport = layoutSource.indexOf("import './desktop-flagship.css'");
    const alignmentImport = layoutSource.indexOf("import './desktop-notice-alignment.css'");

    expect(flagshipImport).toBeGreaterThanOrEqual(0);
    expect(alignmentImport).toBeGreaterThan(flagshipImport);
  });

  it('places the desktop results toolbar across the result grid while preserving the website nesting', () => {
    const resultStart = noticeSource.indexOf('<section\n        className="desktop-notice-results');
    const resultEnd = noticeSource.indexOf('</section>', resultStart);
    const resultsSource = noticeSource.slice(resultStart, resultEnd);

    expect(resultStart).toBeGreaterThanOrEqual(0);
    expect(resultEnd).toBeGreaterThan(resultStart);
    expect(resultsSource).toMatch(
      /\{isDesktopSurface \? noticeResultsToolbar : null\}\s*<div className="desktop-notice-main-column/,
    );
    expect(resultsSource).toMatch(
      /<div className="desktop-notice-main-column[^>]*>\s*\{!isDesktopSurface \? noticeResultsToolbar : null\}/,
    );

    expect(
      normalizeGridAreas(
        declarationsForBaseSelector('.desktop-notice-results').get('grid-template-areas'),
      ),
    ).toBe('toolbar toolbar main sidebar');
    expect(declarationsForBaseSelector('.desktop-notice-toolbar').get('grid-area')).toBe('toolbar');
    expect(declarationsForBaseSelector('.desktop-notice-main-column').get('grid-area')).toBe('main');
    expect(declarationsForBaseSelector('.desktop-notice-sidebar').get('grid-area')).toBe('sidebar');
  });

  it('uses one 20px horizontal rhythm from route header through results and support cards', () => {
    for (const selector of [
      '.desktop-notice-hero',
      '.desktop-notice-filters',
      '.desktop-notice-toolbar',
      '.desktop-notice-card',
      '.desktop-notice-sidecard',
    ]) {
      const declarations = declarationsForBaseSelector(selector);
      expect(
        horizontalPaddingIs20(declarations),
        `${selector} must resolve to 20px horizontal padding`,
      ).toBe(true);
    }
  });

  it('aligns every notice card to stable logo, copy, deadline and two-action tracks', () => {
    const card = declarationsForBaseSelector('.desktop-notice-card');
    const layout = declarationsForBaseSelector('.desktop-notice-card-layout');
    const logo = declarationsForBaseSelector('.desktop-notice-card-layout > :first-child');
    const copy = declarationsForBaseSelector('.desktop-notice-card-copy');
    const actions = declarationsForBaseSelector('.desktop-notice-card-actions');
    const buttons = declarationsForBaseSelector('.desktop-notice-card-actions > .desktop-notice-card-buttons');
    const deadline = declarationsForBaseSelector('.desktop-notice-card-deadline');

    expect(card.get('min-height')).toBe('0');
    expect(layout.get('height')).toBe('auto');
    expect(layout.get('grid-template-columns')).toBe('88px minmax(0, 1fr) 190px');
    expect(layout.get('grid-template-rows')).toBe('auto');
    expect(layout.get('align-items')).toBe('start');

    expect(logo.get('width')).toBe('88px');
    expect(logo.get('height')).toBe('88px');
    expect(logo.get('align-self')).toBe('start');
    expect(logo.get('margin-block-start')).toBe('0');

    expect(copy.get('display')).toBe('grid');
    expect(copy.get('grid-template-rows')).toBe('auto auto auto auto');
    expect(copy.get('align-content')).toBe('start');
    expect(copy.get('overflow')).toBe('visible');

    expect(actions.get('width')).toBe('190px');
    expect(actions.get('display')).toBe('grid');
    expect(actions.get('height')).toBe('auto');
    expect(actions.get('min-height')).toBe('0');
    expect(actions.get('grid-template-rows')).toBe('auto auto');
    expect(actions.get('grid-template-rows')).not.toContain('fr');
    expect(actions.get('align-self')).toBe('start');
    expect(actions.get('align-content')).toBe('start');
    expect(buttons.get('align-self')).toBe('start');
    expect(buttons.get('align-self')).not.toBe('end');
    expect(buttons.get('margin-top')).toBe('8px');
    expect(deadline.get('width')).toBe('100%');
    expect(deadline.get('justify-self')).toBe('stretch');
  });

  it('uses explicit two-column side rows so labels and values share one baseline', () => {
    for (const selector of ['.desktop-notice-deadline-row', '.desktop-notice-today-row']) {
      const declarations = declarationsForBaseSelector(selector);
      expect(declarations.get('display'), `${selector} must be a grid`).toBe('grid');
      expect(declarations.get('grid-template-columns')).toMatch(
        /^minmax\(0, 1fr\) (?:auto|max-content|\d+px)$/,
      );
      expect(declarations.get('align-items')).toMatch(/^(?:start|center)$/);
    }
  });

  it('reflows filters and support content before alignment can collapse', () => {
    const mediumDesktop = responsiveSection(/max-width:\s*1240px/);

    expect(mediumDesktop).toMatch(
      /\.desktop-notice-search-row[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    );
    expect(mediumDesktop).toMatch(
      /\.desktop-notice-search-field[\s\S]*?grid-column:\s*1\s*\/\s*-1/,
    );
    expect(normalizeGridAreas(
      mediumDesktop.match(/grid-template-areas:\s*([^;]+?)(?:\s*!important)?;/)?.[1],
    )).toBe('toolbar main sidebar');
    expect(mediumDesktop).toMatch(
      /\.desktop-notice-results[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
    expect(mediumDesktop).toMatch(
      /\.desktop-notice-sidebar[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    );
  });

  it('keeps zoom reflow explicit and stacks the support rail at 175 and 200 percent', () => {
    expect(finalCssSource).toMatch(
      /data-zoom-level='150'[\s\S]*?data-zoom-level='175'[\s\S]*?data-zoom-level='200'[\s\S]*?\.desktop-notice-results\s*\{[^}]*display:\s*block/,
    );
    expect(finalCssSource).toMatch(
      /data-zoom-level='150'[\s\S]*?data-zoom-level='175'[\s\S]*?data-zoom-level='200'[\s\S]*?\.desktop-notice-main-column\s*\{[^}]*margin-top:\s*16px[^}]*margin-bottom:\s*16px/,
    );
    expect(finalCssSource).toMatch(
      /data-zoom-level='150'[\s\S]*?data-zoom-level='175'[\s\S]*?data-zoom-level='200'[\s\S]*?\.desktop-notice-card-layout\s*\{[^}]*grid-template-columns:\s*(?:\d+px|clamp\([^)]*\))\s+minmax\(0,\s*1fr\)/,
    );
    expect(finalCssSource).toMatch(
      /data-zoom-level='150'[\s\S]*?data-zoom-level='175'[\s\S]*?data-zoom-level='200'[\s\S]*?\.desktop-notice-card-actions\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/,
    );
    expect(finalCssSource).toMatch(
      /:is\(\.desktop-app-shell\):is\(\s*\[data-zoom-level='175'\],\s*\[data-zoom-level='200'\]\s*\)\s*\.desktop-notice-sidebar\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
  });
});
