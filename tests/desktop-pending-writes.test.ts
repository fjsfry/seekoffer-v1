import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createDesktopPendingWriteTracker } from '@/lib/desktop-pending-writes';

const projectRoot = resolve(process.cwd());

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('desktop pending-write barrier', () => {
  it('stays blocked when concurrent writes finish out of order and unblocks only after all finish', async () => {
    const counts: number[] = [];
    const tracker = createDesktopPendingWriteTracker((snapshot) => counts.push(snapshot.count));
    const firstWrite = deferred<string>();
    const secondWrite = deferred<string>();

    const first = tracker.track('first-write', () => firstWrite.promise);
    const second = tracker.track('second-write', () => secondWrite.promise);

    expect(tracker.getCount()).toBe(2);
    expect(tracker.getCount() > 0).toBe(true);

    secondWrite.resolve('second');
    await expect(second).resolves.toBe('second');
    expect(tracker.getCount()).toBe(1);
    expect(tracker.getCount() > 0).toBe(true);

    firstWrite.resolve('first');
    await expect(first).resolves.toBe('first');
    expect(tracker.getCount()).toBe(0);
    expect(tracker.getCount() > 0).toBe(false);
    expect(counts).toEqual([1, 2, 1, 0]);
  });

  it('makes finish idempotent so repeated cleanup cannot release another write', () => {
    const onChange = vi.fn();
    const tracker = createDesktopPendingWriteTracker(onChange);
    const finishFirst = tracker.begin('first-write');
    const finishSecond = tracker.begin('second-write');

    finishFirst();
    finishFirst();
    expect(tracker.getCount()).toBe(1);

    finishSecond();
    finishSecond();
    expect(tracker.getCount()).toBe(0);
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it('clears the barrier in finally when a write rejects', async () => {
    const tracker = createDesktopPendingWriteTracker();
    const failure = new Error('cloud write failed');

    const operation = tracker.track('failing-write', async () => {
      throw failure;
    });

    expect(tracker.getCount()).toBe(1);
    await expect(operation).rejects.toBe(failure);
    expect(tracker.getCount()).toBe(0);
  });

  it('clears the barrier when an operation throws before returning a promise', async () => {
    const tracker = createDesktopPendingWriteTracker();

    const operation = tracker.track('synchronous-failure', () => {
      throw new Error('failed before request');
    });

    await expect(operation).rejects.toThrow('failed before request');
    expect(tracker.getCount()).toBe(0);
  });

  it('connects every desktop workbench write surface and both install gates to the barrier', async () => {
    const [provider, today, home, me, noticePanel] = await Promise.all([
      readFile(resolve(projectRoot, 'components/desktop-update-provider.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-today.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-home.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'app/me/page.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/notice-workbench-panel.tsx'), 'utf8')
    ]);

    expect(provider.match(/hasDesktopPendingWrites\(\)/g)).toHaveLength(2);
    expect(provider).toContain('blocked={pendingWriteCount > 0}');
    expect(provider).not.toContain("syncStatus === 'syncing'");
    expect(today).toContain("trackDesktopPendingWrite('today-workbench-save'");
    expect(home).toContain("trackDesktopPendingWrite('home-project-update'");
    expect(me).toContain("beginDesktopPendingWrite('me-workbench-save'");
    expect(me).not.toContain("trackDesktopPendingWrite('me-project-update'");
    expect(me).not.toContain('ApplicationFillAssistant');
    expect(noticePanel).toContain("trackDesktopPendingWrite('notice-project-update'");
  });
});
