import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const hooks = vi.hoisted(() => ({
  cursor: 0,
  dirty: false,
  slots: [] as Array<{ value?: unknown; deps?: unknown[]; cleanup?: () => void }>,
  effects: [] as Array<() => void>,
  writes: 0
}));
const auth = vi.hoisted(() => ({ login: vi.fn(), refresh: vi.fn(), hydrationError: vi.fn(), retry: vi.fn() }));

// A small effect-aware hook harness exercises the actual handlers without a DOM
// dependency. Compiled-browser verification separately checks rendered geometry.
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useState(initial: unknown) {
    const index = hooks.cursor++;
    const slot = hooks.slots[index] ||= { value: typeof initial === 'function' ? initial() : initial };
    return [slot.value, (next: unknown) => {
      hooks.writes += 1;
      const value = typeof next === 'function' ? next(slot.value) : next;
      if (!Object.is(slot.value, value)) hooks.dirty = true;
      slot.value = value;
    }];
  },
  useRef(initial: unknown) {
    const index = hooks.cursor++;
    return (hooks.slots[index] ||= { value: { current: initial } }).value;
  },
  useId() {
    return `test-auth-${hooks.cursor++}`;
  },
  useEffect(effect: () => void | (() => void), deps: unknown[]) {
    const index = hooks.cursor++;
    const slot = hooks.slots[index] ||= {};
    if (!slot.deps || deps.some((value, offset) => !Object.is(value, slot.deps?.[offset]))) {
      hooks.effects.push(() => { slot.cleanup?.(); slot.cleanup = effect() || undefined; });
      slot.deps = deps;
    }
  }
}));
vi.mock('next/image', () => ({ default: 'img' }));
vi.mock('../components/login-method-panel', () => ({ LoginMethodPanel: () => null }));
vi.mock('../components/desktop-window-controls', () => ({ DesktopWindowControls: () => null, useDesktopTitlebarDrag: () => undefined }));
vi.mock('../components/user-session-provider', () => ({ useUserSessionContext: () => ({ refresh: auth.refresh }) }));
vi.mock('../lib/native-auth-bridge', () => ({ startNativeLogin: auth.login }));
vi.mock('../lib/user-session', () => ({ getSessionHydrationError: auth.hydrationError }));
vi.mock('../lib/clerk-d1-session', () => ({ prepareExplicitD1SignInRetry: auth.retry }));

import { DesktopStartupScreen } from '../components/desktop-login-screen';
import { NativeLoginPanel } from '../components/native-login-panel';

type Element = ReactElement<Record<string, unknown>>;
function render(component: () => ReactNode): Element {
  let tree: ReactNode;
  let attempts = 0;
  do {
    hooks.cursor = 0;
    hooks.dirty = false;
    tree = component();
    const effects = hooks.effects.splice(0);
    effects.forEach(effect => effect());
    if (++attempts > 8) throw new Error('Unexpected rerender loop');
  } while (hooks.dirty);
  return tree as Element;
}
function elements(tree: ReactNode): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(tree)) return [];
  return [tree, ...elements(tree.props.children as ReactNode)];
}
function button(tree: Element) {
  return elements(tree).find(element => element.type === 'button' && element.props['aria-label'] !== '关闭登录')!;
}
function click(element: Element) { (element.props.onClick as () => void)(); }
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
async function settle() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
function unmount() { hooks.slots.forEach(slot => slot.cleanup?.()); }

