'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Add20Regular,
  ArrowLeft20Regular,
  ArrowRight20Regular,
  ArrowSync20Regular,
  Calendar24Regular,
  Checkmark20Regular,
  CheckmarkCircle20Regular,
  ChevronRight20Regular,
  Clock20Regular,
  DocumentText20Regular,
  Dismiss20Regular,
  Copy20Regular,
  EyeOff20Regular,
  Flag20Regular,
  MoreHorizontal20Regular,
  Open20Regular,
  Pin20Regular,
  Search20Regular,
  Star20Filled,
  Star20Regular,
  Tag20Regular,
  FolderOpen20Regular
} from '@fluentui/react-icons';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction
} from 'react';
import { ExternalSiteMark } from '@/components/external-site-mark';
import {
  DesktopManualApplicationDialog,
  type ManualApplicationCreationResult
} from '@/components/desktop-manual-application-dialog';
import { useUserSessionState } from '@/hooks/use-user-session';
import {
  fetchApplicationRows,
  readLocalApplicationRows,
  updateUserProject,
  watchApplicationTable,
  type ApplicationRow
} from '@/lib/cloudbase-data';
import {
  getDeadlineDistanceLabel,
  getDeadlineTimestamp
} from '@/lib/deadline-display';
import {
  consumeDesktopApplicationSyncRequest,
  DESKTOP_APPLICATION_SYNC_EVENT,
  consumeDesktopNewApplicationRequest,
  DESKTOP_NEW_APPLICATION_EVENT,
  emitDesktopFeedback,
  emitDesktopModalState,
  emitDesktopRouteChange,
  emitDesktopSyncStatus
} from '@/lib/desktop-route-events';
import { trackDesktopPendingWrite } from '@/lib/desktop-pending-writes';
import { clampDesktopFloatingSurface } from '@/lib/desktop-floating-surface';
import { createKeyedRequestCache } from '@/lib/keyed-request-cache';
import {
  DESKTOP_WORKBENCH_DEFAULT_LEFT_WIDTH,
  DESKTOP_WORKBENCH_MIN_RIGHT_WIDTH,
  clampDesktopWorkbenchLeftPaneWidth,
  getDesktopWorkbenchKeyboardPaneWidth,
  getDesktopWorkbenchPaneBounds,
  readDesktopWorkbenchPanePreference,
  writeDesktopWorkbenchPanePreference
} from '@/lib/desktop-workbench-splitter';
import {
  applicationJourneyStages,
  getApplicationJourney,
  getApplicationJourneyProgress,
  type ApplicationJourney
} from '@/lib/desktop-application-flow';
import {
  filterDesktopExpiredApplications,
  getDesktopExpiredApplicationCount,
  getNextVisibleDesktopApplicationId,
  isDesktopApplicationExpired
} from '@/lib/desktop-application-visibility';
import {
  createDefaultProjectMaterialMeta,
  createMaterialManifest,
  getDesktopProjectMaterialMeta,
  readDesktopProjectMeta,
  type DesktopMaterialMeta,
  type DesktopProjectMaterialMeta,
  type MaterialRequirement,
  writeDesktopProjectMeta
} from '@/lib/desktop-project-meta';
import {
  readAccountScopedWorkbenchValue,
  WORKBENCH_CONTACTS_KEY
} from '@/lib/workbench-local-storage';
import type { WorkbenchMentorContact } from '@/lib/workbench-state';
import type { DesktopZoomLevel } from '@/lib/desktop-preferences';
import {
  formatNoticeDateOnly,
  getDisplayDiscipline,
  getDisplayNoticeDepartment,
  getDisplayProjectType,
  getDisplaySchoolName,
  normalizeNoticeTitle
} from '@/lib/notice-display';
import { buildNoticeDetailHref } from '@/lib/notice-links';
import { resolveNoticeLogoSource } from '@/lib/school-mark-source';
import {
  materialChecklistDefinitions,
  userStatusOptions,
  type MaterialChecklistKey,
  type UserProjectRecord,
  type UserProjectStatus
} from '@/lib/mock-data';

type SortOption = 'priority' | 'deadline' | 'school' | 'status';
type ProjectStatusFilter = '全部' | UserProjectStatus;
type MaterialFilter = 'all' | 'incomplete' | 'complete';
type ProjectWorkspaceTab = 'overview' | 'materials' | 'schedule' | 'contacts' | 'activity';
type DesktopLayoutMode = 'wide' | 'split' | 'drawer';
type ProjectPatch = Partial<UserProjectRecord>;
type ProjectActionPhase = 'pending' | 'success' | 'error';

type ProjectActionState = {
  phase: ProjectActionPhase;
  fieldKey: string;
  message: string;
};

type ProjectUpdateOptions = {
  allowUndo?: boolean;
  isUndo?: boolean;
};

type ProjectContextMenuState = {
  row: ApplicationRow;
  left: number;
  top: number;
};

type WorkbenchSplitterDragState = {
  pointerId: number;
  layoutLeft: number;
  layoutWidth: number;
  startPreferredWidth: number;
};

type PersistedApplicationContext = {
  query: string;
  statusFilter: ProjectStatusFilter;
  materialFilter: MaterialFilter;
  sortOption: SortOption;
  hideExpired: boolean;
  selectedId: string;
  activeWorkspaceTab: ProjectWorkspaceTab;
  listScrollTop: number;
  workspaceScrollTop: number;
};

const archivedStatuses = new Set<UserProjectStatus>(['已通过', '未通过', '已放弃']);
const projectStatusFilters: ProjectStatusFilter[] = [
  '全部',
  '已收藏',
  '准备材料中',
  '已提交',
  '待考核',
  '已通过',
  '未通过',
  '已放弃'
];
const projectWorkspaceTabs: Array<{ value: ProjectWorkspaceTab; label: string }> = [
  { value: 'overview', label: '概览' },
  { value: 'materials', label: '材料' },
  { value: 'schedule', label: '日程' },
  { value: 'contacts', label: '导师' },
  { value: 'activity', label: '动态' }
];
const applicationCacheTtlMs = 45_000;
const applicationSyncTimeoutMs = 12_000;
const applicationContextStoragePrefix = 'seekoffer-desktop-application-context-v1:';
const applicationRequestCache = createKeyedRequestCache<ApplicationRow[]>(applicationCacheTtlMs);

type ApplicationViewState = {
  userId: string;
  rows: ApplicationRow[];
  loading: boolean;
  loadError: string;
};

function getApplicationCacheEntry(userId: string) {
  return applicationRequestCache.get(userId);
}

function createApplicationViewState(userId: string): ApplicationViewState {
  let cached = getApplicationCacheEntry(userId);
  if (!cached && userId && typeof window !== 'undefined') {
    const localRows = readLocalApplicationRows(userId);
    if (localRows.length) {
      applicationRequestCache.set(userId, localRows, 0);
      cached = getApplicationCacheEntry(userId);
    }
  }
  return {
    userId,
    rows: cached?.value || [],
    loading: Boolean(userId && !cached),
    loadError: ''
  };
}

function withApplicationSyncTimeout<T>(promise: Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error('Application sync timed out.')),
      applicationSyncTimeoutMs
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

function fetchApplicationsForUser(userId: string, bypassPendingRequest = false) {
  return applicationRequestCache.request(
    userId,
    () => withApplicationSyncTimeout(fetchApplicationRows(userId)),
    { force: bypassPendingRequest }
  );
}

function isArchived(row: ApplicationRow) {
  return archivedStatuses.has(row.item.myStatus);
}

function getCompletedMaterialCount(row: ApplicationRow) {
  return materialChecklistDefinitions.filter(({ key }) => row.item[key]).length;
}

function isUrgent(row: ApplicationRow) {
  return ['today', 'within3days', 'within7days'].includes(row.project.deadlineLevel);
}

function getJourneyPriorityRank(journey: ApplicationJourney) {
  if (journey.state === 'stopped') return 900;
  if (journey.state === 'completed') return 800;
  switch (journey.command) {
    case 'confirm_submission': return 0;
    case 'open_materials': return 10;
    case 'open_schedule': return 20;
    case 'open_contacts': return 30;
    case 'start_preparation': return 40;
    case 'open_notice': return 50;
    case 'open_activity': return 60;
    default: return 70;
  }
}

function formatProjectUpdate(value: string) {
  if (!value) return '更新时间待补充';
  const normalized = value.replace('T', ' ');
  return normalized.length >= 16 ? normalized.slice(0, 16) : normalized;
}

function formatApplicationListDeadline(value: string) {
  const formatted = formatNoticeDateOnly(value);
  if (!formatted) return '待补充';

  const match = formatted.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return formatted;

  const [, year, month, day] = match;
  const compactDate = `${Number(month)}月${Number(day)}日`;
  return Number(year) === new Date().getFullYear() ? compactDate : `${year}·${compactDate}`;
}

function formatApplicationDeadlineDistance(value: string, now: number) {
  const timestamp = getDeadlineTimestamp(value);
  if (timestamp === Number.MAX_SAFE_INTEGER) return '时间待补充';

  const dayMs = 1000 * 60 * 60 * 24;
  const difference = timestamp - now;
  if (difference <= 0) {
    return `已截止 ${Math.max(1, Math.ceil(Math.abs(difference) / dayMs))} 天`;
  }
  if (difference <= dayMs) return '24小时内截止';
  return `剩余 ${Math.ceil(difference / dayMs)} 天`;
}

function getApplicationPriorityMeta(level: UserProjectRecord['priorityLevel']) {
  switch (level) {
    case '高':
      return { label: '高优先级', tone: 'high' as const };
    case '低':
      return { label: '低优先级', tone: 'low' as const };
    case '中':
    default:
      return { label: '中优先级', tone: 'medium' as const };
  }
}

function getApplicationActionLabel(journey: ApplicationJourney) {
  if (journey.command === 'resume_application') return '恢复申请';
  if (journey.command === 'open_notice') return '立即查看';
  if (journey.state === 'completed') return '查看记录';
  return '立即处理';
}

function getProjectHref(row: ApplicationRow) {
  return row.project.sourceSite === '用户手动录入'
    ? '/'
    : buildNoticeDetailHref(row.project.id);
}

function createPreviousProjectPatch(item: UserProjectRecord, patch: ProjectPatch): ProjectPatch {
  return Object.fromEntries(
    (Object.keys(patch) as Array<keyof UserProjectRecord>).map((key) => [key, item[key]])
  ) as ProjectPatch;
}

function applyProjectPatch(rows: ApplicationRow[], projectId: string, patch: ProjectPatch) {
  return rows.map((row) =>
    row.item.userProjectId === projectId
      ? { ...row, item: { ...row.item, ...patch } }
      : row
  );
}

function restoreProjectPatch(rows: ApplicationRow[], projectId: string, patch: ProjectPatch) {
  return applyProjectPatch(rows, projectId, patch);
}

function getProjectActionCopy(fieldKey: string) {
  if (fieldKey === 'status') return '申请阶段';
  if (fieldKey === 'priority') return '重点标记';
  if (fieldKey === 'contact') return '导师联系状态';
  return '材料清单';
}

