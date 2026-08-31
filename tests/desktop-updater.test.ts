import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  DESKTOP_UPDATER_CHECK_INTERVAL_MS,
  DESKTOP_UPDATER_FAILURE_BACKOFFS_MS,
  DESKTOP_UPDATER_INITIAL_DELAY_MS,
  createDesktopUpdaterFacade,
  createInitialDesktopUpdaterState,
  desktopUpdaterReducer,
  getDesktopUpdaterAttention,
  getDesktopUpdaterCheckDelay,
  getDesktopUpdaterErrorPresentation,
  getDesktopUpdaterFailureBackoff,
  normalizeDesktopUpdaterSnapshot,
  readDesktopUpdaterAutoCheck,
  readDesktopUpdaterFailureCount,
  resetDesktopUpdaterPreferences,
  retainDesktopUpdaterListener,
  writeDesktopUpdaterAutoCheck,
  writeDesktopUpdaterFailureCount
} from '@/lib/desktop-updater';

const projectRoot = resolve(process.cwd());

function nativeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    version: null,
    currentVersion: '0.2.6',
    notes: null,
    publishedAt: null,
    phase: 'upToDate',
    downloadedBytes: 0,
    totalBytes: null,
    percent: null,
    errorCode: null,
    errorMessage: null,
    retryable: true,
    lastCheckedAt: Date.UTC(2026, 7, 10, 6, 30),
    ...overrides
  };
}