beforeEach(() => {
  hooks.slots = [];
  hooks.effects = [];
  hooks.cursor = 0;
  hooks.dirty = false;
  hooks.writes = 0;
  Object.values(auth).forEach(mock => mock.mockReset());
  auth.hydrationError.mockReturnValue(null);
  vi.useFakeTimers();
  vi.stubGlobal('window', {
    setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
    clearTimeout: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer)
  });
});
afterEach(() => { unmount(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('desktop startup feedback lifecycle', () => {
  it('starts a fresh slow-response timer for a same-phase retry', async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    const screen = () => DesktopStartupScreen({ phase: 'restore-session', onRetry: retry });
    let tree = render(screen);
    expect(tree.props['data-feedback-state']).toBe('loading');
    vi.advanceTimersByTime(8000);
    tree = render(screen);
    expect(tree.props['data-feedback-state']).toBe('stalled');
    click(button(tree));
    render(screen);
    await settle();
    tree = render(screen);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(tree.props['data-feedback-state']).toBe('loading');
    vi.advanceTimersByTime(7999);
    expect(render(screen).props['data-feedback-state']).toBe('loading');
    vi.advanceTimersByTime(1);
    expect(render(screen).props['data-feedback-state']).toBe('stalled');
  });

  it('catches a rejected retry, stops the busy animation and exposes retry again', async () => {
    const task = deferred<void>();
    const retry = vi.fn().mockReturnValue(task.promise);
    const screen = () => DesktopStartupScreen({ phase: 'restore-session', onRetry: retry });
    render(screen);
    vi.advanceTimersByTime(8000);
    const action = button(render(screen));
    click(action);
    click(action);
    render(screen);
    expect(retry).toHaveBeenCalledTimes(1);
    task.reject(new Error('synthetic network error'));
    await settle();
    const tree = render(screen);
    expect(tree.props['data-feedback-state']).toBe('error');
    expect(elements(tree).find(element => element.type === 'main')?.props['aria-busy']).toBe(false);
    expect(button(tree).props.disabled).toBe(false);
    expect(elements(tree).some(element => element.props.still === true)).toBe(true);
  });

  it('ignores an old retry rejection after unmount and clears its timer', async () => {
    const task = deferred<void>();
    const screen = () => DesktopStartupScreen({ phase: 'restore-session', onRetry: () => task.promise });
    render(screen);
    vi.advanceTimersByTime(8000);
    click(button(render(screen)));
    render(screen);
    unmount();
    const writes = hooks.writes;
    task.reject(new Error('late rejection'));
    await settle();
    expect(hooks.writes).toBe(writes);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not expose a nonfunctional retry button when no retry action exists', () => {
    const screen = () => DesktopStartupScreen({ phase: 'restore-session' });
    render(screen);
    vi.advanceTimersByTime(8000);
    expect(button(render(screen))).toBeUndefined();
  });

  it('does not apply an old phase retry failure to the next startup phase', async () => {
    const task = deferred<void>();
    let phase: 'restore-session' | 'enter-workbench' = 'restore-session';
    const screen = () => DesktopStartupScreen({ phase, onRetry: () => task.promise });
    render(screen);
    vi.advanceTimersByTime(8000);
    click(button(render(screen)));
    render(screen);
    phase = 'enter-workbench';
    render(screen);
    task.reject(new Error('late old phase failure'));
    await settle();
    const tree = render(screen);
    expect(tree.props['data-startup-phase']).toBe('enter-workbench');
    expect(tree.props['data-feedback-state']).toBe('loading');
  });
});

describe('native browser authorization feedback', () => {
  it('tracks real authorization then hydration and blocks pre-render duplicate clicks', async () => {
    const oauth = deferred<void>();
    const account = deferred<{ loggedIn: boolean; userId: string }>();
    auth.login.mockReturnValue(oauth.promise);
    auth.refresh.mockReturnValue(account.promise);
    const success = vi.fn();
    const panel = () => NativeLoginPanel({ onSuccess: success });
    const action = button(render(panel));
    click(action);
    click(action);
    let tree = render(panel);
    expect(auth.login).toHaveBeenCalledTimes(1);
    expect(auth.refresh).not.toHaveBeenCalled();
    expect(tree.props['data-native-login-phase']).toBe('waiting-browser');
    expect(button(tree).props['aria-busy']).toBe(true);
    expect(button(tree).props.disabled).toBe(true);
    oauth.resolve();
    await settle();
    tree = render(panel);
    expect(tree.props['data-native-login-phase']).toBe('syncing-account');
    expect(success).not.toHaveBeenCalled();
    account.resolve({ loggedIn: true, userId: 'synthetic-owner' });
    await settle();
    tree = render(panel);
    expect(tree.props['data-native-login-phase']).toBe('idle');
    expect(success).toHaveBeenCalledTimes(1);
  });

  it('shows failed hydration as an error instead of a successful login', async () => {
    auth.login.mockResolvedValue(undefined);
    auth.refresh.mockResolvedValue({ loggedIn: false });
    const success = vi.fn();
    const panel = () => NativeLoginPanel({ onSuccess: success });
    click(button(render(panel)));
    await settle();
    const tree = render(panel);
    expect(tree.props['data-native-login-phase']).toBe('error');
    expect(elements(tree).some(element => element.props.role === 'alert')).toBe(true);
    expect(button(tree).props.disabled).toBe(false);
    expect(success).not.toHaveBeenCalled();
  });

  it('does not refresh or run a success callback after the panel was unmounted', async () => {
    const oauth = deferred<void>();
    auth.login.mockReturnValue(oauth.promise);
    const success = vi.fn();
    const panel = () => NativeLoginPanel({ onSuccess: success });
    click(button(render(panel)));
    render(panel);
    unmount();
    const writes = hooks.writes;
    oauth.resolve();
    await settle();
    expect(auth.refresh).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    expect(hooks.writes).toBe(writes);
  });

  it('only displays a close button when a close action was supplied', () => {
    expect(elements(render(() => NativeLoginPanel({}))).some(element => element.props['aria-label'] === '关闭登录')).toBe(false);
    const close = vi.fn();
    const control = elements(render(() => NativeLoginPanel({ onClose: close }))).find(element => element.props['aria-label'] === '关闭登录')!;
    click(control);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('consumes late hydration errors after unmount without updating feedback', async () => {
    const account = deferred<never>();
    auth.login.mockResolvedValue(undefined);
    auth.refresh.mockReturnValue(account.promise);
    const panel = () => NativeLoginPanel({});
    click(button(render(panel)));
    await settle();
    expect(render(panel).props['data-native-login-phase']).toBe('syncing-account');
    unmount();
    const writes = hooks.writes;
    account.reject(new Error('late hydration error'));
    await settle();
    expect(hooks.writes).toBe(writes);
  });
});

describe('startup visual continuity', () => {
  it('keeps the splash local, neutral, static-logo and reduced-motion aware', () => {
    const source = readFileSync(resolve(import.meta.dirname, '../public/desktop-splash.html'), 'utf8');
    expect(source).toContain('--splash-canvas: #ffffff');
    expect(source).toContain('animation: spin 1050ms linear infinite');
    expect(source).toContain('prefers-reduced-motion: reduce');
    expect(source).toContain('html[data-desktop-reduce-motion="true"] .progress');
    expect(source).toContain('width: 64px');
    expect(source).toContain('width: 30px');
    expect(source).not.toMatch(/https?:\/\//);
    expect(source).not.toMatch(/img\s*\{[^}]*animation:/);
  });
});
