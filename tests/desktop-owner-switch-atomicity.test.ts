import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();

function readComponent(name: string) {
  return readFileSync(join(projectRoot, 'components', name), 'utf8');
}

function getContextRestoreEffect(source: string) {
  const readIndex = source.indexOf('const context = readContext(contextKey);');
  const effectStart = source.lastIndexOf('useEffect(() => {', readIndex);
  const effectEnd = source.indexOf('}, [contextKey]);', readIndex);

  expect(readIndex).toBeGreaterThan(-1);
  expect(effectStart).toBeGreaterThan(-1);
  expect(effectEnd).toBeGreaterThan(readIndex);
  return source.slice(effectStart, effectEnd);
}

describe('desktop owner-switch persistence atomicity', () => {
  it.each([
    'desktop-schedule-workspace.tsx',
    'desktop-contacts-workspace.tsx'
  ])('blocks stale context writes before restoring a new owner in %s', (name) => {
    const restoreEffect = getContextRestoreEffect(readComponent(name));
    const resetIndex = restoreEffect.indexOf('restoredRef.current = false;');
    const readIndex = restoreEffect.indexOf('const context = readContext(contextKey);');

    expect(resetIndex).toBeGreaterThan(-1);
    expect(resetIndex).toBeLessThan(readIndex);
    expect(restoreEffect).toContain(
      'return () => window.cancelAnimationFrame(restoreFrame);'
    );
  });

  it('persists reminder state only after the state for the current account key has committed', () => {
    const source = readComponent('desktop-reminder-center.tsx');
    const restoreStart = source.indexOf('useEffect(() => {', source.indexOf('const stateReady ='));
    const restoreEnd = source.indexOf('}, [reminderStateKey]);', restoreStart);
    const restoreEffect = source.slice(restoreStart, restoreEnd);
    const invalidateIndex = restoreEffect.indexOf("setReadyStateKey('');");
    const readIndex = restoreEffect.indexOf('setState(readReminderState(reminderStateKey));');
    const commitIndex = restoreEffect.indexOf('setReadyStateKey(reminderStateKey);');

    expect(source).toContain(
      'const stateReady = readyStateKey === reminderStateKey;'
    );
    expect(invalidateIndex).toBeGreaterThan(-1);
    expect(invalidateIndex).toBeLessThan(readIndex);
    expect(readIndex).toBeLessThan(commitIndex);
    expect(source).toContain(
      'if (!stateReady || readyStateKey !== reminderStateKey) return;'
    );
  });

  it('cancels an in-flight native notification task before another account can inherit it', () => {
    const source = readComponent('desktop-reminder-center.tsx');
    const taskStart = source.indexOf(
      'const notificationTaskId = runtimeNotificationTaskRef.current + 1;'
    );
    const taskEnd = source.indexOf('\n  }, [', taskStart);
    const notificationTask = source.slice(taskStart, taskEnd);
    const importIndex = notificationTask.indexOf(
      "await import('@tauri-apps/plugin-notification')"
    );
    const permissionIndex = notificationTask.indexOf(
      'await notification.isPermissionGranted()'
    );
    const sendIndex = notificationTask.indexOf('notification.sendNotification({');
    const ledgerIndex = notificationTask.indexOf(
      'writeRuntimeNotificationLedger(runtimeNotificationStateKey,'
    );

    expect(source).toContain('const runtimeNotificationTaskRef = useRef(0);');
    expect(notificationTask).toContain(
      'const isCurrentNotificationTask = () =>'
    );
    expect(notificationTask).toContain('let cancelled = false;');
    expect(notificationTask).toContain('cancelled = true;');
    expect(notificationTask).toContain('runtimeNotificationTaskRef.current += 1;');
    expect(notificationTask).toContain('if (!isCurrentNotificationTask()) return;');
    expect(notificationTask).toContain(
      'if (!isCurrentNotificationTask() || !permissionGranted) return;'
    );
    expect(importIndex).toBeGreaterThan(-1);
    expect(permissionIndex).toBeGreaterThan(importIndex);
    expect(sendIndex).toBeGreaterThan(permissionIndex);
    expect(ledgerIndex).toBeGreaterThan(sendIndex);
  });

  it('cancels the previous account context debounce before resetting owner state', () => {
    const source = readComponent('desktop-home.tsx');
    const ownerResetIndex = source.indexOf("contextReadyUserRef.current = '';");
    const effectStart = source.lastIndexOf('useEffect(() => {', ownerResetIndex);
    const ownerEffect = source.slice(effectStart, source.indexOf('}, [userId]);', ownerResetIndex));
    const clearIndex = ownerEffect.indexOf(
      'window.clearTimeout(contextSaveTimerRef.current);'
    );
    const resetIndex = ownerEffect.indexOf("contextReadyUserRef.current = '';");

    expect(clearIndex).toBeGreaterThan(-1);
    expect(clearIndex).toBeLessThan(resetIndex);
    expect(ownerEffect).toContain('contextSaveTimerRef.current = null;');
  });
});
