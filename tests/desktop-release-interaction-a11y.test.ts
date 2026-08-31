import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

async function source(path: string) {
  return (await readFile(resolve(root, path), 'utf8')).replace(/\r\n/g, '\n');
}

describe('desktop release interaction accessibility', () => {
  it('waits for an animated modal to become visible before moving initial focus', async () => {
    const modalHook = await source('hooks/use-accessible-modal.ts');
    const manualDialog = await source('components/desktop-manual-application-dialog.tsx');

    expect(modalHook).toContain('let visibleFocusFrame = 0');
    expect(modalHook).toContain('visibleFocusFrame = window.requestAnimationFrame');
    expect(modalHook).toContain("dialog.querySelector<HTMLElement>('[data-modal-initial-focus]')");
    expect(modalHook).toContain('window.cancelAnimationFrame(visibleFocusFrame)');
    expect(manualDialog).toContain('if (!visible) return;');
    expect(manualDialog).toContain('if (!dialog || dialog.contains(document.activeElement)) return;');
    expect(manualDialog).toContain(".querySelector<HTMLElement>('[data-modal-initial-focus]')");
  });

  it('keeps only the visible reminder close button in the keyboard order', async () => {
    const shell = await source('components/desktop-app-shell.tsx');
    const reminder = await source('components/desktop-reminder-center.tsx');

    expect(shell).toContain('<div\n        className="desktop-reminder-backdrop"');
    expect(shell).toContain('className="desktop-reminder-backdrop"\n        aria-hidden="true"');
    expect(shell).not.toContain('tabIndex={reminderOpen ? 0 : -1}');
    expect(reminder).toContain("role={open ? 'dialog' : undefined}");
    expect(reminder).toContain("aria-labelledby={open ? 'desktop-reminder-title' : undefined}");
  });

  it('uses stable visible and accessible names for search controls', async () => {
    const shell = await source('components/desktop-app-shell.tsx');
    const help = await source('app/guide/desktop-help-center.tsx');

    expect(shell).toContain('aria-label="搜索申请、学校、通知或命令"');
    expect(shell).toContain('placeholder="搜索申请、学校、通知或命令"');
    expect(help).toContain('type="text"');
    expect(help).toContain('role="searchbox"');
    expect(help).toContain('aria-label="搜索帮助"');
    expect(help).toContain('onClick={clearHelpSearch}');
    expect(help).toContain('className="desktop-guide-hero-search" role="search"');
  });

  it('moves support-flow focus to the newly revealed template and labels window controls semantically', async () => {
    const guide = await source('app/guide/desktop-guide.tsx');
    const controls = await source('components/desktop-window-controls.tsx');
    const shell = await source('components/desktop-app-shell.tsx');

    expect(guide).toContain('supportTemplatePreviewRef.current?.focus({ preventScroll: true })');
    expect(guide).toContain('ref={supportTemplatePreviewRef}');
    expect(controls).toContain('role="group"');
    expect(controls).toContain('aria-label="窗口控制"');
    expect(shell).toContain(') : (\n            <div className="desktop-route-content desktop-focus-region">{children}</div>');
  });
});