describe('desktop updater state and scheduling', () => {
  it('normalizes the native snapshot contract, including epoch timestamps and bounded progress', () => {
    const snapshot = normalizeDesktopUpdaterSnapshot(
      nativeSnapshot({
        version: '0.2.7',
        phase: 'downloading',
        downloadedBytes: 150,
        totalBytes: 100,
        percent: 150
      })
    );

    expect(snapshot.phase).toBe('downloading');
    expect(snapshot.percent).toBe(100);
    expect(snapshot.lastCheckedAt).toBe('2026-08-10T06:30:00.000Z');
  });

  it('keeps automatic failures silent while manual failures remain explicit', () => {
    const checkingAutomatically = desktopUpdaterReducer(createInitialDesktopUpdaterState('0.2.6'), {
      type: 'check-started',
      origin: 'automatic'
    });
    const checkedAt = '2026-08-10T08:00:00.000Z';
    const automaticFailure = desktopUpdaterReducer(checkingAutomatically, {
      type: 'operation-failed',
      operation: 'check',
      origin: 'automatic',
      checkedAt,
      error: { code: 'OFFLINE', message: '网络不可用', retryable: true }
    });
    expect(automaticFailure.phase).toBe('error');
    expect(automaticFailure.statusMessage).toBe('');
    expect(automaticFailure.lastCheckedAt).toBe(checkedAt);

    const manualFailure = desktopUpdaterReducer(createInitialDesktopUpdaterState('0.2.6'), {
      type: 'operation-failed',
      operation: 'check',
      origin: 'manual',
      error: { code: 'OFFLINE', message: '网络不可用', retryable: true }
    });
    expect(manualFailure.statusMessage).toBe('网络不可用');
  });

  it('fills a missing native last-check timestamp from the persisted scheduler value', () => {
    const persistedLastCheckedAt = '2026-08-10T07:45:00.000Z';
    const result = desktopUpdaterReducer(createInitialDesktopUpdaterState('0.2.6'), {
      type: 'snapshot-received',
      snapshot: normalizeDesktopUpdaterSnapshot(nativeSnapshot({ lastCheckedAt: null })),
      checkedAt: persistedLastCheckedAt
    });

    expect(result.lastCheckedAt).toBe(persistedLastCheckedAt);
  });

  it('turns the finished download event into a restart-ready state with real progress', () => {
    const downloading = desktopUpdaterReducer(createInitialDesktopUpdaterState('0.2.6'), {
      type: 'download-started'
    });
    const result = desktopUpdaterReducer(downloading, {
      type: 'download-progress',
      progress: {
        event: 'finished',
        downloadedBytes: 32 * 1024 * 1024,
        totalBytes: 32 * 1024 * 1024,
        percent: 100
      }
    });

    expect(result.phase).toBe('readyToInstall');
    expect(result.percent).toBe(100);
    expect(result.statusMessage).toContain('重启');
  });

  it.each(['readyToInstall', 'error', 'installing', 'upToDate'] as const)(
    'ignores delayed progress events after the updater has reached %s',
    (phase) => {
      const settled = {
        ...createInitialDesktopUpdaterState('0.2.6'),
        phase,
        percent: phase === 'readyToInstall' ? 100 : null
      };
      const delayedProgress = desktopUpdaterReducer(settled, {
        type: 'download-progress',
        progress: {
          event: 'progress',
          downloadedBytes: 25,
          totalBytes: 100,
          percent: 25
        }
      });
      const delayedFinished = desktopUpdaterReducer(settled, {
        type: 'download-progress',
        progress: {
          event: 'finished',
          downloadedBytes: 100,
          totalBytes: 100,
          percent: 100
        }
      });

      expect(delayedProgress).toBe(settled);
      expect(delayedFinished).toBe(settled);
      expect(delayedProgress.phase).toBe(phase);
    }
  );

  it('preserves a known update when a later automatic refresh fails', () => {
    const available = desktopUpdaterReducer(createInitialDesktopUpdaterState('0.2.6'), {
      type: 'snapshot-received',
      snapshot: normalizeDesktopUpdaterSnapshot(nativeSnapshot({ version: '0.2.7', phase: 'available' }))
    });
    const checking = desktopUpdaterReducer(available, { type: 'check-started', origin: 'automatic' });
    const failed = desktopUpdaterReducer(checking, {
      type: 'operation-failed',
      operation: 'check',
      origin: 'automatic',
      error: { code: 'OFFLINE', message: '网络不可用', retryable: true }
    });

    expect(failed.phase).toBe('available');
    expect(failed.version).toBe('0.2.7');
    expect(failed.statusMessage).toBe('');
  });

  it('restores the correct retry action from a native install or signature error snapshot', () => {
    const installError = desktopUpdaterReducer(createInitialDesktopUpdaterState('0.2.6'), {
      type: 'snapshot-received',
      snapshot: normalizeDesktopUpdaterSnapshot(
        nativeSnapshot({ phase: 'error', errorCode: 'UPDATE_INSTALL_ERROR', downloadedBytes: 1024 })
      )
    });
    const signatureError = desktopUpdaterReducer(createInitialDesktopUpdaterState('0.2.6'), {
      type: 'snapshot-received',
      snapshot: normalizeDesktopUpdaterSnapshot(
        nativeSnapshot({ phase: 'error', errorCode: 'UPDATE_SIGNATURE_ERROR', downloadedBytes: 0 })
      )
    });

    expect(installError.failedOperation).toBe('install');
    expect(signatureError.failedOperation).toBe('download');
  });

  it('shows update attention on the settings entry and limits automatic check errors to opt-in users', () => {
    const available = desktopUpdaterReducer(createInitialDesktopUpdaterState('0.2.15'), {
      type: 'snapshot-received',
      snapshot: normalizeDesktopUpdaterSnapshot(
        nativeSnapshot({ version: '0.2.16', phase: 'available' })
      )
    });
    expect(getDesktopUpdaterAttention(available, false)).toEqual({
      kind: 'update',
      label: '发现软件更新 0.2.16'
    });

    const automaticCheckError = desktopUpdaterReducer(createInitialDesktopUpdaterState('0.2.15'), {
      type: 'operation-failed',
      operation: 'check',
      origin: 'automatic',
      error: {
        code: 'UPDATE_NETWORK_ERROR',
        message: '暂时无法连接更新服务，请检查网络后重试。',
        retryable: true
      }
    });
    expect(getDesktopUpdaterAttention(automaticCheckError, true)).toEqual({
      kind: 'error',
      label: '软件更新需要处理'
    });
    expect(getDesktopUpdaterAttention(automaticCheckError, false)).toBeNull();

    const downloadError = desktopUpdaterReducer(createInitialDesktopUpdaterState('0.2.15'), {
      type: 'operation-failed',
      operation: 'download',
      error: { code: 'UPDATE_DOWNLOAD_ERROR', message: '下载失败', retryable: true }
    });
    expect(getDesktopUpdaterAttention(downloadError, false)?.kind).toBe('error');
  });

  it('maps update failures to honest recovery copy without blaming the user network', () => {
    const networkError = desktopUpdaterReducer(createInitialDesktopUpdaterState('0.2.15'), {
      type: 'operation-failed',
      operation: 'check',
      origin: 'automatic',
      error: {
        code: 'UPDATE_NETWORK_ERROR',
        message: '暂时无法连接更新服务，请检查网络后重试。',
        retryable: true
      }
    });
    expect(getDesktopUpdaterErrorPresentation(networkError, true)).toEqual({
      title: '更新服务暂时不可用',
      description: '可能是当前网络或更新通道暂时无响应。自动检查已开启，寻鹿会稍后重试；也可以立即重新检查。'
    });

    const signatureError = desktopUpdaterReducer(createInitialDesktopUpdaterState('0.2.15'), {
      type: 'operation-failed',
      operation: 'download',
      error: {
        code: 'UPDATE_SIGNATURE_ERROR',
        message: '安全校验失败',
        retryable: false
      }
    });
    const securityCopy = getDesktopUpdaterErrorPresentation(signatureError, true);
    expect(securityCopy.title).toBe('更新包安全校验未通过');
    expect(securityCopy.description).toContain('不会安装未经验证的文件');
  });

  it('uses a 15 second first delay and a six hour recurring interval', () => {
    const now = Date.UTC(2026, 7, 10, 8);
    expect(getDesktopUpdaterCheckDelay(now, null)).toBe(DESKTOP_UPDATER_INITIAL_DELAY_MS);
    expect(getDesktopUpdaterCheckDelay(now, new Date(now - 60 * 60 * 1000).toISOString())).toBe(
      DESKTOP_UPDATER_CHECK_INTERVAL_MS - 60 * 60 * 1000
    );
    expect(getDesktopUpdaterCheckDelay(now, new Date(now - 7 * 60 * 60 * 1000).toISOString())).toBe(
      DESKTOP_UPDATER_INITIAL_DELAY_MS
    );
  });

  it('backs consecutive failures off from 15 minutes to one hour and then six hours', () => {
    const now = Date.UTC(2026, 7, 10, 8);
    expect(getDesktopUpdaterFailureBackoff(0)).toBe(0);
    expect(getDesktopUpdaterFailureBackoff(1)).toBe(DESKTOP_UPDATER_FAILURE_BACKOFFS_MS[0]);
    expect(getDesktopUpdaterFailureBackoff(2)).toBe(DESKTOP_UPDATER_FAILURE_BACKOFFS_MS[1]);
    expect(getDesktopUpdaterFailureBackoff(3)).toBe(DESKTOP_UPDATER_FAILURE_BACKOFFS_MS[2]);
    expect(getDesktopUpdaterFailureBackoff(20)).toBe(DESKTOP_UPDATER_FAILURE_BACKOFFS_MS[2]);

    expect(
      getDesktopUpdaterCheckDelay(now, new Date(now - 5 * 60 * 1000).toISOString(), 1)
    ).toBe(10 * 60 * 1000);
    expect(
      getDesktopUpdaterCheckDelay(now, new Date(now - 30 * 60 * 1000).toISOString(), 2)
    ).toBe(30 * 60 * 1000);
    expect(
      getDesktopUpdaterCheckDelay(now, new Date(now - 2 * 60 * 60 * 1000).toISOString(), 3)
    ).toBe(4 * 60 * 60 * 1000);
  });

  it('defaults automatic checks to enabled and persists an explicit opt-out', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    };

    expect(readDesktopUpdaterAutoCheck(storage)).toBe(true);
    writeDesktopUpdaterAutoCheck(false, storage);
    writeDesktopUpdaterFailureCount(2, storage);
    expect(readDesktopUpdaterAutoCheck(storage)).toBe(false);
    expect(readDesktopUpdaterFailureCount(storage)).toBe(2);
    resetDesktopUpdaterPreferences(storage);
    expect(readDesktopUpdaterAutoCheck(storage)).toBe(true);
    expect(readDesktopUpdaterFailureCount(storage)).toBe(0);
  });
});

