import { getSupabaseBrowserClient } from './supabase-browser';
import {isD1Backend} from './backend-mode';
import {d1ClientForUser} from './clerk-d1-session';
import {reconcileWorkbench} from './workbench-reconciliation';
const d1Revisions=new Map<string,number>();
const d1SavedSnapshots=new Map<string,string>();
const d1ReadFlights=new Map<string,Promise<unknown>>();
const d1SaveFlights=new Map<string,Promise<void>>();
const baselines=new Map<string,WorkbenchState>();
function snapshot(state:WorkbenchState){return {completed_todo_ids:normalizeCompletedTodoIds(state.completedTodoIds),custom_todos:normalizeCustomTodos(state.customTodos),mentor_contacts:normalizeContacts(state.contacts)};}
function normalizedState(state:WorkbenchState):WorkbenchState {const data=snapshot(state);return {completedTodoIds:data.completed_todo_ids,customTodos:data.custom_todos,contacts:data.mentor_contacts};}
function baselineKey(userId:string){return 'seekoffer:workbench-baseline:v1:'+userId;}
function readBaseline(userId:string):WorkbenchState|undefined {
  let text:string|null=null;
  try {if(typeof localStorage!=='undefined')text=localStorage.getItem(baselineKey(userId));}catch{/* In-memory baseline remains available when browser storage is blocked. */}
  if(text){
    let value:WorkbenchState;try{value=JSON.parse(text);}catch{throw new Error('本机同步基线无法读取，原日程和联系人已保留，请先导出资料后核对。');}
    if(!value||!Array.isArray(value.completedTodoIds)||!Array.isArray(value.customTodos)||!Array.isArray(value.contacts))throw new Error('本机同步基线不完整，原日程和联系人已保留。');
    return normalizedState(value);
  }
  return baselines.get(userId);
}
function rememberBaseline(userId:string,state:WorkbenchState){
  const value=normalizedState(state);baselines.set(userId,value);
  try{if(typeof localStorage!=='undefined')localStorage.setItem(baselineKey(userId),JSON.stringify(value));}catch{/* Do not turn an acknowledged cloud save into an unhandled browser-storage error. */}
}

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
  const text = String(value || '').trim();
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

export function normalizeCustomTodos(value: unknown) {
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
    const category = normalizeWorkbenchTodoCategory((item as { category?: unknown }).category);
    const priority = normalizeWorkbenchTodoPriority((item as { priority?: unknown }).priority);
    const note = String((item as { note?: unknown }).note || '').trim();
    const createdAt = String((item as { createdAt?: unknown }).createdAt || '').trim();
    const updatedAt = String((item as { updatedAt?: unknown }).updatedAt || '').trim();
    const completed = (item as { completed?: unknown }).completed;
    const deletedAt = String((item as { deletedAt?: unknown }).deletedAt || '').trim();

    todoMap.set(id, {
      ...item,
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

export function normalizeContacts(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as WorkbenchMentorContact[];
  }

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      const deletedAt = String(item.deletedAt || '').trim();
      return {
        ...item,
        id: String(item.id || '').trim(),
        schoolName: String(item.schoolName || '').trim(),
        departmentName: String(item.departmentName || '').trim(),
        mentorName: String(item.mentorName || '').trim(),
        mentorTitle: String(item.mentorTitle || '').trim(),
        schoolRange: String(item.schoolRange || '普通高校').trim(),
        email: String(item.email || '').trim(),
        researchDirection: String(item.researchDirection || '').trim(),
        homepage: String(item.homepage || '').trim(),
        photoCacheKey: normalizeMentorPhotoCacheKey(item.photoCacheKey),
        photoSourceUrl: normalizeMentorPhotoSourceUrl(item.photoSourceUrl),
        photoPageUrl: normalizeMentorPhotoSourceUrl(item.photoPageUrl),
        photoUpdatedAt: String(item.photoUpdatedAt || '').trim(),
        deliveryStatus: String(item.deliveryStatus || '未投递').trim(),
        feedbackStatus: String(item.feedbackStatus || '未联系').trim(),
        contactChannel: String(item.contactChannel || '').trim(),
        lastContactDate: String(item.lastContactDate || '').trim(),
        nextFollowUpDate: String(item.nextFollowUpDate || '').trim(),
        contactNotes: String(item.contactNotes || '').trim(),
        notes: String(item.notes || '').trim(),
        privacyNotice: String(item.privacyNotice || '').trim(),
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
  if(isD1Backend()){
    const client=await d1ClientForUser(userId);
    const key=userId+':'+client.sessionScope;
    await d1SaveFlights.get(key);
    let flight=d1ReadFlights.get(key);if(!flight){flight=client.workbench();d1ReadFlights.set(key,flight);}
    let data:{completed_todo_ids:unknown[];custom_todos:unknown[];mentor_contacts:unknown[];sync_revision:number}|null;
    try{data=await flight as typeof data;}finally{if(d1ReadFlights.get(key)===flight)d1ReadFlights.delete(key);}
    if(data===null){
      const empty={completedTodoIds:[],customTodos:[],contacts:[]},baseline=readBaseline(userId);
      const merged=baseline?reconcileWorkbench(baseline,normalizedState(localState),empty):localState;
      d1Revisions.set(key,0);d1SavedSnapshots.set(key,JSON.stringify(snapshot(empty)));rememberBaseline(userId,empty);return merged;
    }
    if(!data||!Array.isArray(data.completed_todo_ids)||!Array.isArray(data.custom_todos)||!Array.isArray(data.mentor_contacts)||!Number.isSafeInteger(data.sync_revision)||data.sync_revision<1)throw new Error('工作台响应不完整，已保留本地数据。');
    const remote=normalizedState({completedTodoIds:data.completed_todo_ids,customTodos:data.custom_todos,contacts:data.mentor_contacts} as WorkbenchState),baseline=readBaseline(userId);
    const merged=baseline?reconcileWorkbench(baseline,normalizedState(localState),remote):mergeWorkbenchState(localState,remote);
    d1Revisions.set(key,data.sync_revision);d1SavedSnapshots.set(key,JSON.stringify(snapshot(remote)));rememberBaseline(userId,remote);
    return merged;
  }
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
  if(isD1Backend()){
    const client=await d1ClientForUser(userId);
    const key=userId+':'+client.sessionScope,payload=snapshot(state),serialized=JSON.stringify(payload);
    const save=async()=>{
      const expected=d1Revisions.get(key);if(expected===undefined)throw new Error('请先同步工作台基线，本地修改已保留。');
      if(d1SavedSnapshots.get(key)===serialized)return;
      const result=await client.saveWorkbench(expected,payload) as {sync_revision:number};
      if(!result||!Number.isSafeInteger(result.sync_revision)||result.sync_revision<=expected)throw new Error('保存结果未确认，请保留本地修改。');
      d1Revisions.set(key,result.sync_revision);d1SavedSnapshots.set(key,serialized);rememberBaseline(userId,{completedTodoIds:payload.completed_todo_ids,customTodos:payload.custom_todos,contacts:payload.mentor_contacts});
    };
    // A failed predecessor also stops queued saves, instead of repeatedly hitting a quota or overwriting a conflict.
    const previous=d1SaveFlights.get(key),flight=previous?previous.then(save):save();d1SaveFlights.set(key,flight);
    try{await flight;}finally{if(d1SaveFlights.get(key)===flight)d1SaveFlights.delete(key);}return;
  }
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
