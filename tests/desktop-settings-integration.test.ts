import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const [settingsSource, shellSource, flagshipSource, layoutSource, qqSource, settingsModuleSource] = await Promise.all([
  readFile(resolve(projectRoot, 'components/desktop-settings-page.tsx'), 'utf8'),
  readFile(resolve(projectRoot, 'components/desktop-app-shell.tsx'), 'utf8'),
  readFile(resolve(projectRoot, 'app/desktop-flagship.css'), 'utf8'),
  readFile(resolve(projectRoot, 'app/build-surface.desktop.tsx'), 'utf8'),
  readFile(resolve(projectRoot, 'app/desktop-qq.css'), 'utf8'),
  readFile(resolve(projectRoot, 'components/desktop-settings-page.module.css'), 'utf8')
]);
const flagshipRoot = postcss.parse(flagshipSource);
const settingsModuleRoot = postcss.parse(settingsModuleSource);
const importedCssFiles = Array.from(
  layoutSource.matchAll(/import\s+['"]\.\/([^'"]+\.css)['"];?/g),
  (match) => match[1]
);
const importedCssRoots = await Promise.all(
  importedCssFiles.map(async (file) => ({
    file,
    root: postcss.parse(await readFile(resolve(projectRoot, 'app', file), 'utf8'), {
      from: `app/${file}`
    })
  }))
);

function declarations(selectorSuffix: string, highZoom = false) {
  const result = new Map<
    string,
    { value: string; important: boolean; specificity: number; order: number }
  >();
  let order = 0;
  const normalizeSelector = (selector: string) =>
    selector
      .replace(/\s+/g, ' ')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .replace(/\s*,\s*/g, ',')
      .trim();
  const normalizedSuffix = normalizeSelector(selectorSuffix);
  flagshipRoot.walkRules((rule: Rule) => {
    if (rule.parent?.type !== 'root') return;
    const selectorMatches = rule.selectors.some((selector) =>
      normalizeSelector(selector).endsWith(normalizedSuffix)
    );
    if (!selectorMatches) return;
    const selectorHasHighZoom = /data-zoom-level='(?:150|175|200)'/.test(rule.selector);
    const selectorHasDensity = /data-density=/.test(rule.selector);
    if (selectorHasHighZoom !== highZoom) return;
    if (!highZoom && selectorHasDensity) return;
    const specificity = Math.max(
      ...rule.selectors
        .filter((selector) =>
          normalizeSelector(selector).endsWith(normalizedSuffix)
        )
        .map(selectorSpecificity)
    );
    rule.walkDecls((declaration: Declaration) => {
      order += 1;
      const next = {
        value: declaration.value,
        important: Boolean(declaration.important),
        specificity,
        order
      };
      const current = result.get(declaration.prop);
      const wins =
        !current ||
        Number(next.important) > Number(current.important) ||
        (next.important === current.important && next.specificity > current.specificity) ||
        (next.important === current.important &&
          next.specificity === current.specificity &&
          next.order > current.order);
      if (wins) result.set(declaration.prop, next);
    });
  });
  return new Map(Array.from(result, ([property, entry]) => [property, entry.value]));
}

type CascadeValue = {
  value: string;
  important: boolean;
  specificity: number;
  order: number;
};

function selectorSpecificity(selector: string) {
  const withoutWhere = selector.replace(/:where\([^)]*\)/g, '');
  const ids = withoutWhere.match(/#[\w-]+/g)?.length ?? 0;
  const classes = withoutWhere.match(/\.[\w-]+/g)?.length ?? 0;
  const attributes = withoutWhere.match(/\[[^\]]+\]/g)?.length ?? 0;
  const pseudoClasses = withoutWhere.match(/:(?!:)[\w-]+/g)?.length ?? 0;
  return ids * 10_000 + (classes + attributes + pseudoClasses) * 100;
}

function isUnconditionalRule(rule: Rule) {
  let parent = rule.parent;
  while (parent && parent.type !== 'root') {
    if (parent.type === 'atrule') return false;
    parent = parent.parent;
  }
  return true;
}

