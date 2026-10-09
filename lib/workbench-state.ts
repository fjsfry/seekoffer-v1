import { CloudflareApiError, cloudflareRequest } from './cloudflare-api';

export const WORKBENCH_TODO_CATEGORIES = ['申请', '学习', '作业', '工作', '生活', '其他'] as const;
export const WORKBENCH_TODO_PRIORITIES = ['重要且紧急', '重要不紧急', '不重要紧急', '不重要不紧急'] as const;

export type WorkbenchTodoCategory = (typeof WORKBENCH_TODO_CATEGORIES)[number];
export type WorkbenchTodoPriority = (typeof WORKBENCH_TODO_PRIORITIES)[number];

export const DEFAULT_WORKBENCH_TODO_CATEGORY: WorkbenchTodoCategory = '申请';
export const DEFAULT_WORKBENCH_TODO_PRIORITY: WorkbenchTodoPriority = '重要不紧急';

export function normalizeWorkbenchTodoCategory(value: unknown): WorkbenchTodoCategory {
  return WORKBENCH_TODO_CATEGORIES.includes(value as WorkbenchTodoCategory)
    ? value as WorkbenchTodoCategory
    : DEFAULT_WORKBENCH_TODO_CATEGORY;
}

export function normalizeWorkbenchTodoPriority(value: unknown): WorkbenchTodoPriority {
  return WORKBENCH_TODO_PRIORITIES.includes(value as WorkbenchTodoPriority)
    ? value as WorkbenchTodoPriority
    : DEFAULT_WORKBENCH_TODO_PRIORITY;
}

export type WorkbenchCustomTodo = {
  id: string;
  text: string;
  date?: string;
  type?: string;
  category?: WorkbenchTodoCategory;
  priority?: WorkbenchTodoPriority;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
  completed?: boolean;
  deletedAt?: string;
};

export type WorkbenchMentorContact = {
  id: string;
  schoolName: string;
  departmentName: string;
  mentorName: string;
  mentorTitle: string;
  schoolRange: string;
  email: string;
  researchDirection: string;
  homepage: string;
  photoCacheKey: string;
  photoSourceUrl: string;
  photoPageUrl: string;
  photoUpdatedAt: string;
  deliveryStatus: string;
  feedbackStatus: string;
  contactChannel: string;
  lastContactDate: string;
  nextFollowUpDate: string;
  contactNotes: string;
  notes: string;
  privacyNotice: string;
  updatedAt: string;
  deletedAt?: string;
};

export function normalizeMentorPhotoCacheKey(value: unknown) {
  const text = String(value || '').trim().slice(0, 96).toLowerCase();
  return /^[a-f0-9]{64}\.(?:jpg|png|webp)$/.test(text) ? text : '';
}

export function normalizeMentorPhotoSourceUrl(value: unknown) {
  const text = String(value || '').trim().slice(0, 500);
  if (!text) return '';
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    return url.toString();
  } catch {
    return '';
  }
}

export type WorkbenchState = {
  completedTodoIds: string[];
  customTodos: WorkbenchCustomTodo[];
  contacts: WorkbenchMentorContact[];
};

function normalizeCompletedTodoIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)));
}

function normalizeCustomTodos(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as WorkbenchCustomTodo[];
  }

  const todoMap = new Map<string, WorkbenchCustomTodo>();

  value.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const id = String((item as { id?: unknown }).id || '').trim().slice(0, 160);
    const text = String((item as { text?: unknown }).text || '').trim().slice(0, 160);
    if (!id || !text) {
      return;
    }

    const date = String((item as { date?: unknown }).date || '').trim().slice(0, 20);
    const type = String((item as { type?: unknown }).type || '').trim().slice(0, 40);
    const category = normalizeWorkbenchTodoCategory((item as { category?: unknown }).category);
    const priority = normalizeWorkbenchTodoPriority((item as { priority?: unknown }).priority);
    const note = String((item as { note?: unknown }).note || '').trim().slice(0, 1000);
    const createdAt = String((item as { createdAt?: unknown }).createdAt || '').trim();
    const updatedAt = String((item as { updatedAt?: unknown }).updatedAt || '').trim();
    const completed = (item as { completed?: unknown }).completed;
    const deletedAt = String((item as { deletedAt?: unknown }).deletedAt || '').trim();

    todoMap.set(id, {
      id,
      text,
      ...(date ? { date } : {}),
      ...(type ? { type } : {}),
      category,
      priority,
      ...(note ? { note } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(updatedAt ? { updatedAt } : {}),
      ...(typeof completed === 'boolean' ? { completed } : {}),
      ...(deletedAt ? { deletedAt } : {})
    });
  });

  return [...todoMap.values()];
}