describe('desktop updater Tauri facade', () => {
  it('deduplicates concurrent update checks into one native invoke', async () => {
    let release: ((value: unknown) => void) | undefined;
    const pending = new Promise<unknown>((resolvePromise) => {
      release = resolvePromise;
    });
    const invoke = vi.fn(() => pending);
    const listen = vi.fn(async () => () => undefined);
    const facade = createDesktopUpdaterFacade({
      invoke: invoke as unknown as Parameters<typeof createDesktopUpdaterFacade>[0]['invoke'],
      listen: listen as unknown as Parameters<typeof createDesktopUpdaterFacade>[0]['listen'],
      currentVersion: '0.2.6'
    });

    const first = facade.check(false);
    const second = facade.check(true);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('check_for_desktop_update', { manual: false });

    release?.(nativeSnapshot());
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  });

  it('subscribes to the shared native progress event and normalizes payloads', async () => {
    let nativeHandler: ((event: { payload: unknown }) => void) | undefined;
    const invoke = vi.fn(async () => nativeSnapshot());
    const listen = vi.fn(async (_event: string, handler: (event: { payload: unknown }) => void) => {
      nativeHandler = handler;
      return () => undefined;
    });
    const facade = createDesktopUpdaterFacade({
      invoke: invoke as unknown as Parameters<typeof createDesktopUpdaterFacade>[0]['invoke'],
      listen: listen as unknown as Parameters<typeof createDesktopUpdaterFacade>[0]['listen']
    });
    const progressHandler = vi.fn();

    await facade.listenProgress(progressHandler);
    nativeHandler?.({
      payload: { event: 'progress', downloadedBytes: 25, totalBytes: 100, percent: 25 }
    });

    expect(listen).toHaveBeenCalledWith('seekoffer-updater-progress', expect.any(Function));
    expect(progressHandler).toHaveBeenCalledWith({
      event: 'progress',
      downloadedBytes: 25,
      totalBytes: 100,
      percent: 25
    });
  });

  it('immediately disposes a progress listener that resolves after provider teardown', () => {
    const disposeAfterTeardown = vi.fn();
    expect(retainDesktopUpdaterListener(true, disposeAfterTeardown)).toBeNull();
    expect(disposeAfterTeardown).toHaveBeenCalledTimes(1);

    const activeDispose = vi.fn();
    expect(retainDesktopUpdaterListener(false, activeDispose)).toBe(activeDispose);
    expect(activeDispose).not.toHaveBeenCalled();
  });
});

