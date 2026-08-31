import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');
const cssPath = resolve(projectRoot, 'app/desktop-flagship.css');
const cssSource = readFileSync(cssPath, 'utf8');
const stylesheet = postcss.parse(cssSource, { from: cssPath });

function declarationsFor(fragment: string, mode: 'endsWith' | 'contains' = 'endsWith') {
  const values = new Map<string, string>();

  stylesheet.walkRules((rule: Rule) => {
    if (rule.parent?.type !== 'root') return;
    if (
      !rule.selectors.some((selector) => {
        if (selector.includes('data-zoom-level')) return false;
        const normalized = selector.trim();
        return mode === 'endsWith'
          ? normalized.endsWith(fragment)
          : normalized.includes(fragment);
      })
    ) {
      return;
    }

    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });

  return values;
}

function declarationsForSelectorParts(...parts: string[]) {
  const values = new Map<string, string>();

  stylesheet.walkRules((rule: Rule) => {
    if (rule.parent?.type !== 'root') return;
    if (
      !rule.selectors.some(
        (selector) =>
          !selector.includes('data-zoom-level') &&
          parts.every((part) => selector.includes(part))
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

describe('desktop Image2 secondary-page design system', () => {
  it('uses one measured continuous document pane and the shared type ladder', () => {
    const measuredPage = declarationsFor('.desktop-secondary-page:is(', 'contains');
    const sectionTitle = declarationsForSelectorParts('.desktop-secondary-page:is(', ') h2');
    const body = declarationsForSelectorParts('.desktop-secondary-page:is(', ') p');
    const legal = declarationsFor('.desktop-legal-page');

    expect(measuredPage.get('width')).toBe('min(100%, 920px)');
    expect(measuredPage.get('gap')).toBe('0');
    expect(measuredPage.get('border')).toBe('1px solid var(--so-border)');
    expect(measuredPage.get('border-radius')).toBe('var(--so-radius-card)');
    expect(measuredPage.get('box-shadow')).toBe('none');
    expect(sectionTitle.get('font-size')).toBe('17px');
    expect(sectionTitle.get('line-height')).toBe('26px');
    expect(body.get('font-size')).toBe('14px');
    expect(body.get('line-height')).toBe('22px');
    expect(legal.get('width')).toBe('min(100%, 880px)');
  });

  it('turns knowledge and consulting remnants into continuous rows', () => {
    const knowledgeRows = declarationsFor(
      '.desktop-knowledge-page .desktop-reading-section > .mt-7'
    );
    const consultingRows = declarationsFor(
      '.desktop-consulting-page .desktop-reading-section > .mt-7'
    );
    const consultingGroup = declarationsFor('.desktop-consulting-page > section.grid');
    const consultingItem = declarationsFor(
      '.desktop-consulting-page .desktop-reading-section > .mt-7 > article'
    );

    for (const group of [knowledgeRows, consultingRows, consultingGroup]) {
      expect(group.get('grid-template-columns')).toBe('minmax(0, 1fr)');
      expect(group.get('gap')).toBe('0');
      expect(group.get('border-top')).toBe('1px solid var(--so-border)');
    }
    expect(consultingItem.get('border-radius')).toBe('0');
    expect(consultingItem.get('box-shadow')).toBe('none');
    expect(consultingItem.get('transform')).toBe('none');
  });

  it('joins the community title and rules into one reading surface', () => {
    const header = declarationsFor(
      '.desktop-community-header .page-section-title'
    );
    const reading = declarationsFor('.desktop-community-reading');
    const paragraph = declarationsFor('.desktop-community-rules > p');

    expect(reading.get('width')).toBe('min(100%, 900px)');
    expect(reading.get('margin-top')).toBe('0');
    expect(header.get('border-bottom')).toBe('0');
    expect(header.get('border-radius')).toBe(
      'var(--so-radius-card) var(--so-radius-card) 0 0'
    );
    expect(reading.get('border-radius')).toBe(
      '0 0 var(--so-radius-card) var(--so-radius-card)'
    );
    expect(paragraph.get('font-size')).toBe('14px');
    expect(paragraph.get('line-height')).toBe('22px');
  });

  it('keeps forms and tool panes readable at Windows control scale', () => {
    const publishLabel = declarationsFor('.desktop-publish-field');
    const publishControl = declarationsFor(
      '.desktop-publish-field > :is(input, select)'
    );
    const publishStatus = declarationsFor('.desktop-publish-status');
    const gpaTitle = declarationsFor('.desktop-gpa-section-title h2');
    const gpaDescription = declarationsFor('.desktop-gpa-section-title p');
    const gpaControl = declarationsFor('.desktop-gpa-field :is(input, select)');

    expect(publishLabel.get('font-size')).toBe('13px');
    expect(publishLabel.get('line-height')).toBe('20px');
    expect(publishControl.get('height')).toBe('40px');
    expect(publishStatus.get('font-size')).toBe('13px');
    expect(publishStatus.get('line-height')).toBe('20px');
    expect(gpaTitle.get('font-size')).toBe('17px');
    expect(gpaTitle.get('line-height')).toBe('26px');
    expect(gpaDescription.get('font-size')).toBe('13px');
    expect(gpaDescription.get('line-height')).toBe('20px');
    expect(gpaControl.get('height')).toBe('40px');
  });

  it('uses semantic solid state surfaces and a quiet native dialog scrim', () => {
    const inlineState = declarationsFor('.desktop-inline-state');
    const sectionState = declarationsFor('.desktop-section-state');
    const routeState = declarationsFor(
      ':is(.desktop-route-loading, .desktop-route-empty)'
    );
    const dialog = declarationsFor(
      ':is(.desktop-offer-dialog, .desktop-discussion-dialog)'
    );
    const dialogPanel = declarationsFor(
      ':is(.desktop-offer-dialog-panel, .desktop-discussion-dialog-panel)'
    );

    expect(inlineState.get('min-height')).toBe('var(--desktop-control-height)');
    expect(inlineState.get('border-style')).toBe('solid');
    expect(inlineState.get('font-size')).toBe('13px');
    expect(sectionState.get('border')).toBe('1px solid var(--so-border)');
    expect(sectionState.get('border')).not.toContain('dashed');
    expect(sectionState.get('box-shadow')).toBe('none');
    expect(routeState.get('border')).toBe('1px solid var(--so-border)');
    expect(routeState.get('border')).not.toContain('dashed');
    expect(dialog.get('background')).toBe('rgba(18, 32, 38, 0.36)');
    expect(dialog.get('backdrop-filter')).toBe('none');
    expect(dialogPanel.get('scrollbar-gutter')).toBe('stable');
  });

  it('adds shared state hooks without changing page workflows', () => {
    expect(readFileSync(resolve(projectRoot, 'app/offers/page.tsx'), 'utf8')).toContain(
      'desktop-offers-state desktop-section-state'
    );
    expect(readFileSync(resolve(projectRoot, 'app/publish/page.tsx'), 'utf8')).toContain(
      'desktop-publish-status desktop-inline-state'
    );
    expect(
      readFileSync(resolve(projectRoot, 'app/gpa/gpa-tool-client.tsx'), 'utf8')
    ).toContain('desktop-gpa-message desktop-inline-state');
  });
});
