import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type AtRule, type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const homeSource = readFileSync(resolve(root, 'components/desktop-home.tsx'), 'utf8');
const cssPath = resolve(root, 'app/desktop-app-coherence.css');
const cssSource = readFileSync(cssPath, 'utf8');
const noticeCss = readFileSync(resolve(root, 'app/desktop-notice-alignment.css'), 'utf8');
const marker = '/* FINAL NOTICE-LIBRARY PARITY AUTHORITY';
const start = cssSource.indexOf(marker);
const end = cssSource.indexOf('/* END FINAL NOTICE-LIBRARY PARITY AUTHORITY */', start);
const releaseCss = cssSource.slice(start, end);
const stylesheet = postcss.parse(releaseCss, { from: cssPath });

function declarationsFor(fragment: string, containerPattern?: RegExp) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.some((selector) => selector.includes(fragment))) return;
    if (containerPattern) {
      let parent: Rule | AtRule | undefined =
        rule.parent?.type === 'rule' || rule.parent?.type === 'atrule'
          ? rule.parent
          : undefined;
      let matched = false;
      while (parent) {
        if (parent.type === 'atrule' && parent.name === 'container' && containerPattern.test(parent.params)) {
          matched = true;
        }
        const nextParent = parent.parent;
        parent = nextParent?.type === 'rule' || nextParent?.type === 'atrule'
          ? nextParent
          : undefined;
      }
      if (!matched) return;
    } else {
      if (rule.parent?.type !== 'root') return;
      if (rule.selectors.some((selector) => selector.includes('data-zoom-level'))) return;
      if (rule.selectors.some((selector) => /data-density=['"]/.test(selector))) return;
    }
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value.replace(/\s*!important\s*$/, '').trim());
    });
  });
  return values;
}

