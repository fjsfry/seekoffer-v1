import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';
import { officialResourceSections } from '../lib/portal-data';

const root = resolve(import.meta.dirname, '..');
const pagePath = resolve(root, 'app/resources/desktop-resource-center.tsx');
const webPagePath = resolve(root, 'app/resources/page.tsx');
const shellPath = resolve(root, 'components/desktop-app-shell.tsx');
const baseCssPath = resolve(root, 'app/resources/resources.module.css');
const cssPath = resolve(root, 'app/desktop-resource-center.css');
const externalMarkPath = resolve(root, 'components/external-site-mark.tsx');
const pageSource = readFileSync(pagePath, 'utf8');
const webPageSource = readFileSync(webPagePath, 'utf8');
const shellSource = readFileSync(shellPath, 'utf8');
const baseCssSource = readFileSync(baseCssPath, 'utf8');
const cssSource = readFileSync(cssPath, 'utf8');
const referenceCssSource = cssSource.slice(
  cssSource.indexOf('/* Resource reference workspace authority (2026-08-30).')
);
const externalMarkSource = readFileSync(externalMarkPath, 'utf8');
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

describe('desktop resource center workflow', () => {
  it('isolates the redesigned workspace from the public website route', () => {
    expect(webPageSource).not.toContain("'use client'");
    expect(webPageSource).not.toContain('RESOURCE_LOCAL_STATE_KEY');
    expect(webPageSource).not.toContain('resource-search-input');
    expect(webPageSource).toMatch(/<h1[^>]*>资源库<\/h1>/);
    expect(shellSource).toContain("import('@/app/resources/desktop-resource-center')");
    expect(shellSource).toContain("routePathname === '/resources'");
    expect(pageSource).toContain('export default function DesktopResourceCenter()');
  });

  it('keeps all 22 real entries and their existing business sources', () => {
    const officialEntryCount = officialResourceSections.reduce(
      (total, section) => total + section.links.length,
      0
    );
    const applicationEntryCount = pageSource.match(/id: 'toolkit-[^']+'/g)?.length ?? 0;

    expect(officialEntryCount).toBe(18);
    expect(applicationEntryCount).toBe(4);
    expect(officialEntryCount + applicationEntryCount).toBe(22);
    expect(pageSource).toContain('const externalResources: ResourceItem[] = officialResourceSections.flatMap');
    expect(pageSource).toContain("href: taobaoTemplatePackHref");
    expect(pageSource).toContain("href: '/gpa'");
  });

  it('adds search, category filtering, keyboard discovery and accessible link semantics', () => {
    expect(pageSource).toContain('id="resource-search-input"');
    expect(pageSource).toContain('placeholder="搜索资源名称、用途或分类"');
    expect(pageSource).toContain("event.key.toLowerCase() === 'f'");
    expect(pageSource).toContain("event.key === '/'");
    expect(pageSource).toContain('aria-pressed={selected}');
    expect(pageSource).toContain('aria-label="筛选资源分类"');
    expect(pageSource).toContain('aria-live="polite"');
    expect(pageSource).toContain('target="_blank"');
    expect(pageSource).toContain("'noreferrer sponsored'");
    expect(pageSource).toContain('在新窗口打开');
  });

  it('keeps favorites and recents deliberately device-local and sanitizes stored ids', () => {
    expect(pageSource).toContain("seekoffer:resource-center:device-state:v1");
    expect(pageSource).toContain('window.localStorage.getItem(RESOURCE_LOCAL_STATE_KEY)');
    expect(pageSource).toContain('window.localStorage.setItem(RESOURCE_LOCAL_STATE_KEY');
    expect(pageSource).toContain('allowedResourceIds.has(id)');
    expect(pageSource).toContain('uniqueKnownIds(parsed.recentIds).slice(0, 8)');
    expect(pageSource).toContain('收藏仅存本机');
    expect(pageSource).toContain('aria-label="本机偏好：收藏和最近使用仅保存在当前设备"');
    expect(pageSource).toContain('aria-pressed={favorite}');
    expect(pageSource).toMatch(
      /useEffect\(\(\) => \{[\s\S]*?try \{[\s\S]*?localStorage\.getItem\(RESOURCE_LOCAL_STATE_KEY\)[\s\S]*?catch \{[\s\S]*?finally \{[\s\S]*?setLocalStateReady\(true\)/
    );
  });

  it('requests lazy site marks while retaining the component fallback', () => {
    expect(pageSource).toContain('<ExternalSiteMark source={item.href} label={item.title} size="sm"');
    expect(externalMarkSource).toContain("loading={size === 'sm' ? 'lazy' : 'eager'}");
    expect(externalMarkSource).toContain('const initial = buildFallbackInitial(label, domain)');
    expect(externalMarkSource).toContain('shouldUseImage && imageLoaded ? \'hidden\' : \'flex\'');
  });

  it('uses shared surface variables so light and dark themes remain one visual system', () => {
    for (const variable of [
      '--desktop-canvas',
      '--desktop-surface',
      '--desktop-surface-subtle',
      '--desktop-border',
      '--desktop-text',
      '--desktop-text-secondary',
      '--desktop-accent',
      '--desktop-accent-muted'
    ]) {
      expect(baseCssSource).toContain(`var(${variable}`);
    }

    expect(baseCssSource).not.toContain("data-desktop-theme='light'");
    expect(baseCssSource).not.toContain("data-desktop-theme='dark'");
  });

  it('uses readable four-column cards and reflows to one column at 125 to 200 percent', () => {
    const description = declarationsForExact(
      '.desktop-app-shell:is(.desktop-app-shell) .desktop-resource-item-description'
    );
    const zoomWorkspace = declarationsContaining("data-zoom-level='200'", '.desktop-resource-workspace');
    const zoomQuickGrid = declarationsContaining("data-zoom-level='200'", '.desktop-resource-quick-grid');
    const zoomList = declarationsContaining("data-zoom-level='200'", '.desktop-resource-link-grid');

    expect(referenceCssSource).toMatch(
      /desktop-resource-tool-list\.desktop-resource-tool-list,[\s\S]*?desktop-resource-link-grid\.desktop-resource-link-grid[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/
    );
    expect(referenceCssSource).toContain("[data-zoom-level='125']");
    expect(description.get('white-space')).toBe('normal');
    expect(description.get('overflow-wrap')).toBe('anywhere');
    expect(description.get('-webkit-line-clamp')).toBe('2');
    expect(zoomWorkspace.get('grid-template-columns')).toBe('minmax(0, 1fr)');
    expect(zoomQuickGrid.get('grid-template-columns')).toBe('minmax(0, 1fr)');
    expect(zoomList.get('grid-template-columns')).toBe('minmax(0, 1fr)');
  });

  it('keeps favorite and destination controls in stable bottom action zones', () => {
    const zoomLink = declarationsContaining("data-zoom-level='200'", '.desktop-resource-item', '.desktop-resource-link');

    expect(referenceCssSource).toMatch(
      /desktop-resource-item\.desktop-resource-item\.desktop-resource-item\s*\{[\s\S]*?display:\s*block[\s\S]*?overflow:\s*hidden/
    );
    expect(referenceCssSource).toContain("'keywords keywords'");
    expect(referenceCssSource).toContain("'action action'");
    expect(referenceCssSource).toMatch(
      /desktop-resource-item-title\.desktop-resource-item-title strong\s*\{[\s\S]*?white-space:\s*normal[\s\S]*?-webkit-line-clamp:\s*2/
    );
    expect(referenceCssSource).toMatch(
      /desktop-resource-favorite\.desktop-resource-favorite\.desktop-resource-favorite\s*\{[\s\S]*?position:\s*absolute[\s\S]*?width:\s*34px[\s\S]*?height:\s*34px/
    );
    expect(zoomLink.get('grid-template-columns')).toBe('40px minmax(0, 1fr)');
    expect(zoomLink.get('grid-template-areas')).toContain("'mark copy'");
    expect(zoomLink.get('grid-template-areas')).toContain("'keywords keywords'");
    expect(zoomLink.get('grid-template-areas')).toContain("'action action'");
  });

  it('uses standard font weights and keeps all visible module copy at 12 pixels or larger', () => {
    const numericWeights: number[] = [];
    const pixelSizes: number[] = [];

    stylesheet.walkDecls((declaration: Declaration) => {
      const value = declaration.value.replace(/\s*!important\s*$/, '').trim();

      if (declaration.prop === 'font-weight' && /^\d+$/.test(value)) {
        numericWeights.push(Number(value));
      }

      if (declaration.prop === 'font-size' && /^\d+(?:\.\d+)?px$/.test(value)) {
        pixelSizes.push(Number.parseFloat(value));
      }
    });

    expect(numericWeights.length).toBeGreaterThan(0);
    expect(numericWeights.every((weight) => [400, 500, 600].includes(weight))).toBe(true);
    expect(pixelSizes.length).toBeGreaterThan(0);
    expect(Math.min(...pixelSizes)).toBeGreaterThanOrEqual(12);
  });

  it('keeps release density, medium-width filters, empty results and toolkit contrast deterministic', () => {
    expect(baseCssSource).toContain('/* Release authority scoped to the desktop-only resource component.');
    expect(baseCssSource).toMatch(
      /\.resourceItem\.resourceItem\s*\{[^}]*min-height:\s*92px[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 40px[^}]*border-radius:\s*10px/,
    );
    expect(baseCssSource).toMatch(
      /\.resourceLink\.resourceLink\s*\{[^}]*min-height:\s*90px[^}]*grid-template-columns:\s*42px minmax\(0, 1fr\) 68px/,
    );
    expect(baseCssSource).toMatch(
      /@container resource-center \(max-width: 1100px\)[\s\S]*?\.categoryList\.categoryList\s*\{[^}]*height:\s*max-content[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(132px, 1fr\)\)[^}]*overflow:\s*visible/,
    );
    expect(baseCssSource).toMatch(
      /\.emptyState\s*\{[^}]*min-height:\s*clamp\(300px, 44vh, 520px\)[^}]*align-items:\s*center[^}]*justify-content:\s*center/,
    );
    expect(baseCssSource).toContain('--resource-category: color-mix(in srgb, #7666de 68%, var(--resource-text) 32%)');
    expect(baseCssSource).toMatch(
      /data-resource-category='toolkit'[\s\S]*?\.resourceTitle\.resourceTitle small,[\s\S]*?color:\s*var\(--resource-category\)/,
    );
    expect(pageSource.indexOf('desktop-resource-toolbar')).toBeLessThan(pageSource.indexOf('className={styles.emptyState}'));
  });
});
