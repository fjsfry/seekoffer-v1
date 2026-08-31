'use client';

import {
  Add20Regular,
  AppsList20Regular,
  ArrowLeft20Regular,
  ArrowRight20Regular,
  Briefcase20Regular,
  Calendar20Regular,
  Calendar24Regular,
  Checkmark20Regular,
  CheckmarkCircle20Regular,
  ChevronDown20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  ChevronUp20Regular,
  ClipboardTask20Regular,
  Delete20Regular,
  Document20Regular,
  Filter20Regular,
  Grid20Regular,
  HatGraduation20Regular,
  Home20Regular,
  List20Regular,
  Lightbulb20Regular,
  Search20Regular
} from '@fluentui/react-icons';
import {
  useEffect,
  useMemo,
  useRef,
  useId,
  useState,
  type ComponentType,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject
} from 'react';
import { DesktopConfirmDialog } from '@/components/desktop-confirm-dialog';
import {
  DesktopWorkspaceStatus,
  type DesktopWorkspaceSyncStatus
} from '@/components/desktop-workspace-status';
import {
  WORKBENCH_TODO_CATEGORIES,
  WORKBENCH_TODO_PRIORITIES,
  normalizeWorkbenchTodoCategory,
  normalizeWorkbenchTodoPriority,
  type WorkbenchCustomTodo,
  type WorkbenchTodoCategory,
  type WorkbenchTodoPriority
} from '@/lib/workbench-state';
import { writeSessionStorageValue } from '@/lib/safe-session-storage';
import { DESKTOP_NEW_SCHEDULE_EVENT } from '@/lib/desktop-route-events';
import styles from './desktop-workspace.module.css';

const isDesktopSurface = process.env.NEXT_PUBLIC_SEEKOFFER_SURFACE === 'desktop';

export type ScheduleTypeFilter = '全部' | '申请截止' | '材料准备' | '套磁' | '笔试' | '面试' | '其他';
export type ScheduleDoneFilter = '全部' | '未完成' | '已完成';
export type ScheduleCategory = WorkbenchTodoCategory;
export type ScheduleCategoryFilter = '全部' | ScheduleCategory;
export type SchedulePriority = WorkbenchTodoPriority;
export type SchedulePriorityFilter = '全部' | SchedulePriority;
type ScheduleViewMode = 'list' | 'quadrant';
type ScheduleSubmitState = 'idle' | 'saving' | 'success' | 'error';
type UndoNotice = {
  id: number;
  message: string;
  undo: () => void;
  returnFocus: () => void;
};

export const SCHEDULE_TYPE_FILTERS: ScheduleTypeFilter[] = ['全部', '申请截止', '材料准备', '套磁', '笔试', '面试', '其他'];
export const MANUAL_SCHEDULE_TYPES = SCHEDULE_TYPE_FILTERS.filter(
  (item): item is Exclude<ScheduleTypeFilter, '全部'> => item !== '全部'
);
export const SCHEDULE_DONE_FILTERS: ScheduleDoneFilter[] = ['全部', '未完成', '已完成'];
export const SCHEDULE_CATEGORIES: ScheduleCategory[] = [...WORKBENCH_TODO_CATEGORIES];
export const SCHEDULE_PRIORITIES: SchedulePriority[] = [...WORKBENCH_TODO_PRIORITIES];

const CATEGORY_META: Record<ScheduleCategory, {
  Icon: ComponentType<{ 'aria-hidden'?: boolean }>;
  shortLabel: string;
}> = {
  '申请': { Icon: ClipboardTask20Regular, shortLabel: '申请' },
  '学习': { Icon: HatGraduation20Regular, shortLabel: '学习' },
  '作业': { Icon: Document20Regular, shortLabel: '作业' },
  '工作': { Icon: Briefcase20Regular, shortLabel: '工作' },
  '生活': { Icon: Home20Regular, shortLabel: '生活' },
  '其他': { Icon: AppsList20Regular, shortLabel: '其他' }
};

const PRIORITY_META: Record<SchedulePriority, { numeral: string; shortLabel: string }> = {
  '重要且紧急': { numeral: 'I', shortLabel: '重要且紧急' },
  '重要不紧急': { numeral: 'II', shortLabel: '重要不紧急' },
  '不重要紧急': { numeral: 'III', shortLabel: '不重要紧急' },
  '不重要不紧急': { numeral: 'IV', shortLabel: '不重要不紧急' }
};

export type DesktopScheduleItem = {
  id: string;
  title: string;
  detail: string;
  date?: string;
  dateLabel: string;
  type: Exclude<ScheduleTypeFilter, '全部'>;
  category: ScheduleCategory;
  priority: SchedulePriority;
  done: boolean;
  href?: string;
};

export function normalizeScheduleType(value?: string): Exclude<ScheduleTypeFilter, '全部'> {
  return MANUAL_SCHEDULE_TYPES.includes(value as Exclude<ScheduleTypeFilter, '全部'>)
    ? (value as Exclude<ScheduleTypeFilter, '全部'>)
    : '其他';
}

export function normalizeScheduleCategory(value?: string): ScheduleCategory {
  return normalizeWorkbenchTodoCategory(value);
}

export function normalizeSchedulePriority(value?: string): SchedulePriority {
  return normalizeWorkbenchTodoPriority(value);
}

export function getSchedulePriorityRank(value?: string) {
  return Math.max(0, SCHEDULE_PRIORITIES.indexOf(normalizeSchedulePriority(value)));
}

function getTodayDateString() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getMonthKey(dateString = getTodayDateString()) {
  return dateString.slice(0, 7);
}

