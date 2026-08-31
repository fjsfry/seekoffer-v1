'use client';

import {
  CheckCircle2,
  CircleAlert,
  Download,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  X
} from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from 'react';
import { createPortal } from 'react-dom';
import {
  DESKTOP_UPDATER_PREFERENCES_RESET_EVENT,
  createInitialDesktopUpdaterState,
  desktopUpdaterReducer,
  getDesktopUpdaterAttention,
  getDesktopUpdaterCheckDelay,
  getDesktopUpdaterErrorPresentation,
  getDesktopUpdaterFacade,
  isDesktopUpdaterRuntime,
  normalizeDesktopUpdaterError,
  readDesktopUpdaterAutoCheck,
  readDesktopUpdaterFailureCount,
  readDesktopUpdaterLastCheck,
  retainDesktopUpdaterListener,
  writeDesktopUpdaterAutoCheck,
  writeDesktopUpdaterFailureCount,
  writeDesktopUpdaterLastCheck,
  type DesktopUpdaterAttention,
  type DesktopUpdaterCheckOrigin,
  type DesktopUpdaterError,
  type DesktopUpdaterState
} from '@/lib/desktop-updater';
import {
  DESKTOP_SYNC_STATUS_EVENT,
  emitDesktopFeedback,
  type DesktopSyncStatus
} from '@/lib/desktop-route-events';
import {
  DESKTOP_PENDING_WRITES_EVENT,
  getDesktopPendingWriteCount,
  hasDesktopPendingWrites,
  type DesktopPendingWriteSnapshot
} from '@/lib/desktop-pending-writes';

type DesktopUpdateContextValue = {
  state: DesktopUpdaterState;
  autoCheckEnabled: boolean;
  syncStatus: DesktopSyncStatus;
  pendingWriteCount: number;
  setAutoCheckEnabled: (enabled: boolean) => void;
  checkNow: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  requestInstall: (returnFocusTo?: HTMLElement | null) => void;
};

type DesktopUpdateShellContextValue = {
  attention: DesktopUpdaterAttention;
  checkNow: () => Promise<void>;
};

const DesktopUpdateContext = createContext<DesktopUpdateContextValue | null>(null);
const DesktopUpdateShellContext = createContext<DesktopUpdateShellContextValue | null>(null);

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

function formatLastChecked(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return '尚未检查';

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(value));
}

function getUpdateStatusCopy(state: DesktopUpdaterState) {
  if (state.phase === 'checking') return '正在检查新版本…';
  if (state.phase === 'upToDate') return '当前已是最新版本';
  if (state.phase === 'available') return `发现新版本 ${state.version || ''}`.trim();
  if (state.phase === 'downloading') return '正在后台下载更新…';
  if (state.phase === 'readyToInstall') return '更新已下载，重启后即可使用';
  if (state.phase === 'installing') return '正在关闭并重启寻鹿…';
  if (state.phase === 'unsupported') return '仅 Windows 桌面安装版支持软件更新';
  if (state.phase === 'error') return state.errorMessage || '软件更新暂时无法完成';
  return '可检查软件更新';
}

function getUpdateErrorFeedback(
  error: DesktopUpdaterError,
  failedOperation: NonNullable<DesktopUpdaterState['failedOperation']>
) {
  const presentation = getDesktopUpdaterErrorPresentation({
    errorCode: error.code,
    errorMessage: error.message,
    retryable: error.retryable,
    failedOperation
  }, readDesktopUpdaterAutoCheck());
  return `${presentation.title}。${presentation.description}`;
}

function DesktopUpdaterSwitch({
  checked,
  onChange
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`desktop-setting-switch${checked ? ' desktop-setting-switch--checked' : ''}`}>
      <input
        className="desktop-setting-switch-input"
        type="checkbox"
        checked={checked}
        aria-label="自动检查软件更新"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="desktop-setting-switch-track" aria-hidden="true">
        <span className="desktop-setting-switch-thumb" />
      </span>
    </label>
  );
}

