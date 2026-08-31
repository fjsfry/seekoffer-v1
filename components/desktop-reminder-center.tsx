'use client';

import {
  BellOff,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  FileWarning,
  Moon,
  RefreshCw,
  Settings2,
  UserRoundCheck,
  X,
  type LucideIcon
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from 'react';
import {
  fetchApplicationRows,
  fetchPublicNotices,
  watchApplicationTable,
  type ApplicationRow
} from '@/lib/cloudbase-data';
import { getDeadlineTimestamp } from '@/lib/deadline-display';
import {
  getNextAllowedDesktopNotificationDate,
  isDesktopNotificationKindEnabled,
  isDesktopNotificationsPaused,
  type DesktopPreferences
} from '@/lib/desktop-preferences';
import { useUserSessionState } from '@/hooks/use-user-session';
import { getDisplaySchoolName } from '@/lib/notice-display';
import { materialChecklistDefinitions, type UserProjectStatus } from '@/lib/mock-data';
import { emitDesktopFeedback } from '@/lib/desktop-route-events';
import {
  markReminderIdsRead,
  restoreMarkedReminderIds,
  type MarkAllReadSnapshot
} from '@/lib/desktop-reminder-actions';
import { getLatestActionableChange } from '@/lib/desktop-reminder-copy';
import {
  getReminderSnoozeOptions,
  type ReminderSnoozeOption
} from '@/lib/desktop-reminder-snooze';
import {
  readAccountScopedWorkbenchValue,
  WORKBENCH_CONTACTS_KEY
} from '@/lib/workbench-local-storage';
import type { WorkbenchMentorContact } from '@/lib/workbench-state';
import { DesktopStateSurface } from './desktop-state-surface';
import styles from './desktop-reminder-center.module.css';

type ReminderKind = 'deadline' | 'materials' | 'change' | 'mentor';
type ReminderFilter = 'unread' | 'all';

type DesktopReminder = {
  id: string;
  kind: ReminderKind;
  title: string;
  detail: string;
  time: string;
  href: string;
  actionLabel: string;
  sortTime: number;
};

type ReminderState = {
  readIds: string[];
  snoozedUntil: Record<string, string>;
};

type MarkAllReadUndo = MarkAllReadSnapshot & {
  count: number;
};

const REMINDER_STATE_KEY = 'seekoffer-desktop-reminder-state-v3';
const RUNTIME_NOTIFICATION_STATE_KEY = 'seekoffer-desktop-runtime-notifications-v1';
const archivedStatuses = new Set<UserProjectStatus>(['已通过', '未通过', '已放弃']);
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const REMINDER_SYNC_TIMEOUT_MS = 12_000;
const REMINDER_RETRY_MS = 30_000;
const REMINDER_REFRESH_MS = 5 * 60_000;
const RUNTIME_NOTIFICATION_RETENTION_MS = 45 * DAY_IN_MS;
const RUNTIME_NOTIFICATION_BATCH_SIZE = 3;
const MARK_ALL_READ_UNDO_MS = 6_000;

type RuntimeNotificationLedger = {
  version: 1;
  delivered: Record<string, string>;
};

type RuntimeNotificationEvent = {
  eventId: string;
  title: string;
  body: string;
  dueAt: number;
  expiresAt: number;
};

const reminderVisuals: Record<ReminderKind, { icon: LucideIcon }> = {
  deadline: {
    icon: CalendarClock
  },
  materials: {
    icon: FileWarning
  },
  change: {
    icon: RefreshCw
  },
  mentor: {
    icon: UserRoundCheck
  }
};

function readMentorContacts(userId: string) {
  if (!userId) return [];
  try {
    const raw = readAccountScopedWorkbenchValue(WORKBENCH_CONTACTS_KEY, userId);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is WorkbenchMentorContact =>
            Boolean(item?.id) && !item?.deletedAt && Boolean(item?.nextFollowUpDate)
        )
      : [];
  } catch {
    return [];
  }
}

function getReminderStateKey(userId: string) {
  return `${REMINDER_STATE_KEY}:${userId || 'unknown-user'}`;
}

function getRuntimeNotificationStateKey(userId: string) {
  return `${RUNTIME_NOTIFICATION_STATE_KEY}:${userId || 'unknown-user'}`;
}

function readRuntimeNotificationLedger(storageKey: string): RuntimeNotificationLedger {
  if (typeof window === 'undefined') return { version: 1, delivered: {} };
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as Partial<RuntimeNotificationLedger>) : null;
    return {
      version: 1,
      delivered:
        parsed?.delivered && typeof parsed.delivered === 'object'
          ? Object.fromEntries(
              Object.entries(parsed.delivered).filter(
                (entry): entry is [string, string] =>
                  typeof entry[1] === 'string' && Number.isFinite(Date.parse(entry[1]))
              )
            )
          : {}
    };
  } catch {
    return { version: 1, delivered: {} };
  }
}