function shiftMonth(monthKey: string, offset: number) {
  const [year, month] = monthKey.split('-').map(Number);
  const next = new Date(year, month - 1 + offset, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthTitle(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return `${year}年${month}月`;
}

function formatDateTitle(date?: string) {
  if (!date) return '待安排';
  const [, month, day] = date.split('-');
  return `${Number(month)}月${Number(day)}日`;
}

function getDateValue(date?: string) {
  if (!date) return Number.MAX_SAFE_INTEGER;
  const timestamp = Date.parse(`${date}T00:00:00+08:00`);
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function getRelativeLabel(date?: string, today = getTodayDateString()) {
  if (!date) return '待安排';
  const dayDiff = Math.round((getDateValue(date) - getDateValue(today)) / 86_400_000);
  if (dayDiff === 0) return '今天';
  if (dayDiff === 1) return '明天';
  if (dayDiff === -1) return '昨天';
  if (dayDiff > 1) return `${dayDiff}天后`;
  return `逾期${Math.abs(dayDiff)}天`;
}

function getScheduleGroupLabel(dateKey: string, today: string) {
  if (dateKey === 'unplanned') return '待安排';
  const relative = getRelativeLabel(dateKey, today);
  if (relative === '今天' || relative === '明天' || relative === '昨天') return relative;
  return formatDateTitle(dateKey);
}

function toggleAnchoredPopover(
  trigger: HTMLElement,
  surface: HTMLElement,
  preferredWidth: number,
  estimatedHeight: number
) {
  if (surface.matches(':popover-open')) {
    surface.hidePopover();
    return;
  }
  const rect = trigger.getBoundingClientRect();
  const gutter = 12;
  const width = Math.min(preferredWidth, window.innerWidth - gutter * 2);
  const left = Math.max(gutter, Math.min(rect.left, window.innerWidth - width - gutter));
  const below = rect.bottom + 6;
  const top = below + estimatedHeight <= window.innerHeight - gutter
    ? below
    : Math.max(gutter, rect.top - estimatedHeight - 6);
  surface.style.setProperty('--schedule-popover-left', `${left}px`);
  surface.style.setProperty('--schedule-popover-top', `${top}px`);
  surface.style.setProperty('--schedule-popover-width', `${width}px`);
  surface.showPopover();
}

function closePopover(surface: HTMLElement | null, returnFocus?: HTMLElement | null) {
  if (surface?.matches(':popover-open')) surface.hidePopover();
  window.requestAnimationFrame(() => returnFocus?.focus());
}

function useDismissPopoverOnViewportChange(surfaceRef: RefObject<HTMLElement | null>, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const dismiss = (event?: Event) => {
      if (event?.type === 'scroll' && event.target instanceof Node && surfaceRef.current?.contains(event.target)) return;
      if (surfaceRef.current?.matches(':popover-open')) surfaceRef.current.hidePopover();
    };
    document.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      document.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [open, surfaceRef]);
}

type ScheduleContext = {
  selectedId?: string;
  selectedDate?: string;
  calendarMonth?: string;
  keyword?: string;
  typeFilter?: ScheduleTypeFilter;
  doneFilter?: ScheduleDoneFilter;
  categoryFilter?: ScheduleCategoryFilter;
  priorityFilter?: SchedulePriorityFilter;
  viewMode?: ScheduleViewMode;
  scrollTop?: number;
};

function readContext(storageKey: string): ScheduleContext {
  try {
    const value = window.sessionStorage.getItem(storageKey);
    return value ? JSON.parse(value) as ScheduleContext : {};
  } catch {
    return {};
  }
}

function isWorkspaceEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

export function DesktopScheduleWorkspace({
  items,
  allItems,
  totalCount,
  typeFilter,
  doneFilter,
  keyword,
  onTypeFilterChange,
  onDoneFilterChange,
  onKeywordChange,
  calendarMonth,
  onCalendarMonthChange,
  onCreateTodo,
  onUpdateTodo,
  onDeleteTodo,
  onDoneChange,
  onClearCompleted,
  syncStatus,
  lastSyncedAt,
  onRetrySync,
  contextOwner
}: {
  items: DesktopScheduleItem[];
  allItems: DesktopScheduleItem[];
  totalCount: number;
  typeFilter: ScheduleTypeFilter;
  doneFilter: ScheduleDoneFilter;
  keyword: string;
  onTypeFilterChange: (value: ScheduleTypeFilter) => void;
  onDoneFilterChange: (value: ScheduleDoneFilter) => void;
  onKeywordChange: (value: string) => void;
  calendarMonth: string;
  onCalendarMonthChange: (value: string) => void;
  onCreateTodo: (payload: Pick<WorkbenchCustomTodo, 'text'> & Partial<Omit<WorkbenchCustomTodo, 'id' | 'text'>>) => string;
  onUpdateTodo: (id: string, patch: Partial<Omit<WorkbenchCustomTodo, 'id'>>) => void;
  onDeleteTodo: (id: string) => void;
  onDoneChange: (id: string, done: boolean) => void;
  onClearCompleted: () => void;
  syncStatus: DesktopWorkspaceSyncStatus;
  lastSyncedAt?: string;
  onRetrySync: () => void;
  contextOwner: string;
}) {
  const today = getTodayDateString();
  const contextKey = `seekoffer:desktop:schedule-context:v2:${encodeURIComponent(contextOwner)}`;
  const listRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const restoredRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const detailReturnFocusRef = useRef<HTMLElement | null>(null);
  const headerCreateButtonRef = useRef<HTMLButtonElement>(null);
  const undoTimerRef = useRef<number | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<'completed' | string>('');
  const [categoryFilter, setCategoryFilter] = useState<ScheduleCategoryFilter>('全部');
  const [priorityFilter, setPriorityFilter] = useState<SchedulePriorityFilter>('全部');
  const [viewMode, setViewMode] = useState<ScheduleViewMode>('list');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [undoNotice, setUndoNotice] = useState<UndoNotice | null>(null);
  const [recentItemId, setRecentItemId] = useState('');
  const effectiveViewMode: ScheduleViewMode = isDesktopSurface ? viewMode : 'list';

  const selectedItem = useMemo(
    () => allItems.find((item) => item.id === selectedId) || null,
    [allItems, selectedId]
  );
  const visibleItems = useMemo(
    () => items.filter((item) => {
      if (!isDesktopSurface) return true;
      if (categoryFilter !== '全部' && item.category !== categoryFilter) return false;
      if (priorityFilter !== '全部' && item.priority !== priorityFilter) return false;
      return true;
    }),
    [categoryFilter, items, priorityFilter]
  );
  const groupedItems = useMemo(() => {
    const groups = new Map<string, DesktopScheduleItem[]>();
    for (const item of visibleItems) {
      const key = item.date || 'unplanned';
      groups.set(key, [...(groups.get(key) || []), item]);
    }
    return [...groups.entries()].sort(([left], [right]) => {
      if (left === 'unplanned') return 1;
      if (right === 'unplanned') return -1;
      return left.localeCompare(right);
    });
  }, [visibleItems]);
  const selectedDayItems = useMemo(
    () => allItems.filter((item) => (selectedDate ? item.date === selectedDate : !item.date)),
    [allItems, selectedDate]
  );

  useEffect(() => {
    if (!undoNotice) return;
    const handleUndoShortcut = (event: globalThis.KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.shiftKey ||
        event.key.toLowerCase() !== 'z' ||
        isWorkspaceEditableTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      undoNotice.undo();
      setUndoNotice(null);
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
      window.requestAnimationFrame(undoNotice.returnFocus);
    };
    window.addEventListener('keydown', handleUndoShortcut, true);
    return () => window.removeEventListener('keydown', handleUndoShortcut, true);
  }, [undoNotice]);
  const monthCount = visibleItems.filter((item) => item.date?.startsWith(calendarMonth)).length;
  const unfinishedCount = allItems.filter((item) => !item.done).length;
  const unplannedCount = allItems.filter((item) => !item.done && !item.date).length;
  const todaySummaryItems = allItems.filter((item) => !item.done && item.date === today);
  const unplannedSummaryItems = allItems.filter((item) => !item.done && !item.date);
  const activeFilterCount = [
    keyword.trim(),
    typeFilter !== '全部',
    doneFilter !== '全部',
    isDesktopSurface && categoryFilter !== '全部',
    isDesktopSurface && priorityFilter !== '全部'
  ].filter(Boolean).length;
  const advancedFilterCount = [typeFilter !== '全部', doneFilter !== '全部', priorityFilter !== '全部'].filter(Boolean).length;

  useEffect(() => {
    restoredRef.current = false;
    const context = readContext(contextKey);
    onKeywordChange(context.keyword || '');
    onTypeFilterChange(context.typeFilter && SCHEDULE_TYPE_FILTERS.includes(context.typeFilter) ? context.typeFilter : '全部');
    onDoneFilterChange(context.doneFilter && SCHEDULE_DONE_FILTERS.includes(context.doneFilter) ? context.doneFilter : '全部');
    setCategoryFilter(context.categoryFilter && ['全部', ...SCHEDULE_CATEGORIES].includes(context.categoryFilter) ? context.categoryFilter : '全部');
    setPriorityFilter(context.priorityFilter && ['全部', ...SCHEDULE_PRIORITIES].includes(context.priorityFilter) ? context.priorityFilter : '全部');
    setViewMode(context.viewMode === 'quadrant' ? 'quadrant' : 'list');
    onCalendarMonthChange(context.calendarMonth || getMonthKey(today));
    setSelectedDate(context.selectedDate ?? today);
    setSelectedId(context.selectedId || '');
    setDetailOpen(false);
    setCreateMode(false);
    const restoreFrame = window.requestAnimationFrame(() => {
      scrollTopRef.current = Number.isFinite(context.scrollTop) ? context.scrollTop || 0 : 0;
      if (listRef.current) listRef.current.scrollTop = scrollTopRef.current;
      restoredRef.current = true;
    });
    return () => window.cancelAnimationFrame(restoreFrame);
  // Context is restored once per signed-in owner. The page owns the controlled filters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey]);

  useEffect(() => {
    if (!restoredRef.current) return;
    const context: ScheduleContext = {
      selectedId,
      selectedDate,
      calendarMonth,
      keyword,
      typeFilter,
      doneFilter,
      categoryFilter,
      priorityFilter,
      viewMode,
      scrollTop: scrollTopRef.current
    };
    writeSessionStorageValue(contextKey, JSON.stringify(context));
  }, [calendarMonth, categoryFilter, contextKey, doneFilter, keyword, priorityFilter, selectedDate, selectedId, typeFilter, viewMode]);

  useEffect(() => () => {
    if (!restoredRef.current) return;
    const current = readContext(contextKey);
    writeSessionStorageValue(contextKey, JSON.stringify({ ...current, scrollTop: scrollTopRef.current }));
  }, [contextKey]);

  useEffect(() => () => {
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
    if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current);
  }, []);

  useEffect(() => {
    if (selectedId && !selectedItem) setSelectedId('');
  }, [selectedId, selectedItem]);

  function persistScrollContext() {
    scrollTopRef.current = listRef.current?.scrollTop || 0;
  }

  function highlightItem(id: string) {
    setRecentItemId(id);
    if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => setRecentItemId(''), 1400);
  }

  function showUndoNotice(message: string, undo: () => void, returnFocus: () => void) {
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
    setUndoNotice({ id: Date.now(), message, undo, returnFocus });
    undoTimerRef.current = window.setTimeout(() => setUndoNotice(null), 8000);
  }

  function toggleItemDone(item: DesktopScheduleItem, trigger: HTMLElement) {
    const nextDone = !item.done;
    const itemIndex = visibleItems.findIndex((candidate) => candidate.id === item.id);
    const fallbackItem = visibleItems[itemIndex + 1] || visibleItems[itemIndex - 1];
    const leavesCurrentFilter = (doneFilter === '未完成' && nextDone) || (doneFilter === '已完成' && !nextDone);
    onDoneChange(item.id, nextDone);
    highlightItem(item.id);
    if (leavesCurrentFilter) {
      window.requestAnimationFrame(() => {
        if (fallbackItem) rowRefs.current.get(fallbackItem.id)?.focus({ preventScroll: true });
        else headerCreateButtonRef.current?.focus({ preventScroll: true });
      });
    }
    showUndoNotice(
      nextDone ? `已完成“${item.title}”` : `已恢复“${item.title}”`,
      () => {
        onDoneChange(item.id, item.done);
        highlightItem(item.id);
      },
      () => {
        const row = rowRefs.current.get(item.id);
        const action = row?.querySelector<HTMLElement>('[data-schedule-completion-action]');
        (action || row || trigger).focus({ preventScroll: true });
      }
    );
  }

  function openItem(item: DesktopScheduleItem, focusDetail = false) {
    detailReturnFocusRef.current = rowRefs.current.get(item.id) || document.activeElement as HTMLElement | null;
    setSelectedId(item.id);
    setSelectedDate(item.date || '');
    if (item.date) onCalendarMonthChange(getMonthKey(item.date));
    setCreateMode(false);
    setDetailOpen(true);
    if (focusDetail) {
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-schedule-detail-primary]')?.focus());
    }
  }

  function startCreate(trigger?: HTMLElement | null) {
    const activeElement = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : null;
    detailReturnFocusRef.current = trigger || activeElement || headerCreateButtonRef.current;
    setSelectedId('');
    setCreateMode(true);
    setDetailOpen(true);
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-schedule-create-title]')?.focus());
  }

  function closeDetail() {
    const returnTarget = selectedId
      ? rowRefs.current.get(selectedId) || detailReturnFocusRef.current
      : detailReturnFocusRef.current || headerCreateButtonRef.current;
    setDetailOpen(false);
    setCreateMode(false);
    window.requestAnimationFrame(() => returnTarget?.focus());
  }

  function toggleScheduleGroup(dateKey: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  }

  function openScheduleOverview(date: string, trigger: HTMLElement) {
    detailReturnFocusRef.current = trigger;
    setSelectedId('');
    setSelectedDate(date);
    if (date) onCalendarMonthChange(getMonthKey(date));
    setCreateMode(false);
    setDetailOpen(true);
  }

  function resetScheduleFilters() {
    onKeywordChange('');
    onTypeFilterChange('全部');
    onDoneFilterChange('全部');
    setCategoryFilter('全部');
    setPriorityFilter('全部');
  }

  function returnToToday() {
    onCalendarMonthChange(getMonthKey(today));
    setSelectedDate(today);
  }

  useEffect(() => {
    const handleCreateRequest = () => {
      detailReturnFocusRef.current = headerCreateButtonRef.current;
      setSelectedId('');
      setCreateMode(true);
      setDetailOpen(true);
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-schedule-create-title]')?.focus());
    };
    window.addEventListener(DESKTOP_NEW_SCHEDULE_EVENT, handleCreateRequest);
    return () => window.removeEventListener(DESKTOP_NEW_SCHEDULE_EVENT, handleCreateRequest);
  }, []);

  function moveSelection(currentId: string, direction: 1 | -1) {
    const index = visibleItems.findIndex((item) => item.id === currentId);
    const next = visibleItems[Math.min(visibleItems.length - 1, Math.max(0, index + direction))];
    if (!next) return;
    openItem(next);
    window.requestAnimationFrame(() => rowRefs.current.get(next.id)?.focus({ preventScroll: false }));
  }

  function handleWorkspaceKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === 'n' &&
      !isWorkspaceEditableTarget(event.target)
    ) {
      event.preventDefault();
      startCreate();
      return;
    }
    if (event.key === 'Escape' && detailOpen) {
      if (event.defaultPrevented) return;
      event.preventDefault();
      closeDetail();
    }
  }

  const confirmDescription = pendingDelete === 'completed'
    ? '已完成事项会作为删除记录同步到其他设备，避免旧数据再次出现。'
    : '删除后会保留墓碑并同步到其他设备，当前没有恢复入口。';
  const detailHeaderTitle = createMode
    ? '新建日程'
    : selectedItem?.title || (selectedDate ? formatDateTitle(selectedDate) : '待安排事项');
  const detailHeaderSubtitle = createMode
    ? selectedDate ? `${formatDateTitle(selectedDate)} · ${getRelativeLabel(selectedDate, today)}` : '待安排'
    : selectedItem
      ? `${selectedItem.dateLabel} · ${selectedItem.type} · ${PRIORITY_META[selectedItem.priority].numeral}`
      : selectedDate
        ? `${getRelativeLabel(selectedDate, today)} · ${selectedDayItems.length} 项`
        : `${unplannedCount} 项尚未安排日期`;

  return (
    <section
      id="schedule-board"
      aria-labelledby="schedule-page-title"
      className={`${styles.page} ${isDesktopSurface ? styles.schedulePage : ''} desktop-core-page desktop-core-page--fixed`}
      onKeyDown={handleWorkspaceKeyDown}
    >
      <header className={`${styles.pageHeader} desktop-core-page-header desktop-page-header desktop-page-header--workspace`}>
        <div className={`${styles.pageHeading} desktop-page-header-copy`}>
          <div className="desktop-page-header-title-row">
            <h1 id="schedule-page-title" className={`${styles.pageTitle} desktop-page-header-title`}>日程与提醒</h1>
          </div>
          <p className={`${styles.pageSummary} desktop-page-header-subtitle`}>
            未完成 {unfinishedCount} 项 · 待安排 {unplannedCount} 项
          </p>
        </div>
        <div className={`${styles.headerActions} desktop-page-header-actions`}>
          <DesktopWorkspaceStatus status={syncStatus} lastSyncedAt={lastSyncedAt} onRetry={onRetrySync} />
          <button
            ref={headerCreateButtonRef}
            type="button"
            className={`${styles.primaryButton} desktop-page-primary-action`}
            onClick={(event) => startCreate(event.currentTarget)}
            title="新建日程（Ctrl+N）"
          >
            <Add20Regular aria-hidden="true" />
            新建日程
          </button>
        </div>
      </header>

      <div
        className={styles.workspace}
        data-detail-open={detailOpen ? 'true' : 'false'}
        data-view-mode={effectiveViewMode}
      >
        <aside className={styles.masterPane} aria-label="日程列表">
          <div className={styles.masterToolbar}>
            <div className={isDesktopSurface ? styles.scheduleToolbarTop : undefined}>
              <div className={styles.monthToolbar}>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="上个月"
                  onClick={() => {
                    const next = shiftMonth(calendarMonth, -1);
                    onCalendarMonthChange(next);
                    setSelectedDate(`${next}-01`);
                  }}
                >
                  <ChevronLeft20Regular aria-hidden="true" />
                </button>
                <span className={styles.monthTitle}>{formatMonthTitle(calendarMonth)} · {monthCount} 项</span>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="下个月"
                  onClick={() => {
                    const next = shiftMonth(calendarMonth, 1);
                    onCalendarMonthChange(next);
                    setSelectedDate(`${next}-01`);
                  }}
                >
                  <ChevronRight20Regular aria-hidden="true" />
                </button>
                {isDesktopSurface ? (
                  <button
                    type="button"
                    className={styles.todayButton}
                    onClick={() => {
                      onCalendarMonthChange(getMonthKey(today));
                      setSelectedDate(today);
                    }}
                  >
                    今天
                  </button>
                ) : null}
              </div>

              {isDesktopSurface ? <div className={styles.viewToggle} role="group" aria-label="日程视图">
                <button type="button" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}>
                  <List20Regular aria-hidden="true" />
                  <span>列表</span>
                </button>
                <button type="button" aria-pressed={viewMode === 'quadrant'} onClick={() => setViewMode('quadrant')}>
                  <Grid20Regular aria-hidden="true" />
                  <span>四象限</span>
                </button>
              </div> : null}
            </div>

            <label className={styles.searchBox}>
              <Search20Regular aria-hidden="true" />
              <span className={styles.visuallyHidden}>搜索日程</span>
              <input
                className={styles.searchInput}
                value={keyword}
                onChange={(event) => onKeywordChange(event.target.value)}
                maxLength={160}
                placeholder="搜索标题、备注或日期"
              />
            </label>

            {isDesktopSurface ? <div className={styles.categoryFilterBar} role="group" aria-label="按场景分类筛选">
              <button
                type="button"
                className={styles.categoryFilterButton}
                aria-pressed={categoryFilter === '全部'}
                onClick={() => setCategoryFilter('全部')}
              >
                全部
              </button>
              {SCHEDULE_CATEGORIES.map((category) => {
                const Icon = CATEGORY_META[category].Icon;
                return (
                  <button
                    key={category}
                    type="button"
                    className={styles.categoryFilterButton}
                    data-category={category}
                    aria-pressed={categoryFilter === category}
                    onClick={() => setCategoryFilter(category)}
                  >
                    <Icon aria-hidden={true} />
                    {category}
                  </button>
                );
              })}
            </div> : null}

            {isDesktopSurface ? (
              <ScheduleAdvancedFilters
                typeFilter={typeFilter}
                doneFilter={doneFilter}
                priorityFilter={priorityFilter}
                activeCount={advancedFilterCount}
                onTypeChange={onTypeFilterChange}
                onDoneChange={onDoneFilterChange}
                onPriorityChange={setPriorityFilter}
              />
            ) : (
              <div className={styles.filterGrid}>
                <select
                  className={styles.fieldControl}
                  value={typeFilter}
                  aria-label="日程类型"
                  onChange={(event) => onTypeFilterChange(event.target.value as ScheduleTypeFilter)}
                >
                  {SCHEDULE_TYPE_FILTERS.map((item) => <option key={item} value={item}>{item === '全部' ? '全部类型' : item}</option>)}
                </select>
                <select
                  className={styles.fieldControl}
                  value={doneFilter}
                  aria-label="完成状态"
                  onChange={(event) => onDoneFilterChange(event.target.value as ScheduleDoneFilter)}
                >
                  {SCHEDULE_DONE_FILTERS.map((item) => <option key={item} value={item}>{item === '全部' ? '全部状态' : item}</option>)}
                </select>
              </div>
            )}

            {!isDesktopSurface && (activeFilterCount || calendarMonth !== getMonthKey(today)) ? (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  onKeywordChange('');
                  onTypeFilterChange('全部');
                  onDoneFilterChange('全部');
                  setCategoryFilter('全部');
                  setPriorityFilter('全部');
                  onCalendarMonthChange(getMonthKey(today));
                  setSelectedDate(today);
                }}
              >
                清空筛选并回到今天
              </button>
            ) : null}
          </div>

          <div className={styles.scheduleContentGrid} data-view-mode={effectiveViewMode}>
            <div
              ref={listRef}
              className={`${styles.masterScroll} desktop-schedule-list`}
              role="list"
              aria-label="日程事项"
              onScroll={persistScrollContext}
            >
            {effectiveViewMode === 'quadrant' ? (
              <ScheduleQuadrantBoard
                items={visibleItems}
                selectedId={selectedId}
                today={today}
                onOpen={openItem}
                registerRow={(id, node) => {
                  if (node) rowRefs.current.set(id, node);
                  else rowRefs.current.delete(id);
                }}
              />
            ) : groupedItems.length ? groupedItems.map(([dateKey, group]) => (
              <section
                key={dateKey}
                role="group"
                aria-label={dateKey === 'unplanned' ? '待安排' : formatDateTitle(dateKey)}
                data-collapsed={collapsedGroups.has(dateKey) ? 'true' : 'false'}
              >
                <button
                  type="button"
                  className={styles.listGroupTitle}
                  aria-expanded={!collapsedGroups.has(dateKey)}
                  aria-controls={`schedule-group-${dateKey}`}
                  onClick={() => toggleScheduleGroup(dateKey)}
                >
                  <span>
                    <strong>{getScheduleGroupLabel(dateKey, today)}</strong>
                    <small>{dateKey === 'unplanned' ? '尚未设置日期' : formatDateTitle(dateKey)}</small>
                  </span>
                  <span>
                    <small>{group.length} 项</small>
                    {collapsedGroups.has(dateKey) ? (
                      <ChevronDown20Regular aria-hidden="true" />
                    ) : (
                      <ChevronUp20Regular aria-hidden="true" />
                    )}
                  </span>
                </button>
                {!collapsedGroups.has(dateKey) ? (
                  <div id={`schedule-group-${dateKey}`} className={styles.scheduleGroupRows}>
                    {group.map((item) => (
                  <div
                    key={item.id}
                    ref={(node) => {
                      if (node) rowRefs.current.set(item.id, node);
                      else rowRefs.current.delete(item.id);
                    }}
                    role="listitem"
                    aria-label={`${item.title}，${item.category}，${item.type}，${item.done ? '已完成' : PRIORITY_META[item.priority].shortLabel}，${item.dateLabel}`}
                    aria-current={selectedId === item.id ? 'true' : undefined}
                    aria-controls="schedule-detail-pane"
                    tabIndex={selectedId === item.id || (!selectedId && visibleItems[0]?.id === item.id) ? 0 : -1}
                    className={`${styles.listRow} ${isDesktopSurface ? styles.scheduleListRow : ''} ${selectedId === item.id ? styles.listRowSelected : ''} ${item.done ? styles.listRowDone : ''}`}
                    data-category={item.category}
                    data-priority={item.priority}
                    data-recent-action={recentItemId === item.id ? 'true' : undefined}
                    onClick={() => openItem(item)}
                    onDoubleClick={() => openItem(item, true)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        moveSelection(item.id, event.key === 'ArrowDown' ? 1 : -1);
                      } else if (event.key === 'Enter') {
                        event.preventDefault();
                        openItem(item, true);
                      } else if (event.key === ' ') {
                        event.preventDefault();
                        toggleItemDone(item, event.currentTarget);
                      } else if (event.key === 'Delete') {
                        event.preventDefault();
                        returnFocusRef.current = event.currentTarget;
                        setPendingDelete(item.id);
                      }
                    }}
                  >
                    <span className={styles.rowIcon} data-category={item.category}>
                      {item.done ? <CheckmarkCircle20Regular aria-hidden="true" /> : isDesktopSurface ? <ScheduleCategoryIcon category={item.category} /> : <Calendar20Regular aria-hidden="true" />}
                    </span>
                    {isDesktopSurface ? (
                      <span className={styles.scheduleRowWhen}>
                        <strong>{item.date ? '全天' : '待安排'}</strong>
                        <small>{item.date ? getRelativeLabel(item.date, today) : '暂未排期'}</small>
                      </span>
                    ) : null}
                    <span className={styles.rowBody}>
                      <span className={styles.scheduleRowTitleLine}>
                        <span className={styles.rowTitle}>{item.title}</span>
                        {isDesktopSurface ? (
                          <>
                            <span className={styles.scheduleCategoryTag} data-category={item.category}>{item.category}</span>
                            <span className={styles.scheduleTypeTag}>{item.type}</span>
                          </>
                        ) : null}
                      </span>
                      <span className={styles.rowMeta}>{isDesktopSurface ? item.detail : `${item.type} · ${item.detail}`}</span>
                    </span>
                    <span className={styles.rowEnd}>
                      {isDesktopSurface ? (
                        <span
                          className={item.done ? styles.neutralPill : styles.priorityPill}
                          data-priority={item.priority}
                        >
                          {item.done ? '已完成' : PRIORITY_META[item.priority].shortLabel}
                        </span>
                      ) : <span className={item.done ? styles.neutralPill : styles.statusPill}>{item.done ? '已完成' : '未完成'}</span>}
                      <span className={styles.rowDate}>
                        <Calendar20Regular aria-hidden="true" />
                        {item.dateLabel}
                      </span>
                      {isDesktopSurface ? (
                        <button
                          type="button"
                          className={styles.inlineQuickAction}
                          data-schedule-completion-action
                          aria-label={`${item.done ? '恢复' : '完成'}：${item.title}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleItemDone(item, event.currentTarget);
                          }}
                          onDoubleClick={(event) => event.stopPropagation()}
                        >
                          {item.done ? '恢复' : '完成'}
                        </button>
                      ) : null}
                    </span>
                  </div>
                    ))}
                  </div>
                ) : null}
              </section>
            )) : (
              <EmptySchedule
                filtered={totalCount > 0 || activeFilterCount > 0}
                onCreate={() => startCreate()}
                onReset={() => {
                  onKeywordChange('');
                  onTypeFilterChange('全部');
                  onDoneFilterChange('全部');
                  setCategoryFilter('全部');
                  setPriorityFilter('全部');
                }}
              />
            )}
            </div>

            {isDesktopSurface && effectiveViewMode === 'list' ? (
              <aside className={styles.scheduleSummaryRail} aria-label="日程概览与快捷操作">
                <section className={styles.scheduleSummaryCard}>
                  <header className={styles.scheduleSummaryHeader}>
                    <strong>今日安排</strong>
                    <span>{todaySummaryItems.length} 项</span>
                  </header>
                  <div className={styles.scheduleSummaryList}>
                    {todaySummaryItems.length ? todaySummaryItems.slice(0, 3).map((item) => (
                      <button key={item.id} type="button" onClick={() => openItem(item, true)}>
                        <span className={styles.scheduleSummaryIcon} data-category={item.category}>
                          <ScheduleCategoryIcon category={item.category} />
                        </span>
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.category} · {item.type}</small>
                        </span>
                        <span className={styles.scheduleSummaryPriority} data-priority={item.priority}>
                          {PRIORITY_META[item.priority].shortLabel}
                        </span>
                      </button>
                    )) : (
                      <p className={styles.scheduleSummaryEmpty}>今天暂时没有未完成事项</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className={styles.scheduleSummaryFooter}
                    onClick={(event) => openScheduleOverview(today, event.currentTarget)}
                  >
                    查看今日安排
                    <ArrowRight20Regular aria-hidden="true" />
                  </button>
                </section>

                <section className={styles.scheduleSummaryCard}>
                  <header className={styles.scheduleSummaryHeader}>
                    <strong>待安排</strong>
                    <span>{unplannedSummaryItems.length} 项</span>
                  </header>
                  <div className={styles.scheduleSummaryList}>
                    {unplannedSummaryItems.length ? unplannedSummaryItems.slice(0, 3).map((item) => (
                      <button key={item.id} type="button" onClick={() => openItem(item, true)}>
                        <span className={styles.scheduleSummaryIcon} data-category={item.category}>
                          <ScheduleCategoryIcon category={item.category} />
                        </span>
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.category} · {item.type}</small>
                        </span>
                        <span className={styles.scheduleSummaryState}>待安排</span>
                      </button>
                    )) : (
                      <p className={styles.scheduleSummaryEmpty}>所有未完成事项都已经安排日期</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className={styles.scheduleSummaryFooter}
                    onClick={(event) => openScheduleOverview('', event.currentTarget)}
                  >
                    查看全部待安排
                    <ArrowRight20Regular aria-hidden="true" />
                  </button>
                </section>

                <section className={`${styles.scheduleSummaryCard} ${styles.scheduleQuickActionsCard}`}>
                  <header className={styles.scheduleSummaryHeader}>
                    <strong>快捷操作</strong>
                  </header>
                  <div className={styles.scheduleQuickActions}>
                    <button type="button" onClick={(event) => startCreate(event.currentTarget)}>
                      <span data-tone="brand"><Add20Regular aria-hidden="true" /></span>
                      新建日程
                    </button>
                    <button type="button" onClick={returnToToday}>
                      <span data-tone="blue"><Calendar20Regular aria-hidden="true" /></span>
                      回到今天
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        resetScheduleFilters();
                        onDoneFilterChange('未完成');
                      }}
                    >
                      <span data-tone="violet"><CheckmarkCircle20Regular aria-hidden="true" /></span>
                      只看未完成
                    </button>
                    <button type="button" onClick={resetScheduleFilters}>
                      <span data-tone="orange"><Filter20Regular aria-hidden="true" /></span>
                      清空筛选
                    </button>
                  </div>
                </section>

                <section className={`${styles.scheduleSummaryCard} ${styles.scheduleTipCard}`}>
                  <Lightbulb20Regular aria-hidden="true" />
                  <div>
                    <strong>小贴士</strong>
                    <p>点击事项可查看详情，聚焦事项后按空格可以快速完成或恢复。</p>
                  </div>
                </section>
              </aside>
            ) : null}
          </div>
        </aside>

        <section
          id="schedule-detail-pane"
          className={styles.detailPane}
          aria-label="日程详情"
          aria-hidden={isDesktopSurface ? !detailOpen : undefined}
          inert={isDesktopSurface && !detailOpen ? true : undefined}
        >
          <div className={styles.detailHeader}>
            <button
              type="button"
              className={styles.backButton}
              aria-label="关闭日程详情并返回列表"
              onClick={closeDetail}
            >
              <ArrowLeft20Regular aria-hidden="true" />
              <span>返回列表</span>
            </button>
            <div className={styles.detailHeading}>
              <h2 className={styles.detailTitle}>{detailHeaderTitle}</h2>
              <p className={styles.detailSubtitle}>{detailHeaderSubtitle}</p>
            </div>
            {!isDesktopSurface ? <button type="button" className={styles.secondaryButton} onClick={(event) => startCreate(event.currentTarget)}>
              <Add20Regular aria-hidden="true" />
              添加到这天
            </button> : null}
          </div>

          <div className={styles.detailScroll}>
            {!isDesktopSurface || !createMode ? <section className={styles.detailSection}>
              <div className={styles.sectionHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>当天事项</h3>
                  <p className={styles.visuallyHidden}>选择一项后在下方编辑；空格键可以快速切换完成状态。</p>
                </div>
              </div>
              {selectedDayItems.length ? (
                <div className={styles.dayItems}>
                  {selectedDayItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`${styles.dayItem} ${isDesktopSurface ? styles.scheduleDayItem : ''} ${selectedId === item.id ? styles.dayItemSelected : ''}`}
                      data-category={item.category}
                      data-priority={item.priority}
                      aria-controls="schedule-detail-pane"
                      aria-expanded={isDesktopSurface ? detailOpen && selectedId === item.id : undefined}
                      onClick={() => openItem(item)}
                    >
                      <span className={styles.rowIcon} data-category={item.category}>
                        {item.done ? <Checkmark20Regular aria-hidden="true" /> : isDesktopSurface ? <ScheduleCategoryIcon category={item.category} /> : <Calendar20Regular aria-hidden="true" />}
                      </span>
                      <span className={styles.rowBody}>
                        <span className={styles.rowTitle}>{item.title}</span>
                        <span className={styles.rowMeta}>{isDesktopSurface ? `${item.category} · ${item.type} · ${item.detail}` : `${item.type} · ${item.detail}`}</span>
                      </span>
                      {isDesktopSurface ? (
                        <span
                          className={item.done ? styles.neutralPill : styles.priorityPill}
                          data-priority={item.priority}
                        >
                          {item.done ? '已完成' : `${PRIORITY_META[item.priority].numeral} ${PRIORITY_META[item.priority].shortLabel}`}
                        </span>
                      ) : <span className={item.done ? styles.neutralPill : styles.statusPill}>{item.done ? '已完成' : '未完成'}</span>}
                    </button>
                  ))}
                </div>
              ) : (
                <p className={styles.sectionDescription}>当天暂无事项。可以直接在下方新增，不需要先切换页面。</p>
              )}
            </section> : null}

            <section className={styles.detailSection}>
              {selectedItem && !createMode ? (
                <ScheduleEditForm
                  key={selectedItem.id}
                  item={selectedItem}
                  onSave={(patch) => {
                    const previous: Partial<Omit<WorkbenchCustomTodo, 'id'>> = {
                      text: selectedItem.title,
                      date: selectedItem.date || '',
                      type: selectedItem.type,
                      category: selectedItem.category,
                      priority: selectedItem.priority,
                      note: ['手动添加的工作台事项', '手动添加的日程事项'].includes(selectedItem.detail) ? '' : selectedItem.detail
                    };
                    onUpdateTodo(selectedItem.id, patch);
                    if (patch.date !== undefined) {
                      setSelectedDate(patch.date || '');
                      if (patch.date) onCalendarMonthChange(getMonthKey(patch.date));
                    }
                    highlightItem(selectedItem.id);
                    showUndoNotice(
                      `已保存“${String(patch.text || selectedItem.title)}”`,
                      () => {
                        onUpdateTodo(selectedItem.id, previous);
                        onDoneChange(selectedItem.id, selectedItem.done);
                        highlightItem(selectedItem.id);
                      },
                      () => rowRefs.current.get(selectedItem.id)?.focus({ preventScroll: true })
                    );
                  }}
                  onDoneChange={(done) => onDoneChange(selectedItem.id, done)}
                  onDelete={(button) => {
                    returnFocusRef.current = button;
                    setPendingDelete(selectedItem.id);
                  }}
                />
              ) : createMode || !isDesktopSurface ? (
                <ScheduleCreateForm
                  selectedDate={selectedDate}
                  onCancel={closeDetail}
                  onCreate={(payload) => {
                    const id = onCreateTodo(payload);
                    if (id) {
                      setSelectedId(id);
                      setCreateMode(false);
                      highlightItem(id);
                      showUndoNotice(
                        `已新建“${payload.text}”`,
                        () => {
                          onDeleteTodo(id);
                          setSelectedId('');
                          setDetailOpen(false);
                        },
                        () => headerCreateButtonRef.current?.focus({ preventScroll: true })
                      );
                    }
                    return Boolean(id);
                  }}
                />
              ) : (
                <ScheduleIdleState
                  selectedDate={selectedDate}
                  selectedDayCount={selectedDayItems.length}
                  onCreate={() => startCreate()}
                />
              )}
            </section>

            {!createMode && items.some((item) => item.done) ? (
              <section className={styles.detailSection}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h3 className={styles.sectionTitle}>已完成事项</h3>
                    <p className={styles.sectionDescription}>清理后会同步删除记录，避免其他设备把旧事项重新带回。</p>
                  </div>
                  <button
                    type="button"
                    className={styles.dangerButton}
                    onClick={(event) => {
                      returnFocusRef.current = event.currentTarget;
                      setPendingDelete('completed');
                    }}
                  >
                    <Delete20Regular aria-hidden="true" />
                    清理已完成
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        </section>
      </div>

      {undoNotice ? (
        <div className={styles.productivityToast} aria-label="日程操作反馈">
          <span role="status" aria-live="polite" aria-atomic="true">{undoNotice.message}</span>
          <button
            type="button"
            onClick={() => {
              undoNotice.undo();
              setUndoNotice(null);
              window.requestAnimationFrame(undoNotice.returnFocus);
            }}
          >
            撤销
          </button>
        </div>
      ) : null}

      <DesktopConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete === 'completed' ? '清理全部已完成事项？' : '删除这条日程？'}
        description={confirmDescription}
        confirmLabel={pendingDelete === 'completed' ? '确认清理' : '确认删除'}
        returnFocusTo={returnFocusRef.current}
        onCancel={() => setPendingDelete('')}
        onConfirm={() => {
          if (pendingDelete === 'completed') onClearCompleted();
          else if (pendingDelete) {
            onDeleteTodo(pendingDelete);
            if (selectedId === pendingDelete) {
              setSelectedId('');
              setCreateMode(true);
            }
          }
          setPendingDelete('');
        }}
      />
    </section>
  );
}

function ScheduleCreateForm({
  selectedDate,
  onCancel,
  onCreate
}: {
  selectedDate: string;
  onCancel: () => void;
  onCreate: (payload: Pick<WorkbenchCustomTodo, 'text'> & Partial<Omit<WorkbenchCustomTodo, 'id' | 'text'>>) => boolean;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(selectedDate);
  const [type, setType] = useState<Exclude<ScheduleTypeFilter, '全部'>>('其他');
  const [category, setCategory] = useState<ScheduleCategory>('申请');
  const [priority, setPriority] = useState<SchedulePriority>('重要不紧急');
  const [note, setNote] = useState('');
  const [submitState, setSubmitState] = useState<ScheduleSubmitState>('idle');
  const submitTimerRef = useRef<number | null>(null);

  useEffect(() => setDate(selectedDate), [selectedDate]);
  useEffect(() => () => {
    if (submitTimerRef.current !== null) window.clearTimeout(submitTimerRef.current);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = title.trim();
    if (!text) {
      setSubmitState('error');
      return;
    }
    setSubmitState('saving');
    submitTimerRef.current = window.setTimeout(() => {
      try {
        const created = onCreate({ text, date: date || undefined, type, category, priority, note: note.trim() || undefined });
        if (!created) {
          setSubmitState('error');
          return;
        }
        setSubmitState('success');
        setTitle('');
        setNote('');
      } catch {
        setSubmitState('error');
      }
    }, 0);
  }

  return (
    <form onSubmit={handleSubmit}>
      {!isDesktopSurface ? <div className={styles.sectionHeader}>
        <div>
          <h3 className={styles.sectionTitle}>新增日程</h3>
          <p className={styles.sectionDescription}>先记下明确动作，日期和备注可以之后继续调整。</p>
        </div>
      </div> : null}
      <div className={`${styles.formGrid} ${isDesktopSurface ? styles.scheduleFormGrid : ''}`}>
        <Field label="日程标题" full>
          <textarea
            data-schedule-create-title
            className={`${styles.fieldControl} ${styles.scheduleTitleControl}`}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (submitState === 'error') setSubmitState('idle');
            }}
            maxLength={160}
            rows={2}
            placeholder="例如：补齐成绩单并核对报名入口"
          />
        </Field>
        <Field label="日期">
          <input className={styles.fieldControl} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        {isDesktopSurface ? (
          <>
            <div className={styles.quickDateHint}>日期可留空，留空后进入“待安排”</div>
            <div className={`${styles.attributePickerRow} ${styles.fieldFull}`}>
              <CategoryPicker value={category} onChange={setCategory} />
              <PriorityPicker value={priority} onChange={setPriority} />
            </div>
          </>
        ) : (
          <>
            <Field label="类型">
              <select className={styles.fieldControl} value={type} onChange={(event) => setType(normalizeScheduleType(event.target.value))}>
                {MANUAL_SCHEDULE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="备注" full>
              <textarea className={styles.fieldControl} value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="补充材料、链接、联系人或下一步动作" />
            </Field>
          </>
        )}
      </div>
      {isDesktopSurface ? <details className={styles.moreFields}>
        <summary>更多设置</summary>
        <div className={styles.formGrid}>
          <Field label="事项类型">
            <select className={styles.fieldControl} value={type} onChange={(event) => setType(normalizeScheduleType(event.target.value))}>
              {MANUAL_SCHEDULE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="备注" full>
            <textarea className={styles.fieldControl} value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="补充材料、链接、联系人或下一步动作" />
          </Field>
        </div>
      </details> : null}
      <div className={styles.formActions}>
        <span className={styles.formSubmitStatus} role="status" aria-live="polite">
          {submitState === 'error' ? '保存失败，请检查标题后重试' : submitState === 'success' ? '已保存' : ''}
        </span>
        {isDesktopSurface ? <button type="button" className={styles.secondaryButton} onClick={onCancel}>取消</button> : null}
        <button type="submit" className={styles.primaryButton} disabled={submitState === 'saving'} aria-busy={submitState === 'saving'}>
          <Add20Regular aria-hidden="true" />
          {submitState === 'saving' ? '保存中…' : submitState === 'error' ? '重试保存' : '保存日程'}
        </button>
      </div>
    </form>
  );
}

function ScheduleEditForm({
  item,
  onSave,
  onDoneChange,
  onDelete
}: {
  item: DesktopScheduleItem;
  onSave: (patch: Partial<Omit<WorkbenchCustomTodo, 'id'>>) => void;
  onDoneChange: (done: boolean) => void;
  onDelete: (button: HTMLButtonElement) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [date, setDate] = useState(item.date || '');
  const [type, setType] = useState(item.type);
  const [category, setCategory] = useState(item.category);
  const [priority, setPriority] = useState(item.priority);
  const [note, setNote] = useState(['手动添加的工作台事项', '手动添加的日程事项'].includes(item.detail) ? '' : item.detail);
  const [done, setDone] = useState(item.done);
  const [submitState, setSubmitState] = useState<ScheduleSubmitState>('idle');
  const submitTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (submitTimerRef.current !== null) window.clearTimeout(submitTimerRef.current);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setSubmitState('error');
      return;
    }
    setSubmitState('saving');
    submitTimerRef.current = window.setTimeout(() => {
      try {
        onSave({ text: title, date, type, category, priority, note });
        onDoneChange(done);
        setSubmitState('success');
        submitTimerRef.current = window.setTimeout(() => setSubmitState('idle'), 1400);
      } catch {
        setSubmitState('error');
      }
    }, 0);
  }

  return (
    <form onSubmit={handleSubmit}>
      {!isDesktopSurface ? <div className={styles.sectionHeader}>
        <div>
          <h3 className={styles.sectionTitle}>编辑日程</h3>
          <p className={styles.sectionDescription}>修改后保存到本机，并在后台同步到你的账号。</p>
        </div>
      </div> : null}
      <div className={`${styles.formGrid} ${isDesktopSurface ? styles.scheduleFormGrid : ''}`}>
        <Field label="日程标题" full>
          <textarea
            data-schedule-detail-primary
            className={`${styles.fieldControl} ${styles.scheduleTitleControl}`}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (submitState === 'error') setSubmitState('idle');
            }}
            maxLength={160}
            rows={2}
          />
        </Field>
        <Field label="日期">
          <input className={styles.fieldControl} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        {isDesktopSurface ? (
          <>
            <Field label="完成状态">
              <select className={styles.fieldControl} value={done ? '已完成' : '未完成'} onChange={(event) => setDone(event.target.value === '已完成')}>
                <option value="未完成">未完成</option>
                <option value="已完成">已完成</option>
              </select>
            </Field>
            <div className={`${styles.attributePickerRow} ${styles.fieldFull}`}>
              <CategoryPicker value={category} onChange={setCategory} />
              <PriorityPicker value={priority} onChange={setPriority} />
            </div>
          </>
        ) : (
          <>
            <Field label="类型">
              <select className={styles.fieldControl} value={type} onChange={(event) => setType(normalizeScheduleType(event.target.value))}>
                {MANUAL_SCHEDULE_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
            <Field label="完成状态">
              <select className={styles.fieldControl} value={done ? '已完成' : '未完成'} onChange={(event) => setDone(event.target.value === '已完成')}>
                <option value="未完成">未完成</option>
                <option value="已完成">已完成</option>
              </select>
            </Field>
          </>
        )}
        {!isDesktopSurface ? <Field label="备注" full>
          <textarea className={styles.fieldControl} value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} />
        </Field> : null}
      </div>
      {isDesktopSurface ? <details className={styles.moreFields}>
        <summary>更多设置</summary>
        <div className={styles.formGrid}>
          <Field label="事项类型">
            <select className={styles.fieldControl} value={type} onChange={(event) => setType(normalizeScheduleType(event.target.value))}>
              {MANUAL_SCHEDULE_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </Field>
          <Field label="备注" full>
            <textarea className={styles.fieldControl} value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} />
          </Field>
        </div>
      </details> : null}
      <div className={styles.formActions}>
        <span className={styles.formSubmitStatus} role="status" aria-live="polite">
          {submitState === 'error' ? '保存失败，请重试' : submitState === 'success' ? '已保存' : ''}
        </span>
        <button type="button" className={styles.dangerButton} onClick={(event) => onDelete(event.currentTarget)}>
          <Delete20Regular aria-hidden="true" />
          删除
        </button>
        <button type="submit" className={styles.primaryButton} disabled={submitState === 'saving'} aria-busy={submitState === 'saving'}>
          <Checkmark20Regular aria-hidden="true" />
          {submitState === 'saving' ? '保存中…' : submitState === 'success' ? '已保存' : submitState === 'error' ? '重试保存' : '保存修改'}
        </button>
      </div>
    </form>
  );
}

function ScheduleCategoryIcon({ category }: { category: ScheduleCategory }) {
  const Icon = CATEGORY_META[category].Icon;
  return <Icon aria-hidden={true} />;
}

function handlePickerKeyDown<T extends string>(
  event: ReactKeyboardEvent<HTMLButtonElement>,
  options: readonly T[],
  currentIndex: number,
  onChange: (value: T) => void
) {
  let nextIndex = currentIndex;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % options.length;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + options.length) % options.length;
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = options.length - 1;
  else return;

  event.preventDefault();
  onChange(options[nextIndex]);
  const radios = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
  radios?.[nextIndex]?.focus();
}

function CategoryPicker({ value, onChange }: { value: ScheduleCategory; onChange: (value: ScheduleCategory) => void }) {
  const popoverId = useId();
  const labelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const CurrentIcon = CATEGORY_META[value].Icon;
  useDismissPopoverOnViewportChange(surfaceRef, open);

  return (
    <div className={styles.attributePicker}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.attributePickerTrigger}
        data-category={value}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => {
          if (triggerRef.current && surfaceRef.current) toggleAnchoredPopover(triggerRef.current, surfaceRef.current, 304, 196);
        }}
      >
        <span className={styles.attributePickerIcon}><CurrentIcon aria-hidden={true} /></span>
        <span className={styles.attributePickerText}><small>场景分类</small><strong>{CATEGORY_META[value].shortLabel}</strong></span>
        <ChevronDown20Regular aria-hidden="true" />
      </button>
      <div
        ref={surfaceRef}
        id={popoverId}
        popover="auto"
        role="dialog"
        aria-modal="false"
        aria-labelledby={labelId}
        className={`${styles.schedulePopoverSurface} ${styles.attributePopoverSurface} ${styles.categoryPopoverSurface}`}
        onToggle={(event) => {
          const surface = event.currentTarget;
          const nextOpen = surface.matches(':popover-open');
          setOpen(nextOpen);
          if (nextOpen) window.requestAnimationFrame(() => surface.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus({ preventScroll: true }));
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          closePopover(surfaceRef.current, triggerRef.current);
        }}
      >
        <span id={labelId} className={styles.visuallyHidden}>选择场景分类</span>
        <div className={styles.categoryPicker} role="radiogroup" aria-labelledby={labelId}>
        {SCHEDULE_CATEGORIES.map((category, index) => {
          const Icon = CATEGORY_META[category].Icon;
          return (
            <button
              key={category}
              type="button"
              role="radio"
              aria-checked={value === category}
              tabIndex={value === category ? 0 : -1}
              data-category={category}
              onClick={() => {
                onChange(category);
                closePopover(surfaceRef.current, triggerRef.current);
              }}
              onKeyDown={(event) => handlePickerKeyDown(event, SCHEDULE_CATEGORIES, index, onChange)}
            >
              <span><Icon aria-hidden={true} /></span>
              {CATEGORY_META[category].shortLabel}
              {value === category ? <Checkmark20Regular aria-hidden="true" /> : null}
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}

function PriorityPicker({ value, onChange }: { value: SchedulePriority; onChange: (value: SchedulePriority) => void }) {
  const popoverId = useId();
  const labelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useDismissPopoverOnViewportChange(surfaceRef, open);

  return (
    <div className={styles.attributePicker}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.attributePickerTrigger}
        data-priority={value}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => {
          if (triggerRef.current && surfaceRef.current) toggleAnchoredPopover(triggerRef.current, surfaceRef.current, 276, 224);
        }}
      >
        <span className={`${styles.attributePickerIcon} ${styles.priorityNumeral}`}>{PRIORITY_META[value].numeral}</span>
        <span className={styles.attributePickerText}><small>优先级</small><strong>{PRIORITY_META[value].shortLabel}</strong></span>
        <ChevronDown20Regular aria-hidden="true" />
      </button>
      <div
        ref={surfaceRef}
        id={popoverId}
        popover="auto"
        role="dialog"
        aria-modal="false"
        aria-labelledby={labelId}
        className={`${styles.schedulePopoverSurface} ${styles.attributePopoverSurface} ${styles.priorityPopoverSurface}`}
        onToggle={(event) => {
          const surface = event.currentTarget;
          const nextOpen = surface.matches(':popover-open');
          setOpen(nextOpen);
          if (nextOpen) window.requestAnimationFrame(() => surface.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus({ preventScroll: true }));
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          closePopover(surfaceRef.current, triggerRef.current);
        }}
      >
        <span id={labelId} className={styles.visuallyHidden}>选择四象限优先级</span>
        <div className={styles.priorityPicker} role="radiogroup" aria-labelledby={labelId}>
        {SCHEDULE_PRIORITIES.map((priority, index) => (
          <button
            key={priority}
            type="button"
            role="radio"
            aria-checked={value === priority}
            tabIndex={value === priority ? 0 : -1}
            data-priority={priority}
            onClick={() => {
              onChange(priority);
              closePopover(surfaceRef.current, triggerRef.current);
            }}
            onKeyDown={(event) => handlePickerKeyDown(event, SCHEDULE_PRIORITIES, index, onChange)}
          >
            <span className={styles.priorityNumeral}>{PRIORITY_META[priority].numeral}</span>
            <span>{PRIORITY_META[priority].shortLabel}</span>
            {value === priority ? <Checkmark20Regular aria-hidden="true" /> : null}
          </button>
        ))}
        </div>
      </div>
    </div>
  );
}

function ScheduleAdvancedFilters({
  typeFilter,
  doneFilter,
  priorityFilter,
  activeCount,
  onTypeChange,
  onDoneChange,
  onPriorityChange
}: {
  typeFilter: ScheduleTypeFilter;
  doneFilter: ScheduleDoneFilter;
  priorityFilter: SchedulePriorityFilter;
  activeCount: number;
  onTypeChange: (value: ScheduleTypeFilter) => void;
  onDoneChange: (value: ScheduleDoneFilter) => void;
  onPriorityChange: (value: SchedulePriorityFilter) => void;
}) {
  const popoverId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useDismissPopoverOnViewportChange(surfaceRef, open);

  return (
    <div className={styles.scheduleAdvancedFilters}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.filterTrigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => {
          if (triggerRef.current && surfaceRef.current) toggleAnchoredPopover(triggerRef.current, surfaceRef.current, 320, 318);
        }}
      >
        <Filter20Regular aria-hidden="true" />
        <span>筛选</span>
        {activeCount ? <span className={styles.filterCount}>{activeCount}</span> : null}
        <ChevronDown20Regular aria-hidden="true" />
      </button>
      <div
        ref={surfaceRef}
        id={popoverId}
        popover="auto"
        role="dialog"
        aria-modal="false"
        aria-label="筛选日程"
        className={`${styles.schedulePopoverSurface} ${styles.filterPopoverSurface}`}
        onToggle={(event) => {
          const surface = event.currentTarget;
          const nextOpen = surface.matches(':popover-open');
          setOpen(nextOpen);
          if (nextOpen) {
            window.requestAnimationFrame(() => surface.querySelector<HTMLElement>('select, input, button')?.focus({ preventScroll: true }));
          }
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          closePopover(surfaceRef.current, triggerRef.current);
        }}
      >
        <div className={styles.popoverHeader}>
          <strong>筛选日程</strong>
          <span>按类型、状态和优先级缩小范围</span>
        </div>
        <div className={styles.filterPopoverFields}>
          <Field label="事项类型">
            <select className={styles.fieldControl} value={typeFilter} onChange={(event) => onTypeChange(event.target.value as ScheduleTypeFilter)}>
              {SCHEDULE_TYPE_FILTERS.map((item) => <option key={item} value={item}>{item === '全部' ? '全部类型' : item}</option>)}
            </select>
          </Field>
          <Field label="完成状态">
            <select className={styles.fieldControl} value={doneFilter} onChange={(event) => onDoneChange(event.target.value as ScheduleDoneFilter)}>
              {SCHEDULE_DONE_FILTERS.map((item) => <option key={item} value={item}>{item === '全部' ? '全部状态' : item}</option>)}
            </select>
          </Field>
          <Field label="四象限优先级" full>
            <select className={styles.fieldControl} value={priorityFilter} onChange={(event) => onPriorityChange(event.target.value as SchedulePriorityFilter)}>
              <option value="全部">全部优先级</option>
              {SCHEDULE_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>{PRIORITY_META[priority].numeral} {priority}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className={styles.popoverFooter}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
              onTypeChange('全部');
              onDoneChange('全部');
              onPriorityChange('全部');
            }}
          >
            清除筛选
          </button>
          <button type="button" className={styles.primaryButton} onClick={() => closePopover(surfaceRef.current, triggerRef.current)}>
            完成
          </button>
        </div>
      </div>
    </div>
  );
}

function ScheduleQuadrantBoard({
  items,
  selectedId,
  today,
  onOpen,
  registerRow
}: {
  items: DesktopScheduleItem[];
  selectedId: string;
  today: string;
  onOpen: (item: DesktopScheduleItem, focusDetail?: boolean) => void;
  registerRow: (id: string, node: HTMLButtonElement | null) => void;
}) {
  return (
    <div className={styles.quadrantGrid} aria-label="四象限日程">
      {SCHEDULE_PRIORITIES.map((priority) => {
        const quadrantItems = items.filter((item) => item.priority === priority);
        const meta = PRIORITY_META[priority];
        return (
          <section key={priority} className={styles.quadrantPanel} data-priority={priority} role="group" aria-label={`${meta.numeral} ${priority}`}>
            <header className={styles.quadrantHeader}>
              <span className={styles.priorityNumeral}>{meta.numeral}</span>
              <strong>{meta.shortLabel}</strong>
              <span>{quadrantItems.length}</span>
            </header>
            <div className={styles.quadrantItems}>
              {quadrantItems.length ? quadrantItems.map((item) => (
                <button
                  key={item.id}
                  ref={(node) => registerRow(item.id, node)}
                  type="button"
                  role="option"
                  aria-selected={selectedId === item.id}
                  aria-controls="schedule-detail-pane"
                  tabIndex={selectedId === item.id || (!selectedId && items[0]?.id === item.id) ? 0 : -1}
                  className={styles.quadrantItem}
                  data-category={item.category}
                  onClick={() => onOpen(item)}
                  onDoubleClick={() => onOpen(item, true)}
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowDown' && event.key !== 'ArrowRight' && event.key !== 'ArrowUp' && event.key !== 'ArrowLeft') return;
                    event.preventDefault();
                    const options = event.currentTarget.closest('[aria-label="四象限日程"]')
                      ?.querySelectorAll<HTMLButtonElement>('[role="option"]');
                    if (!options?.length) return;
                    const currentIndex = [...options].indexOf(event.currentTarget);
                    const offset = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
                    const next = options[(currentIndex + offset + options.length) % options.length];
                    next.focus();
                    next.click();
                  }}
                >
                  <span className={styles.quadrantCategoryIcon} data-category={item.category}>
                    <ScheduleCategoryIcon category={item.category} />
                  </span>
                  <span className={styles.quadrantItemBody}>
                    <strong>{item.title}</strong>
                    <small>{item.category} · {item.date ? getRelativeLabel(item.date, today) : '待安排'}</small>
                  </span>
                  <span className={styles.quadrantItemDate}>{item.date ? formatDateTitle(item.date) : '—'}</span>
                </button>
              )) : <p className={styles.quadrantEmpty}>暂无事项</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ScheduleIdleState({
  selectedDate,
  selectedDayCount,
  onCreate
}: {
  selectedDate: string;
  selectedDayCount: number;
  onCreate: () => void;
}) {
  const dateLabel = selectedDate ? formatDateTitle(selectedDate) : '待安排';
  return (
    <div className={`${styles.scheduleIdleState} desktop-schedule-detail-empty`}>
      <span className={styles.scheduleIdleIcon}><Calendar24Regular aria-hidden="true" /></span>
      <h3>{selectedDayCount ? '选择一项查看详情' : `${dateLabel}还没有日程`}</h3>
      <p>
        {selectedDayCount
          ? '左侧已显示当天事项，选中后可查看、编辑或标记完成。'
          : '默认保持简洁；需要安排时再打开完整新建表单。'}
      </p>
      <button type="button" className={styles.secondaryButton} onClick={onCreate}>
        <Add20Regular aria-hidden="true" />
        新建日程
      </button>
    </div>
  );
}

function EmptySchedule({ filtered, onCreate, onReset }: { filtered: boolean; onCreate: () => void; onReset: () => void }) {
  return (
    <div className={`${styles.emptyState} desktop-schedule-empty`} role="status">
      <div className={styles.emptyInner}>
        <span className={styles.emptyIcon}><Calendar24Regular aria-hidden="true" /></span>
        <h2 className={styles.emptyTitle}>{filtered ? '没有匹配的日程' : '还没有日程'}</h2>
        <p className={styles.emptyDescription}>{filtered ? '调整筛选条件后再查看，当前日程不会被删除。' : '添加第一个明确事项，之后可以随时补充日期、类型和备注。'}</p>
        <div className={styles.formActions}>
          {filtered ? <button type="button" className={styles.secondaryButton} onClick={onReset}>清空筛选</button> : null}
          <button type="button" className={styles.primaryButton} onClick={onCreate}><Add20Regular aria-hidden="true" />新建日程</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, full = false, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`${styles.field} ${full ? styles.fieldFull : ''}`}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}