function DesktopUpdateRestartDialog({
  open,
  busy,
  blocked,
  returnFocusTo,
  onCancel,
  onConfirm
}: {
  open: boolean;
  busy: boolean;
  blocked: boolean;
  returnFocusTo: HTMLElement | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    const reduceMotion =
      document.documentElement.dataset.desktopReduceMotion === 'true' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (open) {
      setMounted(true);
      if (reduceMotion) {
        setVisible(true);
        return;
      }
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    if (reduceMotion) {
      setMounted(false);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), 120);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;

    const overlay = overlayRef.current;
    const background = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== overlay)
      .map((element) => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute('aria-hidden')
      }));
    for (const item of background) {
      item.element.inert = true;
      item.element.setAttribute('aria-hidden', 'true');
    }

    const frame = window.requestAnimationFrame(() => cancelRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      for (const item of background) {
        item.element.inert = item.inert;
        if (item.ariaHidden === null) item.element.removeAttribute('aria-hidden');
        else item.element.setAttribute('aria-hidden', item.ariaHidden);
      }
      window.requestAnimationFrame(() => returnFocusTo?.isConnected && returnFocusTo.focus());
    };
  }, [mounted, returnFocusTo]);

  if (!mounted || typeof document === 'undefined') return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !busy) {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      ) || []
    );
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div
      ref={overlayRef}
      className="desktop-global-dialog-backdrop desktop-update-restart-backdrop"
      data-state={visible ? 'open' : 'closed'}
      aria-hidden={visible ? undefined : true}
      onMouseDown={(event) => {
        if (visible && event.target === event.currentTarget && !busy) onCancel();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="desktop-update-restart-title"
        aria-describedby="desktop-update-restart-description"
        data-state={visible ? 'open' : 'closed'}
        className="desktop-global-dialog-panel desktop-update-restart-dialog"
      >
        <div className="desktop-global-dialog-header">
          <span className="desktop-global-dialog-icon desktop-global-dialog-icon--update">
            <RotateCw className="desktop-global-dialog-glyph" aria-hidden="true" />
          </span>
          <div className="desktop-global-dialog-copy">
            <h2 id="desktop-update-restart-title" className="desktop-global-dialog-title">
              重启并完成更新
            </h2>
            <p id="desktop-update-restart-description" className="desktop-global-dialog-description">
              {blocked
                ? '正在保存申请数据，完成后才能安全重启更新。'
                : '寻鹿会关闭当前窗口，安装完成后自动重新打开。已保存的申请数据不会丢失。'}
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭更新确认窗口"
            disabled={busy}
            onClick={onCancel}
            className="desktop-global-dialog-close"
          >
            <X className="desktop-global-dialog-close-glyph" aria-hidden="true" />
          </button>
        </div>
        <div className="desktop-global-dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="desktop-global-dialog-secondary"
          >
            稍后
          </button>
          <button
            type="button"
            disabled={busy || blocked}
            onClick={onConfirm}
            className="desktop-global-dialog-primary"
          >
            {blocked ? '正在保存申请数据…' : busy ? '正在重启…' : '重启并更新'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function DesktopGlobalUpdateBar() {
  const { state, pendingWriteCount, downloadUpdate, requestInstall } = useDesktopUpdater();
  const [dismissedKey, setDismissedKey] = useState('');
  const shouldShow = state.phase === 'available' || state.phase === 'readyToInstall';
  const noticeKey = `${state.phase}:${state.version || ''}`;
  const requestedVisible = shouldShow && dismissedKey !== noticeKey;
  const [mounted, setMounted] = useState(requestedVisible);
  const [visible, setVisible] = useState(requestedVisible);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const reduceMotion =
      document.documentElement.dataset.desktopReduceMotion === 'true' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    if (requestedVisible) {
      setMounted(true);
      if (reduceMotion) {
        setVisible(true);
        return;
      }
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    if (reduceMotion) {
      setMounted(false);
      return;
    }
    exitTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      exitTimerRef.current = null;
    }, 120);
    return () => {
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    };
  }, [requestedVisible]);

  if (!mounted) return null;

  const ready = state.phase === 'readyToInstall';
  return (
    <aside
      className="desktop-update-toast"
      role="status"
      aria-live="polite"
      aria-label={ready ? '软件更新已准备好' : '发现软件更新'}
      data-state={visible ? 'open' : 'closed'}
      aria-hidden={visible ? undefined : true}
    >
      <span className="desktop-update-toast-icon">
        {ready ? <CheckCircle2 className="desktop-update-toast-glyph" aria-hidden="true" /> : <Download className="desktop-update-toast-glyph" aria-hidden="true" />}
      </span>
      <div className="desktop-update-toast-copy">
        <strong className="desktop-update-toast-title">
          {ready ? '更新已准备好' : `发现新版本 ${state.version || ''}`.trim()}
        </strong>
        <span className="desktop-update-toast-description">
          {ready ? '重启后即可使用，当前内容不会丢失。' : '可在后台下载，不影响当前操作。'}
        </span>
      </div>
      <button
        type="button"
        disabled={ready && pendingWriteCount > 0}
        onClick={(event) => {
          if (ready) requestInstall(event.currentTarget);
          else void downloadUpdate();
        }}
        className="desktop-update-toast-action"
      >
        {ready ? (pendingWriteCount > 0 ? '正在保存申请数据' : '重启更新') : '后台下载'}
      </button>
      <button
        type="button"
        aria-label="稍后处理软件更新"
        onClick={() => setDismissedKey(noticeKey)}
        className="desktop-update-toast-dismiss"
      >
        <X className="desktop-update-toast-dismiss-glyph" aria-hidden="true" />
      </button>
    </aside>
  );
}

