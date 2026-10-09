import type { WorkbenchState } from './workbench-state';

export type WorkbenchRefresh = { userId: string; before: WorkbenchState; state: WorkbenchState };
const listeners = new Set<(change: WorkbenchRefresh) => void>();

/** Same-window notification; browser storage events only reach other windows. */
export function publishWorkbenchRefresh(change: WorkbenchRefresh) {
  listeners.forEach(listener => listener(change));
}

export function watchWorkbenchRefresh(listener: (change: WorkbenchRefresh) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
