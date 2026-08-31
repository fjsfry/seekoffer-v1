import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const [shellSource, settingsSource] = await Promise.all([
  readFile(resolve(projectRoot, 'components/desktop-app-shell.tsx'), 'utf8'),
  readFile(resolve(projectRoot, 'components/desktop-settings-page.tsx'), 'utf8')
]);

describe('desktop topbar account and sync relocation', () => {
  it('keeps only search and reminders in the titlebar content actions', () => {
    const titlebarActions = shellSource.slice(
      shellSource.indexOf('className="desktop-titlebar-actions'),
      shellSource.indexOf('<DesktopWindowControls />')
    );

    expect(titlebarActions).toContain('reminderTriggerRef');
    expect(titlebarActions).not.toContain('desktop-sync-label');
    expect(titlebarActions).not.toContain('<DesktopAccount');
    expect(shellSource).not.toContain('function DesktopAccount(');
    expect(shellSource).not.toContain('className="desktop-history-controls');
    expect(shellSource).not.toContain('className="desktop-route-label');
    expect(shellSource).not.toContain('className="desktop-statusbar-sync');
    expect(shellSource).toContain('{syncLiveMessage}');
    expect(shellSource).toContain('role="status" aria-live="polite" aria-atomic="true"');
  });

  it('moves the existing session and sync state into a dedicated settings category', () => {
    expect(settingsSource).toContain("id: 'account'");
    expect(settingsSource).toContain('id="desktop-settings-panel-account"');
    expect(settingsSource).toContain('账号与同步');
    expect(settingsSource).toContain('getAuthProviderLabel(session.authProvider)');
    expect(settingsSource).toContain('syncStatus: DesktopSyncStatus');
    expect(settingsSource).toContain('syncUpdatedAt: number | null');
    expect(shellSource).toContain('requestDesktopApplicationSync();');
    expect(shellSource).toContain('onSyncNow={handleSettingsSyncNow}');
    expect(settingsSource).toContain(
      "setStatusMessage('退出失败，当前账号仍保持登录；请检查系统存储权限后重试。');"
    );
    expect(settingsSource).toContain('onSyncNow: () => Promise<void>');
    expect(settingsSource).toContain('await onSyncNow();');
    expect(shellSource).toContain('await synchronizeDesktopWorkspace(userId);');
    const settingsSyncHandler = shellSource.slice(
      shellSource.indexOf('const handleSettingsSyncNow'),
      shellSource.indexOf('const dispatchDirectCreate')
    );
    expect(settingsSyncHandler).not.toContain('closeSettings(');
    expect(settingsSyncHandler).not.toContain('router.push(');
    expect(settingsSource).toContain('await signOutUser()');
    expect(settingsSource).not.toContain('登录账号');
  });

  it('passes the shell-owned state without introducing another sync listener', () => {
    expect(shellSource).toContain('session={session}');
    expect(shellSource).toContain('syncStatus={syncStatus}');
    expect(shellSource).toContain('syncUpdatedAt={syncUpdatedAt}');
    expect(shellSource).toContain('onSyncNow={handleSettingsSyncNow}');
    expect(settingsSource).not.toContain('addEventListener(DESKTOP_SYNC_STATUS_EVENT');
  });
});
