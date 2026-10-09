import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const stylesheet = postcss.parse(readFileSync(resolve(process.cwd(), 'app/desktop-app-coherence.css'), 'utf8'));
function declarations(selector: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules(rule => {
    if (rule.selector !== `.desktop-app-shell:is(.desktop-app-shell) ${selector}`) return;
    rule.walkDecls(declaration => { values.set(declaration.prop, declaration.value); });
  });
  return values;
}

describe('zoom-aware shell overlay height', () => {
  it.each(['.desktop-command-dialog', '.desktop-shortcut-dialog'])('bounds %s to the effective, zoomed viewport', selector => {
    const values = declarations(selector);
    expect(values.get('max-height')).toContain('--desktop-zoomed-viewport-height');
    expect(values.get('min-height')).toBe('0');
    expect(values.get('grid-template-rows')).toContain('minmax(0, 1fr)');
  });
  it.each(['.desktop-command-results', '.desktop-shortcut-list'])('lets %s scroll inside the constrained dialog', selector => {
    const values = declarations(selector);
    expect(values.get('min-height')).toBe('0');
    expect(values.get('overflow-y')).toBe('auto');
  });
});
