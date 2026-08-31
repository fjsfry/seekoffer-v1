export const DESKTOP_PREFERENCES_VERSION = 1 as const;
export const DESKTOP_PREFERENCES_STORAGE_KEY = 'seekoffer-desktop-preferences-v1';
export const DESKTOP_PREFERENCES_CHANGE_EVENT = 'seekoffer:desktop-preferences-change';
export const DESKTOP_LAST_ROUTE_STORAGE_KEY = 'seekoffer-desktop-last-route-v1';
export const DESKTOP_LAUNCH_SESSION_KEY = 'seekoffer-desktop-launch-applied-v1';
export const DESKTOP_ZOOM_LEVELS = [80, 90, 100, 110, 125, 150, 175, 200] as const;

export type DesktopTheme = 'system' | 'light' | 'dark';
export type ResolvedDesktopTheme = Exclude<DesktopTheme, 'system'>;
export type DesktopDensity = 'comfortable' | 'compact';
export type DesktopLaunchDestination = 'home' | 'last' | 'notices';
export type DesktopNotificationKind = 'deadline' | 'materials' | 'change' | 'mentor';
export type DesktopSnoozeMinutes = 30 | 60 | 180;
export type DesktopZoomLevel = (typeof DESKTOP_ZOOM_LEVELS)[number];

export type DesktopPreferences = {
  version: typeof DESKTOP_PREFERENCES_VERSION;
  theme: DesktopTheme;
  density: DesktopDensity;
  zoomLevel: DesktopZoomLevel;
  reduceMotion: boolean;
  launchDestination: DesktopLaunchDestination;
  notifications: {
    windowsDelivery: boolean;
    kinds: Record<DesktopNotificationKind, boolean>;
    snoozeMinutes: DesktopSnoozeMinutes;
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    pausedUntil: string | null;
  };
};

