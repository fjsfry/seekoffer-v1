export const DESKTOP_UPDATER_PROGRESS_EVENT = 'seekoffer-updater-progress';
export const DESKTOP_UPDATER_AUTO_CHECK_STORAGE_KEY = 'seekoffer-desktop-updater-auto-check-v1';
export const DESKTOP_UPDATER_LAST_CHECK_STORAGE_KEY = 'seekoffer-desktop-updater-last-check-v1';
export const DESKTOP_UPDATER_FAILURE_COUNT_STORAGE_KEY = 'seekoffer-desktop-updater-failure-count-v1';
export const DESKTOP_UPDATER_PREFERENCES_RESET_EVENT = 'seekoffer:desktop-updater-preferences-reset';
export const DESKTOP_UPDATER_INITIAL_DELAY_MS = 15_000;
export const DESKTOP_UPDATER_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const DESKTOP_UPDATER_FAILURE_BACKOFFS_MS = [
  15 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000
] as const;

export type DesktopUpdaterNativePhase =
  | 'idle'
  | 'checking'
  | 'upToDate'
  | 'available'
  | 'downloading'
  | 'readyToInstall'
  | 'installing'
  | 'error';

export type DesktopUpdaterPhase = DesktopUpdaterNativePhase | 'unsupported';
export type DesktopUpdaterCheckOrigin = 'automatic' | 'manual';

export type DesktopUpdaterSnapshot = {
  version: string | null;
  currentVersion: string;
  notes: string | null;
  publishedAt: string | null;
  phase: DesktopUpdaterNativePhase;
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  retryable: boolean;
  lastCheckedAt: string | null;
};

export type DesktopUpdaterProgress = {
  event: 'started' | 'progress' | 'finished';
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number | null;
};

export type DesktopUpdaterError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type DesktopUpdaterState = Omit<DesktopUpdaterSnapshot, 'phase'> & {
  phase: DesktopUpdaterPhase;
  checkOrigin: DesktopUpdaterCheckOrigin | null;
  failedOperation: 'check' | 'download' | 'install' | null;
  statusMessage: string;
};

export type DesktopUpdaterAttention = {
  kind: 'update' | 'error';
  label: string;
} | null;

export type DesktopUpdaterErrorPresentation = {
  title: string;
  description: string;
};

export type DesktopUpdaterAction =
  | { type: 'runtime-unavailable' }
  | { type: 'check-started'; origin: DesktopUpdaterCheckOrigin }
  | { type: 'download-started' }
  | { type: 'install-started' }
  | {
      type: 'snapshot-received';
      snapshot: DesktopUpdaterSnapshot;
      origin?: DesktopUpdaterCheckOrigin;
      checkedAt?: string;
    }
  | { type: 'download-progress'; progress: DesktopUpdaterProgress }
  | {
      type: 'operation-failed';
      operation: 'check' | 'download' | 'install';
      origin?: DesktopUpdaterCheckOrigin;
      checkedAt?: string;
      error: DesktopUpdaterError;
    }
  | { type: 'install-blocked'; message: string };

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type InvokeLike = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
type ListenLike = <T>(
  event: string,
  handler: (event: { payload: T }) => void
) => Promise<() => void>;

export type DesktopUpdaterFacade = {
  getSnapshot: () => Promise<DesktopUpdaterSnapshot>;
  check: (manual: boolean) => Promise<DesktopUpdaterSnapshot>;
  download: () => Promise<DesktopUpdaterSnapshot>;
  install: () => Promise<void>;
  listenProgress: (handler: (progress: DesktopUpdaterProgress) => void) => Promise<() => void>;
};

