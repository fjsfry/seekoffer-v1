import { getSupabaseBrowserClient } from './supabase-browser';

export type WorkbenchCustomTodo = {
  id: string;
  text: string;
  date?: string;
  type?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
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
  deliveryStatus: string;
  feedbackStatus: string;
  lastContactDate: string;
  contactNotes: string;
  notes: string;
  updatedAt: string;
};

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

    const id = String((item as { id?: unknown }).id || '').trim();
    const text = String((item as { text?: unknown }).text || '').trim();
    if (!id || !text) {
      return;
    }

    const date = String((item as { date?: unknown }).date || '').trim();
    const type = String((item as { type?: unknown }).type || '').trim();
    const note = String((item as { note?: unknown }).note || '').trim();
    const createdAt = String((item as { createdAt?: unknown }).createdAt || '').trim();
    const updatedAt = String((item as { updatedAt?: unknown }).updatedAt || '').trim();

    todoMap.set(id, {
      id,
      text,
      ...(date ? { date } : {}),
      ...(type ? { type } : {}),
      ...(note ? { note } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(updatedAt ? { updatedAt } : {})
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
    .map((item) => ({
      id: String(item.id || '').trim(),
      schoolName: String(item.schoolName || '').trim().slice(0, 80),
      departmentName: String(item.departmentName || '').trim().slice(0, 80),
      mentorName: String(item.mentorName || '').trim().slice(0, 80),
      mentorTitle: String(item.mentorTitle || '').trim().slice(0, 80),
      schoolRange: String(item.schoolRange || '普通高校').trim().slice(0, 20),
      email: String(item.email || '').trim().slice(0, 160),
      researchDirection: String(item.researchDirection || '').trim().slice(0, 240),
      homepage: String(item.homepage || '').trim().slice(0, 500),
      deliveryStatus: String(item.deliveryStatus || '未投递').trim().slice(0, 20),
      feedbackStatus: String(item.feedbackStatus || '未联系').trim().slice(0, 20),
      lastContactDate: String(item.lastContactDate || '').trim().slice(0, 20),
      contactNotes: String(item.contactNotes || '').trim().slice(0, 1000),
      notes: String(item.notes || '').trim().slice(0, 1000),
      updatedAt: String(item.updatedAt || '').trim() || new Date(0).toISOString()
    }))
    .filter((item) => item.id);
}

function getUpdatedTime(value?: string) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function mergeUpdatedItems<T extends { id: string; updatedAt?: string }>(remoteItems: T[], localItems: T[]) {
  const merged = new Map<string, T>();
  remoteItems.forEach((item) => merged.set(item.id, item));
  localItems.forEach((item) => {
    const remote = merged.get(item.id);
    if (!remote || getUpdatedTime(item.updatedAt) > getUpdatedTime(remote.updatedAt)) {
      merged.set(item.id, item);
    }
  });
  return [...merged.values()];
}

export function mergeWorkbenchState(localState: WorkbenchState, remoteState: Partial<WorkbenchState>) {
  const completedTodoIds = Array.from(
    new Set([
      ...normalizeCompletedTodoIds(remoteState.completedTodoIds),
      ...normalizeCompletedTodoIds(localState.completedTodoIds)
    ])
  );

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

  return {
    completedTodoIds,
    customTodos: mergeUpdatedItems(remoteTodos, localTodos),
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
