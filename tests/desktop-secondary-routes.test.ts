import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');
const flagshipPath = resolve(projectRoot, 'app/desktop-flagship.css');
const flagshipSource = readFileSync(flagshipPath, 'utf8');
const stylesheet = postcss.parse(flagshipSource, { from: flagshipPath });

const routes = [
  'competitions',
  'knowledge',
  'guide',
  'faq',
  'consulting',
  'about',
  'data-quality',
  'privacy',
  'terms',
  'disclaimer'
] as const;

function sourceFor(route: (typeof routes)[number]) {
  return readFileSync(resolve(projectRoot, `app/${route}/page.tsx`), 'utf8');
}

function declarationsForSelectorSuffix(fragment: string) {
  const declarations = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.some((selector) => selector.trim().endsWith(fragment))) return;
    rule.walkDecls((declaration: Declaration) => {
      declarations.set(declaration.prop, declaration.value);
    });
  });
  return declarations;
}

function highZoomDeclarations(fragment: string) {
  const declarations = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (
      !rule.selectors.some(
        (selector) =>
          selector.includes(fragment) &&
          /data-zoom-level='(?:150|175|200)'/.test(selector)
      )
    ) {
      return;
    }
    rule.walkDecls((declaration: Declaration) => {
      declarations.set(declaration.prop, declaration.value);
    });
  });
  return declarations;
}

describe('desktop secondary route visual contract', () => {
  it('gives every secondary route a stable desktop-only semantic root', () => {
    for (const route of routes) {
      expect(sourceFor(route)).toContain('desktop-secondary-page');
      expect(sourceFor(route)).toContain('space-y-8 lg:space-y-10');
    }

    expect(sourceFor('competitions')).toContain('desktop-competitions-list');
    expect(sourceFor('competitions')).toContain('desktop-competition-card');
    expect(sourceFor('knowledge').match(/desktop-reading-section/g)?.length).toBe(5);
    expect(sourceFor('guide')).toContain('desktop-guide-layout');
    expect(sourceFor('faq')).toContain('desktop-faq-item');
    expect(sourceFor('privacy')).toContain('desktop-legal-page');
    expect(sourceFor('terms')).toContain('desktop-legal-page');
    expect(sourceFor('disclaimer')).toContain('desktop-legal-page');
  });

  it('keeps the about route to one page-level heading', () => {
    const about = sourceFor('about');

    expect(about).toContain('level="h1"');
    expect(about).toMatch(/<h2\b/);
    expect(about).not.toMatch(/<h1\b/);
  });

  it('keeps all secondary-route CSS inside the desktop application shell', () => {
    const unsafeSelectors: string[] = [];
    const secondarySelector = /desktop-(?:secondary|reading|legal|competitions?|knowledge|guide|faq|consulting|about|data-quality)/;

    stylesheet.walkRules((rule: Rule) => {
      for (const selector of rule.selectors) {
        if (!secondarySelector.test(selector)) continue;
        if (!selector.includes('.desktop-app-shell')) unsafeSelectors.push(selector);
      }
    });

    expect(unsafeSelectors).toEqual([]);
  });

  it('uses Windows-scale typography and restrained surfaces', () => {
    const page = declarationsForSelectorSuffix('.desktop-secondary-page');
    const title = declarationsForSelectorSuffix('.desktop-secondary-page h1');
    const surface = declarationsForSelectorSuffix('.desktop-reading-section');

    expect(page.get('font-size')).toBe('14px');
    expect(title.get('font-size')).toBe('24px');
    expect(surface.get('border')).toBe('0');
    expect(surface.get('border-radius')).toBe('0');
    expect(surface.get('background')).toBe('transparent');
    expect(surface.get('box-shadow')).toBe('none');
  });

  it('renders competitions as continuous rows without lift or decorative gradients', () => {
    const source = sourceFor('competitions');
    const list = declarationsForSelectorSuffix('.desktop-competitions-list');
    const card = declarationsForSelectorSuffix('.desktop-competition-card');

    expect(source).toContain('aria-label="搜索竞赛"');
    expect(source).toContain('const currentPage = Math.min(requestedPage, pageCount);');
    expect(source).not.toContain('href={item.officialUrl ||');
    expect(source).toContain('aria-disabled="true"');
    expect(list.get('grid-template-columns')).toContain('minmax(0, 1fr)');
    expect(card.get('border-radius')).toBe('0');
    expect(card.get('background-image')).toBe('none');
    expect(card.get('box-shadow')).toBe('none');
    expect(card.get('transform')).toBe('none');
  });

  it('collapses dense content and the parent reading grids at high desktop zoom', () => {
    for (const fragment of [
      '.desktop-competition-card',
      '.desktop-knowledge-page #timeline article',
      '.desktop-guide-layout',
      '.desktop-faq-layout',
      '.desktop-about-page .desktop-secondary-header > div'
    ]) {
      expect(
        highZoomDeclarations(fragment).get('grid-template-columns'),
        `${fragment} must become one column before its children are restyled`
      ).toBe('minmax(0, 1fr)');
    }

    for (const fragment of [
      '.desktop-guide-layout',
      '.desktop-faq-layout',
      '.desktop-about-page .desktop-secondary-header > div'
    ]) {
      const declarations = highZoomDeclarations(fragment);
      expect(declarations.get('min-width'), `${fragment} children must be shrinkable`).toBe('0');
      expect(declarations.get('grid-column'), `${fragment} children must return to column one`).toBe('1');
      expect(declarations.get('grid-row'), `${fragment} children must return to normal flow`).toBe('auto');
    }
  });
});
