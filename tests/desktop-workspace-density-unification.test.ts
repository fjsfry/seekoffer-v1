import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const cssPath = resolve(root, 'components/desktop-workspace.module.css');
const cssSource = readFileSync(cssPath, 'utf8');
const scheduleSource = readFileSync(resolve(root, 'components/desktop-schedule-workspace.tsx'), 'utf8');
const stylesheet = postcss.parse(cssSource, { from: cssPath });

function declarations(rule: Rule | undefined) {
  const values = new Map<string, string>();
  rule?.walkDecls((declaration: Declaration) => {
    values.set(declaration.prop, declaration.value.trim());
  });
  return values;
}

function normalizeSelector(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function lastRule(fragment: string, property?: string) {
  let match: Rule | undefined;
  stylesheet.walkRules((rule) => {
    if (!rule.selectors.some((selector) => normalizeSelector(selector).includes(fragment))) return;
    if (property && !rule.nodes.some((node) => node.type === 'decl' && node.prop === property)) return;
    match = rule;
  });
  return match;
}

function lastRootRule(selectorValue: string, property?: string) {
  let match: Rule | undefined;
  stylesheet.walkRules((rule) => {
    if (rule.parent?.type !== 'root') return;
    if (!rule.selectors.some((selector) => normalizeSelector(selector) === selectorValue)) return;
    if (property && !rule.nodes.some((node) => node.type === 'decl' && node.prop === property)) return;
    match = rule;
  });
  return match;
}

function containerRule(params: string, fragment: string, property?: string) {
  let match: Rule | undefined;
  stylesheet.walkAtRules('container', (rule) => {
    if (rule.params !== params) return;
    rule.walkRules((candidate) => {
      if (!candidate.selectors.some((selector) => normalizeSelector(selector).endsWith(fragment))) return;
      if (property && !candidate.nodes.some((node) => node.type === 'decl' && node.prop === property)) return;
      match = candidate;
    });
  });
  return match;
}

describe('desktop schedule and mentor density unification', () => {
  it('uses a two-tier wide schedule toolbar without overriding accessibility zoom layouts', () => {
    const wideToolbar = declarations(
      containerRule(
        'schedule-workspace-page (min-width: 1080px)',
        ".workspace[data-detail-open='false'] .masterToolbar",
        'grid-template-columns'
      )
    );
    const wideTop = declarations(
      containerRule(
        'schedule-workspace-page (min-width: 1080px)',
        ".workspace[data-detail-open='false'] .scheduleToolbarTop",
        'display'
      )
    );
    const wideCategories = declarations(
      containerRule(
        'schedule-workspace-page (min-width: 1080px)',
        ".workspace[data-detail-open='false'] .categoryFilterBar",
        'grid-row'
      )
    );

    expect(wideToolbar.get('grid-template-columns')).toContain('minmax(300px, 1.05fr)');
    expect(wideToolbar.get('grid-template-columns')).toContain('minmax(220px, .75fr)');
    expect(wideToolbar.get('row-gap')).toBe('10px');
    expect(wideTop.get('display')).toBe('contents');
    expect(wideCategories.get('grid-row')).toBe('2');

    expect(cssSource).toContain('@container schedule-workspace-page (max-width: 1120px)');
    expect(cssSource).toContain("data-zoom-level='150'");
    expect(cssSource).toContain("data-zoom-level='175'");
    expect(cssSource).toContain("data-zoom-level='200'");
    expect(cssSource).toMatch(
      /data-zoom-level='200'[\s\S]*?\.schedulePage \.workspace\[data-detail-open='false'\] \.masterToolbar\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/
    );
  });

  it('uses grouped scan-first agenda rows with a dedicated action column', () => {
    const row = declarations(lastRule('.schedulePage .workspace .scheduleListRow'));
    const title = declarations(lastRule('.schedulePage .scheduleListRow .rowTitle'));
    const group = declarations(lastRule('.schedulePage .listGroupTitle', 'min-height'));
    const groupGap = declarations(lastRule('.schedulePage .masterScroll > section + section'));

    expect(row.get('min-height')).toBe('112px');
    expect(row.get('padding')).toBe('14px 16px');
    expect(row.get('align-items')).toBe('center');
    expect(row.get('border-radius')).toBe('0');
    expect(row.get('grid-template-columns')).toContain('48px 104px');
    expect(title.get('font-size')).toBe('17px');
    expect(title.get('line-height')).toBe('26px');
    expect(group.get('min-height')).toBe('40px');
    expect(group.get('padding')).toBe('6px 6px 6px 10px');
    expect(groupGap.get('margin-top')).toBe('12px');

    const actionArea = declarations(lastRootRule('.schedulePage .scheduleListRow .rowEnd', 'border-left'));
    const quickAction = declarations(lastRootRule('.schedulePage .scheduleListRow .inlineQuickAction', 'width'));
    expect(actionArea.get('grid-template-columns')).toBe('minmax(0, 1fr) 92px');
    expect(actionArea.get('grid-template-rows')).toBe('repeat(2, minmax(28px, auto))');
    expect(actionArea.get('padding')).toBe('0 0 0 18px');
    expect(actionArea.get('border-left')).toBe('1px solid var(--schedule-border)');
    expect(quickAction.get('width')).toBe('92px');
    expect(quickAction.get('min-height')).toBe('40px');
    expect(cssSource).toContain('.scheduleGroupRows');
    expect(cssSource).toContain('@container schedule-workspace-page (max-width: 900px)');
  });

  it('adds a real summary rail and only exposes implemented quick actions', () => {
    expect(scheduleSource).toContain('allItems: DesktopScheduleItem[];');
    expect(scheduleSource).toContain('className={styles.scheduleSummaryRail}');
    expect(scheduleSource).toContain('今日安排');
    expect(scheduleSource).toContain('待安排');
    expect(scheduleSource).toContain('只看未完成');
    expect(scheduleSource).toContain('清空筛选');
    expect(scheduleSource).not.toContain('批量导入');
    expect(scheduleSource).not.toContain('模板库');
    expect(scheduleSource).not.toContain('拖拽可快速调整日程顺序');
    expect(cssSource).toMatch(/\.scheduleContentGrid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 304px/);
    expect(cssSource).toContain('@container schedule-workspace-page (max-width: 1079px)');
    expect(cssSource).toMatch(
      /Narrow-window schedule resilience authority[\s\S]*?max-width:\s*1079px[\s\S]*?\.scheduleSummaryRail\s*\{[^}]*display:\s*none !important/
    );
  });

  it('uses a bounded three-band agenda row in narrow windows', () => {
    const authority = cssSource.slice(cssSource.indexOf('Narrow-window schedule resilience authority'));
    expect(authority).toMatch(
      /max-width:\s*700px[\s\S]*?\.scheduleListRow\s*\{[^}]*grid-template-columns:\s*44px minmax\(0, 1fr\) !important[^}]*grid-template-rows:\s*auto auto auto !important/
    );
    expect(authority).toMatch(
      /\.scheduleListRow \.rowBody\s*\{[^}]*grid-column:\s*1 \/ -1 !important[^}]*grid-row:\s*2 !important/
    );
    expect(authority).toMatch(
      /\.scheduleListRow \.rowEnd\s*\{[^}]*width:\s*100% !important[^}]*grid-column:\s*1 \/ -1 !important[^}]*grid-row:\s*3 !important[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 92px !important/
    );
  });

  it('gives mentor cards and inline actions the notice-library scale', () => {
    const inlineControl = declarations(lastRule('.contactInlineDate', 'min-height'));
    const contactRow = declarations(lastRootRule('.contactsPage .contactListRow', 'min-height'));
    const contactAvatar = declarations(lastRootRule('.contactsPage .contactAvatar', 'width'));

    expect(inlineControl.get('min-height')).toBe('40px');
    expect(inlineControl.get('padding')).toBe('8px 12px');
    expect(inlineControl.get('font-size')).toBe('14px');
    expect(inlineControl.get('line-height')).toBe('22px');
    expect(contactRow.get('min-height')).toBe('148px');
    expect(contactRow.get('padding')).toBe('20px');
    expect(contactRow.get('border-radius')).toBe('18px');
    expect(contactRow.get('grid-template-columns')).toContain('88px');
    expect(contactRow.get('align-items')).toBe('start');
    expect(contactAvatar.get('width')).toBe('88px');
    expect(contactAvatar.get('height')).toBe('88px');
    expect(contactAvatar.get('align-self')).toBe('start');
  });

  it('locks both workspaces to the shared 88px header and framed tool/empty surfaces', () => {
    const header = declarations(lastRule(':is(.schedulePage, .contactsPage) .pageHeader'));
    const toolbarGeometry = declarations(
      lastRule(':is(.schedulePage, .contactsPage) .masterToolbar', 'padding')
    );
    const toolbarSurface = declarations(
      lastRule(':is(.schedulePage, .contactsPage) .masterToolbar', 'border-radius')
    );
    const emptySurface = declarations(lastRule('desktop-contacts-empty', 'min-height'));

    expect(header.get('min-height')).toBe('88px');
    expect(header.get('padding')).toBe('12px 20px');
    expect(toolbarGeometry.get('padding')).toBe('14px 20px');
    expect(toolbarSurface.get('border-radius')).toBe('var(--product-radius-panel, 12px)');
    expect(toolbarSurface.get('box-shadow')).toBe('none');
    expect(emptySurface.get('min-height')).toBe('220px');
    expect(emptySurface.get('padding')).toBe('24px 20px');
    expect(emptySurface.get('border-radius')).toBe('18px');

    expect(cssSource).toContain('.schedulePage:global(#schedule-board)');
    expect(cssSource).toContain('.contactsPage:global(#contacts-board)');

    expect(cssSource).toMatch(/data-zoom-level='150'[\s\S]*?\.schedulePage[\s\S]*?\.scheduleListRow/);
    expect(cssSource).toMatch(/data-zoom-level='200'[\s\S]*?\.contactsPage[\s\S]*?\.contactListRow/);
  });
});