function writeRuntimeNotificationLedger(
  storageKey: string,
  ledger: RuntimeNotificationLedger
) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(ledger));
  } catch {
    // Runtime delivery can continue even when its local deduplication ledger cannot persist.
  }
}

function readReminderState(storageKey: string): ReminderState {
  if (typeof window === 'undefined') return { readIds: [], snoozedUntil: {} };
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as Partial<ReminderState>) : null;
    return {
      readIds: Array.isArray(parsed?.readIds) ? parsed.readIds.filter((id): id is string => typeof id === 'string') : [],
      snoozedUntil:
        parsed?.snoozedUntil && typeof parsed.snoozedUntil === 'object'
          ? Object.fromEntries(
              Object.entries(parsed.snoozedUntil).filter(
                (entry): entry is [string, string] => typeof entry[1] === 'string'
              )
            )
          : {}
    };
  } catch {
    return { readIds: [], snoozedUntil: {} };
  }
}

function formatReminderDate(value: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai'
  }).format(new Date(value));
}

function getProjectReminderHref(
  row: ApplicationRow,
  focus: 'overview' | 'materials' | 'schedule' | 'activity'
) {
  const params = new URLSearchParams({
    project: row.item.userProjectId,
    focus
  });
  return `/?${params.toString()}`;
}

function buildApplicationReminders(applications: ApplicationRow[], now: number) {
  const generated: DesktopReminder[] = [];

  applications.forEach((row) => {
    if (archivedStatuses.has(row.item.myStatus)) return;
    if (!row.item.customReminderEnabled) return;

    const schoolName = getDisplaySchoolName(row.project.schoolName);
    const deadlineTime = getDeadlineTimestamp(row.project.deadlineDate);
    const deadlineDistance = deadlineTime - now;
    const missingMaterials = materialChecklistDefinitions.filter(({ key }) => !row.item[key]);

    if (
      Number.isFinite(deadlineTime) &&
      deadlineDistance >= 0 &&
      deadlineDistance <= 7 * DAY_IN_MS
    ) {
      generated.push({
        id: `deadline:${row.item.userProjectId}:${row.project.deadlineDate}`,
        kind: 'deadline',
        title: `${schoolName} · 申请即将截止`,
        detail: `申请将于 ${formatReminderDate(deadlineTime)} 截止`,
        time: formatReminderDate(deadlineTime),
        href: getProjectReminderHref(row, 'schedule'),
        actionLabel: '核对截止',
        sortTime: deadlineTime
      });
    }

    if (
      missingMaterials.length &&
      Number.isFinite(deadlineTime) &&
      deadlineDistance >= 0 &&
      deadlineDistance <= 14 * DAY_IN_MS
    ) {
      generated.push({
        id: `materials:${row.item.userProjectId}:${row.project.deadlineDate}`,
        kind: 'materials',
        title: `${schoolName} · 还缺 ${missingMaterials.length} 项材料`,
        detail: missingMaterials.slice(0, 3).map((item) => item.label).join('、'),
        time: '材料清单',
        href: getProjectReminderHref(row, 'materials'),
        actionLabel: '去补充',
        sortTime: deadlineTime - 1
      });
    }

    const latestActionableChange = getLatestActionableChange(row.project.changeLog);
    const changeTime = latestActionableChange
      ? Date.parse(latestActionableChange.entry.date)
      : Number.NaN;

    if (
      latestActionableChange &&
      Number.isFinite(changeTime) &&
      now - changeTime >= 0 &&
      now - changeTime <= 7 * DAY_IN_MS
    ) {
      const { entry, copy } = latestActionableChange;
      generated.push({
        id: `change:${row.item.userProjectId}:${entry.date}:${entry.field}`,
        kind: 'change',
        title: `${schoolName} · ${copy.fieldLabel}有更新`,
        detail: copy.detail,
        time: formatReminderDate(changeTime),
        href: getProjectReminderHref(row, 'activity'),
        actionLabel: '查看变更',
        sortTime: changeTime
      });
    }
  });

  const kindPriority: Record<ReminderKind, number> = {
    deadline: 0,
    materials: 1,
    mentor: 2,
    change: 3
  };

  return generated.sort((left, right) => {
    const priorityDistance = kindPriority[left.kind] - kindPriority[right.kind];
    if (priorityDistance) return priorityDistance;
    if (left.kind === 'deadline' || left.kind === 'materials') {
      return left.sortTime - right.sortTime;
    }
    return right.sortTime - left.sortTime;
  }).slice(0, 24);
}

