import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const noticeSource = readFileSync(resolve(root, 'app/notices/page.tsx'), 'utf8');
const collegeSource = readFileSync(resolve(root, 'app/colleges/page.tsx'), 'utf8');
const resourceSource = readFileSync(
  resolve(root, 'app/resources/desktop-resource-center.tsx'),
  'utf8'
);
const cssPath = resolve(root, 'app/desktop-flagship.css');
const cssSource = readFileSync(cssPath, 'utf8');
const stylesheet = postcss.parse(cssSource, { from: cssPath });
const finalNoticeCssPath = resolve(root, 'app/desktop-notice-alignment.css');
const finalNoticeCssSource = readFileSync(finalNoticeCssPath, 'utf8');
const finalNoticeStylesheet = postcss.parse(finalNoticeCssSource, { from: finalNoticeCssPath });

function declarationsCovering(fragment: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.some((selector) => selector.includes(fragment))) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

function runtimeNoticeDeclarationsCovering(fragment: string) {
  const values = new Map<string, string>();

  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.some((selector) => selector.trim().endsWith(fragment))) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });

  finalNoticeStylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.some((selector) => selector.trim().endsWith(fragment))) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });

  return values;
}

function declarationsForExact(selector: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.includes(selector)) return;
    if (rule.parent?.type !== 'root') return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

function declarationsForMediaExact(selector: string, mediaQuery: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.includes(selector)) return;
    const parent = rule.parent;
    if (parent?.type !== 'atrule' || parent.name !== 'media' || parent.params !== mediaQuery) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

