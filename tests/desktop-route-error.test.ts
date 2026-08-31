import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');
const errorSource = readFileSync(resolve(projectRoot, 'app/error.tsx'), 'utf8');
const flagshipPath = resolve(projectRoot, 'app/desktop-flagship.css');
const stylesheet = postcss.parse(readFileSync(flagshipPath, 'utf8'), {
  from: flagshipPath
});

function declarationsFor(fragment: string, highZoom = false) {
  const declarations = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (
      !rule.selectors.some((selector) => {
        if (!selector.trim().endsWith(fragment)) return false;
        const responsive = /data-zoom-level='(?:150|175|200)'/.test(selector);
        return highZoom ? responsive : !responsive;
      })
    ) {
      return;
    }
    rule.walkDecls((declaration: Declaration) => {
      declarations.set(declaration.prop, declaration.value);
    });
  });
  return declarations;
}

describe('desktop route error boundary', () => {
  it('keeps the App Router error boundary inside the shell main landmark', () => {
    expect(errorSource).toContain("'use client'");
    expect(errorSource).toContain('className="desktop-route-error-page"');
    expect(errorSource).toContain('className="desktop-route-error-copy"');
    expect(errorSource).toContain('className="desktop-route-error" role="alert"');
    expect(errorSource).not.toMatch(/<main\b/);
    expect(errorSource).not.toContain('id="main-content"');
    expect(errorSource).not.toContain('className="desktop-route-content"');
  });

  it('provides a bounded icon, readable copy and reachable actions', () => {
    const page = declarationsFor('.desktop-route-error-page');
    const error = declarationsFor('.desktop-route-error');
    const icon = declarationsFor('.desktop-route-error-icon');
    const copy = declarationsFor('.desktop-route-error-copy');
    const actions = declarationsFor('.desktop-route-error-actions');
    const action = declarationsFor('.desktop-route-error-actions > button');

    expect(page.get('width')).toBe('100%');
    expect(page.get('min-width')).toBe('0');
    expect(page.get('display')).toBe('grid');
    expect(page.get('overflow')).toBe('auto');

    expect(error.get('width')).toContain('min(100%, 820px)');
    expect(error.get('display')).toBe('grid');
    expect(error.get('grid-template-columns')).toBe('44px minmax(0, 1fr) auto');
    expect(error.get('background')).toBe('var(--so-surface)');
    expect(error.get('border-radius')).toContain('var(--desktop-radius-panel)');

    expect(icon.get('width')).toBe('44px');
    expect(icon.get('height')).toBe('44px');
    expect(copy.get('min-width')).toBe('0');
    expect(copy.get('display')).toBe('grid');
    expect(actions.get('display')).toBe('flex');
    expect(actions.get('flex-wrap')).toBe('wrap');
    expect(action.get('min-height')).toBe('var(--desktop-control-height)');
  });

  it('stacks error copy and actions at 150 to 200 percent zoom', () => {
    const page = declarationsFor('.desktop-route-error-page', true);
    const error = declarationsFor('.desktop-route-error', true);
    const child = declarationsFor('.desktop-route-error > *', true);
    const actions = declarationsFor('.desktop-route-error-actions', true);
    const action = declarationsFor('.desktop-route-error-actions > button', true);

    expect(page.get('align-items')).toBe('start');
    expect(page.get('justify-items')).toBe('stretch');
    expect(error.get('width')).toBe('100%');
    expect(error.get('min-height')).toBe('0');
    expect(error.get('grid-template-columns')).toBe('minmax(0, 1fr)');
    expect(child.get('min-width')).toBe('0');
    expect(child.get('grid-column')).toBe('1');
    expect(child.get('grid-row')).toBe('auto');
    expect(actions.get('display')).toBe('grid');
    expect(actions.get('grid-template-columns')).toBe('minmax(0, 1fr)');
    expect(action.get('width')).toBe('100%');
    expect(action.get('white-space')).toBe('normal');
  });
});
