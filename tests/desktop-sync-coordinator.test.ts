import { describe, expect, it, vi } from 'vitest';
import {
  createDesktopSyncCoordinator,
  type DesktopSyncCoordinatorDependencies
} from '@/lib/desktop-sync-coordinator';
import type { DesktopSyncStatus } from '@/lib/desktop-route-events';

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function createDependencies(
  overrides: Partial<DesktopSyncCoordinatorDependencies> = {}
): DesktopSyncCoordinatorDependencies {
  return {
    syncApplications: vi.fn(async () => undefined),
    syncWorkbench: vi.fn(async () => undefined),
    isActiveUser: vi.fn(() => true),
    emitStatus: vi.fn(),
    now: () => 1_789_000_000_000,
    timeoutMs: 1_000,
    ...overrides
  };
}

describe('desktop workspace sync coordinator', () => {
  it('refuses an empty or stale account before starting any remote work', async () => {
    const dependencies = createDependencies({
      isActiveUser: (userId) => userId === 'member-1'
    });
    const coordinator = createDesktopSyncCoordinator(dependencies);

    await expect(coordinator.synchronize('')).rejects.toThrow('verified account');
    await expect(coordinator.synchronize('member-2')).rejects.toThrow('verified account');
    expect(dependencies.syncApplications).not.toHaveBeenCalled();
    expect(dependencies.syncWorkbench).not.toHaveBeenCalled();
    expect(dependencies.emitStatus).not.toHaveBeenCalled();
  });

  it('runs the real application and workbench sync once and shares concurrent requests', async () => {
    const deferred = createDeferred<void>();
    const statuses: DesktopSyncStatus[] = [];
    const dependencies = createDependencies({
      syncApplications: vi.fn(() => deferred.promise),
      emitStatus: (status) => statuses.push(status)
    });
    const coordinator = createDesktopSyncCoordinator(dependencies);

    const first = coordinator.synchronize('member-1');
    const second = coordinator.synchronize('member-1');
    expect(second).toBe(first);
    expect(statuses).toEqual(['syncing']);

    deferred.resolve();
    await expect(first).resolves.toEqual({
      userId: 'member-1',
      completedAt: 1_789_000_000_000
    });
    expect(dependencies.syncApplications).toHaveBeenCalledOnce();
    expect(dependencies.syncWorkbench).toHaveBeenCalledOnce();
    expect(statuses).toEqual(['syncing', 'synced']);
  });

  it('reports an honest error while leaving retry available', async () => {
    const statuses: DesktopSyncStatus[] = [];
    const dependencies = createDependencies({
      syncWorkbench: vi.fn(async () => {
        throw new Error('offline');
      }),
      emitStatus: (status) => statuses.push(status)
    });
    const coordinator = createDesktopSyncCoordinator(dependencies);

    await expect(coordinator.synchronize('member-1')).rejects.toThrow('offline');
    expect(statuses).toEqual(['syncing', 'error']);

    await expect(coordinator.synchronize('member-1')).rejects.toThrow('offline');
    expect(dependencies.syncWorkbench).toHaveBeenCalledTimes(2);
  });

  it('does not let an old account completion publish status for the new account', async () => {
    const deferred = createDeferred<void>();
    let activeUser = 'member-1';
    const statuses: DesktopSyncStatus[] = [];
    const dependencies = createDependencies({
      syncApplications: vi.fn(() => deferred.promise),
      isActiveUser: (userId) => userId === activeUser,
      emitStatus: (status) => statuses.push(status)
    });
    const coordinator = createDesktopSyncCoordinator(dependencies);

    const pending = coordinator.synchronize('member-1');
    activeUser = 'member-2';
    deferred.resolve();

    await expect(pending).rejects.toThrow('active account changed');
    expect(statuses).toEqual(['syncing']);
  });
});
