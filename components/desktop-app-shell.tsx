'use client';

import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import {
  Add20Regular,
  Alert20Regular,
  Calendar24Filled,
  Calendar24Regular,
  Building24Filled,
  Building24Regular,
  Folder24Filled,
  Folder24Regular,
  Library24Filled,
  Library24Regular,
  News24Filled,
  News24Regular,
  People24Filled,
  People24Regular,
  QuestionCircle24Regular,
  Search20Regular,
  Settings20Regular,
  Subtract20Regular
} from '@fluentui/react-icons';
import {
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  FileCheck2,
  FolderKanban,
  GraduationCap,
  Heart,
  Home,
  Info,
  Library,
  MessageCircleMore,
  Newspaper,
  RefreshCw,
  Search,
  ShieldCheck,
  Trophy,
  Undo2,
  UsersRound,
  X,
  type LucideIcon
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactNode
} from 'react';
import {
  DEFAULT_DESKTOP_PREFERENCES,
  DESKTOP_LAST_ROUTE_STORAGE_KEY,
  DESKTOP_LAUNCH_SESSION_KEY,
  DESKTOP_ZOOM_LEVELS,
  getSteppedDesktopZoomLevel,
  readDesktopPreferences,
  resetDesktopPreferences,
  resolveDesktopTheme,
  writeDesktopPreferences,
  type DesktopPreferences,
  type DesktopZoomLevel
} from '@/lib/desktop-preferences';
import {
  DESKTOP_FEEDBACK_EVENT,
  requestDesktopApplicationSync,
  DESKTOP_MODAL_STATE_EVENT,
  requestDesktopNewApplication,
  requestDesktopNewContact,
  requestDesktopNewSchedule,
  DESKTOP_ROUTE_CHANGE_EVENT,
  DESKTOP_SYNC_STATUS_EVENT,
  emitDesktopFeedback,
  emitDesktopRouteChange,
  getDesktopFeedbackGroup,
  resolveDesktopFeedbackState,
  type DesktopFeedback,
  type DesktopModalState,
  type DesktopSyncStatus
} from '@/lib/desktop-route-events';
import {
  canonicalizeDesktopRoute,
  isSameDesktopHref,
  normalizeDesktopHref,
  normalizeDesktopPathname,
  shouldEmitDesktopRouteChange
} from '@/lib/desktop-navigation';
import {
  getDesktopCreateIntent,
  getDesktopCreateShortcutLabel,
  getDesktopNavigationSection,
  runDesktopCreateIntent,
  type DesktopNavigationSection
} from '@/lib/desktop-shell-behavior';
import { synchronizeDesktopWorkspace } from '@/lib/desktop-sync-coordinator';
import { useUserSessionState } from '@/hooks/use-user-session';
import { fetchApplicationRows, type ApplicationRow } from '@/lib/cloudbase-data';
import { buildNoticeDetailHref } from '@/lib/notice-links';
import {
  getDisplaySchoolName,
  normalizeNoticeTitle
} from '@/lib/notice-display';
import { QQ_GROUP_NUMBER, QQ_GROUP_URL } from '@/lib/contact';
import { DesktopHome } from './desktop-home';
import {
  DesktopWindowControls,
  useDesktopTitlebarDrag
} from './desktop-window-controls';
import type { DesktopSettingsCategory } from './desktop-settings-page';
import { useDesktopUpdaterShell } from './desktop-update-provider';

const DesktopReminderCenter = dynamic(
  () => import('./desktop-reminder-center').then((module) => module.DesktopReminderCenter),
  { ssr: false }
);
const DesktopSettingsPage = dynamic(
  () => import('./desktop-settings-page').then((module) => module.DesktopSettingsPage),
  { ssr: false }
);
const DesktopToday = dynamic(
  () => import('./desktop-today').then((module) => module.DesktopToday),
  { ssr: false }
);
const DesktopResourceCenter = dynamic(
  () => import('@/app/resources/desktop-resource-center'),
  {
    ssr: false,
    loading: () => (
      <main id="main-content" tabIndex={-1} className="desktop-route-content desktop-focus-region">
        <section className="desktop-route-loading" role="status" aria-live="polite">
          <strong>正在加载资源中心</strong>
          <p>正在整理申请资料、官方入口和常用工具。</p>
        </section>
      </main>
    )
  }
);
const DesktopGuide = dynamic(
  () => import('@/app/guide/desktop-help-center'),
  {
    ssr: false,
    loading: () => (
      <main id="main-content" tabIndex={-1} className="desktop-route-content desktop-focus-region">
        <section className="desktop-route-loading" role="status" aria-live="polite">
          <strong>正在加载帮助与反馈</strong>
          <p>正在整理常用帮助、问题答案和联系支持。</p>
        </section>
      </main>
    )
  }
);

type DesktopNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  keywords?: string;
};

type DesktopCommandItem = DesktopNavItem & {
  category: '最近搜索' | '申请项目' | '常用操作' | '信息与资源' | '申请管理' | '社区与帮助';
  description?: string;
};

type TrayCommandPayload = {
  id: number;
  command: string;
};

const DESKTOP_COMMAND_HISTORY_PREFIX = 'seekoffer-desktop-command-history:';

const informationItems: DesktopNavItem[] = [
  { label: '通知库', href: '/notices', icon: Newspaper, keywords: '夏令营 预推免 宣讲会' },
  { label: '截止专区', href: '/deadlines', icon: CalendarDays, keywords: '截止日期 提醒' },
  { label: '竞赛库', href: '/competitions', icon: Trophy, keywords: '竞赛 科研 项目' },
  { label: '院校库', href: '/colleges', icon: Building2, keywords: '高校 学院 专业' },
  { label: '资源中心', href: '/resources', icon: BookOpen, keywords: '工具 资料 模板' }
];

const applicationItems: DesktopNavItem[] = [
  { label: '日程提醒', href: '/me?view=schedule', icon: CalendarDays, keywords: '待办 截止 任务' },
  { label: '导师联系', href: '/me?view=contacts', icon: UsersRound, keywords: '套磁 联系人' }
];

const communityItems: DesktopNavItem[] = [
  { label: 'Offer 圈动态', href: '/offers', icon: Heart, keywords: '录取 候补 讨论' },
  { label: '发布动态', href: '/publish', icon: MessageCircleMore, keywords: '分享 讨论' },
  { label: '社区规范', href: '/community', icon: ShieldCheck, keywords: '规则 审核' }
];

const toolItems: DesktopNavItem[] = [
  { label: 'GPA 与材料', href: '/gpa', icon: GraduationCap, keywords: '成绩 单位换算 备份' },
  { label: '知识经验', href: '/knowledge', icon: Library, keywords: '保研经验 攻略' },
  { label: '保研咨询', href: '/consulting', icon: MessageCircleMore, keywords: '咨询 服务' },
  { label: '帮助与反馈', href: '/guide', icon: CircleHelp, keywords: '帮助 教程 反馈' },
  { label: '常见问题', href: '/faq', icon: Info, keywords: 'FAQ 帮助' },
  { label: '数据说明', href: '/data-quality', icon: CheckCircle2, keywords: '数据来源 质量' }
];

const aboutItems: DesktopNavItem[] = [
  { label: '关于寻鹿', href: '/about', icon: Info, keywords: '团队 产品' },
  { label: '隐私政策', href: '/privacy', icon: ShieldCheck, keywords: '隐私 数据' },
  { label: '用户协议', href: '/terms', icon: FileCheck2, keywords: '协议 条款' },
  { label: '免责声明', href: '/disclaimer', icon: CircleHelp, keywords: '法律 说明' }
];

const primaryItems: Array<
  DesktopNavItem & {
    activeIcon: LucideIcon;
    section: DesktopNavigationSection;
  }
> = [
  {
    label: '全部申请',
    href: '/',
    icon: Folder24Regular as unknown as LucideIcon,
    activeIcon: Folder24Filled as unknown as LucideIcon,
    section: 'workbench'
  },
  {
    label: '日程提醒',
    href: '/me?view=schedule',
    icon: Calendar24Regular as unknown as LucideIcon,
    activeIcon: Calendar24Filled as unknown as LucideIcon,
    section: 'schedule'
  },
  {
    label: '导师联系',
    href: '/me?view=contacts',
    icon: People24Regular as unknown as LucideIcon,
    activeIcon: People24Filled as unknown as LucideIcon,
    section: 'contacts'
  },
  {
    label: '通知库',
    href: '/notices',
    icon: News24Regular as unknown as LucideIcon,
    activeIcon: News24Filled as unknown as LucideIcon,
    section: 'information'
  },
  {
    label: '院校库',
    href: '/colleges',
    icon: Building24Regular as unknown as LucideIcon,
    activeIcon: Building24Filled as unknown as LucideIcon,
    section: 'colleges'
  },
  {
    label: '资源中心',
    href: '/resources',
    icon: Library24Regular as unknown as LucideIcon,
    activeIcon: Library24Filled as unknown as LucideIcon,
    section: 'resources'
  },
];

const primaryNavigationGroups = [
  {
    id: 'application',
    label: '申请管理',
    items: primaryItems.slice(0, 3)
  },
  {
    id: 'information',
    label: '信息与资源',
    items: primaryItems.slice(3)
  }
] as const;

