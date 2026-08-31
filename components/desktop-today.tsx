'use client';

import Link from 'next/link';
import {
  Add20Regular,
  Alert20Regular,
  ArrowRight20Regular,
  Calendar24Regular,
  CheckmarkCircle20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  ClipboardTask20Regular,
  Clock20Regular,
  DataTrending20Regular,
  Dismiss20Regular,
  DocumentText20Regular,
  Filter20Regular,
  Folder24Regular
} from '@fluentui/react-icons';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react';
import { ExternalSiteMark } from '@/components/external-site-mark';
import { useUserSessionState } from '@/hooks/use-user-session';
import {
  calculateMaterialsProgress,
  fetchApplicationRows,
  fetchPublicNotices,
  type ApplicationRow
} from '@/lib/cloudbase-data';
import {
  getDeadlineDistanceLabel,
  getDeadlineLevelFromDate,
  getDeadlineTimestamp
} from '@/lib/deadline-display';
import { getDisplaySchoolName } from '@/lib/notice-display';
import { filterMainNoticeProjects } from '@/lib/notice-quality';
import { baseNoticeProjects } from '@/lib/notice-source';
import { resolveNoticeLogoSource } from '@/lib/school-mark-source';
import { materialChecklistDefinitions, type PublicNoticeProject } from '@/lib/mock-data';
import {
  emitDesktopFeedback,
  emitDesktopModalState,
  emitDesktopSyncStatus
} from '@/lib/desktop-route-events';
import { trackDesktopPendingWrite } from '@/lib/desktop-pending-writes';
import {
  hydrateWorkbenchState,
  saveWorkbenchState,
  type WorkbenchCustomTodo,
  type WorkbenchMentorContact
} from '@/lib/workbench-state';
import {
  readAccountScopedWorkbenchValue,
  writeAccountScopedWorkbenchValue,
  WORKBENCH_COMPLETED_TODOS_KEY,
  WORKBENCH_CONTACTS_KEY,
  WORKBENCH_CUSTOM_TODOS_KEY
} from '@/lib/workbench-local-storage';

type LocalScheduleItem = {
  id: string;
  text: string;
  date?: string;
  note?: string;
  type?: string;
  category?: string;
  priority?: string;
  completed?: boolean;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
};

type HomePanelKey = 'schedule' | 'application' | 'deadlines' | 'alerts';
type HomePanelVisibility = Record<HomePanelKey, boolean>;

const HOME_VISIBILITY_STORAGE_KEY = 'seekoffer-desktop-home-visibility-v1';
const defaultPanelVisibility: HomePanelVisibility = {
  schedule: true,
  application: true,
  deadlines: true,
  alerts: true
};
const fallbackProjects = filterMainNoticeProjects(baseNoticeProjects).filter(
  (item) => String(item.year) === '2026'
);

function formatChinaDateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai'
  }).format(date);
}

function getChinaDateMeta(date: Date) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'Asia/Shanghai'
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || '';

  return {
    dateText: `${read('year')}年${read('month')}月${read('day')}日 · ${read('weekday')}`,
    dayLabel: read('day'),
    weekdayLabel: read('weekday').replace('星期', '周')
  };
}

function shiftDate(date: Date, days: number) {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

function readScheduleItems(ownerId: string) {
  if (typeof window === 'undefined') return [] as LocalScheduleItem[];
  try {
    const raw = readAccountScopedWorkbenchValue(WORKBENCH_CUSTOM_TODOS_KEY, ownerId);
    const completedRaw = readAccountScopedWorkbenchValue(
      WORKBENCH_COMPLETED_TODOS_KEY,
      ownerId
    );
    const completedIds = new Set<string>(
      completedRaw
        ? (JSON.parse(completedRaw) as unknown[]).filter(
            (item): item is string => typeof item === 'string'
          )
        : []
    );
    const parsed = raw ? (JSON.parse(raw) as LocalScheduleItem[]) : [];
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (item) =>
              item && typeof item.id === 'string' && typeof item.text === 'string'
          )
          .map((item) => {
            const { category, priority, ...rest } = item;
            return {
              ...rest,
              ...(typeof category === 'string' && category ? { category } : {}),
              ...(typeof priority === 'string' && priority ? { priority } : {}),
              completed: completedIds.has(item.id)
            };
          })
      : [];
  } catch {
    return [];
  }
}