function selectorAppliesAtZoom(selector: string, zoom: number) {
  const constrainedZooms = Array.from(
    selector.matchAll(/data-(?:desktop-)?zoom-level=['"](\d+)['"]/g),
    (match) => Number(match[1])
  );
  return constrainedZooms.length === 0 || constrainedZooms.includes(zoom);
}

function finalCascadeDeclarations(selectorSuffix: string, zoom: number) {
  const result = new Map<string, CascadeValue>();
  let order = 0;

  for (const { root } of importedCssRoots) {
    root.walkRules((rule: Rule) => {
      if (!isUnconditionalRule(rule)) return;

      for (const selector of rule.selectors) {
        if (!selector.trim().endsWith(selectorSuffix)) continue;
        if (!selectorAppliesAtZoom(selector, zoom)) continue;

        const specificity = selectorSpecificity(selector);
        rule.walkDecls((declaration: Declaration) => {
          order += 1;
          const next: CascadeValue = {
            value: declaration.value,
            important: Boolean(declaration.important),
            specificity,
            order
          };
          const current = result.get(declaration.prop);
          const wins =
            !current ||
            Number(next.important) > Number(current.important) ||
            (next.important === current.important && next.specificity > current.specificity) ||
            (next.important === current.important &&
              next.specificity === current.specificity &&
              next.order > current.order);
          if (wins) result.set(declaration.prop, next);
        });
      }
    });
  }

  return new Map(Array.from(result, ([property, entry]) => [property, entry.value]));
}

function settingsModuleRootDeclarations(...selectorFragments: string[]) {
  const values = new Map<string, string>();
  settingsModuleRoot.walkRules((rule: Rule) => {
    if (rule.parent?.type !== 'root') return;
    if (!rule.selectors.some((selector) =>
      !selector.includes('data-zoom-level') &&
      selectorFragments.every((fragment) => selector.includes(fragment)))) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

describe('integrated desktop settings design', () => {
  it('uses one in-workspace page rather than a nested secondary app shell', () => {
    expect(settingsSource).toContain('desktop-settings-page');
    expect(settingsSource).toContain('desktop-settings-header');
    expect(settingsSource).not.toContain('className="desktop-settings-back"');
    expect(shellSource).toContain('data-settings-open={settingsOpen}');
    expect(shellSource).toContain('className="desktop-primary-rail');
    expect(shellSource).toContain('<DesktopSettingsPage');
    expect(shellSource).toContain("querySelector<HTMLElement>('.desktop-settings-nav-item--active')");

    const page = declarations('.desktop-settings-page');
    const layout = declarations('.desktop-settings-layout');
    expect(page.get('background')).toBe('var(--so-surface)');
    expect(layout.get('grid-template-columns')).toBe('220px minmax(0, 1fr)');
    expect(layout.get('grid-template-rows')).toBe('minmax(0, 1fr)');
  });

  it('keeps roving-tab semantics aligned with the responsive category orientation', () => {
    expect(settingsSource).toContain('role="tablist"');
    expect(settingsSource).toContain('const categoriesAreHorizontal = preferences.zoomLevel >= 150');
    expect(settingsSource).toContain("const categoryOrientation = categoriesAreHorizontal ? 'horizontal' : 'vertical'");
    expect(settingsSource).toContain('aria-orientation={categoryOrientation}');
    expect(settingsSource).toContain('data-orientation={categoryOrientation}');
    expect(settingsSource).toContain("const forwardKey = categoriesAreHorizontal ? 'ArrowRight' : 'ArrowDown'");
    expect(settingsSource).toContain("const backwardKey = categoriesAreHorizontal ? 'ArrowLeft' : 'ArrowUp'");
    expect(settingsSource).toContain("nextTab?.scrollIntoView({ block: 'nearest', inline: 'nearest' })");
    expect(settingsSource).toContain('role="tab"');
    expect(settingsSource).toContain('aria-selected={active}');
    expect(settingsSource).toContain('aria-controls={`desktop-settings-panel-${category.id}`}');
    expect(settingsSource.match(/role="tabpanel"/g)).toHaveLength(5);

    const tabs = declarations('.desktop-settings-nav');
    const tab = declarations('.desktop-settings-nav-item');
    expect(tabs.get('flex-direction')).toBe('column');
    expect(tabs.get('overflow-x')).toBe('hidden');
    expect(tabs.get('overflow-y')).toBe('auto');
    expect(tabs.get('border-right')).toContain('var(--so-border)');
    expect(tab.get('height')).toBe('52px');
    expect(tab.get('border-radius')).toBe('10px');
  });

  it('wins the imported cascade with a rail at standard zoom and a complete category grid from 125%', () => {
    expect(importedCssFiles.at(-1)).toBe('desktop-app-coherence.css');
    expect(importedCssFiles.filter((file) => file === 'desktop-app-coherence.css')).toHaveLength(1);
    expect(new Set(importedCssFiles).size).toBe(importedCssFiles.length);
    expect(qqSource).toMatch(
      /\.desktop-app-shell \.desktop-settings-nav\s*\{[\s\S]*?flex-direction:\s*column\s*!important/
    );

    for (const zoom of [80, 90, 100, 110]) {
      const page = finalCascadeDeclarations('.desktop-settings-page', zoom);
      const header = finalCascadeDeclarations('.desktop-settings-header', zoom);
      const layout = finalCascadeDeclarations('.desktop-settings-layout', zoom);
      const nav = finalCascadeDeclarations('.desktop-settings-nav', zoom);
      const content = finalCascadeDeclarations('.desktop-settings-content', zoom);

      expect(page.get('display'), `${zoom}% page display`).toBe('grid');
      expect(page.get('grid-template-rows'), `${zoom}% page rows`).toBe(
        'var(--app-page-header-h) minmax(0, 1fr)'
      );
      expect(header.get('grid-area'), `${zoom}% header area`).toBe('settings-header');
      expect(header.get('height'), `${zoom}% header height`).toBe('var(--app-page-header-h)');
      expect(layout.get('grid-area'), `${zoom}% body area`).toBe('settings-body');
      expect(layout.get('grid-template-columns'), `${zoom}% inner columns`).toBe(
        '220px minmax(0, 1fr)'
      );
      expect(layout.get('grid-template-rows'), `${zoom}% inner rows`).toBe('minmax(0, 1fr)');
      expect(layout.get('height'), `${zoom}% body height`).toBe('100%');
      expect(nav.get('display'), `${zoom}% category display`).toBe('flex');
      expect(nav.get('grid-area'), `${zoom}% category area`).toBe('settings-categories');
      expect(nav.get('flex-direction'), `${zoom}% category direction`).toBe('column');
      expect(nav.get('max-width'), `${zoom}% category width`).toBe('220px');
      expect(nav.get('height'), `${zoom}% category height`).toBe('100%');
      expect(nav.get('max-height'), `${zoom}% category max height`).toBe('none');
      expect(nav.get('overflow-x'), `${zoom}% category horizontal overflow`).toBe('hidden');
      expect(nav.get('overflow-y'), `${zoom}% category vertical overflow`).toBe('auto');
      expect(content.get('grid-area'), `${zoom}% panel area`).toBe('settings-panel');
      expect(content.get('width'), `${zoom}% panel width`).toBe('100%');
      expect(content.get('max-width'), `${zoom}% panel max width`).toBe('none');
      expect(content.get('margin'), `${zoom}% panel margin`).toBe('0');
      expect(content.get('height'), `${zoom}% panel height`).toBe('100%');
      expect(content.get('overflow-y'), `${zoom}% panel scroll`).toBe('auto');
    }

    for (const zoom of [125, 150, 175, 200]) {
      const page = finalCascadeDeclarations('.desktop-settings-page', zoom);
      const header = finalCascadeDeclarations('.desktop-settings-header', zoom);
      const layout = finalCascadeDeclarations('.desktop-settings-layout', zoom);
      const nav = finalCascadeDeclarations('.desktop-settings-nav', zoom);
      const picker = finalCascadeDeclarations('.desktop-settings-category-picker', zoom);
      const content = finalCascadeDeclarations('.desktop-settings-content', zoom);

      expect(page.get('grid-template-rows'), `${zoom}% page rows`).toBe(
        'var(--app-page-header-h) minmax(0, 1fr)'
      );
      expect(header.get('height'), `${zoom}% header height`).toBe('var(--app-page-header-h)');
      expect(layout.get('grid-template-columns'), `${zoom}% inner columns`).toBe(
        'minmax(0, 1fr)'
      );
      expect(layout.get('grid-template-rows'), `${zoom}% inner rows`).toBe(
        'auto minmax(0, 1fr)'
      );
      expect(nav.get('display'), `${zoom}% tablist display`).toBe('none');
      expect(nav.get('overflow-x'), `${zoom}% category horizontal overflow`).toBe('hidden');
      expect(nav.get('overflow-y'), `${zoom}% category vertical overflow`).toBe('hidden');
      expect(picker.get('display'), `${zoom}% picker display`).toBe('grid');
      expect(picker.get('grid-template-columns'), `${zoom}% picker columns`).toBe(
        'auto minmax(0, 1fr)'
      );
      expect(content.get('grid-area'), `${zoom}% panel area`).toBe('settings-panel');
      expect(content.get('overflow-y'), `${zoom}% panel scroll`).toBe('auto');
    }
  });

  it('keeps a left-aligned 820px content measure and the 15/14/12 readable Windows type rhythm', () => {
    const title = declarations('.desktop-settings-title');
    const subtitle = declarations('.desktop-settings-subtitle');
    const section = declarations('.desktop-settings-section');
    const label = declarations('.desktop-setting-copy :is(label, .desktop-setting-label)');
    const description = declarations(
      ':is(.desktop-setting-copy p, .desktop-setting-description)'
    );
    const row = declarations(':is(.desktop-setting-row, .desktop-setting-link-row)');
    const control = declarations('.desktop-setting-select');
    const status = declarations('.desktop-setting-status');

    expect(title.get('font-size')).toBe('var(--desktop-type-page-title)');
    expect(title.get('font-weight')).toBe('600');
    expect(subtitle.get('font-size')).toBe('14px');
    expect(section.get('max-width')).toBe('820px');
    expect(section.get('margin')).toBe('0');
    expect(label.get('font-size')).toBe('15px');
    expect(description.get('font-size')).toBe('14px');
    expect(status.get('font-size')).toBe('13px');
    expect(row.get('min-height')).toBe('80px');
    expect(control.get('font-size')).toBe('14px');
    expect(control.get('height')).toBe('var(--desktop-control-height)');
    expect(control.get('min-height')).toBe('var(--desktop-control-height)');
    expect(flagshipSource).toContain('--desktop-control-height: 40px');
  });

  it('matches the notice-library page rhythm without manufacturing settings content', () => {
    const page = settingsModuleRootDeclarations(
      '.integrityRoot:global(.desktop-settings-page)',
      '[data-settings-category]'
    );
    const content = settingsModuleRootDeclarations(
      '.integrityRoot:global(.desktop-settings-page)',
      '[data-settings-category]',
      '.desktop-settings-content'
    );
    const section = settingsModuleRootDeclarations(
      '.integrityRoot:global(.desktop-settings-page)',
      '[data-settings-category]',
      '.desktop-settings-section)'
    );
    const heading = settingsModuleRootDeclarations(
      '.integrityRoot:global(.desktop-settings-page)',
      '[data-settings-category]',
      '.desktop-settings-section-heading'
    );
    const group = settingsModuleRootDeclarations(
      '.integrityRoot:global(.desktop-settings-page)',
      '[data-settings-category]',
      '.desktop-settings-group)'
    );
    const header = settingsModuleRootDeclarations(
      '.integrityRoot:global(.desktop-settings-page)',
      '[data-settings-category]',
      '.desktop-settings-header'
    );
    const layout = settingsModuleRootDeclarations(
      '.integrityRoot:global(.desktop-settings-page)',
      '[data-settings-category]',
      '.desktop-settings-layout'
    );
    const navItem = settingsModuleRootDeclarations(
      '.integrityRoot:global(.desktop-settings-page)',
      '[data-settings-category]',
      '.desktop-settings-nav-item'
    );
    const row = settingsModuleRootDeclarations(
      '.integrityRoot:global(.desktop-settings-page)',
      '[data-settings-category]',
      '.desktop-setting-row'
    );
    const control = settingsModuleRootDeclarations(
      '.integrityRoot:global(.desktop-settings-page)',
      '[data-settings-category]',
      '.desktop-setting-select'
    );
    const identityIcon = settingsModuleRootDeclarations(
      '.integrityRoot:global(.desktop-settings-page)',
      '[data-settings-category]',
      '.desktop-settings-section-icon',
      '.desktop-setting-leading-icon',
      '.desktop-settings-paused-icon))'
    );

    expect(page.get('row-gap')).toBe('20px');
    expect(content.get('background')).toBe('var(--so-canvas, #f5f6f7)');
    expect(section.get('width')).toBe('min(100%, 820px)');
    expect(section.get('max-width')).toBe('820px');
    expect(section.get('margin')).toBe('0');
    expect(section.get('gap')).toBe('20px');
    expect(heading.get('margin')).toBe('0');
    expect(group.get('margin-top')).toBe('0');
    expect(header.get('height')).toBe('var(--app-page-header-h, 88px)');
    expect(header.get('padding')).toBe('14px 20px');
    expect(header.get('border-radius')).toBe('12px');
    expect(layout.get('border-radius')).toBe('var(--product-radius-panel, 12px)');
    expect(layout.get('box-shadow')).toBe('none');
    expect(navItem.get('height')).toBe('48px');
    expect(navItem.get('flex-basis')).toBe('48px');
    expect(navItem.get('border-radius')).toBe('10px');
    expect(row.get('min-height')).toBe('72px');
    expect(row.get('padding')).toBe('14px 20px');
    expect(control.get('height')).toBe('48px');
    expect(control.get('border-radius')).toBe('10px');
    expect(identityIcon.get('width')).toBe('44px');
    expect(identityIcon.get('height')).toBe('44px');
    expect(identityIcon.get('flex')).toBe('0 0 44px');
    expect(identityIcon.get('align-self')).toBe('flex-start');
  });

  it('keeps stacked appearance preferences on the left reading edge', () => {
    const stacked = settingsModuleRootDeclarations(
      '.integrityRoot',
      '.desktop-setting-row--stacked'
    );
    const copy = settingsModuleRootDeclarations(
      '.integrityRoot',
      '.desktop-setting-row--stacked > .desktop-setting-copy'
    );
    const compactControl = settingsModuleRootDeclarations(
      '.integrityRoot',
      '.desktop-setting-row--stacked > .desktop-setting-segmented:not(.desktop-theme-options)'
    );
    const saveState = settingsModuleRootDeclarations(
      '.integrityRoot',
      '.desktop-setting-row--stacked > .desktop-theme-save-state'
    );

    expect(settingsSource.match(/desktop-setting-row desktop-setting-row--stacked/g)).toHaveLength(2);
    expect(stacked.get('align-items')).toBe('flex-start');
    expect(stacked.get('justify-items')).toBe('start');
    expect(stacked.get('text-align')).toBe('left');
    expect(copy.get('width')).toBe('100%');
    expect(copy.get('align-self')).toBe('stretch');
    expect(copy.get('text-align')).toBe('left');
    expect(compactControl.get('align-self')).toBe('flex-start');
    expect(compactControl.get('justify-self')).toBe('start');
    expect(compactControl.get('margin-inline')).toBe('0');
    expect(saveState.get('align-self')).toBe('flex-start');
    expect(saveState.get('justify-self')).toBe('start');
  });

  it('uses the real SeekOffer brand mark and retains a compact 200% layout', () => {
    expect(settingsSource).toContain('src="/desktop/seekoffer-mark.png"');
    expect(settingsSource).toContain('className="desktop-settings-about-logo"');

    const header = declarations('.desktop-settings-header', true);
    const layout = declarations('.desktop-settings-layout', true);
    const nav = declarations('.desktop-settings-nav', true);
    expect(header.get('min-height')).toBe('60px');
    expect(layout.get('height')).toBe('100%');
    expect(layout.get('grid-template-columns')).toBe('minmax(0, 1fr)');
    expect(layout.get('grid-template-rows')).toBe('48px minmax(0, 1fr)');
    expect(nav.get('overflow-x')).toBe('auto');
    expect(nav.get('overflow-y')).toBe('hidden');
  });
});