const commandItems: DesktopCommandItem[] = [
  {
    label: '新建申请',
    href: 'desktop://new-application',
    icon: FolderKanban,
    keywords: '添加 申请 项目 手动录入',
    category: '常用操作',
    description: '直接打开手动添加申请'
  },
  {
    label: '新建日程',
    href: 'desktop://new-schedule',
    icon: CalendarDays,
    keywords: '新增 日程 提醒 待办',
    category: '常用操作',
    description: '前往日程提醒并打开新建面板'
  },
  {
    label: '添加导师',
    href: 'desktop://new-contact',
    icon: UsersRound,
    keywords: '新增 导师 联系人 套磁',
    category: '常用操作',
    description: '前往导师联系并打开添加面板'
  },
  {
    label: '全部申请',
    href: '/',
    icon: Home,
    keywords: '首页 申请 项目 进度',
    category: '常用操作',
    description: '查看全部申请项目'
  },
  {
    label: '我的一天',
    href: '/todos',
    icon: CalendarDays,
    keywords: '今日 待办 路径',
    category: '常用操作',
    description: '处理今天的申请节点'
  },
  {
    label: '打开提醒中心',
    href: 'desktop://reminders',
    icon: Alert20Regular as unknown as LucideIcon,
    keywords: '通知 提醒 截止 材料',
    category: '常用操作',
    description: '查看未读与稍后提醒'
  },
  {
    label: '打开设置',
    href: 'desktop://settings',
    icon: Settings20Regular as unknown as LucideIcon,
    keywords: '偏好 通知 缩放 外观',
    category: '常用操作',
    description: '调整桌面端偏好'
  },
  {
    label: '检查软件更新',
    href: 'desktop://check-updates',
    icon: RefreshCw,
    keywords: '版本 升级 软件更新',
    category: '常用操作',
    description: '检查寻鹿桌面端的新版本'
  },
  ...informationItems.map((item) => ({
    ...item,
    category: '信息与资源' as const,
    description: item.keywords
  })),
  ...applicationItems.map((item) => ({
    ...item,
    category: '申请管理' as const,
    description: item.keywords
  })),
  ...communityItems.map((item) => ({
    ...item,
    category: '社区与帮助' as const,
    description: item.keywords
  })),
  ...toolItems.map((item) => ({
    ...item,
    category: '社区与帮助' as const,
    description: item.keywords
  })),
  ...aboutItems.map((item) => ({
    ...item,
    category: '社区与帮助' as const,
    description: item.keywords
  }))
];

const launchDestinationHrefs: Record<Exclude<DesktopPreferences['launchDestination'], 'last'>, string> = {
  home: '/',
  notices: '/notices'
};

const directCreateHrefs: Record<DesktopDirectCreateIntent, string> = {
  application: '/',
  schedule: '/me?view=schedule',
  contact: '/me?view=contacts'
};

const directCreateLabels: Record<DesktopDirectCreateIntent, string> = {
  application: '新建申请',
  schedule: '新建日程',
  contact: '添加导师'
};

function getHrefView(href: string) {
  const query = href.split('?')[1] || '';
  return new URLSearchParams(query).get('view') || '';
}

function getCurrentDesktopHref(pathname: string, activeView: string) {
  const route = pathname === '/me' && activeView ? `/me?view=${activeView}` : pathname;
  return canonicalizeDesktopRoute(route, 'https://desktop.seekoffer.local/') || '/';
}

function isCurrentDesktopHref(href: string) {
  if (typeof window === 'undefined') return false;
  return !shouldEmitDesktopRouteChange(window.location.href, href);
}

function isItemActive(item: DesktopNavItem, pathname: string, activeView: string) {
  const itemPath = item.href.split('?')[0];
  const normalizedPathname = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (itemPath === '/') return normalizedPathname === '/';
  if (itemPath === '/me') {
    const itemView = getHrefView(item.href);
    return normalizedPathname === '/me' && Boolean(itemView) && itemView === activeView;
  }
  return normalizedPathname === itemPath || normalizedPathname.startsWith(`${itemPath}/`);
}

function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('input,textarea,select,[contenteditable="true"]'));
}

function useLayerPresence(open: boolean, reduceMotion: boolean, exitDuration = 100) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (reduceMotion) {
        setVisible(true);
        return;
      }
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    if (reduceMotion) {
      setMounted(false);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), exitDuration);
    return () => window.clearTimeout(timer);
  }, [exitDuration, open, reduceMotion]);

  return { mounted, visible };
}

type DesktopRouteTransitionState = 'idle' | 'delayed' | 'pending' | 'completing' | 'stalled';
type DesktopDirectCreateIntent = 'application' | 'schedule' | 'contact';

function getRouteLabel(pathname: string, activeView: string) {
  if (pathname === '/') return '全部申请';
  if (pathname === '/todos') return '我的一天';
  const activeItem = commandItems.find((item) => isItemActive(item, pathname, activeView));
  if (activeItem) return activeItem.label;
  return getDesktopNavigationSection(pathname, activeView) === 'workbench' ? '全部申请' : '寻鹿';
}

function DesktopLink({
  href,
  className,
  children,
  onNavigate,
  ariaCurrent,
  role,
  ariaLabel
}: {
  href: string;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
  ariaCurrent?: 'page';
  role?: string;
  ariaLabel?: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      role={role}
      data-window-no-drag
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey
        ) {
          return;
        }
        if (isCurrentDesktopHref(href)) {
          event.preventDefault();
          onNavigate?.();
          return;
        }
        emitDesktopRouteChange(href);
        onNavigate?.();
      }}
    >
      {children}
    </Link>
  );
}

