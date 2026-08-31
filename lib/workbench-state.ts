import { getSupabaseBrowserClient } from './supabase-browser';

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

export async function hydrateWorkbenchState(userId: string, localState: WorkbenchState) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('workbench_states')
    .select('completed_todo_ids, custom_todos, mentor_contacts')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const mergedState = mergeWorkbenchState(localState, {
    completedTodoIds: data?.completed_todo_ids,
    customTodos: data?.custom_todos,
    contacts: data?.mentor_contacts
  });

  await saveWorkbenchState(userId, mergedState);
  return mergedState;
}

export async function saveWorkbenchState(userId: string, state: WorkbenchState) {
  const supabase = getSupabaseBrowserClient();
  const payload = {
    user_id: userId,
    completed_todo_ids: normalizeCompletedTodoIds(state.completedTodoIds),
    custom_todos: normalizeCustomTodos(state.customTodos),
    mentor_contacts: normalizeContacts(state.contacts)
  };

  const { error } = await supabase.from('workbench_states').upsert(payload, {
    onConflict: 'user_id'
  });

  if (error) {
    throw error;
  }
}
