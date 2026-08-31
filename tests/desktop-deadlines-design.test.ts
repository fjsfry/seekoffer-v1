import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const source = (await readFile(resolve(root, 'app/deadlines/page.tsx'), 'utf8')).replace(/\r\n/g, '\n');
const css = (await readFile(resolve(root, 'app/desktop-flagship.css'), 'utf8')).replace(/\r\n/g, '\n');
const stylesheet = postcss.parse(css);

function declarationsFor(selectorSuffix: string) {
  const declarations = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.some((selector) => selector.trim().endsWith(selectorSuffix))) return;
    rule.walkDecls((declaration: Declaration) => {
      declarations.set(declaration.prop, declaration.value.replace(/\s*!important\s*$/, '').trim());
    });
  });
  return declarations;
}

describe('desktop deadlines flagship contract', () => {
  it('uses explicit loading, error and retry states instead of flashing empty groups', () => {
    expect(source).toContain('const [isLoading, setIsLoading] = useState(true)');
    expect(source).toContain('const [loadError, setLoadError] = useState');
    expect(source).toContain("import { DesktopStateSurface } from '@/components/desktop-state-surface'");
    expect(source).toContain('title="正在加载截止项目"');
    expect(source).toContain('tone="error"');
    expect(source).toContain('title="截止项目加载失败"');
    expect(source).not.toContain('border-dashed');
    expect(source).toContain('setRefreshNonce((value) => value + 1)');
    expect(source).toContain('aria-label="按学校筛选"');
    expect(source).toContain('aria-label="按项目类型筛选"');
  });

  it('renders continuous urgency groups and rows with shared desktop tokens', () => {
    const toolbar = declarationsFor('.desktop-deadlines-toolbar');
    const group = declarationsFor('.desktop-deadline-group');
    const row = declarationsFor('.desktop-deadline-row-card');
    const actions = declarationsFor('.desktop-deadline-row-actions > *');

    expect(toolbar.get('border-radius')).toContain('var(--desktop-radius-panel)');
    expect(group.get('border-radius')).toContain('var(--desktop-radius-panel)');
    expect(group.get('box-shadow')).toBe('none');
    expect(row.get('border-radius')).toBe('0');
    expect(row.get('box-shadow')).toBe('none');
    expect(row.get('transform')).toBe('none');
    expect(actions.get('min-height')).toContain('var(--desktop-control-height)');
  });

  it('collapses filters and actions without horizontal overflow at high zoom', () => {
    expect(css).toContain("[data-zoom-level='150']");
    expect(css).toContain("[data-zoom-level='200']");
    expect(css).toContain(".desktop-deadlines-page\n) {\n  min-width: 0");
    expect(css).toContain(".desktop-deadline-row-main {\n  grid-template-columns: minmax(0, 1fr) !important;");
  });
});