function DesktopExternalLinkBridge() {
  useEffect(() => {
    const handleClick = (event: globalThis.MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor || event.defaultPrevented) return;

      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('/') || href.startsWith('#')) return;

      if (href === QQ_GROUP_URL) {
        event.preventDefault();
        const clipboard = navigator.clipboard;
        if (!clipboard) {
          emitDesktopFeedback({
            message: '请手动复制 QQ 群号',
            detail: `QQ群 ${QQ_GROUP_NUMBER}。当前系统没有提供剪贴板权限。`,
            tone: 'warning'
          });
          return;
        }

        void clipboard.writeText(QQ_GROUP_NUMBER)
          .then(() => {
            emitDesktopFeedback({
              message: 'QQ群号已复制',
              detail: `QQ群 ${QQ_GROUP_NUMBER}，请在 QQ 中搜索群号申请加入。`,
              tone: 'success'
            });
          })
          .catch(() => {
            emitDesktopFeedback({
              message: '复制 QQ 群号失败',
              detail: `请手动复制群号 ${QQ_GROUP_NUMBER}，再到 QQ 中搜索加入。`,
              tone: 'warning'
            });
          });
        return;
      }

      let shouldOpenExternally = href.startsWith('mailto:') || href.startsWith('tel:');
      if (/^https?:\/\//i.test(href)) {
        try {
          shouldOpenExternally = new URL(href).origin !== window.location.origin;
        } catch {
          shouldOpenExternally = false;
        }
      }

      if (!shouldOpenExternally) return;
      event.preventDefault();

      if ('__TAURI_INTERNALS__' in window) {
        void import('@tauri-apps/plugin-opener')
          .then(({ openUrl }) => openUrl(href))
          .catch(() => {
            emitDesktopFeedback({
              message: '暂时无法打开外部链接',
              detail: '请稍后重试，或复制链接后在浏览器中打开。',
              tone: 'error'
            });
          });
      } else {
        const openedWindow = window.open(href, '_blank', 'noopener,noreferrer');
        if (!openedWindow) {
          emitDesktopFeedback({
            message: '浏览器阻止了新窗口',
            detail: '请允许弹出窗口后重试。',
            tone: 'warning'
          });
        }
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  return null;
}

export function DesktopAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const routePathname = normalizeDesktopPathname(pathname);
  const router = useRouter();
  const { session } = useUserSessionState();
  const { attention: updaterAttention, checkNow: checkForUpdates } = useDesktopUpdaterShell();
  const [activeView, setActiveView] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [commandApplications, setCommandApplications] = useState<ApplicationRow[]>([]);
  const [commandApplicationsLoading, setCommandApplicationsLoading] = useState(false);
  const [commandApplicationsError, setCommandApplicationsError] = useState('');
  const [commandRecentQueries, setCommandRecentQueries] = useState<string[]>([]);
  const [shortcutOpen, setShortcutOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const [zoomError, setZoomError] = useState('');
  const [settingsInitialCategory, setSettingsInitialCategory] =
    useState<DesktopSettingsCategory>('general');
  const [preferences, setPreferences] = useState<DesktopPreferences>(DEFAULT_DESKTOP_PREFERENCES);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [unreadReminderCount, setUnreadReminderCount] = useState(0);
  const [routeTransitionState, setStoredRouteTransitionState] =
    useState<DesktopRouteTransitionState>('idle');
  const [routeAnnouncement, setRouteAnnouncement] = useState('');
  const [windowActive, setWindowActive] = useState(true);
  const [historyState, setHistoryState] = useState({ canBack: false, canForward: false });
  const [syncStatus, setSyncStatus] = useState<DesktopSyncStatus>('idle');
  const [syncUpdatedAt, setSyncUpdatedAt] = useState<number | null>(null);
  const [feedbackItem, setFeedbackItem] = useState<DesktopFeedback | null>(null);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackAnnouncement, setFeedbackAnnouncement] = useState('');
  const [childModalSources, setChildModalSources] = useState<string[]>([]);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const shortcutDialogRef = useRef<HTMLElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const reminderTriggerRef = useRef<HTMLButtonElement>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const zoomMenuRef = useRef<HTMLDivElement>(null);
  const zoomMenuListRef = useRef<HTMLDivElement>(null);
  const zoomTriggerRef = useRef<HTMLButtonElement>(null);
  const topbarRef = useRef<HTMLElement>(null);
  const primaryRailRef = useRef<HTMLElement>(null);
  const contentRegionRef = useRef<HTMLElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const firstRouteRef = useRef(true);
  const preferencesInitializedRef = useRef(false);
  const routeDelayTimerRef = useRef<number | null>(null);
  const routeStallTimerRef = useRef<number | null>(null);
  const routeCompleteTimerRef = useRef<number | null>(null);
  const routeTransitionStateRef = useRef<DesktopRouteTransitionState>('idle');
  const feedbackTimerRef = useRef<number | null>(null);
  const feedbackExitTimerRef = useRef<number | null>(null);
  const overlayFocusTimerRef = useRef<number | null>(null);
  const feedbackSequenceRef = useRef(0);
  const feedbackItemRef = useRef<DesktopFeedback | null>(null);
  const feedbackGroupRef = useRef('');
  const commandApplicationsAttemptedRef = useRef(false);
  const handledTrayCommandIdsRef = useRef(new Set<number>());
  const scrollPositionsRef = useRef(new Map<string, number>());
  const syncOwnerRef = useRef(session?.userId ?? null);
  const navigationModeRef = useRef<'push' | 'history'>('push');
  const historyIndexRef = useRef(0);
  const historyMaxIndexRef = useRef(0);
  const pendingRoutePushRef = useRef<string | null>(null);
  const pendingDirectCreateRef = useRef<DesktopDirectCreateIntent | null>(null);
  const lastRouteKeyRef = useRef(getCurrentDesktopHref(routePathname, activeView));
  const section = getDesktopNavigationSection(routePathname, activeView);
  const routeLabel = getRouteLabel(routePathname, activeView);
  const createIntent = getDesktopCreateIntent(routePathname, activeView, settingsOpen);
  const createShortcutLabel = getDesktopCreateShortcutLabel(createIntent);
  const handleTitlebarMouseDown = useDesktopTitlebarDrag();
  const commandHistoryStorageKey = session?.userId
    ? `${DESKTOP_COMMAND_HISTORY_PREFIX}${encodeURIComponent(session.userId)}`
    : '';
  const commandLayer = useLayerPresence(commandOpen, preferences.reduceMotion);
  const shortcutLayer = useLayerPresence(shortcutOpen, preferences.reduceMotion);
  const shellModalOpen = commandOpen || shortcutOpen || reminderOpen;
  const appModalOpen = shellModalOpen || childModalSources.length > 0;
  const routePending = routeTransitionState !== 'idle';
  const feedbackState = feedbackItem ? resolveDesktopFeedbackState(feedbackItem) : null;

  const setRouteTransitionState = useCallback((next: DesktopRouteTransitionState) => {
    routeTransitionStateRef.current = next;
    setStoredRouteTransitionState(next);
  }, []);

  const clearRouteTransitionTimers = useCallback(() => {
    if (routeDelayTimerRef.current) window.clearTimeout(routeDelayTimerRef.current);
    if (routeStallTimerRef.current) window.clearTimeout(routeStallTimerRef.current);
    if (routeCompleteTimerRef.current) window.clearTimeout(routeCompleteTimerRef.current);
    routeDelayTimerRef.current = null;
    routeStallTimerRef.current = null;
    routeCompleteTimerRef.current = null;
  }, []);

  const markRoutePush = useCallback((href: string) => {
    if (typeof window === 'undefined') return;
    const normalizedHref = normalizeDesktopHref(href, window.location.href);
    if (!normalizedHref || pendingRoutePushRef.current === normalizedHref) return;

    pendingRoutePushRef.current = normalizedHref;
    const nextIndex = historyIndexRef.current + 1;
    historyIndexRef.current = nextIndex;
    historyMaxIndexRef.current = nextIndex;
    setHistoryState({ canBack: nextIndex > 0, canForward: false });
  }, []);

  useEffect(() => {
    if (!commandHistoryStorageKey) {
      setCommandRecentQueries([]);
      return;
    }

    try {
      const stored = JSON.parse(window.localStorage.getItem(commandHistoryStorageKey) || '[]');
      setCommandRecentQueries(
        Array.isArray(stored)
          ? stored
              .filter((value): value is string => typeof value === 'string')
              .map((value) => value.trim())
              .filter(Boolean)
              .filter((value) => !commandItems.some((item) => item.label === value))
              .slice(0, 5)
          : []
      );
    } catch {
      setCommandRecentQueries([]);
    }
  }, [commandHistoryStorageKey]);

  const rememberCommandQuery = useCallback((value: string) => {
    const normalized = value.trim();
    if (!normalized || !commandHistoryStorageKey) return;

    setCommandRecentQueries((current) => {
      const next = [normalized, ...current.filter((item) => item !== normalized)].slice(0, 5);
      try {
        window.localStorage.setItem(commandHistoryStorageKey, JSON.stringify(next));
      } catch {
        // Private/restricted storage should not block command navigation.
      }
      return next;
    });
  }, [commandHistoryStorageKey]);

  const commandResults = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    const applicationItems: DesktopCommandItem[] = commandApplications.map((row) => ({
      label: getDisplaySchoolName(row.project.schoolName),
      href:
        row.project.sourceSite === '用户手动录入'
          ? '/'
          : buildNoticeDetailHref(row.project.id),
      icon: FolderKanban,
      keywords: `${row.project.departmentName} ${row.project.projectName} ${row.item.myStatus}`,
      category: '申请项目',
      description: `${row.item.myStatus} · ${normalizeNoticeTitle(row.project.projectName, 38)}`
    }));

    if (!query) {
      const recentItems: DesktopCommandItem[] = commandRecentQueries.map((recentQuery) => ({
        label: recentQuery,
        href: `/notices?q=${encodeURIComponent(recentQuery)}`,
        icon: Search,
        category: '最近搜索',
        keywords: recentQuery,
        description: '再次搜索通知与项目'
      }));
      return [...recentItems, ...applicationItems.slice(0, 4), ...commandItems.slice(0, 8)].slice(0, 12);
    }

    const matches = [...applicationItems, ...commandItems].filter((item) =>
      `${item.label} ${item.keywords || ''} ${item.description || ''}`
        .toLowerCase()
        .includes(query)
    );
    if (!matches.some((item) => item.href.startsWith('/notices?q='))) {
      matches.push({
        label: `在通知库搜索“${commandQuery.trim()}”`,
        href: `/notices?q=${encodeURIComponent(commandQuery.trim())}`,
        icon: Search,
        keywords: commandQuery.trim(),
        category: '信息与资源',
        description: '搜索公开招生通知与项目机会'
      });
    }
    return matches.slice(0, 12);
  }, [commandApplications, commandRecentQueries, commandQuery]);

  const beginRouteTransition = useCallback(() => {
    clearRouteTransitionTimers();
    setRouteTransitionState('delayed');
    setHistoryState((current) => ({ canBack: true, canForward: current.canForward }));
    routeDelayTimerRef.current = window.setTimeout(() => {
      if (routeTransitionStateRef.current === 'delayed') setRouteTransitionState('pending');
      routeDelayTimerRef.current = null;
    }, 120);
    routeStallTimerRef.current = window.setTimeout(() => {
      if (routeTransitionStateRef.current === 'pending') setRouteTransitionState('stalled');
      routeStallTimerRef.current = null;
    }, 1800);
  }, [clearRouteTransitionTimers, setRouteTransitionState]);

  const rememberCurrentScroll = useCallback(() => {
    if (!contentRegionRef.current) return;
    scrollPositionsRef.current.set(
      lastRouteKeyRef.current,
      contentRegionRef.current.scrollTop
    );
  }, []);

  const restoreFocusAfterOverlayClose = useCallback((
    resolveTarget: () => HTMLElement | null | undefined,
    exitDuration = 120
  ) => {
    if (overlayFocusTimerRef.current) window.clearTimeout(overlayFocusTimerRef.current);
    const delay = preferences.reduceMotion ? 0 : exitDuration;
    overlayFocusTimerRef.current = window.setTimeout(() => {
      window.requestAnimationFrame(() => resolveTarget()?.focus({ preventScroll: true }));
      overlayFocusTimerRef.current = null;
    }, delay);
  }, [preferences.reduceMotion]);

  const closeCommand = useCallback((restoreFocus = true) => {
    setCommandOpen(false);
    if (restoreFocus) {
      restoreFocusAfterOverlayClose(() => lastFocusedRef.current || searchTriggerRef.current);
    }
  }, [restoreFocusAfterOverlayClose]);

  const openCommand = useCallback(() => {
    if (overlayFocusTimerRef.current) window.clearTimeout(overlayFocusTimerRef.current);
    overlayFocusTimerRef.current = null;
    lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setShortcutOpen(false);
    setReminderOpen(false);
    setSettingsOpen(false);
    setZoomMenuOpen(false);
    setCommandOpen(true);
  }, []);

  const closeShortcuts = useCallback((restoreFocus = true) => {
    setShortcutOpen(false);
    if (restoreFocus) {
      restoreFocusAfterOverlayClose(() => lastFocusedRef.current);
    }
  }, [restoreFocusAfterOverlayClose]);

  const openShortcuts = useCallback(() => {
    if (overlayFocusTimerRef.current) window.clearTimeout(overlayFocusTimerRef.current);
    overlayFocusTimerRef.current = null;
    lastFocusedRef.current = commandOpen
      ? searchTriggerRef.current
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setCommandOpen(false);
    setReminderOpen(false);
    setSettingsOpen(false);
    setZoomMenuOpen(false);
    setShortcutOpen(true);
  }, [commandOpen]);

  const closeReminders = useCallback((restoreFocus = true) => {
    setReminderOpen(false);
    if (restoreFocus) {
      restoreFocusAfterOverlayClose(() => reminderTriggerRef.current, 220);
    }
  }, [restoreFocusAfterOverlayClose]);

  const openReminders = useCallback(() => {
    if (overlayFocusTimerRef.current) window.clearTimeout(overlayFocusTimerRef.current);
    overlayFocusTimerRef.current = null;
    lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCommandOpen(false);
    setShortcutOpen(false);
    setSettingsOpen(false);
    setZoomMenuOpen(false);
    setReminderOpen(true);
  }, []);

  const toggleReminders = useCallback(() => {
    if (reminderOpen) closeReminders();
    else openReminders();
  }, [closeReminders, openReminders, reminderOpen]);

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return undefined;

    let disposed = false;
    let unlisten: (() => void) | undefined;
    void Promise.all([
      import('@tauri-apps/api/event'),
      import('@tauri-apps/api/core')
    ])
      .then(async ([{ listen }, { invoke }]) => {
        const handleTrayCommand = async (payload: TrayCommandPayload) => {
          if (
            disposed ||
            !payload ||
            !Number.isFinite(payload.id) ||
            typeof payload.command !== 'string'
          ) {
            return;
          }

          if (!handledTrayCommandIdsRef.current.has(payload.id)) {
            if (handledTrayCommandIdsRef.current.size >= 256) {
              handledTrayCommandIdsRef.current.clear();
            }
            handledTrayCommandIdsRef.current.add(payload.id);
            const command = payload.command;
            if (command === 'reminders' || command === 'deadline' || command === 'unread') {
              openReminders();
            } else if (command === 'check-update') {
              closeReminders(false);
              void checkForUpdates();
            } else {
              closeReminders(false);
              const href = command === 'materials'
                ? '/?focus=materials'
                : command === 'contacts'
                  ? '/me?view=contacts'
                  : '/';
              if (!isSameDesktopHref(window.location.href, href)) {
                emitDesktopRouteChange(href);
                router.push(href);
              }
            }
          }

          await invoke<boolean>('acknowledge_tray_command', { id: payload.id });
        };

        const disposeListener = await listen<TrayCommandPayload>('seekoffer-tray-command', (event) => {
          void handleTrayCommand(event.payload);
        });
        if (disposed) {
          disposeListener();
          return;
        }
        unlisten = disposeListener;

        for (let index = 0; index < 32 && !disposed; index += 1) {
          const pending = await invoke<TrayCommandPayload | null>('take_pending_tray_command');
          if (!pending) break;
          await handleTrayCommand(pending);
        }
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [checkForUpdates, closeReminders, openReminders, router]);

  const handlePreferencesChange = useCallback((next: DesktopPreferences) => {
    setPreferences(writeDesktopPreferences(next));
  }, []);

  const updateZoomLevel = useCallback((zoomLevel: DesktopZoomLevel) => {
    setZoomError('');
    setPreferences((current) => writeDesktopPreferences({ ...current, zoomLevel }));
    emitDesktopFeedback({
      message: `界面缩放 ${zoomLevel}%`,
      detail: '已保存在这台设备上',
      tone: 'neutral',
      duration: 1800
    });
  }, []);

  const dismissFeedback = useCallback(() => {
    feedbackItemRef.current = null;
    feedbackGroupRef.current = '';
    setFeedbackVisible(false);
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    if (feedbackExitTimerRef.current) window.clearTimeout(feedbackExitTimerRef.current);
    feedbackExitTimerRef.current = window.setTimeout(() => setFeedbackItem(null), 110);
  }, []);

  const runFeedbackAction = useCallback((feedback: DesktopFeedback) => {
    if (!feedback.actionLabel || !feedback.onAction) return;
    const actionLabel = feedback.actionLabel;
    const announcement = feedback.actionAnnouncement || (actionLabel === '撤销' ? '已撤销最近操作' : `${actionLabel}已执行`);
    dismissFeedback();
    setFeedbackAnnouncement('');
    try {
      const result = feedback.onAction();
      void Promise.resolve(result)
        .then(() => window.requestAnimationFrame(() => setFeedbackAnnouncement(announcement)))
        .catch(() => window.requestAnimationFrame(() => setFeedbackAnnouncement(`${actionLabel}执行失败`)));
    } catch {
      window.requestAnimationFrame(() => setFeedbackAnnouncement(`${actionLabel}执行失败`));
    }
  }, [dismissFeedback]);

  const closeZoomMenu = useCallback((restoreFocus = true) => {
    setZoomMenuOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => zoomTriggerRef.current?.focus());
    }
  }, []);

  const handlePreferencesReset = useCallback(() => {
    setPreferences(resetDesktopPreferences());
  }, []);

  const closeSettings = useCallback((restoreFocus = true) => {
    setSettingsOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => settingsTriggerRef.current?.focus());
    }
  }, []);

  const openSettings = useCallback((category: DesktopSettingsCategory = 'general') => {
    lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCommandOpen(false);
    setShortcutOpen(false);
    setReminderOpen(false);
    setZoomMenuOpen(false);
    setSettingsInitialCategory(category);
    setSettingsOpen(true);
    setRouteAnnouncement('设置已加载');
  }, []);

  const goBack = useCallback(() => {
    if (settingsOpen) {
      closeSettings();
      return;
    }
    if (!historyState.canBack) return;
    rememberCurrentScroll();
    navigationModeRef.current = 'history';
    beginRouteTransition();
    window.history.back();
  }, [beginRouteTransition, closeSettings, historyState.canBack, rememberCurrentScroll, settingsOpen]);

  const goForward = useCallback(() => {
    if (!historyState.canForward) return;
    rememberCurrentScroll();
    navigationModeRef.current = 'history';
    beginRouteTransition();
    window.history.forward();
  }, [beginRouteTransition, historyState.canForward, rememberCurrentScroll]);

  const focusAdjacentRegion = useCallback((backward: boolean) => {
    const regions = [topbarRef.current, primaryRailRef.current, contentRegionRef.current].filter(
      (region): region is HTMLElement => Boolean(region && region.offsetParent !== null)
    );
    if (!regions.length) return;

    const activeElement = document.activeElement;
    const currentIndex = regions.findIndex((region) => activeElement instanceof Element && region.contains(activeElement));
    const startIndex = currentIndex < 0 ? (backward ? 0 : -1) : currentIndex;
    const nextIndex = (startIndex + (backward ? -1 : 1) + regions.length) % regions.length;
    const nextRegion = regions[nextIndex];
    const focusables = Array.from(
      nextRegion.querySelectorAll<HTMLElement>(
        '#main-content,[data-focus-region-start],a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => element.offsetParent !== null && element.getAttribute('aria-hidden') !== 'true');
    (focusables[0] || nextRegion).focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const handleFocus = () => setWindowActive(true);
    const handleBlur = () => setWindowActive(false);
    setWindowActive(document.hasFocus());
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    const handleFeedback = (event: Event) => {
      const feedback = (event as CustomEvent<DesktopFeedback>).detail;
      if (!feedback?.message) return;

      feedbackSequenceRef.current += 1;
      const sequence = feedbackSequenceRef.current;
      const group = getDesktopFeedbackGroup(feedback);
      const replacesCurrentGroup = Boolean(
        feedbackItemRef.current && feedbackGroupRef.current === group
      );
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
      if (feedbackExitTimerRef.current) window.clearTimeout(feedbackExitTimerRef.current);
      feedbackItemRef.current = feedback;
      feedbackGroupRef.current = group;
      if (!replacesCurrentGroup) setFeedbackVisible(false);
      setFeedbackItem(feedback);
      if (replacesCurrentGroup) {
        setFeedbackVisible(true);
      } else {
        window.requestAnimationFrame(() => {
          if (feedbackSequenceRef.current === sequence) setFeedbackVisible(true);
        });
      }
      const requestedDuration = feedback.duration || 3600;
      const visibleDuration = feedback.actionLabel && feedback.onAction
        ? Math.max(8000, requestedDuration)
        : Math.max(1200, requestedDuration);
      feedbackTimerRef.current = window.setTimeout(dismissFeedback, visibleDuration);
    };

    window.addEventListener(DESKTOP_FEEDBACK_EVENT, handleFeedback);
    return () => {
      window.removeEventListener(DESKTOP_FEEDBACK_EVENT, handleFeedback);
      feedbackItemRef.current = null;
      feedbackGroupRef.current = '';
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
      if (feedbackExitTimerRef.current) window.clearTimeout(feedbackExitTimerRef.current);
    };
  }, [dismissFeedback]);

  useEffect(() => {
    const handleModalState = (event: Event) => {
      const state = (event as CustomEvent<DesktopModalState>).detail;
      if (!state?.source) return;
      setChildModalSources((current) => {
        if (state.open) {
          setCommandOpen(false);
          setShortcutOpen(false);
          setReminderOpen(false);
          setZoomMenuOpen(false);
          return current.includes(state.source) ? current : [...current, state.source];
        }
        return current.filter((source) => source !== state.source);
      });
    };

    window.addEventListener(DESKTOP_MODAL_STATE_EVENT, handleModalState);
    return () => window.removeEventListener(DESKTOP_MODAL_STATE_EVENT, handleModalState);
  }, []);

  useEffect(() => {
    const currentRoute = `${routePathname}${window.location.search}${window.location.hash}`;
    const canonicalRoute = canonicalizeDesktopRoute(currentRoute, window.location.href);
    if (canonicalRoute !== '/' || currentRoute === '/') return;

    emitDesktopRouteChange(canonicalRoute);
    router.replace(canonicalRoute);
  }, [routePathname, router]);

  useEffect(() => {
    if (preferencesInitializedRef.current) return;
    preferencesInitializedRef.current = true;

    const nextPreferences = readDesktopPreferences();
    setPreferences(nextPreferences);
    setPreferencesReady(true);

    try {
      if (window.sessionStorage.getItem(DESKTOP_LAUNCH_SESSION_KEY)) return;
      window.sessionStorage.setItem(DESKTOP_LAUNCH_SESSION_KEY, 'true');
      if (routePathname !== '/') return;

      const savedRoute = window.localStorage.getItem(DESKTOP_LAST_ROUTE_STORAGE_KEY);
      const requestedRoute =
        nextPreferences.launchDestination === 'last'
          ? savedRoute
          : launchDestinationHrefs[nextPreferences.launchDestination];
      const safeRoute = requestedRoute
        ? canonicalizeDesktopRoute(requestedRoute, window.location.href) || '/'
        : '/';

      if (safeRoute !== '/') {
        emitDesktopRouteChange(safeRoute);
        router.replace(safeRoute);
      }
    } catch {
      // Restricted storage should never prevent the desktop shell from starting.
    }
  }, [routePathname, router]);

  useEffect(() => {
    if (!preferencesReady || settingsOpen) return;
    try {
      window.localStorage.setItem(
        DESKTOP_LAST_ROUTE_STORAGE_KEY,
        getCurrentDesktopHref(routePathname, activeView)
      );
    } catch {
      // Continue without last-route persistence when browser storage is unavailable.
    }
  }, [activeView, preferencesReady, routePathname, settingsOpen]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const nextTheme = resolveDesktopTheme(preferences.theme, media.matches);
      setResolvedTheme(nextTheme);
      document.documentElement.dataset.desktopThemePreference = preferences.theme;
      document.documentElement.dataset.desktopTheme = nextTheme;
      document.documentElement.style.colorScheme = nextTheme;
    };

    applyTheme();
    if (preferences.theme !== 'system') return undefined;
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [preferences.theme]);

  useEffect(() => {
    if (!preferencesReady) return;
    const requestedZoomLevel = preferences.zoomLevel;
    setZoomError('');

    /* CSS zoom is the authoritative desktop scale because it also changes the
     * layout viewport used by our responsive master/detail rules. Native
     * WebView2 zoom can report success without updating PrintWindow output on
     * some Windows builds, so keep the native layer at 100% and apply exactly
     * one visible scale here. */
    document.documentElement.style.setProperty('zoom', String(requestedZoomLevel / 100));

    if ('__TAURI_INTERNALS__' in window) {
      void import('@tauri-apps/api/webview')
        .then(({ getCurrentWebview }) => getCurrentWebview().setZoom(1))
        .catch(() => undefined);
    }
  }, [preferences.zoomLevel, preferencesReady]);

  useEffect(() => {
    if (!zoomMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && !zoomMenuRef.current?.contains(target)) {
        closeZoomMenu(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [closeZoomMenu, zoomMenuOpen]);

  useEffect(() => {
    if (!zoomMenuOpen) return;
    const timer = window.setTimeout(() => {
      zoomMenuListRef.current
        ?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')
        ?.focus();
    }, 40);
    return () => window.clearTimeout(timer);
  }, [zoomMenuOpen]);

  const handleZoomMenuKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeZoomMenu();
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;

      const items = Array.from(
        event.currentTarget.querySelectorAll<HTMLButtonElement>(
          '[role="menuitemradio"],[role="menuitem"]'
        )
      ).filter((item) => !item.disabled);
      if (!items.length) return;

      event.preventDefault();
      const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
      let nextIndex = currentIndex;
      if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = items.length - 1;
      else if (event.key === 'ArrowDown') nextIndex = (Math.max(currentIndex, -1) + 1) % items.length;
      else nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
      items[nextIndex]?.focus();
    },
    [closeZoomMenu]
  );

  useEffect(() => {
    const readCurrentView = () => {
      const view = new URLSearchParams(window.location.search).get('view');
      setActiveView(view || '');
    };

    const readHistoryIndex = (state: unknown) => {
      if (!state || typeof state !== 'object') return null;
      const value = (state as { __seekofferHistoryIndex?: unknown }).__seekofferHistoryIndex;
      return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
    };

    const readHistoryMaxIndex = (state: unknown, fallback: number) => {
      if (!state || typeof state !== 'object') return fallback;
      const value = (state as { __seekofferHistoryMax?: unknown }).__seekofferHistoryMax;
      return typeof value === 'number' && Number.isInteger(value) && value >= fallback ? value : fallback;
    };

    const initialIndex = readHistoryIndex(window.history.state) ?? 0;
    historyIndexRef.current = initialIndex;
    historyMaxIndexRef.current = readHistoryMaxIndex(window.history.state, initialIndex);
    if (readHistoryIndex(window.history.state) === null) {
      window.history.replaceState(
        {
          ...(window.history.state && typeof window.history.state === 'object' ? window.history.state : {}),
          __seekofferHistoryIndex: initialIndex,
          __seekofferHistoryMax: historyMaxIndexRef.current
        },
        '',
        window.location.href
      );
    }
    readCurrentView();
    setHistoryState({
      canBack: historyIndexRef.current > 0,
      canForward: historyIndexRef.current < historyMaxIndexRef.current
    });

    const handleRouteChange = (event: Event) => {
      const href = (event as CustomEvent<string>).detail || '';
      rememberCurrentScroll();
      navigationModeRef.current = 'push';
      markRoutePush(href);
      setActiveView(getHrefView(href));
      beginRouteTransition();
    };
    const handlePopState = () => {
      rememberCurrentScroll();
      navigationModeRef.current = 'history';
      readCurrentView();
      beginRouteTransition();
      const index = readHistoryIndex(window.history.state);
      if (index !== null) {
        historyIndexRef.current = index;
        historyMaxIndexRef.current = readHistoryMaxIndex(window.history.state, historyMaxIndexRef.current);
      } else {
        historyIndexRef.current = Math.max(0, historyIndexRef.current - 1);
      }
      setHistoryState({
        canBack: historyIndexRef.current > 0,
        canForward: historyIndexRef.current < historyMaxIndexRef.current
      });
    };
    const handleSyncStatus = (event: Event) => {
      const nextStatus = (event as CustomEvent<DesktopSyncStatus>).detail || 'idle';
      setSyncStatus(nextStatus);
      if (nextStatus !== 'syncing' && nextStatus !== 'idle') {
        setSyncUpdatedAt(Date.now());
      }
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener(DESKTOP_ROUTE_CHANGE_EVENT, handleRouteChange);
    window.addEventListener(DESKTOP_SYNC_STATUS_EVENT, handleSyncStatus);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener(DESKTOP_ROUTE_CHANGE_EVENT, handleRouteChange);
      window.removeEventListener(DESKTOP_SYNC_STATUS_EVENT, handleSyncStatus);
    };
  }, [beginRouteTransition, markRoutePush, rememberCurrentScroll]);

  useEffect(() => {
    const nextOwner = session?.userId ?? null;
    if (syncOwnerRef.current === nextOwner) return;
    syncOwnerRef.current = nextOwner;
    setSyncStatus('idle');
    setSyncUpdatedAt(null);
  }, [session?.userId]);

  useEffect(() => {
    const handleInternalNavigation = (event: globalThis.MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.origin !== window.location.origin) return;
      if (isCurrentDesktopHref(nextUrl.href)) return;
      rememberCurrentScroll();
      navigationModeRef.current = 'push';
      markRoutePush(nextUrl.href);
      setActiveView(nextUrl.pathname === '/me' ? getHrefView(`${nextUrl.pathname}${nextUrl.search}`) : '');
      setSettingsOpen(false);
      beginRouteTransition();
    };
    document.addEventListener('click', handleInternalNavigation, true);
    return () => document.removeEventListener('click', handleInternalNavigation, true);
  }, [beginRouteTransition, markRoutePush, rememberCurrentScroll]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.history.replaceState(
        {
          ...(window.history.state && typeof window.history.state === 'object' ? window.history.state : {}),
          __seekofferHistoryIndex: historyIndexRef.current,
          __seekofferHistoryMax: historyMaxIndexRef.current
        },
        '',
        window.location.href
      );
      pendingRoutePushRef.current = null;
      setHistoryState({
        canBack: historyIndexRef.current > 0,
        canForward: historyIndexRef.current < historyMaxIndexRef.current
      });
    }

    if (firstRouteRef.current) {
      firstRouteRef.current = false;
      setRouteAnnouncement(`${routeLabel}已加载`);
      return;
    }

    if (routeDelayTimerRef.current) window.clearTimeout(routeDelayTimerRef.current);
    if (routeStallTimerRef.current) window.clearTimeout(routeStallTimerRef.current);
    routeDelayTimerRef.current = null;
    routeStallTimerRef.current = null;
    if (routeTransitionStateRef.current === 'delayed') {
      setRouteTransitionState('idle');
    } else if (routeTransitionStateRef.current !== 'idle') {
      setRouteTransitionState('completing');
      if (routeCompleteTimerRef.current) window.clearTimeout(routeCompleteTimerRef.current);
      routeCompleteTimerRef.current = window.setTimeout(() => {
        setRouteTransitionState('idle');
        routeCompleteTimerRef.current = null;
      }, 200);
    }
    setRouteAnnouncement(`${routeLabel}已加载`);
    setReminderOpen(false);
    setSettingsOpen(false);
    window.requestAnimationFrame(() => {
      const routeKey = getCurrentDesktopHref(routePathname, activeView);
      const nextScrollTop =
        navigationModeRef.current === 'history'
          ? scrollPositionsRef.current.get(routeKey) || 0
          : 0;
      contentRegionRef.current?.scrollTo({ top: nextScrollTop, behavior: 'auto' });
      lastRouteKeyRef.current = routeKey;
      navigationModeRef.current = 'push';
      contentRegionRef.current?.querySelector<HTMLElement>('#main-content')?.focus({ preventScroll: true });
    });
  }, [activeView, routeLabel, routePathname, setRouteTransitionState]);

  useEffect(() => {
    if (!settingsOpen) return;
    const frame = window.requestAnimationFrame(() => {
      contentRegionRef.current
        ?.querySelector<HTMLElement>('.desktop-settings-nav-item--active')
        ?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [settingsInitialCategory, settingsOpen]);

  useEffect(() => () => {
    clearRouteTransitionTimers();
    if (overlayFocusTimerRef.current) window.clearTimeout(overlayFocusTimerRef.current);
  }, [clearRouteTransitionTimers]);

  const handleContextualCreate = useCallback(() => {
    const reportUnavailableTarget = (label: string) => {
      emitDesktopFeedback({
        message: `${label}暂时不可用`,
        detail: '页面仍在加载，请稍后再试',
        tone: 'warning'
      });
    };
    const handled = runDesktopCreateIntent(createIntent, {
      application: () => {
        requestDesktopNewApplication();
        if (!isCurrentDesktopHref('/')) {
          emitDesktopRouteChange('/');
          router.push('/');
        }
        emitDesktopFeedback({
          message: '添加申请项目',
          detail: '正在打开手动添加窗口',
          tone: 'neutral'
        });
      },
      'today-item': () => {
        const trigger = document.querySelector<HTMLButtonElement>('.desktop-primary-command');
        if (!trigger) return reportUnavailableTarget('新建事项');
        trigger.click();
      },
      'schedule-item': () => {
        requestDesktopNewSchedule();
        emitDesktopFeedback({
          message: '新增日程',
          detail: '正在打开新建日程',
          tone: 'neutral',
          duration: 1800
        });
      },
      'mentor-contact': () => {
        requestDesktopNewContact();
      }
    });

    if (!handled) {
      emitDesktopFeedback({
        message: '当前页面没有可新增的内容',
        detail: '切换到全部申请、日程提醒或导师联系后可使用 Ctrl+N',
        tone: 'neutral',
        duration: 3000
      });
    }
  }, [createIntent, router]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.defaultPrevented) return;

      const commandShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      const commandPaletteShortcut =
        event.key === 'F1' || ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p');
      const undoShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'z';
      const undoFeedback = feedbackItemRef.current;
      if (
        undoShortcut &&
        !isEditableTarget(event.target) &&
        undoFeedback?.actionLabel === '撤销' &&
        undoFeedback.onAction
      ) {
        if (event.repeat) return;
        event.preventDefault();
        runFeedbackAction(undoFeedback);
        return;
      }
      if (childModalSources.length > 0) {
        const blockedBackgroundShortcut =
          commandShortcut ||
          commandPaletteShortcut ||
          ((event.ctrlKey || event.metaKey) && ['/', ',', 'f', 'n'].includes(event.key.toLowerCase())) ||
          event.key === 'F6' ||
          (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key));
        if (blockedBackgroundShortcut) event.preventDefault();
        if (!(event.ctrlKey || event.metaKey) || !['+', '=', '-', '_', '0'].includes(event.key)) return;
      }
      if ((commandShortcut && !isEditableTarget(event.target)) || commandPaletteShortcut) {
        if (event.repeat) return;
        event.preventDefault();
        if (commandOpen) closeCommand();
        else openCommand();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === '/') {
        if (event.repeat) return;
        event.preventDefault();
        if (shortcutOpen) closeShortcuts();
        else openShortcuts();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === ',') {
        if (event.repeat) return;
        event.preventDefault();
        if (settingsOpen) closeSettings();
        else openSettings();
        return;
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === 'f' &&
        !isEditableTarget(event.target)
      ) {
        const viewSearch = document.querySelector<HTMLInputElement>('[data-desktop-view-search]');
        if (viewSearch) {
          event.preventDefault();
          viewSearch.focus({ preventScroll: true });
          viewSearch.select();
          return;
        }
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'n' &&
        !isEditableTarget(event.target)
      ) {
        if (event.repeat) return;
        event.preventDefault();
        handleContextualCreate();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        const zoomIn = event.key === '+' || event.key === '=' || event.code === 'NumpadAdd';
        const zoomOut = event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract';
        const zoomReset = event.key === '0' || event.code === 'Numpad0';

        if (zoomIn || zoomOut || zoomReset) {
          if (event.repeat) return;
          event.preventDefault();
          if (zoomReset) updateZoomLevel(100);
          else {
            updateZoomLevel(
              getSteppedDesktopZoomLevel(preferences.zoomLevel, zoomIn ? 1 : -1)
            );
          }
          return;
        }
      }
      if (event.altKey && event.key === 'ArrowLeft' && !isEditableTarget(event.target)) {
        event.preventDefault();
        goBack();
        return;
      }
      if (event.altKey && event.key === 'ArrowRight' && !isEditableTarget(event.target)) {
        event.preventDefault();
        goForward();
        return;
      }
      if (event.key === 'F6' && !commandOpen && !shortcutOpen && !reminderOpen) {
        event.preventDefault();
        focusAdjacentRegion(event.shiftKey);
        return;
      }
      if (event.key === 'Escape' && reminderOpen) {
        event.preventDefault();
        closeReminders();
        return;
      }
      if (event.key === 'Escape' && zoomMenuOpen) {
        event.preventDefault();
        closeZoomMenu();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    closeCommand,
    closeReminders,
    closeSettings,
    closeShortcuts,
    closeZoomMenu,
    childModalSources.length,
    commandOpen,
    focusAdjacentRegion,
    goBack,
    goForward,
    handleContextualCreate,
    openCommand,
    openSettings,
    openShortcuts,
    preferences.zoomLevel,
    reminderOpen,
    runFeedbackAction,
    router,
    settingsOpen,
    shortcutOpen,
    updateZoomLevel,
    zoomMenuOpen
  ]);

  useEffect(() => {
    if (commandOpen) {
      const timer = window.setTimeout(() => commandInputRef.current?.focus(), 40);
      return () => window.clearTimeout(timer);
    }
    setCommandQuery('');
    commandApplicationsAttemptedRef.current = false;
    return undefined;
  }, [commandOpen]);

  useEffect(() => {
    commandApplicationsAttemptedRef.current = false;
    setCommandApplications([]);
    setCommandApplicationsLoading(false);
    setCommandApplicationsError('');
  }, [session?.userId]);

  useEffect(() => {
    if (
      !commandOpen ||
      commandApplications.length ||
      commandApplicationsLoading ||
      commandApplicationsAttemptedRef.current
    ) return;
    let active = true;
    commandApplicationsAttemptedRef.current = true;
    setCommandApplicationsLoading(true);
    setCommandApplicationsError('');
    const expectedUserId = session?.userId?.trim();
    if (!expectedUserId) {
      setCommandApplicationsLoading(false);
      return;
    }
    void fetchApplicationRows(expectedUserId)
      .then((rows) => {
        if (active) setCommandApplications(rows);
      })
      .catch(() => {
        if (active) setCommandApplicationsError('申请项目暂时加载失败');
      })
      .finally(() => {
        if (active) setCommandApplicationsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    commandApplications.length,
    commandApplicationsError,
    commandApplicationsLoading,
    commandOpen,
    session?.userId
  ]);

  useEffect(() => {
    setActiveCommandIndex(0);
  }, [commandQuery, commandOpen]);

  useEffect(() => {
    if (!commandOpen || !commandResults.length) return;
    document.getElementById(`desktop-command-option-${activeCommandIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeCommandIndex, commandOpen, commandResults.length]);

  useEffect(() => {
    if (!shortcutOpen) return;
    const timer = window.setTimeout(() => {
      shortcutDialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }, 40);
    return () => window.clearTimeout(timer);
  }, [shortcutOpen]);

  const syncLiveMessage = useMemo(() => {
    if (!session) return '正在核验账号与同步状态';
    if (session.authProvider === 'anonymous') return '当前数据仅保存在这台设备';
    if (syncStatus === 'syncing') return '正在同步申请、日程与导师联系数据';
    if (syncStatus === 'synced') return '申请工作区已同步到当前账号';
    if (syncStatus === 'error') return '本机数据仍安全保存，云端同步暂时失败，可在设置中重试';
    if (syncStatus === 'local') return '本机修改正在等待云端同步';
    return '申请工作区尚未进行本次同步';
  }, [session, syncStatus]);

  const handleSettingsSyncNow = useCallback(async () => {
    const userId = session?.userId?.trim();
    if (!userId || session?.authProvider === 'anonymous') {
      throw new Error('A verified account is required to synchronize.');
    }

    setRouteAnnouncement('正在同步申请工作区');
    const result = await synchronizeDesktopWorkspace(userId);
    setSyncUpdatedAt(result.completedAt);
    // Keep the workbench's account-scoped cache coherent the next time it is
    // shown, without closing Settings or navigating away from this page.
    requestDesktopApplicationSync();
    setRouteAnnouncement('申请工作区同步完成');
  }, [session?.authProvider, session?.userId]);

  const dispatchDirectCreate = useCallback((intent: DesktopDirectCreateIntent) => {
    if (intent === 'application') requestDesktopNewApplication();
    else if (intent === 'schedule') requestDesktopNewSchedule();
    else requestDesktopNewContact();
  }, []);

  const requestDirectCreate = useCallback((intent: DesktopDirectCreateIntent) => {
    const href = directCreateHrefs[intent];
    closeCommand(false);
    setSettingsOpen(false);
    setRouteAnnouncement(directCreateLabels[intent]);
    if (isCurrentDesktopHref(href)) {
      dispatchDirectCreate(intent);
      return;
    }
    pendingDirectCreateRef.current = intent;
    emitDesktopRouteChange(href);
    router.push(href);
  }, [closeCommand, dispatchDirectCreate, router]);

  useEffect(() => {
    const pendingIntent = pendingDirectCreateRef.current;
    if (!pendingIntent || !isCurrentDesktopHref(directCreateHrefs[pendingIntent])) return;
    pendingDirectCreateRef.current = null;
    const frame = window.requestAnimationFrame(() => dispatchDirectCreate(pendingIntent));
    return () => window.cancelAnimationFrame(frame);
  }, [activeView, dispatchDirectCreate, routePathname]);

  function handleCommandNavigate(href: string) {
    if (href.startsWith('/notices?q=')) rememberCommandQuery(commandQuery);
    if (href === 'desktop://settings') {
      closeCommand(false);
      openSettings();
      return;
    }
    if (href === 'desktop://reminders') {
      closeCommand(false);
      openReminders();
      return;
    }
    if (href === 'desktop://check-updates') {
      closeCommand(false);
      openSettings('about');
      void checkForUpdates();
      return;
    }
    if (href === 'desktop://new-application') {
      requestDirectCreate('application');
      return;
    }
    if (href === 'desktop://new-schedule') {
      requestDirectCreate('schedule');
      return;
    }
    if (href === 'desktop://new-contact') {
      requestDirectCreate('contact');
      return;
    }
    closeCommand(false);
    setSettingsOpen(false);
    if (isCurrentDesktopHref(href)) return;
    emitDesktopRouteChange(href);
    router.push(href);
  }

  function handleReminderNavigate(href: string) {
    closeReminders(false);
    setSettingsOpen(false);
    if (isCurrentDesktopHref(href)) return;
    emitDesktopRouteChange(href);
    router.push(href);
  }

  function handleCommandInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || !commandResults.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveCommandIndex((current) => (current + 1) % commandResults.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveCommandIndex((current) => (current - 1 + commandResults.length) % commandResults.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveCommandIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveCommandIndex(commandResults.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      handleCommandNavigate(commandResults[activeCommandIndex].href);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeCommand();
    }
  }

  function trapDialogFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return;
    const dialog = event.currentTarget;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),a[href],select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
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

  return (
    <div
      className="desktop-app-shell"
      data-reminders-open={reminderOpen}
      data-settings-open={settingsOpen}
      data-window-active={windowActive}
      data-desktop-theme={resolvedTheme}
      data-density={preferences.density}
      data-reduce-motion={preferences.reduceMotion}
      data-zoom-level={preferences.zoomLevel}
      data-route-pending={routePending}
      data-route-transition={routeTransitionState}
    >
      <DesktopExternalLinkBridge />
      <div
        className={`desktop-route-progress ${routeTransitionState !== 'idle' && routeTransitionState !== 'delayed' ? 'is-active' : ''}`}
        data-state={routeTransitionState}
        aria-hidden="true"
      />
      <span className="sr-only" aria-live="polite" aria-atomic="true">{routeAnnouncement}</span>
      <span className="sr-only" aria-live="polite" aria-atomic="true">{feedbackAnnouncement}</span>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {syncLiveMessage}
      </span>
      <header
        ref={topbarRef}
        tabIndex={-1}
        className="desktop-topbar desktop-titlebar"
        onMouseDown={handleTitlebarMouseDown}
      >
        <div className="desktop-titlebar-brand" inert={appModalOpen ? true : undefined}>
          <DesktopLink
            href="/"
            className="desktop-brand-link"
            ariaCurrent={!settingsOpen && routePathname === '/' ? 'page' : undefined}
            ariaLabel="寻鹿 SeekOffer 首页"
            onNavigate={() => setSettingsOpen(false)}
          >
            <span className="desktop-brand-mark">
              <Image
                src="/desktop/seekoffer-mark.png"
                alt="寻鹿"
                fill
                sizes="38px"
                priority
                className="desktop-brand-logo-image"
              />
            </span>
            <span className="desktop-brand-wordmark">
              <strong>寻鹿</strong>
              <span className="desktop-brand-english">SeekOffer</span>
            </span>
          </DesktopLink>
        </div>
        <div
          className="desktop-titlebar-drag"
          aria-hidden="true"
        />
        <button
          ref={searchTriggerRef}
          type="button"
          aria-label="搜索与快速前往"
          title="搜索与快速前往（Ctrl+K）"
          onClick={openCommand}
          inert={appModalOpen ? true : undefined}
          data-window-no-drag
          className="desktop-search-trigger"
        >
          <Search20Regular className="desktop-search-trigger-icon" />
          <span className="desktop-search-trigger-copy">搜索申请、学校、通知或命令</span>
          <kbd className="desktop-shortcut-key">Ctrl K</kbd>
        </button>
        <div className="desktop-titlebar-actions" data-window-no-drag inert={appModalOpen ? true : undefined}>
          <button
            ref={reminderTriggerRef}
            type="button"
            aria-label={`提醒中心，${unreadReminderCount} 条未读`}
            aria-controls="desktop-reminder-center"
            aria-expanded={reminderOpen}
            title="提醒中心"
            onClick={toggleReminders}
            className={`desktop-toolbar-icon desktop-reminder-trigger${reminderOpen ? ' desktop-reminder-trigger--active' : ''}`}
            data-window-no-drag
          >
            <Alert20Regular className="desktop-toolbar-glyph" />
            {unreadReminderCount ? (
              <span className="desktop-toolbar-badge">
                {Math.min(unreadReminderCount, 9)}
              </span>
            ) : null}
          </button>
        </div>
        <DesktopWindowControls />
      </header>

      <nav
        ref={primaryRailRef}
        tabIndex={-1}
        className="desktop-primary-rail"
        aria-label="桌面端主导航"
        inert={appModalOpen ? true : undefined}
      >
        <div className="desktop-nav-list desktop-nav-list--primary">
          {primaryNavigationGroups.map((group) => (
            <div
              key={group.id}
              className="desktop-nav-group"
              role="group"
              aria-labelledby={`desktop-nav-group-${group.id}`}
            >
              <span id={`desktop-nav-group-${group.id}`} className="desktop-nav-group-label">
                {group.label}
              </span>
              <div className="desktop-nav-group-items">
                {group.items.map((item) => {
                  const active = !settingsOpen && item.section === section;
                  const Icon = active ? item.activeIcon : item.icon;
                  const accessibleLabel =
                    item.section === 'schedule' && unreadReminderCount
                      ? `${item.label}，${unreadReminderCount} 项待处理`
                      : item.label;
                  return (
                    <DesktopLink
                      key={item.section}
                      href={item.href}
                      ariaCurrent={active ? 'page' : undefined}
                      ariaLabel={accessibleLabel}
                      onNavigate={() => {
                        closeReminders(false);
                        setSettingsOpen(false);
                      }}
                      className={`desktop-primary-nav-item ${
                        active ? 'desktop-primary-nav-item--active' : ''
                      }`}
                    >
                      <Icon aria-hidden="true" />
                      <span>{item.label}</span>
                      {item.section === 'schedule' && unreadReminderCount ? (
                        <span className="desktop-nav-badge" aria-hidden="true">
                          {Math.min(unreadReminderCount, 99)}
                        </span>
                      ) : null}
                    </DesktopLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="desktop-rail-utilities">
          <DesktopLink
            href="/guide"
            ariaCurrent={!settingsOpen && section === 'help' ? 'page' : undefined}
            ariaLabel="帮助与反馈"
            onNavigate={() => {
              closeReminders(false);
              setSettingsOpen(false);
            }}
            className="desktop-rail-utility-button"
          >
            <QuestionCircle24Regular aria-hidden="true" />
            <span className="desktop-rail-utility-label">帮助与反馈</span>
          </DesktopLink>
          <button
            ref={settingsTriggerRef}
            type="button"
            aria-current={settingsOpen || section === 'settings' ? 'page' : undefined}
            aria-label={updaterAttention ? `设置，${updaterAttention.label}` : '设置'}
            aria-keyshortcuts="Control+,"
            data-update-attention={updaterAttention?.kind}
            onClick={() => {
              if (settingsOpen) closeSettings();
              else openSettings(updaterAttention || section === 'settings' ? 'about' : 'general');
            }}
            className={`desktop-rail-utility-button${
              settingsOpen || section === 'settings'
                ? ' desktop-rail-utility-button--active'
                : ''
            }`}
          >
            <Settings20Regular className="desktop-rail-utility-icon" aria-hidden="true" />
            {updaterAttention ? (
              <i
                className="desktop-settings-update-dot"
                aria-hidden="true"
              />
            ) : null}
            <span className="desktop-rail-utility-label">设置</span>
            <kbd className="desktop-rail-shortcut-key">Ctrl ,</kbd>
          </button>
        </div>
      </nav>

      <section
        ref={contentRegionRef}
        tabIndex={-1}
        className="desktop-content-region desktop-scrollbar"
        aria-label="寻鹿桌面应用内容"
        aria-busy={routePending}
        inert={shellModalOpen ? true : undefined}
      >
        <div
          key={settingsOpen ? `settings-${settingsInitialCategory}` : routePathname}
          className="desktop-view-stage"
        >
          {settingsOpen ? (
            <DesktopSettingsPage
              preferences={preferences}
              onChange={handlePreferencesChange}
              onBack={() => closeSettings()}
              onReset={handlePreferencesReset}
              initialCategory={settingsInitialCategory}
              session={session}
              syncStatus={syncStatus}
              syncUpdatedAt={syncUpdatedAt}
              onSyncNow={handleSettingsSyncNow}
            />
          ) : routePathname === '/' ? (
            <DesktopHome
              unreadReminderCount={unreadReminderCount}
              onOpenReminders={openReminders}
              zoomLevel={preferences.zoomLevel}
            />
          ) : routePathname === '/todos' ? (
            <DesktopToday
              unreadReminderCount={unreadReminderCount}
              onOpenReminders={openReminders}
            />
          ) : routePathname === '/resources' ? (
            <DesktopResourceCenter />
          ) : routePathname === '/guide' ? (
            <DesktopGuide />
          ) : (
            <div className="desktop-route-content desktop-focus-region">{children}</div>
          )}
        </div>
      </section>

      <footer
        className="desktop-statusbar"
        aria-label="应用状态栏"
        inert={appModalOpen ? true : undefined}
      >
        <div
          className="desktop-zoom-control"
          ref={zoomMenuRef}
          onBlur={(event) => {
            const nextTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null;
            if (zoomMenuOpen && (!nextTarget || !event.currentTarget.contains(nextTarget))) {
              closeZoomMenu(false);
            }
          }}
        >
          {zoomMenuOpen ? (
            <div
              id="desktop-zoom-menu"
              ref={zoomMenuListRef}
              className="desktop-zoom-menu"
              role="menu"
              aria-label="界面缩放"
              onKeyDown={handleZoomMenuKeyDown}
            >
              <header>
                <strong>界面缩放</strong>
                <span>Ctrl + + / Ctrl + -</span>
              </header>
              <div>
                {DESKTOP_ZOOM_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    role="menuitemradio"
                    aria-checked={preferences.zoomLevel === level}
                    onClick={() => {
                      updateZoomLevel(level);
                      closeZoomMenu();
                    }}
                  >
                    <span>{level}%</span>
                    {preferences.zoomLevel === level ? (
                      <CheckCircle2 aria-hidden="true" />
                    ) : null}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="desktop-zoom-reset"
                role="menuitem"
                onClick={() => {
                  updateZoomLevel(100);
                  closeZoomMenu();
                }}
              >
                <span>重置缩放</span>
                <kbd>Ctrl 0</kbd>
              </button>
            </div>
          ) : null}
          <button
            type="button"
            aria-label="缩小界面"
            title="缩小（Ctrl+-）"
            disabled={preferences.zoomLevel === DESKTOP_ZOOM_LEVELS[0]}
            onClick={() =>
              updateZoomLevel(getSteppedDesktopZoomLevel(preferences.zoomLevel, -1))
            }
          >
            <Subtract20Regular aria-hidden="true" />
          </button>
          <button
            ref={zoomTriggerRef}
            type="button"
            className="desktop-zoom-value"
            aria-haspopup="menu"
            aria-expanded={zoomMenuOpen}
            aria-controls={zoomMenuOpen ? 'desktop-zoom-menu' : undefined}
            onClick={() => setZoomMenuOpen((current) => !current)}
          >
            {preferences.zoomLevel}%
          </button>
          <button
            type="button"
            aria-label="放大界面"
            title="放大（Ctrl++）"
            disabled={
              preferences.zoomLevel === DESKTOP_ZOOM_LEVELS[DESKTOP_ZOOM_LEVELS.length - 1]
            }
            onClick={() =>
              updateZoomLevel(getSteppedDesktopZoomLevel(preferences.zoomLevel, 1))
            }
          >
            <Add20Regular aria-hidden="true" />
          </button>
        </div>
        {zoomError ? (
          <span className="desktop-zoom-error" role="status">{zoomError}</span>
        ) : null}
      </footer>

      {feedbackItem ? (
        <section
          className={`desktop-feedback-toast desktop-feedback-toast--${feedbackItem.tone || 'neutral'} desktop-feedback-toast--state-${feedbackState}`}
          data-state={feedbackVisible ? 'open' : 'closed'}
          data-feedback-state={feedbackState || undefined}
          data-feedback-group={getDesktopFeedbackGroup(feedbackItem)}
          role={feedbackState === 'error' ? 'alert' : 'status'}
          aria-live={feedbackState === 'error' ? 'assertive' : 'polite'}
          onMouseEnter={() => {
            if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
          }}
          onMouseLeave={() => {
            if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
            feedbackTimerRef.current = window.setTimeout(dismissFeedback, 1800);
          }}
        >
          <span className="desktop-feedback-icon" aria-hidden="true">
            {feedbackState === 'success' ? (
              <CheckCircle2 />
            ) : feedbackState === 'undo' ? (
              <Undo2 />
            ) : feedbackState === 'pending' ? (
              <RefreshCw className="desktop-feedback-pending-icon" />
            ) : (
              <Alert20Regular />
            )}
          </span>
          <span className="desktop-feedback-copy">
            <strong>{feedbackItem.message}</strong>
            {feedbackItem.detail ? <small>{feedbackItem.detail}</small> : null}
          </span>
          {feedbackItem.actionLabel && feedbackItem.onAction ? (
            <button
              type="button"
              className="desktop-feedback-action"
              onClick={() => runFeedbackAction(feedbackItem)}
            >
              {feedbackItem.actionLabel}
            </button>
          ) : null}
          <button
            type="button"
            className="desktop-feedback-close"
            aria-label="关闭提示"
            onClick={dismissFeedback}
          >
            <X aria-hidden="true" />
          </button>
        </section>
      ) : null}

      <div
        className="desktop-reminder-backdrop"
        aria-hidden="true"
        onClick={() => closeReminders()}
      />

      <DesktopReminderCenter
        open={reminderOpen}
        onClose={() => closeReminders()}
        onNavigate={handleReminderNavigate}
        onUnreadCountChange={setUnreadReminderCount}
        preferences={preferences}
        onPreferencesChange={handlePreferencesChange}
        onOpenSettings={() => {
          closeReminders(false);
          openSettings('notifications');
        }}
      />

      {commandLayer.mounted ? (
        <div
          className="desktop-command-backdrop desktop-command-layer"
          data-state={commandLayer.visible ? 'open' : 'closed'}
          aria-hidden={!commandLayer.visible}
          inert={!commandLayer.visible ? true : undefined}
          onMouseDown={() => closeCommand()}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="搜索与快速前往"
            className="desktop-command-dialog"
            onMouseDown={(event: MouseEvent<HTMLElement>) => event.stopPropagation()}
            onKeyDown={(event) => {
              trapDialogFocus(event);
              if (event.key === 'Escape') {
                event.preventDefault();
                closeCommand();
              }
            }}
          >
            <div className="desktop-command-search">
              <Search className="desktop-command-search-icon" strokeWidth={1.75} />
              <input
                ref={commandInputRef}
                value={commandQuery}
                role="combobox"
                aria-label="搜索申请、学校、通知或命令"
                aria-autocomplete="list"
                aria-expanded="true"
                aria-controls="desktop-command-results"
                aria-activedescendant={commandResults.length ? `desktop-command-option-${activeCommandIndex}` : undefined}
                onChange={(event) => setCommandQuery(event.target.value)}
                onKeyDown={handleCommandInputKeyDown}
                placeholder="搜索申请、学校、通知或命令"
                className="desktop-command-input"
              />
              <kbd className="desktop-command-escape-key">Esc</kbd>
            </div>
            <div className="desktop-command-summary">
              <span>{commandQuery.trim() ? '搜索结果' : '快速前往'}</span>
              <span>{commandResults.length} 项</span>
            </div>
            <div id="desktop-command-results" role="listbox" aria-label="快速前往结果" className="desktop-command-results desktop-scrollbar">
              {commandResults.length ? (
                commandResults.map((item, index) => {
                  const Icon = item.icon;
                  const active = index === activeCommandIndex;
                  const showCategory = index === 0 || commandResults[index - 1]?.category !== item.category;
                  return (
                    <Fragment key={`${item.href}-${item.label}`}>
                      {showCategory ? (
                        <div className="desktop-command-group-label" role="presentation">
                          {item.category}
                        </div>
                      ) : null}
                      <button
                        id={`desktop-command-option-${index}`}
                        type="button"
                        role="option"
                        aria-selected={active}
                        tabIndex={-1}
                        onMouseMove={() => setActiveCommandIndex(index)}
                        onClick={() => handleCommandNavigate(item.href)}
                        className={`desktop-command-option${active ? ' desktop-command-option--active' : ''}`}
                      >
                        <span className="desktop-command-option-icon">
                          <Icon className="desktop-command-option-glyph" strokeWidth={1.75} />
                        </span>
                        <span className="desktop-command-option-copy">
                          <span className="desktop-command-option-title">{item.label}</span>
                          <span className="desktop-command-option-description">
                            {item.description || item.keywords || item.href}
                          </span>
                        </span>
                        <span className="desktop-command-option-hint">Enter</span>
                      </button>
                    </Fragment>
                  );
                })
              ) : (
                <div className="desktop-command-empty">
                  {commandApplicationsLoading ? (
                    '正在读取你的申请项目…'
                  ) : commandApplicationsError ? (
                    <div role="alert" className="desktop-command-error">
                      <span>{commandApplicationsError}</span>
                      <button
                        type="button"
                        className="desktop-secondary-command"
                        onClick={() => {
                          commandApplicationsAttemptedRef.current = false;
                          setCommandApplicationsError('');
                        }}
                      >
                        重新加载
                      </button>
                    </div>
                  ) : (
                    '没有找到相关内容，试试更短的关键词。'
                  )}
                </div>
              )}
            </div>
            <div className="desktop-command-footer">
              <span>↑ ↓ 选择 · Enter 打开 · Esc 关闭</span>
              <button type="button" onClick={openShortcuts} className="desktop-command-shortcuts-trigger">
                查看快捷键
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {shortcutLayer.mounted ? (
        <div
          className="desktop-command-backdrop desktop-command-layer desktop-shortcut-layer"
          data-state={shortcutLayer.visible ? 'open' : 'closed'}
          aria-hidden={!shortcutLayer.visible}
          inert={!shortcutLayer.visible ? true : undefined}
          onMouseDown={() => closeShortcuts()}
        >
          <section
            ref={shortcutDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="desktop-shortcuts-title"
            className="desktop-shortcut-dialog"
            onMouseDown={(event: MouseEvent<HTMLElement>) => event.stopPropagation()}
            onKeyDown={(event) => {
              trapDialogFocus(event);
              if (event.key === 'Escape') {
                event.preventDefault();
                closeShortcuts();
              }
            }}
          >
            <div className="desktop-shortcut-header">
              <div className="desktop-shortcut-heading">
                <h2 id="desktop-shortcuts-title" className="desktop-shortcut-title">键盘快捷键</h2>
                <p className="desktop-shortcut-description">保留成熟 Windows 应用里最常用的操作</p>
              </div>
              <button type="button" aria-label="关闭快捷键" onClick={() => closeShortcuts()} className="desktop-toolbar-icon">
                <X className="desktop-toolbar-glyph" strokeWidth={1.8} />
              </button>
            </div>
            <dl className="desktop-shortcut-list">
              {[
                ['搜索全部功能', 'Ctrl + K / F1'],
                ['搜索当前列表', 'Ctrl + F'],
                [createShortcutLabel, 'Ctrl + N'],
                ['撤销最近操作（提示可用时）', 'Ctrl + Z'],
                ['打开设置', 'Ctrl + ,'],
                ['后退 / 前进', 'Alt + ← / →'],
                ['在界面区域间移动焦点', 'F6 / Shift + F6'],
                ['查看快捷键', 'Ctrl + /'],
                ['关闭面板或抽屉', 'Esc']
              ].map(([label, keys]) => (
                <div key={label} className="desktop-shortcut-row">
                  <dt>{label}</dt>
                  <dd><kbd>{keys}</kbd></dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      ) : null}
    </div>
  );
}
