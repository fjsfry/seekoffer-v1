import fs from 'node:fs';
import path from 'node:path';
import postcss, { type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'app', 'desktop-mchose.css'), 'utf8').replace(/\r\n/g, '\n');
const stylesheet = postcss.parse(source, { from: 'app/desktop-mchose.css' });

function declarations(selector: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.includes(selector)) return;
    rule.walkDecls((declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

describe('MCHOSE-derived SeekOffer desktop visual system', () => {
  it('uses the measured MCHOSE surface and typography metrics with SeekOffer green', () => {
    const shell = declarations('.desktop-app-shell');

    expect(shell.get('--desktop-titlebar-height')).toBe('60px');
    expect(shell.get('--desktop-canvas')).toBe('#e6e7ed');
    expect(shell.get('--desktop-surface')).toBe('#ffffff');
    expect(shell.get('--desktop-surface-subtle')).toBe('#f2f3f7');
    expect(shell.get('--desktop-surface-hover')).toBe('#e5e9f0');
    expect(shell.get('--desktop-border')).toBe('#d7dee3');
    expect(shell.get('--desktop-text')).toBe('#151515');
    expect(shell.get('--desktop-accent')).toBe('#176c5b');
    expect(shell.get('font-family')).toContain('MiSans');
  });

  it('uses a QQ-style left rail beside one bounded MCHOSE work surface', () => {
    const shell = declarations('.desktop-app-shell');
    const brand = declarations('.desktop-app-shell .desktop-brand-header');
    const topbar = declarations('.desktop-app-shell .desktop-topbar');
    const rail = declarations('.desktop-app-shell .desktop-primary-rail');
    const nav = declarations('.desktop-app-shell .desktop-nav-list--primary');
    const utilities = declarations('.desktop-app-shell .desktop-rail-utilities');
    const content = declarations('.desktop-app-shell .desktop-content-region');
    const stage = declarations('.desktop-app-shell .desktop-view-stage');

    expect(shell.get('--desktop-rail-width')).toBe('76px');
    expect(shell.get('grid-template-columns')).toBe(
      'var(--desktop-rail-width) minmax(0, 1fr)'
    );
    expect(brand.get('grid-column')).toBe('1 / 3');
    expect(topbar.get('grid-column')).toBe('1 / 3');
    expect(rail.get('position')).toBe('relative');
    expect(rail.get('grid-column')).toBe('1');
    expect(rail.get('grid-row')).toBe('2');
    expect(rail.get('flex-direction')).toBe('column');
    expect(rail.get('overflow')).toBe('hidden');
    expect(nav.get('flex-direction')).toBe('column');
    expect(nav.get('overflow-y')).toBe('auto');
    expect(nav.get('overscroll-behavior')).toBe('contain');
    expect(utilities.get('flex')).toBe('0 0 auto');
    expect(content.get('grid-column')).toBe('2');
    expect(content.get('grid-row')).toBe('2');
    expect(content.get('overflow')).toBe('hidden');
    expect(content.get('padding')).toBe('12px clamp(12px, 2vw, 32px) 16px');
    expect(stage.get('height')).toBe('100%');
    expect(stage.get('border-radius')).toBe('12px');
  });

  it('keeps the left rail vertical and its utility actions reachable at high zoom', () => {
    const compactRail = declarations(
      ".desktop-app-shell:is([data-zoom-level='150'], [data-zoom-level='175'], [data-zoom-level='200']) .desktop-primary-rail"
    );
    const compactItems = declarations(
      ".desktop-app-shell:is([data-zoom-level='150'], [data-zoom-level='175'], [data-zoom-level='200']) :is(\n  .desktop-primary-nav-item,\n  .desktop-rail-utility-button\n)"
    );

    expect(compactRail.get('grid-column')).toBe('1');
    expect(compactRail.get('grid-row')).toBe('2');
    expect(compactRail.get('flex-direction')).toBe('column');
    expect(compactRail.get('overflow')).toBe('hidden');
    expect(compactItems.get('min-width')).toBe('38px');
    expect(compactItems.get('min-height')).toBe('38px');
  });

  it('keeps a readable brand, draggable middle, and fixed native controls in the title bar', () => {
    const brand = declarations('.desktop-app-shell .desktop-brand-header');
    const brandMark = declarations('.desktop-app-shell .desktop-brand-mark');
    const wordmark = declarations('.desktop-app-shell .desktop-brand-wordmark');
    const topbar = declarations('.desktop-app-shell .desktop-topbar');
    const dragRegion = declarations('.desktop-app-shell .desktop-titlebar-drag');
    const search = declarations('.desktop-app-shell .desktop-search-trigger');
    const caption = declarations('.desktop-app-shell .desktop-caption-button');
    const controls = declarations('.desktop-app-shell .desktop-window-controls');
    const compactWordmark = declarations(
      ".desktop-app-shell:is([data-zoom-level='150'], [data-zoom-level='175'], [data-zoom-level='200']) .desktop-brand-wordmark"
    );

    expect(brand.get('grid-column')).toBe('1 / 3');
    expect(brand.get('width')).toBe('264px');
    expect(brandMark.get('width')).toBe('40px');
    expect(wordmark.get('display')).toBe('inline-flex');
    expect(wordmark.get('font-size')).toBe('17px');
    expect(topbar.get('grid-column')).toBe('1 / 3');
    expect(topbar.get('padding')).toBe('0 0 0 272px');
    expect(dragRegion.get('flex')).toBe('1 1 auto');
    expect(dragRegion.get('min-width')).toBe('72px');
    expect(search.get('width')).toBe('40px');
    expect(caption.get('width')).toBe('48px');
    expect(controls.get('width')).toBe('144px');
    expect(compactWordmark.get('display')).toBe('none');
  });

  it('keeps source code and brand assets independent from MCHOSE', () => {
    expect(source).not.toContain('mchose.com.cn');
    expect(source).not.toContain('#0053e2');
    expect(source).not.toMatch(/url\s*\(/i);
  });
});