function buildMentorReminders(contacts: WorkbenchMentorContact[], now: number) {
  return contacts.reduce<DesktopReminder[]>((items, contact) => {
    const followUpTime = Date.parse(`${contact.nextFollowUpDate.slice(0, 10)}T09:00:00+08:00`);
    const distance = followUpTime - now;
    if (!Number.isFinite(followUpTime) || distance < -7 * DAY_IN_MS || distance > 7 * DAY_IN_MS) {
      return items;
    }

    const mentorName = contact.mentorName || '未命名导师';
    const schoolName = contact.schoolName || '未关联院校';
    items.push({
      id: `mentor:${contact.id}:${contact.nextFollowUpDate}`,
      kind: 'mentor',
      title: `${schoolName} · 跟进${mentorName}`,
      detail: contact.contactChannel
        ? `按计划通过${contact.contactChannel}跟进联系状态`
        : '补充本次沟通结果并安排下一次跟进',
      time: distance < 0 ? '已到跟进时间' : formatReminderDate(followUpTime),
      href: `/me?view=contacts&contact=${encodeURIComponent(contact.id)}`,
      actionLabel: '去跟进',
      sortTime: followUpTime
    });
    return items;
  }, []);
}

function buildRuntimeNotificationEvents(
  reminders: DesktopReminder[],
  state: ReminderState,
  now: number
) {
  return reminders
    .map((reminder): RuntimeNotificationEvent | null => {
      const snoozedUntil = state.snoozedUntil[reminder.id];
      const snoozedUntilTime = snoozedUntil ? Date.parse(snoozedUntil) : Number.NaN;

      if (Number.isFinite(snoozedUntilTime)) {
        return {
          eventId: `snooze:v1:${reminder.id}:${snoozedUntil}`,
          title: reminder.title,
          body: reminder.detail,
          dueAt: snoozedUntilTime,
          expiresAt: snoozedUntilTime + DAY_IN_MS
        };
      }

      if (state.readIds.includes(reminder.id)) return null;

      if (reminder.kind === 'deadline') {
        return {
          eventId: `deadline:v1:${reminder.id}:T-24h`,
          title: reminder.title,
          body: reminder.detail,
          dueAt: reminder.sortTime - DAY_IN_MS,
          expiresAt: reminder.sortTime
        };
      }

      if (reminder.kind === 'materials') {
        return {
          eventId: `materials:v1:${reminder.id}:T-72h`,
          title: reminder.title,
          body: reminder.detail,
          dueAt: reminder.sortTime - 3 * DAY_IN_MS,
          expiresAt: reminder.sortTime
        };
      }

      if (reminder.kind === 'mentor') {
        return {
          eventId: `mentor:v1:${reminder.id}`,
          title: reminder.title,
          body: reminder.detail,
          dueAt: reminder.sortTime,
          expiresAt: reminder.sortTime + 7 * DAY_IN_MS
        };
      }

      return {
        eventId: `change:v1:${reminder.id}`,
        title: reminder.title,
        body: reminder.detail,
        dueAt: reminder.sortTime,
        expiresAt: reminder.sortTime + DAY_IN_MS
      };
    })
    .filter(
      (item): item is RuntimeNotificationEvent =>
        item !== null && item.expiresAt >= now - RUNTIME_NOTIFICATION_RETENTION_MS
    );
}

function isReminderUnread(reminder: DesktopReminder, state: ReminderState, now: number) {
  const snoozedUntil = state.snoozedUntil[reminder.id];
  if (snoozedUntil && new Date(snoozedUntil).getTime() <= now) return true;
  return !state.readIds.includes(reminder.id);
}

function formatSnoozeTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai'
  }).format(date);
}

function withReminderSyncTimeout<T>(promise: Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error('Reminder sync timed out.')),
      REMINDER_SYNC_TIMEOUT_MS
    );
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function ReminderSnoozeMenu({
  menuId,
  triggerId,
  reminderTitle,
  now,
  defaultSnoozeMinutes,
  onSelect,
  onClose
}: {
  menuId: string;
  triggerId: string;
  reminderTitle: string;
  now: number;
  defaultSnoozeMinutes: number;
  onSelect: (option: ReminderSnoozeOption) => void;
  onClose: (restoreFocus: boolean) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const options = useMemo(
    () => getReminderSnoozeOptions(new Date(now), defaultSnoozeMinutes),
    [defaultSnoozeMinutes, now]
  );

  useEffect(() => {
    itemRefs.current[0]?.focus();
  }, [menuId]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) onClose(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [onClose]);

  function handleItemKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose(true);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();
    const lastIndex = options.length - 1;
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? lastIndex
          : event.key === 'ArrowDown'
            ? (index + 1) % options.length
            : (index - 1 + options.length) % options.length;
    itemRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      ref={menuRef}
      id={menuId}
      className={styles.snoozeMenu}
      role="menu"
      aria-labelledby={triggerId}
      aria-label={`“${reminderTitle}”的稍后提醒时间`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onClose(false);
      }}
    >
      {options.map((option, index) => (
        <button
          ref={(element) => {
            itemRefs.current[index] = element;
          }}
          key={option.id}
          type="button"
          role="menuitem"
          className={styles.snoozeMenuItem}
          onClick={() => onSelect(option)}
          onKeyDown={(event) => handleItemKeyDown(event, index)}
        >
          <strong>{option.label}</strong>
          <small>{option.description}</small>
        </button>
      ))}
    </div>
  );
}