function normalizeContacts(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as WorkbenchMentorContact[];
  }

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      const deletedAt = String(item.deletedAt || '').trim();
      return {
        id: String(item.id || '').trim().slice(0, 160),
        schoolName: String(item.schoolName || '').trim().slice(0, 80),
        departmentName: String(item.departmentName || '').trim().slice(0, 80),
        mentorName: String(item.mentorName || '').trim().slice(0, 80),
        mentorTitle: String(item.mentorTitle || '').trim().slice(0, 80),
        schoolRange: String(item.schoolRange || '普通高校').trim().slice(0, 20),
        email: String(item.email || '').trim().slice(0, 160),
        researchDirection: String(item.researchDirection || '').trim().slice(0, 240),
        homepage: String(item.homepage || '').trim().slice(0, 500),
        photoCacheKey: normalizeMentorPhotoCacheKey(item.photoCacheKey),
        photoSourceUrl: normalizeMentorPhotoSourceUrl(item.photoSourceUrl),
        photoPageUrl: normalizeMentorPhotoSourceUrl(item.photoPageUrl),
        photoUpdatedAt: String(item.photoUpdatedAt || '').trim().slice(0, 40),
        deliveryStatus: String(item.deliveryStatus || '未投递').trim().slice(0, 20),
        feedbackStatus: String(item.feedbackStatus || '未联系').trim().slice(0, 20),
        contactChannel: String(item.contactChannel || '').trim().slice(0, 40),
        lastContactDate: String(item.lastContactDate || '').trim().slice(0, 20),
        nextFollowUpDate: String(item.nextFollowUpDate || '').trim().slice(0, 20),
        contactNotes: String(item.contactNotes || '').trim().slice(0, 1000),
        notes: String(item.notes || '').trim().slice(0, 1000),
        privacyNotice: String(item.privacyNotice || '').trim().slice(0, 240),
        updatedAt: String(item.updatedAt || '').trim() || deletedAt || new Date(0).toISOString(),
        ...(deletedAt ? { deletedAt } : {})
      };
    })
    .filter((item) => item.id);
}

function getUpdatedTime(value?: string) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function mergeUpdatedItems<T extends { id: string; updatedAt?: string; deletedAt?: string }>(remoteItems: T[], localItems: T[]) {
  const merged = new Map<string, T>();
  remoteItems.forEach((item) => merged.set(item.id, item));
  localItems.forEach((item) => {
    const remote = merged.get(item.id);
    // A deletion is permanent until an explicit restore operation exists. A
    // stale device may edit an old live copy after another device deleted it;
    // preferring the tombstone prevents that edit from resurrecting the item.
    const shouldUseLocal =
      !remote ||
      (Boolean(item.deletedAt) && !remote.deletedAt) ||
      (!item.deletedAt && !remote.deletedAt && getUpdatedTime(item.updatedAt) > getUpdatedTime(remote.updatedAt)) ||
      (Boolean(item.deletedAt) === Boolean(remote.deletedAt) &&
        getUpdatedTime(item.updatedAt) > getUpdatedTime(remote.updatedAt));
    if (shouldUseLocal) {
      merged.set(item.id, item);
    }
  });
  return [...merged.values()];
}

