import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const resourceSource = readFileSync(
  resolve(root, 'app/resources/desktop-resource-center.tsx'),
  'utf8'
);
const layoutSource = readFileSync(resolve(root, 'app/build-surface.desktop.tsx'), 'utf8');
const cssPath = resolve(root, 'app/desktop-resource-center.css');
const cssSource = readFileSync(cssPath, 'utf8');
const referenceCssSource = cssSource.slice(
  cssSource.indexOf('/* Resource reference workspace authority (2026-08-30).')
);
const stylesheet = postcss.parse(cssSource, { from: cssPath });

function declarationsContaining(...fragments: string[]) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.some((selector) => fragments.every((fragment) => selector.includes(fragment)))) {
      return;
    }
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

function declarationsForExact(selector: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (rule.parent?.type !== 'root' || !rule.selectors.includes(selector)) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

function declarationsEndingWith(ending: string, ...fragments: string[]) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (
      !rule.selectors.some(
        (selector) =>
          selector.trim().endsWith(ending) &&
          fragments.every((fragment) => selector.includes(fragment))
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

describe('desktop resource directory design', () => {
  it('keeps the desktop redesign isolated, labelled and honest about destinations', () => {
    expect(resourceSource).toContain('aria-labelledby="resource-page-title"');
    expect(resourceSource).toContain('aria-labelledby="resource-directory-title"');
    expect(resourceSource).toContain('className="desktop-resource-tool-grid desktop-resource-tool-list" role="list"');
    expect(resourceSource).toContain('desktop-resource-link-grid');
    expect(resourceSource).toContain('role="listitem"');
    expect(resourceSource).toContain("'noreferrer sponsored'");
    expect(resourceSource).toContain('在新窗口打开');
    expect(resourceSource).toContain('收藏仅存本机');
    expect(resourceSource).toContain('aria-label="本机偏好：收藏和最近使用仅保存在当前设备"');
    expect(resourceSource).toContain("fill={favorite ? 'currentColor' : 'none'}");
    expect(layoutSource.indexOf("import './desktop-resource-center.css'"))
      .toBeGreaterThan(layoutSource.indexOf("import './desktop-flagship.css'"));
  });

  it('uses the shared title, notification-aligned spacing and integrated directory toolbar', () => {
    const page = declarationsForExact('.desktop-app-shell:is(.desktop-app-shell) .desktop-resource-page');
    const hero = declarationsForExact('.desktop-app-shell:is(.desktop-app-shell) .desktop-resource-hero');
    const title = declarationsForExact('.desktop-app-shell:is(.desktop-app-shell) .desktop-resource-hero h1');
    const toolbar = declarationsForExact('.desktop-app-shell:is(.desktop-app-shell) .desktop-resource-toolbar');
    const search = declarationsForExact('.desktop-app-shell:is(.desktop-app-shell) .desktop-resource-search');
    const filters = declarationsForExact('.desktop-app-shell:is(.desktop-app-shell) .desktop-resource-filter-list');

    expect(page.get('width')).toBe('min(1280px, 100%)');
    expect(page.get('max-width')).toBe('100%');
    expect(page.get('gap')).toBe('20px');
    expect(page.get('overflow-x')).toBe('clip');
    expect(hero.get('min-height')).toBe('88px');
    expect(title.get('font-size')).toBe('28px');
    expect(title.get('line-height')).toBe('36px');
    expect(title.get('font-weight')).toBe('600');
    expect(toolbar.get('min-height')).toBe('106px');
    expect(toolbar.get('padding')).toBe('10px 20px');
    expect(toolbar.get('border-radius')).toBe('12px');
    expect(search.get('height')).toBe('44px');
    expect(filters.get('position')).toBe('static');
    expect(filters.get('width')).toBe('100%');
  });

  it('presents every wide group as four compact cards with stable action zones', () => {
    expect(referenceCssSource).toMatch(
      /desktop-resource-workspace\.desktop-resource-workspace[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 272px/
    );
    expect(referenceCssSource).toMatch(
      /desktop-resource-tool-list\.desktop-resource-tool-list,[\s\S]*?desktop-resource-link-grid\.desktop-resource-link-grid[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/
    );
    expect(referenceCssSource).toMatch(
      /desktop-resource-item\.desktop-resource-item\.desktop-resource-item\s*\{[\s\S]*?min-height:\s*174px[\s\S]*?padding:\s*0[\s\S]*?display:\s*block[\s\S]*?border-radius:\s*11px/
    );
    expect(referenceCssSource).toContain("'keywords keywords'");
    expect(referenceCssSource).toContain("'action action'");
    expect(referenceCssSource).toMatch(
      /desktop-resource-item-title\.desktop-resource-item-title strong\s*\{[\s\S]*?font-size:\s*15px[\s\S]*?white-space:\s*normal[\s\S]*?-webkit-line-clamp:\s*2/
    );
    expect(referenceCssSource).toMatch(
      /desktop-resource-favorite\.desktop-resource-favorite\.desktop-resource-favorite\s*\{[\s\S]*?position:\s*absolute[\s\S]*?right:\s*10px[\s\S]*?bottom:\s*11px/
    );
  });

  it('uses restrained category colors instead of one full-page green treatment', () => {
    expect(cssSource).toContain("[data-resource-category='toolkit']");
    expect(cssSource).toContain('--resource-category: #5b4bb7');
    expect(cssSource).toContain('--resource-category: #245ea8');
    expect(cssSource).toContain('--resource-category: #0f6b61');
    expect(cssSource).toContain('--resource-category: #9a5200');
    expect(cssSource).toContain("[data-resource-filter='favorites'][aria-pressed='true']");
  });

  it('keeps four quick entries compact and readable in the wide workspace', () => {
    expect(referenceCssSource).toMatch(
      /desktop-resource-quick-grid\.desktop-resource-quick-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)[\s\S]*?gap:\s*9px/
    );
    expect(referenceCssSource).toMatch(
      /desktop-resource-quick-item\.desktop-resource-quick-item\s*\{[\s\S]*?min-height:\s*64px[\s\S]*?padding:\s*9px 10px[\s\S]*?grid-template-columns:\s*36px minmax\(0, 1fr\) 16px/
    );
    expect(referenceCssSource).toMatch(
      /desktop-resource-quick-copy\.desktop-resource-quick-copy strong\s*\{[\s\S]*?font-size:\s*14px[\s\S]*?line-height:\s*21px/
    );
    expect(referenceCssSource).toMatch(
      /desktop-resource-section-icon\s*\{[\s\S]*?width:\s*36px[\s\S]*?height:\s*36px/
    );
  });

  it('uses deterministic high-zoom geometry without covering the resource content', () => {
    const page = declarationsEndingWith(
      '.desktop-resource-page.desktop-resource-page',
      '[data-density]',
      "data-zoom-level='200'"
    );
    const toolbar = declarationsEndingWith(
      '.desktop-resource-toolbar.desktop-resource-toolbar',
      '[data-density]',
      "data-zoom-level='200'"
    );
    const filters = declarationsEndingWith(
      '.desktop-resource-filter-list.desktop-resource-filter-list',
      '[data-density]',
      "data-zoom-level='200'"
    );
    const filter = declarationsEndingWith(
      '.desktop-resource-filter.desktop-resource-filter',
      '[data-density]',
      "data-zoom-level='200'"
    );
    const lists = declarationsContaining("data-zoom-level='200'", '.desktop-resource-link-grid');
    const meta = declarationsEndingWith(
      '.desktop-resource-hero-meta',
      '[data-density]',
      "data-zoom-level='200'"
    );

    expect(page.get('width')).toBe('100%');
    expect(page.get('max-width')).toBe('100%');
    expect(page.get('overflow-x')).toBe('clip');
    expect(toolbar.get('height')).toBe('auto');
    expect(toolbar.get('max-height')).toBe('none');
    expect(toolbar.get('display')).toBe('grid');
    expect(filters.get('display')).toBe('grid');
    expect(filters.get('grid-template-columns')).toBe('repeat(2, minmax(0, 1fr))');
    expect(filters.get('overflow')).toBe('visible');
    expect(filter.get('width')).toBe('100%');
    expect(filter.get('min-width')).toBe('0');
    expect(lists.get('grid-template-columns')).toBe('minmax(0, 1fr)');
    expect(meta.get('display')).toBe('flex');
    expect(meta.get('position')).toBe('static');
    expect(meta.get('width')).toBe('max-content');
    expect(meta.get('align-self')).toBe('auto');
    expect(meta.get('margin')).toBe('10px 0 0');
  });
});
