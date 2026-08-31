import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');
const flagshipSource = readFileSync(resolve(projectRoot, 'app/desktop-flagship.css'), 'utf8');
const stylesheet = postcss.parse(flagshipSource, { from: 'app/desktop-flagship.css' });

function sourceFor(route: string) {
  return readFileSync(resolve(projectRoot, 'app', route, 'page.tsx'), 'utf8');
}

function exactDeclarations(selector: string, baseOnly = false) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (baseOnly && rule.parent?.type !== 'root') return;
    if (!rule.selectors.includes(selector)) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

describe('desktop route heading and reading-surface consistency', () => {
  it.each([
    ['about', 1],
    ['community', 1],
    ['deadlines', 1],
    ['privacy', 1],
    ['terms', 1],
    ['disclaimer', 1],
    ['publish', 3]
  ])('gives every rendered %s branch one PageSectionTitle h1', (route, expectedCount) => {
    const source = sourceFor(route);
    expect(source.match(/<PageSectionTitle\b/g) ?? []).toHaveLength(expectedCount);
    expect(source.match(/level="h1"/g) ?? []).toHaveLength(expectedCount);
    expect(source).not.toMatch(/<h1\b/);
  });

  it('uses one route inset instead of nesting a second padded desktop page', () => {
    const route = exactDeclarations(
      '.desktop-app-shell .desktop-route-content:not(.desktop-qq-workbench)',
      true
    );
    const secondary = exactDeclarations('.desktop-app-shell .desktop-secondary-page', true);

    expect(route.get('padding')).toBe('18px 20px 28px');
    expect(route.get('overflow')).toBe('auto');
    expect(secondary.get('padding')).toBe('0');
    expect(secondary.get('font-size')).toBe('14px');
  });

  it('keeps the shared title ramp readable and identical across routes', () => {
    const title = exactDeclarations('.desktop-app-shell .page-section-title-heading');
    const subtitle = exactDeclarations('.desktop-app-shell .page-section-title-subtitle');
    const section = exactDeclarations('.desktop-app-shell .desktop-secondary-page h2');
    const body = exactDeclarations('.desktop-app-shell .desktop-secondary-page p');

    expect(title.get('font-size')).toBe('24px');
    expect(title.get('font-weight')).toBe('700');
    expect(title.get('line-height')).toBe('32px');
    expect(subtitle.get('font-size')).toBe('14px');
    expect(subtitle.get('line-height')).toBe('22px');
    expect(section.get('font-size')).toBe('18px');
    expect(body.get('font-size')).toBe('14px');
  });
});