export type WorkbenchSaveResult = {
  revision: number;
  isLatest: boolean;
  ok: boolean;
  error?: unknown;
};

/**
 * Serializes cloud writes and marks whether a completion still represents the
 * latest local edit. This keeps an older, slower request from overwriting a
 * newer snapshot and from reporting a stale "synced" state in the UI.
 */
export function createWorkbenchSaveCoordinator(
  persist: (userId: string, state: WorkbenchState) => Promise<void>
) {
  let tail: Promise<void> = Promise.resolve();
  let latestRevision = 0;

  return {
    enqueue(userId: string, state: WorkbenchState): Promise<WorkbenchSaveResult> {
      const revision = ++latestRevision;
      const task = tail.then(() => persist(userId, state));
      tail = task.then(
        () => undefined,
        () => undefined
      );

      return task.then(
        () => ({ revision, isLatest: revision === latestRevision, ok: true }),
        (error: unknown) => ({ revision, isLatest: revision === latestRevision, ok: false, error })
      );
    }
  };
}

export function mergeWorkbenchState(localState: WorkbenchState, remoteState: Partial<WorkbenchState>) {
  const legacyCompletedTodoIds = new Set([
    ...normalizeCompletedTodoIds(remoteState.completedTodoIds),
    ...normalizeCompletedTodoIds(localState.completedTodoIds)
  ]);

  const remoteTodos = normalizeCustomTodos(remoteState.customTodos).map((item) => ({
    ...item,
    updatedAt: item.updatedAt || item.createdAt
  }));
  const localTodos = normalizeCustomTodos(localState.customTodos).map((item) => ({
    ...item,
    updatedAt: item.updatedAt || item.createdAt
  }));
  const contacts = mergeUpdatedItems(
    normalizeContacts(remoteState.contacts),
    normalizeContacts(localState.contacts)
  );
  const customTodos = mergeUpdatedItems(remoteTodos, localTodos);
  const customTodoIds = new Set(customTodos.map((item) => item.id));
  const completedTodoIds = [
    ...customTodos
      .filter((item) =>
        !item.deletedAt &&
        (typeof item.completed === 'boolean'
          ? item.completed
          : legacyCompletedTodoIds.has(item.id))
      )
      .map((item) => item.id),
    ...[...legacyCompletedTodoIds].filter((id) => !customTodoIds.has(id))
  ];

  return {
    completedTodoIds,
    customTodos,
    contacts
  } satisfies WorkbenchState;
}

function normalizedState(state: Partial<WorkbenchState>): WorkbenchState {
  const completedTodoIds = normalizeCompletedTodoIds(state.completedTodoIds);
  return {
    completedTodoIds,
    customTodos: normalizeCustomTodos(state.customTodos).map(item => ({ ...item, completed: !item.deletedAt && completedTodoIds.includes(item.id) })),
    contacts: normalizeContacts(state.contacts)
  };
}

type RemoteWorkbench = {
  completed_todo_ids: string[];
  custom_todos: WorkbenchCustomTodo[];
  mentor_contacts: WorkbenchMentorContact[];
  sync_revision: number;
};
type SyncedWorkbench = { state: WorkbenchState; revision: number };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
let lastChangeTime = 0;

function localChanges(local: WorkbenchState, base: WorkbenchState): WorkbenchState {
  lastChangeTime = Math.max(Date.now(), lastChangeTime + 1, ...base.customTodos.map(item => getUpdatedTime(item.updatedAt) + 1), ...base.contacts.map(item => getUpdatedTime(item.updatedAt) + 1));
  const now = new Date(lastChangeTime).toISOString();
  function changed<T extends { id: string; updatedAt?: string; deletedAt?: string }>(items: T[], previous: T[]) {
    const before = new Map(previous.map(item => [item.id, item]));
    const result = items.map(item => {
      const old = before.get(item.id);
      before.delete(item.id);
      return same(item, old) ? item : { ...item, updatedAt: now };
    });
    for (const item of before.values()) result.push(item.deletedAt ? item : { ...item, updatedAt: now, deletedAt: now });
    return result;
  }
  return { ...local, customTodos: changed(local.customTodos, base.customTodos), contacts: changed(local.contacts, base.contacts) };
}

