import fs from 'node:fs';
import path from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const pageSource = fs.readFileSync(path.join(root, 'app', 'me', 'page.tsx'), 'utf8');
const scheduleSource = fs.readFileSync(path.join(root, 'components', 'desktop-schedule-workspace.tsx'), 'utf8');
const contactsSource = fs.readFileSync(path.join(root, 'components', 'desktop-contacts-workspace.tsx'), 'utf8');
const statusSource = fs.readFileSync(path.join(root, 'components', 'desktop-workspace-status.tsx'), 'utf8');
const cssPath = path.join(root, 'components', 'desktop-workspace.module.css');
const cssSource = fs.readFileSync(cssPath, 'utf8');
const stylesheet = postcss.parse(cssSource, { from: cssPath });

function declarations(selector: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (rule.parent?.type !== 'root') return;
    if (!rule.selectors.includes(selector)) return;
    rule.walkDecls((declaration: Declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

describe('desktop schedule and contacts list-detail contract', () => {
  it('keeps the durable local-first and tombstone data boundary in the route', () => {
    expect(pageSource).toContain('writeAccountScopedWorkbenchValue');
    expect(pageSource).toContain('createWorkbenchSaveCoordinator');
    expect(pageSource).toContain('deletedAt');
    expect(pageSource).toContain('handleRetrySync');
    expect(pageSource).toContain('lastSyncedAt');
  });

  it('renders schedule as an independently scrolling list and detail workflow', () => {
    expect(scheduleSource).toMatch(/role="list"[\s\S]*?aria-label="日程事项"/);
    expect(scheduleSource).toContain('role="listitem"');
    expect(scheduleSource).toContain('data-schedule-completion-action');
    expect(scheduleSource).toContain('撤销');
    expect(scheduleSource).toContain('aria-label="日程详情"');
    expect(scheduleSource).toContain('data-detail-open');
    expect(scheduleSource).toContain("event.key === 'ArrowDown'");
    expect(scheduleSource).toContain("event.key === 'Enter'");
    expect(scheduleSource).toContain("event.key === 'Delete'");
    expect(scheduleSource).toContain("event.key === 'Escape'");
    expect(scheduleSource).toContain("event.key.toLowerCase() === 'n'");
    expect(scheduleSource).toContain('DesktopConfirmDialog');
    expect(scheduleSource).toContain('window.sessionStorage');
  });

  it('renders contacts as a continuous list with a separate auto-saving detail', () => {
    expect(contactsSource).toContain('role="list" aria-label="导师联系人"');
    expect(contactsSource).toContain('role="listitem"');
    expect(contactsSource).toContain('className={styles.contactInlineSelect}');
    expect(contactsSource).toContain('className={styles.contactInlineDate}');
    expect(contactsSource).toContain('aria-label="导师联系详情"');
    expect(contactsSource).toContain('data-contact-detail-primary');
    expect(contactsSource).toContain('已自动保存');
    expect(contactsSource).toContain('沟通记录');
    expect(contactsSource).toContain('隐私提示');
    expect(contactsSource).toContain('DesktopConfirmDialog');
    expect(contactsSource).toContain('window.sessionStorage');
  });

  it('uses one shared, explicit local and cloud sync status language', () => {
    expect(statusSource).toContain('本机已保存，云端同步失败');
    expect(statusSource).toContain('重新同步');
    expect(statusSource).toContain('本机已保存，正在同步');
    expect(statusSource).toContain('本机已保存 · 云端已同步');
  });

  it('aligns both panes and gives each pane its own vertical scroll container', () => {
    const workspace = declarations('.workspace');
    const masterScroll = declarations('.masterScroll');
    const detailScroll = declarations('.detailScroll');
    const row = declarations('.listRow');

    expect(workspace.get('grid-template-columns')).toBe('minmax(300px, 360px) minmax(0, 1fr)');
    expect(workspace.get('overflow')).toBe('hidden');
    expect(masterScroll.get('overflow-y')).toBe('auto');
    expect(detailScroll.get('overflow-y')).toBe('auto');
    expect(row.get('min-height')).toBe('76px');
    expect(row.get('border-bottom')).toBe('1px solid var(--so-divider, #e5e6e8)');
  });

  it('switches to single-column drill-in semantics at narrow width and high zoom', () => {
    expect(cssSource).toContain(".workspace[data-detail-open='true'] .masterPane");
    expect(cssSource).toContain(".workspace[data-detail-open='true'] .detailPane");
    expect(cssSource).toContain("data-zoom-level='150'");
    expect(cssSource).toContain("data-zoom-level='175'");
    expect(cssSource).toContain("data-zoom-level='200'");
    expect(cssSource).toContain('.backButton');
  });
});