describe('desktop application card responsive contract', () => {
  it('keeps all required information and the inline status control in the card DOM', () => {
    for (const className of [
      'desktop-application-object-copy',
      'desktop-application-object-status',
      'desktop-application-object-next-action',
      'desktop-application-object-card-deadline',
      'desktop-application-object-card-materials',
      'desktop-application-object-priority-cell',
      'desktop-application-object-project-meta',
      'desktop-application-object-project-title',
      'desktop-application-deadline-distance',
      'desktop-application-object-next-cta',
      'desktop-application-object-card-percent',
      'desktop-application-object-menu-trigger',
      'desktop-application-inline-status'
    ]) {
      expect(homeSource).toContain(className);
    }
    expect(homeSource).toContain('<select');
    expect(homeSource).toContain('{userStatusOptions.map((status) => (');
  });

  it('keeps school and college copy content-led inside a bounded notice-style card', () => {
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const row = declarationsFor('.desktop-application-object-row');
    const identity = declarationsFor('.desktop-application-object-copy > div');
    const school = declarationsFor('.desktop-application-object-copy strong');
    const college = declarationsFor(
      '.desktop-application-object-copy > div > span:not(.desktop-application-object-priority)'
    );

    expect(row.get('height')).toBe('auto');
    expect(row.get('max-height')).toBe('none');
    expect(row.get('overflow')).toBe('hidden');
    expect(identity.get('flex-wrap')).toBe('wrap');
    expect(school.get('white-space')).toBe('nowrap');
    expect(college.get('white-space')).toBe('nowrap');
    expect(school.get('text-overflow')).toBe('ellipsis');
    expect(college.get('text-overflow')).toBe('ellipsis');
    expect(declarationsFor('.desktop-application-object-project-meta').get('display')).toBe('flex');
    expect(declarationsFor('.desktop-application-object-project-title').get('display')).toBe('block');
  });

  it('uses the reference five-column information band and content-led reflow', () => {
    const wideFacts = declarationsFor('.desktop-application-object-facts');
    const mediumFacts = declarationsFor(
      '.desktop-application-object-facts',
      /max-width:\s*1199px/
    );
    const narrowFacts = declarationsFor(
      '.desktop-application-object-facts',
      /max-width:\s*899px/
    );
    const compactFacts = declarationsFor(
      '.desktop-application-object-facts',
      /max-width:\s*699px/
    );
    const mobileFacts = declarationsFor(
      '.desktop-application-object-facts',
      /max-width:\s*319px/
    );
    expect(wideFacts.get('grid-template-columns')).toContain('minmax(140px, 0.94fr)');
    expect(wideFacts.get('grid-template-columns')).toContain('minmax(105px, 0.86fr)');
    expect(mediumFacts.get('grid-template-columns')).toBe('repeat(5, minmax(0, 1fr))');
    expect(narrowFacts.get('grid-template-columns')).toBe('repeat(3, minmax(0, 1fr))');
    expect(compactFacts.get('grid-template-columns')).toBe('repeat(2, minmax(0, 1fr))');
    expect(mobileFacts.get('grid-template-columns')).toBe('minmax(0, 1fr)');
    expect(mobileFacts.get('grid-template-rows')).toBe('repeat(5, minmax(92px, auto))');
    expect(narrowFacts.get('grid-column')).toBe('auto');
    expect(narrowFacts.get('grid-row')).toBe('auto');
  });

  it('keeps every key value safely bounded and the status select readable', () => {
    const value = declarationsFor('.desktop-application-object-fact > strong');
    const nextAction = declarationsFor('.desktop-application-object-next-action > strong');
    const status = declarationsFor('.desktop-application-inline-status select');
    const deadline = declarationsFor('.desktop-application-deadline-full');

    for (const declarations of [value, nextAction, deadline]) {
      expect(declarations.get('overflow')).toBe('hidden');
      expect(declarations.get('white-space')).toBe('nowrap');
      expect(declarations.get('text-overflow')).toBe('ellipsis');
    }
    expect(status.get('width')).toBe('auto');
    expect(status.get('min-width')).toBe('0');
    expect(status.get('max-width')).toBe('138px');
    expect(status.get('height')).toBe('32px');
    expect(status.get('min-height')).toBe('32px');
    expect(status.get('font-size')).toBe('13px');
    expect(status.get('text-overflow')).toBe('ellipsis');
    expect(declarationsFor('.desktop-application-deadline-distance').get('font-variant-numeric')).toBe('tabular-nums');
    expect(declarationsFor('.desktop-application-object-next-cta').get('display')).toBe('inline-flex');
    expect(declarationsFor('.desktop-application-object-card-percent').get('font-variant-numeric')).toBe('tabular-nums');
  });

  it('shows exact deadline distance and uses a non-destructive expired display state', () => {
    expect(homeSource).toContain('function formatApplicationDeadlineDistance(value: string, now: number)');
    expect(homeSource).toContain('return `已截止 ${Math.max(1, Math.ceil(Math.abs(difference) / dayMs))} 天`;');
    expect(homeSource).toContain('const deadlineDistance = formatApplicationDeadlineDistance(');
    expect(homeSource).toContain("const actionExpired = deadlineExpired && rowJourney.state === 'active';");
    expect(homeSource).toContain("const cardAction = actionExpired ? '申请已截止' : rowJourney.action;");
    expect(homeSource).toContain('className="desktop-application-deadline-distance"');
  });

  it('matches the compact reference card geometry and title hierarchy', () => {
    const row = declarationsFor('.desktop-application-object-row');
    const logo = declarationsFor('.desktop-application-object-main > :first-child');
    const school = declarationsFor('.desktop-application-object-copy strong');
    const facts = declarationsFor('.desktop-application-object-facts');

    expect(noticeCss).toMatch(/\.desktop-notice-card\s*\{[\s\S]*?min-height:\s*220px[\s\S]*?padding:\s*20px[\s\S]*?border-radius:\s*18px/);
    expect(noticeCss).toMatch(/\.desktop-notice-card-title\s*\{[\s\S]*?font-size:\s*20px[\s\S]*?line-height:\s*30px/);
    expect(row.get('min-height')).toBe('130px');
    expect(row.get('padding')).toBe('14px 20px');
    expect(row.get('border-radius')).toBe('14px');
    expect(logo.get('width')).toBe('88px');
    expect(logo.get('height')).toBe('88px');
    expect(school.get('font-size')).toBe('20px');
    expect(school.get('line-height')).toBe('30px');
    expect(school.get('font-weight')).toBe('600');
    expect(facts.get('border')).toBe('0');
    expect(
      declarationsFor('.desktop-application-object-fact + .desktop-application-object-fact::before').get('display')
    ).toBe('block');
    expect(homeSource).toContain('>截止时间</small>');
    expect(homeSource).toContain('>当前待办</small>');
    expect(homeSource).toContain('>优先级</small>');
  });

  it('matches the notice-library top-level rhythm without wasting a third toolbar row', () => {
    expect(cssSource).toMatch(
      /\.desktop-route-content\.desktop-qq-workbench\s*\{[\s\S]*?padding:\s*18px 20px 28px/,
    );
    expect(cssSource).toMatch(
      /\.desktop-application-context-toolbar\s*\{[\s\S]*?margin-top:\s*var\(--app-top-level-gap, 20px\)[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)[\s\S]*?border-radius:\s*var\(--app-radius-panel, 12px\)/,
    );
    expect(cssSource).toMatch(
      /\.desktop-application-filter-row\s*\{\s*display:\s*contents/,
    );
    expect(cssSource).toMatch(
      /data-zoom-level='150'[\s\S]*?data-zoom-level='200'[\s\S]*?\.desktop-application-filter-row\s*\{\s*display:\s*grid/,
    );
    expect(cssSource).toContain('container-name: application-context;');
    expect(cssSource).toContain('@container application-context (max-width: 899px)');
    expect(cssSource).toContain('@container application-context (max-width: 759px)');
    expect(cssSource).toContain('@container application-context (max-width: 559px)');
  });

  it('keeps compact and comfortable density modes on the same scan-first geometry', () => {
    expect(releaseCss).toMatch(
      /APPLICATION REFERENCE LIST AUTHORITY[\s\S]*?\.desktop-application-object-row\s*\{[\s\S]*?min-height:\s*130px[\s\S]*?padding:\s*14px 20px/,
    );
    expect(releaseCss).toMatch(
      /data-density='compact'[\s\S]*?data-density='comfortable'[\s\S]*?\.desktop-application-object-row\s*\{[\s\S]*?min-height:\s*130px/,
    );
  });

  it('makes the menu permanently reachable without hover discovery', () => {
    const menu = declarationsFor('.desktop-application-object-menu-trigger');
    expect(menu.get('width')).toBe('40px');
    expect(menu.get('height')).toBe('40px');
    expect(menu.get('opacity')).toBe('1');
    expect(menu.get('pointer-events')).toBe('auto');
  });

  it('keeps the four-track row contract when the desktop is zoomed out', () => {
    expect(releaseCss).toMatch(
      /data-zoom-level='80'[\s\S]*?data-zoom-level='90'[\s\S]*?\.desktop-application-object-main\s*\{[\s\S]*?grid-template-columns:[\s\S]*?88px[\s\S]*?minmax\(260px, 1\.65fr\)[\s\S]*?minmax\(0, 4\.45fr\)[\s\S]*?40px/,
    );
  });

  it('lets the full master pane scroll from 125-200% instead of trapping cards below the toolbar', () => {
    expect(cssSource).toMatch(
      /data-zoom-level='125'[\s\S]*?data-zoom-level='150'[\s\S]*?data-zoom-level='175'[\s\S]*?data-zoom-level='200'[\s\S]*?\.desktop-application-context\s*\{[^}]*overflow-y:\s*auto/,
    );
    expect(cssSource).toMatch(
      /data-zoom-level='125'[\s\S]*?data-zoom-level='150'[\s\S]*?data-zoom-level='175'[\s\S]*?data-zoom-level='200'[\s\S]*?\.desktop-project-table-body\s*\{[^}]*height:\s*auto[^}]*overflow:\s*visible/,
    );
  });
});
