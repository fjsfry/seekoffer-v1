import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import postcss from 'postcss';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');

type CascadedDeclaration = {
  important: boolean;
  order: number;
  specificity: number;
  value: string;
};

async function loadDesktopCascade() {
  const layoutSource = await readFile(resolve(projectRoot, 'app/build-surface.desktop.tsx'), 'utf8');
  const importedFiles = [
    ...layoutSource.matchAll(/import ['"]\.\/(desktop[^'"]*\.css)['"];?/g)
  ].map((match) => match[1]);
  const sources = await Promise.all(
    importedFiles.map((file) => readFile(resolve(projectRoot, 'app', file), 'utf8'))
  );

  return {
    css: sources.join('\n'),
    importedFiles
  };
}

function getSelectorSpecificity(selector: string) {
  const idCount = selector.match(/#[\w-]+/g)?.length || 0;
  const classLikeCount = selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g)?.length || 0;
  return idCount * 10_000 + classLikeCount * 100;
}

function getCascadedDeclarations(css: string, matchingSelectors: string[]) {
  const declarations = new Map<string, CascadedDeclaration>();
  const selectorSet = new Set(matchingSelectors);
  let order = 0;

  postcss.parse(css).walkRules((rule) => {
    const matchedSelector = rule.selectors.find((selector) => selectorSet.has(selector));
    if (!matchedSelector) return;
    const specificity = getSelectorSpecificity(matchedSelector);

    rule.walkDecls((declaration) => {
      order += 1;
      const current = declarations.get(declaration.prop);
      const winsCascade =
        !current ||
        (declaration.important && !current.important) ||
        (declaration.important === current.important && specificity > current.specificity) ||
        (declaration.important === current.important &&
          specificity === current.specificity &&
          order > current.order);

      if (winsCascade) {
        declarations.set(declaration.prop, {
          important: declaration.important,
          order,
          specificity,
          value: declaration.value
        });
      }
    });
  });

  return new Map(
    [...declarations].map(([property, declaration]) => [property, declaration.value])
  );
}