export function DesktopReminderCenter({
  open,
  onClose,
  onNavigate,
  onUnreadCountChange,
  preferences,
  onPreferencesChange,
  onOpenSettings
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (href: string) => void;
  onUnreadCountChange: (count: number) => void;
  preferences: DesktopPreferences;
  onPreferencesChange: (preferences: DesktopPreferences) => void;
  onOpenSettings: () => void;
}) {
  const { session } = useUserSessionState();
  const [filter, setFilter] = useState<ReminderFilter>('unread');
  const [state, setState] = useState<ReminderState>({ readIds: [], snoozedUntil: {} });
  const [readyStateKey, setReadyStateKey] = useState('');
  const [feedback, setFeedback] = useState('');
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [mentorContacts, setMentorContacts] = useState<WorkbenchMentorContact[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationsError, setApplicationsError] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [openSnoozeId, setOpenSnoozeId] = useState<string | null>(null);
  const [markAllReadUndo, setMarkAllReadUndo] = useState<MarkAllReadUndo | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const snoozeTriggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const markAllReadUndoTimerRef = useRef<number | null>(null);
  const applicationsLoadedRef = useRef(false);
  const runtimeNotificationSyncRef = useRef(false);
  const runtimeNotificationTaskRef = useRef(0);

  useEffect(() => {
    if (!feedback) return;
    const isProblem = /无法|未完成|失败|仅在当前会话/.test(feedback);
    emitDesktopFeedback({
      message: feedback,
      tone: isProblem ? 'warning' : 'success',
      duration: isProblem ? 4800 : 2800
    });
  }, [feedback]);
  const notificationsPaused = isDesktopNotificationsPaused(preferences, now);
  const reminderStateKey = getReminderStateKey(session?.userId || '');
  const runtimeNotificationStateKey = getRuntimeNotificationStateKey(session?.userId || '');
  const stateReady = readyStateKey === reminderStateKey;

  useEffect(() => {
    setReadyStateKey('');
    setState(readReminderState(reminderStateKey));
    setReadyStateKey(reminderStateKey);
    setOpenSnoozeId(null);
    setMarkAllReadUndo(null);
    if (markAllReadUndoTimerRef.current !== null) {
      window.clearTimeout(markAllReadUndoTimerRef.current);
      markAllReadUndoTimerRef.current = null;
    }
  }, [reminderStateKey]);

  useEffect(
    () => () => {
      if (markAllReadUndoTimerRef.current !== null) {
        window.clearTimeout(markAllReadUndoTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (open) return;
    setOpenSnoozeId(null);
  }, [open]);

  useEffect(() => {
    applicationsLoadedRef.current = false;
    setApplications([]);
    setMentorContacts(readMentorContacts(session?.userId || ''));
    setApplicationsError('');
    setApplicationsLoading(true);
  }, [session?.userId]);

  useEffect(() => {
    let active = true;
    let refreshing = false;
    let retryTimer: number | null = null;

    const refresh = async (refreshNotices = false) => {
      if (refreshing) return;
      refreshing = true;
      if (!applicationsLoadedRef.current) {
        setApplicationsLoading(true);
      }
      setApplicationsError('');
      try {
        const rows = await withReminderSyncTimeout(
          (async () => {
            if (refreshNotices) {
              await fetchPublicNotices({ refresh: true });
            }
            return fetchApplicationRows(session?.userId || undefined);
          })()
        );
        if (!active) return;
        applicationsLoadedRef.current = true;
        setApplications(rows);
        setMentorContacts(readMentorContacts(session?.userId || ''));
        setApplicationsError('');
      } catch {
        if (!active) return;
        setApplicationsError('提醒数据暂时无法同步，30 秒后会自动重试。');
        if (retryTimer === null) {
          retryTimer = window.setTimeout(() => {
            retryTimer = null;
            void refresh(true);
          }, REMINDER_RETRY_MS);
        }
      } finally {
        if (active) setApplicationsLoading(false);
        refreshing = false;
      }
    };

    void refresh();
    const dispose = watchApplicationTable(() => void refresh());
    const intervalTimer = window.setInterval(
      () => void refresh(true),
      REMINDER_REFRESH_MS
    );
    return () => {
      active = false;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      window.clearInterval(intervalTimer);
      dispose();
    };
  }, [refreshNonce, session?.userId]);

  useEffect(() => {
    if (!stateReady || readyStateKey !== reminderStateKey) return;
    try {
      window.localStorage.setItem(reminderStateKey, JSON.stringify(state));
    } catch {
      setFeedback('提醒状态仅在当前会话中保留');
    }
  }, [readyStateKey, reminderStateKey, state, stateReady]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const reminders = useMemo(() => {
    const next = [
      ...buildApplicationReminders(applications, now),
      ...buildMentorReminders(mentorContacts, now)
    ];
    return next
      .sort((left, right) => left.sortTime - right.sortTime)
      .slice(0, 24);
  }, [applications, mentorContacts, now]);

  const enabledReminders = useMemo(
    () =>
      reminders.filter((reminder) =>
        isDesktopNotificationKindEnabled(preferences, reminder.kind)
      ),
    [preferences, reminders]
  );

  const unreadCount = useMemo(
    () => enabledReminders.filter((reminder) => isReminderUnread(reminder, state, now)).length,
    [enabledReminders, now, state]
  );

  const visibleReminders = useMemo(
    () =>
      filter === 'all'
        ? enabledReminders
        : enabledReminders.filter((reminder) => isReminderUnread(reminder, state, now)),
    [enabledReminders, filter, now, state]
  );
  const hasUsableReminderSnapshot = applicationsLoadedRef.current || mentorContacts.length > 0;
  const hardSyncError = Boolean(applicationsError && !hasUsableReminderSnapshot);
  const staleSyncError = Boolean(applicationsError && hasUsableReminderSnapshot);

  useEffect(() => {
    if (
      !stateReady ||
      applicationsLoading ||
      !session?.userId ||
      !preferences.notifications.windowsDelivery ||
      !('__TAURI_INTERNALS__' in window)
    ) {
      return;
    }

    const nextAllowed = getNextAllowedDesktopNotificationDate(preferences, new Date(now));
    if (nextAllowed.getTime() > now + 1_000 || runtimeNotificationSyncRef.current) {
      return;
    }

    const events = buildRuntimeNotificationEvents(enabledReminders, state, now);
    const ledger = readRuntimeNotificationLedger(runtimeNotificationStateKey);
    const retentionCutoff = now - RUNTIME_NOTIFICATION_RETENTION_MS;
    const retainedDelivered = Object.fromEntries(
      Object.entries(ledger.delivered).filter(([, deliveredAt]) => {
        const deliveredTime = Date.parse(deliveredAt);
        return Number.isFinite(deliveredTime) && deliveredTime >= retentionCutoff;
      })
    );
    const dueEvents = events
      .filter(
        (event) =>
          event.dueAt <= now &&
          event.expiresAt >= now &&
          !retainedDelivered[event.eventId]
      )
      .sort((left, right) => left.dueAt - right.dueAt)
      .slice(0, RUNTIME_NOTIFICATION_BATCH_SIZE);

    if (!dueEvents.length) {
      if (Object.keys(retainedDelivered).length !== Object.keys(ledger.delivered).length) {
        writeRuntimeNotificationLedger(runtimeNotificationStateKey, {
          version: 1,
          delivered: retainedDelivered
        });
      }
      return;
    }

    const notificationTaskId = runtimeNotificationTaskRef.current + 1;
    runtimeNotificationTaskRef.current = notificationTaskId;
    let cancelled = false;
    const isCurrentNotificationTask = () =>
      !cancelled && runtimeNotificationTaskRef.current === notificationTaskId;

    runtimeNotificationSyncRef.current = true;
    void (async () => {
      try {
        const notification = await import('@tauri-apps/plugin-notification');
        if (!isCurrentNotificationTask()) return;

        const permissionGranted = await notification.isPermissionGranted();
        if (!isCurrentNotificationTask() || !permissionGranted) return;

        const requestedAt = new Date().toISOString();
        dueEvents.forEach((event) => {
          notification.sendNotification({
            title: event.title,
            body: event.body
          });
          retainedDelivered[event.eventId] = requestedAt;
        });
        if (!isCurrentNotificationTask()) return;

        writeRuntimeNotificationLedger(runtimeNotificationStateKey, {
          version: 1,
          delivered: retainedDelivered
        });
      } catch {
        if (isCurrentNotificationTask() && open) {
          setFeedback('Windows 横幅请求暂时未完成，请检查系统通知设置');
        }
      } finally {
        if (runtimeNotificationTaskRef.current === notificationTaskId) {
          runtimeNotificationSyncRef.current = false;
        }
      }
    })();

    return () => {
      cancelled = true;
      if (runtimeNotificationTaskRef.current === notificationTaskId) {
        runtimeNotificationTaskRef.current += 1;
        runtimeNotificationSyncRef.current = false;
      }
    };
  }, [
    applicationsLoading,
    enabledReminders,
    now,
    open,
    preferences,
    runtimeNotificationStateKey,
    session?.userId,
    state,
    stateReady
  ]);

  useEffect(() => {
    onUnreadCountChange(unreadCount);
  }, [onUnreadCountChange, unreadCount]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => closeButtonRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return;

    const focusableElements = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),select:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => element.offsetParent !== null);
    if (!focusableElements.length) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  const emptyState = useMemo(() => {
    if (!applications.length && !mentorContacts.length) {
      return {
        title: '还没有可生成的提醒',
        detail: '加入申请项目或设置导师跟进日期后，关键提醒会出现在这里。'
      };
    }
    if (!enabledReminders.length) {
      return {
        title: '当前没有已启用的提醒',
        detail: '你可以在通知设置中调整截止、材料、变更和导师提醒。'
      };
    }
    if (filter === 'unread') {
      return {
        title: '当前提醒都处理好了',
        detail: '新的截止、材料风险和申请关键变更会继续出现在这里。'
      };
    }
    return {
      title: '暂无提醒记录',
      detail: '新的截止、材料风险和申请关键变更会出现在这里。'
    };
  }, [applications.length, enabledReminders.length, filter, mentorContacts.length]);

  function markReminderRead(id: string) {
    setState((current) => {
      const remainingSnoozes = { ...current.snoozedUntil };
      delete remainingSnoozes[id];
      return {
        readIds: current.readIds.includes(id) ? current.readIds : [...current.readIds, id],
        snoozedUntil: remainingSnoozes
      };
    });
    setFeedback('已将提醒标为已读');
  }

  function handleFilterKeyDown(event: KeyboardEvent<HTMLButtonElement>, value: ReminderFilter) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextFilter: ReminderFilter =
      event.key === 'Home'
        ? 'unread'
        : event.key === 'End'
          ? 'all'
          : value === 'unread'
            ? 'all'
            : 'unread';
    setFilter(nextFilter);
    window.requestAnimationFrame(() => {
      document.getElementById(`desktop-reminder-tab-${nextFilter}`)?.focus();
    });
  }

  function markAllRead() {
    const reminderIds = enabledReminders.map((reminder) => reminder.id);
    const unreadIds = enabledReminders
      .filter((reminder) => isReminderUnread(reminder, state, now))
      .map((reminder) => reminder.id);
    if (!unreadIds.length) return;

    const transition = markReminderIdsRead(state, reminderIds);
    const undo: MarkAllReadUndo = {
      ...transition.snapshot,
      count: unreadIds.length
    };

    setState(transition.state);
    setMarkAllReadUndo(undo);
    if (markAllReadUndoTimerRef.current !== null) {
      window.clearTimeout(markAllReadUndoTimerRef.current);
    }
    markAllReadUndoTimerRef.current = window.setTimeout(() => {
      setMarkAllReadUndo(null);
      markAllReadUndoTimerRef.current = null;
    }, MARK_ALL_READ_UNDO_MS);
    setFeedback(`已将 ${unreadIds.length} 项提醒标为已读，可在 6 秒内撤销`);
  }

  function undoMarkAllRead() {
    if (!markAllReadUndo) return;
    setState((current) => restoreMarkedReminderIds(current, markAllReadUndo));
    if (markAllReadUndoTimerRef.current !== null) {
      window.clearTimeout(markAllReadUndoTimerRef.current);
      markAllReadUndoTimerRef.current = null;
    }
    setMarkAllReadUndo(null);
    setFeedback('已撤销“全部已读”');
  }

  function handleNavigate(reminder: DesktopReminder) {
    markReminderRead(reminder.id);
    onNavigate(reminder.href);
  }

  function closeSnoozeMenu(reminderId: string, restoreFocus: boolean) {
    setOpenSnoozeId(null);
    if (restoreFocus) snoozeTriggerRefs.current.get(reminderId)?.focus();
  }

  function handleSnooze(reminder: DesktopReminder, option: ReminderSnoozeOption) {
    closeSnoozeMenu(reminder.id, true);
    const when = getNextAllowedDesktopNotificationDate(preferences, option.target);
    setState((current) => ({
      readIds: current.readIds.includes(reminder.id) ? current.readIds : [...current.readIds, reminder.id],
      snoozedUntil: { ...current.snoozedUntil, [reminder.id]: when.toISOString() }
    }));
    setFeedback(`已将提醒设为${option.label}（${formatSnoozeTime(when.toISOString())}）`);
  }

  function pauseNotifications() {
    onPreferencesChange({
      ...preferences,
      notifications: {
        ...preferences.notifications,
        pausedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      }
    });
    setFeedback('运行中的 Windows 横幅已暂停 1 小时，应用内提醒仍会保留');
  }

  function resumeNotifications() {
    onPreferencesChange({
      ...preferences,
      notifications: {
        ...preferences.notifications,
        pausedUntil: null
      }
    });
    setFeedback('运行中的 Windows 横幅已恢复');
  }

  return (
    <aside
      id="desktop-reminder-center"
      role={open ? 'dialog' : undefined}
      aria-modal={open ? true : undefined}
      aria-labelledby={open ? 'desktop-reminder-title' : undefined}
      aria-hidden={!open}
      inert={!open ? true : undefined}
      className="desktop-reminder-center"
      onKeyDown={handleDialogKeyDown}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 id="desktop-reminder-title" className={styles.title}>
            提醒中心
          </h2>
          <span className={styles.countBadge}>
            {unreadCount}
          </span>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            aria-label={notificationsPaused ? '恢复 Windows 横幅' : '暂停 Windows 横幅 1 小时'}
            title={notificationsPaused ? '恢复提醒' : '暂停 1 小时'}
            onClick={notificationsPaused ? resumeNotifications : pauseNotifications}
            className={`desktop-toolbar-icon ${styles.toolbarButton}${notificationsPaused ? ` ${styles.toolbarButtonActive}` : ''}`}
          >
            {notificationsPaused ? (
              <BellOff className={styles.toolbarGlyph} strokeWidth={1.75} />
            ) : (
              <Moon className={styles.toolbarGlyph} strokeWidth={1.75} />
            )}
          </button>
          <button
            type="button"
            disabled={unreadCount === 0}
            onClick={markAllRead}
            className={styles.markAllButton}
          >
            <CheckCheck className={styles.toolbarGlyph} strokeWidth={1.75} />
            全部已读
          </button>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="关闭提醒中心"
            onClick={onClose}
            className={`desktop-toolbar-icon ${styles.toolbarButton}`}
          >
            <X className={styles.toolbarGlyph} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className={styles.filtersRegion}>
        <div
          className={styles.filterTabs}
          role="tablist"
          aria-label="提醒筛选"
        >
          {([
            ['unread', '未读'],
            ['all', '全部']
          ] as const).map(([value, label]) => (
            <button
              id={`desktop-reminder-tab-${value}`}
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              aria-controls="desktop-reminder-tabpanel"
              tabIndex={filter === value ? 0 : -1}
              onClick={() => setFilter(value)}
              onKeyDown={(event) => handleFilterKeyDown(event, value)}
              className={`${styles.filterTab}${filter === value ? ` ${styles.filterTabActive}` : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
        {notificationsPaused ? (
          <div className={styles.pausedBanner}>
            <span className={styles.pausedCopy}>
              运行中的 Windows 横幅已暂停至 {formatSnoozeTime(preferences.notifications.pausedUntil || '')}
            </span>
            <button type="button" onClick={resumeNotifications} className={styles.pausedAction}>
              立即恢复
            </button>
          </div>
        ) : null}
        {staleSyncError ? (
          <div className={styles.inlineStateRegion}>
            <DesktopStateSurface
              icon={<RefreshCw />}
              title="申请提醒暂未同步"
              detail={
                applicationsLoadedRef.current
                  ? '当前显示最近一次同步结果，后台会继续重试。'
                  : '导师跟进提醒仍可使用，申请提醒会在网络恢复后补齐。'
              }
              action={(
                <button
                  type="button"
                  onClick={() => setRefreshNonce((value) => value + 1)}
                  className={styles.inlineStateAction}
                >
                  立即重试
                </button>
              )}
              variant="inline"
              tone="stale"
              role="alert"
              className={styles.inlineStateSurface}
            />
          </div>
        ) : null}
      </div>

      <div
        id="desktop-reminder-tabpanel"
        className={`desktop-reminder-scroll desktop-scrollbar ${styles.scrollRegion}`}
        role="tabpanel"
        aria-labelledby={`desktop-reminder-tab-${filter}`}
        aria-busy={applicationsLoading}
      >
        <h3 className={styles.sectionTitle}>
          {filter === 'all' ? '全部记录' : '待处理'}
        </h3>
        {applicationsLoading && !hasUsableReminderSnapshot ? (
          <DesktopStateSurface
            icon={<RefreshCw />}
            title="正在同步提醒"
            detail="正在读取申请进度、材料状态与导师跟进节点。"
            variant="full"
            loading
            ariaBusy
            className={styles.stateSurface}
          />
        ) : hardSyncError ? (
          <DesktopStateSurface
            icon={<RefreshCw />}
            title="暂时无法同步提醒"
            detail="请检查网络连接后重试。你的申请数据不会因此被修改。"
            action={(
              <button
                type="button"
                onClick={() => setRefreshNonce((value) => value + 1)}
                className={styles.stateAction}
              >
                立即重试
              </button>
            )}
            variant="full"
            tone="error"
            role="alert"
            ariaLive="assertive"
            className={styles.stateSurface}
          />
        ) : visibleReminders.length ? (
          <div className={styles.reminderList}>
            {visibleReminders.map((reminder) => {
              const visual = reminderVisuals[reminder.kind];
              const Icon = visual.icon;
              const unread = isReminderUnread(reminder, state, now);
              const snoozedUntil = state.snoozedUntil[reminder.id];
              const reminderDomId = reminder.id.replace(/[^a-zA-Z0-9_-]/g, '-');
              const snoozeTriggerId = `desktop-reminder-snooze-trigger-${reminderDomId}`;
              const snoozeMenuId = `desktop-reminder-snooze-menu-${reminderDomId}`;
              return (
                <article
                  key={reminder.id}
                  className={`desktop-reminder-item ${styles.reminderItem}${unread ? '' : ` ${styles.reminderItemRead}`}`}
                  data-kind={reminder.kind}
                  data-unread={unread}
                >
                  <div className={styles.reminderMain}>
                    <span className={styles.reminderIcon}>
                      <Icon className={styles.reminderGlyph} strokeWidth={1.75} />
                    </span>
                    <div className={styles.reminderCopy}>
                      <h4 className={styles.reminderTitle}>{reminder.title}</h4>
                      <p className={styles.reminderDetail}>{reminder.detail}</p>
                      <p className={styles.reminderTime}>
                        {snoozedUntil && new Date(snoozedUntil).getTime() > now
                          ? `已稍后至 ${formatSnoozeTime(snoozedUntil)}`
                          : reminder.time}
                      </p>
                    </div>
                    <span
                      className={`${styles.unreadIndicator}${unread ? ` ${styles.unreadIndicatorActive}` : ''}`}
                      aria-label={unread ? '未读' : '已读'}
                    />
                  </div>
                  <div className={styles.reminderActions}>
                    <button
                      type="button"
                      onClick={() => handleNavigate(reminder)}
                      className={styles.primaryItemAction}
                    >
                      {reminder.actionLabel}
                      <ChevronRight className={styles.actionGlyph} strokeWidth={1.8} />
                    </button>
                    <span className={styles.snoozeControl}>
                      <button
                        ref={(element) => {
                          if (element) snoozeTriggerRefs.current.set(reminder.id, element);
                          else snoozeTriggerRefs.current.delete(reminder.id);
                        }}
                        id={snoozeTriggerId}
                        type="button"
                        aria-label={`将“${reminder.title}”稍后提醒`}
                        aria-haspopup="menu"
                        aria-expanded={openSnoozeId === reminder.id}
                        aria-controls={openSnoozeId === reminder.id ? snoozeMenuId : undefined}
                        onClick={() => {
                          setOpenSnoozeId((current) => current === reminder.id ? null : reminder.id);
                        }}
                        className={styles.itemAction}
                      >
                        <Clock3 className={styles.actionGlyph} strokeWidth={1.75} />
                        稍后提醒
                      </button>
                      {openSnoozeId === reminder.id ? (
                        <ReminderSnoozeMenu
                          menuId={snoozeMenuId}
                          triggerId={snoozeTriggerId}
                          reminderTitle={reminder.title}
                          now={now}
                          defaultSnoozeMinutes={preferences.notifications.snoozeMinutes}
                          onSelect={(option) => handleSnooze(reminder, option)}
                          onClose={(restoreFocus) => closeSnoozeMenu(reminder.id, restoreFocus)}
                        />
                      ) : null}
                    </span>
                    {unread ? (
                      <button
                        type="button"
                        aria-label={`将“${reminder.title}”标为已读`}
                        title="标为已读"
                        onClick={() => markReminderRead(reminder.id)}
                        className={styles.iconItemAction}
                      >
                        <Check className={styles.actionGlyph} strokeWidth={1.9} />
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <DesktopStateSurface
            icon={filter === 'unread' && enabledReminders.length ? <CheckCheck /> : <BellOff />}
            title={emptyState.title}
            detail={emptyState.detail}
            action={
              !enabledReminders.length && (applications.length || mentorContacts.length) ? (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className={styles.stateAction}
                >
                  调整通知设置
                </button>
              ) : undefined
            }
            variant="full"
            tone={filter === 'unread' && enabledReminders.length ? 'success' : 'neutral'}
            className={styles.stateSurface}
          />
        )}
      </div>

      {markAllReadUndo ? (
        <div className={styles.undoBar}>
          <span>已将 {markAllReadUndo.count} 项提醒标为已读</span>
          <button type="button" className={styles.undoButton} onClick={undoMarkAllRead}>
            撤销
          </button>
        </div>
      ) : null}

      <footer className={styles.footer}>
        {filter !== 'all' ? (
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={styles.footerPrimaryAction}
          >
            查看全部提醒
            <ChevronRight className={styles.actionGlyph} strokeWidth={1.8} />
          </button>
        ) : <span className={styles.footerSpacer} />}
        <button
          type="button"
          onClick={onOpenSettings}
          className={styles.footerSecondaryAction}
        >
          <Settings2 className={styles.actionGlyph} strokeWidth={1.75} />
          通知设置
        </button>
        <p className="sr-only" role="status" aria-live="polite">{feedback}</p>
      </footer>
    </aside>
  );
}
