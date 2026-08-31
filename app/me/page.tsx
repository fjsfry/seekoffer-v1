'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CONTACT_FEEDBACK_FILTERS,
  CONTACT_RANGE_FILTERS,
  DesktopContactsWorkspace as ContactsWorkspace,
  type ContactDeliveryStatus,
  type ContactFeedbackStatus,
  type ContactRangeFilter,
  type ContactSortOption,
  type DesktopMentorContact
} from '@/components/desktop-contacts-workspace';
import {
  DesktopScheduleWorkspace as ScheduleWorkspace,
  getSchedulePriorityRank,
  normalizeScheduleCategory,
  normalizeSchedulePriority,
  normalizeScheduleType,
  type DesktopScheduleItem,
  type ScheduleDoneFilter,
  type ScheduleTypeFilter
} from '@/components/desktop-schedule-workspace';
import { LoginRequiredCard } from '@/components/login-required-card';
import { SiteShell } from '@/components/site-shell';
import { useUserSessionState } from '@/hooks/use-user-session';
import { beginDesktopPendingWrite, trackDesktopPendingWrite } from '@/lib/desktop-pending-writes';
import { emitDesktopSyncStatus } from '@/lib/desktop-route-events';
import {
  readAccountScopedWorkbenchValue,
  writeAccountScopedWorkbenchValue,
  WORKBENCH_COMPLETED_TODOS_KEY,
  WORKBENCH_CONTACTS_KEY,
  WORKBENCH_CUSTOM_TODOS_KEY
} from '@/lib/workbench-local-storage';
import {
  createWorkbenchSaveCoordinator,
  hydrateWorkbenchState,
  normalizeMentorPhotoCacheKey,
  normalizeMentorPhotoSourceUrl,
  normalizeWorkbenchTodoCategory,
  normalizeWorkbenchTodoPriority,
  saveWorkbenchState,
  type WorkbenchCustomTodo,
  type WorkbenchMentorContact,
  type WorkbenchState
} from '@/lib/workbench-state';

const isDesktopSurface = process.env.NEXT_PUBLIC_SEEKOFFER_SURFACE === 'desktop';

type WorkbenchSection = 'schedule' | 'contacts';
type WorkbenchSyncStatus = 'local' | 'syncing' | 'synced' | 'error';

function normalizeWorkbenchSection(value: string | null): WorkbenchSection | null {
  return value === 'schedule' || value === 'contacts' ? value : null;
}

function readBrowserArray(key: string, ownerId: string) {
  if (typeof window === 'undefined') return [] as string[];
  try {
    const raw = readAccountScopedWorkbenchValue(key, ownerId);
    if (!raw) return [] as string[];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [] as string[];
  }
}

function readCustomTodos(ownerId: string) {
  if (typeof window === 'undefined') return [] as WorkbenchCustomTodo[];
  try {
    const raw = readAccountScopedWorkbenchValue(WORKBENCH_CUSTOM_TODOS_KEY, ownerId);
    if (!raw) return [] as WorkbenchCustomTodo[];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .filter((item): item is WorkbenchCustomTodo => Boolean(item?.id) && Boolean(item?.text))
          .map((item) => ({
            id: String(item.id),
            text: String(item.text),
            ...(item.date ? { date: String(item.date) } : {}),
            ...(item.type ? { type: String(item.type) } : {}),
            category: normalizeWorkbenchTodoCategory(item.category),
            priority: normalizeWorkbenchTodoPriority(item.priority),
            ...(item.note ? { note: String(item.note) } : {}),
            ...(item.createdAt ? { createdAt: String(item.createdAt) } : {}),
            ...(item.updatedAt ? { updatedAt: String(item.updatedAt) } : {}),
            ...(typeof item.completed === 'boolean' ? { completed: item.completed } : {}),
            ...(item.deletedAt ? { deletedAt: String(item.deletedAt) } : {})
          }))
      : [];
  } catch {
    return [] as WorkbenchCustomTodo[];
  }
}

