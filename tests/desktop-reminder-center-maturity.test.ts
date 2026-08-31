import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();

describe('desktop reminder center maturity contract', () => {
  it('uses one authoritative loading, hard-error, stale, or empty surface', async () => {
    const source = await readFile(
      resolve(projectRoot, 'components/desktop-reminder-center.tsx'),
      'utf8'
    );

    expect(source).toContain("import { DesktopStateSurface } from './desktop-state-surface';");
    expect(source).toContain(
      'const hardSyncError = Boolean(applicationsError && !hasUsableReminderSnapshot);'
    );
    expect(source).toContain(
      'const staleSyncError = Boolean(applicationsError && hasUsableReminderSnapshot);'
    );
    expect(source).toContain('applicationsLoading && !hasUsableReminderSnapshot ? (');
    expect(source).not.toContain('desktop-reminder-loading-rows');
    expect(source).not.toContain('if (applicationsError && !applications.length)');
  });

  it('keeps bulk-read reversible and snooze presets keyboard operable', async () => {
    const source = await readFile(
      resolve(projectRoot, 'components/desktop-reminder-center.tsx'),
      'utf8'
    );

    expect(source).toContain('function undoMarkAllRead()');
    expect(source).toContain('MARK_ALL_READ_UNDO_MS = 6_000');
    expect(source).toContain('aria-haspopup="menu"');
    expect(source).toContain('role="menuitem"');
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain("['ArrowDown', 'ArrowUp', 'Home', 'End']");
    expect(source).toContain('closeSnoozeMenu(reminder.id, true)');
    expect(source).toContain('defaultSnoozeMinutes={preferences.notifications.snoozeMinutes}');
  });
});
