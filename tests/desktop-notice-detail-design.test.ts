import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const viewSource = await readFile(resolve(root, 'components/notice-detail-view.tsx'), 'utf8');
const queryRouteSource = await readFile(resolve(root, 'app/notices/detail/page.tsx'), 'utf8');
const staticRouteSource = await readFile(resolve(root, 'app/notices/[id]/page.tsx'), 'utf8');
const css = await readFile(resolve(root, 'app/desktop-flagship.css'), 'utf8');
const stylesheet = postcss.parse(css);

function baseDeclarationsFor(selectorSuffix: string) {
  const declarations = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (rule.parent?.type !== 'root') return;
    const matchingSelectors = rule.selectors.filter((selector) => selector.trim().endsWith(selectorSuffix));
    if (!matchingSelectors.length) return;
    if (matchingSelectors.every((selector) => selector.includes('data-zoom-level'))) return;
    rule.walkDecls((declaration: Declaration) => {
      declarations.set(declaration.prop, declaration.value.replace(/\s*!important\s*$/, '').trim());
    });
  });
  return declarations;
}

function highZoomRulesFor(fragment: string) {
  const rules: string[] = [];
  stylesheet.walkRules((rule: Rule) => {
    if (
      rule.selectors.some(
        (selector) =>
          selector.includes(fragment) &&
          /data-zoom-level='(?:150|175|200)'/.test(selector)
      )
    ) {
      rules.push(rule.toString());
    }
  });
  return rules.join('\n');
}

describe('desktop notice detail flagship contract', () => {
  it('uses a dedicated desktop reading hierarchy while retaining the shared website view', () => {
    expect(viewSource).toContain('desktop-notice-detail-page');
    expect(viewSource).toContain('desktop-notice-detail-back');
    expect(viewSource).toContain('desktop-notice-detail-header');
    expect(viewSource).toContain('desktop-notice-detail-layout');
    expect(viewSource).toContain('desktop-notice-detail-reading');
    expect(viewSource).toContain('desktop-notice-detail-sidebar');
    expect(viewSource).toContain('desktop-notice-detail-section');
    expect(viewSource).toContain('desktop-notice-detail-info-row');
    expect(viewSource).toContain('desktop-notice-detail-material-row');
    expect(viewSource).toContain('desktop-notice-detail-update-row');
    expect(viewSource).toContain('<section className="desktop-notice-detail-layout');
    expect(viewSource).toContain('<div className="desktop-notice-detail-reading');
    expect(viewSource).toContain('<aside className="desktop-notice-detail-sidebar');
    expect(viewSource.indexOf('desktop-notice-detail-reading')).toBeLessThan(
      viewSource.indexOf('desktop-notice-detail-sidebar')
    );

    expect(viewSource).toContain('page-hero min-h-0 px-6 py-8');
    expect(viewSource).toContain('xl:grid-cols-[minmax(0,1fr)_330px]');
    expect(staticRouteSource).toContain('<NoticeDetailView');
  });

  it('renders query-route loading and empty results through the same restrained state surface', () => {
    expect(queryRouteSource).toContain('desktop-notice-detail-state-page');
    expect(queryRouteSource.match(/desktop-notice-detail-state--loading/g)?.length).toBe(2);
    expect(queryRouteSource).toContain('desktop-notice-detail-state--empty');
    expect(queryRouteSource).toContain('desktop-notice-detail-state--error');
    expect(queryRouteSource).toContain("state: 'empty' | 'error'");
    expect(queryRouteSource).toContain('desktop-notice-detail-state-action');
    expect(queryRouteSource).toContain('hidden surface-card rounded-[34px] p-8');
  });

  it('centers an at-most 900px reading surface beside a stable 280px action rail', () => {
    const page = baseDeclarationsFor('.desktop-notice-detail-page');
    const layout = baseDeclarationsFor('.desktop-notice-detail-layout');
    const reading = baseDeclarationsFor('.desktop-notice-detail-reading');
    const section = baseDeclarationsFor('.desktop-notice-detail-section');
    const action = baseDeclarationsFor('.desktop-notice-detail-actions :is(button, a)');
    const state = baseDeclarationsFor('.desktop-notice-detail-state');
    const stateActionHover = baseDeclarationsFor('.desktop-notice-detail-state-action:hover');

    expect(page.get('width')).toBe('min(100%, 1190px)');
    expect(page.get('margin')).toBe('0 auto');
    expect(layout.get('grid-template-columns')).toBe('minmax(0, 900px) 280px');
    expect(layout.get('justify-content')).toBe('center');
    expect(reading.get('border-radius')).toBe('var(--desktop-radius-panel)');
    expect(reading.get('box-shadow')).toBe('none');
    expect(section.get('border-radius')).toBe('0');
    expect(section.get('box-shadow')).toBe('none');
    expect(section.get('transform')).toBe('none');
    expect(action.get('min-height')).toBe('var(--desktop-control-height)');
    expect(state.get('border-radius')).toBe('var(--desktop-radius-panel)');
    expect(state.get('box-shadow')).toBe('none');
    expect(state.get('transform')).toBe('none');
    expect(stateActionHover.get('transform')).toBe('none');
  });

  it('keeps all notice-detail visual rules scoped to the desktop shell', () => {
    const unsafeSelectors: string[] = [];
    stylesheet.walkRules((rule: Rule) => {
      for (const selector of rule.selectors) {
        if (!selector.includes('desktop-notice-detail')) continue;
        if (!selector.includes('.desktop-app-shell')) unsafeSelectors.push(selector);
      }
    });

    expect(unsafeSelectors).toEqual([]);
  });

  it('moves the action rail below content and collapses tabular rows at 150-200% zoom', () => {
    const layout = highZoomRulesFor('.desktop-notice-detail-layout');
    const sidebar = highZoomRulesFor('.desktop-notice-detail-sidebar');
    const info = highZoomRulesFor('.desktop-notice-detail-info-grid');

    expect(layout).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(layout).toContain('justify-content: stretch');
    expect(layout).toContain('min-width: 0');
    expect(layout).toContain('grid-column: 1');
    expect(layout).toContain('grid-row: auto');
    expect(sidebar).toContain('position: static');
    expect(info).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(css).toContain("[data-zoom-level='200']");
  });
});