export function DesktopHome({
  zoomLevel
}: {
  unreadReminderCount: number;
  onOpenReminders: () => void;
  zoomLevel: DesktopZoomLevel;
}) {
  const router = useRouter();
  const { session } = useUserSessionState();
  const userId = session?.userId?.trim() || '';
  const [storedViewState, setStoredViewState] = useState<ApplicationViewState>(() =>
    createApplicationViewState(userId)
  );
  const viewState = storedViewState.userId === userId
    ? storedViewState
    : createApplicationViewState(userId);
  const applications = viewState.rows;
  const applicationsRef = useRef<ApplicationRow[]>(applications);
  applicationsRef.current = applications;
  const loading = viewState.loading;
  const loadError = viewState.loadError;
  const setApplications = useCallback((next: SetStateAction<ApplicationRow[]>) => {
    setStoredViewState((current) => {
      const currentView = current.userId === userId ? current : createApplicationViewState(userId);
      const nextRows = typeof next === 'function' ? next(currentView.rows) : next;
      applicationsRef.current = nextRows;
      return {
        ...currentView,
        rows: nextRows
      };
    });
  }, [userId]);
  const setLoading = useCallback((next: boolean) => {
    setStoredViewState((current) => ({
      ...(current.userId === userId ? current : createApplicationViewState(userId)),
      loading: next
    }));
  }, [userId]);
  const setLoadError = useCallback((next: string) => {
    setStoredViewState((current) => ({
      ...(current.userId === userId ? current : createApplicationViewState(userId)),
      loadError: next
    }));
  }, [userId]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>('全部');
  const [materialFilter, setMaterialFilter] = useState<MaterialFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('priority');
  const [hideExpired, setHideExpired] = useState(false);
  const [deadlineNow, setDeadlineNow] = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState('');
  const [projectActionStates, setProjectActionStates] = useState<Record<string, ProjectActionState>>({});
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [projectContextMenu, setProjectContextMenu] = useState<ProjectContextMenuState | null>(null);
  const [layoutMode, setLayoutMode] = useState<DesktopLayoutMode>(
    zoomLevel >= 150 ? 'drawer' : 'split'
  );
  const [workbenchLayoutWidth, setWorkbenchLayoutWidth] = useState(0);
  const [preferredMasterPaneWidth, setPreferredMasterPaneWidth] = useState(
    DESKTOP_WORKBENCH_DEFAULT_LEFT_WIDTH
  );
  const [splitterDragging, setSplitterDragging] = useState(false);
  const [manualApplicationOpen, setManualApplicationOpen] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<ProjectWorkspaceTab>('overview');
  const [stageTimelineExpanded, setStageTimelineExpanded] = useState(false);
  const [projectMaterialMeta, setProjectMaterialMeta] = useState<Record<string, DesktopProjectMaterialMeta>>({});
  const [mentorContacts, setMentorContacts] = useState<WorkbenchMentorContact[]>([]);
  const workbenchRef = useRef<HTMLElement>(null);
  const workbenchLayoutRef = useRef<HTMLElement>(null);
  const splitterDragRef = useRef<WorkbenchSplitterDragState | null>(null);
  const splitterLatestWidthRef = useRef(DESKTOP_WORKBENCH_DEFAULT_LEFT_WIDTH);
  const inspectorRef = useRef<HTMLElement>(null);
  const inspectorCloseRef = useRef<HTMLButtonElement>(null);
  const detailReturnFocusRef = useRef<HTMLElement | null>(null);
  const detailInitialFocusRef = useRef<'close' | 'primary'>('close');
  const projectContextMenuRef = useRef<HTMLDivElement>(null);
  const lastSelectedRowRef = useRef<HTMLElement | null>(null);
  const workspaceTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeUserIdRef = useRef(userId);
  const pendingProjectIdsRef = useRef(new Set<string>());
  const projectActionTimersRef = useRef(new Map<string, number>());
  const refreshSequenceRef = useRef(0);
  const projectMaterialMetaRef = useRef<Record<string, DesktopProjectMaterialMeta>>({});
  const listScrollRef = useRef<HTMLDivElement>(null);
  const workspaceScrollRef = useRef<HTMLElement>(null);
  const pendingContextRef = useRef<(PersistedApplicationContext & { userId: string }) | null>(null);
  const contextReadyUserRef = useRef('');
  const restoringContextSelectionRef = useRef(false);
  const openedLinkedProjectRef = useRef('');
  const contextSaveTimerRef = useRef<number | null>(null);
  const contextStateRef = useRef({
    query,
    statusFilter,
    materialFilter,
    sortOption,
    hideExpired,
    selectedId,
    activeWorkspaceTab
  });

  useEffect(() => {
    const refreshDeadlineClock = () => setDeadlineNow(Date.now());
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshDeadlineClock();
    };
    const timer = window.setInterval(refreshDeadlineClock, 60_000);
    window.addEventListener('focus', refreshDeadlineClock);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshDeadlineClock);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const openRequestedApplicationDialog = () => {
      consumeDesktopNewApplicationRequest();
      setManualApplicationOpen(true);
    };

    if (consumeDesktopNewApplicationRequest()) {
      setManualApplicationOpen(true);
    }
    window.addEventListener(DESKTOP_NEW_APPLICATION_EVENT, openRequestedApplicationDialog);
    return () => {
      window.removeEventListener(DESKTOP_NEW_APPLICATION_EVENT, openRequestedApplicationDialog);
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const storedWidth = readDesktopWorkbenchPanePreference(window.localStorage);
    if (storedWidth === null) return;
    splitterLatestWidthRef.current = storedWidth;
    setPreferredMasterPaneWidth(storedWidth);
  }, []);

  useEffect(() => {
    if (!splitterDragging || typeof document === 'undefined') return;
    document.documentElement.classList.add('desktop-workbench-is-resizing');
    return () => document.documentElement.classList.remove('desktop-workbench-is-resizing');
  }, [splitterDragging]);

  const flushApplicationContext = useCallback(() => {
    if (!userId || contextReadyUserRef.current !== userId || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        `${applicationContextStoragePrefix}${encodeURIComponent(userId)}`,
        JSON.stringify({
          ...contextStateRef.current,
          listScrollTop: listScrollRef.current?.scrollTop || 0,
          workspaceScrollTop: workspaceScrollRef.current?.scrollTop || 0
        } satisfies PersistedApplicationContext)
      );
    } catch {
      // Workspace context is a convenience; storage failure must never block editing.
    }
  }, [userId]);

  const persistApplicationContext = useCallback(() => {
    if (!userId || contextReadyUserRef.current !== userId || typeof window === 'undefined') return;
    if (contextSaveTimerRef.current) window.clearTimeout(contextSaveTimerRef.current);
    contextSaveTimerRef.current = window.setTimeout(() => {
      contextSaveTimerRef.current = null;
      flushApplicationContext();
    }, 180);
  }, [flushApplicationContext, userId]);

  useEffect(() => {
    contextStateRef.current = {
      query,
      statusFilter,
      materialFilter,
      sortOption,
      hideExpired,
      selectedId,
      activeWorkspaceTab
    };
    persistApplicationContext();
  }, [
    activeWorkspaceTab,
    hideExpired,
    materialFilter,
    persistApplicationContext,
    query,
    selectedId,
    sortOption,
    statusFilter
  ]);

  useEffect(() => () => {
    if (contextSaveTimerRef.current) {
      window.clearTimeout(contextSaveTimerRef.current);
      contextSaveTimerRef.current = null;
    }
    flushApplicationContext();
  }, [flushApplicationContext]);

  useEffect(() => {
    if (contextSaveTimerRef.current !== null) {
      window.clearTimeout(contextSaveTimerRef.current);
      contextSaveTimerRef.current = null;
    }
    contextReadyUserRef.current = '';
    pendingContextRef.current = null;
    setManualApplicationOpen(false);
    setQuery('');
    setStatusFilter('全部');
    setMaterialFilter('all');
    setSortOption('priority');
    setHideExpired(false);
    setSelectedId('');
    openedLinkedProjectRef.current = '';
    setActiveWorkspaceTab('overview');
    if (!userId || typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(
        `${applicationContextStoragePrefix}${encodeURIComponent(userId)}`
      );
      const parsed = raw ? (JSON.parse(raw) as Partial<PersistedApplicationContext>) : null;
      if (parsed) {
        const restored: PersistedApplicationContext = {
          query: typeof parsed.query === 'string' ? parsed.query.slice(0, 120) : '',
          statusFilter: projectStatusFilters.includes(parsed.statusFilter as ProjectStatusFilter)
            ? parsed.statusFilter as ProjectStatusFilter
            : '全部',
          materialFilter: ['all', 'incomplete', 'complete'].includes(String(parsed.materialFilter))
            ? parsed.materialFilter as MaterialFilter
            : 'all',
          sortOption: ['priority', 'deadline', 'school', 'status'].includes(String(parsed.sortOption))
            ? parsed.sortOption as SortOption
            : 'priority',
          hideExpired: parsed.hideExpired === true,
          selectedId: typeof parsed.selectedId === 'string' ? parsed.selectedId : '',
          activeWorkspaceTab: projectWorkspaceTabs.some((tab) => tab.value === parsed.activeWorkspaceTab)
            ? parsed.activeWorkspaceTab as ProjectWorkspaceTab
            : 'overview',
          listScrollTop: Number.isFinite(parsed.listScrollTop) ? Math.max(0, Number(parsed.listScrollTop)) : 0,
          workspaceScrollTop: Number.isFinite(parsed.workspaceScrollTop) ? Math.max(0, Number(parsed.workspaceScrollTop)) : 0
        };
        setQuery(restored.query);
        setStatusFilter(restored.statusFilter);
        setMaterialFilter(restored.materialFilter);
        setSortOption(restored.sortOption);
        setHideExpired(restored.hideExpired);
        pendingContextRef.current = { ...restored, userId };
        return;
      }
    } catch {
      // Ignore malformed historical context and start from the safe defaults.
    }
    contextReadyUserRef.current = userId;
  }, [userId]);

  useEffect(() => {
    const nextProjectMaterialMeta = readDesktopProjectMeta(userId);
    projectMaterialMetaRef.current = nextProjectMaterialMeta;
    setProjectMaterialMeta(nextProjectMaterialMeta);
    if (typeof window === 'undefined' || !userId) {
      setMentorContacts([]);
      return;
    }

    try {
      const raw = readAccountScopedWorkbenchValue(WORKBENCH_CONTACTS_KEY, userId);
      const parsed = raw ? JSON.parse(raw) : [];
      setMentorContacts(
        Array.isArray(parsed)
          ? parsed.filter((item): item is WorkbenchMentorContact => Boolean(item?.id))
          : []
      );
    } catch {
      setMentorContacts([]);
    }
  }, [userId]);

  const updateMaterialMeta = useCallback(
    (projectId: string, key: keyof DesktopProjectMaterialMeta, patch: Partial<DesktopMaterialMeta>) => {
      const current = projectMaterialMetaRef.current;
      const currentProject = getDesktopProjectMaterialMeta(current, projectId);
      const nextProject = {
        ...currentProject,
        [key]: {
          ...currentProject[key],
          ...patch
        }
      } as DesktopProjectMaterialMeta;
      const next = { ...current, [projectId]: nextProject };

      if (!writeDesktopProjectMeta(userId, next)) {
        setSaveError('材料版本信息未保存，请检查本机存储空间后重试。');
        emitDesktopFeedback({
          message: '材料版本信息未保存',
          detail: '请检查本机存储空间或应用权限后重试',
          tone: 'error',
          duration: 5200
        });
        return;
      }

      setSaveError('');
      projectMaterialMetaRef.current = next;
      setProjectMaterialMeta(next);
    },
    [userId]
  );


  const refreshApplications = useCallback(async (
    options: { allowFreshCache?: boolean; bypassPendingRequest?: boolean } = {}
  ) => {
    const requestUserId = userId;
    if (!requestUserId) {
      setApplications([]);
      setLoading(false);
      setLoadError('');
      return;
    }

    const refreshSequence = ++refreshSequenceRef.current;
    const cached = getApplicationCacheEntry(requestUserId);
    const hasCachedRows = Boolean(cached);
    if (options.allowFreshCache && applicationRequestCache.isFresh(requestUserId)) {
      setApplications(cached?.value || []);
      setLoading(false);
      setLoadError('');
      emitDesktopSyncStatus('synced');
      return;
    }

    setLoadError('');
    if (!hasCachedRows) {
      setLoading(true);
    }
    emitDesktopSyncStatus('syncing');
    try {
      const rows = await fetchApplicationsForUser(requestUserId, options.bypassPendingRequest);
      if (
        activeUserIdRef.current !== requestUserId ||
        refreshSequenceRef.current !== refreshSequence
      ) {
        return;
      }
      setApplications(rows);
      emitDesktopSyncStatus('synced');
    } catch {
      if (
        activeUserIdRef.current !== requestUserId ||
        refreshSequenceRef.current !== refreshSequence
      ) {
        return;
      }
      setLoadError(
        hasCachedRows
          ? '申请项目暂时无法同步，当前显示上次同步的数据。'
          : '申请项目暂时无法同步，请检查网络后重试。'
      );
      emitDesktopSyncStatus('error');
    } finally {
      if (
        activeUserIdRef.current === requestUserId &&
        refreshSequenceRef.current === refreshSequence
      ) {
        setLoading(false);
      }
    }
  }, [setApplications, setLoadError, setLoading, userId]);

  useEffect(() => {
    activeUserIdRef.current = userId;
    refreshSequenceRef.current += 1;
    const cached = getApplicationCacheEntry(userId);
    setApplications(cached?.value || []);
    setLoading(Boolean(userId && !cached));
    setLoadError('');

    if (!userId) {
      return;
    }

    const forceRequested = consumeDesktopApplicationSyncRequest();
    void refreshApplications(
      forceRequested
        ? { bypassPendingRequest: true }
        : { allowFreshCache: true }
    );
    const dispose = watchApplicationTable(() => void refreshApplications());
    return () => {
      dispose();
      // The module-level request stays alive so a quick return can reuse it and
      // its result can still populate the cache for this exact account.
      if (activeUserIdRef.current === userId) {
        activeUserIdRef.current = '';
      }
    };
  }, [refreshApplications, setApplications, setLoadError, setLoading, userId]);

  useEffect(() => {
    const handleSyncRequest = () => {
      consumeDesktopApplicationSyncRequest();
      void refreshApplications({ bypassPendingRequest: true });
    };
    window.addEventListener(DESKTOP_APPLICATION_SYNC_EVENT, handleSyncRequest);
    return () => window.removeEventListener(DESKTOP_APPLICATION_SYNC_EVENT, handleSyncRequest);
  }, [refreshApplications]);

  const matchesActiveApplicationFilters = useCallback((row: ApplicationRow) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (statusFilter !== '全部' && row.item.myStatus !== statusFilter) return false;
    const materialCount = getCompletedMaterialCount(row);
    if (materialFilter === 'incomplete' && materialCount === materialChecklistDefinitions.length) return false;
    if (materialFilter === 'complete' && materialCount !== materialChecklistDefinitions.length) return false;
    if (!normalizedQuery) return true;

    return [
      row.project.schoolName,
      row.project.departmentName,
      row.project.projectName,
      row.project.discipline
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);
  }, [materialFilter, query, statusFilter]);

  const expiredMatchingCount = useMemo(
    () => getDesktopExpiredApplicationCount(
      applications.filter((row) => matchesActiveApplicationFilters(row)),
      (row) => row.project.deadlineDate,
      deadlineNow
    ),
    [applications, deadlineNow, matchesActiveApplicationFilters]
  );

  const filteredRows = useMemo(() => {
    const nextRows = filterDesktopExpiredApplications(
      applications.filter((row) => matchesActiveApplicationFilters(row)),
      hideExpired,
      (row) => row.project.deadlineDate,
      deadlineNow
    );

    return nextRows.sort((left, right) => {
      if (sortOption === 'priority') {
        const leftJourney = getApplicationJourney(
          left,
          getDesktopProjectMaterialMeta(projectMaterialMeta, left.item.userProjectId)
        );
        const rightJourney = getApplicationJourney(
          right,
          getDesktopProjectMaterialMeta(projectMaterialMeta, right.item.userProjectId)
        );
        const journeyDistance = getJourneyPriorityRank(leftJourney) - getJourneyPriorityRank(rightJourney);
        if (journeyDistance) return journeyDistance;
        if (left.item.priorityLevel !== right.item.priorityLevel) {
          return left.item.priorityLevel === '高' ? -1 : right.item.priorityLevel === '高' ? 1 : 0;
        }
      }
      if (sortOption === 'school') {
        return getDisplaySchoolName(left.project.schoolName).localeCompare(
          getDisplaySchoolName(right.project.schoolName),
          'zh-CN'
        );
      }
      if (sortOption === 'status') {
        return userStatusOptions.indexOf(left.item.myStatus) - userStatusOptions.indexOf(right.item.myStatus);
      }
      return getDeadlineTimestamp(left.project.deadlineDate) - getDeadlineTimestamp(right.project.deadlineDate);
    });
  }, [applications, deadlineNow, hideExpired, matchesActiveApplicationFilters, projectMaterialMeta, sortOption]);

  useEffect(() => {
    const pendingContext = pendingContextRef.current;
    if (!filteredRows.length) {
      const shouldRestoreFocus = inspectorOpen;
      setSelectedId('');
      setInspectorOpen(false);
      if (shouldRestoreFocus) {
        window.requestAnimationFrame(() => {
          document.querySelector<HTMLElement>('[data-desktop-view-search]')?.focus();
        });
      }
      if (pendingContext?.userId === userId) {
        setActiveWorkspaceTab(pendingContext.activeWorkspaceTab);
        pendingContextRef.current = null;
        contextReadyUserRef.current = userId;
      }
      return;
    }
    if (pendingContext?.userId === userId) {
      restoringContextSelectionRef.current = true;
      setSelectedId(
        pendingContext.selectedId
          ? getNextVisibleDesktopApplicationId(
              filteredRows,
              pendingContext.selectedId,
              (row) => row.item.userProjectId
            )
          : ''
      );
      setActiveWorkspaceTab(pendingContext.activeWorkspaceTab);
      pendingContextRef.current = null;
      contextReadyUserRef.current = userId;
      window.requestAnimationFrame(() => {
        if (listScrollRef.current) listScrollRef.current.scrollTop = pendingContext.listScrollTop;
        if (workspaceScrollRef.current) workspaceScrollRef.current.scrollTop = pendingContext.workspaceScrollTop;
      });
      return;
    }
    const selectedStillVisible = !selectedId || filteredRows.some(
      (row) => row.item.userProjectId === selectedId
    );
    if (!selectedStillVisible) {
      const shouldRestoreFocus = inspectorOpen;
      setSelectedId('');
      setInspectorOpen(false);
      if (shouldRestoreFocus) {
        window.requestAnimationFrame(() => {
          const firstVisibleRow = filteredRows[0]
            ? document.getElementById(`desktop-project-row-${filteredRows[0].item.userProjectId}`)
            : null;
          (firstVisibleRow || document.querySelector<HTMLElement>('[data-desktop-view-search]'))?.focus();
        });
      }
    }
  }, [filteredRows, inspectorOpen, selectedId, userId]);

  const selectedRow =
    filteredRows.find((row) => row.item.userProjectId === selectedId) || null;
  const onlyExpiredProjectsHidden =
    hideExpired && expiredMatchingCount > 0 && filteredRows.length === 0;

  const selectedMaterialMeta = selectedRow
    ? getDesktopProjectMaterialMeta(projectMaterialMeta, selectedRow.item.userProjectId)
    : createDefaultProjectMaterialMeta();

  const downloadMaterialManifest = useCallback(
    (row: ApplicationRow) => {
      const meta = getDesktopProjectMaterialMeta(projectMaterialMeta, row.item.userProjectId);
      const text = createMaterialManifest(
        normalizeNoticeTitle(row.project.projectName, 120),
        getDisplaySchoolName(row.project.schoolName),
        meta
      );
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${getDisplaySchoolName(row.project.schoolName)}-材料包清单.txt`;
      anchor.click();
      URL.revokeObjectURL(url);
      emitDesktopFeedback({
        message: '材料包清单已生成',
        detail: '请在官方报名系统完成最终文件提交。',
        tone: 'success'
      });
    },
    [projectMaterialMeta]
  );

  useEffect(() => {
    setStageTimelineExpanded(false);
    if (restoringContextSelectionRef.current) {
      restoringContextSelectionRef.current = false;
      return;
    }
    setActiveWorkspaceTab('overview');
  }, [selectedId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('project');
    const linkedRow = projectId
      ? filteredRows.find(
          (row) => row.item.userProjectId === projectId || row.project.id === projectId
        )
      : null;
    if (projectId && linkedRow && openedLinkedProjectRef.current !== projectId) {
      openedLinkedProjectRef.current = projectId;
      setSelectedId(linkedRow.item.userProjectId);
      detailInitialFocusRef.current = 'close';
      setInspectorOpen(true);
    }

    const focus = params.get('focus');
    if (
      focus === 'materials' ||
      focus === 'schedule' ||
      focus === 'contacts' ||
      focus === 'activity'
    ) {
      setActiveWorkspaceTab(focus);
    }
  }, [filteredRows]);

  useEffect(() => {
    const handleFocusProjectTab = (event: Event) => {
      const tab = (event as CustomEvent<string>).detail;
      if (tab === 'materials' || tab === 'schedule' || tab === 'contacts' || tab === 'activity') {
        setActiveWorkspaceTab(tab);
        if (selectedId) {
          detailInitialFocusRef.current = 'close';
          setInspectorOpen(true);
        }
      }
    };
    window.addEventListener('seekoffer-focus-project-tab', handleFocusProjectTab);
    return () => window.removeEventListener('seekoffer-focus-project-tab', handleFocusProjectTab);
  }, [selectedId]);

  const focusSelectedRow = useCallback(() => {
    window.requestAnimationFrame(() => {
      const selectedElement = selectedId
        ? document.getElementById(`desktop-project-row-${selectedId}`)
        : null;
      const fallback = document.querySelector<HTMLElement>('[data-desktop-view-search]');
      const focusTarget = [detailReturnFocusRef.current, selectedElement, lastSelectedRowRef.current, fallback].find(
        (element): element is HTMLElement =>
          Boolean(
            element &&
            element.isConnected &&
            element.offsetParent !== null &&
            !element.closest('[inert]')
          )
      );
      focusTarget?.focus();
    });
  }, [selectedId]);

  const openProjectInspector = useCallback((
    row: ApplicationRow,
    trigger?: HTMLElement | null,
    focusPrimary = false
  ) => {
    const activeElement = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : null;
    const rowElement = document.getElementById(`desktop-project-row-${row.item.userProjectId}`);
    detailReturnFocusRef.current = trigger || rowElement || activeElement;
    lastSelectedRowRef.current = rowElement;
    detailInitialFocusRef.current = focusPrimary ? 'primary' : 'close';
    setSelectedId(row.item.userProjectId);
    setInspectorOpen(true);
  }, []);

  const closeProjectContextMenu = useCallback((restoreFocus = false) => {
    const rowId = projectContextMenu?.row.item.userProjectId;
    setProjectContextMenu(null);
    if (restoreFocus && rowId) {
      window.requestAnimationFrame(() => {
        document.getElementById(`desktop-project-row-${rowId}`)?.focus();
      });
    }
  }, [projectContextMenu]);

  const openProjectContextMenu = useCallback((row: ApplicationRow, clientX: number, clientY: number) => {
    const menuWidth = 248;
    const menuHeight = 286;
    const viewportWidth = document.documentElement.clientWidth || window.visualViewport?.width || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.visualViewport?.height || window.innerHeight;
    const { left, top } = clampDesktopFloatingSurface(
      clientX,
      clientY,
      viewportWidth,
      viewportHeight,
      menuWidth,
      menuHeight
    );
    setSelectedId(row.item.userProjectId);
    lastSelectedRowRef.current = document.getElementById(`desktop-project-row-${row.item.userProjectId}`);
    setProjectContextMenu({ row, left, top });
  }, []);

  useLayoutEffect(() => {
    const menu = projectContextMenuRef.current;
    if (!projectContextMenu || !menu) return;
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth =
      document.documentElement.clientWidth || window.visualViewport?.width || window.innerWidth;
    const viewportHeight =
      document.documentElement.clientHeight || window.visualViewport?.height || window.innerHeight;
    const nextPosition = clampDesktopFloatingSurface(
      projectContextMenu.left,
      projectContextMenu.top,
      viewportWidth,
      viewportHeight,
      menuRect.width,
      menuRect.height
    );
    if (
      Math.abs(nextPosition.left - projectContextMenu.left) < 0.5 &&
      Math.abs(nextPosition.top - projectContextMenu.top) < 0.5
    ) {
      return;
    }
    setProjectContextMenu((current) => current ? { ...current, ...nextPosition } : current);
  }, [projectContextMenu]);

  useEffect(() => {
    if (!projectContextMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (!target || !projectContextMenuRef.current?.contains(target)) {
        closeProjectContextMenu(false);
      }
    };
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      closeProjectContextMenu(true);
    };
    const handleViewportChange = () => closeProjectContextMenu(false);

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape, true);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    const frame = window.requestAnimationFrame(() => {
      projectContextMenuRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]')
        ?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape, true);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [closeProjectContextMenu, projectContextMenu]);

  function handleProjectContextMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      closeProjectContextMenu(true);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')
    );
    if (!items.length) return;
    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowDown'
            ? (Math.max(currentIndex, -1) + 1) % items.length
            : currentIndex <= 0
              ? items.length - 1
              : currentIndex - 1;
    items[nextIndex]?.focus();
  }

  const setProjectActionState = useCallback((
    projectId: string,
    state: ProjectActionState | null,
    clearAfter = 0
  ) => {
    const existingTimer = projectActionTimersRef.current.get(projectId);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
      projectActionTimersRef.current.delete(projectId);
    }

    setProjectActionStates((current) => {
      if (state) return { ...current, [projectId]: state };
      const next = { ...current };
      delete next[projectId];
      return next;
    });

    if (state && clearAfter > 0) {
      const timer = window.setTimeout(() => {
        projectActionTimersRef.current.delete(projectId);
        setProjectActionStates((current) => {
          if (current[projectId] !== state) return current;
          const next = { ...current };
          delete next[projectId];
          return next;
        });
      }, clearAfter);
      projectActionTimersRef.current.set(projectId, timer);
    }
  }, []);

  useEffect(() => () => {
    projectActionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    projectActionTimersRef.current.clear();
  }, []);

  useEffect(() => {
    pendingProjectIdsRef.current.clear();
    projectActionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    projectActionTimersRef.current.clear();
    setProjectActionStates({});
  }, [userId]);

  async function updateProjectRecord(
    targetRow: ApplicationRow,
    patch: ProjectPatch,
    fieldKey: string,
    options: ProjectUpdateOptions = {}
  ) {
    const projectId = targetRow.item.userProjectId;
    if (pendingProjectIdsRef.current.has(projectId)) return false;

    const currentRows = applicationsRef.current;
    const currentTarget = currentRows.find((row) => row.item.userProjectId === projectId) || targetRow;
    const previousPatch = createPreviousProjectPatch(currentTarget.item, patch);
    const optimisticApplications = applyProjectPatch(currentRows, projectId, patch);

    pendingProjectIdsRef.current.add(projectId);
    setSaveError('');
    setProjectActionState(projectId, {
      phase: 'pending',
      fieldKey,
      message: `${getProjectActionCopy(fieldKey)}保存中`
    });
    setApplications(optimisticApplications);
    if (userId) applicationRequestCache.set(userId, optimisticApplications, 0);
    emitDesktopSyncStatus('syncing');

    try {
      await trackDesktopPendingWrite('home-project-update', () =>
        updateUserProject(projectId, patch)
      );

      const persistedApplications = applyProjectPatch(applicationsRef.current, projectId, patch);
      setApplications(persistedApplications);
      if (userId) {
        applicationRequestCache.set(userId, persistedApplications, 0);
      }
      emitDesktopSyncStatus('synced');
      setProjectActionState(projectId, {
        phase: 'success',
        fieldKey,
        message: options.isUndo
          ? `${getProjectActionCopy(fieldKey)}已撤销`
          : `${getProjectActionCopy(fieldKey)}已保存`
      }, 1600);

      const allowUndo = options.allowUndo !== false && !options.isUndo;
      emitDesktopFeedback({
        message: options.isUndo
          ? `${getProjectActionCopy(fieldKey)}已撤销`
          : `${getProjectActionCopy(fieldKey)}已更新`,
        detail: getDisplaySchoolName(currentTarget.project.schoolName),
        tone: options.isUndo ? 'neutral' : 'success',
        state: options.isUndo ? 'undo' : 'success',
        group: `project-update:${projectId}`,
        duration: allowUndo ? 5200 : 2600,
        actionLabel: allowUndo ? '撤销' : undefined,
        actionAnnouncement: allowUndo ? `${getProjectActionCopy(fieldKey)}修改已撤销` : undefined,
        onAction: allowUndo
          ? async () => {
              if (activeUserIdRef.current !== userId) return;
              const latestRow = applicationsRef.current.find(
                (row) => row.item.userProjectId === projectId
              );
              if (!latestRow) return;
              await updateProjectRecord(latestRow, previousPatch, fieldKey, {
                allowUndo: false,
                isUndo: true
              });
            }
          : undefined
      });
      return true;
    } catch {
      const restoredApplications = restoreProjectPatch(
        applicationsRef.current,
        projectId,
        previousPatch
      );
      setApplications(restoredApplications);
      if (userId) {
        applicationRequestCache.set(userId, restoredApplications, 0);
      }
      setSaveError('本次修改未保存，请检查网络后重试。');
      emitDesktopSyncStatus('error');
      setProjectActionState(projectId, {
        phase: 'error',
        fieldKey,
        message: `${getProjectActionCopy(fieldKey)}未保存`
      }, 4200);
      emitDesktopFeedback({
        message: '修改未保存',
        detail: '仅本次字段已恢复，其他项目和修改保持不变',
        tone: 'error',
        duration: 5200
      });
      return false;
    } finally {
      pendingProjectIdsRef.current.delete(projectId);
    }
  }

  async function updateSelectedProject(
    patch: ProjectPatch,
    fieldKey: string
  ) {
    if (!selectedRow) return;
    await updateProjectRecord(selectedRow, patch, fieldKey);
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLDivElement>, index: number, row: ApplicationRow) {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openProjectInspector(row, event.currentTarget, true);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? filteredRows.length - 1
          : event.key === 'ArrowDown'
        ? Math.min(filteredRows.length - 1, index + 1)
        : Math.max(0, index - 1);
    const nextRow = filteredRows[nextIndex];
    setSelectedId(nextRow.item.userProjectId);
    const nextElement = document.getElementById(`desktop-project-row-${nextRow.item.userProjectId}`);
    lastSelectedRowRef.current = nextElement;
    nextElement?.focus();
  }

  const compactInspector = layoutMode === 'drawer';
  const measuredWorkbenchLayoutWidth = workbenchLayoutWidth ||
    DESKTOP_WORKBENCH_DEFAULT_LEFT_WIDTH + DESKTOP_WORKBENCH_MIN_RIGHT_WIDTH;
  const splitterBounds = getDesktopWorkbenchPaneBounds(measuredWorkbenchLayoutWidth);
  const masterPaneWidth = clampDesktopWorkbenchLeftPaneWidth(
    preferredMasterPaneWidth,
    measuredWorkbenchLayoutWidth
  );
  const workbenchLayoutStyle = {
    '--desktop-master-width': `${masterPaneWidth}px`
  } as CSSProperties;

  useEffect(() => {
    const element = workbenchRef.current;
    if (!element) return;
    if (typeof ResizeObserver === 'undefined') return;

    const updateLayoutMode = () => {
      const width = element.getBoundingClientRect().width;
      const layoutWidth = workbenchLayoutRef.current?.getBoundingClientRect().width || width;
      const nextMode: DesktopLayoutMode = zoomLevel >= 150 || width < 980
        ? 'drawer'
        : width < 1220
          ? 'split'
          : 'wide';
      setWorkbenchLayoutWidth((current) =>
        Math.abs(current - layoutWidth) < 0.5 ? current : layoutWidth
      );
      setLayoutMode((current) => (current === nextMode ? current : nextMode));
    };

    updateLayoutMode();
    const observer = new ResizeObserver(updateLayoutMode);
    observer.observe(element);
    return () => observer.disconnect();
  }, [zoomLevel]);

  function persistWorkbenchPaneWidth(leftPaneWidth: number) {
    if (typeof window === 'undefined') return;
    writeDesktopWorkbenchPanePreference(window.localStorage, leftPaneWidth);
  }

  function handleSplitterPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (compactInspector || event.button !== 0) return;
    const layout = workbenchLayoutRef.current;
    if (!layout) return;

    const bounds = layout.getBoundingClientRect();
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    splitterLatestWidthRef.current = masterPaneWidth;
    splitterDragRef.current = {
      pointerId: event.pointerId,
      layoutLeft: bounds.left,
      layoutWidth: bounds.width,
      startPreferredWidth: preferredMasterPaneWidth
    };
    setSplitterDragging(true);
  }

  function handleSplitterPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = splitterDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const nextWidth = clampDesktopWorkbenchLeftPaneWidth(
      event.clientX - drag.layoutLeft,
      drag.layoutWidth
    );
    if (nextWidth === splitterLatestWidthRef.current) return;
    splitterLatestWidthRef.current = nextWidth;
    setPreferredMasterPaneWidth(nextWidth);
  }

  function finishSplitterPointerInteraction(
    event: ReactPointerEvent<HTMLDivElement>,
    cancelled = false
  ) {
    const drag = splitterDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    splitterDragRef.current = null;
    setSplitterDragging(false);

    const nextWidth = cancelled ? drag.startPreferredWidth : splitterLatestWidthRef.current;
    splitterLatestWidthRef.current = nextWidth;
    setPreferredMasterPaneWidth(nextWidth);
    if (!cancelled) persistWorkbenchPaneWidth(nextWidth);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleSplitterLostPointerCapture(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = splitterDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    splitterDragRef.current = null;
    setSplitterDragging(false);
    persistWorkbenchPaneWidth(splitterLatestWidthRef.current);
  }

  function handleSplitterKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (compactInspector) return;
    const nextWidth = getDesktopWorkbenchKeyboardPaneWidth({
      key: event.key,
      shiftKey: event.shiftKey,
      currentWidth: masterPaneWidth,
      layoutWidth: measuredWorkbenchLayoutWidth
    });
    if (nextWidth === null) return;
    event.preventDefault();
    splitterLatestWidthRef.current = nextWidth;
    setPreferredMasterPaneWidth(nextWidth);
    persistWorkbenchPaneWidth(nextWidth);
  }

  function resetWorkbenchPaneWidth() {
    splitterLatestWidthRef.current = DESKTOP_WORKBENCH_DEFAULT_LEFT_WIDTH;
    setPreferredMasterPaneWidth(DESKTOP_WORKBENCH_DEFAULT_LEFT_WIDTH);
    persistWorkbenchPaneWidth(DESKTOP_WORKBENCH_DEFAULT_LEFT_WIDTH);
  }

  useEffect(() => {
    if (inspectorOpen) return;
    const activeElement = document.activeElement;
    if (activeElement instanceof Node && inspectorRef.current?.contains(activeElement)) {
      focusSelectedRow();
    }
  }, [focusSelectedRow, inspectorOpen]);

  useEffect(() => {
    if (!inspectorOpen) return;

    const focusFrame = window.requestAnimationFrame(() => {
      const primary = inspectorRef.current?.querySelector<HTMLElement>('[data-project-detail-primary]');
      if (detailInitialFocusRef.current === 'primary' && primary) {
        primary.focus({ preventScroll: true });
      } else {
        inspectorCloseRef.current?.focus({ preventScroll: true });
      }
    });
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== 'Escape') return;
      event.preventDefault();
      setInspectorOpen(false);
      focusSelectedRow();
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [focusSelectedRow, inspectorOpen]);

  useEffect(() => {
    const modalOpen = compactInspector && inspectorOpen;
    emitDesktopModalState('workbench-project-inspector', modalOpen);
    return () => {
      if (modalOpen) emitDesktopModalState('workbench-project-inspector', false);
    };
  }, [compactInspector, inspectorOpen]);

  function closeCompactInspector() {
    setInspectorOpen(false);
    focusSelectedRow();
  }

  function handleInspectorKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!compactInspector || event.key !== 'Tab') return;

    const focusableElements = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),select:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => element.offsetParent !== null && element.tabIndex >= 0);
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

  function handleWorkspaceTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? projectWorkspaceTabs.length - 1
          : event.key === 'ArrowRight'
            ? (index + 1) % projectWorkspaceTabs.length
            : (index - 1 + projectWorkspaceTabs.length) % projectWorkspaceTabs.length;
    const nextTab = projectWorkspaceTabs[nextIndex];
    setActiveWorkspaceTab(nextTab.value);
    workspaceTabRefs.current[nextIndex]?.focus();
  }

  function isProjectActionPending(row: ApplicationRow, fieldKey?: string) {
    const state = projectActionStates[row.item.userProjectId];
    return state?.phase === 'pending' && (!fieldKey || state.fieldKey === fieldKey);
  }

  function renderMaterialChecklist(row: ApplicationRow) {
    return (
      <div className="desktop-project-workspace-checklist">
        {materialChecklistDefinitions.map((item) => {
          const checked = row.item[item.key];
          return (
            <button
              key={item.key}
              type="button"
              className="desktop-project-material-row"
              aria-pressed={checked}
              disabled={isProjectActionPending(row, item.key)}
              onClick={() =>
                void updateSelectedProject(
                  { [item.key]: !checked } as Partial<Record<MaterialChecklistKey, boolean>>,
                  item.key
                )
              }
            >
              <span aria-hidden="true">
                {checked ? <Checkmark20Regular /> : null}
              </span>
              <span>{item.label}</span>
              <small>{checked ? '已完成' : '待处理'}</small>
            </button>
          );
        })}
      </div>
    );
  }

  const selectedMaterialCount = selectedRow ? getCompletedMaterialCount(selectedRow) : 0;
  const selectedJourney: ApplicationJourney | null = selectedRow
    ? getApplicationJourney(selectedRow, selectedMaterialMeta)
    : null;
  const selectedJourneyProgress = selectedJourney
    ? getApplicationJourneyProgress(selectedJourney)
    : null;
  const selectedStageIndex = selectedJourney?.stageIndex || 0;
  const relatedMentors = selectedRow
    ? mentorContacts
        .filter((contact) => contact.schoolName && getDisplaySchoolName(contact.schoolName) === getDisplaySchoolName(selectedRow.project.schoolName))
        .slice(0, 3)
    : [];
  const hasHardLoadError = Boolean(loadError && !loading && applications.length === 0);

  async function openOfficialProject(row: ApplicationRow) {
    const href = getProjectHref(row);
    if (href !== '/') {
      emitDesktopRouteChange(href);
      router.push(href);
      return;
    }

    const externalHref = row.project.applyLink || row.project.sourceLink;
    if (externalHref) {
      if ('__TAURI_INTERNALS__' in window) {
        await import('@tauri-apps/plugin-opener')
          .then(({ openUrl }) => openUrl(externalHref))
          .catch(() => window.open(externalHref, '_blank', 'noopener,noreferrer'));
      } else {
        window.open(externalHref, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    setActiveWorkspaceTab('overview');
    emitDesktopFeedback({
      message: '这个手动项目还没有报名入口',
      detail: '请在项目概览或日程中补充官方报名链接',
      tone: 'warning'
    });
  }

  async function handleJourneyAction(row: ApplicationRow, journey: ApplicationJourney) {
    if (journey.command === 'resume_application') {
      await updateProjectRecord(row, { myStatus: '已收藏' }, 'status');
      return;
    }
    if (journey.command === 'open_notice') {
      await openOfficialProject(row);
      return;
    }

    setActiveWorkspaceTab(journey.tab);
  }

  async function handleApplicationCardJourneyAction(
    row: ApplicationRow,
    journey: ApplicationJourney,
    trigger: HTMLElement
  ) {
    if (journey.command === 'resume_application' || journey.command === 'open_notice') {
      await handleJourneyAction(row, journey);
      return;
    }

    openProjectInspector(row, trigger, true);
    window.requestAnimationFrame(() => setActiveWorkspaceTab(journey.tab));
  }

  function openProjectFromContext(row: ApplicationRow) {
    closeProjectContextMenu(false);
    openProjectInspector(
      row,
      document.getElementById(`desktop-project-row-${row.item.userProjectId}`),
      true
    );
  }

  async function copyProjectNameFromContext(row: ApplicationRow) {
    const text = `${getDisplaySchoolName(row.project.schoolName)} · ${normalizeNoticeTitle(row.project.projectName, 120)}`;
    try {
      await navigator.clipboard.writeText(text);
      emitDesktopFeedback({ message: '项目名称已复制', detail: text, tone: 'success' });
    } catch {
      emitDesktopFeedback({ message: '复制失败', detail: '请检查系统剪贴板权限后重试', tone: 'warning' });
    }
    closeProjectContextMenu(false);
  }

  function handleManualApplicationCreated(result: ManualApplicationCreationResult) {
    if (
      !result.ownerUserId ||
      result.ownerUserId !== userId ||
      activeUserIdRef.current !== result.ownerUserId
    ) {
      emitDesktopFeedback({
        message: '账号已发生变化',
        detail: '申请已保存在原账号的本机工作区，请切回该账号查看。',
        tone: 'warning',
        duration: 5200
      });
      return;
    }

    const createdRow: ApplicationRow = { item: result.item, project: result.project };
    const creationNow = Date.now();
    const revealExpiredCreatedProject =
      hideExpired && isDesktopApplicationExpired(result.project.deadlineDate, creationNow);
    const latestLocalRows = readLocalApplicationRows(result.ownerUserId);
    const nextApplications = [
      ...latestLocalRows.filter((row) => row.item.userProjectId !== result.item.userProjectId),
      createdRow
    ].sort((left, right) => left.project.deadlineDate.localeCompare(right.project.deadlineDate));

    if (result.ownerUserId) {
      // Show the completed user action immediately. Mark the cache stale so a
      // bounded background refresh can reconcile the remote copy without ever
      // replacing the workbench with another full-page loading state.
      applicationRequestCache.set(result.ownerUserId, nextApplications, 0);
    }
    setApplications(nextApplications);
    setQuery('');
    setStatusFilter('全部');
    setMaterialFilter('all');
    if (revealExpiredCreatedProject) setHideExpired(false);
    setDeadlineNow(creationNow);
    setSelectedId(result.item.userProjectId);
    setActiveWorkspaceTab('overview');
    setSaveError('');
    detailInitialFocusRef.current = 'close';
    setInspectorOpen(true);

    emitDesktopSyncStatus(result.synced ? 'synced' : result.syncPending ? 'syncing' : 'local');
    const persistenceDetail = result.synced
      ? '已加入全部申请并同步到你的账号'
      : result.syncPending
        ? '已安全保存到本机，正在后台同步到你的账号'
        : '已安全保存到本机，可稍后重新同步';
    emitDesktopFeedback({
      message: revealExpiredCreatedProject ? '申请已添加并显示' : '申请已添加',
      detail: revealExpiredCreatedProject
        ? `${persistenceDetail}。该项目已经截止，已暂时关闭“隐藏截止项目”并选中，方便你确认记录。`
        : persistenceDetail,
      tone: 'success',
      duration: revealExpiredCreatedProject ? 6200 : 4400
    });
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      ref={workbenchRef}
      data-layout-mode={layoutMode}
      data-detail-open={inspectorOpen ? 'true' : 'false'}
      className="desktop-route-content desktop-core-page desktop-core-page--fixed desktop-workbench-page desktop-qq-workbench outline-none"
    >
      <section
        ref={workbenchLayoutRef}
        className="desktop-workbench-layout desktop-qq-workbench-layout"
        style={workbenchLayoutStyle}
      >
        <section
          id="desktop-application-context"
          className="desktop-project-board desktop-application-context"
          inert={compactInspector && inspectorOpen ? true : undefined}
          aria-hidden={compactInspector && inspectorOpen ? true : undefined}
          aria-label="申请项目列表"
        >
          <header className="desktop-core-page-header desktop-page-header desktop-page-header--embedded desktop-application-context-header">
            <div className="desktop-page-header-copy desktop-application-context-copy">
              <div className="desktop-page-header-title-row">
                <h1 className="desktop-page-header-title">全部申请</h1>
                <span className="desktop-page-header-count desktop-application-context-count">
                  {loading
                    ? '正在同步'
                    : filteredRows.length === applications.length
                      ? applications.length
                      : `${filteredRows.length}/${applications.length}`}
                  </span>
              </div>
            </div>
            <button
              type="button"
              className="desktop-page-header-primary desktop-application-context-add"
              aria-label="手动添加申请项目"
              aria-haspopup="dialog"
              aria-expanded={manualApplicationOpen}
              onClick={() => setManualApplicationOpen(true)}
            >
              <Add20Regular aria-hidden="true" />
              <span>添加</span>
            </button>
          </header>

          <div className="desktop-project-toolbar desktop-application-context-toolbar">
            <label className="desktop-project-search">
              <Search20Regular aria-hidden="true" />
              <span className="sr-only">搜索申请项目</span>
              <input
                value={query}
                data-desktop-view-search
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索学校、学院或项目"
              />
            </label>

            <div className="desktop-application-filter-row">
              <label className="desktop-project-filter">
                <span className="sr-only">申请状态</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ProjectStatusFilter)}>
                  {projectStatusFilters.map((item) => (
                    <option key={item} value={item}>{item === '全部' ? '全部状态' : item}</option>
                  ))}
                </select>
              </label>

              <label className="desktop-project-filter">
                <span className="sr-only">材料完成度</span>
                <select value={materialFilter} onChange={(event) => setMaterialFilter(event.target.value as MaterialFilter)}>
                  <option value="all">全部材料</option>
                  <option value="incomplete">材料未齐</option>
                  <option value="complete">材料已齐</option>
                </select>
              </label>

              <label className="desktop-project-filter desktop-project-sort">
                <span className="sr-only">项目排序</span>
                <select value={sortOption} onChange={(event) => setSortOption(event.target.value as SortOption)}>
                  <option value="priority">优先推荐</option>
                  <option value="deadline">按截止时间</option>
                  <option value="school">按学校名称</option>
                  <option value="status">按申请状态</option>
                </select>
              </label>
            </div>

            <button
              type="button"
              className="desktop-expired-project-toggle"
              aria-pressed={hideExpired}
              aria-describedby="desktop-expired-project-filter-status"
              onClick={() => {
                setDeadlineNow(Date.now());
                setHideExpired((current) => !current);
              }}
            >
              <span className="desktop-expired-project-toggle-copy">
                <EyeOff20Regular aria-hidden="true" />
                <span>隐藏截止项目</span>
              </span>
              <span className="desktop-expired-project-toggle-count" aria-hidden="true">
                {hideExpired ? `已隐藏 ${expiredMatchingCount} 个` : `${expiredMatchingCount} 个已截止`}
              </span>
              <span className="desktop-expired-project-switch" aria-hidden="true">
                <i />
              </span>
            </button>
            <span
              id="desktop-expired-project-filter-status"
              className="sr-only"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {hideExpired
                ? `已隐藏当前筛选条件下的 ${expiredMatchingCount} 个截止项目，申请数据未被删除`
                : `当前显示截止项目，共 ${expiredMatchingCount} 个`}
            </span>
          </div>

          {loadError && applications.length > 0 ? (
            <div
              className="desktop-workbench-error desktop-workbench-stale-state"
              role="status"
              aria-live="polite"
            >
              <span>{loadError}</span>
              <button type="button" onClick={() => void refreshApplications()}>
                重试同步
              </button>
            </div>
          ) : null}

          <div
            className="desktop-project-table desktop-application-object-list"
            role="grid"
            aria-label="全部申请项目"
            aria-rowcount={filteredRows.length}
            aria-colcount={1}
            aria-busy={loading}
          >
            {!loading && !loadError ? (
              <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {`已加载 ${filteredRows.length} 个申请项目`}
              </span>
            ) : null}
            <div
              ref={listScrollRef}
              className="desktop-project-table-body"
              onScroll={persistApplicationContext}
            >
              {loading ? (
                <div
                  className="desktop-workbench-loading-state"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                  aria-atomic="true"
                >
                  <div className="desktop-workbench-loading-heading">
                    <span className="desktop-workbench-loading-icon" aria-hidden="true">
                      <ArrowSync20Regular />
                    </span>
                    <span>
                      <strong>正在同步申请</strong>
                      <small>正在读取项目、材料与截止时间</small>
                    </span>
                  </div>
                  <div className="desktop-workbench-loading-rows" aria-hidden="true">
                    {Array.from({ length: 5 }, (_, index) => (
                      <div key={index} className="desktop-workbench-loading-row">
                        <i />
                        <span>
                          <b />
                          <em />
                          <small />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : hasHardLoadError ? (
                <div className="desktop-workbench-error desktop-workbench-error-state" role="alert">
                  <DocumentText20Regular aria-hidden="true" />
                  <div>
                    <strong>暂时无法加载申请项目</strong>
                    <p>{loadError}</p>
                  </div>
                  <button type="button" onClick={() => void refreshApplications()}>
                    重试同步
                  </button>
                </div>
              ) : filteredRows.length ? (
                filteredRows.map((row, index) => {
                  const selected = row.item.userProjectId === selectedRow?.item.userProjectId;
                  const rowJourney = getApplicationJourney(
                    row,
                    getDesktopProjectMaterialMeta(projectMaterialMeta, row.item.userProjectId)
                  );
                  const projectTitle = normalizeNoticeTitle(row.project.projectName, 180);
                  const deadlineLabel = formatApplicationListDeadline(row.project.deadlineDate);
                  const deadlineDistance = formatApplicationDeadlineDistance(
                    row.project.deadlineDate,
                    deadlineNow
                  );
                  const deadlineExpired = isDesktopApplicationExpired(
                    row.project.deadlineDate,
                    deadlineNow
                  );
                  const deadlineFullLabel = formatNoticeDateOnly(row.project.deadlineDate);
                  const completedMaterialCount = getCompletedMaterialCount(row);
                  const totalMaterialCount = materialChecklistDefinitions.length;
                  const materialProgressPercent = totalMaterialCount
                    ? Math.round((completedMaterialCount / totalMaterialCount) * 100)
                    : 0;
                  const priorityMeta = getApplicationPriorityMeta(row.item.priorityLevel);
                  const actionExpired = deadlineExpired && rowJourney.state === 'active';
                  const cardAction = actionExpired ? '申请已截止' : rowJourney.action;
                  const cardActionDetail = actionExpired
                    ? '申请记录已保留，可继续查看和复盘'
                    : rowJourney.detail;
                  const rowActionState = projectActionStates[row.item.userProjectId];
                  return (
                    <div
                      id={`desktop-project-row-${row.item.userProjectId}`}
                      key={row.item.userProjectId}
                      role="row"
                      tabIndex={selected || (!selectedId && index === 0) ? 0 : -1}
                      aria-selected={selected}
                      aria-controls="desktop-project-workspace"
                      aria-expanded={inspectorOpen && selected}
                      aria-busy={rowActionState?.phase === 'pending'}
                      aria-describedby={rowActionState ? `desktop-project-action-${row.item.userProjectId}` : undefined}
                      aria-rowindex={index + 1}
                      data-action-state={rowActionState?.phase || 'idle'}
                      data-action-field={rowActionState?.fieldKey || undefined}
                      aria-label={`${getDisplaySchoolName(row.project.schoolName)}，${getDisplayNoticeDepartment(row.project)}，${projectTitle}，当前状态：${row.item.myStatus}，当前待办：${cardAction}，截止：${deadlineFullLabel}，${deadlineDistance}，材料已准备 ${completedMaterialCount} 项，共 ${totalMaterialCount} 项，${priorityMeta.label}`}
                      className={`desktop-project-row desktop-application-object-row${selected ? ' is-selected' : ''}${
                        isArchived(row) ? ' is-archived' : ''
                      }`}
                      onClick={(event) => {
                        const target = event.target instanceof Element ? event.target : null;
                        if (target?.closest('a,button,input,select,textarea,label,[role="button"],[data-row-interactive]')) return;
                        openProjectInspector(row, event.currentTarget, event.detail > 1);
                      }}
                      onFocus={(event) => {
                        setSelectedId(row.item.userProjectId);
                        lastSelectedRowRef.current = event.currentTarget;
                      }}
                      onDoubleClick={(event) => {
                        const target = event.target instanceof Element ? event.target : null;
                        if (target?.closest('a,button,input,select,textarea,label,[role="button"],[data-row-interactive]')) return;
                        openProjectInspector(row, event.currentTarget, true);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        openProjectContextMenu(row, event.clientX, event.clientY);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
                          event.preventDefault();
                          const rect = event.currentTarget.getBoundingClientRect();
                          openProjectContextMenu(row, rect.left + 24, rect.top + Math.min(rect.height - 8, 72));
                          return;
                        }
                        handleRowKeyDown(event, index, row);
                      }}
                    >
                      <div
                        className="desktop-application-object-main"
                        role="gridcell"
                        aria-colindex={1}
                      >
                        <ExternalSiteMark
                          source={resolveNoticeLogoSource(row.project)}
                          label={getDisplaySchoolName(row.project.schoolName)}
                          size="sm"
                          rounded="full"
                        />
                        <div className="desktop-application-object-copy">
                          <div>
                            <strong>{getDisplaySchoolName(row.project.schoolName)}</strong>
                            <span>{getDisplayNoticeDepartment(row.project)}</span>
                          </div>
                          <p className="desktop-application-object-project-meta">
                            <Tag20Regular aria-hidden="true" />
                            <span>
                              {getDisplayProjectType(row.project.projectType)} · {getDisplayDiscipline(row.project.discipline)}
                            </span>
                          </p>
                          <p className="desktop-application-object-project-title" title={projectTitle}>
                            {projectTitle}
                          </p>
                        </div>
                        <div className="desktop-application-object-facts">
                          <span
                            className="desktop-application-object-fact desktop-application-object-status"
                            data-journey-state={rowJourney.state}
                            data-expired={deadlineExpired ? 'true' : undefined}
                          >
                            <small>状态</small>
                            <strong>
                              <label
                                className="desktop-application-inline-status"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <i aria-hidden="true" />
                                <span className="sr-only">卡片内更新申请状态</span>
                                <select
                                  aria-label={`更新${getDisplaySchoolName(row.project.schoolName)}申请状态`}
                                  value={row.item.myStatus}
                                  disabled={rowActionState?.phase === 'pending'}
                                  onChange={(event) =>
                                    void updateProjectRecord(
                                      row,
                                      { myStatus: event.target.value as UserProjectStatus },
                                      'status'
                                    )
                                  }
                                >
                                  {userStatusOptions.map((status) => (
                                    <option key={status} value={status}>{status}</option>
                                  ))}
                                </select>
                              </label>
                            </strong>
                          </span>
                          <span
                            className={`desktop-application-object-fact desktop-application-object-card-deadline${
                              isUrgent(row) ? ' is-urgent' : ''
                            }${deadlineExpired ? ' is-expired' : ''}`}
                            title={`${deadlineFullLabel} · ${deadlineDistance}`}
                          >
                            <small className="desktop-application-deadline-spacer">截止时间</small>
                            <strong>
                              <Calendar24Regular aria-hidden="true" />
                              <span className="desktop-application-deadline-prefix">截止：</span>
                              <span className="desktop-application-deadline-compact">{deadlineLabel}</span>
                              <span className="desktop-application-deadline-full">{deadlineFullLabel}</span>
                            </strong>
                            <span className="desktop-application-deadline-distance">{deadlineDistance}</span>
                          </span>
                          <span className="desktop-application-object-fact desktop-application-object-next-action">
                            <small>当前待办</small>
                            <strong title={cardActionDetail}>{cardAction}</strong>
                            {actionExpired ? (
                              <span className="desktop-application-object-next-detail">{cardActionDetail}</span>
                            ) : (
                              <button
                                type="button"
                                className="desktop-application-object-next-cta"
                                disabled={rowActionState?.phase === 'pending'}
                                title={cardActionDetail}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleApplicationCardJourneyAction(
                                    row,
                                    rowJourney,
                                    event.currentTarget
                                  );
                                }}
                              >
                                <span>{getApplicationActionLabel(rowJourney)}</span>
                                <ArrowRight20Regular aria-hidden="true" />
                              </button>
                            )}
                          </span>
                          <span
                            className="desktop-application-object-fact desktop-application-object-card-materials"
                            role="progressbar"
                            aria-label={`材料已准备 ${completedMaterialCount} 项，共 ${totalMaterialCount} 项`}
                            aria-valuemin={0}
                            aria-valuemax={totalMaterialCount}
                            aria-valuenow={completedMaterialCount}
                          >
                            <small>材料进度</small>
                            <strong>
                              <span>{completedMaterialCount === totalMaterialCount ? '✓ ' : ''}{completedMaterialCount} / {totalMaterialCount}</span>
                            </strong>
                            <span className="desktop-application-object-card-progress" aria-hidden="true">
                              <i style={{ width: `${materialProgressPercent}%` }} />
                            </span>
                            <span className="desktop-application-object-card-percent">
                              {materialProgressPercent}% 完成
                            </span>
                          </span>
                          <span
                            className="desktop-application-object-fact desktop-application-object-priority-cell"
                            data-priority={priorityMeta.tone}
                          >
                            <small>优先级</small>
                            <strong>
                              {row.item.priorityLevel === '低' ? (
                                <Star20Regular aria-hidden="true" />
                              ) : (
                                <Star20Filled aria-hidden="true" />
                              )}
                              <span>{priorityMeta.label}</span>
                            </strong>
                          </span>
                        </div>
                        {rowActionState ? (
                          <span
                            id={`desktop-project-action-${row.item.userProjectId}`}
                            className="sr-only"
                            role={rowActionState.phase === 'error' ? 'alert' : 'status'}
                            aria-live={rowActionState.phase === 'error' ? 'assertive' : 'polite'}
                          >
                            {rowActionState.message}
                          </span>
                        ) : null}
                        <span className="desktop-application-object-actions">
                          <button
                            type="button"
                            className="desktop-application-object-menu-trigger"
                            aria-haspopup="menu"
                            aria-expanded={projectContextMenu?.row.item.userProjectId === row.item.userProjectId}
                            aria-label={`打开${getDisplaySchoolName(row.project.schoolName)}项目菜单`}
                            title="项目菜单"
                            data-window-no-drag
                            onClick={(event) => {
                              event.stopPropagation();
                              const rect = event.currentTarget.getBoundingClientRect();
                              openProjectContextMenu(row, rect.right - 248, rect.bottom + 6);
                            }}
                          >
                            <MoreHorizontal20Regular aria-hidden="true" />
                          </button>
                          <ChevronRight20Regular aria-hidden="true" />
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="desktop-project-empty">
                  <DocumentText20Regular aria-hidden="true" />
                  <strong>
                    {onlyExpiredProjectsHidden
                      ? '已隐藏所有截止项目'
                      : applications.length
                        ? '没有符合条件的申请项目'
                        : '还没有申请项目'}
                  </strong>
                  <p>
                    {onlyExpiredProjectsHidden
                      ? `当前条件下的 ${expiredMatchingCount} 个项目均已截止。这里只是暂时隐藏，申请记录和材料不会被删除。`
                      : applications.length
                        ? '调整关键词或筛选条件后再试。'
                        : '先加入一个项目，寻鹿才知道下一步。'}
                  </p>
                  <div className="desktop-project-empty-actions">
                    {onlyExpiredProjectsHidden ? (
                      <button type="button" onClick={() => setHideExpired(false)}>
                        显示 {expiredMatchingCount} 个已截止项目
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setManualApplicationOpen(true)}
                        >
                          手动添加申请
                        </button>
                        <Link href="/notices">从通知库添加</Link>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {inspectorOpen && !compactInspector ? (
          <div
            className={`desktop-workbench-splitter${splitterDragging ? ' is-dragging' : ''}`}
            role="separator"
            aria-label="调整申请列表和项目详情的宽度"
            aria-orientation="vertical"
            aria-controls="desktop-application-context desktop-project-workspace"
            aria-valuemin={splitterBounds.min}
            aria-valuemax={splitterBounds.max}
            aria-valuenow={masterPaneWidth}
            aria-valuetext={`申请列表宽度 ${masterPaneWidth} 像素`}
            tabIndex={0}
            title="拖动调整左右栏宽度；双击恢复最大宽度"
            onPointerDown={handleSplitterPointerDown}
            onPointerMove={handleSplitterPointerMove}
            onPointerUp={(event) => finishSplitterPointerInteraction(event)}
            onPointerCancel={(event) => finishSplitterPointerInteraction(event, true)}
            onLostPointerCapture={handleSplitterLostPointerCapture}
            onDoubleClick={resetWorkbenchPaneWidth}
            onKeyDown={handleSplitterKeyDown}
          />
        ) : null}

        {compactInspector && inspectorOpen ? (
          <button
            type="button"
            className="desktop-inspector-backdrop"
            aria-label="关闭项目详情"
            tabIndex={-1}
            onClick={closeCompactInspector}
          />
        ) : null}

        <aside
          id="desktop-project-workspace"
          ref={inspectorRef}
          className={`desktop-project-inspector desktop-project-workspace${inspectorOpen ? ' is-open' : ''}`}
          role={compactInspector ? 'dialog' : undefined}
          aria-modal={compactInspector && inspectorOpen ? true : undefined}
          aria-label="选中项目详情"
          aria-hidden={!inspectorOpen}
          inert={!inspectorOpen ? true : undefined}
          onKeyDown={handleInspectorKeyDown}
        >
          {compactInspector && inspectorOpen && !selectedRow ? (
            <button
              ref={inspectorCloseRef}
              type="button"
              className="desktop-inspector-close desktop-inspector-close--floating"
              aria-label="关闭项目详情"
              onClick={closeCompactInspector}
            >
              <Dismiss20Regular aria-hidden="true" />
            </button>
          ) : null}
          {loading ? (
            <div className="desktop-inspector-loading" aria-hidden="true">
              <div className="desktop-inspector-loading-header">
                <span>
                  <b />
                  <small />
                </span>
                <i />
              </div>
              <div className="desktop-inspector-loading-tabs">
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="desktop-inspector-loading-body">
                <div className="desktop-inspector-loading-status">
                  <span className="desktop-inspector-loading-icon">
                    <ArrowSync20Regular />
                  </span>
                  <span>
                    <strong>正在整理项目详情</strong>
                    <small>同步完成后会在这里显示阶段、材料和下一步</small>
                  </span>
                </div>
                <div className="desktop-inspector-loading-summary">
                  {Array.from({ length: 4 }, (_, index) => (
                    <span key={index}><i /><b /></span>
                  ))}
                </div>
                <div className="desktop-inspector-loading-section">
                  <b />
                  <i />
                  <i />
                </div>
              </div>
            </div>
          ) : selectedRow ? (
            <>
              <header
                key={`project-header-${selectedRow.item.userProjectId}`}
                className="desktop-project-workspace-header desktop-project-context-enter"
              >
                <div className="desktop-project-workspace-identity">
                  <figure className="desktop-project-workspace-mark" aria-hidden="true">
                    <ExternalSiteMark
                      source={resolveNoticeLogoSource(selectedRow.project)}
                      label={getDisplaySchoolName(selectedRow.project.schoolName)}
                      size="md"
                      rounded="full"
                    />
                  </figure>
                  <div className="desktop-project-workspace-identity-copy">
                    <div className="desktop-project-workspace-title-row">
                      <h2 id="desktop-selected-project-title" className="desktop-selected-project-title">
                        {getDisplaySchoolName(selectedRow.project.schoolName)} ·{' '}
                        {getDisplayNoticeDepartment(selectedRow.project)}
                      </h2>
                      <span className="desktop-project-workspace-status">
                        <i aria-hidden="true" />
                        {selectedRow.item.myStatus}
                      </span>
                    </div>
                    <p>
                      {normalizeNoticeTitle(selectedRow.project.projectName, 62)}
                    </p>
                  </div>
                </div>
                <div className="desktop-project-workspace-actions">
                  <button
                    ref={inspectorCloseRef}
                    type="button"
                    className="desktop-inspector-close"
                    aria-label={compactInspector ? '返回申请列表' : '关闭项目详情'}
                    onClick={closeCompactInspector}
                  >
                    {compactInspector ? (
                      <ArrowLeft20Regular aria-hidden="true" />
                    ) : (
                      <Dismiss20Regular aria-hidden="true" />
                    )}
                    <span className="desktop-inspector-close-label">
                      {compactInspector ? '返回申请列表' : '关闭详情'}
                    </span>
                  </button>
                </div>
              </header>

              <div className="desktop-project-workspace-tabs" role="tablist" aria-label="项目工作区">
                {projectWorkspaceTabs.map((tab, index) => (
                  <button
                    ref={(element) => {
                      workspaceTabRefs.current[index] = element;
                    }}
                    id={`desktop-project-tab-${tab.value}`}
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={activeWorkspaceTab === tab.value}
                    aria-controls="desktop-project-panel"
                    tabIndex={activeWorkspaceTab === tab.value ? 0 : -1}
                    data-project-detail-primary={activeWorkspaceTab === tab.value ? '' : undefined}
                    onClick={() => setActiveWorkspaceTab(tab.value)}
                    onKeyDown={(event) => handleWorkspaceTabKeyDown(event, index)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <section
                key={`${selectedRow.item.userProjectId}-${activeWorkspaceTab}`}
                ref={workspaceScrollRef}
                id="desktop-project-panel"
                className="desktop-project-workspace-body desktop-project-context-enter"
                role="tabpanel"
                aria-labelledby={`desktop-project-tab-${activeWorkspaceTab}`}
                tabIndex={0}
                onScroll={persistApplicationContext}
              >
                {activeWorkspaceTab === 'overview' ? (
                  <>
                    {selectedJourney ? (
                      <section className="desktop-project-next-action desktop-project-next-step-surface" aria-label="现在最该做的事">
                        <div className="desktop-project-next-action-icon" aria-hidden="true">
                          <ArrowRight20Regular />
                        </div>
                        <div className="desktop-project-next-action-copy">
                          <span>现在最该做的事</span>
                          <strong>{selectedJourney.action}</strong>
                          <p>{selectedJourney.detail}</p>
                        </div>
                        <div
                          className="desktop-project-next-action-command"
                          style={compactInspector ? { gridColumn: '2', justifySelf: 'start' } : undefined}
                        >
                          <button
                            type="button"
                            className="desktop-project-workspace-primary desktop-project-workspace-primary-action"
                            aria-label={`现在处理：${selectedJourney.action}`}
                            disabled={isProjectActionPending(selectedRow)}
                            onClick={() => void handleJourneyAction(selectedRow, selectedJourney)}
                          >
                            <span>{selectedJourney.action}</span>
                            <ArrowRight20Regular aria-hidden="true" />
                          </button>
                        </div>
                      </section>
                    ) : null}

                    <section className="desktop-project-overview-grid desktop-project-overview-strip" aria-label="项目关键信息">
                      <article className="desktop-project-overview-card">
                        <span><CheckmarkCircle20Regular aria-hidden="true" />当前阶段</span>
                        <div className="desktop-project-overview-value-row">
                          <label>
                            <span className="sr-only">更新当前阶段</span>
                            <select
                              value={selectedRow.item.myStatus}
                              disabled={isProjectActionPending(selectedRow, 'status')}
                              onChange={(event) =>
                                void updateSelectedProject(
                                  { myStatus: event.target.value as UserProjectStatus },
                                  'status'
                                )
                              }
                            >
                              {userStatusOptions.map((item) => (
                                <option key={item} value={item}>{item}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </article>

                      <article className="desktop-project-overview-card">
                        <span><DocumentText20Regular aria-hidden="true" />材料进度</span>
                        <div className="desktop-project-overview-value-row">
                          <strong>{selectedMaterialCount} / {materialChecklistDefinitions.length}</strong>
                          <div className="desktop-project-workspace-progress" aria-hidden="true">
                            <i
                              style={{
                                width: `${(selectedMaterialCount / materialChecklistDefinitions.length) * 100}%`
                              }}
                            />
                          </div>
                        </div>
                      </article>

                      <article className={`desktop-project-overview-card${isUrgent(selectedRow) ? ' is-urgent' : ''}`}>
                        <span><Calendar24Regular aria-hidden="true" />下一截止</span>
                        <div className="desktop-project-overview-value-row">
                          <time dateTime={selectedRow.project.deadlineDate || undefined}>
                            {formatNoticeDateOnly(selectedRow.project.deadlineDate) || '待补充'}
                          </time>
                          <small>{getDeadlineDistanceLabel(selectedRow.project.deadlineDate)}</small>
                        </div>
                      </article>

                      <article className="desktop-project-overview-card">
                        <span><DocumentText20Regular aria-hidden="true" />申请方式</span>
                        <div className="desktop-project-overview-value-row">
                          <strong>{getDisplayProjectType(selectedRow.project.projectType)}</strong>
                          <small>{selectedRow.project.applyLink ? '线上申请' : '以项目通知为准'}</small>
                        </div>
                      </article>
                    </section>

                    <section className="desktop-project-workspace-section desktop-project-stage-section desktop-project-stage-workflow">
                      <header>
                        <div>
                          <h3>申请进度</h3>
                          <p>{selectedJourneyProgress?.summary || `当前处于“${selectedRow.item.myStatus}”阶段`}</p>
                        </div>
                        <button
                          type="button"
                          aria-expanded={stageTimelineExpanded}
                          aria-controls="desktop-project-stage-timeline"
                          onClick={() => setStageTimelineExpanded((expanded) => !expanded)}
                        >
                          {stageTimelineExpanded ? '收起完整进度' : '查看完整进度'}
                        </button>
                      </header>
                      {stageTimelineExpanded ? (
                        <ol id="desktop-project-stage-timeline" className="desktop-project-stage-line" aria-label="完整申请进度">
                          {applicationJourneyStages.map((stage, index) => {
                            const state =
                                index < selectedStageIndex
                                  ? 'complete'
                                : index === selectedStageIndex
                                  ? 'current'
                                  : 'pending';
                            return (
                              <li key={stage} className={`desktop-project-stage-item is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                                <span aria-hidden="true">
                                  {state === 'complete' ? <Checkmark20Regular /> : index + 1}
                                </span>
                                <strong>{stage}</strong>
                              </li>
                            );
                          })}
                        </ol>
                      ) : null}
                    </section>

                    <section className="desktop-project-workspace-section desktop-project-material-overview-section desktop-project-material-surface">
                      <header>
                        <div>
                          <h3>材料清单</h3>
                          <p>版本备注仅保存在此设备。</p>
                        </div>
                        <button type="button" onClick={() => setActiveWorkspaceTab('materials')}>查看全部</button>
                      </header>
                      {renderMaterialChecklist(selectedRow)}
                    </section>
                  </>
                ) : activeWorkspaceTab === 'materials' ? (
                  <section className="desktop-project-workspace-section desktop-project-material-panel">
                    <header>
                      <div>
                        <h3>申请材料</h3>
                        <p>已准备 {selectedMaterialCount} / {materialChecklistDefinitions.length}</p>
                      </div>
                      <div className="desktop-project-material-panel-actions">
                        <strong>{Math.round((selectedMaterialCount / materialChecklistDefinitions.length) * 100)}%</strong>
                        <button type="button" onClick={() => downloadMaterialManifest(selectedRow)}>
                          <FolderOpen20Regular aria-hidden="true" />
                          生成材料包清单
                        </button>
                      </div>
                    </header>
                    <div className="desktop-project-workspace-progress" aria-hidden="true">
                      <i
                        style={{
                          width: `${(selectedMaterialCount / materialChecklistDefinitions.length) * 100}%`
                        }}
                      />
                    </div>
                    {renderMaterialChecklist(selectedRow)}
                    <div className="desktop-project-material-meta-list" aria-label="材料版本台账">
                      {materialChecklistDefinitions.map(({ key, label }) => {
                        const meta = selectedMaterialMeta[key];
                        const requirementLabel = meta.requirement === 'required' ? '必交' : meta.requirement === 'optional' ? '可选' : '待确认';
                        return (
                          <article key={key} className="desktop-project-material-meta-card">
                            <header>
                              <div>
                                <strong>{label}</strong>
                                <span className={`desktop-project-material-requirement is-${meta.requirement}`}>{requirementLabel}</span>
                              </div>
                              <label className="desktop-project-material-toggle">
                                <input
                                  type="checkbox"
                                  checked={meta.applicable}
                                  onChange={(event) => updateMaterialMeta(selectedRow.item.userProjectId, key, { applicable: event.target.checked })}
                                />
                                <span>适用于本项目</span>
                              </label>
                            </header>
                            <div className="desktop-project-material-meta-grid">
                              <label>
                                <span>材料性质</span>
                                <select
                                  value={meta.requirement}
                                  onChange={(event) => updateMaterialMeta(selectedRow.item.userProjectId, key, { requirement: event.target.value as MaterialRequirement })}
                                >
                                  <option value="required">必交</option>
                                  <option value="optional">可选</option>
                                  <option value="unknown">待确认</option>
                                </select>
                              </label>
                              <label>
                                <span>文件名 / 路径备注</span>
                                <input
                                  value={meta.fileName}
                                  maxLength={240}
                                  onChange={(event) => updateMaterialMeta(selectedRow.item.userProjectId, key, { fileName: event.target.value })}
                                  placeholder="例如：简历-2026-07.pdf"
                                />
                              </label>
                              <label>
                                <span>版本</span>
                                <input
                                  value={meta.version}
                                  maxLength={40}
                                  onChange={(event) => updateMaterialMeta(selectedRow.item.userProjectId, key, { version: event.target.value })}
                                  placeholder="v1"
                                />
                              </label>
                              <label>
                                <span>最近修改</span>
                                <input
                                  type="date"
                                  value={meta.lastModifiedAt}
                                  onChange={(event) => updateMaterialMeta(selectedRow.item.userProjectId, key, { lastModifiedAt: event.target.value })}
                                />
                              </label>
                            </div>
                            <footer>
                              <label className="desktop-project-material-toggle">
                                <input
                                  type="checkbox"
                                  checked={meta.submitted}
                                  onChange={(event) => updateMaterialMeta(selectedRow.item.userProjectId, key, { submitted: event.target.checked })}
                                />
                                <span>已提交</span>
                              </label>
                              <label className="desktop-project-material-toggle">
                                <input
                                  type="checkbox"
                                  checked={meta.editableAfterSubmit}
                                  onChange={(event) => updateMaterialMeta(selectedRow.item.userProjectId, key, { editableAfterSubmit: event.target.checked })}
                                />
                                <span>提交后可修改</span>
                              </label>
                              <span className="desktop-project-material-meta-hint">
                                {meta.submitted && !meta.editableAfterSubmit ? '提交后请勿覆盖此版本' : '版本备注仅保存在此设备'}
                              </span>
                            </footer>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ) : activeWorkspaceTab === 'schedule' ? (
                  <section className="desktop-project-workspace-section desktop-project-related-panel">
                    <header>
                      <div>
                        <h3>项目日程</h3>
                        <p>围绕这个项目管理截止时间和准备节点。</p>
                      </div>
                      <Link href="/me?view=schedule">打开日程与提醒</Link>
                    </header>
                    <dl>
                      <div>
                        <dt><Clock20Regular aria-hidden="true" />下一截止</dt>
                        <dd>
                          <strong>{formatNoticeDateOnly(selectedRow.project.deadlineDate) || '待补充'}</strong>
                          <small className={isUrgent(selectedRow) ? 'is-urgent' : undefined}>
                            {getDeadlineDistanceLabel(selectedRow.project.deadlineDate)}
                          </small>
                        </dd>
                      </div>
                      <div>
                        <dt><DocumentText20Regular aria-hidden="true" />最近更新</dt>
                        <dd>{formatProjectUpdate(selectedRow.project.updatedAt)}</dd>
                      </div>
                    </dl>
                    {selectedJourney?.command === 'start_preparation' ? (
                      <button
                        type="button"
                        className="desktop-project-workspace-primary"
                        disabled={isProjectActionPending(selectedRow)}
                        onClick={() => void updateSelectedProject({ myStatus: '准备材料中' }, 'status')}
                      >
                        已核对，开始准备材料
                        <ArrowRight20Regular aria-hidden="true" />
                      </button>
                    ) : selectedJourney?.command === 'confirm_submission' ? (
                      <button
                        type="button"
                        className="desktop-project-workspace-primary"
                        disabled={isProjectActionPending(selectedRow)}
                        onClick={() => void updateSelectedProject({ myStatus: '已提交' }, 'status')}
                      >
                        确认已在官方系统提交
                        <Checkmark20Regular aria-hidden="true" />
                      </button>
                    ) : selectedJourney?.command === 'open_notice' ? (
                      <button
                        type="button"
                        className="desktop-project-workspace-primary"
                        onClick={() => void openOfficialProject(selectedRow)}
                      >
                        打开官方报名入口
                        <Open20Regular aria-hidden="true" />
                      </button>
                    ) : null}
                  </section>
                ) : activeWorkspaceTab === 'contacts' ? (
                  <section className="desktop-project-workspace-section desktop-project-related-panel">
                    <header>
                      <div>
                        <h3>导师联系</h3>
                        <p>把联系人、渠道和下一次跟进绑定到当前申请项目。</p>
                      </div>
                      <div className="desktop-project-related-actions">
                        <button
                          type="button"
                          onClick={() =>
                            void updateSelectedProject(
                              { contactSupervisorDone: !selectedRow.item.contactSupervisorDone },
                              'contact'
                            )
                          }
                        >
                          {selectedRow.item.contactSupervisorDone ? '已完成导师联系' : '标记联系完成'}
                        </button>
                        <Link href="/me?view=contacts">打开导师联系</Link>
                      </div>
                    </header>
                    {relatedMentors.length ? (
                      <div className="desktop-project-mentor-summary-list">
                        {relatedMentors.map((contact) => (
                          <article key={contact.id}>
                            <div>
                              <strong>{contact.mentorName || '未命名导师'}</strong>
                              <span>{[contact.departmentName, contact.researchDirection].filter(Boolean).join(' · ') || '方向待补充'}</span>
                            </div>
                            <div className="desktop-project-mentor-summary-meta">
                              <span>{contact.feedbackStatus || '未联系'}</span>
                              <span>{contact.contactChannel || '渠道待补充'}</span>
                              {contact.nextFollowUpDate ? <span>下次跟进 {contact.nextFollowUpDate}</span> : <span>未设跟进日期</span>}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="desktop-project-related-empty">
                        <strong>还没有匹配的导师联系人</strong>
                        <p>添加导师后，寻鹿会在这里显示联系状态和下一次跟进。</p>
                        <Link href="/me?view=contacts">添加导师联系人</Link>
                      </div>
                    )}
                  </section>
                ) : (
                  <section className="desktop-project-workspace-section desktop-project-related-panel">
                    <header>
                      <div>
                        <h3>项目动态</h3>
                        <p>这里显示与当前申请直接相关的状态记录。</p>
                      </div>
                    </header>
                    <ol className="desktop-project-activity-list">
                      <li>
                        <span aria-hidden="true" />
                        <div>
                          <strong>当前阶段：{selectedRow.item.myStatus}</strong>
                          <small>申请状态</small>
                        </div>
                      </li>
                      <li>
                        <span aria-hidden="true" />
                        <div>
                          <strong>申请结果：{selectedRow.item.resultStatus}</strong>
                          <small>结果状态</small>
                        </div>
                      </li>
                      <li>
                        <span aria-hidden="true" />
                        <div>
                          <strong>项目资料最近更新</strong>
                          <small>{formatProjectUpdate(selectedRow.project.updatedAt)}</small>
                        </div>
                      </li>
                    </ol>
                  </section>
                )}

                {saveError ? (
                  <p className="desktop-inspector-save-error" role="alert">{saveError}</p>
                ) : null}
                <div
                  className="desktop-project-workspace-inline-actions"
                  role="group"
                  aria-label="项目辅助操作"
                >
                  {getProjectHref(selectedRow) !== '/' ? (
                    <Link href={getProjectHref(selectedRow)} className="desktop-inspector-open">
                      查看项目通知
                      <ArrowRight20Regular aria-hidden="true" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="desktop-inspector-open"
                      onClick={() => void openOfficialProject(selectedRow)}
                    >
                      打开报名入口
                      <ArrowRight20Regular aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="desktop-inspector-edit"
                    onClick={() => setActiveWorkspaceTab('overview')}
                  >
                    更新申请状态
                    <ChevronRight20Regular aria-hidden="true" />
                  </button>
                </div>
              </section>
            </>
          ) : (
            <div className="desktop-inspector-empty">
              <DocumentText20Regular aria-hidden="true" />
              <p>选择一个申请项目后，这里会显示状态、材料和下一截止。</p>
            </div>
          )}
        </aside>

        {projectContextMenu ? (
          <div
            ref={projectContextMenuRef}
            className="desktop-project-context-menu"
            role="menu"
            aria-label={`${getDisplaySchoolName(projectContextMenu.row.project.schoolName)}项目菜单`}
            style={{ left: projectContextMenu.left, top: projectContextMenu.top }}
            onKeyDown={handleProjectContextMenuKeyDown}
          >
            <div className="desktop-project-context-menu-heading" role="presentation">
              <strong>{getDisplaySchoolName(projectContextMenu.row.project.schoolName)}</strong>
              <span>{normalizeNoticeTitle(projectContextMenu.row.project.projectName, 34)}</span>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => openProjectFromContext(projectContextMenu.row)}
            >
              <Open20Regular aria-hidden="true" />
              <span>打开项目详情</span>
              <kbd>Enter</kbd>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                void updateProjectRecord(
                  projectContextMenu.row,
                  { priorityLevel: projectContextMenu.row.item.priorityLevel === '高' ? '中' : '高' },
                  'priority'
                ).finally(() => closeProjectContextMenu(false))
              }
            >
              {projectContextMenu.row.item.priorityLevel === '高' ? (
                <Pin20Regular aria-hidden="true" />
              ) : (
                <Flag20Regular aria-hidden="true" />
              )}
              <span>{projectContextMenu.row.item.priorityLevel === '高' ? '取消重点标记' : '标记为重点项目'}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                openProjectInspector(
                  projectContextMenu.row,
                  document.getElementById(`desktop-project-row-${projectContextMenu.row.item.userProjectId}`),
                  true
                );
                window.requestAnimationFrame(() => setActiveWorkspaceTab('materials'));
                closeProjectContextMenu(false);
              }}
            >
              <CheckmarkCircle20Regular aria-hidden="true" />
              <span>继续准备材料</span>
            </button>
            <div className="desktop-project-context-menu-separator" role="separator" />
            <button
              type="button"
              role="menuitem"
              onClick={() => void copyProjectNameFromContext(projectContextMenu.row)}
            >
              <Copy20Regular aria-hidden="true" />
              <span>复制项目名称</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeProjectContextMenu(false);
                void refreshApplications({ bypassPendingRequest: true });
              }}
            >
              <ArrowSync20Regular aria-hidden="true" />
              <span>刷新项目数据</span>
            </button>
          </div>
        ) : null}
      </section>
      {manualApplicationOpen ? (
        <DesktopManualApplicationDialog
          userId={userId}
          onCancel={() => setManualApplicationOpen(false)}
          onCreated={handleManualApplicationCreated}
        />
      ) : null}
    </main>
  );
}
