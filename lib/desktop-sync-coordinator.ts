'use client';

import { synchronizeApplicationWorkspace } from './cloudbase-data';
import { emitDesktopSyncStatus, type DesktopSyncStatus } from './desktop-route-events';
import { getUserSession } from './user-session';
import { hydrateWorkbenchState, type WorkbenchState } from './workbench-state';
import {
  readAccountScopedWorkbenchValue,
  writeAccountScopedWorkbenchValue,
  WORKBENCH_COMPLETED_TODOS_KEY,
  WORKBENCH_CONTACTS_KEY,
  WORKBENCH_CUSTOM_TODOS_KEY
} from './workbench-local-storage';

const DEFAULT_DESKTOP_SYNC_TIMEOUT_MS = 20_000;

export type DesktopSyncResult = {
  userId: string;
  completedAt: number;
};

export type DesktopSyncCoordinatorDependencies = {
  syncApplications: (userId: string) => Promise<void>;
  syncWorkbench: (userId: string) => Promise<void>;
  isActiveUser: (userId: string) => boolean;
  emitStatus: (status: DesktopSyncStatus) => void;
  now?: () => number;
  timeoutMs?: number;
};

function parseArray<T>(raw: string | null) {
  if (!raw) return [] as T[];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [] as T[];
  }
}

function readLocalWorkbenchState(userId: string): WorkbenchState {
  return {
    completedTodoIds: parseArray<string>(
      readAccountScopedWorkbenchValue(WORKBENCH_COMPLETED_TODOS_KEY, userId)
    ),
    customTodos: parseArray<WorkbenchState['customTodos'][number]>(
      readAccountScopedWorkbenchValue(WORKBENCH_CUSTOM_TODOS_KEY, userId)
    ),
    contacts: parseArray<WorkbenchState['contacts'][number]>(
      readAccountScopedWorkbenchValue(WORKBENCH_CONTACTS_KEY, userId)
    )
  };
}

async function syncWorkbenchWorkspace(userId: string) {
  const merged = await hydrateWorkbenchState(userId, readLocalWorkbenchState(userId));
  const writes = [
    writeAccountScopedWorkbenchValue(
      WORKBENCH_COMPLETED_TODOS_KEY,
      userId,
      JSON.stringify(merged.completedTodoIds)
    ),
    writeAccountScopedWorkbenchValue(
      WORKBENCH_CUSTOM_TODOS_KEY,
      userId,
      JSON.stringify(merged.customTodos)
    ),
    writeAccountScopedWorkbenchValue(
      WORKBENCH_CONTACTS_KEY,
      userId,
      JSON.stringify(merged.contacts)
    )
  ];
  if (writes.some((written) => !written)) {
    throw new Error('The synchronized workbench could not be stored on this device.');
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(
      () => reject(new Error('Desktop workspace synchronization timed out.')),
      timeoutMs
    );
    promise.then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export function createDesktopSyncCoordinator(dependencies: DesktopSyncCoordinatorDependencies) {
  const inFlight = new Map<string, Promise<DesktopSyncResult>>();
  const now = dependencies.now ?? Date.now;
  const timeoutMs = dependencies.timeoutMs ?? DEFAULT_DESKTOP_SYNC_TIMEOUT_MS;

  return {
    synchronize(userId: string) {
      const normalizedUserId = userId.trim();
      if (!normalizedUserId || !dependencies.isActiveUser(normalizedUserId)) {
        return Promise.reject(new Error('A verified account is required to synchronize.'));
      }

      const pending = inFlight.get(normalizedUserId);
      if (pending) return pending;

      const task = (async () => {
        dependencies.emitStatus('syncing');
        try {
          await withTimeout(
            Promise.all([
              dependencies.syncApplications(normalizedUserId),
              dependencies.syncWorkbench(normalizedUserId)
            ]),
            timeoutMs
          );
          if (!dependencies.isActiveUser(normalizedUserId)) {
            throw new Error('The active account changed during synchronization.');
          }
          dependencies.emitStatus('synced');
          return { userId: normalizedUserId, completedAt: now() };
        } catch (error) {
          if (dependencies.isActiveUser(normalizedUserId)) {
            dependencies.emitStatus('error');
          }
          throw error;
        } finally {
          inFlight.delete(normalizedUserId);
        }
      })();

      inFlight.set(normalizedUserId, task);
      return task;
    }
  };
}

const desktopSyncCoordinator = createDesktopSyncCoordinator({
  syncApplications: synchronizeApplicationWorkspace,
  syncWorkbench: syncWorkbenchWorkspace,
  isActiveUser: (userId) => getUserSession()?.userId === userId,
  emitStatus: emitDesktopSyncStatus
});

export function synchronizeDesktopWorkspace(userId: string) {
  return desktopSyncCoordinator.synchronize(userId);
}