function inspectWorkbenchJsxHierarchy(source: string) {
  const sourceFile = ts.createSourceFile(
    'desktop-home.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let bodyCount = 0;
  let inlineActionsCount = 0;
  let inlineActionsInsideBody = false;

  function getClassName(node: ts.Node) {
    const attributes = ts.isJsxElement(node)
      ? node.openingElement.attributes
      : ts.isJsxSelfClosingElement(node)
        ? node.attributes
        : undefined;
    if (!attributes) return '';
    const classNameAttribute = attributes.properties.find(
      (attribute): attribute is ts.JsxAttribute =>
        ts.isJsxAttribute(attribute) &&
        ts.isIdentifier(attribute.name) &&
        attribute.name.text === 'className'
    );
    return classNameAttribute?.initializer && ts.isStringLiteral(classNameAttribute.initializer)
      ? classNameAttribute.initializer.text
      : '';
  }

  function visit(node: ts.Node, insideBody: boolean) {
    const className = getClassName(node);
    const classNames = className.split(/\s+/).filter(Boolean);
    const isBody = classNames.includes('desktop-project-workspace-body');
    const nextInsideBody = insideBody || isBody;
    if (isBody) bodyCount += 1;
    if (classNames.includes('desktop-project-workspace-inline-actions')) {
      inlineActionsCount += 1;
      inlineActionsInsideBody = inlineActionsInsideBody || nextInsideBody;
    }
    ts.forEachChild(node, (child) => visit(child, nextInsideBody));
  }

  visit(sourceFile, false);
  return { bodyCount, inlineActionsCount, inlineActionsInsideBody };
}

describe('desktop workbench scrolling contract', () => {
  it('gives the two-column workspace a bounded row instead of content-sized grid items', async () => {
    const { css, importedFiles } = await loadDesktopCascade();
    const layout = getCascadedDeclarations(css, [
      '.desktop-workbench-layout',
      '.desktop-qq-workbench-layout',
      '.desktop-app-shell .desktop-qq-workbench-layout'
    ]);

    expect(importedFiles.at(-1)).toBe('desktop-app-coherence.css');
    expect(importedFiles.filter((file) => file === 'desktop-app-coherence.css')).toHaveLength(1);
    expect(new Set(importedFiles).size).toBe(importedFiles.length);
    expect(layout.get('height')).toBe('100%');
    expect(layout.get('min-height')).toBe('0');
    expect(layout.get('grid-template-rows')).toBe('minmax(0, 1fr)');
    expect(layout.get('align-items')).toBe('stretch');
    expect(layout.get('overflow')).toBe('hidden');
  });

  it('keeps list and detail scrolling independent while their fixed headers stay outside', async () => {
    const { css } = await loadDesktopCascade();
    const list = getCascadedDeclarations(css, [
      '.desktop-project-table-body',
      '.desktop-application-object-list .desktop-project-table-body',
      '.desktop-app-shell .desktop-application-object-list .desktop-project-table-body'
    ]);
    const detail = getCascadedDeclarations(css, [
      '.desktop-project-workspace-body',
      '.desktop-app-shell .desktop-project-workspace-body'
    ]);
    const listHeader = getCascadedDeclarations(css, [
      '.desktop-application-context-header',
      '.desktop-app-shell .desktop-application-context-header'
    ]);
    const listToolbar = getCascadedDeclarations(css, [
      '.desktop-application-context-toolbar',
      '.desktop-app-shell .desktop-application-context-toolbar'
    ]);
    const detailHeader = getCascadedDeclarations(css, [
      '.desktop-project-workspace-header',
      '.desktop-app-shell .desktop-project-workspace-header'
    ]);
    const detailTabs = getCascadedDeclarations(css, [
      '.desktop-project-workspace-tabs',
      '.desktop-app-shell .desktop-project-workspace-tabs'
    ]);

    expect(list.get('overflow-y')).toBe('auto');
    expect(list.get('overscroll-behavior')).toBe('contain');
    expect(detail.get('overflow-y')).toBe('auto');
    expect(detail.get('overscroll-behavior')).toBe('contain');
    expect(detail.get('min-height')).toBe('0');
    expect(listHeader.get('flex')).toBe('0 0 auto');
    expect(listToolbar.get('flex')).toBe('0 0 auto');
    expect(detailHeader.get('flex')).toBe('0 0 auto');
    expect(detailTabs.get('flex')).toBe('0 0 auto');
  });

  it('aligns both panes and keeps auxiliary actions inside the detail scroller', async () => {
    const { css } = await loadDesktopCascade();
    const homeSource = await readFile(
      resolve(projectRoot, 'components/desktop-home.tsx'),
      'utf8'
    );
    const inlineActions = getCascadedDeclarations(css, [
      '.desktop-app-shell .desktop-project-workspace-inline-actions'
    ]);
    const inlineActionControls = getCascadedDeclarations(css, [
      '.desktop-app-shell .desktop-project-workspace-inline-actions :is(a, button)'
    ]);
    const shell = getCascadedDeclarations(css, ['.desktop-app-shell']);
    const alignedMaster = getCascadedDeclarations(css, [
      ".desktop-app-shell .desktop-qq-workbench:is([data-layout-mode='wide'], [data-layout-mode='split']) .desktop-qq-workbench-layout > .desktop-application-context"
    ]);
    const alignedDetail = getCascadedDeclarations(css, [
      ".desktop-app-shell .desktop-qq-workbench:is([data-layout-mode='wide'], [data-layout-mode='split']) .desktop-qq-workbench-layout > .desktop-project-workspace",
      ".desktop-app-shell .desktop-qq-workbench:is([data-layout-mode='wide'], [data-layout-mode='split']) .desktop-project-workspace"
    ]);
    const drawerDetail = getCascadedDeclarations(css, [
      ".desktop-app-shell .desktop-qq-workbench[data-layout-mode='drawer'] .desktop-project-workspace",
      ".desktop-app-shell:is(.desktop-app-shell) .desktop-qq-workbench[data-layout-mode='drawer'] .desktop-project-workspace"
    ]);
    const hierarchy = inspectWorkbenchJsxHierarchy(homeSource);

    expect(homeSource).not.toContain('desktop-project-workspace-footer');
    expect(hierarchy).toEqual({
      bodyCount: 1,
      inlineActionsCount: 1,
      inlineActionsInsideBody: true
    });
    expect(homeSource).toContain('aria-label="项目辅助操作"');
    expect(inlineActions.get('display')).toBe('flex');
    expect(inlineActions.get('flex-wrap')).toBe('wrap');
    expect(inlineActions.get('margin-top')).toBe('20px');
    expect(inlineActions.get('background')).toBe('transparent');
    expect(shell.get('--desktop-control-height')).toBe('40px');
    expect(inlineActionControls.get('min-height')).toBe('var(--desktop-control-height)');
    expect(alignedMaster.get('height')).toBe('100%');
    expect(alignedMaster.get('align-self')).toBe('stretch');
    expect(alignedDetail.get('height')).toBe('100%');
    expect(alignedDetail.get('align-self')).toBe('stretch');
    expect(alignedDetail.get('position')).toBe('relative');
    expect(alignedDetail.get('top')).toBe('auto');
    expect(alignedDetail.get('right')).toBe('auto');
    expect(alignedDetail.get('bottom')).toBe('auto');
    expect(alignedDetail.get('left')).toBe('auto');
    expect(alignedDetail.get('width')).toBe('auto');
    expect(alignedDetail.get('overflow')).toBe('hidden');
    expect(alignedDetail.get('visibility')).toBe('visible');
    expect(alignedDetail.get('transform')).toBe('none');
    expect(alignedDetail.get('pointer-events')).toBe('auto');
    expect(drawerDetail.get('position')).toBe('absolute');
    expect(drawerDetail.get('top')).toBe('0');
    expect(drawerDetail.get('right')).toBe('0');
    expect(drawerDetail.get('bottom')).toBe('0');
    expect(drawerDetail.get('left')).toBe('auto');
    expect(drawerDetail.get('width')).toContain('--desktop-zoom-drawer-width');
    expect(drawerDetail.get('height')).toBe('100%');
    expect(drawerDetail.get('max-height')).toBe('100%');
  });

  it('uses a QQ-style left rail with one flagship work surface', async () => {
    const { css } = await loadDesktopCascade();
    const shellSource = await readFile(
      resolve(projectRoot, 'components/desktop-app-shell.tsx'),
      'utf8'
    );
    const shell = getCascadedDeclarations(css, ['.desktop-app-shell']);
    const brand = getCascadedDeclarations(css, [
      '.desktop-titlebar-brand',
      '.desktop-app-shell .desktop-titlebar-brand'
    ]);
    const topbar = getCascadedDeclarations(css, [
      '.desktop-topbar',
      '.desktop-app-shell .desktop-topbar'
    ]);
    const rail = getCascadedDeclarations(css, [
      '.desktop-primary-rail',
      '.desktop-app-shell .desktop-primary-rail'
    ]);
    const navList = getCascadedDeclarations(css, [
      '.desktop-nav-list--primary',
      '.desktop-app-shell .desktop-nav-list--primary'
    ]);
    const content = getCascadedDeclarations(css, [
      '.desktop-content-region',
      '.desktop-app-shell .desktop-content-region'
    ]);

    expect(shell.get('--desktop-rail-width')).toBe('var(--so-rail-w)');
    expect(shell.get('grid-template-columns')).toBe(
      'var(--so-rail-w) minmax(0, 1fr)'
    );
    expect(shellSource.match(/className="desktop-topbar desktop-titlebar\b/g) ?? []).toHaveLength(1);
    expect(shellSource.match(/className="desktop-titlebar-brand"/g) ?? []).toHaveLength(1);
    expect(shellSource).not.toContain('desktop-brand-header');
    expect(brand.get('width')).toBe('230px');
    expect(brand.get('flex')).toBe('0 0 230px');
    expect(topbar.get('grid-column')).toBe('1 / 3');
    expect(rail.get('position')).toBe('relative');
    expect(rail.get('grid-column')).toBe('1');
    expect(rail.get('grid-row')).toBe('2');
    expect(rail.get('flex-direction')).toBe('column');
    expect(navList.get('flex-direction')).toBe('column');
    expect(content.get('grid-column')).toBe('2');
    expect(content.get('grid-row')).toBe('2');
  });
});
