import { describe, expect, it } from 'vitest';
import { CloudflareApiError, type cloudflareRequest } from '../lib/cloudflare-api';
import { createWorkbenchSyncClient, type WorkbenchState } from '../lib/workbench-state';

const empty: WorkbenchState = { completedTodoIds: [], customTodos: [], contacts: [] };
function fixture() {
  let row = { completed_todo_ids: [] as string[], custom_todos: [{ id: 'a', text: 'Existing', updatedAt: '2026-01-01T00:00:00Z', completed: false }], mentor_contacts: [], sync_revision: 7 };
  const writes: Record<string, unknown>[] = [];
  let conflict = false, offline = false, reads = 0;
  const request = async <T>(_path: string, init: RequestInit = {}) => {
    expect(new Headers(init.headers).get('X-Workspace-Owner')).toBe('owner');
    if (offline) throw new TypeError('offline');
    if (init.method !== 'PUT') { reads++; return structuredClone(row) as T; }
    const data = JSON.parse(String(init.body));
    writes.push(data);
    if (conflict) {
      conflict = false;
      row.custom_todos.push({ id: 'remote', text: 'Another device', updatedAt: '2026-01-02T00:00:00Z', completed: false });
      row.sync_revision++;
    }
    if (data.expectedRevision !== row.sync_revision) throw new CloudflareApiError(409, 'REVISION_CONFLICT');
    row = { ...row, ...data, sync_revision: row.sync_revision + 1 };
    return { sync_revision: row.sync_revision } as T;
  };
  return { client: createWorkbenchSyncClient(request as typeof cloudflareRequest), writes, row: () => row, reads: () => reads, conflict: () => { conflict = true; }, offline: (value: boolean) => { offline = value; } };
}

describe('workbench optimistic synchronization', () => {
  it('hydrates without writing unchanged data and uses the acknowledged revision for edits', async () => {
    const f = fixture();
    const initial = await f.client.hydrate('owner', empty);
    expect(f.writes).toHaveLength(0);
    const saved = await f.client.save('owner', { ...initial, customTodos: initial.customTodos.map(item => ({ ...item, text: 'Edited' })) });
    expect(f.writes[0].expectedRevision).toBe(7);
    expect(f.row().custom_todos[0].text).toBe('Edited');
    await f.client.save('owner', saved);
    expect(f.writes).toHaveLength(1);
  });

  it('rebases a conflict without losing a second device addition', async () => {
    const f = fixture(), initial = await f.client.hydrate('owner', empty);
    f.conflict();
    const saved = await f.client.save('owner', { ...initial, customTodos: initial.customTodos.map(item => ({ ...item, text: 'Local edit' })) });
    expect(f.writes.map(item => item.expectedRevision)).toEqual([7, 8]);
    expect(saved.customTodos.map(item => item.id)).toEqual(['a', 'remote']);
    expect(saved.customTodos[0].text).toBe('Local edit');
  });

  it('serializes rapid edits and the newer edit wins even within one millisecond', async () => {
    const f = fixture(), initial = await f.client.hydrate('owner', empty);
    await Promise.all(['First edit', 'Newest edit'].map(text => f.client.save('owner', { ...initial, customTodos: initial.customTodos.map(item => ({ ...item, text })) })));
    expect(f.writes.map(item => item.expectedRevision)).toEqual([7, 8]);
    expect(f.row().custom_todos[0].text).toBe('Newest edit');
  });

  it('preserves deletions and permits unchecking completed tasks', async () => {
    const f = fixture(), initial = await f.client.hydrate('owner', empty);
    const checked = await f.client.save('owner', { ...initial, completedTodoIds: ['a', 'builtin'] });
    const unchecked = await f.client.save('owner', { ...checked, completedTodoIds: [] });
    expect(unchecked.completedTodoIds).toEqual([]);
    const deleted = await f.client.save('owner', { ...unchecked, customTodos: [] });
    expect(deleted.customTodos[0].deletedAt).toBeTruthy();
    const staleDevice = await f.client.hydrate('owner', initial);
    expect(staleDevice.customTodos[0].deletedAt).toBeTruthy();
  });

  it('keeps local changes after offline failure and resumes from a fresh cloud revision', async () => {
    const f = fixture(), initial = await f.client.hydrate('owner', empty);
    const edited = { ...initial, customTodos: initial.customTodos.map(item => ({ ...item, text: 'Offline edit', updatedAt: new Date().toISOString() })) };
    f.offline(true);
    await expect(f.client.save('owner', edited)).rejects.toThrow('offline');
    f.offline(false);
    const saved = await f.client.save('owner', edited);
    expect(saved.customTodos[0].text).toBe('Offline edit');
    expect(f.reads()).toBe(2);
  });
});
