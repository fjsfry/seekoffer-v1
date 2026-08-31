import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('QQ benchmarked desktop interactions', () => {
  it('keeps the command palette account-scoped and remembers recent searches', () => {
    const source = read('components/desktop-app-shell.tsx');

    expect(source).toContain('seekoffer-desktop-command-history:');
    expect(source).toContain('encodeURIComponent(session.userId)');
    expect(source).toContain("category: '最近搜索'");
    expect(source).toContain('再次搜索通知与项目');
    expect(source).toContain('localStorage.setItem(commandHistoryStorageKey');
    expect(source).toContain("item.section === 'schedule' && unreadReminderCount");
    expect(source).not.toContain("item.section === 'today' && unreadReminderCount");
  });

  it('provides a keyboard-accessible project context menu like QQ list actions', () => {
    const source = read('components/desktop-home.tsx');
    const css = read('app/desktop-mchose.css');

    expect(source).toContain('onContextMenu={(event) =>');
    expect(source).toContain("event.key === 'ContextMenu'");
    expect(source).toContain('role="menu"');
    expect(source).toContain('标记为重点项目');
    expect(source).toContain('复制项目名称');
    expect(source).toContain('刷新项目数据');
    expect(source).toContain("if (event.key === 'Tab')");
    expect(source).toContain('closeProjectContextMenu(true)');
    expect(source).toContain('event.stopPropagation()');
    expect(css).toMatch(/\.desktop-app-shell \.desktop-project-context-menu\s*\{[^}]*position:\s*fixed/);
    expect(css).toContain('.desktop-application-object-menu-trigger');
    expect(css).toContain('html[data-desktop-reduce-motion=\'true\'] .desktop-app-shell .desktop-project-context-menu');
  });
});