function createEmptyContact(): DesktopMentorContact {
  return {
    id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    schoolName: '',
    departmentName: '',
    mentorName: '',
    mentorTitle: '',
    schoolRange: '普通高校',
    email: '',
    researchDirection: '',
    homepage: '',
    photoCacheKey: '',
    photoSourceUrl: '',
    photoPageUrl: '',
    photoUpdatedAt: '',
    deliveryStatus: '未投递',
    feedbackStatus: '未联系',
    contactChannel: '',
    lastContactDate: '',
    nextFollowUpDate: '',
    contactNotes: '',
    notes: '',
    privacyNotice: '仅用于个人申请跟进，不公开展示。',
    updatedAt: new Date().toISOString()
  };
}

function normalizeContact(raw: Partial<WorkbenchMentorContact>): DesktopMentorContact {
  const rawSchoolRange = String(raw.schoolRange || '');
  const deletedAt = String(raw.deletedAt || '').trim();
  const schoolRange = rawSchoolRange !== '全部' && CONTACT_RANGE_FILTERS.includes(rawSchoolRange as ContactRangeFilter)
    ? rawSchoolRange as Exclude<ContactRangeFilter, '全部'>
    : '普通高校';

  return {
    ...createEmptyContact(),
    ...raw,
    id: String(raw.id || `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).trim().slice(0, 160),
    schoolName: String(raw.schoolName || '').trim().slice(0, 80),
    departmentName: String(raw.departmentName || '').trim().slice(0, 80),
    mentorName: String(raw.mentorName || '').trim().slice(0, 80),
    mentorTitle: String(raw.mentorTitle || '').trim().slice(0, 80),
    schoolRange,
    email: String(raw.email || '').trim().slice(0, 160),
    researchDirection: String(raw.researchDirection || '').trim().slice(0, 240),
    homepage: String(raw.homepage || '').trim().slice(0, 500),
    photoCacheKey: normalizeMentorPhotoCacheKey(raw.photoCacheKey),
    photoSourceUrl: normalizeMentorPhotoSourceUrl(raw.photoSourceUrl),
    photoPageUrl: normalizeMentorPhotoSourceUrl(raw.photoPageUrl),
    photoUpdatedAt: String(raw.photoUpdatedAt || '').trim().slice(0, 40),
    deliveryStatus: raw.deliveryStatus === '已投递' ? '已投递' : '未投递',
    feedbackStatus: CONTACT_FEEDBACK_FILTERS.includes(raw.feedbackStatus as ContactFeedbackStatus)
      ? raw.feedbackStatus as ContactFeedbackStatus
      : '未联系',
    contactChannel: String(raw.contactChannel || '').trim().slice(0, 40),
    lastContactDate: String(raw.lastContactDate || '').trim().slice(0, 20),
    nextFollowUpDate: String(raw.nextFollowUpDate || '').trim().slice(0, 20),
    contactNotes: String(raw.contactNotes || '').trim().slice(0, 1000),
    notes: String(raw.notes || '').trim().slice(0, 1000),
    privacyNotice: String(raw.privacyNotice || '仅用于个人申请跟进，不公开展示。').trim().slice(0, 240),
    updatedAt: String(raw.updatedAt || '').trim() || deletedAt || new Date().toISOString(),
    deletedAt: deletedAt || undefined
  };
}

function readStoredContacts(ownerId: string) {
  if (typeof window === 'undefined') return [] as DesktopMentorContact[];
  try {
    const raw = readAccountScopedWorkbenchValue(WORKBENCH_CONTACTS_KEY, ownerId);
    if (!raw) return [] as DesktopMentorContact[];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => normalizeContact(item)) : [];
  } catch {
    return [] as DesktopMentorContact[];
  }
}

function getContactSearchText(contact: DesktopMentorContact) {
  return [
    contact.schoolName,
    contact.departmentName,
    contact.mentorName,
    contact.mentorTitle,
    contact.schoolRange,
    contact.email,
    contact.researchDirection,
    contact.homepage,
    contact.contactChannel,
    contact.nextFollowUpDate,
    contact.contactNotes,
    contact.notes
  ].join(' ').toLowerCase();
}

function matchesContactRange(contactRange: DesktopMentorContact['schoolRange'], filter: ContactRangeFilter) {
  if (filter === '全部') return true;
  if (filter === '985') return contactRange === '985' || contactRange === 'C9';
  return contactRange === filter;
}

function sortContacts(contacts: DesktopMentorContact[], sortBy: ContactSortOption) {
  return [...contacts].sort((left, right) => {
    if (sortBy === 'school') {
      return `${left.schoolName}${left.departmentName}`.localeCompare(`${right.schoolName}${right.departmentName}`, 'zh-CN');
    }
    if (sortBy === 'lastContact') return (right.lastContactDate || '').localeCompare(left.lastContactDate || '');
    return (right.updatedAt || '').localeCompare(left.updatedAt || '');
  });
}

const contactFieldMaxLengths: Partial<Record<keyof DesktopMentorContact, number>> = {
  schoolName: 80,
  departmentName: 80,
  mentorName: 80,
  mentorTitle: 80,
  email: 160,
  researchDirection: 240,
  homepage: 500,
  photoCacheKey: 96,
  photoSourceUrl: 500,
  photoPageUrl: 500,
  photoUpdatedAt: 40,
  contactChannel: 40,
  lastContactDate: 20,
  nextFollowUpDate: 20,
  contactNotes: 1000,
  notes: 1000,
  privacyNotice: 240
};

function limitContactFieldValue<K extends keyof DesktopMentorContact>(key: K, value: DesktopMentorContact[K]) {
  const maxLength = contactFieldMaxLengths[key];
  return typeof value === 'string' && maxLength ? value.slice(0, maxLength) as DesktopMentorContact[K] : value;
}

const CONTACT_DRAFT_MEANINGFUL_FIELDS = [
  'schoolName',
  'departmentName',
  'mentorName',
  'mentorTitle',
  'email',
  'researchDirection',
  'homepage',
  'contactChannel',
  'lastContactDate',
  'nextFollowUpDate',
  'contactNotes',
  'notes'
] as const satisfies ReadonlyArray<keyof DesktopMentorContact>;

function hasMeaningfulContactDraft(contact: DesktopMentorContact) {
  return CONTACT_DRAFT_MEANINGFUL_FIELDS.some((field) => String(contact[field] || '').trim());
}

function MePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { session, ready, loggedIn } = useUserSessionState();
  const profileOwnerId = session?.userId || session?.email || session?.phone || 'guest';
  const syncableUserId = session?.loggedIn && session.authProvider !== 'anonymous' && session.userId ? session.userId : '';
  const activeSection = normalizeWorkbenchSection(searchParams.get('view'));
  const [completedTodoIds, setCompletedTodoIds] = useState<string[]>([]);
  const [customTodos, setCustomTodos] = useState<WorkbenchCustomTodo[]>([]);
  const [contacts, setContacts] = useState<DesktopMentorContact[]>([]);
  const [contactDraft, setContactDraft] = useState<DesktopMentorContact | null>(null);
  const [localWorkbenchOwnerId, setLocalWorkbenchOwnerId] = useState('');
  const [todoSyncOwnerId, setTodoSyncOwnerId] = useState('');
  const [todoSyncReady, setTodoSyncReady] = useState(false);
  const [workbenchSyncStatus, setWorkbenchSyncStatus] = useState<WorkbenchSyncStatus>('local');
  const [lastSyncedAt, setLastSyncedAt] = useState('');
  const [syncRetryNonce, setSyncRetryNonce] = useState(0);
  const [scheduleTypeFilter, setScheduleTypeFilter] = useState<ScheduleTypeFilter>('全部');
  const [scheduleDoneFilter, setScheduleDoneFilter] = useState<ScheduleDoneFilter>('全部');
  const [scheduleKeyword, setScheduleKeyword] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7));
  const [contactRangeFilter, setContactRangeFilter] = useState<ContactRangeFilter>('全部');
  const [contactFeedbackFilter, setContactFeedbackFilter] = useState<'全部' | ContactFeedbackStatus>('全部');
  const [contactDeliveryFilter, setContactDeliveryFilter] = useState<'全部' | ContactDeliveryStatus>('全部');
  const [contactKeyword, setContactKeyword] = useState('');
  const [contactSort, setContactSort] = useState<ContactSortOption>('updated');
  const saveCoordinatorRef = useRef<ReturnType<typeof createWorkbenchSaveCoordinator> | null>(null);
  if (!saveCoordinatorRef.current) saveCoordinatorRef.current = createWorkbenchSaveCoordinator(saveWorkbenchState);

  useEffect(() => {
    if (!activeSection) router.replace('/');
  }, [activeSection, router]);

  useEffect(() => {
    if (activeSection !== 'contacts' || !searchParams.get('contact')) return;
    setContactRangeFilter('全部');
    setContactFeedbackFilter('全部');
    setContactDeliveryFilter('全部');
    setContactKeyword('');
  }, [activeSection, searchParams]);

  useEffect(() => {
    if (activeSection !== 'contacts') setContactDraft(null);
  }, [activeSection]);

  useEffect(() => {
    setLocalWorkbenchOwnerId('');
    setContactDraft(null);
    setCompletedTodoIds(readBrowserArray(WORKBENCH_COMPLETED_TODOS_KEY, profileOwnerId));
    setCustomTodos(readCustomTodos(profileOwnerId));
    setContacts(readStoredContacts(profileOwnerId));
    setLocalWorkbenchOwnerId(profileOwnerId);
  }, [profileOwnerId]);

  useEffect(() => emitDesktopSyncStatus(workbenchSyncStatus), [workbenchSyncStatus]);

  useEffect(() => {
    if (!syncableUserId) {
      setTodoSyncOwnerId('');
      setTodoSyncReady(false);
      setWorkbenchSyncStatus('local');
      return () => undefined;
    }

    let active = true;
    setTodoSyncReady(false);
    setWorkbenchSyncStatus('syncing');

    const hydrateRemoteState = async () => {
      try {
        const mergedState = await trackDesktopPendingWrite('me-workbench-hydrate', () =>
          hydrateWorkbenchState(syncableUserId, {
            completedTodoIds: readBrowserArray(WORKBENCH_COMPLETED_TODOS_KEY, syncableUserId),
            customTodos: readCustomTodos(syncableUserId),
            contacts: readStoredContacts(syncableUserId)
          })
        );
        if (!active) return;
        setCompletedTodoIds(mergedState.completedTodoIds);
        setCustomTodos(mergedState.customTodos);
        setContacts(mergedState.contacts.map((contact) => normalizeContact(contact)));
        setLastSyncedAt(new Date().toISOString());
        setWorkbenchSyncStatus('synced');
      } catch (error) {
        console.error('[Seekoffer][workbench] hydrate workbench state failed', error);
        if (active) setWorkbenchSyncStatus('error');
      } finally {
        if (active) {
          setTodoSyncOwnerId(syncableUserId);
          setTodoSyncReady(true);
        }
      }
    };

    void hydrateRemoteState();
    return () => {
      active = false;
    };
  }, [syncRetryNonce, syncableUserId]);

  useEffect(() => {
    if (localWorkbenchOwnerId !== profileOwnerId) return;
    writeAccountScopedWorkbenchValue(WORKBENCH_COMPLETED_TODOS_KEY, profileOwnerId, JSON.stringify(completedTodoIds));
  }, [completedTodoIds, localWorkbenchOwnerId, profileOwnerId]);

  useEffect(() => {
    if (localWorkbenchOwnerId !== profileOwnerId) return;
    writeAccountScopedWorkbenchValue(WORKBENCH_CUSTOM_TODOS_KEY, profileOwnerId, JSON.stringify(customTodos));
  }, [customTodos, localWorkbenchOwnerId, profileOwnerId]);

  useEffect(() => {
    if (localWorkbenchOwnerId !== profileOwnerId) return;
    writeAccountScopedWorkbenchValue(WORKBENCH_CONTACTS_KEY, profileOwnerId, JSON.stringify(contacts));
  }, [contacts, localWorkbenchOwnerId, profileOwnerId]);

  useEffect(() => {
    if (!todoSyncReady || !syncableUserId || todoSyncOwnerId !== syncableUserId) return () => undefined;
    let cancelled = false;
    const ownerId = syncableUserId;
    const snapshot: WorkbenchState = {
      completedTodoIds: [...completedTodoIds],
      customTodos: customTodos.map((item) => ({ ...item })),
      contacts: contacts.map((item) => ({ ...item }))
    };
    const finishPendingWrite = beginDesktopPendingWrite('me-workbench-save');
    let writeStarted = false;
    const persistRemoteState = async () => {
      writeStarted = true;
      setWorkbenchSyncStatus('syncing');
      try {
        const result = await saveCoordinatorRef.current!.enqueue(ownerId, snapshot);
        if (cancelled || !result.isLatest) return;
        if (result.ok) {
          setLastSyncedAt(new Date().toISOString());
          setWorkbenchSyncStatus('synced');
        } else {
          console.error('[Seekoffer][workbench] save workbench state failed', result.error);
          setWorkbenchSyncStatus('error');
        }
      } finally {
        finishPendingWrite();
      }
    };
    const timer = window.setTimeout(() => void persistRemoteState(), 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (!writeStarted) finishPendingWrite();
    };
  }, [completedTodoIds, contacts, customTodos, syncableUserId, todoSyncOwnerId, todoSyncReady]);

  const scheduleItems = useMemo<DesktopScheduleItem[]>(() => customTodos
    .filter((task) => !task.deletedAt)
    .map((task) => ({
      id: task.id,
      title: task.text,
      detail: task.note || '手动添加的日程事项',
      date: task.date,
      dateLabel: task.date || '待安排',
      type: normalizeScheduleType(task.type),
      category: normalizeScheduleCategory(task.category),
      priority: normalizeSchedulePriority(task.priority),
      done: typeof task.completed === 'boolean' ? task.completed : completedTodoIds.includes(task.id)
    }))
    .sort((left, right) => {
      const dateCompare = (left.date || '9999-12-31').localeCompare(right.date || '9999-12-31');
      const priorityCompare = isDesktopSurface
        ? getSchedulePriorityRank(left.priority) - getSchedulePriorityRank(right.priority)
        : 0;
      return dateCompare || priorityCompare || left.title.localeCompare(right.title, 'zh-CN');
    }), [completedTodoIds, customTodos]);

  const filteredScheduleItems = useMemo(() => {
    const normalizedKeyword = scheduleKeyword.trim().toLowerCase();
    return scheduleItems.filter((item) => {
      if (scheduleTypeFilter !== '全部' && item.type !== scheduleTypeFilter) return false;
      if (scheduleDoneFilter === '未完成' && item.done) return false;
      if (scheduleDoneFilter === '已完成' && !item.done) return false;
      const searchText = isDesktopSurface
        ? `${item.title} ${item.detail} ${item.dateLabel} ${item.category} ${item.priority}`
        : `${item.title} ${item.detail} ${item.dateLabel}`;
      return !normalizedKeyword || searchText.toLowerCase().includes(normalizedKeyword);
    });
  }, [scheduleDoneFilter, scheduleItems, scheduleKeyword, scheduleTypeFilter]);

  const activeContacts = useMemo(() => contacts.filter((item) => !item.deletedAt), [contacts]);
  const contactSummary = useMemo(() => ({
    total: activeContacts.length,
    delivered: activeContacts.filter((item) => item.deliveryStatus === '已投递').length,
    replied: activeContacts.filter((item) => item.feedbackStatus === '已回复' || item.feedbackStatus === '已offer').length,
    followUp: activeContacts.filter((item) => item.feedbackStatus === '需跟进').length
  }), [activeContacts]);
  const filteredContacts = useMemo(() => {
    const normalizedKeyword = contactKeyword.trim().toLowerCase();
    const persistedContacts = sortContacts(activeContacts.filter((contact) => {
      if (!matchesContactRange(contact.schoolRange, contactRangeFilter)) return false;
      if (contactFeedbackFilter !== '全部' && contact.feedbackStatus !== contactFeedbackFilter) return false;
      if (contactDeliveryFilter !== '全部' && contact.deliveryStatus !== contactDeliveryFilter) return false;
      return !normalizedKeyword || getContactSearchText(contact).includes(normalizedKeyword);
    }), contactSort);
    return contactDraft ? [contactDraft, ...persistedContacts] : persistedContacts;
  }, [activeContacts, contactDeliveryFilter, contactDraft, contactFeedbackFilter, contactKeyword, contactRangeFilter, contactSort]);

  function markLocalChange() {
    setWorkbenchSyncStatus(syncableUserId ? 'syncing' : 'local');
  }

  function handleScheduleDoneChange(id: string, done: boolean) {
    markLocalChange();
    setCustomTodos((current) => current.map((item) => item.id === id ? { ...item, completed: done, updatedAt: new Date().toISOString() } : item));
    setCompletedTodoIds((current) => done
      ? current.includes(id) ? current : [...current, id]
      : current.filter((item) => item !== id));
  }

  function handleClearCompleted() {
    markLocalChange();
    const customTodoIds = new Set(customTodos.map((item) => item.id));
    const deletedAt = new Date().toISOString();
    setCustomTodos((current) => current.map((item) => completedTodoIds.includes(item.id) ? { ...item, deletedAt, updatedAt: deletedAt } : item));
    setCompletedTodoIds((current) => current.filter((id) => !customTodoIds.has(id)));
  }

  function handleCreateScheduleTodo(payload: Pick<WorkbenchCustomTodo, 'text'> & Partial<Omit<WorkbenchCustomTodo, 'id' | 'text'>>) {
    const text = payload.text.trim().slice(0, 160);
    if (!text) return '';
    markLocalChange();
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    setCustomTodos((current) => [...current, {
      id,
      text,
      ...(payload.date ? { date: payload.date } : {}),
      ...(payload.type ? { type: payload.type } : {}),
      category: normalizeWorkbenchTodoCategory(payload.category),
      priority: normalizeWorkbenchTodoPriority(payload.priority),
      ...(payload.note?.trim() ? { note: payload.note.trim().slice(0, 1000) } : {}),
      completed: false,
      createdAt: now,
      updatedAt: now
    }]);
    return id;
  }

  function handleUpdateScheduleTodo(id: string, patch: Partial<Omit<WorkbenchCustomTodo, 'id'>>) {
    markLocalChange();
    setCustomTodos((current) => current.map((todo) => {
      if (todo.id !== id) return todo;
      const next: WorkbenchCustomTodo = {
        ...todo,
        category: normalizeWorkbenchTodoCategory(todo.category),
        priority: normalizeWorkbenchTodoPriority(todo.priority),
        ...(patch.text !== undefined ? { text: patch.text.trim().slice(0, 160) || todo.text } : {}),
        updatedAt: new Date().toISOString()
      };
      if (patch.date !== undefined) {
        if (patch.date.trim()) next.date = patch.date.trim();
        else delete next.date;
      }
      if (patch.type !== undefined) next.type = normalizeScheduleType(patch.type);
      if (patch.category !== undefined) next.category = normalizeWorkbenchTodoCategory(patch.category);
      if (patch.priority !== undefined) next.priority = normalizeWorkbenchTodoPriority(patch.priority);
      if (patch.note !== undefined) {
        if (patch.note.trim()) next.note = patch.note.trim().slice(0, 1000);
        else delete next.note;
      }
      return next;
    }));
  }

  function handleDeleteScheduleTodo(id: string) {
    markLocalChange();
    const deletedAt = new Date().toISOString();
    setCustomTodos((current) => current.map((todo) => todo.id === id ? { ...todo, deletedAt, updatedAt: deletedAt } : todo));
    setCompletedTodoIds((current) => current.filter((item) => item !== id));
  }

  function handleAddContact() {
    if (contactDraft) return contactDraft.id;
    const contact = createEmptyContact();
    setContactDraft(contact);
    setContactRangeFilter('全部');
    setContactFeedbackFilter('全部');
    setContactDeliveryFilter('全部');
    setContactKeyword('');
    setContactSort('updated');
    return contact.id;
  }

  function handleContactChange<K extends keyof DesktopMentorContact>(id: string, key: K, value: DesktopMentorContact[K]) {
    if (contactDraft?.id === id) {
      const nextDraft = {
        ...contactDraft,
        [key]: limitContactFieldValue(key, value),
        updatedAt: new Date().toISOString()
      };
      if (hasMeaningfulContactDraft(nextDraft)) {
        markLocalChange();
        setContactDraft(null);
        setContacts((current) => [nextDraft, ...current]);
      } else {
        setContactDraft(nextDraft);
      }
      return;
    }
    markLocalChange();
    setContacts((current) => current.map((contact) => contact.id === id ? {
      ...contact,
      [key]: limitContactFieldValue(key, value),
      updatedAt: new Date().toISOString()
    } : contact));
  }

  function handleDeleteContact(id: string) {
    if (contactDraft?.id === id) {
      setContactDraft(null);
      return;
    }
    markLocalChange();
    const deletedAt = new Date().toISOString();
    setContacts((current) => current.map((contact) => contact.id === id ? { ...contact, deletedAt, updatedAt: deletedAt } : contact));
  }

  function handleDiscardContactDraft(id: string) {
    setContactDraft((current) => current?.id === id ? null : current);
  }

  function handleRetrySync() {
    if (!syncableUserId) return;
    setWorkbenchSyncStatus('syncing');
    setSyncRetryNonce((current) => current + 1);
  }

  if (!activeSection) return null;
  if (!ready || !loggedIn) {
    return (
      <SiteShell>
        <LoginRequiredCard
          title="登录后管理日程与导师联系"
          description="集中维护申请日程、跟进日期和导师沟通记录，让每个下一步都有明确安排。"
        />
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      {activeSection === 'schedule' ? (
        <ScheduleWorkspace
          items={filteredScheduleItems}
          allItems={scheduleItems}
          totalCount={scheduleItems.length}
          typeFilter={scheduleTypeFilter}
          doneFilter={scheduleDoneFilter}
          keyword={scheduleKeyword}
          onTypeFilterChange={setScheduleTypeFilter}
          onDoneFilterChange={setScheduleDoneFilter}
          onKeywordChange={setScheduleKeyword}
          calendarMonth={calendarMonth}
          onCalendarMonthChange={setCalendarMonth}
          onCreateTodo={handleCreateScheduleTodo}
          onUpdateTodo={handleUpdateScheduleTodo}
          onDeleteTodo={handleDeleteScheduleTodo}
          onDoneChange={handleScheduleDoneChange}
          onClearCompleted={handleClearCompleted}
          syncStatus={workbenchSyncStatus}
          lastSyncedAt={lastSyncedAt}
          onRetrySync={handleRetrySync}
          contextOwner={profileOwnerId}
        />
      ) : null}

      {activeSection === 'contacts' ? (
        <ContactsWorkspace
          contacts={filteredContacts}
          initialContactId={searchParams.get('contact') || ''}
          totalCount={activeContacts.length}
          summary={contactSummary}
          rangeFilter={contactRangeFilter}
          feedbackFilter={contactFeedbackFilter}
          deliveryFilter={contactDeliveryFilter}
          keyword={contactKeyword}
          sort={contactSort}
          onRangeFilterChange={setContactRangeFilter}
          onFeedbackFilterChange={setContactFeedbackFilter}
          onDeliveryFilterChange={setContactDeliveryFilter}
          onKeywordChange={setContactKeyword}
          onSortChange={setContactSort}
          onResetFilters={() => {
            setContactRangeFilter('全部');
            setContactFeedbackFilter('全部');
            setContactDeliveryFilter('全部');
            setContactKeyword('');
            setContactSort('updated');
          }}
          onAddContact={handleAddContact}
          draftContactId={contactDraft?.id || ''}
          onDiscardContactDraft={handleDiscardContactDraft}
          onContactChange={handleContactChange}
          onDeleteContact={handleDeleteContact}
          syncStatus={workbenchSyncStatus}
          lastSyncedAt={lastSyncedAt}
          onRetrySync={handleRetrySync}
          contextOwner={profileOwnerId}
        />
      ) : null}
    </SiteShell>
  );
}

export default function MePage() {
  return (
    <Suspense
      fallback={(
        <SiteShell>
          <section className="product-card rounded-[30px] px-6 py-12 text-center text-sm text-slate-500" role="status">
            正在加载日程与导师联系…
          </section>
        </SiteShell>
      )}
    >
      <MePageContent />
    </Suspense>
  );
}
