import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const shellSource = readFileSync(resolve(root, 'components/desktop-app-shell.tsx'), 'utf8');
const cssPath = resolve(root, 'app/desktop-app-coherence.css');
const cssSource = readFileSync(cssPath, 'utf8');
const marker = '/* RELEASE-SAFE HIGH-ZOOM SHELL GEOMETRY';
const start = cssSource.indexOf(marker);
const end = cssSource.indexOf('/* END RELEASE-SAFE HIGH-ZOOM SHELL GEOMETRY */', start);
const releaseCss = cssSource.slice(start, end);
const stylesheet = postcss.parse(releaseCss, { from: cssPath });

function declarationsFor(fragment: string, required?: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.some(
      (selector) => selector.includes(fragment) && (!required || selector.includes(required))
    )) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value.replace(/\s*!important\s*$/, '').trim());
    });
  });
  return values;
}

describe('desktop shell high-zoom geometry', () => {
  it('caps 200% desktop chrome while leaving business content zoomed', () => {
    const capStart = cssSource.indexOf('/* BEGIN MATURE HIGH-ZOOM CHROME CAP');
    const capEnd = cssSource.indexOf('/* END MATURE HIGH-ZOOM CHROME CAP */', capStart);
    expect(capStart).toBeGreaterThanOrEqual(0);
    expect(capEnd).toBeGreaterThan(capStart);
    const cap = cssSource.slice(capStart, capEnd);

    expect(cap).toMatch(/data-zoom-level='200'[\s\S]*?--so-titlebar-h:\s*48px !important/);
    expect(cap).toMatch(/data-zoom-level='200'[\s\S]*?--so-rail-w:\s*128px !important/);
    expect(cap).toMatch(/\.desktop-brand-mark\s*\{[^}]*width:\s*28px !important[^}]*height:\s*28px !important/);
    expect(cap).toMatch(/::-webkit-scrollbar\s*\{[^}]*width:\s*4px !important[^}]*height:\s*4px !important/);
  });

  it('keeps the title bar inside its effective viewport and preserves Chinese branding', () => {
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const topbar = declarationsFor('.desktop-topbar');
    const drag = declarationsFor('.desktop-titlebar-drag');
    const wordmark = declarationsFor('.desktop-brand-wordmark');
    const english = declarationsFor('.desktop-brand-english');

    expect(topbar.get('width')).toBe('100%');
    expect(topbar.get('padding')).toBe('0');
    expect(topbar.get('overflow')).toBe('hidden');
    expect(drag.get('min-width')).toBe('8px');
    expect(wordmark.get('display')).toBe('inline-flex');
    expect(english.get('display')).toBe('none');
  });

  it('reserves an exact three-button window-control track at 175-200%', () => {
    const controls = declarationsFor('.desktop-window-controls', "data-zoom-level='200'");
    const caption = declarationsFor('.desktop-caption-button', "data-zoom-level='200'");
    expect(controls.get('width')).toBe('108px');
    expect(controls.get('min-width')).toBe('108px');
    expect(caption.get('width')).toBe('36px');
    expect(caption.get('min-width')).toBe('36px');
  });

  it('splits the rail into an independently scrolling middle and fixed utilities', () => {
    const rail = declarationsFor('.desktop-primary-rail');
    const list = declarationsFor('.desktop-nav-list--primary');
    const utilities = declarationsFor('.desktop-rail-utilities');
    expect(rail.get('display')).toBe('grid');
    expect(rail.get('grid-template-rows')).toBe('minmax(0, 1fr) auto');
    expect(list.get('overflow-y')).toBe('auto');
    expect(list.get('contain')).toContain('paint');
    expect(utilities.get('grid-row')).toBe('2');
    expect(utilities.get('position')).toBe('relative');
  });

  it('keeps navigation labels while hiding only high-zoom group headings', () => {
    const groupLabel = declarationsFor('.desktop-nav-group-label', "data-zoom-level='200'");
    const navLabel = declarationsFor(
      '.desktop-primary-nav-item > span:not(.desktop-nav-badge)',
      "data-zoom-level='200'"
    );
    const utilityLabel = declarationsFor(
      '.desktop-rail-utility-button > span',
      "data-zoom-level='200'"
    );
    expect(groupLabel.get('display')).toBe('none');
    expect(navLabel.get('display')).toBe('block');
    expect(navLabel.get('white-space')).toBe('normal');
    expect(navLabel.get('text-overflow')).toBe('clip');
    expect(utilityLabel.get('white-space')).toBe('normal');
    expect(releaseCss).toContain("data-desktop-zoom-level='125'");
    expect(shellSource.indexOf('desktop-nav-list--primary')).toBeLessThan(
      shellSource.indexOf('desktop-rail-utilities')
    );
  });
});
