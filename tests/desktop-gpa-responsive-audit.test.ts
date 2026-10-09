import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const css = postcss.parse(readFileSync(resolve(process.cwd(), 'app/desktop-directory-audit.css'), 'utf8'));
function declarations(fragment: string) {
  const result = new Map<string, string>();
  css.walkRules(rule => {
    if (rule.parent?.type !== 'root' || !rule.selector.includes(fragment)) return;
    rule.walkDecls(declaration => { result.set(declaration.prop, declaration.value); });
  });
  return result;
}

describe('GPA desktop responsive flow', () => {
  it('lets the GPA route scroll naturally instead of squeezing three auto grid rows', () => {
    const route = declarations('.desktop-route-content:has(> .desktop-gpa-workspace)');
    expect(route.get('display')).toBe('block');
    expect(route.get('overflow-y')).toBe('auto');
    const sections = declarations('> :is(.desktop-gpa-header, .desktop-gpa-summary, .desktop-gpa-workspace)');
    expect(sections.get('height')).toBe('auto');
    expect(sections.get('max-height')).toBe('none');
    expect(sections.get('overflow')).toBe('visible');
  });

  it('uses a complete tab grid and wraps to three columns when space is constrained', () => {
    const tabs = declarations('.desktop-gpa-workspace .desktop-gpa-tabs');
    expect(tabs.get('display')).toBe('grid');
    expect(tabs.get('position')).toBe('static');
    expect(tabs.get('grid-template-columns')).toBe('repeat(5, minmax(0, 1fr))');
    const narrow: string[] = [];
    css.walkAtRules('container', rule => {
      if (rule.params !== 'desktop-gpa-audit (max-width: 500px)') return;
      rule.walkDecls('grid-template-columns', declaration => { narrow.push(declaration.value); });
    });
    expect(narrow).toContain('repeat(3, minmax(0, 1fr))');
  });
});

describe('deadline desktop responsive flow', () => {
  it('keeps the header, wrapping filters and urgency groups in natural scrolling flow', () => {
    expect(declarations('.desktop-route-content:has(> .desktop-deadlines-page)').get('display')).toBe('block');
    const page = declarations('.desktop-route-content > .desktop-deadlines-page');
    expect(page.get('height')).toBe('auto');
    expect(page.get('grid-auto-rows')).toBe('max-content');
    const sections = declarations('> :is(.page-section-title, .desktop-deadlines-toolbar, .desktop-deadline-groups)');
    expect(sections.get('height')).toBe('auto');
    expect(sections.get('overflow')).toBe('visible');
    const grids = declarations(':is(.desktop-deadlines-toolbar, .desktop-deadline-groups)');
    expect(grids.get('grid-auto-rows')).toBe('max-content');
  });
});
