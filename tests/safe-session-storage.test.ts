import { afterEach, describe, expect, it, vi } from 'vitest';
import { removeSessionStorageValue, writeSessionStorageValue } from '@/lib/safe-session-storage';

const originalWindow = globalThis.window;

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
});

describe('safe session storage', () => {
  it('returns true when writes and removals succeed', () => {
    const setItem = vi.fn();
    const removeItem = vi.fn();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { sessionStorage: { setItem, removeItem } }
    });

    expect(writeSessionStorageValue('key', 'value')).toBe(true);
    expect(removeSessionStorageValue('key')).toBe(true);
    expect(setItem).toHaveBeenCalledWith('key', 'value');
    expect(removeItem).toHaveBeenCalledWith('key');
  });

  it('turns restricted-storage exceptions into a non-blocking false result', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        sessionStorage: {
          setItem: () => { throw new DOMException('blocked', 'SecurityError'); },
          removeItem: () => { throw new DOMException('blocked', 'SecurityError'); }
        }
      }
    });

    expect(writeSessionStorageValue('key', 'value')).toBe(false);
    expect(removeSessionStorageValue('key')).toBe(false);
  });

  it('also survives a browser that throws while exposing sessionStorage', () => {
    const continued = vi.fn();
    const restrictedWindow = {};
    Object.defineProperty(restrictedWindow, 'sessionStorage', {
      configurable: true,
      get() {
        throw new DOMException('storage disabled', 'SecurityError');
      }
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: restrictedWindow
    });

    expect(() => {
      expect(writeSessionStorageValue('key', 'value')).toBe(false);
      expect(removeSessionStorageValue('key')).toBe(false);
      continued();
    }).not.toThrow();
    expect(continued).toHaveBeenCalledOnce();
  });

  it('is a no-op during server rendering', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: undefined
    });

    expect(writeSessionStorageValue('key', 'value')).toBe(false);
    expect(removeSessionStorageValue('key')).toBe(false);
  });
});
