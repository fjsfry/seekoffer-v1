import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  values: [] as unknown[], cursor: 0,
  effects: new Map<number, { dependencies: unknown[]; cleanup?: () => void }>(),
  pending: [] as Array<() => void>,
  session: { loggedIn: true, ready: true },
  fetchRows: vi.fn(), subscriptions: new Set<() => void>()
}));

// A small deterministic hook harness exercises the component's async effect,
// including its cleanup, without depending on a browser DOM or live account.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  function useState<T>(initial: T | (() => T)) {
    const index = harness.cursor++;
    if (!(index in harness.values)) harness.values[index] = typeof initial === 'function' ? (initial as () => T)() : initial;
    return [harness.values[index], (next: T | ((current: T) => T)) => {
      harness.values[index] = typeof next === 'function' ? (next as (current: T) => T)(harness.values[index] as T) : next;
    }];
  }
  return {
    ...actual,
    useState,
    useRef: <T>(initial: T) => useState({ current: initial })[0],
    useMemo: <T>(compute: () => T) => compute(),
    useEffect: (effect: () => void | (() => void), dependencies: unknown[] = []) => {
      const index = harness.cursor++;
      const previous = harness.effects.get(index);
      if (previous && dependencies.every((value, offset) => Object.is(value, previous.dependencies[offset]))) return;
      harness.pending.push(() => {
        previous?.cleanup?.();
        const cleanup = effect();
        harness.effects.set(index, { dependencies, cleanup: cleanup || undefined });
      });
    }
  };
});
vi.mock('next/navigation', () => ({ usePathname: () => '/notices/example/' }));
vi.mock('../hooks/use-user-session', () => ({ useUserSessionState: () => harness.session }));
vi.mock('../lib/cloudbase-data', () => ({
  fetchApplicationRows: harness.fetchRows,
  addProjectToApplicationTable: vi.fn(), updateUserProject: vi.fn(),
  watchApplicationTable: (listener: () => void) => {
    harness.subscriptions.add(listener);
    return () => harness.subscriptions.delete(listener);
  }
}));

beforeEach(() => {
  harness.values = []; harness.cursor = 0; harness.effects.clear(); harness.pending = [];
  harness.subscriptions.clear(); harness.session = { loggedIn: true, ready: true };
  harness.fetchRows.mockReset();
  vi.stubEnv('NEXT_PUBLIC_SEEKOFFER_SURFACE', 'desktop');
});
afterEach(() => {
  for (const effect of harness.effects.values()) effect.cleanup?.();
  vi.unstubAllEnvs();
});

describe('notice application state recovery after logout', () => {
  it('clears a failed first read and restores the login action instead of trapping the user in retry', async () => {
    harness.fetchRows.mockRejectedValue(new Error('offline test fixture'));
    const { NoticeWorkbenchPanel } = await import('../components/notice-workbench-panel');
    function render() {
      harness.cursor = 0;
      return renderToStaticMarkup(createElement(NoticeWorkbenchPanel, { projectId: 'loading-only-test' }));
    }
    async function flush() {
      for (const effect of harness.pending.splice(0)) effect();
      await Promise.resolve();
      await Promise.resolve();
    }
    expect(render()).toContain('正在读取申请状态');
    await flush();
    expect(render()).toContain('重新加载');
    expect(harness.fetchRows).toHaveBeenCalledOnce();

    harness.session = { loggedIn: false, ready: true };
    render();
    await flush();
    const loggedOut = render();
    expect(loggedOut).toContain('登录并加入');
    expect(loggedOut).not.toContain('暂时无法读取申请状态');
    expect(loggedOut).not.toContain('重新加载');
    expect(harness.fetchRows).toHaveBeenCalledOnce();
  });
});
