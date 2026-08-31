import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');
const componentSource = readFileSync(resolve(projectRoot, 'components/desktop-state-surface.tsx'), 'utf8');
const cssPath = resolve(projectRoot, 'components/desktop-state-surface.module.css');
const cssSource = readFileSync(cssPath, 'utf8');
const stylesheet = postcss.parse(cssSource, { from: cssPath });

function declarations(selector: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.includes(selector)) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

describe('shared desktop state surface', () => {
  it('owns loading, empty, stale and error semantics without duplicating route-specific DOM', () => {
    expect(componentSource).toContain("variant = 'section'");
    expect(componentSource).toContain("tone = 'neutral'");
    expect(componentSource).toContain("const resolvedRole = role ?? (tone === 'error' ? 'alert' : 'status')");
    expect(componentSource).toContain('aria-busy={ariaBusy ?? loading}');
    expect(componentSource).toContain('aria-live={resolvedAriaLive}');
    expect(componentSource).toContain('styles.action');
  });

  it('uses one solid 14/13 hierarchy and reserves dashed borders for no state', () => {
    const surface = declarations('.surface');
    const title = declarations('.title');
    const detail = declarations('.detail');
    const action = declarations('.action :where(button, a)');

    expect(surface.get('border')).toContain('1px solid');
    expect(cssSource).not.toContain('dashed');
    expect(cssSource).not.toMatch(/(?:linear|radial|conic)-gradient/);
    expect(title.get('font-size')).toBe('14px');
    expect(title.get('font-weight')).toBe('600');
    expect(detail.get('font-size')).toBe('13px');
    expect(detail.get('line-height')).toBe('20px');
    expect(action.get('min-height')).toBe('40px');
  });

  it('keeps full, section and inline variants stable and disables spin for reduced motion', () => {
    expect(declarations('.full').get('min-height')).toBe('240px');
    expect(declarations('.section').get('min-height')).toBe('156px');
    expect(declarations('.inline').get('grid-template-columns')).toBe('30px minmax(0, 1fr) auto');

    const reducedMotionRules: string[] = [];
    stylesheet.walkAtRules('media', (rule) => {
      if (rule.params.includes('prefers-reduced-motion')) reducedMotionRules.push(rule.toString());
    });
    expect(reducedMotionRules.join('\n')).toContain('animation: none');
  });
});
