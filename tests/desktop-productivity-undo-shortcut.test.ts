import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('desktop productivity undo shortcut', () => {
  it.each([
    'components/desktop-schedule-workspace.tsx',
    'components/desktop-contacts-workspace.tsx'
  ])('uses Ctrl+Z for the visible reversible action without stealing text undo in %s', async (file) => {
    const source = await readFile(resolve(root, file), 'utf8');

    expect(source).toContain("event.key.toLowerCase() !== 'z'");
    expect(source).toContain('isWorkspaceEditableTarget(event.target)');
    expect(source).toContain("window.addEventListener('keydown', handleUndoShortcut, true)");
    expect(source).toContain('undoNotice.undo()');
    expect(source).toContain('window.requestAnimationFrame(undoNotice.returnFocus)');
  });
});
