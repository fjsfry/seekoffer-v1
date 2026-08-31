import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type AtRule, type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';
import { DESKTOP_WORKBENCH_MIN_RIGHT_WIDTH } from '@/lib/desktop-workbench-splitter';

const root = resolve(import.meta.dirname, '..');
const cssPath = resolve(root, 'app/desktop-app-coherence.css');
const cssSource = readFileSync(cssPath, 'utf8');
const homeSource = readFileSync(resolve(root, 'components/desktop-home.tsx'), 'utf8');
const stylesheet = postcss.parse(cssSource, { from: cssPath });

function declarationsForRule(selectorFragment: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (rule.parent?.type !== 'root') return;
    if (!rule.selectors.some((selector) => selector.includes(selectorFragment))) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

function declarationsForRuleEnding(selectorSuffix: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (rule.parent?.type !== 'root') return;
    if (!rule.selectors.some((selector) => selector.trim().endsWith(selectorSuffix))) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

function getContainer(params: string) {
  let match: AtRule | null = null;
  stylesheet.walkAtRules('container', (rule: AtRule) => {
    if (rule.params === params) match = rule;
  });
  return match;
}

function declarationsInside(container: AtRule, ...selectorFragments: string[]) {
  const values = new Map<string, string>();
  container.walkRules((rule: Rule) => {
    if (!rule.selectors.some((selector) =>
      selectorFragments.every((fragment) => selector.includes(fragment)))) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

function declarationsInsideEnding(container: AtRule, selectorSuffix: string) {
  const values = new Map<string, string>();
  container.walkRules((rule: Rule) => {
    if (!rule.selectors.some((selector) => selector.trim().endsWith(selectorSuffix))) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

describe('resizable project detail container', () => {
  it('measures the project detail pane itself instead of the browser viewport', () => {
    const workspace = declarationsForRule('.desktop-project-workspace');
    expect(workspace.get('container-type')).toBe('inline-size');
    expect(workspace.get('container-name')).toBe('project-workspace');
    expect(DESKTOP_WORKBENCH_MIN_RIGHT_WIDTH).toBe(560);
    expect(getContainer('project-workspace (max-width: 720px)')).not.toBeNull();
    expect(getContainer('project-workspace (max-width: 620px)')).not.toBeNull();
    expect(getContainer('project-workspace (max-width: 420px)')).not.toBeNull();
  });

  it('uses one compact two-line summary rhythm at every pane width', () => {
    const card = declarationsForRuleEnding('.desktop-project-overview-card');
    const label = declarationsForRule('.desktop-project-overview-card > span');
    const select = declarationsForRule('.desktop-project-overview-card select');
    const progress = declarationsForRule('.desktop-project-workspace-progress');

    expect(card.get('min-height')).toBe('64px');
    expect(card.get('grid-template-columns')).toBe('minmax(0, 1fr)');
    expect(card.get('grid-template-rows')).toBe('18px 30px');
    expect(card.get('row-gap')).toBe('2px');
    expect(card.get('padding')).toBe('6px 12px');
    expect(label.get('grid-column')).toBe('1 / -1');
    expect(label.get('white-space')).toBe('nowrap');
    expect(select.get('width')).toBe('min(100%, 140px)');
    expect(select.get('min-width')).toBe('108px');
    expect(select.get('height')).toBe('32px');
    expect(select.get('min-height')).toBe('32px');
    expect(select.get('padding')).toBe('0 26px 0 10px');
    expect(select.has('text-overflow')).toBe(false);
    expect(progress.get('width')).toBe('auto');
    expect(progress.get('min-width')).toBe('32px');
    expect(progress.get('max-width')).toBe('64px');
    expect(progress.get('flex')).toBe('1 1 48px');
    expect(progress.get('margin')).toBe('0');
    expect(homeSource.match(/className="desktop-project-overview-value-row"/g)).toHaveLength(4);
    expect(homeSource).toContain('<time dateTime={selectedRow.project.deadlineDate || undefined}>');
  });

  it('moves the next action below its copy and turns four cramped metrics into two columns', () => {
    const container = getContainer('project-workspace (max-width: 720px)');
    expect(container).not.toBeNull();
    const nextAction = declarationsInside(container!, '.desktop-project-next-action');
    const command = declarationsInside(container!, '.desktop-project-next-action-command');
    const overview = declarationsInside(container!, '.desktop-project-overview-grid');
    const card = declarationsInsideEnding(container!, '.desktop-project-overview-card');
    const cardText = declarationsInside(container!, '.desktop-project-overview-card', 'strong');
    const select = declarationsInside(container!, '.desktop-project-overview-card', 'select');

    expect(nextAction.get('grid-template-columns')).toBe('36px minmax(0, 1fr)');
    expect(nextAction.get('align-items')).toBe('start');
    expect(nextAction.get('padding')).toBe('14px');
    expect(command.get('grid-column')).toBe('2');
    expect(command.get('justify-self')).toBe('start');
    expect(command.get('max-width')).toBe('100%');
    expect(overview.get('grid-template-columns')).toBe('repeat(2, minmax(0, 1fr))');
    expect(card.get('min-height')).toBe('64px');
    expect(cardText.get('white-space')).toBe('nowrap');
    expect(cardText.get('text-overflow')).toBe('ellipsis');
    expect(select.get('width')).toBe('100%');
    expect(select.get('min-width')).toBe('0');
  });

  it('lets narrow headers and tabs grow without clipping project copy', () => {
    const container = getContainer('project-workspace (max-width: 620px)');
    expect(container).not.toBeNull();
    const header = declarationsInside(container!, '.desktop-project-workspace-header');
    const titleRow = declarationsInside(container!, '.desktop-project-workspace-title-row');
    const title = declarationsInside(container!, '.desktop-selected-project-title');
    const status = declarationsInside(container!, '.desktop-project-workspace-status');
    const tabs = declarationsInside(container!, '.desktop-project-workspace-tabs');
    const tab = declarationsInside(container!, '.desktop-project-workspace-tabs button');

    expect(header.get('height')).toBe('auto');
    expect(header.get('align-items')).toBe('flex-start');
    expect(titleRow.get('display')).toBe('grid');
    expect(titleRow.get('grid-template-columns')).toBe('minmax(0, 1fr)');
    expect(title.get('white-space')).toBe('normal');
    expect(title.get('overflow-wrap')).toBe('anywhere');
    expect(title.get('display')).toBe('block');
    expect(title.get('overflow')).toBe('visible');
    expect(title.get('text-overflow')).toBe('clip');
    expect(title.get('-webkit-line-clamp')).toBe('unset');
    expect(tabs.get('display')).toBe('grid');
    expect(tabs.get('grid-template-columns')).toBe('repeat(3, minmax(0, 1fr))');
    expect(tabs.get('overflow')).toBe('visible');
    expect(tab.get('white-space')).toBe('normal');
    expect(status.get('display')).toBe('none');
  });

  it('uses compact horizontal property rows only for genuinely narrow drawers', () => {
    const container = getContainer('project-workspace (max-width: 420px)');
    expect(container).not.toBeNull();
    const overview = declarationsInside(container!, '.desktop-project-overview-grid');
    const card = declarationsInsideEnding(container!, '.desktop-project-overview-card');
    const lastCard = declarationsInsideEnding(container!, '.desktop-project-overview-card:last-child');

    expect(overview.get('grid-template-columns')).toBe('minmax(0, 1fr)');
    expect(card.get('border-right')).toBe('0');
    expect(card.get('border-bottom')).toBe('1px solid var(--so-border)');
    expect(lastCard.get('border-bottom')).toBe('0');
    expect(card.get('min-height')).toBe('44px');
    expect(card.get('grid-template-columns')).toBe('96px minmax(0, 1fr)');
    expect(card.get('grid-template-rows')).toBe('44px');
  });

  it('moves every other resizable detail tab onto the same pane-width system', () => {
    const compact = getContainer('project-workspace (max-width: 720px)');
    const narrow = getContainer('project-workspace (max-width: 420px)');
    expect(compact).not.toBeNull();
    expect(narrow).not.toBeNull();
    const stage = declarationsInside(compact!, '.desktop-project-stage-line');
    const materials = declarationsInside(compact!, '.desktop-project-material-meta-grid');
    const mentorCard = declarationsInside(compact!, '.desktop-project-mentor-summary-list', 'article');
    const mentorMeta = declarationsInside(compact!, '.desktop-project-mentor-summary-meta');
    const narrowMaterials = declarationsInside(narrow!, '.desktop-project-material-meta-grid');
    const materialFrame = declarationsInside(narrow!, '.desktop-project-material-meta-card', 'header');
    const materialHint = declarationsInside(narrow!, '.desktop-project-material-meta-hint');

    expect(stage.get('grid-template-columns')).toBe('repeat(7, minmax(72px, 1fr))');
    expect(stage.get('overflow-x')).toBe('auto');
    expect(materials.get('grid-template-columns')).toBe('repeat(2, minmax(0, 1fr))');
    expect(mentorCard.get('flex-direction')).toBe('column');
    expect(mentorMeta.get('justify-content')).toBe('flex-start');
    expect(narrowMaterials.get('grid-template-columns')).toBe('minmax(0, 1fr)');
    expect(materialFrame.get('flex-direction')).toBe('column');
    expect(materialHint.get('margin-left')).toBe('0');
  });

  it('bounds drawer mode to the work stage so CSS zoom cannot clip its bottom edge', () => {
    const drawer = declarationsForRule("[data-layout-mode='drawer'] .desktop-project-workspace");
    const backdrop = declarationsForRule("[data-layout-mode='drawer'] .desktop-inspector-backdrop");

    expect(drawer.get('position')).toBe('absolute');
    expect(drawer.get('top')).toBe('0');
    expect(drawer.get('right')).toBe('0');
    expect(drawer.get('bottom')).toBe('0');
    expect(drawer.get('left')).toBe('auto');
    expect(drawer.get('width')).toContain('--desktop-zoom-drawer-width');
    expect(drawer.get('height')).toBe('100%');
    expect(drawer.get('max-height')).toBe('100%');
    expect(backdrop.get('position')).toBe('absolute');
    expect(backdrop.get('inset')).toBe('0');
    expect(backdrop.get('width')).toBe('100%');
    expect(backdrop.get('height')).toBe('100%');
  });

  it('keeps the pane-width response separate from the visual skin contract', () => {
    const start = cssSource.indexOf('/* Resizable project detail: respond to the pane itself');
    const end = cssSource.indexOf("html[data-desktop-reduce-motion='true']", start);
    const responsiveSource = cssSource.slice(start, end);
    expect(start).toBeGreaterThan(cssSource.indexOf('/* END FEISHU-INSPIRED SKIN ONLY'));
    expect(responsiveSource).toContain('@container project-workspace');
    expect(responsiveSource).not.toContain('@media');
  });

  it('does not delegate splitter-driven reflow to viewport media queries', () => {
    const protectedSelectors = [
      '.desktop-project-workspace-title-row',
      '.desktop-project-workspace-status',
      '.desktop-project-next-action',
      '.desktop-project-next-action-command',
      '.desktop-project-overview-grid',
      '.desktop-project-overview-card',
      '.desktop-project-material-meta-grid',
      '.desktop-project-stage-line',
      '.desktop-project-mentor-summary-list'
    ];
    const violations: string[] = [];
    stylesheet.walkAtRules('media', (rule: AtRule) => {
      if (!/(?:min|max)-width/i.test(rule.params)) return;
      rule.walkRules((child: Rule) => {
        if (protectedSelectors.some((selector) => child.selector.includes(selector))) {
          violations.push(`${rule.params}: ${child.selector}`);
        }
      });
    });
    expect(violations).toEqual([]);
  });

  it('keeps the semantic wrappers required for collision-free reflow', () => {
    expect(homeSource).toContain('className="desktop-project-workspace-title-row"');
    expect(homeSource).toContain('className="desktop-project-workspace-status"');
    expect(homeSource).toContain('className="desktop-project-next-action-command"');
  });
});
