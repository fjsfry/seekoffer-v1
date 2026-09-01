import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const noticeSource = readFileSync(resolve(root, 'app/notices/page.tsx'), 'utf8');
const detailSource = readFileSync(resolve(root, 'components/notice-detail-view.tsx'), 'utf8');
const badgeSource = readFileSync(resolve(root, 'components/status-badge.tsx'), 'utf8');
const noticeCssPath = resolve(root, 'app/desktop-notice-alignment.css');
const noticeCss = readFileSync(noticeCssPath, 'utf8');
const noticeStylesheet = postcss.parse(noticeCss, { from: noticeCssPath });
const coherenceCss = readFileSync(resolve(root, 'app/desktop-app-coherence.css'), 'utf8');

function declarationsFor(selectorFragment: string, qualifier?: string) {
  const declarations = new Map<string, string>();
  noticeStylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.some(
      (selector) =>
        selector.trim().endsWith(selectorFragment) && (!qualifier || selector.includes(qualifier)),
    )) return;
    rule.walkDecls((declaration: Declaration) => {
      declarations.set(
        declaration.prop,
        declaration.value.replace(/\s*!important\s*$/, '').trim(),
      );
    });
  });
  return declarations;
}

describe('desktop notice release-readiness contract', () => {
  it('gives every advanced filter a max-content row instead of overlapping fixed tracks', () => {
    const grid = declarationsFor('.desktop-notice-advanced-filters');
    const item = declarationsFor('.desktop-notice-advanced-filters > label');

    expect(grid.get('grid-auto-rows')).toBe('max-content');
    expect(grid.get('align-items')).toBe('start');
    expect(item.get('height')).toBe('auto');
    expect(item.get('min-height')).toBe('61px');
  });

  it('keeps the common desktop card compact and only drops actions below at a genuinely narrow width', () => {
    expect(noticeCss).toContain('@container notice-cards (max-width: 759px)');
    expect(noticeCss).not.toContain('@container notice-cards (max-width: 859px)');

    const compactCard = declarationsFor('.desktop-notice-card', "data-density='compact'");
    const compactLayout = declarationsFor('.desktop-notice-card-layout', "data-density='compact'");
    expect(compactCard.get('min-height')).toBe('0');
    expect(compactCard.get('padding')).toBe('14px');
    expect(compactLayout.get('grid-template-columns')).toBe('72px minmax(0, 1fr) 170px');
    expect(noticeCss).toMatch(
      /@container notice-cards \(max-width: 759px\)[\s\S]*?\.desktop-notice-card-layout\s*\{[\s\S]*?grid-template-rows:\s*auto auto[\s\S]*?\.desktop-notice-card-actions\s*\{[\s\S]*?grid-row:\s*2/,
    );
    expect(noticeCss).toMatch(
      /@container notice-cards \(max-width: 759px\)[\s\S]*?\.desktop-notice-card-actions\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) minmax\(160px, 190px\)/,
    );
    expect(noticeCss).toContain('@container notice-cards (max-width: 520px)');

    const actions = declarationsFor('.desktop-notice-card-actions');
    const buttons = declarationsFor('.desktop-notice-card-actions > .desktop-notice-card-buttons');
    expect(actions.get('height')).toBe('auto');
    expect(actions.get('min-height')).toBe('0');
    expect(actions.get('grid-template-rows')).toBe('auto auto');
    expect(actions.get('align-content')).toBe('start');
    expect(buttons.get('align-self')).toBe('start');
    expect(buttons.get('margin-top')).toMatch(/^(?:8|10|12)px$/);
  });

  it('uses full click targets and theme-aware sidebar text and badges', () => {
    const toolbarAction = declarationsFor('.desktop-notice-toolbar-action');
    const deadlineDate = declarationsFor('.desktop-notice-deadline-date');

    expect(toolbarAction.get('min-height')).toBe('32px');
    expect(deadlineDate.get('color')).toBe('var(--so-text-secondary)');
    expect(badgeSource).toContain('desktop-status-badge');
    expect(badgeSource).toContain('data-status-tone={finalTone}');
    expect(coherenceCss).toContain('.desktop-status-badge--muted');
    expect(coherenceCss).toContain("[data-desktop-theme='dark']");
  });

  it('does not offer the same primary application action after a notice has expired', () => {
    expect(noticeSource).toContain("deadlineLevel === 'expired'");
    expect(noticeSource).toContain('desktop-notice-card-buttons--expired');
    expect(detailSource).toContain("const isExpired = deadlineLevel === 'expired'");
    expect(detailSource).toContain('desktop-notice-detail-expired-note');
    expect(detailSource).toMatch(/\{!isExpired \? \(\s*<ApplicationActionButton/);
  });

  it('maps public update events through a whitelist and removes internal identifiers', () => {
    expect(detailSource).toContain('PUBLIC_CHANGE_FIELD_LABELS');
    expect(detailSource).toContain("duplicate_merge: '重复通知合并'");
    expect(detailSource).toContain('toPublicChangeRecord');
    expect(detailSource).toContain('INTERNAL_CHANGE_ID_PATTERN');
    expect(detailSource).toContain('.filter((item): item is PublicChangeRecord => Boolean(item))');
    expect(detailSource).not.toContain('{publicCopy(item.field)}');
    expect(detailSource).not.toContain('{cleanChangeText(item.change)}');
  });

  it('reflows application and notice filters from explicit zoom state rather than viewport media queries', () => {
    expect(coherenceCss).toMatch(
      /data-zoom-level='150'[\s\S]*?\.desktop-application-filter-row\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    );
    expect(coherenceCss).toMatch(
      /data-zoom-level='175'[\s\S]*?data-zoom-level='200'[\s\S]*?\.desktop-application-filter-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
    expect(coherenceCss).toMatch(
      /data-zoom-level='175'[\s\S]*?data-zoom-level='200'[\s\S]*?\.desktop-application-context-copy h1\s*\{[^}]*white-space:\s*nowrap/,
    );
    expect(noticeCss).toMatch(
      /data-zoom-level='150'[\s\S]*?data-zoom-level='200'[\s\S]*?\.desktop-notice-search-row[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
  });
});