function responsiveDeclarations(fragment: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (
      !rule.selectors.some(
        (selector) => selector.includes(fragment) && selector.includes("data-zoom-level='200'")
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

describe('desktop core information route design contract', () => {
  it('uses one compact tool hierarchy and continuous notice results', () => {
    expect(noticeSource).toContain('desktop-notice-search-row');
    expect(noticeSource).toContain('CompactFilterSelect label="申请状态"');
    expect(noticeSource).toContain('CompactFilterSelect label="截止范围"');
    expect(noticeSource).toContain('CompactFilterSelect label="排序方式"');
    expect(noticeSource).toContain('desktop-notice-active-filters');
    expect(noticeSource).not.toContain('desktop-notice-type-tabs');
    expect(noticeSource).not.toContain('desktop-notice-quick-filters');
    expect(noticeSource).toContain('desktop-notice-list');
    expect(noticeSource).toContain('desktop-notice-card-layout');
    expect(noticeSource).toContain('desktop-notice-card-actions');
    expect(noticeSource).not.toContain('hover:-translate');
    expect(noticeSource).not.toContain('title="使用提醒"');

    const list = runtimeNoticeDeclarationsCovering('.desktop-notice-list');
    expect(list.get('overflow')).toContain('visible');
    expect(list.get('border')).toContain('0');
    expect(list.get('border-radius')).toContain('0');
    expect(list.get('background')).toContain('transparent');

    const row = runtimeNoticeDeclarationsCovering('.desktop-notice-card');
    expect(row.get('border')).toContain('1px solid var(--so-border)');
    expect(row.get('border-radius')).toContain('18px');
    expect(row.get('box-shadow')).toContain('0 5px 18px rgba(29, 43, 50, 0.055)');
    expect(row.get('transform')).toContain('none');
  });

  it('renders a stable row-shaped notice loading state without shimmer or gradients', () => {
    expect(noticeSource).toContain('desktop-notice-loading-heading');
    expect(noticeSource).toContain('desktop-notice-loading-rows');
    expect(noticeSource).toContain('desktop-notice-loading-row');
    expect(noticeSource.match(/motion-safe:animate-spin/g)).toHaveLength(1);
    expect(noticeSource).not.toContain('animate-pulse');

    const loading = declarationsCovering('.desktop-notice-loading-row');
    expect(loading.get('grid-template-columns')).toContain('minmax(0, 1fr)');
    expect(loading.get('min-width')).toContain('0');

    const visualEffects: string[] = [];
    finalNoticeStylesheet.walkDecls((declaration: Declaration) => {
      if (/gradient|shimmer/i.test(declaration.value)) visualEffects.push(declaration.value);
    });
    expect(visualEffects).toEqual([]);

    const primaryAction = runtimeNoticeDeclarationsCovering(
      '.desktop-notice-card-buttons > div button'
    );
    expect(primaryAction.get('background')).toBe('var(--so-brand-strong)');
    expect(primaryAction.get('box-shadow')).toBe('none');
  });

  it('keeps the college directory and resource directory compact and motion-free', () => {
    expect(collegeSource).toContain('desktop-college-toolbar-header');
    expect(collegeSource).toContain('desktop-college-page');
    expect(collegeSource).toContain('desktop-college-search');
    expect(collegeSource).toContain('desktop-college-filter-options');
    expect(collegeSource).toContain('title="没有找到匹配院校"');
    expect(collegeSource).toContain('<DesktopStateSurface');
    expect(collegeSource).not.toContain('desktop-college-card surface-card rounded-[26px] p-5 transition hover:-translate-y-1');
    expect(collegeSource).not.toContain('<section className="hidden">');
    expect(collegeSource).not.toContain('College Finder');
    expect(collegeSource).toContain('aria-label="搜索院校"');
    expect(collegeSource).toContain('aria-label="跳转页码"');
    expect(collegeSource).toContain('inputMode="numeric"');
    expect(collegeSource).toContain('aria-expanded={showAllCities}');
    expect(collegeSource).toContain('aria-pressed={city === item}');

    expect(resourceSource).toContain('desktop-resource-page');
    expect(resourceSource).toContain('desktop-resource-tool-grid');
    expect(resourceSource).toContain('desktop-resource-link-grid');

    for (const selector of ['.desktop-college-card', '.desktop-resource-tool-card', '.desktop-resource-link']) {
      const values = declarationsCovering(selector);
      expect(values.get('box-shadow'), selector).toContain('none');
      expect(values.get('transform'), selector).toContain('none');
    }
  });

  it('keeps the last successful online snapshot when a manual refresh fails', () => {
    expect(noticeSource).toContain('const [initialPublicNoticeSnapshot] = useState(() => getPublicNoticeSnapshot())');
    expect(noticeSource).toContain('const hasOnlineSnapshotRef = useRef(initialPublicNoticeSnapshot.syncedAt !== null)');
    expect(noticeSource).toContain("result.source === 'stale'");
    expect(noticeSource).toContain('本次同步未完成，继续展示上次同步成功的通知。');
    expect(collegeSource).toContain('const [initialPublicNoticeSnapshot] = useState(() => getPublicNoticeSnapshot())');
    expect(collegeSource).toContain('const hasOnlineSnapshotRef = useRef(initialPublicNoticeSnapshot.syncedAt !== null)');
    expect(collegeSource).toContain("result.source === 'stale' ? 'stale' : 'fallback'");
    expect(collegeSource).toContain("title={noticeSyncStatus === 'stale' ? '本次刷新失败' : '当前显示本地院校数据'}");
  });

  it('renders college results as a balanced two-column desktop grid', () => {
    const list = declarationsForExact('.desktop-app-shell .desktop-college-grid');
    const row = declarationsForExact('.desktop-app-shell .desktop-college-card');
    const hoveredRow = declarationsForExact('.desktop-app-shell .desktop-college-card:hover');

    expect(list.get('display')).toBe('grid');
    expect(list.get('width')).toBe('100%');
    expect(list.get('min-width')).toBe('0');
    expect(list.get('max-width')).toBe('100%');
    expect(list.get('align-items')).toBe('stretch');
    expect(list.get('overflow')).toBe('visible');
    expect(list.get('gap')).toBe('12px');
    expect(list.get('grid-template-columns')).toBe('repeat(2, minmax(0, 1fr))');
    expect(list.get('border')).toBe('0');
    expect(list.get('background')).toBe('transparent');
    expect(list.get('box-shadow')).toBe('none');

    expect(row.get('min-width')).toBe('0');
    expect(row.get('max-width')).toBe('100%');
    expect(row.get('border')).toContain('1px solid');
    expect(row.get('border-radius')).toBe('var(--desktop-radius-panel)');
    expect(row.get('box-shadow')).toBe('none');
    expect(row.get('transition-property')).toBe('background-color, border-color');

    expect(hoveredRow.get('background')).toContain('var(--so-surface-subtle)');
    expect(hoveredRow.get('border-color')).toBe('var(--so-border-strong)');
    expect(hoveredRow.get('box-shadow')).toBe('none');
    expect(hoveredRow.get('transform')).toBe('none');

    const narrowList = declarationsForMediaExact(
      '.desktop-app-shell .desktop-college-grid',
      '(max-width: 1180px)'
    );
    expect(narrowList.get('grid-template-columns')).toBe('minmax(0, 1fr)');
  });

  it('collapses core information layouts at 200 percent without fixed-width overflow', () => {
    expect(responsiveDeclarations('.desktop-notice-results').get('grid-template-columns')).toContain(
      'minmax(0, 1fr)'
    );
    expect(responsiveDeclarations('.desktop-college-grid').get('grid-template-columns')).toContain(
      'minmax(0, 1fr)'
    );
    expect(responsiveDeclarations('.desktop-resource-tool-grid').get('grid-template-columns')).toContain(
      'minmax(0, 1fr)'
    );
    expect(responsiveDeclarations('.desktop-resource-link-grid').get('grid-template-columns')).toContain(
      'minmax(0, 1fr)'
    );

    for (const selector of [
      '.desktop-notice-library',
      '.desktop-notice-main-column',
      '.desktop-college-page',
      '.desktop-college-grid',
      '.desktop-resource-page'
    ]) {
      expect(declarationsCovering(selector).get('min-width'), selector).toContain('0');
    }
  });
});
