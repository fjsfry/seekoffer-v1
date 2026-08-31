import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DESKTOP_PREFERENCES,
  DESKTOP_PREFERENCES_STORAGE_KEY,
  DESKTOP_ZOOM_LEVELS,
  getNextAllowedDesktopNotificationDate,
  getSteppedDesktopZoomLevel,
  isDesktopNotificationKindEnabled,
  isDesktopNotificationsPaused,
  normalizeDesktopPreferences,
  readDesktopPreferences,
  resetDesktopPreferences,
  resolveDesktopTheme,
  writeDesktopPreferences
} from '../lib/desktop-preferences';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe('desktop preferences', () => {
  it('falls back safely for corrupt and partial stored values', () => {
    const storage = new MemoryStorage();
    storage.setItem(DESKTOP_PREFERENCES_STORAGE_KEY, '{broken');

    expect(readDesktopPreferences(storage)).toEqual(DEFAULT_DESKTOP_PREFERENCES);

    storage.setItem(
      DESKTOP_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 999,
        theme: 'dark',
        density: 'tiny',
        zoomLevel: 137,
        notifications: {
          kinds: { deadline: false, materials: 'no' },
          snoozeMinutes: 45,
          quietHoursStart: '29:00'
        }
      })
    );

    expect(readDesktopPreferences(storage)).toEqual({
      ...DEFAULT_DESKTOP_PREFERENCES,
      theme: 'dark',
      notifications: {
        ...DEFAULT_DESKTOP_PREFERENCES.notifications,
        kinds: {
          ...DEFAULT_DESKTOP_PREFERENCES.notifications.kinds,
          deadline: false
        }
      }
    });
  });

  it('persists all supported themes and rejects unsupported values', () => {
    expect(DEFAULT_DESKTOP_PREFERENCES.theme).toBe('light');
    expect(normalizeDesktopPreferences({ theme: 'light' }).theme).toBe('light');
    expect(normalizeDesktopPreferences({ theme: 'system' }).theme).toBe('system');
    expect(normalizeDesktopPreferences({ theme: 'dark' }).theme).toBe('dark');
    expect(normalizeDesktopPreferences({ theme: 'unsupported' }).theme).toBe('light');

    const storage = new MemoryStorage();
    storage.setItem(
      DESKTOP_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ theme: 'dark', zoomLevel: 125 })
    );
    expect(readDesktopPreferences(storage)).toMatchObject({
      theme: 'dark',
      zoomLevel: 125
    });
  });

  it('resolves the system theme without changing an explicit user choice', () => {
    expect(resolveDesktopTheme('system', true)).toBe('dark');
    expect(resolveDesktopTheme('system', false)).toBe('light');
    expect(resolveDesktopTheme('dark', false)).toBe('dark');
    expect(resolveDesktopTheme('light', true)).toBe('light');
  });

  it('normalizes writes and persists only the versioned preference value', () => {
    const storage = new MemoryStorage();
    storage.setItem('unrelated-key', 'keep-me');

    const written = writeDesktopPreferences(
      {
        theme: 'light',
        density: 'compact',
        zoomLevel: 150,
        reduceMotion: true,
        launchDestination: 'applications',
        notifications: {
          windowsDelivery: true,
          kinds: { deadline: false, materials: true, change: false },
          snoozeMinutes: 180,
          quietHoursEnabled: true,
          quietHoursStart: '21:30',
          quietHoursEnd: '07:15',
          pausedUntil: '2026-07-27T02:00:00.000Z'
        }
      },
      storage
    );

    expect(JSON.parse(storage.getItem(DESKTOP_PREFERENCES_STORAGE_KEY) || '')).toEqual(written);
    expect(storage.getItem('unrelated-key')).toBe('keep-me');
    expect(written).toMatchObject({
      version: 1,
      theme: 'light',
      density: 'compact',
      zoomLevel: 150,
      launchDestination: 'home'
    });
  });

  it('supports only the eight agreed zoom levels and persists every valid level', () => {
    const storage = new MemoryStorage();

    expect(DESKTOP_ZOOM_LEVELS).toEqual([80, 90, 100, 110, 125, 150, 175, 200]);

    for (const zoomLevel of DESKTOP_ZOOM_LEVELS) {
      const written = writeDesktopPreferences({ zoomLevel }, storage);
      expect(written.zoomLevel).toBe(zoomLevel);
      expect(readDesktopPreferences(storage).zoomLevel).toBe(zoomLevel);
    }

    expect(normalizeDesktopPreferences({ zoomLevel: 79 }).zoomLevel).toBe(100);
    expect(normalizeDesktopPreferences({ zoomLevel: 137 }).zoomLevel).toBe(100);
    expect(normalizeDesktopPreferences({ zoomLevel: '150' }).zoomLevel).toBe(100);
    expect(normalizeDesktopPreferences({ zoomLevel: 201 }).zoomLevel).toBe(100);
  });

  it('steps through zoom levels without exceeding the supported bounds', () => {
    expect(getSteppedDesktopZoomLevel(80, -1)).toBe(80);
    expect(getSteppedDesktopZoomLevel(80, 1)).toBe(90);
    expect(getSteppedDesktopZoomLevel(100, -1)).toBe(90);
    expect(getSteppedDesktopZoomLevel(100, 1)).toBe(110);
    expect(getSteppedDesktopZoomLevel(125, 1)).toBe(150);
    expect(getSteppedDesktopZoomLevel(200, -1)).toBe(175);
    expect(getSteppedDesktopZoomLevel(200, 1)).toBe(200);
  });

  it('resets only desktop preferences and returns fresh defaults', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      DESKTOP_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ theme: 'dark', zoomLevel: 175 })
    );
    storage.setItem('unrelated-key', 'keep-me');

    const reset = resetDesktopPreferences(storage);

    expect(reset).toEqual(DEFAULT_DESKTOP_PREFERENCES);
    expect(reset.zoomLevel).toBe(100);
    expect(storage.getItem(DESKTOP_PREFERENCES_STORAGE_KEY)).toBeNull();
    expect(storage.getItem('unrelated-key')).toBe('keep-me');
  });

  it('reports each notification kind toggle independently', () => {
    const preferences = normalizeDesktopPreferences({
      notifications: {
        kinds: {
          deadline: false,
          materials: true,
          change: false
        }
      }
    });

    expect(isDesktopNotificationKindEnabled(preferences, 'deadline')).toBe(false);
    expect(isDesktopNotificationKindEnabled(preferences, 'materials')).toBe(true);
    expect(isDesktopNotificationKindEnabled(preferences, 'change')).toBe(false);
  });

  it('reports pauses only while pausedUntil is in the future', () => {
    const preferences = normalizeDesktopPreferences({
      notifications: {
        pausedUntil: '2026-07-26T12:00:00.000Z'
      }
    });

    expect(isDesktopNotificationsPaused(preferences, '2026-07-26T11:59:59.000Z')).toBe(true);
    expect(isDesktopNotificationsPaused(preferences, '2026-07-26T12:00:00.000Z')).toBe(false);
    expect(isDesktopNotificationsPaused(preferences, '2026-07-26T12:00:01.000Z')).toBe(false);
  });

  it('moves overnight quiet-hour notifications to the next allowed local time', () => {
    const preferences = normalizeDesktopPreferences({
      notifications: {
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00'
      }
    });
    const lateNight = new Date(2026, 6, 26, 23, 15);
    const earlyMorning = new Date(2026, 6, 27, 7, 30);
    const daytime = new Date(2026, 6, 27, 9, 30);

    expect(getNextAllowedDesktopNotificationDate(preferences, lateNight)).toEqual(
      new Date(2026, 6, 27, 8, 0)
    );
    expect(getNextAllowedDesktopNotificationDate(preferences, earlyMorning)).toEqual(
      new Date(2026, 6, 27, 8, 0)
    );
    expect(getNextAllowedDesktopNotificationDate(preferences, daytime)).toEqual(daytime);
  });

  it('applies quiet hours after a pause ends', () => {
    const preferences = normalizeDesktopPreferences({
      notifications: {
        pausedUntil: new Date(2026, 6, 26, 23, 0).toISOString(),
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00'
      }
    });

    expect(
      getNextAllowedDesktopNotificationDate(preferences, new Date(2026, 6, 26, 20, 0))
    ).toEqual(new Date(2026, 6, 27, 8, 0));
  });
});