export function createWorkbenchSyncClient(request: typeof cloudflareRequest) {
  const snapshots = new Map<string, SyncedWorkbench>();
  const queues = new Map<string, Promise<unknown>>();
  async function read(userId: string): Promise<SyncedWorkbench> {
    const data = await request<RemoteWorkbench | null>('/v1/me/workbench', { headers: { 'X-Workspace-Owner': userId } }, true);
    if (data && (!Number.isSafeInteger(data.sync_revision) || data.sync_revision < 1)) throw new Error('WORKBENCH_REVISION_INVALID');
    return { revision: data?.sync_revision || 0, state: normalizedState({ completedTodoIds: data?.completed_todo_ids, customTodos: data?.custom_todos, contacts: data?.mentor_contacts }) };
  }
  function enqueue(userId: string, local: WorkbenchState, hydrate: boolean) {
    if (!userId.trim()) return Promise.reject(new Error('WORKBENCH_OWNER_REQUIRED'));
    // Capture the edit, not a mutable React object that can change while queued.
    const captured = normalizedState(local);
    const baseline = snapshots.get(userId);
    const desired = baseline && !hydrate ? localChanges(captured, baseline.state) : captured;
    const task = (queues.get(userId) || Promise.resolve()).catch(() => undefined).then(async () => {
      let remote = !hydrate && snapshots.get(userId) || await read(userId);
      for (let attempt = 0; attempt < 3; attempt++) {
        let state = normalizedState(mergeWorkbenchState(desired, remote.state));
        // Built-in checklist IDs have no timestamps. Rebase explicit local
        // unchecks against the last acknowledged snapshot, retaining other devices' additions.
        if (baseline && !hydrate) {
          const removed = new Set(baseline.state.completedTodoIds.filter(id => !captured.completedTodoIds.includes(id)));
          state = normalizedState({ ...state, completedTodoIds: state.completedTodoIds.filter(id => !removed.has(id)) });
        }
        if (same(state, remote.state)) {
          snapshots.set(userId, remote);
          return state;
        }
        try {
          const result = await request<{ sync_revision: number }>('/v1/me/workbench', {
            method: 'PUT',
            headers: { 'X-Workspace-Owner': userId },
            body: JSON.stringify({ expectedRevision: remote.revision, completed_todo_ids: state.completedTodoIds, custom_todos: state.customTodos, mentor_contacts: state.contacts })
          }, true);
          if (!Number.isSafeInteger(result.sync_revision) || result.sync_revision <= remote.revision) throw new Error('WORKBENCH_REVISION_INVALID');
          snapshots.set(userId, { state, revision: result.sync_revision });
          return state;
        } catch (error) {
          // A lost response may already have committed. Refetch on the next
          // attempt; never retry by creating or overwriting version zero.
          snapshots.delete(userId);
          if (!(error instanceof CloudflareApiError) || error.status !== 409 || error.code !== 'REVISION_CONFLICT' || attempt === 2) throw error;
          remote = await read(userId);
        }
      }
      throw new Error('WORKBENCH_SYNC_RETRY_EXHAUSTED');
    });
    queues.set(userId, task);
    void task.finally(() => { if (queues.get(userId) === task) queues.delete(userId); }).catch(() => undefined);
    return task;
  }
  return {
    hydrate: (userId: string, state: WorkbenchState) => enqueue(userId, state, true),
    save: (userId: string, state: WorkbenchState) => enqueue(userId, state, false)
  };
}

const workbenchSync = createWorkbenchSyncClient(cloudflareRequest);
export const hydrateWorkbenchState = workbenchSync.hydrate;
export const saveWorkbenchState = workbenchSync.save;
