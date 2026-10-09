import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkbenchState } from '../lib/workbench-state';

const mocks = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), activeUser: 'member-review' }));
vi.mock('../lib/clerk-d1-session', () => ({
  d1ClientForUser: async () => ({ sessionScope: 'review-session', workbench: mocks.read, saveWorkbench: mocks.save })
}));
vi.mock('../lib/supabase-browser', () => ({ getSupabaseBrowserClient: vi.fn() }));
vi.mock('../lib/desktop-account-reconnect', () => ({ reconnectDesktopAccount: async () => undefined }));
vi.mock('../lib/cloudbase-data', () => ({ synchronizeApplicationWorkspace: async () => undefined }));
vi.mock('../lib/user-session', () => ({ getUserSession: () => ({ userId: mocks.activeUser }) }));
vi.mock('../lib/desktop-route-events', () => ({ emitDesktopSyncStatus: vi.fn() }));

const empty: WorkbenchState = { completedTodoIds: [], customTodos: [], contacts: [] };
const row = (todos: WorkbenchState['customTodos'], revision: number) => ({
  completed_todo_ids: [], custom_todos: todos, mentor_contacts: [], sync_revision: revision
});

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_BACKEND_PROVIDER', 'd1');
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key)
  };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { localStorage: storage });
  mocks.read.mockReset();
  mocks.save.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('desktop workbench editor and manual-sync races', () => {
  it('keeps an in-progress editor change during manual sync and ignores another owner refresh', async () => {
    mocks.read.mockResolvedValueOnce(row([{ id: 'local', text: 'original' }], 1));
    let releaseRemote!: (value: unknown) => void;
    mocks.read.mockImplementationOnce(() => new Promise(resolve => { releaseRemote = resolve; }));
    const api = await import('../lib/workbench-state');
    let editorState = await api.hydrateWorkbenchState(mocks.activeUser, empty);
    const local = await import('../lib/workbench-local-storage');
    local.writeAccountScopedWorkbenchValue(local.WORKBENCH_CUSTOM_TODOS_KEY, mocks.activeUser, JSON.stringify(editorState.customTodos));
    const { watchWorkbenchRefresh, publishWorkbenchRefresh } = await import('../lib/workbench-refresh');
    const { reconcileWorkbench } = await import('../lib/workbench-reconciliation');
    const stop = watchWorkbenchRefresh(change => {
      if (change.userId === mocks.activeUser) editorState = reconcileWorkbench(change.before, editorState, change.state);
    });
    try {
      const { synchronizeDesktopWorkspace } = await import('../lib/desktop-sync-coordinator');
      const pending = synchronizeDesktopWorkspace(mocks.activeUser);
      await vi.waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));
      // A just-committed input render may precede the effect that persists it.
      editorState = { ...editorState, customTodos: editorState.customTodos.map(todo => ({ ...todo, text: 'typing while sync is loading' })) };
      releaseRemote(row([{ id: 'local', text: 'original', note: 'website note' }, { id: 'remote', text: 'new remote task' }], 2));
      await pending;
      expect(editorState.customTodos).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'local', text: 'typing while sync is loading', note: 'website note' }),
        expect.objectContaining({ id: 'remote', text: 'new remote task' })
      ]));
      const unchanged = JSON.stringify(editorState);
      publishWorkbenchRefresh({ userId: 'different-owner', before: editorState, state: empty });
      expect(JSON.stringify(editorState)).toBe(unchanged);
    } finally { stop(); }
  });

  it('keeps a remote addition when another UI snapshot was queued before conflict recovery completed', async () => {
    mocks.read.mockResolvedValueOnce(row([], 1))
      .mockResolvedValueOnce(row([{ id: 'remote', text: 'added on the website' }], 2));
    let rejectFirst!: (error: unknown) => void;
    mocks.save.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }))
      .mockResolvedValueOnce({ sync_revision: 3 })
      .mockResolvedValueOnce({ sync_revision: 4 });
    const api = await import('../lib/workbench-state');
    const { D1RequestError } = await import('../lib/d1-backend-client');
    await api.hydrateWorkbenchState(mocks.activeUser, empty);
    const coordinator = api.createWorkbenchSaveCoordinator(api.saveWorkbenchState);
    const first = coordinator.enqueue(mocks.activeUser, {
      ...empty, customTodos: [{ id: 'local', text: 'first edit' }]
    });
    await vi.waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    const second = coordinator.enqueue(mocks.activeUser, {
      ...empty, customTodos: [{ id: 'local', text: 'second edit' }]
    });
    rejectFirst(new D1RequestError(409, 'REVISION_CONFLICT'));
    const [earlier, latest] = await Promise.all([first, second]);
    expect(earlier.ok).toBe(true);
    expect(latest.ok).toBe(true);
    expect(mocks.save.mock.calls.at(-1)?.[1].custom_todos).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'remote', text: 'added on the website' }),
      expect.objectContaining({ id: 'local', text: 'second edit' })
    ]));
  });

  it('does not delete a freshly imported remote item when the mounted editor next saves its existing state', async () => {
    mocks.read.mockResolvedValueOnce(row([{ id: 'local', text: 'original' }], 1))
      .mockResolvedValueOnce(row([
        { id: 'local', text: 'original' }, { id: 'remote', text: 'added on the website' }
      ], 2));
    mocks.save.mockResolvedValue({ sync_revision: 3 });
    const api = await import('../lib/workbench-state');
    let uiState = await api.hydrateWorkbenchState(mocks.activeUser, empty);
    const { watchWorkbenchRefresh } = await import('../lib/workbench-refresh');
    const { reconcileWorkbench } = await import('../lib/workbench-reconciliation');
    const stop = watchWorkbenchRefresh(change => {
      if(change.userId === mocks.activeUser)uiState=reconcileWorkbench(change.before,uiState,change.state);
    });
    const local = await import('../lib/workbench-local-storage');
    local.writeAccountScopedWorkbenchValue(local.WORKBENCH_COMPLETED_TODOS_KEY, mocks.activeUser, '[]');
    local.writeAccountScopedWorkbenchValue(local.WORKBENCH_CUSTOM_TODOS_KEY, mocks.activeUser, JSON.stringify(uiState.customTodos));
    local.writeAccountScopedWorkbenchValue(local.WORKBENCH_CONTACTS_KEY, mocks.activeUser, '[]');
    const { synchronizeDesktopWorkspace } = await import('../lib/desktop-sync-coordinator');
    await synchronizeDesktopWorkspace(mocks.activeUser);
    expect(JSON.parse(local.readAccountScopedWorkbenchValue(local.WORKBENCH_CUSTOM_TODOS_KEY, mocks.activeUser)!))
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: 'remote' })]));
    // The mounted editor receives the same-window refresh before its next edit.
    expect(uiState.customTodos).toEqual(expect.arrayContaining([expect.objectContaining({id:'remote'})]));
    const editor = api.createWorkbenchSaveCoordinator(api.saveWorkbenchState);
    const result = await editor.enqueue(mocks.activeUser, {
      ...uiState, customTodos: uiState.customTodos.map(todo => todo.id==='local'?{ ...todo, text: 'edited after Settings sync' }:todo)
    });
    expect(result.ok).toBe(true);
    expect(mocks.save.mock.calls.at(-1)?.[1].custom_todos)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: 'remote' })]));
    stop();
  });
});