export function DesktopUpdateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    desktopUpdaterReducer,
    process.env.NEXT_PUBLIC_SEEKOFFER_APP_VERSION || '',
    createInitialDesktopUpdaterState
  );
  const [autoCheckEnabled, setAutoCheckEnabledState] = useState(true);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<DesktopSyncStatus>('idle');
  const [pendingWriteCount, setPendingWriteCount] = useState(0);
  const [scheduleRevision, setScheduleRevision] = useState(0);
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  const [returnFocusTo, setReturnFocusTo] = useState<HTMLElement | null>(null);
  const operationRef = useRef<'check' | 'download' | 'install' | null>(null);

  useEffect(() => {
    setAutoCheckEnabledState(readDesktopUpdaterAutoCheck());
    setPreferencesReady(true);

    if (!isDesktopUpdaterRuntime()) {
      dispatch({ type: 'runtime-unavailable' });
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | undefined;
    setRuntimeReady(true);
    void getDesktopUpdaterFacade()
      .then(async (facade) => {
        const disposeProgressListener = await facade.listenProgress((progress) => {
          if (!disposed) dispatch({ type: 'download-progress', progress });
        });
        const activeProgressListener = retainDesktopUpdaterListener(
          disposed,
          disposeProgressListener
        );
        if (!activeProgressListener) return;
        unlisten = activeProgressListener;
        const snapshot = await facade.getSnapshot();
        if (disposed) return;
        const persistedLastCheckedAt = readDesktopUpdaterLastCheck();
        dispatch({
          type: 'snapshot-received',
          snapshot,
          checkedAt: snapshot.lastCheckedAt || persistedLastCheckedAt || undefined
        });
        if (snapshot.lastCheckedAt) writeDesktopUpdaterLastCheck(snapshot.lastCheckedAt);
        if (
          snapshot.phase === 'upToDate' ||
          snapshot.phase === 'available' ||
          snapshot.phase === 'readyToInstall'
        ) {
          writeDesktopUpdaterFailureCount(0);
        }
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    function handlePendingWrites(event: Event) {
      const snapshot = (event as CustomEvent<DesktopPendingWriteSnapshot>).detail;
      if (snapshot && Number.isInteger(snapshot.count) && snapshot.count >= 0) {
        setPendingWriteCount(snapshot.count);
      }
    }

    window.addEventListener(DESKTOP_PENDING_WRITES_EVENT, handlePendingWrites);
    setPendingWriteCount(getDesktopPendingWriteCount());
    return () => window.removeEventListener(DESKTOP_PENDING_WRITES_EVENT, handlePendingWrites);
  }, []);

  useEffect(() => {
    const handleUpdaterPreferencesReset = () => setAutoCheckEnabledState(true);
    window.addEventListener(DESKTOP_UPDATER_PREFERENCES_RESET_EVENT, handleUpdaterPreferencesReset);
    return () => window.removeEventListener(DESKTOP_UPDATER_PREFERENCES_RESET_EVENT, handleUpdaterPreferencesReset);
  }, []);

  useEffect(() => {
    function handleSyncStatus(event: Event) {
      const next = (event as CustomEvent<DesktopSyncStatus>).detail;
      if (next === 'idle' || next === 'local' || next === 'syncing' || next === 'synced' || next === 'error') {
        setSyncStatus(next);
      }
    }

    window.addEventListener(DESKTOP_SYNC_STATUS_EVENT, handleSyncStatus);
    return () => window.removeEventListener(DESKTOP_SYNC_STATUS_EVENT, handleSyncStatus);
  }, []);

  const runCheck = useCallback(async (origin: DesktopUpdaterCheckOrigin) => {
    if (operationRef.current) {
      if (origin === 'manual') {
        emitDesktopFeedback({ message: '软件更新任务正在进行，请稍候。', tone: 'neutral' });
      }
      return;
    }

    operationRef.current = 'check';
    dispatch({ type: 'check-started', origin });
    try {
      const facade = await getDesktopUpdaterFacade();
      const snapshot = await facade.check(origin === 'manual');
      const checkedAt = snapshot.lastCheckedAt || new Date().toISOString();
      writeDesktopUpdaterLastCheck(checkedAt);
      writeDesktopUpdaterFailureCount(0);
      dispatch({ type: 'snapshot-received', snapshot, origin, checkedAt });
      if (origin === 'manual') {
        const errorFeedback = snapshot.phase === 'error'
          ? getUpdateErrorFeedback({
              code: snapshot.errorCode || 'UPDATE_FAILED',
              message: snapshot.errorMessage || '软件更新暂时无法完成。',
              retryable: snapshot.retryable
            }, 'check')
          : null;
        emitDesktopFeedback({
          message:
            errorFeedback || (snapshot.phase === 'available'
              ? `发现新版本 ${snapshot.version || ''}`.trim()
              : snapshot.phase === 'upToDate'
                ? '当前已是最新版本'
                : snapshot.phase === 'readyToInstall'
                  ? '更新已下载，重启后即可使用'
                  : '软件更新状态已刷新'),
          tone: snapshot.phase === 'error' ? 'warning' : 'success'
        });
      }
    } catch (error) {
      const normalized = normalizeDesktopUpdaterError(error);
      const checkedAt = new Date().toISOString();
      writeDesktopUpdaterLastCheck(checkedAt);
      writeDesktopUpdaterFailureCount(readDesktopUpdaterFailureCount() + 1);
      dispatch({
        type: 'operation-failed',
        operation: 'check',
        origin,
        checkedAt,
        error: normalized
      });
      if (origin === 'manual') {
        emitDesktopFeedback({
          message: getUpdateErrorFeedback(normalized, 'check'),
          tone: 'warning',
          duration: 6000
        });
      }
    } finally {
      operationRef.current = null;
      if (origin === 'manual') {
        setScheduleRevision((current) => current + 1);
      }
    }
  }, []);

  useEffect(() => {
    if (!preferencesReady || !runtimeReady || !autoCheckEnabled) return;

    let cancelled = false;
    let timer: number | undefined;
    const schedule = (delay: number) => {
      timer = window.setTimeout(async () => {
        if (cancelled) return;
        const dueIn = getDesktopUpdaterCheckDelay(
          Date.now(),
          readDesktopUpdaterLastCheck(),
          readDesktopUpdaterFailureCount()
        );
        if (dueIn > 15_000) {
          schedule(dueIn);
          return;
        }
        await runCheck('automatic');
        if (!cancelled) {
          schedule(
            getDesktopUpdaterCheckDelay(
              Date.now(),
              readDesktopUpdaterLastCheck(),
              readDesktopUpdaterFailureCount()
            )
          );
        }
      }, delay);
    };
    schedule(
      getDesktopUpdaterCheckDelay(
        Date.now(),
        readDesktopUpdaterLastCheck(),
        readDesktopUpdaterFailureCount()
      )
    );

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [autoCheckEnabled, preferencesReady, runCheck, runtimeReady, scheduleRevision]);

  const setAutoCheckEnabled = useCallback((enabled: boolean) => {
    setAutoCheckEnabledState(writeDesktopUpdaterAutoCheck(enabled));
    emitDesktopFeedback({
      message: enabled ? '已开启自动检查更新' : '已关闭自动检查更新',
      tone: 'success'
    });
  }, []);

  const checkNow = useCallback(() => runCheck('manual'), [runCheck]);

  const downloadUpdate = useCallback(async () => {
    if (operationRef.current) return;
    operationRef.current = 'download';
    dispatch({ type: 'download-started' });
    try {
      const facade = await getDesktopUpdaterFacade();
      const snapshot = await facade.download();
      dispatch({ type: 'snapshot-received', snapshot });
      if (snapshot.phase === 'readyToInstall') {
        emitDesktopFeedback({ message: '更新已下载，重启后即可使用。', tone: 'success' });
      }
    } catch (error) {
      const normalized = normalizeDesktopUpdaterError(error);
      dispatch({ type: 'operation-failed', operation: 'download', error: normalized });
      emitDesktopFeedback({
        message: getUpdateErrorFeedback(normalized, 'download'),
        tone: 'warning',
        duration: 6000
      });
    } finally {
      operationRef.current = null;
    }
  }, []);

  const requestInstall = useCallback((target?: HTMLElement | null) => {
    if (hasDesktopPendingWrites()) {
      const message = '正在保存申请数据，完成后再重启更新。';
      dispatch({ type: 'install-blocked', message });
      emitDesktopFeedback({ message, tone: 'neutral' });
      return;
    }
    setReturnFocusTo(target || (document.activeElement instanceof HTMLElement ? document.activeElement : null));
    setRestartDialogOpen(true);
  }, []);

  const installUpdate = useCallback(async () => {
    if (hasDesktopPendingWrites()) {
      const message = '正在保存申请数据，完成后再重启更新。';
      dispatch({ type: 'install-blocked', message });
      return;
    }
    if (operationRef.current) return;

    operationRef.current = 'install';
    dispatch({ type: 'install-started' });
    try {
      const facade = await getDesktopUpdaterFacade();
      await facade.install();
    } catch (error) {
      const normalized = normalizeDesktopUpdaterError(error);
      dispatch({ type: 'operation-failed', operation: 'install', error: normalized });
      setRestartDialogOpen(false);
      emitDesktopFeedback({
        message: getUpdateErrorFeedback(normalized, 'install'),
        tone: 'warning',
        duration: 6000
      });
    } finally {
      operationRef.current = null;
    }
  }, []);

  const contextValue = useMemo<DesktopUpdateContextValue>(() => ({
    state,
    autoCheckEnabled,
    syncStatus,
    pendingWriteCount,
    setAutoCheckEnabled,
    checkNow,
    downloadUpdate,
    requestInstall
  }), [
    autoCheckEnabled,
    checkNow,
    downloadUpdate,
    requestInstall,
    setAutoCheckEnabled,
    state,
    syncStatus,
    pendingWriteCount
  ]);
  const updaterAttention = useMemo(
    () => getDesktopUpdaterAttention({
      phase: state.phase,
      version: state.version,
      failedOperation: state.failedOperation,
      errorCode: state.errorCode
    }, autoCheckEnabled),
    [autoCheckEnabled, state.errorCode, state.failedOperation, state.phase, state.version]
  );
  const shellContextValue = useMemo<DesktopUpdateShellContextValue>(() => ({
    attention: updaterAttention,
    checkNow
  }), [checkNow, updaterAttention]);

  return (
    <DesktopUpdateContext.Provider value={contextValue}>
      <DesktopUpdateShellContext.Provider value={shellContextValue}>
        {children}
      </DesktopUpdateShellContext.Provider>
      <DesktopGlobalUpdateBar />
      <DesktopUpdateRestartDialog
        open={restartDialogOpen}
        busy={state.phase === 'installing'}
        blocked={pendingWriteCount > 0}
        returnFocusTo={returnFocusTo}
        onCancel={() => setRestartDialogOpen(false)}
        onConfirm={() => void installUpdate()}
      />
    </DesktopUpdateContext.Provider>
  );
}

export function useDesktopUpdater() {
  const value = useContext(DesktopUpdateContext);
  if (!value) throw new Error('useDesktopUpdater must be used within DesktopUpdateProvider');
  return value;
}

export function useDesktopUpdaterShell() {
  const value = useContext(DesktopUpdateShellContext);
  if (!value) throw new Error('useDesktopUpdaterShell must be used within DesktopUpdateProvider');
  return value;
}

export function DesktopSoftwareUpdateSettings() {
  const {
    state,
    autoCheckEnabled,
    pendingWriteCount,
    setAutoCheckEnabled,
    checkNow,
    downloadUpdate,
    requestInstall
  } = useDesktopUpdater();
  const actionRef = useRef<HTMLButtonElement>(null);
  const busy = state.phase === 'checking' || state.phase === 'downloading' || state.phase === 'installing';
  const progressText = state.totalBytes
    ? `${formatBytes(state.downloadedBytes)} / ${formatBytes(state.totalBytes)}`
    : formatBytes(state.downloadedBytes);
  const notes = state.notes
    ? state.notes
        .split(/\r?\n/)
        .filter((item) => /^\s*[-*•]\s+/.test(item))
        .map((item) => item.replace(/^\s*[-*•]\s+/, '').trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];
  const securityVerificationFailed = state.errorCode === 'UPDATE_SIGNATURE_ERROR';
  const installFailed =
    state.failedOperation === 'install' || state.errorCode === 'UPDATE_INSTALL_ERROR';
  const errorPresentation = state.phase === 'error'
    ? getDesktopUpdaterErrorPresentation(state, autoCheckEnabled)
    : null;

  function handlePrimaryAction() {
    if (state.phase === 'readyToInstall') {
      requestInstall(actionRef.current);
      return;
    }
    if (state.phase === 'error' && securityVerificationFailed) {
      void checkNow();
      return;
    }
    if (state.phase === 'error' && installFailed && state.downloadedBytes > 0) {
      requestInstall(actionRef.current);
      return;
    }
    if (
      state.phase === 'available' ||
      (state.phase === 'error' && state.failedOperation === 'download' && state.version)
    ) {
      void downloadUpdate();
      return;
    }
    void checkNow();
  }

  const actionLabel = (() => {
    if (state.phase === 'checking') return '正在检查…';
    if (state.phase === 'available') return '下载更新';
    if (state.phase === 'downloading') return '正在下载…';
    if (state.phase === 'readyToInstall') return pendingWriteCount > 0 ? '正在保存申请数据…' : '重启并更新';
    if (state.phase === 'installing') return '正在重启…';
    if (state.phase === 'error') {
      if (securityVerificationFailed) return '重新检查';
      if (installFailed && state.downloadedBytes > 0) return '重新安装';
      if (state.failedOperation === 'download') return '重新下载';
      return '重新检查';
    }
    return '检查更新';
  })();

  const StatusIcon = state.phase === 'error'
    ? securityVerificationFailed ? ShieldCheck : CircleAlert
    : state.phase === 'available' || state.phase === 'downloading'
      ? Download
      : state.phase === 'readyToInstall' || state.phase === 'upToDate'
        ? CheckCircle2
        : RefreshCw;

  return (
    <div className="desktop-settings-group" aria-labelledby="desktop-settings-update-title">
      <div className="desktop-settings-group-heading">
        <h3 id="desktop-settings-update-title">软件更新</h3>
        <p>稳定版更新在应用内完成；检查和下载不会打断当前申请工作。</p>
      </div>

      <div className="desktop-setting-row">
        <span className="desktop-setting-leading-icon">
          <RefreshCw aria-hidden="true" />
        </span>
        <div className="desktop-setting-copy">
          <span className="desktop-setting-label">自动检查更新</span>
          <p>启动后延迟检查，之后每 6 小时检查一次；有新版本或异常时，设置入口会显示红点。</p>
        </div>
        <div className="desktop-setting-control">
          <DesktopUpdaterSwitch checked={autoCheckEnabled} onChange={setAutoCheckEnabled} />
        </div>
      </div>

      <div className="desktop-setting-row desktop-setting-row--emphasis">
        <span className="desktop-setting-leading-icon">
          <StatusIcon aria-hidden="true" />
        </span>
        <div className="desktop-setting-copy" role="status" aria-live="polite" aria-atomic="true">
          <span className="desktop-setting-label">
            {errorPresentation?.title || getUpdateStatusCopy(state)}
          </span>
          {errorPresentation ? <p>{errorPresentation.description}</p> : null}
          <p>
            当前版本 {state.currentVersion || process.env.NEXT_PUBLIC_SEEKOFFER_APP_VERSION || '开发版'}
            {' · '}上次检查 {formatLastChecked(state.lastCheckedAt)}
          </p>
          {state.phase === 'readyToInstall' ? <p>点击后寻鹿会关闭并自动重新打开。</p> : null}
          {state.phase !== 'error' && state.statusMessage && state.statusMessage !== getUpdateStatusCopy(state) ? (
            <span className="desktop-setting-status">
              {state.statusMessage}
            </span>
          ) : null}
        </div>
        <div className="desktop-setting-control">
          <button
            ref={actionRef}
            type="button"
            className="desktop-setting-secondary-button"
            disabled={busy || state.phase === 'unsupported' || (state.phase === 'readyToInstall' && pendingWriteCount > 0)}
            onClick={handlePrimaryAction}
          >
            {state.phase === 'downloading' ? <Download aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            {actionLabel}
          </button>
        </div>
      </div>

      {state.phase === 'downloading' ? (
        <div className="desktop-setting-row desktop-setting-row--stacked">
          <div className="desktop-update-progress-summary">
            <span>下载进度</span>
            <span className="desktop-update-progress-value">{state.percent === null ? progressText : `${Math.round(state.percent)}% · ${progressText}`}</span>
          </div>
          <div
            className="desktop-update-progress-track"
            role="progressbar"
            aria-label="软件更新下载进度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={state.percent === null ? undefined : Math.round(state.percent)}
            aria-valuetext={state.percent === null ? `已下载 ${progressText}` : `已下载 ${Math.round(state.percent)}%`}
          >
            <span
              className="desktop-update-progress-indicator"
              style={{ width: `${state.percent ?? 0}%` }}
            />
          </div>
        </div>
      ) : null}

      {notes.length ? (
        <div className="desktop-setting-row desktop-setting-row--stacked">
          <div className="desktop-setting-copy">
            <span className="desktop-setting-label">版本 {state.version} 更新内容</span>
            <ul className="desktop-update-release-notes">
              {notes.map((note, index) => <li key={`${index}-${note}`}>· {note}</li>)}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
