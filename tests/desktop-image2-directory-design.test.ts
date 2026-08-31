import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const cssPath = resolve(root, 'app/desktop-flagship.css');
const css = readFileSync(cssPath, 'utf8');
const stylesheet = postcss.parse(css, { from: cssPath });
const finalNoticeCssPath = resolve(root, 'app/desktop-notice-alignment.css');
const finalNoticeCss = readFileSync(finalNoticeCssPath, 'utf8');
const finalNoticeStylesheet = postcss.parse(finalNoticeCss, { from: finalNoticeCssPath });
const competitionSource = readFileSync(resolve(root, 'app/competitions/page.tsx'), 'utf8');

function declarationsCovering(fragment: string | string[], selectorSuffix = '') {
  const declarations = new Map<string, string>();
  const fragments = Array.isArray(fragment) ? fragment : [fragment];

  stylesheet.walkRules((rule: Rule) => {
    if (rule.parent?.type !== 'root') return;
    if (rule.selectors.some((selector) => selector.includes('data-zoom-level'))) return;
    if (
      !rule.selectors.some(
        (selector) =>
          fragments.some((item) => selector.includes(item)) &&
          (!selectorSuffix || selector.trim().endsWith(selectorSuffix))
      )
    ) return;
    rule.walkDecls((declaration: Declaration) => {
      declarations.set(declaration.prop, declaration.value.replace(/\s*!important\s*$/, '').trim());
    });
  });

  return declarations;
}

function declarationsForSuffix(fragment: string) {
  const declarations = new Map<string, string>();

  stylesheet.walkRules((rule: Rule) => {
    if (rule.parent?.type !== 'root') return;
    if (
      !rule.selectors.some(
        (selector) =>
          !selector.includes('data-zoom-level') &&
          !selector.includes("data-density='compact'") &&
          selector.trim().endsWith(fragment)
      )
    ) {
      return;
    }
    rule.walkDecls((declaration: Declaration) => {
      declarations.set(declaration.prop, declaration.value.replace(/\s*!important\s*$/, '').trim());
    });
  });

  return declarations;
}

function declarationsForExactSelector(selector: string) {
  const declarations = new Map<string, string>();

  stylesheet.walkRules((rule: Rule) => {
    if (rule.parent?.type !== 'root') return;
    if (!rule.selectors.includes(selector)) return;
    rule.walkDecls((declaration: Declaration) => {
      declarations.set(declaration.prop, declaration.value.replace(/\s*!important\s*$/, '').trim());
    });
  });

  return declarations;
}

function finalNoticeDeclarationsForSuffix(fragment: string) {
  const declarations = new Map<string, string>();

  finalNoticeStylesheet.walkRules((rule: Rule) => {
    if (rule.parent?.type !== 'root') return;
    if (
      !rule.selectors.some(
        (selector) =>
          !selector.includes('data-zoom-level') &&
          !selector.includes("data-density='compact'") &&
          selector.trim().endsWith(fragment)
      )
    ) {
      return;
    }
    rule.walkDecls((declaration: Declaration) => {
      declarations.set(declaration.prop, declaration.value.replace(/\s*!important\s*$/, '').trim());
    });
  });

  return declarations;
}

