import { getSupabaseBrowserClient } from './supabase-browser';

export type WorkbenchCustomTodo = {
  id: string;
  text: string;
};

type WorkbenchState = {
  completedTodoIds: string[];
  customTodos: WorkbenchCustomTodo[];
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

    todoMap.set(id, { id, text });
  });

  return [...todoMap.values()];
}

function mergeWorkbenchState(localState: WorkbenchState, remoteState: Partial<WorkbenchState>) {
  const completedTodoIds = Array.from(
    new Set([
      ...normalizeCompletedTodoIds(remoteState.completedTodoIds),
      ...normalizeCompletedTodoIds(localState.completedTodoIds)
    ])
  );

  const customTodoMap = new Map<string, WorkbenchCustomTodo>();
  normalizeCustomTodos(remoteState.customTodos).forEach((item) => customTodoMap.set(item.id, item));
  normalizeCustomTodos(localState.customTodos).forEach((item) => customTodoMap.set(item.id, item));

  return {
    completedTodoIds,
    customTodos: [...customTodoMap.values()]
  } satisfies WorkbenchState;
}

export async function hydrateWorkbenchState(userId: string, localState: WorkbenchState) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('workbench_states')
    .select('completed_todo_ids, custom_todos')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const mergedState = mergeWorkbenchState(localState, {
    completedTodoIds: data?.completed_todo_ids,
    customTodos: data?.custom_todos
  });

  await saveWorkbenchState(userId, mergedState);
  return mergedState;
}

export async function saveWorkbenchState(userId: string, state: WorkbenchState) {
  const supabase = getSupabaseBrowserClient();
  const payload = {
    user_id: userId,
    completed_todo_ids: normalizeCompletedTodoIds(state.completedTodoIds),
    custom_todos: normalizeCustomTodos(state.customTodos)
  };

  const { error } = await supabase.from('workbench_states').upsert(payload, {
    onConflict: 'user_id'
  });

  if (error) {
    throw error;
  }
}
