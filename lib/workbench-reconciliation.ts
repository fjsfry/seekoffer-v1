import type {WorkbenchState} from './workbench-state';

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left).filter(key => left[key] !== undefined);
  return keys.length === Object.keys(right).filter(key => right[key] !== undefined).length && keys.every(key => equal(left[key], right[key]));
}

function conflict(): never {
  throw new Error('同一条日程或联系人已在另一设备修改，未覆盖任何一方。请先核对两端内容，本机修改已保留。');
}

function mergeItems<T extends {id: string}>(base: T[], local: T[], remote: T[]): T[] {
  const b = new Map(base.map(item => [item.id, item]));
  const l = new Map(local.map(item => [item.id, item]));
  const r = new Map(remote.map(item => [item.id, item]));
  const result: T[] = [];
  for (const id of new Set([...r.keys(), ...l.keys(), ...b.keys()])) {
    const before = b.get(id), here = l.get(id), there = r.get(id);
    let next: T | undefined;
    if (equal(here, before)) next = there;
    else if (equal(there, before) || equal(here, there)) next = here;
    else {
      if (!before || !here || !there) conflict();
      // Independent fields can merge; edit-versus-delete and same-field edits need review.
      const fields: Record<string, unknown> = {};
      for (const key of new Set([...Object.keys(before), ...Object.keys(here), ...Object.keys(there)])) {
        const k = key as keyof T;
        if (key === 'updatedAt') fields[key] = [here[k], there[k]].filter(value => typeof value === 'string').sort().at(-1);
        else if (equal(here[k], before[k])) fields[key] = there[k];
        else if (equal(there[k], before[k]) || equal(here[k], there[k])) fields[key] = here[k];
        else conflict();
      }
      next = fields as T;
    }
    if (next) result.push(next);
  }
  return result;
}

export function reconcileWorkbench(base: WorkbenchState, local: WorkbenchState, remote: WorkbenchState): WorkbenchState {
  const before = new Set(base.completedTodoIds), here = new Set(local.completedTodoIds), there = new Set(remote.completedTodoIds);
  return {
    completedTodoIds: [...new Set([...there, ...here, ...before])].filter(id => here.has(id) === before.has(id) ? there.has(id) : here.has(id)),
    customTodos: mergeItems(base.customTodos, local.customTodos, remote.customTodos),
    contacts: mergeItems(base.contacts, local.contacts, remote.contacts)
  };
}