describe('Image2 directory workspace contract', () => {
  it('uses the same calm page-header baseline across every directory route', () => {
    const noticeHeader = declarationsForExactSelector(
      '.desktop-app-shell:is(.desktop-app-shell) .desktop-notice-hero'
    );
    const noticeAlignment = finalNoticeDeclarationsForSuffix('.desktop-notice-hero');
    expect(noticeHeader.get('min-height')).toBe('92px');
    expect(noticeHeader.get('padding')).toBe('20px 22px');
    expect(noticeAlignment.get('padding-inline')).toBe('20px');
    expect(declarationsForSuffix('.desktop-notice-hero').get('box-shadow')).toBe('none');

    for (const selector of ['.desktop-college-hero', '.desktop-resource-hero']) {
      const header = declarationsForSuffix(selector);
      const expectedHeight = selector === '.desktop-resource-hero' ? '82px' : '92px';
      const expectedPadding = selector === '.desktop-resource-hero' ? '17px 20px' : '20px 22px';
      expect(header.get('min-height'), selector).toBe(expectedHeight);
      expect(header.get('padding'), selector).toBe(expectedPadding);
      expect(header.get('border-radius'), selector).toBe('var(--desktop-radius-panel)');
      expect(header.get('background'), selector).toBe('var(--so-surface)');
      expect(header.get('box-shadow'), selector).toBe('none');
    }

    const deadlinesHeader = declarationsForSuffix('.desktop-deadlines-page > .page-section-title');
    const competitionHeader = declarationsForSuffix('.desktop-competitions-page > .desktop-secondary-header');
    for (const [name, header] of [
      ['deadlines', deadlinesHeader],
      ['competitions', competitionHeader]
    ] as const) {
      expect(header.get('min-height'), name).toBe('82px');
      expect(header.get('padding'), name).toBe('17px 20px');
      expect(header.get('border-radius'), name).toBe('var(--desktop-radius-panel)');
      expect(header.get('box-shadow'), name).toBe('none');
    }
  });

  it('keeps search and primary filter controls at the shared 40px Windows size', () => {
    for (const selector of [
      '.desktop-notice-search-field',
      '.desktop-notice-filter-toggle',
      '.desktop-notice-advanced-filters :where(input, select)',
      '.desktop-college-search',
      '.desktop-college-toolbar-actions :where(select, button)',
      '.desktop-deadlines-toolbar select',
      '.desktop-competition-search-input',
      '.desktop-competition-filter-summary',
      '.desktop-competition-reset'
    ]) {
      const control = selector.includes('.desktop-competition-')
        ? declarationsCovering(selector)
        : declarationsForSuffix(selector);
      expect(control.get('height'), selector).toBe('var(--desktop-control-height)');
      expect(control.get('min-height'), selector).toBe('var(--desktop-control-height)');
    }

    expect(competitionSource).toContain('desktop-competition-search-input');
    expect(competitionSource).toContain('desktop-competition-filter-summary');
    expect(competitionSource).toContain('desktop-competition-reset');
    expect(competitionSource).not.toContain('bg-gradient-to-br');
    expect(competitionSource).not.toContain('hover:-translate');
    expect(competitionSource).not.toContain('group-hover:translate');
  });

  it('uses a readable 16 / 14 / 12 hierarchy instead of undersized card copy', () => {
    expect(finalNoticeDeclarationsForSuffix('.desktop-notice-card-title').get('font-size')).toBe('20px');
    expect(finalNoticeDeclarationsForSuffix('.desktop-notice-card-meta').get('font-size')).toBe('14px');
    expect(finalNoticeDeclarationsForSuffix('.desktop-notice-card-tags > span').get('font-size')).toBe(
      '13px'
    );

    expect(declarationsForSuffix('.desktop-college-card-title').get('font-size')).toBe('16px');
    expect(declarationsForSuffix('.desktop-college-card-summary').get('font-size')).toBe('14px');

    expect(css).toMatch(
      /\.desktop-app-shell:is\(\.desktop-app-shell\)\s+:is\(\.desktop-resource-tool-copy,\s*\.desktop-resource-link-copy\):is\([\s\S]*?\)\s+strong\s*\{[\s\S]*?font-size:\s*15px\s*!important/
    );
    expect(css).toMatch(
      /\.desktop-app-shell:is\(\.desktop-app-shell\)\s+\.desktop-resource-link-copy:is\(\.desktop-resource-link-copy\)\s*>\s*span:last-child\s*\{[\s\S]*?font-size:\s*14px\s*!important/
    );

    expect(declarationsForSuffix('.desktop-deadline-group-title').get('font-size')).toBe('18px');
    expect(declarationsForSuffix('.desktop-deadline-row-identity > div:first-child').get('font-size')).toBe('16px');
    expect(css).toMatch(
      /\.desktop-app-shell:is\(\.desktop-app-shell\)\s+\.desktop-competition-card\s+h3\s*\{[\s\S]*?font-size:\s*16px\s*!important/
    );
    expect(css).toMatch(
      /\.desktop-app-shell:is\(\.desktop-app-shell\)\s+\.desktop-competition-card\s*>\s*div:nth-of-type\(3\)\s*\{[\s\S]*?font-size:\s*14px\s*!important/
    );
  });

  it('retains continuous motion-free lists and the 900 plus 280 notice reading workspace', () => {
    for (const selector of [
      '.desktop-college-card',
      '.desktop-resource-tool-card',
      '.desktop-deadline-row-card',
      '.desktop-competition-card'
    ]) {
      const row = declarationsForSuffix(selector);
      expect(row.get('box-shadow'), selector).toBe('none');
      expect(row.get('transform'), selector).toBe('none');
    }

    const noticeCard = finalNoticeDeclarationsForSuffix('.desktop-notice-card');
    expect(noticeCard.get('box-shadow')).toBe('0 5px 18px rgba(29, 43, 50, 0.055)');
    expect(declarationsForSuffix('.desktop-notice-card').get('transform')).toBe('none');

    const noticeDetail = declarationsForSuffix('.desktop-notice-detail-layout');
    const noticeReading = declarationsForSuffix('.desktop-notice-detail-reading');
    expect(noticeDetail.get('grid-template-columns')).toBe('minmax(0, 900px) 280px');
    expect(noticeReading.get('border-radius')).toBe('var(--desktop-radius-panel)');
    expect(noticeReading.get('box-shadow')).toBe('none');
  });
});