const NATIVE_PHASES = new Set<DesktopUpdaterNativePhase>([
  'idle',
  'checking',
  'upToDate',
  'available',
  'downloading',
  'readyToInstall',
  'installing',
  'error'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asNullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNullableDateString(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return null;
}

function asFiniteNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isDesktopUpdaterRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function normalizeDesktopUpdaterSnapshot(
  value: unknown,
  fallbackCurrentVersion = ''
): DesktopUpdaterSnapshot {
  const source = isRecord(value) ? value : {};
  const rawPhase = source.phase;
  const phase =
    typeof rawPhase === 'string' && NATIVE_PHASES.has(rawPhase as DesktopUpdaterNativePhase)
      ? (rawPhase as DesktopUpdaterNativePhase)
      : 'idle';
  const totalBytes = asNullableNumber(source.totalBytes);
  const downloadedBytes = Math.max(0, asFiniteNumber(source.downloadedBytes));
  const rawPercent = asNullableNumber(source.percent);
  const calculatedPercent = totalBytes && totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : null;
  const percent = rawPercent ?? calculatedPercent;

  return {
    version: asNullableString(source.version),
    currentVersion: asNullableString(source.currentVersion) || fallbackCurrentVersion,
    notes: asNullableString(source.notes),
    publishedAt: asNullableString(source.publishedAt),
    phase,
    downloadedBytes,
    totalBytes: totalBytes && totalBytes > 0 ? totalBytes : null,
    percent: percent === null ? null : Math.min(100, Math.max(0, percent)),
    errorCode: asNullableString(source.errorCode),
    errorMessage: asNullableString(source.errorMessage),
    retryable: source.retryable !== false,
    lastCheckedAt: asNullableDateString(source.lastCheckedAt)
  };
}

export function normalizeDesktopUpdaterProgress(value: unknown): DesktopUpdaterProgress {
  const source = isRecord(value) ? value : {};
  const event =
    source.event === 'started' || source.event === 'finished' ? source.event : 'progress';
  const totalBytes = asNullableNumber(source.totalBytes);
  const downloadedBytes = Math.max(0, asFiniteNumber(source.downloadedBytes));
  const rawPercent = asNullableNumber(source.percent);
  const calculatedPercent = totalBytes && totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : null;
  const percent = rawPercent ?? calculatedPercent;

  return {
    event,
    downloadedBytes,
    totalBytes: totalBytes && totalBytes > 0 ? totalBytes : null,
    percent: percent === null ? null : Math.min(100, Math.max(0, percent))
  };
}

export function normalizeDesktopUpdaterError(value: unknown): DesktopUpdaterError {
  if (isRecord(value)) {
    return {
      code: asNullableString(value.code) || 'UPDATE_FAILED',
      message: asNullableString(value.message) || '软件更新暂时无法完成，请稍后重试。',
      retryable: value.retryable !== false
    };
  }

  return {
    code: 'UPDATE_FAILED',
    message:
      typeof value === 'string' && value.trim()
        ? value.trim()
        : '软件更新暂时无法完成，请稍后重试。',
    retryable: true
  };
}

export function createInitialDesktopUpdaterState(currentVersion = ''): DesktopUpdaterState {
  return {
    version: null,
    currentVersion,
    notes: null,
    publishedAt: null,
    phase: 'idle',
    downloadedBytes: 0,
    totalBytes: null,
    percent: null,
    errorCode: null,
    errorMessage: null,
    retryable: true,
    lastCheckedAt: null,
    checkOrigin: null,
    failedOperation: null,
    statusMessage: ''
  };
}

export function getDesktopUpdaterAttention(
  state: Pick<
    DesktopUpdaterState,
    'phase' | 'version' | 'failedOperation' | 'errorCode'
  >,
  autoCheckEnabled: boolean
): DesktopUpdaterAttention {
  if (state.phase === 'available') {
    return {
      kind: 'update',
      label: state.version ? `发现软件更新 ${state.version}` : '发现软件更新'
    };
  }

  if (state.phase === 'readyToInstall') {
    return { kind: 'update', label: '软件更新已下载，等待重启' };
  }

  if (state.phase !== 'error') return null;

  const requiresManualRecovery =
    state.failedOperation === 'download' ||
    state.failedOperation === 'install' ||
    state.errorCode === 'UPDATE_SIGNATURE_ERROR';
  if (!autoCheckEnabled && !requiresManualRecovery) return null;

  return {
    kind: 'error',
    label:
      state.errorCode === 'UPDATE_SIGNATURE_ERROR'
        ? '软件更新安全校验需要处理'
        : '软件更新需要处理'
  };
}

export function getDesktopUpdaterErrorPresentation(
  state: Pick<
    DesktopUpdaterState,
    'errorCode' | 'errorMessage' | 'retryable' | 'failedOperation'
  >,
  autoCheckEnabled: boolean
): DesktopUpdaterErrorPresentation {
  const automaticRetryCopy = autoCheckEnabled
    ? '自动检查已开启，寻鹿会稍后重试；也可以立即重新检查。'
    : '不会影响当前工作，请稍后重新检查。';

  if (state.errorCode === 'UPDATE_NETWORK_ERROR') {
    return {
      title: '更新服务暂时不可用',
      description: `可能是当前网络或更新通道暂时无响应。${automaticRetryCopy}`
    };
  }

  if (state.errorCode === 'UPDATE_CONFIGURATION_ERROR') {
    return {
      title: '更新通道暂时不可用',
      description: '不会影响当前工作。服务恢复后可直接在应用内检查并更新，无需重新下载安装包。'
    };
  }

  if (state.errorCode === 'UPDATE_SIGNATURE_ERROR') {
    return {
      title: '更新包安全校验未通过',
      description: '已停止本次更新，不会安装未经验证的文件。请重新检查后再试。'
    };
  }

  if (state.failedOperation === 'download' || state.errorCode === 'UPDATE_DOWNLOAD_ERROR') {
    return {
      title: '更新下载未完成',
      description: '不会影响当前工作，可以重新下载；已校验通过后才会进入安装步骤。'
    };
  }

  if (state.failedOperation === 'install' || state.errorCode === 'UPDATE_INSTALL_ERROR') {
    return {
      title: '更新安装未完成',
      description: '当前版本仍可继续使用。请保存工作后重新安装更新。'
    };
  }

  return {
    title: state.errorMessage || '软件更新暂时无法完成',
    description: state.retryable
      ? automaticRetryCopy
      : '当前版本仍可继续使用，请稍后在设置中查看更新状态。'
  };
}

function snapshotMessage(snapshot: DesktopUpdaterSnapshot) {
  if (snapshot.phase === 'upToDate') return '当前已是最新版本';
  if (snapshot.phase === 'available') return `发现新版本 ${snapshot.version || ''}`.trim();
  if (snapshot.phase === 'readyToInstall') return '更新已下载，重启后即可使用';
  if (snapshot.phase === 'error') return snapshot.errorMessage || '软件更新暂时无法完成';
  return '';
}

function inferFailedOperation(errorCode: string | null) {
  if (errorCode === 'UPDATE_INSTALL_ERROR') return 'install' as const;
  if (errorCode === 'UPDATE_DOWNLOAD_ERROR' || errorCode === 'UPDATE_SIGNATURE_ERROR') {
    return 'download' as const;
  }
  return 'check' as const;
}

export function desktopUpdaterReducer(
  state: DesktopUpdaterState,
  action: DesktopUpdaterAction
): DesktopUpdaterState {
  if (action.type === 'runtime-unavailable') {
    return {
      ...state,
      phase: 'unsupported',
      checkOrigin: null,
      statusMessage: '软件更新仅在 Windows 桌面安装版中可用'
    };
  }

  if (action.type === 'check-started') {
    const preserveKnownUpdate =
      action.origin === 'automatic' &&
      (state.phase === 'available' ||
        state.phase === 'downloading' ||
        state.phase === 'readyToInstall');
    return {
      ...state,
      phase: preserveKnownUpdate ? state.phase : 'checking',
      checkOrigin: action.origin,
      failedOperation: null,
      errorCode: null,
      errorMessage: null,
      statusMessage: action.origin === 'manual' ? '正在检查新版本…' : ''
    };
  }

  if (action.type === 'download-started') {
    return {
      ...state,
      phase: 'downloading',
      downloadedBytes: 0,
      totalBytes: null,
      percent: null,
      errorCode: null,
      errorMessage: null,
      failedOperation: null,
      statusMessage: '正在后台下载更新…'
    };
  }

  if (action.type === 'install-started') {
    return {
      ...state,
      phase: 'installing',
      errorCode: null,
      errorMessage: null,
      failedOperation: null,
      statusMessage: '正在关闭并重启寻鹿…'
    };
  }

  if (action.type === 'snapshot-received') {
    const lastCheckedAt = action.snapshot.lastCheckedAt || action.checkedAt || state.lastCheckedAt;
    return {
      ...state,
      ...action.snapshot,
      lastCheckedAt,
      checkOrigin: action.origin || state.checkOrigin,
      failedOperation:
        action.snapshot.phase === 'error'
          ? inferFailedOperation(action.snapshot.errorCode)
          : null,
      statusMessage: snapshotMessage(action.snapshot)
    };
  }

  if (action.type === 'download-progress') {
    if (state.phase !== 'downloading') return state;
    const ready = action.progress.event === 'finished';
    return {
      ...state,
      phase: ready ? 'readyToInstall' : 'downloading',
      downloadedBytes: action.progress.downloadedBytes,
      totalBytes: action.progress.totalBytes,
      percent: ready ? 100 : action.progress.percent,
      statusMessage: ready ? '更新已下载，重启后即可使用' : '正在后台下载更新…'
    };
  }

  if (action.type === 'install-blocked') {
    return {
      ...state,
      phase: 'readyToInstall',
      statusMessage: action.message
    };
  }

  const silentAutomaticFailure =
    action.operation === 'check' && action.origin === 'automatic';
  const preserveKnownUpdate =
    silentAutomaticFailure &&
    (state.phase === 'available' ||
      state.phase === 'downloading' ||
      state.phase === 'readyToInstall');
  return {
    ...state,
    phase: preserveKnownUpdate ? state.phase : 'error',
    checkOrigin: action.origin || state.checkOrigin,
    failedOperation: action.operation,
    errorCode: action.error.code,
    errorMessage: action.error.message,
    retryable: action.error.retryable,
    lastCheckedAt: action.checkedAt || state.lastCheckedAt,
    statusMessage: silentAutomaticFailure ? '' : action.error.message
  };
}

export function readDesktopUpdaterAutoCheck(storage: StorageLike | null = getBrowserStorage()) {
  if (!storage) return true;

  try {
    return storage.getItem(DESKTOP_UPDATER_AUTO_CHECK_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function writeDesktopUpdaterAutoCheck(
  enabled: boolean,
  storage: StorageLike | null = getBrowserStorage()
) {
  try {
    storage?.setItem(DESKTOP_UPDATER_AUTO_CHECK_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // A restricted storage context should not prevent the current-session setting.
  }
  return enabled;
}

export function resetDesktopUpdaterPreferences(storage: StorageLike | null = getBrowserStorage()) {
  writeDesktopUpdaterAutoCheck(true, storage);
  writeDesktopUpdaterFailureCount(0, storage);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(DESKTOP_UPDATER_PREFERENCES_RESET_EVENT));
  }
  return true;
}

export function readDesktopUpdaterLastCheck(storage: StorageLike | null = getBrowserStorage()) {
  if (!storage) return null;

  try {
    const value = storage.getItem(DESKTOP_UPDATER_LAST_CHECK_STORAGE_KEY);
    return value && Number.isFinite(Date.parse(value)) ? value : null;
  } catch {
    return null;
  }
}

export function writeDesktopUpdaterLastCheck(
  value: string,
  storage: StorageLike | null = getBrowserStorage()
) {
  if (!Number.isFinite(Date.parse(value))) return null;

  try {
    storage?.setItem(DESKTOP_UPDATER_LAST_CHECK_STORAGE_KEY, value);
  } catch {
    // Scheduling remains valid for the current session when storage is restricted.
  }
  return value;
}

export function readDesktopUpdaterFailureCount(storage: StorageLike | null = getBrowserStorage()) {
  if (!storage) return 0;

  try {
    const value = Number.parseInt(storage.getItem(DESKTOP_UPDATER_FAILURE_COUNT_STORAGE_KEY) || '0', 10);
    return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  } catch {
    return 0;
  }
}

export function writeDesktopUpdaterFailureCount(
  value: number,
  storage: StorageLike | null = getBrowserStorage()
) {
  const normalized = Number.isFinite(value) ? Math.min(100, Math.max(0, Math.floor(value))) : 0;
  try {
    storage?.setItem(DESKTOP_UPDATER_FAILURE_COUNT_STORAGE_KEY, String(normalized));
  } catch {
    // In-memory updater state remains usable when persistence is restricted.
  }
  return normalized;
}

export function getDesktopUpdaterFailureBackoff(failureCount: number) {
  if (failureCount <= 0) return 0;
  const index = Math.min(
    DESKTOP_UPDATER_FAILURE_BACKOFFS_MS.length - 1,
    Math.max(0, Math.floor(failureCount) - 1)
  );
  return DESKTOP_UPDATER_FAILURE_BACKOFFS_MS[index];
}

export function retainDesktopUpdaterListener(
  disposed: boolean,
  unlisten: () => void
): (() => void) | null {
  if (disposed) {
    unlisten();
    return null;
  }
  return unlisten;
}

export function getDesktopUpdaterCheckDelay(
  now: number,
  lastCheckedAt: string | null,
  failureCount = 0,
  initialDelay = DESKTOP_UPDATER_INITIAL_DELAY_MS,
  interval = DESKTOP_UPDATER_CHECK_INTERVAL_MS
) {
  if (!lastCheckedAt || !Number.isFinite(Date.parse(lastCheckedAt))) return initialDelay;
  const effectiveInterval = getDesktopUpdaterFailureBackoff(failureCount) || interval;
  const elapsed = now - Date.parse(lastCheckedAt);
  if (elapsed >= effectiveInterval) return initialDelay;
  return Math.max(initialDelay, effectiveInterval - Math.max(0, elapsed));
}

export function createDesktopUpdaterFacade({
  invoke,
  listen,
  currentVersion = ''
}: {
  invoke: InvokeLike;
  listen: ListenLike;
  currentVersion?: string;
}): DesktopUpdaterFacade {
  let checkPromise: Promise<DesktopUpdaterSnapshot> | null = null;
  let downloadPromise: Promise<DesktopUpdaterSnapshot> | null = null;
  let installPromise: Promise<void> | null = null;

  const normalize = (value: unknown) => normalizeDesktopUpdaterSnapshot(value, currentVersion);

  return {
    getSnapshot: async () => normalize(await invoke('get_desktop_update_snapshot')),
    check(manual) {
      if (checkPromise) return checkPromise;
      checkPromise = invoke('check_for_desktop_update', { manual })
        .then(normalize)
        .finally(() => {
          checkPromise = null;
        });
      return checkPromise;
    },
    download() {
      if (downloadPromise) return downloadPromise;
      downloadPromise = invoke('download_desktop_update')
        .then(normalize)
        .finally(() => {
          downloadPromise = null;
        });
      return downloadPromise;
    },
    install() {
      if (installPromise) return installPromise;
      installPromise = invoke<void>('install_desktop_update').finally(() => {
        installPromise = null;
      });
      return installPromise;
    },
    listenProgress(handler) {
      return listen<unknown>(DESKTOP_UPDATER_PROGRESS_EVENT, (event) => {
        handler(normalizeDesktopUpdaterProgress(event.payload));
      });
    }
  };
}

let desktopUpdaterFacadePromise: Promise<DesktopUpdaterFacade> | null = null;

export async function getDesktopUpdaterFacade() {
  if (!isDesktopUpdaterRuntime()) {
    throw normalizeDesktopUpdaterError({
      code: 'UPDATER_UNAVAILABLE',
      message: '软件更新仅在 Windows 桌面安装版中可用',
      retryable: false
    });
  }

  if (!desktopUpdaterFacadePromise) {
    desktopUpdaterFacadePromise = Promise.all([
      import('@tauri-apps/api/core'),
      import('@tauri-apps/api/event')
    ])
      .then(([{ invoke }, { listen }]) =>
        createDesktopUpdaterFacade({
          invoke,
          listen,
          currentVersion: process.env.NEXT_PUBLIC_SEEKOFFER_APP_VERSION || ''
        })
      )
      .catch((error) => {
        desktopUpdaterFacadePromise = null;
        throw error;
      });
  }

  return desktopUpdaterFacadePromise;
}