describe('desktop updater integration contract', () => {
  it('runs outside the auth gate and exposes settings, command-palette, and tray entry points', async () => {
    const [layout, settings, shell, provider] = await Promise.all([
      readFile(resolve(projectRoot, 'app/build-surface.desktop.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-settings-page.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-app-shell.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-update-provider.tsx'), 'utf8')
    ]);

    expect(layout.indexOf('<DesktopUpdateProvider>')).toBeLessThan(layout.indexOf('<DesktopAuthGate>'));
    expect(settings).toContain('<DesktopSoftwareUpdateSettings />');
    expect(settings).toContain('resetDesktopUpdaterPreferences();');
    expect(shell).toContain("href: 'desktop://check-updates'");
    expect(shell).toContain("command === 'check-update'");
    expect(provider).toContain('() => getDesktopUpdaterAttention({');
    expect(provider).toContain('有新版本或异常时，设置入口会显示红点');
    expect(shell).toContain('className="desktop-settings-update-dot"');
    expect(shell).toContain('data-update-attention={updaterAttention?.kind}');
    expect(shell).toContain("openSettings(updaterAttention || section === 'settings' ? 'about' : 'general')");
    expect(provider).toContain("DESKTOP_SYNC_STATUS_EVENT");
    expect(provider).toContain('正在保存申请数据，完成后再重启更新。');
    expect(provider).toContain("state.errorCode === 'UPDATE_SIGNATURE_ERROR'");
    expect(provider).toContain("state.errorCode === 'UPDATE_INSTALL_ERROR'");
    expect(provider).toContain("return '可检查软件更新';");
    expect(provider).not.toContain('稳定版更新通道已就绪');
    expect(provider).not.toContain('DesktopReminderCenter');
  });
});