export const DEFAULT_DESKTOP_PREFERENCES: DesktopPreferences = {
  version: DESKTOP_PREFERENCES_VERSION,
  theme: 'light',
  density: 'comfortable',
  zoomLevel: 100,
  reduceMotion: false,
  launchDestination: 'last',
  notifications: {
    windowsDelivery: false,
    kinds: {
      deadline: true,
      materials: true,
      change: true,
      mentor: true
    },
    snoozeMinutes: 60,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    pausedUntil: null
  }
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isOneOf<T extends string | number>(value: unknown, options: readonly T[]): value is T {
  return options.includes(value as T);
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeTime(value: unknown, fallback: string) {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}

function normalizePausedUntil(value: unknown) {
  if (value === null) {
    return null;
  }

  return typeof value === 'string' && value.trim() && Number.isFinite(Date.parse(value))
    ? value
    : DEFAULT_DESKTOP_PREFERENCES.notifications.pausedUntil;
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function emitPreferencesChange(preferences: DesktopPreferences) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.dispatchEvent(
      new CustomEvent(DESKTOP_PREFERENCES_CHANGE_EVENT, {
        detail: preferences
      })
    );
  } catch {
    // Preference persistence should remain usable in restricted browser contexts.
  }
}

export function normalizeDesktopPreferences(value: unknown): DesktopPreferences {
  const source = isRecord(value) ? value : {};
  const notifications = isRecord(source.notifications) ? source.notifications : {};
  const kinds = isRecord(notifications.kinds) ? notifications.kinds : {};
  const defaults = DEFAULT_DESKTOP_PREFERENCES;

  return {
    version: DESKTOP_PREFERENCES_VERSION,
    theme: isOneOf(source.theme, ['system', 'light', 'dark'] as const)
      ? source.theme
      : defaults.theme,
    density: isOneOf(source.density, ['comfortable', 'compact'] as const)
      ? source.density
      : defaults.density,
    zoomLevel: isOneOf(source.zoomLevel, DESKTOP_ZOOM_LEVELS)
      ? source.zoomLevel
      : defaults.zoomLevel,
    reduceMotion: normalizeBoolean(source.reduceMotion, defaults.reduceMotion),
    launchDestination:
      source.launchDestination === 'applications'
        ? 'home'
        : isOneOf(source.launchDestination, ['home', 'last', 'notices'] as const)
          ? source.launchDestination
          : defaults.launchDestination,
    notifications: {
      windowsDelivery: normalizeBoolean(
        notifications.windowsDelivery,
        defaults.notifications.windowsDelivery
      ),
      kinds: {
        deadline: normalizeBoolean(kinds.deadline, defaults.notifications.kinds.deadline),
        materials: normalizeBoolean(kinds.materials, defaults.notifications.kinds.materials),
        change: normalizeBoolean(kinds.change, defaults.notifications.kinds.change),
        mentor: normalizeBoolean(kinds.mentor, defaults.notifications.kinds.mentor)
      },
      snoozeMinutes: isOneOf(notifications.snoozeMinutes, [30, 60, 180] as const)
        ? notifications.snoozeMinutes
        : defaults.notifications.snoozeMinutes,
      quietHoursEnabled: normalizeBoolean(
        notifications.quietHoursEnabled,
        defaults.notifications.quietHoursEnabled
      ),
      quietHoursStart: normalizeTime(
        notifications.quietHoursStart,
        defaults.notifications.quietHoursStart
      ),
      quietHoursEnd: normalizeTime(
        notifications.quietHoursEnd,
        defaults.notifications.quietHoursEnd
      ),
      pausedUntil: normalizePausedUntil(notifications.pausedUntil)
    }
  };
}

export function resolveDesktopTheme(
  theme: DesktopTheme,
  systemPrefersDark: boolean
): ResolvedDesktopTheme {
  if (theme === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }

  return theme;
}

export function getSteppedDesktopZoomLevel(
  current: DesktopZoomLevel,
  direction: -1 | 1
): DesktopZoomLevel {
  const currentIndex = Math.max(0, DESKTOP_ZOOM_LEVELS.indexOf(current));
  const nextIndex = Math.min(
    DESKTOP_ZOOM_LEVELS.length - 1,
    Math.max(0, currentIndex + direction)
  );
  return DESKTOP_ZOOM_LEVELS[nextIndex];
}

export function readDesktopPreferences(storage: StorageLike | null = getBrowserStorage()) {
  if (!storage) {
    return normalizeDesktopPreferences(null);
  }

  try {
    const rawValue = storage.getItem(DESKTOP_PREFERENCES_STORAGE_KEY);
    return rawValue ? normalizeDesktopPreferences(JSON.parse(rawValue)) : normalizeDesktopPreferences(null);
  } catch {
    return normalizeDesktopPreferences(null);
  }
}

export function writeDesktopPreferences(
  value: unknown,
  storage: StorageLike | null = getBrowserStorage()
) {
  const preferences = normalizeDesktopPreferences(value);

  if (storage) {
    try {
      storage.setItem(DESKTOP_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Keep the normalized in-memory value when persistence is unavailable.
    }
  }

  emitPreferencesChange(preferences);
  return preferences;
}

export function resetDesktopPreferences(storage: StorageLike | null = getBrowserStorage()) {
  if (storage) {
    try {
      storage.removeItem(DESKTOP_PREFERENCES_STORAGE_KEY);
    } catch {
      // Reset remains safe when storage access is blocked.
    }
  }

  const preferences = normalizeDesktopPreferences(null);
  emitPreferencesChange(preferences);
  return preferences;
}

export function isDesktopNotificationKindEnabled(
  preferences: DesktopPreferences,
  kind: DesktopNotificationKind
) {
  return preferences.notifications.kinds[kind];
}

function toDate(value: Date | number | string) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : new Date();
}

export function isDesktopNotificationsPaused(
  preferences: DesktopPreferences,
  now: Date | number | string = new Date()
) {
  const pausedUntil = preferences.notifications.pausedUntil;
  return Boolean(pausedUntil && Date.parse(pausedUntil) > toDate(now).getTime());
}

function getMinutesFromTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function movePastQuietHours(
  date: Date,
  quietHoursStart: string,
  quietHoursEnd: string
) {
  const start = getMinutesFromTime(quietHoursStart);
  const end = getMinutesFromTime(quietHoursEnd);
  const current = date.getHours() * 60 + date.getMinutes();

  if (start === end) {
    return date;
  }

  const isOvernight = start > end;
  const isQuiet = isOvernight
    ? current >= start || current < end
    : current >= start && current < end;

  if (!isQuiet) {
    return date;
  }

  const result = new Date(date.getTime());
  if (isOvernight && current >= start) {
    result.setDate(result.getDate() + 1);
  }
  result.setHours(Math.floor(end / 60), end % 60, 0, 0);
  return result;
}

export function getNextAllowedDesktopNotificationDate(
  preferences: DesktopPreferences,
  from: Date | number | string = new Date()
) {
  let candidate = toDate(from);
  const pausedUntil = preferences.notifications.pausedUntil;
  const pausedUntilTime = pausedUntil ? Date.parse(pausedUntil) : Number.NaN;

  if (Number.isFinite(pausedUntilTime) && pausedUntilTime > candidate.getTime()) {
    candidate = new Date(pausedUntilTime);
  }

  if (!preferences.notifications.quietHoursEnabled) {
    return candidate;
  }

  return movePastQuietHours(
    candidate,
    preferences.notifications.quietHoursStart,
    preferences.notifications.quietHoursEnd
  );
}