function writeScheduleItems(items: LocalScheduleItem[], ownerId: string) {
  const customTodos = items.map((item) => ({
    id: item.id,
    text: item.text,
    ...(item.date ? { date: item.date } : {}),
    ...(item.note ? { note: item.note } : {}),
    ...(item.type ? { type: item.type } : {}),
    ...(item.category ? { category: item.category } : {}),
    ...(item.priority ? { priority: item.priority } : {}),
    ...(item.createdAt ? { createdAt: item.createdAt } : {}),
    ...(item.updatedAt ? { updatedAt: item.updatedAt } : {}),
    ...(item.deletedAt ? { deletedAt: item.deletedAt } : {})
  }));
  const completedTodoIds = items.filter((item) => item.completed).map((item) => item.id);
  return (
    writeAccountScopedWorkbenchValue(
      WORKBENCH_CUSTOM_TODOS_KEY,
      ownerId,
      JSON.stringify(customTodos)
    ) &&
    writeAccountScopedWorkbenchValue(
      WORKBENCH_COMPLETED_TODOS_KEY,
      ownerId,
      JSON.stringify(completedTodoIds)
    )
  );
}

function readStoredContacts(ownerId: string) {
  try {
    const raw = readAccountScopedWorkbenchValue(WORKBENCH_CONTACTS_KEY, ownerId);
    const parsed = raw ? (JSON.parse(raw) as WorkbenchMentorContact[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as WorkbenchMentorContact[];
  }
}

function toWorkbenchState(items: LocalScheduleItem[], ownerId: string) {
  return {
    completedTodoIds: items.filter((item) => item.completed).map((item) => item.id),
    customTodos: items.map((item) => ({
      id: item.id,
      text: item.text,
      ...(item.date ? { date: item.date } : {}),
      ...(item.note ? { note: item.note } : {}),
      ...(item.type ? { type: item.type } : {}),
      ...(item.category ? { category: item.category } : {}),
      ...(item.priority ? { priority: item.priority } : {}),
      ...(typeof item.completed === 'boolean' ? { completed: item.completed } : {}),
      ...(item.createdAt ? { createdAt: item.createdAt } : {}),
      ...(item.updatedAt ? { updatedAt: item.updatedAt } : {}),
      ...(item.deletedAt ? { deletedAt: item.deletedAt } : {})
    }) as WorkbenchCustomTodo),
    contacts: readStoredContacts(ownerId)
  };
}

function readPanelVisibility() {
  if (typeof window === 'undefined') return defaultPanelVisibility;
  try {
    const raw = window.localStorage.getItem(HOME_VISIBILITY_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<HomePanelVisibility>) : {};
    return {
      schedule: typeof parsed.schedule === 'boolean' ? parsed.schedule : true,
      application: typeof parsed.application === 'boolean' ? parsed.application : true,
      deadlines: typeof parsed.deadlines === 'boolean' ? parsed.deadlines : true,
      alerts: typeof parsed.alerts === 'boolean' ? parsed.alerts : true
    };
  } catch {
    return defaultPanelVisibility;
  }
}

function sortLiveProjects(projects: PublicNoticeProject[]) {
  return projects
    .filter((item) => getDeadlineLevelFromDate(item.deadlineDate) !== 'expired')
    .sort(
      (left, right) =>
        getDeadlineTimestamp(left.deadlineDate) - getDeadlineTimestamp(right.deadlineDate)
    );
}

export function DesktopToday({
  unreadReminderCount,
  onOpenReminders
}: {
  unreadReminderCount: number;
  onOpenReminders: () => void;
}) {
  const { session } = useUserSessionState();
  const [projects, setProjects] = useState<PublicNoticeProject[]>(fallbackProjects);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [scheduleItems, setScheduleItems] = useState<LocalScheduleItem[]>([]);
  const [panelVisibility, setPanelVisibility] =
    useState<HomePanelVisibility>(defaultPanelVisibility);
  const [displayManagerOpen, setDisplayManagerOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');
  const [quickAddType, setQuickAddType] = useState('申请任务');
  const [quickAddFeedback, setQuickAddFeedback] = useState('');
  const [clockTick, setClockTick] = useState(() => Date.now());
  const quickAddInputRef = useRef<HTMLInputElement>(null);
  const quickAddDialogRef = useRef<HTMLFormElement>(null);
  const quickAddTriggerRef = useRef<HTMLElement | null>(null);
  const quickAddCloseTimerRef = useRef<number | null>(null);
  const displayManagerTriggerRef = useRef<HTMLButtonElement>(null);
  const displayManagerRef = useRef<HTMLDivElement>(null);
  const scheduleOwnerId = session?.userId || '';

  const closeDisplayManager = useCallback((restoreFocus = true) => {
    setDisplayManagerOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => displayManagerTriggerRef.current?.focus());
    }
  }, []);

  const closeQuickAdd = useCallback((restoreFocus = true) => {
    if (quickAddCloseTimerRef.current !== null) return;
    const reduceMotion =
      document.documentElement.dataset.desktopReduceMotion === 'true' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setQuickAddVisible(false);
    const finishClose = () => {
      setQuickAddOpen(false);
      setQuickAddFeedback('');
      quickAddCloseTimerRef.current = null;
      if (restoreFocus) {
        window.requestAnimationFrame(() => quickAddTriggerRef.current?.focus({ preventScroll: true }));
      }
    };
    if (reduceMotion) finishClose();
    else quickAddCloseTimerRef.current = window.setTimeout(finishClose, 120);
  }, []);

  const openQuickAdd = useCallback((trigger: HTMLElement) => {
    quickAddTriggerRef.current = trigger;
    setDisplayManagerOpen(false);
    setQuickAddFeedback('');
    if (quickAddCloseTimerRef.current !== null) {
      window.clearTimeout(quickAddCloseTimerRef.current);
      quickAddCloseTimerRef.current = null;
    }
    setQuickAddOpen(true);
  }, []);

  useEffect(() => {
    let active = true;
    void fetchPublicNotices()
      .then((rows) => {
        if (active && rows.length) {
          setProjects(rows.filter((item) => String(item.year) === '2026'));
        }
      })
      .catch(() => undefined);

    void fetchApplicationRows()
      .then((rows) => {
        if (active) setApplications(rows);
      })
      .catch(() => undefined);

    setPanelVisibility(readPanelVisibility());
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const updateSchedule = () => setScheduleItems(readScheduleItems(scheduleOwnerId));
    updateSchedule();
    window.addEventListener('focus', updateSchedule);
    window.addEventListener('storage', updateSchedule);
    return () => {
      window.removeEventListener('focus', updateSchedule);
      window.removeEventListener('storage', updateSchedule);
    };
  }, [scheduleOwnerId]);

  useEffect(() => {
    if (!scheduleOwnerId) return;
    let active = true;
    const localItems = readScheduleItems(scheduleOwnerId);
    emitDesktopSyncStatus('syncing');
    void trackDesktopPendingWrite('today-workbench-hydrate', () =>
      hydrateWorkbenchState(scheduleOwnerId, toWorkbenchState(localItems, scheduleOwnerId))
    )
      .then((mergedState) => {
        if (!active) return;
        const completedIds = new Set(mergedState.completedTodoIds);
        const mergedItems = mergedState.customTodos.map((item) => ({
          ...item,
          completed: completedIds.has(item.id)
        }));
        writeScheduleItems(mergedItems, scheduleOwnerId);
        writeAccountScopedWorkbenchValue(
          WORKBENCH_CONTACTS_KEY,
          scheduleOwnerId,
          JSON.stringify(mergedState.contacts)
        );
        setScheduleItems(mergedItems);
        emitDesktopSyncStatus('synced');
      })
      .catch(() => {
        if (!active) return;
        emitDesktopSyncStatus('error');
        emitDesktopFeedback({
          message: '日程暂时无法同步',
          detail: '仍可使用当前设备上的最近数据',
          tone: 'warning'
        });
      });
    return () => {
      active = false;
    };
  }, [scheduleOwnerId]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!quickAddOpen) return;
    const frame = window.requestAnimationFrame(() => setQuickAddVisible(true));
    const timer = window.setTimeout(() => quickAddInputRef.current?.focus(), 40);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [quickAddOpen]);

  useEffect(() => () => {
    if (quickAddCloseTimerRef.current !== null) window.clearTimeout(quickAddCloseTimerRef.current);
  }, []);

  useEffect(() => {
    emitDesktopModalState('today-quick-add', quickAddOpen);
    return () => {
      if (quickAddOpen) emitDesktopModalState('today-quick-add', false);
    };
  }, [quickAddOpen]);

  useEffect(() => {
    if (!displayManagerOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && !displayManagerRef.current?.contains(target)) {
        closeDisplayManager(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [closeDisplayManager, displayManagerOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (quickAddOpen) {
        event.preventDefault();
        closeQuickAdd();
      } else if (displayManagerOpen) {
        event.preventDefault();
        closeDisplayManager();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeDisplayManager, closeQuickAdd, displayManagerOpen, quickAddOpen]);

  const selectedDateKey = formatChinaDateKey(selectedDate);
  const todayKey = formatChinaDateKey(new Date(clockTick));
  const selectedMeta = getChinaDateMeta(selectedDate);
  const selectedSchedule = useMemo(
    () =>
      scheduleItems
        .filter((item) => !item.deletedAt && item.date === selectedDateKey)
        .sort((left, right) => Number(Boolean(left.completed)) - Number(Boolean(right.completed))),
    [scheduleItems, selectedDateKey]
  );
  const deadlineProjects = useMemo(() => sortLiveProjects(projects).slice(0, 4), [projects]);
  const sortedApplications = useMemo(
    () =>
      [...applications].sort(
        (left, right) =>
          getDeadlineTimestamp(left.project.deadlineDate) -
          getDeadlineTimestamp(right.project.deadlineDate)
      ),
    [applications]
  );
  const leadApplication = sortedApplications[0];
  const leadProject = leadApplication?.project || deadlineProjects[0] || fallbackProjects[0];
  const leadProgress = leadApplication
    ? leadApplication.item.materialsProgress || calculateMaterialsProgress(leadApplication.item)
    : 0;
  const completedMaterials = leadApplication
    ? materialChecklistDefinitions.filter(({ key }) => leadApplication.item[key]).length
    : 0;
  const pendingMaterialCount = Math.max(
    0,
    materialChecklistDefinitions.length - completedMaterials
  );
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => shiftDate(selectedDate, index - 3)),
    [selectedDate]
  );
  const generatedTasks = useMemo(
    () => [
      {
        id: 'application-focus',
        title: leadProject
          ? leadApplication
            ? `继续推进 ${getDisplaySchoolName(leadProject.schoolName)} 申请`
            : `评估 ${getDisplaySchoolName(leadProject.schoolName)} 申请机会`
          : '建立第一份申请计划',
        detail: leadProject
          ? `${leadProject.deadlineDate || '截止时间待公布'} · ${getDeadlineDistanceLabel(leadProject.deadlineDate)}`
          : '从通知库选择目标项目',
        href: leadApplication ? '/' : '/notices',
        icon: Folder24Regular
      },
      {
        id: 'materials-focus',
        title: pendingMaterialCount
          ? `还有 ${pendingMaterialCount} 项申请材料待处理`
          : '申请材料状态正常',
        detail: leadApplication ? '检查材料完整性与最新版本' : '加入申请后可自动生成材料清单',
        href: '/',
        icon: DocumentText20Regular
      }
    ],
    [leadApplication, leadProject, pendingMaterialCount]
  );
  const pendingScheduleCount = selectedSchedule.filter((item) => !item.completed).length;

  function updatePanelVisibility(key: HomePanelKey, checked: boolean) {
    const next = { ...panelVisibility, [key]: checked };
    setPanelVisibility(next);
    try {
      window.localStorage.setItem(HOME_VISIBILITY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // The current in-memory layout remains usable when storage is unavailable.
    }
  }

  function resetPanelVisibility() {
    setPanelVisibility(defaultPanelVisibility);
    try {
      window.localStorage.setItem(
        HOME_VISIBILITY_STORAGE_KEY,
        JSON.stringify(defaultPanelVisibility)
      );
    } catch {
      // Reset still applies for the current session.
    }
  }

  function syncScheduleItems(items: LocalScheduleItem[]) {
    if (!scheduleOwnerId) return;
    emitDesktopSyncStatus('syncing');
    void trackDesktopPendingWrite('today-workbench-save', () =>
      saveWorkbenchState(scheduleOwnerId, toWorkbenchState(items, scheduleOwnerId))
    )
      .then(() => emitDesktopSyncStatus('synced'))
      .catch(() => {
        emitDesktopSyncStatus('error');
        emitDesktopFeedback({
          message: '事项已保存在当前设备',
          detail: '云端同步失败，寻鹿会在下次打开日程时重试',
          tone: 'warning',
          duration: 5200
        });
      });
  }

  function handleQuickAddDialogKeyDown(event: ReactKeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeQuickAdd();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleQuickAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = quickAddText.trim();
    if (!text) {
      setQuickAddFeedback('请先填写事项内容');
      quickAddInputRef.current?.focus();
      return;
    }

    const nextItem: LocalScheduleItem = {
      id: `desktop-${Date.now()}`,
      text,
      date: selectedDateKey,
      type: quickAddType,
      category: '申请',
      priority: '重要不紧急',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const nextItems = [...readScheduleItems(scheduleOwnerId), nextItem];
    if (!writeScheduleItems(nextItems, scheduleOwnerId)) {
      setQuickAddFeedback('事项暂时无法保存，请检查系统存储权限');
      return;
    }

    setScheduleItems(nextItems);
    setQuickAddText('');
    setQuickAddFeedback('');
    closeQuickAdd();
    syncScheduleItems(nextItems);
    emitDesktopFeedback({
      message: '事项已创建',
      detail: `${formatChinaDateKey(selectedDate)} · ${quickAddType}`,
      tone: 'success'
    });
  }

  function toggleScheduleItem(id: string) {
    const previousItems = readScheduleItems(scheduleOwnerId);
    const nextItems = previousItems.map((item) =>
      item.id === id
        ? { ...item, completed: !item.completed, updatedAt: new Date().toISOString() }
        : item
    );
    if (!writeScheduleItems(nextItems, scheduleOwnerId)) return;
    setScheduleItems(nextItems);
    syncScheduleItems(nextItems);
    const updatedItem = nextItems.find((item) => item.id === id);
    emitDesktopFeedback({
      message: updatedItem?.completed ? '事项已完成' : '事项已恢复为未完成',
      detail: updatedItem?.text,
      tone: 'success',
      actionLabel: '撤销',
      onAction: () => {
        writeScheduleItems(previousItems, scheduleOwnerId);
        setScheduleItems(previousItems);
        syncScheduleItems(previousItems);
      }
    });
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="desktop-route-content desktop-core-page desktop-core-page--scroll desktop-home-content outline-none"
    >
      <div
        className="desktop-today-background"
        inert={quickAddOpen ? true : undefined}
        aria-hidden={quickAddOpen ? true : undefined}
      >
      <header className="desktop-core-page-header desktop-day-header">
        <div className="desktop-day-title-block">
          <p className="desktop-day-date">{selectedMeta.dateText}</p>
          <div className="desktop-day-title-row">
            <h1>我的一天</h1>
          </div>
        </div>

        <div className="desktop-home-actions">
          <div
            className="desktop-display-manager"
            ref={displayManagerRef}
            onBlur={(event) => {
              const nextTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null;
              if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                closeDisplayManager(false);
              }
            }}
          >
            <button
              ref={displayManagerTriggerRef}
              type="button"
              className="desktop-secondary-command"
              aria-haspopup="dialog"
              aria-expanded={displayManagerOpen}
              aria-controls="desktop-home-display-manager"
              onClick={() => {
                if (displayManagerOpen) closeDisplayManager();
                else setDisplayManagerOpen(true);
              }}
            >
              <Filter20Regular aria-hidden="true" />
              展示管理
            </button>
            {displayManagerOpen ? (
              <div
                id="desktop-home-display-manager"
                className="desktop-display-popover"
                role="dialog"
                aria-label="首页展示管理"
              >
                <div className="desktop-display-popover-heading">
                  <div>
                    <strong>展示管理</strong>
                    <span>选择“我的一天”中显示的内容</span>
                  </div>
                  <button
                    type="button"
                    aria-label="关闭展示管理"
                    onClick={() => closeDisplayManager()}
                  >
                    <Dismiss20Regular aria-hidden="true" />
                  </button>
                </div>
                {(
                  [
                    ['schedule', '今日事项'],
                    ['application', '申请焦点'],
                    ['deadlines', '临近截止'],
                    ['alerts', '提醒状态']
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="desktop-display-toggle-row">
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={panelVisibility[key]}
                      onChange={(event) => updatePanelVisibility(key, event.target.checked)}
                    />
                  </label>
                ))}
                <button
                  type="button"
                  className="desktop-display-reset"
                  onClick={resetPanelVisibility}
                >
                  恢复默认
                </button>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="desktop-primary-command"
            onClick={(event) => openQuickAdd(event.currentTarget)}
          >
            <Add20Regular aria-hidden="true" />
            新建事项
          </button>
        </div>
      </header>

      <section className="desktop-week-strip" aria-label="日期选择">
        <button
          type="button"
          aria-label="上一天"
          className="desktop-week-nav"
          onClick={() => setSelectedDate((current) => shiftDate(current, -1))}
        >
          <ChevronLeft20Regular aria-hidden="true" />
        </button>
        <div className="desktop-week-days">
          {weekDates.map((date) => {
            const key = formatChinaDateKey(date);
            const meta = getChinaDateMeta(date);
            const selected = key === selectedDateKey;
            const today = key === todayKey;
            return (
              <button
                key={key}
                type="button"
                aria-current={selected ? 'date' : undefined}
                className={`desktop-week-day${selected ? ' desktop-week-day--selected' : ''}${
                  today ? ' desktop-week-day--today' : ''
                }`}
                onClick={() => setSelectedDate(date)}
              >
                <span>{meta.weekdayLabel}</span>
                <strong>{meta.dayLabel}</strong>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-label="下一天"
          className="desktop-week-nav"
          onClick={() => setSelectedDate((current) => shiftDate(current, 1))}
        >
          <ChevronRight20Regular aria-hidden="true" />
        </button>
        <button
          type="button"
          className="desktop-today-command"
          disabled={selectedDateKey === todayKey}
          onClick={() => setSelectedDate(new Date())}
        >
          回到今天
        </button>
      </section>

      <section className="desktop-home-workspace">
        <div className="desktop-today-panel">
          <div className="desktop-panel-heading">
            <div>
              <h2>今日事项</h2>
            </div>
            <span className="desktop-panel-count">{pendingScheduleCount + generatedTasks.length} 项</span>
          </div>

          {panelVisibility.schedule ? (
            <div className="desktop-task-list">
              {selectedSchedule.map((item) => (
                <article
                  key={item.id}
                  className={`desktop-task-row${item.completed ? ' desktop-task-row--completed' : ''}`}
                >
                  <button
                    type="button"
                    className="desktop-task-check"
                    aria-label={item.completed ? `将“${item.text}”恢复为未完成` : `完成“${item.text}”`}
                    aria-pressed={Boolean(item.completed)}
                    onClick={() => toggleScheduleItem(item.id)}
                  >
                    {item.completed ? <CheckmarkCircle20Regular aria-hidden="true" /> : null}
                  </button>
                  <div className="desktop-task-copy">
                    <strong>{item.text}</strong>
                    <span>
                      {item.type || '日程'}
                      {item.note ? ` · ${item.note}` : ''}
                    </span>
                  </div>
                  <span className="desktop-task-time">全天</span>
                </article>
              ))}

              {generatedTasks.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Link key={item.id} href={item.href} className="desktop-task-row desktop-task-row--link">
                    <span className="desktop-task-source-icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <span className="desktop-task-copy">
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </span>
                    <span className="desktop-task-time">{index ? '材料' : '申请'}</span>
                    <ArrowRight20Regular className="desktop-task-arrow" aria-hidden="true" />
                  </Link>
                );
              })}

              {!selectedSchedule.length ? (
                <button
                  type="button"
                  className="desktop-task-add-row"
                  onClick={(event) => openQuickAdd(event.currentTarget)}
                >
                  <Add20Regular aria-hidden="true" />
                  添加这个日期的第一项安排
                </button>
              ) : null}
            </div>
          ) : (
            <div className="desktop-panel-hidden-state">
              <ClipboardTask20Regular aria-hidden="true" />
              <p>今日事项已在展示管理中隐藏</p>
              <button type="button" onClick={() => updatePanelVisibility('schedule', true)}>
                重新显示
              </button>
            </div>
          )}
        </div>

        <aside className="desktop-home-inspector" aria-label="申请概览">
          {panelVisibility.application ? (
            <section className="desktop-inspector-section desktop-focus-section">
              <div className="desktop-inspector-heading">
                <div>
                  <DataTrending20Regular aria-hidden="true" />
                  <h2>申请焦点</h2>
                </div>
                <Link href="/">全部申请</Link>
              </div>
              {leadProject ? (
                <>
                  <div className="desktop-focus-project">
                    <ExternalSiteMark
                      source={resolveNoticeLogoSource(leadProject)}
                      label={getDisplaySchoolName(leadProject.schoolName)}
                      size="sm"
                      rounded="full"
                    />
                    <div>
                      <strong>{getDisplaySchoolName(leadProject.schoolName)}</strong>
                      <span>{leadApplication ? '申请进行中' : '可加入申请'}</span>
                    </div>
                  </div>
                  <div className="desktop-focus-progress">
                    <div>
                      <span>{leadApplication ? '整体进度' : '申请准备'}</span>
                      <strong>{leadProgress}%</strong>
                    </div>
                    <div className="desktop-progress-track">
                      <span style={{ width: `${leadProgress}%` }} />
                    </div>
                  </div>
                  <div className="desktop-focus-meta">
                    <Clock20Regular aria-hidden="true" />
                    <span>
                      {leadProject.deadlineDate || '截止时间待公布'} ·{' '}
                      {getDeadlineDistanceLabel(leadProject.deadlineDate)}
                    </span>
                  </div>
                  <Link
                    href={leadApplication ? '/' : '/notices'}
                    className="desktop-inspector-primary-link"
                  >
                    {leadApplication ? '继续申请' : '查看机会'}
                    <ArrowRight20Regular aria-hidden="true" />
                  </Link>
                </>
              ) : null}
            </section>
          ) : null}

          {panelVisibility.deadlines ? (
            <section className="desktop-inspector-section">
              <div className="desktop-inspector-heading">
                <div>
                  <Calendar24Regular aria-hidden="true" />
                  <h2>临近截止</h2>
                </div>
                <Link href="/deadlines">截止专区</Link>
              </div>
              <div className="desktop-deadline-list">
                {deadlineProjects.slice(0, 3).map((project) => (
                  <Link key={project.id} href="/notices" className="desktop-deadline-row">
                    <span className="desktop-deadline-date">
                      {project.deadlineDate?.slice(5, 10) || '待定'}
                    </span>
                    <span className="desktop-deadline-copy">
                      <strong>{getDisplaySchoolName(project.schoolName)}</strong>
                      <span>{getDeadlineDistanceLabel(project.deadlineDate)}</span>
                    </span>
                    <ChevronRight20Regular aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {panelVisibility.alerts ? (
            <section className="desktop-inspector-section desktop-alert-section">
              <button type="button" onClick={onOpenReminders} className="desktop-alert-summary">
                <span className="desktop-alert-icon">
                  <Alert20Regular aria-hidden="true" />
                </span>
                <span>
                  <strong>
                    {unreadReminderCount ? `${unreadReminderCount} 条提醒待处理` : '提醒已处理完'}
                  </strong>
                </span>
                <ChevronRight20Regular aria-hidden="true" />
              </button>
            </section>
          ) : null}

          {!panelVisibility.application &&
          !panelVisibility.deadlines &&
          !panelVisibility.alerts ? (
            <section className="desktop-inspector-section desktop-panel-hidden-state">
              <Filter20Regular aria-hidden="true" />
              <p>右侧概览已全部隐藏</p>
              <button type="button" onClick={resetPanelVisibility}>
                恢复默认布局
              </button>
            </section>
          ) : null}
        </aside>
      </section>
      </div>

      {quickAddOpen ? (
        <div
          className="desktop-quick-add-backdrop"
          data-state={quickAddVisible ? 'open' : 'closed'}
          aria-hidden={quickAddVisible ? undefined : true}
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeQuickAdd();
          }}
        >
          <form
            ref={quickAddDialogRef}
            className="desktop-quick-add-dialog"
            data-state={quickAddVisible ? 'open' : 'closed'}
            role="dialog"
            aria-modal="true"
            aria-labelledby="desktop-quick-add-title"
            onSubmit={handleQuickAdd}
            onKeyDown={handleQuickAddDialogKeyDown}
          >
            <div className="desktop-quick-add-heading">
              <div>
                <span>快速记录</span>
                <h2 id="desktop-quick-add-title">新建申请事项</h2>
              </div>
              <button type="button" aria-label="关闭" onClick={() => closeQuickAdd()}>
                <Dismiss20Regular aria-hidden="true" />
              </button>
            </div>
            <label className="desktop-quick-add-main-field">
              <span>事项内容</span>
              <input
                ref={quickAddInputRef}
                value={quickAddText}
                onChange={(event) => {
                  setQuickAddText(event.target.value);
                  setQuickAddFeedback('');
                }}
                placeholder="例如：确认推荐信签字版本"
              />
            </label>
            <div className="desktop-quick-add-fields">
              <label>
                <span>日期</span>
                <input
                  type="date"
                  value={selectedDateKey}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    setSelectedDate(new Date(`${event.target.value}T12:00:00`));
                  }}
                />
              </label>
              <label>
                <span>类型</span>
                <select
                  value={quickAddType}
                  onChange={(event) => setQuickAddType(event.target.value)}
                >
                  <option>申请任务</option>
                  <option>材料准备</option>
                  <option>面试安排</option>
                  <option>普通日程</option>
                </select>
              </label>
            </div>
            <div className="desktop-quick-add-footer">
              <p role="status" aria-live="polite">
                {quickAddFeedback}
              </p>
              <div>
                <button
                  type="button"
                  className="desktop-secondary-command"
                  onClick={() => closeQuickAdd()}
                >
                  取消
                </button>
                <button type="submit" className="desktop-primary-command">
                  创建
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
