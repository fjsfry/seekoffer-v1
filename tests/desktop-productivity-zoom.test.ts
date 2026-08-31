import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const scheduleSource = readFileSync(resolve(root, 'components/desktop-schedule-workspace.tsx'), 'utf8');
const contactsSource = readFileSync(resolve(root, 'components/desktop-contacts-workspace.tsx'), 'utf8');
const css = readFileSync(resolve(root, 'components/desktop-workspace.module.css'), 'utf8');

describe('desktop productivity zoom completeness', () => {
  it('keeps long schedule titles and metadata readable in compact containers', () => {
    expect(scheduleSource.match(/styles\.scheduleTitleControl/g)?.length).toBeGreaterThanOrEqual(2);
    expect(scheduleSource).toContain('rows={2}');
    expect(css).toMatch(/textarea\.scheduleTitleControl\s*\{[^}]*white-space:\s*pre-wrap/);
    expect(css).toMatch(
      /@container schedule-workspace-page \(max-width: 1120px\)[\s\S]*?\.schedulePage \.scheduleListRow :is\(\.rowTitle, \.rowMeta\)[^{]*\{[^}]*white-space:\s*normal/
    );
  });

  it('uses zero-minimum quick-action columns at narrow and high zoom widths', () => {
    expect(css.match(/grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(css).toContain('.contactInlineSelect');
    expect(css).toContain('.contactInlineDate');
    expect(contactsSource).toContain('data-contact-followup-action');
    expect(contactsSource).toContain('data-contact-status-action');
  });

  it('wraps long mentor fields without changing the public website form', () => {
    expect(contactsSource.match(/styles\.contactCompactTextarea/g)?.length).toBeGreaterThanOrEqual(4);
    expect(contactsSource).toContain('<textarea className={`${styles.fieldControl} ${styles.contactCompactTextarea}`} rows={2} value={contact.departmentName}');
    expect(contactsSource).toContain('<textarea className={`${styles.fieldControl} ${styles.contactCompactTextarea}`} rows={2} value={contact.researchDirection}');
    expect(contactsSource).toContain('<input className={styles.fieldControl} value={contact.departmentName}');
    expect(contactsSource).toContain('<input className={styles.fieldControl} value={contact.researchDirection}');
    expect(css).toMatch(/textarea\.contactCompactTextarea\s*\{[^}]*white-space:\s*pre-wrap/);
  });

  it('stacks header actions and preserves complete button labels at high zoom', () => {
    expect(css).toMatch(
      /data-zoom-level='200'[\s\S]*?:is\([\s\S]*?\.schedulePage,[\s\S]*?\.contactsPage[\s\S]*?\) \.headerActions\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/
    );
    expect(css).toMatch(/\.primaryButton\s*\{[^}]*white-space:\s*nowrap/);
  });

  it('allows list titles and metadata to grow instead of clipping at 150-200 percent', () => {
    for (const level of ['150', '175', '200']) expect(css).toContain(`data-zoom-level='${level}'`);
    expect(css).toMatch(
      /data-zoom-level='200'[\s\S]*?:is\([\s\S]*?\.schedulePage \.scheduleListRow,[\s\S]*?\.contactsPage \.contactListRow[\s\S]*?\) :is\(\.rowTitle, \.rowMeta, \.rowDescription\)\s*\{[^}]*white-space:\s*normal/
    );
  });
});
