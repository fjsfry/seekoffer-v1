import fs from 'node:fs';
import path from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const workspaceRoot = process.cwd();
const cssPath = path.join(workspaceRoot, 'app', 'desktop-flagship.css');
const cssSource = fs.readFileSync(cssPath, 'utf8');
const todaySource = fs.readFileSync(
  path.join(workspaceRoot, 'components', 'desktop-today.tsx'),
  'utf8'
);
const stylesheet = postcss.parse(cssSource, { from: cssPath });

function declarationsFor(selectorFragment: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (rule.parent?.type !== 'root') return;
    if (
      !rule.selectors.some(
        (selector) =>
          selector.includes(selectorFragment) && !selector.includes('data-zoom-level')
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

describe('Image2 My Day visual contract', () => {
  it('keeps one operational page header with a readable title and controls', () => {
    expect(todaySource).toContain('desktop-day-header');
    expect(todaySource).toContain('<h1>我的一天</h1>');
    expect(todaySource).toContain('className="desktop-primary-command"');

    const header = declarationsFor('.desktop-day-header');
    const title = declarationsFor('.desktop-day-title-row h1');
    const primaryCommand = declarationsFor('.desktop-primary-command');
    expect(header.get('border-bottom')).toBe('1px solid var(--so-border)');
    expect(title.get('font-size')).toBe('var(--desktop-type-page-title)');
    expect(title.get('font-weight')).toBe('600');
    expect(primaryCommand.get('min-height')).toBe('var(--desktop-control-height)');
    expect(primaryCommand.get('font-size')).toBe('14px');
  });

  it('uses a calm week strip and a single selected-state signal', () => {
    const strip = declarationsFor('.desktop-week-strip');
    const selected = declarationsFor('.desktop-week-day--selected');
    expect(strip.get('border-radius')).toBe('var(--desktop-radius-panel)');
    expect(strip.get('background')).toBe('var(--so-surface-subtle)');
    expect(selected.get('background')).toBe('var(--so-brand-soft)');
    expect(selected.get('box-shadow')).toContain('inset');
  });

  it('renders tasks and application context as continuous readable rows', () => {
    expect(todaySource).toContain('className="desktop-home-workspace"');
    expect(todaySource).toContain('className="desktop-task-list"');
    expect(todaySource).toContain('className="desktop-home-inspector"');

    const workspace = declarationsFor('.desktop-home-workspace');
    const taskRow = declarationsFor('.desktop-task-row');
    const taskTitle = declarationsFor('.desktop-task-copy strong');
    const taskDetail = declarationsFor('.desktop-task-copy span');
    const inspector = declarationsFor('.desktop-home-inspector');
    expect(workspace.get('grid-template-columns')).toContain('minmax(280px, 320px)');
    expect(taskRow.get('border-radius')).toBe('0');
    expect(taskRow.get('box-shadow')).toBe('none');
    expect(taskTitle.get('font-size')).toBe('15px');
    expect(taskDetail.get('font-size')).toBe('14px');
    expect(inspector.get('gap')).toBe('0');
  });

  it('retains the high-zoom single-column fallback', () => {
    expect(cssSource).toMatch(
      /data-zoom-level='150'[\s\S]*?\.desktop-home-workspace\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/
    );
  });
});
