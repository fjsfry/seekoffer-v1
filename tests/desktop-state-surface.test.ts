import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');
const cssPath = resolve(projectRoot, 'app/desktop-flagship.css');
const cssSource = readFileSync(cssPath, 'utf8');
const stylesheet = postcss.parse(cssSource, { from: cssPath });

function declarations(fragment: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.some((selector) => selector.includes(fragment))) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

function stateContainerDeclarations(fragment: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.some((selector) => selector.includes(fragment))) return;
    if (rule.selectors.some((selector) => /(?:button|\ba\b|svg|h2|\bp\b|>\s*div)/.test(selector))) {
      return;
    }
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

describe('desktop asynchronous state surfaces', () => {
  it('uses one solid pane-level empty-state surface instead of decorative dashed cards', () => {
    for (const selector of [
      '.desktop-offers-state',
      '.desktop-notice-empty',
      '.desktop-college-empty',
      '.desktop-schedule-empty',
      '.desktop-contacts-empty'
    ]) {
      const state = stateContainerDeclarations(selector);
      expect(state.get('min-height'), selector).toBe('156px');
      expect(state.get('border'), selector).toContain('1px solid');
      expect(state.get('border'), selector).not.toContain('dashed');
      expect(state.get('border-radius'), selector).toBe('var(--desktop-radius-panel)');
      expect(state.get('box-shadow'), selector).toBe('none');
    }
  });

  it('uses the shared 32/14/13 hierarchy and 40px actions for rich empty states', () => {
    const icon = declarations('.desktop-offers-state > svg');
    const title = declarations('.desktop-offers-state h2');
    const detail = declarations('.desktop-offers-state p');
    const action = declarations('.desktop-offers-state');
    const noticeIcon = declarations('.desktop-notice-detail-state-icon');
    const noticeDetail = declarations('.desktop-notice-detail-state-content p');
    const noticeAction = declarations('.desktop-notice-detail-state-action');

    expect(icon.get('width')).toBe('32px');
    expect(icon.get('height')).toBe('32px');
    expect(title.get('font-size')).toBe('14px');
    expect(title.get('font-weight')).toBe('600');
    expect(title.get('line-height')).toBe('20px');
    expect(detail.get('font-size')).toBe('13px');
    expect(detail.get('line-height')).toBe('20px');
    expect(action.get('min-height')).toBe('var(--desktop-control-height)');
    expect(noticeIcon.get('width')).toBe('32px');
    expect(noticeIcon.get('height')).toBe('32px');
    expect(noticeDetail.get('font-size')).toBe('12px');
    expect(noticeDetail.get('line-height')).toBe('18px');
    expect(noticeAction.get('min-height')).toBe('var(--desktop-control-height)');
  });

  it('keeps inline GPA feedback compact and solid', () => {
    const state = declarations('.desktop-gpa-empty');
    expect(state.get('min-height')).toBe('56px');
    expect(state.get('border')).toContain('1px solid');
    expect(state.get('border')).not.toContain('dashed');
    expect(state.get('font-size')).toBe('13px');
    expect(state.get('line-height')).toBe('20px');
    expect(state.get('text-align')).toBe('left');
  });

  it('retains row-shaped static loading placeholders with no shimmer or gradient', () => {
    expect(declarations('.desktop-workbench-loading-row').get('min-height')).toBe('82px');
    expect(declarations('.desktop-notice-loading-row').get('min-height')).toBe('92px');
    expect(declarations('.desktop-offers-loading-row').get('min-height')).toBe('92px');
    const animatedPaintValues: string[] = [];
    stylesheet.walkDecls((declaration: Declaration) => {
      if (/(?:shimmer|linear-gradient|radial-gradient|conic-gradient)/i.test(declaration.value)) {
        animatedPaintValues.push(declaration.value);
      }
    });
    expect(animatedPaintValues).toEqual([]);
  });
});
