'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Cloud,
  CircleHelp,
  Clock3,
  Info,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Pause,
  Play,
  Power,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound,
  type LucideIcon
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react';
import {
  DEFAULT_DESKTOP_PREFERENCES as DESKTOP_PREFERENCES_DEFAULTS,
  DESKTOP_ZOOM_LEVELS,
  type DesktopPreferences
} from '@/lib/desktop-preferences';
import { emitDesktopFeedback } from '@/lib/desktop-route-events';
import type { DesktopSyncStatus } from '@/lib/desktop-route-events';
import { resetDesktopUpdaterPreferences } from '@/lib/desktop-updater';
import {
  getAuthProviderLabel,
  signOutUser,
  type UserSession
} from '@/lib/user-session';
import { DesktopSoftwareUpdateSettings } from './desktop-update-provider';
import styles from './desktop-settings-page.module.css';

export type DesktopSettingsCategory = 'general' | 'account' | 'notifications' | 'appearance' | 'about';
type AutostartState = 'checking' | 'enabled' | 'disabled' | 'unavailable' | 'error';
type NotificationPermissionState = 'checking' | 'granted' | 'prompt' | 'denied' | 'unavailable';

const settingsCategories: Array<{
  id: DesktopSettingsCategory;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  { id: 'general', label: '常规', description: '启动与运行方式', icon: Settings2 },
  { id: 'account', label: '账号与同步', description: '身份、数据同步与退出', icon: UserRound },
  { id: 'notifications', label: '通知', description: 'Windows 横幅与应用内提醒', icon: Bell },
  { id: 'appearance', label: '外观', description: '主题、缩放与列表密度', icon: Palette },
  { id: 'about', label: '关于', description: '版本、帮助与协议', icon: Info }
];

const launchDestinations: Array<{
  value: DesktopPreferences['launchDestination'];
  label: string;
}> = [
  { value: 'last', label: '上次浏览的位置' },
  { value: 'home', label: '全部申请' },
  { value: 'notices', label: '通知库' }
];

const desktopThemeOptions: Array<{
  value: DesktopPreferences['theme'];
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    value: 'system',
    label: '跟随系统',
    description: '随 Windows 浅色或深色模式自动切换',
    icon: Monitor
  },
  {
    value: 'light',
    label: '浅色',
    description: '适合白天与明亮环境',
    icon: Sun
  },
  {
    value: 'dark',
    label: '深色',
    description: '减少夜间长时间使用的刺眼感',
    icon: Moon
  }
];

const notificationKinds: Array<{
  key: keyof DesktopPreferences['notifications']['kinds'];
  label: string;
  description: string;
}> = [
  { key: 'deadline', label: '截止日期', description: '申请即将截止或需要尽快处理时提醒' },
  { key: 'materials', label: '材料风险', description: '截止前仍有材料未标记完成时提醒' },
  { key: 'change', label: '通知变更', description: '收藏的通知更新截止时间或申请要求时提醒' },
  { key: 'mentor', label: '导师跟进', description: '到达设定的下一次导师联系日期时提醒' }
];

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function formatPausedUntil(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

function formatSyncUpdatedAt(value: number | null) {
  if (!value || !Number.isFinite(value)) return '当前会话尚未完成同步';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date(value));
}

function DesktopSettingSwitch({
  checked,
  onChange,
  label,
  disabled = false
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`desktop-setting-switch${checked ? ' desktop-setting-switch--checked' : ''}${
        disabled ? ' desktop-setting-switch--disabled' : ''
      }`}
      data-state={disabled ? 'disabled' : checked ? 'checked' : 'unchecked'}
    >
      <input
        className="desktop-setting-switch-input"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="desktop-setting-switch-track" aria-hidden="true">
        <span className="desktop-setting-switch-thumb" />
      </span>
    </label>
  );
}

function DesktopSettingStatus({
  tone,
  children
}: {
  tone: 'neutral' | 'success' | 'warning';
  children: React.ReactNode;
}) {
  return (
    <span className={`desktop-setting-status desktop-setting-status--${tone}`} data-tone={tone}>
      {tone === 'success' ? <CheckCircle2 aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function DesktopSettingsPage({
  preferences,
  onChange,
  onBack,
  onReset,
  initialCategory = 'general',
  session,
  syncStatus,
  syncUpdatedAt,
  onSyncNow
}: {
  preferences: DesktopPreferences;
  onChange: (next: DesktopPreferences) => void;
  onBack: () => void;
  onReset: () => void;
  initialCategory?: DesktopSettingsCategory;
  session: UserSession | null;
  syncStatus: DesktopSyncStatus;
  syncUpdatedAt: number | null;
  onSyncNow: () => Promise<void>;
}) {
  const [activeCategory, setActiveCategory] =
    useState<DesktopSettingsCategory>(initialCategory);
  const [autostartState, setAutostartState] = useState<AutostartState>('checking');
  const [autostartBusy, setAutostartBusy] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>('checking');
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [resetConfirmationVisible, setResetConfirmationVisible] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [manualSyncBusy, setManualSyncBusy] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const resetTriggerRef = useRef<HTMLButtonElement>(null);
  const resetConfirmRef = useRef<HTMLButtonElement>(null);
  const categoryRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const readAutostartState = useCallback(async () => {
    if (!isTauriRuntime()) {
      setAutostartState('unavailable');
      return;
    }

    try {
      const { isEnabled } = await import('@tauri-apps/plugin-autostart');
      setAutostartState((await isEnabled()) ? 'enabled' : 'disabled');
    } catch {
      setAutostartState('error');
    }
  }, []);

  const readNotificationPermission = useCallback(async () => {
    if (!isTauriRuntime()) {
      setNotificationPermission('unavailable');
      return;
    }

    try {
      const { isPermissionGranted } = await import('@tauri-apps/plugin-notification');
      setNotificationPermission((await isPermissionGranted()) ? 'granted' : 'prompt');
    } catch {
      setNotificationPermission('unavailable');
    }
  }, []);

  useEffect(() => {
    void readAutostartState();
    void readNotificationPermission();
  }, [readAutostartState, readNotificationPermission]);

  useEffect(() => {
    setActiveCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    if (!statusMessage) return;
    const isProblem = /失败|无法|未获允许|需要先允许|仅在桌面安装版/.test(statusMessage);
    const isProgress = /正在|读取|请求/.test(statusMessage);
    emitDesktopFeedback({
      message: statusMessage,
      tone: isProblem ? 'warning' : isProgress ? 'neutral' : 'success',
      duration: isProblem ? 4800 : isProgress ? 2200 : 2600
    });
  }, [statusMessage]);

  useEffect(() => {
    if (!resetConfirmationVisible) return;
    const frame = window.requestAnimationFrame(() => resetConfirmRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [resetConfirmationVisible]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;

      if (resetConfirmationVisible) {
        setResetConfirmationVisible(false);
        window.requestAnimationFrame(() => resetTriggerRef.current?.focus());
        return;
      }

      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('input,select,textarea')) return;
      onBack();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack, resetConfirmationVisible]);

  const notificationsPaused = useMemo(() => {
    const pausedUntil = preferences.notifications.pausedUntil;
    return Boolean(pausedUntil && Date.parse(pausedUntil) > currentTime);
  }, [currentTime, preferences.notifications.pausedUntil]);

  function updatePreferences(next: Partial<DesktopPreferences>) {
    onChange({ ...preferences, ...next });
  }

  function updateNotifications(next: Partial<DesktopPreferences['notifications']>) {
    onChange({
      ...preferences,
      notifications: {
        ...preferences.notifications,
        ...next
      }
    });
  }

  async function handleAutostartToggle() {
    if (!isTauriRuntime() || autostartBusy) return;

    setAutostartBusy(true);
    setStatusMessage('');
    try {
      const autostart = await import('@tauri-apps/plugin-autostart');
      if (autostartState === 'enabled') {
        await autostart.disable();
        setAutostartState('disabled');
        setStatusMessage('已关闭开机启动');
      } else {
        await autostart.enable();
        setAutostartState('enabled');
        setStatusMessage('已开启开机启动');
      }
    } catch {
      setAutostartState('error');
      setStatusMessage('无法修改开机启动，请稍后重试');
    } finally {
      setAutostartBusy(false);
    }
  }

  async function requestWindowsNotificationPermission() {
    const notification = await import('@tauri-apps/plugin-notification');
    let granted = await notification.isPermissionGranted();
    if (!granted) {
      const permission = await notification.requestPermission();
      granted = permission === 'granted';
      setNotificationPermission(granted ? 'granted' : 'denied');
    } else {
      setNotificationPermission('granted');
    }
    return { notification, granted };
  }

  async function handleWindowsDeliveryToggle(checked: boolean) {
    if (!checked) {
      updateNotifications({ windowsDelivery: false });
      setStatusMessage('寻鹿已停止发送 Windows 通知');
      return;
    }

    if (!isTauriRuntime()) {
      setNotificationPermission('unavailable');
      setStatusMessage('Windows 通知仅在桌面安装版中可用');
      return;
    }

    setNotificationBusy(true);
    setStatusMessage('');
    try {
      const { granted } = await requestWindowsNotificationPermission();
      if (granted) {
        updateNotifications({ windowsDelivery: true });
        setStatusMessage('寻鹿运行期间会请求显示 Windows 横幅');
      } else {
        updateNotifications({ windowsDelivery: false });
        setStatusMessage('桌面通知请求未获允许，请检查 Windows 通知设置');
      }
    } catch {
      setNotificationPermission('unavailable');
      setStatusMessage('暂时无法连接 Windows 通知服务');
    } finally {
      setNotificationBusy(false);
    }
  }

  async function handleTestNotification() {
    if (!isTauriRuntime() || notificationBusy) return;

    setNotificationBusy(true);
    setStatusMessage('');
    try {
      const { notification, granted } = await requestWindowsNotificationPermission();
      if (!granted) {
        setStatusMessage('需要先允许 Windows 通知权限');
        return;
      }

      notification.sendNotification({
        title: '寻鹿通知测试',
        body: '寻鹿已请求显示这条测试横幅。运行期间，新出现的重要提醒会通过这里提示。'
      });
      setStatusMessage('已请求发送测试通知；若未看到，请检查 Windows 通知和勿扰设置');
    } catch {
      setStatusMessage('测试通知发送失败，请检查 Windows 通知设置');
    } finally {
      setNotificationBusy(false);
    }
  }

  function handlePauseNotifications() {
    const pausedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    updateNotifications({ pausedUntil });
    setStatusMessage('运行中的 Windows 横幅已暂停 1 小时');
  }

  function handleResumeNotifications() {
    updateNotifications({ pausedUntil: null });
    setStatusMessage('运行中的 Windows 横幅已恢复');
  }

  function handleReset() {
    onReset();
    resetDesktopUpdaterPreferences();
    setResetConfirmationVisible(false);
    setStatusMessage('设置已恢复为默认值');
    window.requestAnimationFrame(() => resetTriggerRef.current?.focus());
  }

  function closeResetConfirmation() {
    setResetConfirmationVisible(false);
    window.requestAnimationFrame(() => resetTriggerRef.current?.focus());
  }

  const categoriesAreHorizontal = preferences.zoomLevel >= 150;
  const categoryOrientation = categoriesAreHorizontal ? 'horizontal' : 'vertical';

  function handleCategoryKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    const forwardKey = categoriesAreHorizontal ? 'ArrowRight' : 'ArrowDown';
    const backwardKey = categoriesAreHorizontal ? 'ArrowLeft' : 'ArrowUp';
    if (![forwardKey, backwardKey, 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? settingsCategories.length - 1
          : event.key === forwardKey
            ? (index + 1) % settingsCategories.length
            : (index - 1 + settingsCategories.length) % settingsCategories.length;
    const nextCategory = settingsCategories[nextIndex];
    setActiveCategory(nextCategory.id);
    setResetConfirmationVisible(false);
    setStatusMessage('');
    window.requestAnimationFrame(() => {
      const nextTab = categoryRefs.current[nextIndex];
      nextTab?.focus();
      nextTab?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }

  const autostartStatus = (() => {
    if (autostartState === 'checking') {
      return <DesktopSettingStatus tone="neutral">正在读取 Windows 设置</DesktopSettingStatus>;
    }
    if (autostartState === 'enabled') {
      return <DesktopSettingStatus tone="success">已随 Windows 启动</DesktopSettingStatus>;
    }
    if (autostartState === 'disabled') {
      return <DesktopSettingStatus tone="neutral">当前未启用</DesktopSettingStatus>;
    }
    if (autostartState === 'error') {
      return <DesktopSettingStatus tone="warning">无法读取系统状态</DesktopSettingStatus>;
    }
    return <DesktopSettingStatus tone="neutral">仅桌面安装版可用</DesktopSettingStatus>;
  })();

  const notificationStatus = (() => {
    if (notificationPermission === 'checking') {
      return <DesktopSettingStatus tone="neutral">正在检查桌面通知组件</DesktopSettingStatus>;
    }
    if (notificationPermission === 'granted') {
      return <DesktopSettingStatus tone="success">桌面通知组件可用</DesktopSettingStatus>;
    }
    if (notificationPermission === 'denied') {
      return <DesktopSettingStatus tone="warning">桌面通知请求未获允许</DesktopSettingStatus>;
    }
    if (notificationPermission === 'prompt') {
      return <DesktopSettingStatus tone="neutral">开启后会请求显示横幅</DesktopSettingStatus>;
    }
    return <DesktopSettingStatus tone="neutral">仅桌面安装版可用</DesktopSettingStatus>;
  })();

  const syncPresentation = (() => {
    if (!session) {
      return {
        label: '正在核验账号',
        detail: '账号状态发生变化后，应用入口会自动处理。',
        tone: 'neutral' as const
      };
    }
    if (session.authProvider === 'anonymous' || !session.userId) {
      return {
        label: '仅保存在当前设备',
        detail: '当前数据不会同步到其他设备。',
        tone: 'neutral' as const
      };
    }
    if (syncStatus === 'syncing') {
      return {
        label: '正在同步',
        detail: '正在保存申请、材料进度与日程信息。',
        tone: 'neutral' as const
      };
    }
    if (syncStatus === 'synced') {
      return {
        label: '已同步',
        detail: '申请数据已经保存到当前账号。',
        tone: 'success' as const
      };
    }
    if (syncStatus === 'error') {
      return {
        label: '同步失败',
        detail: '本机数据仍安全保存，云端暂时不可用；可检查网络后重试。',
        tone: 'warning' as const
      };
    }
    if (syncStatus === 'local') {
      return {
        label: '等待同步',
        detail: '修改已保存在本机，连接恢复后可在这里重新同步。',
        tone: 'neutral' as const
      };
    }
    return {
      label: '尚未同步',
      detail: '点击“立即同步”即可更新申请、日程与导师联系数据。',
      tone: 'neutral' as const
    };
  })();

  async function handleManualSync() {
    if (manualSyncBusy || syncStatus === 'syncing') return;
    setManualSyncBusy(true);
    setStatusMessage('正在同步申请、日程与导师联系数据…');
    try {
      await onSyncNow();
      setStatusMessage('同步完成，申请工作区已更新。');
    } catch {
      setStatusMessage('同步失败；本机数据仍安全保存，请检查网络后重试。');
    } finally {
      setManualSyncBusy(false);
    }
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setStatusMessage('');
    try {
      await signOutUser();
    } catch {
      setStatusMessage('退出失败，当前账号仍保持登录；请检查系统存储权限后重试。');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div
      className={`${styles.integrityRoot} desktop-core-page desktop-core-page--fixed desktop-settings-page`}
      data-settings-category={activeCategory}
      aria-busy={manualSyncBusy || syncStatus === 'syncing'}
    >
      <header className="desktop-core-page-header desktop-page-header desktop-page-header--settings desktop-settings-header">
        <div className="desktop-page-header-copy desktop-settings-title-block">
          <div className="desktop-page-header-title-row">
            <h1 className="desktop-page-header-title desktop-settings-title">设置</h1>
          </div>
          <p className="desktop-page-header-subtitle desktop-settings-subtitle">按功能分类管理桌面端偏好；更改会自动保存。</p>
        </div>
      </header>

      <div className="desktop-settings-layout">
        <label className="desktop-settings-category-picker">
          <span>设置分类</span>
          <select
            aria-label="设置分类"
            value={activeCategory}
            onChange={(event) => {
              setActiveCategory(event.target.value as DesktopSettingsCategory);
              setResetConfirmationVisible(false);
              setStatusMessage('');
            }}
          >
            {settingsCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label} · {category.description}
              </option>
            ))}
          </select>
        </label>

        <div
          className="desktop-settings-nav"
          role="tablist"
          aria-label="设置分类"
          aria-orientation={categoryOrientation}
          data-orientation={categoryOrientation}
        >
          {settingsCategories.map((category, index) => {
            const Icon = category.icon;
            const active = category.id === activeCategory;
            return (
              <button
                ref={(element) => {
                  categoryRefs.current[index] = element;
                }}
                key={category.id}
                type="button"
                className={`desktop-settings-nav-item${
                  active ? ' desktop-settings-nav-item--active' : ''
                }`}
                id={`desktop-settings-tab-${category.id}`}
                role="tab"
                aria-selected={active}
                aria-controls={`desktop-settings-panel-${category.id}`}
                aria-label={`${category.label}，${category.description}`}
                data-focus-region-start={active ? true : undefined}
                data-state={active ? 'active' : 'idle'}
                tabIndex={active ? 0 : -1}
                onKeyDown={(event) => handleCategoryKeyDown(event, index)}
                onClick={() => {
                  setActiveCategory(category.id);
                  setResetConfirmationVisible(false);
                  setStatusMessage('');
                }}
              >
                <span className="desktop-settings-nav-icon">
                  <Icon aria-hidden="true" />
                </span>
                <span className="desktop-settings-nav-copy">
                  <strong>{category.label}</strong>
                </span>
              </button>
            );
          })}
        </div>

        <main className="desktop-settings-content">
          <div
            className="desktop-settings-live-region"
            role="status"
            aria-live="polite"
            data-feedback-state={statusMessage ? 'visible' : 'idle'}
          >
            {statusMessage}
          </div>

          {activeCategory === 'general' ? (
            <section
              id="desktop-settings-panel-general"
              className="desktop-settings-section"
              role="tabpanel"
              aria-labelledby="desktop-settings-tab-general"
            >
              <div className="desktop-settings-section-heading">
                <span className="desktop-settings-section-icon">
                  <Settings2 aria-hidden="true" />
                </span>
                <div className="desktop-settings-section-copy">
                  <h2 id="desktop-settings-general-title">常规</h2>
                  <p>决定寻鹿如何启动，以及每次打开后首先显示什么。</p>
                </div>
              </div>

              <div className="desktop-settings-group">
                <div className="desktop-setting-row">
                  <div className="desktop-setting-copy">
                    <label htmlFor="desktop-settings-launch-destination">启动后打开</label>
                  </div>
                  <div className="desktop-setting-control">
                    <select
                      id="desktop-settings-launch-destination"
                      className="desktop-setting-select"
                      value={preferences.launchDestination}
                      onChange={(event) =>
                        updatePreferences({
                          launchDestination: event.target
                            .value as DesktopPreferences['launchDestination']
                        })
                      }
                    >
                      {launchDestinations.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="desktop-setting-row">
                  <div className="desktop-setting-leading-icon">
                    <Power aria-hidden="true" />
                  </div>
                  <div className="desktop-setting-copy">
                    <span className="desktop-setting-label">开机时启动寻鹿</span>
                    {autostartStatus}
                  </div>
                  <div className="desktop-setting-control">
                    <button
                      type="button"
                      role="switch"
                      aria-label="开机时启动寻鹿"
                      aria-checked={autostartState === 'enabled'}
                      className={`desktop-setting-switch desktop-setting-switch--button${
                        autostartState === 'enabled' ? ' desktop-setting-switch--checked' : ''
                      }`}
                      disabled={
                        autostartBusy ||
                        autostartState === 'checking' ||
                        autostartState === 'unavailable'
                      }
                      onClick={() => void handleAutostartToggle()}
                    >
                      <span className="desktop-setting-switch-track" aria-hidden="true">
                        <span className="desktop-setting-switch-thumb" />
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {activeCategory === 'account' ? (
            <section
              id="desktop-settings-panel-account"
              className="desktop-settings-section"
              role="tabpanel"
              aria-labelledby="desktop-settings-tab-account"
            >
              <div className="desktop-settings-section-heading">
                <span className="desktop-settings-section-icon">
                  <UserRound aria-hidden="true" />
                </span>
                <div className="desktop-settings-section-copy">
                  <h2 id="desktop-settings-account-title">账号与同步</h2>
                  <p>查看当前身份、申请数据同步状态，并管理登录会话。</p>
                </div>
              </div>

              <div className="desktop-settings-group" aria-labelledby="desktop-settings-identity-title">
                <div className="desktop-settings-group-heading">
                  <h3 id="desktop-settings-identity-title">当前账号</h3>
                </div>
                <div className="desktop-setting-row">
                  <span className="desktop-setting-leading-icon">
                    <UserRound aria-hidden="true" />
                  </span>
                  <div className="desktop-setting-copy">
                    <span className="desktop-setting-label">
                      {session?.profile.nickname || '正在读取账号'}
                    </span>
                    <p>{session?.email || session?.phone || '账号信息正在更新'}</p>
                  </div>
                  {session ? (
                    <DesktopSettingStatus tone="success">
                      {getAuthProviderLabel(session.authProvider)}
                    </DesktopSettingStatus>
                  ) : (
                    <DesktopSettingStatus tone="neutral">正在核验</DesktopSettingStatus>
                  )}
                </div>
              </div>

              <div className="desktop-settings-group" aria-labelledby="desktop-settings-sync-title">
                <div className="desktop-settings-group-heading">
                  <h3 id="desktop-settings-sync-title">申请数据同步</h3>
                </div>
                <div className="desktop-setting-row">
                  <span className="desktop-setting-leading-icon">
                    <Cloud aria-hidden="true" />
                  </span>
                  <div className="desktop-setting-copy">
                    <span className="desktop-setting-label">{syncPresentation.label}</span>
                    <p>{syncPresentation.detail}</p>
                  </div>
                  <div className="desktop-setting-control">
                    <button
                      type="button"
                      className="desktop-setting-secondary-button"
                      disabled={!session?.userId || manualSyncBusy || syncStatus === 'syncing'}
                      aria-busy={manualSyncBusy || syncStatus === 'syncing'}
                      onClick={() => void handleManualSync()}
                    >
                      <Cloud aria-hidden="true" />
                      {manualSyncBusy || syncStatus === 'syncing' ? '正在同步…' : '立即同步'}
                    </button>
                  </div>
                </div>
                <div className="desktop-setting-row">
                  <div className="desktop-setting-copy">
                    <span className="desktop-setting-label">最近状态时间</span>
                    <p>{formatSyncUpdatedAt(syncUpdatedAt)}</p>
                  </div>
                  <DesktopSettingStatus tone={syncPresentation.tone}>
                    {syncPresentation.label}
                  </DesktopSettingStatus>
                </div>
              </div>

              <div className="desktop-settings-group desktop-settings-group--danger" aria-label="退出账号">
                <div className="desktop-setting-row">
                  <span className="desktop-setting-leading-icon">
                    <LogOut aria-hidden="true" />
                  </span>
                  <div className="desktop-setting-copy">
                    <span className="desktop-setting-label">退出当前账号</span>
                    <p>退出后，本机仍会保留应用偏好，但需要重新登录才能使用桌面端。</p>
                  </div>
                  <div className="desktop-setting-control">
                    <button
                      type="button"
                      className="desktop-setting-danger-button"
                      disabled={!session || signingOut}
                      onClick={() => void handleSignOut()}
                    >
                      {signingOut ? '正在退出…' : '退出登录'}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {activeCategory === 'notifications' ? (
            <section
              id="desktop-settings-panel-notifications"
              className="desktop-settings-section"
              role="tabpanel"
              aria-labelledby="desktop-settings-tab-notifications"
            >
              <div className="desktop-settings-section-heading">
                <span className="desktop-settings-section-icon">
                  <Bell aria-hidden="true" />
                </span>
                <div className="desktop-settings-section-copy">
                  <h2 id="desktop-settings-notifications-title">通知</h2>
                  <p>控制寻鹿运行期间何时请求显示 Windows 横幅，以及哪些信息值得打断。</p>
                </div>
              </div>

              {notificationsPaused && preferences.notifications.pausedUntil ? (
                <div className="desktop-settings-paused-banner" role="status">
                  <span className="desktop-settings-paused-icon">
                    <Pause aria-hidden="true" />
                  </span>
                  <div className="desktop-settings-paused-copy">
                    <strong>运行中的 Windows 横幅已暂停</strong>
                    <span>
                      将于 {formatPausedUntil(preferences.notifications.pausedUntil)} 自动恢复
                    </span>
                  </div>
                  <button
                    type="button"
                    className="desktop-setting-secondary-button"
                    onClick={handleResumeNotifications}
                  >
                    <Play aria-hidden="true" />
                    立即恢复
                  </button>
                </div>
              ) : null}

              <div className="desktop-settings-group">
                <div className="desktop-setting-row desktop-setting-row--emphasis">
                  <div className="desktop-setting-leading-icon">
                    <Monitor aria-hidden="true" />
                  </div>
                  <div className="desktop-setting-copy">
                    <span className="desktop-setting-label">Windows 通知</span>
                    <p>寻鹿运行期间，会为新出现的重要事项请求显示 Windows 横幅。</p>
                    {notificationStatus}
                  </div>
                  <div className="desktop-setting-control">
                    <DesktopSettingSwitch
                      checked={preferences.notifications.windowsDelivery}
                      disabled={
                        notificationBusy ||
                        notificationPermission === 'checking' ||
                        notificationPermission === 'unavailable'
                      }
                      label="Windows 通知"
                      onChange={(checked) => void handleWindowsDeliveryToggle(checked)}
                    />
                  </div>
                </div>

                <div className="desktop-setting-row">
                  <div className="desktop-setting-copy">
                    <span className="desktop-setting-label">发送测试通知</span>
                    <p>确认 Windows 横幅、声音与勿扰设置是否符合预期。</p>
                  </div>
                  <div className="desktop-setting-control">
                    <button
                      type="button"
                      className="desktop-setting-secondary-button"
                      disabled={
                        notificationBusy ||
                        !preferences.notifications.windowsDelivery ||
                        notificationPermission === 'unavailable'
                      }
                      onClick={() => void handleTestNotification()}
                    >
                      <Sparkles aria-hidden="true" />
                      测试通知
                    </button>
                  </div>
                </div>
              </div>

              <div className="desktop-settings-group" aria-labelledby="desktop-settings-types-title">
                <div className="desktop-settings-group-heading">
                  <h3 id="desktop-settings-types-title">提醒类型</h3>
                  <p>提醒中心持续展示；Windows 横幅仅在寻鹿运行期间请求发送。</p>
                </div>
                {notificationKinds.map((kind) => (
                  <div className="desktop-setting-row" key={kind.key}>
                    <div className="desktop-setting-copy">
                      <span className="desktop-setting-label">{kind.label}</span>
                      <p>{kind.description}</p>
                    </div>
                    <div className="desktop-setting-control">
                      <DesktopSettingSwitch
                        checked={preferences.notifications.kinds[kind.key]}
                        label={`${kind.label}提醒`}
                        onChange={(checked) =>
                          updateNotifications({
                            kinds: {
                              ...preferences.notifications.kinds,
                              [kind.key]: checked
                            }
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="desktop-settings-group">
                <div className="desktop-setting-row">
                  <div className="desktop-setting-copy">
                    <label htmlFor="desktop-settings-snooze">稍后提醒时长</label>
                    <p>在提醒中心点击“稍后提醒”后的默认等待时间。</p>
                  </div>
                  <div className="desktop-setting-control">
                    <select
                      id="desktop-settings-snooze"
                      className="desktop-setting-select"
                      value={preferences.notifications.snoozeMinutes}
                      onChange={(event) =>
                        updateNotifications({
                          snoozeMinutes: Number(
                            event.target.value
                          ) as DesktopPreferences['notifications']['snoozeMinutes']
                        })
                      }
                    >
                      <option value={30}>30 分钟</option>
                      <option value={60}>1 小时</option>
                      <option value={180}>3 小时</option>
                    </select>
                  </div>
                </div>

                <div className="desktop-setting-row">
                  <div className="desktop-setting-leading-icon">
                    <Clock3 aria-hidden="true" />
                  </div>
                  <div className="desktop-setting-copy">
                    <span className="desktop-setting-label">安静时段</span>
                    <p>寻鹿运行期间，在指定时间内暂缓横幅，并在时段结束后继续。</p>
                  </div>
                  <div className="desktop-setting-control">
                    <DesktopSettingSwitch
                      checked={preferences.notifications.quietHoursEnabled}
                      label="安静时段"
                      onChange={(checked) => updateNotifications({ quietHoursEnabled: checked })}
                    />
                  </div>
                </div>

                <div className="desktop-setting-row desktop-setting-row--times">
                  <div className="desktop-setting-copy">
                    <span className="desktop-setting-label">时间范围</span>
                    <p>允许跨越午夜，例如 22:00 至次日 08:00。</p>
                  </div>
                  <div className="desktop-setting-time-range">
                    <label className="desktop-setting-time-field">
                      <span>开始</span>
                      <input
                        type="time"
                        value={preferences.notifications.quietHoursStart}
                        disabled={!preferences.notifications.quietHoursEnabled}
                        onChange={(event) =>
                          updateNotifications({ quietHoursStart: event.target.value })
                        }
                      />
                    </label>
                    <span className="desktop-setting-time-separator" aria-hidden="true">
                      至
                    </span>
                    <label className="desktop-setting-time-field">
                      <span>结束</span>
                      <input
                        type="time"
                        value={preferences.notifications.quietHoursEnd}
                        disabled={!preferences.notifications.quietHoursEnabled}
                        onChange={(event) =>
                          updateNotifications({ quietHoursEnd: event.target.value })
                        }
                      />
                    </label>
                  </div>
                </div>

                <div className="desktop-setting-row">
                  <div className="desktop-setting-copy">
                    <span className="desktop-setting-label">临时暂停</span>
                    <p>暂停运行中的 Windows 横幅 1 小时，提醒中心内容仍会保留。</p>
                  </div>
                  <div className="desktop-setting-control">
                    {notificationsPaused ? (
                      <button
                        type="button"
                        className="desktop-setting-secondary-button"
                        onClick={handleResumeNotifications}
                      >
                        <Play aria-hidden="true" />
                        恢复通知
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="desktop-setting-secondary-button"
                        disabled={!preferences.notifications.windowsDelivery}
                        onClick={handlePauseNotifications}
                      >
                        <Pause aria-hidden="true" />
                        暂停 1 小时
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {activeCategory === 'appearance' ? (
            <section
              id="desktop-settings-panel-appearance"
              className="desktop-settings-section"
              role="tabpanel"
              aria-labelledby="desktop-settings-tab-appearance"
            >
              <div className="desktop-settings-section-heading">
                <span className="desktop-settings-section-icon">
                  <Palette aria-hidden="true" />
                </span>
                <div className="desktop-settings-section-copy">
                  <h2 id="desktop-settings-appearance-title">外观</h2>
                  <p>调整主题、界面缩放和支持页面的列表密度。</p>
                </div>
              </div>

              <div className="desktop-settings-group">
                <div className="desktop-setting-row desktop-setting-row--stacked">
                  <div className="desktop-setting-copy">
                    <span className="desktop-setting-label">应用主题</span>
                    <p>选择后会立即预览并自动保存；跟随系统会响应 Windows 主题变化。</p>
                  </div>
                  <div
                    className="desktop-setting-segmented desktop-theme-options"
                    role="group"
                    aria-label="应用主题"
                  >
                    {desktopThemeOptions.map((option) => {
                      const Icon = option.icon;
                      const selected = preferences.theme === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`desktop-setting-segment${
                            selected ? ' desktop-setting-segment--selected' : ''
                          }`}
                          data-theme-choice={option.value}
                          aria-pressed={selected}
                          onClick={() => updatePreferences({ theme: option.value })}
                        >
                          <span className="desktop-theme-choice-preview" aria-hidden="true">
                            <span className="desktop-theme-choice-rail" />
                            <span className="desktop-theme-choice-surface">
                              <span />
                              <span />
                            </span>
                          </span>
                          <span className="desktop-theme-choice-copy">
                            <span className="desktop-theme-choice-label">
                              <Icon aria-hidden="true" />
                              {option.label}
                            </span>
                            <small>{option.description}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="desktop-theme-save-state" role="status" aria-live="polite">
                    <CheckCircle2 aria-hidden="true" />
                    <span>
                      {preferences.theme === 'system'
                        ? '已跟随 Windows 主题，更改将自动保存'
                        : `已应用${preferences.theme === 'dark' ? '深色' : '浅色'}主题，更改将自动保存`}
                    </span>
                  </div>
                </div>

                <div className="desktop-setting-row desktop-setting-row--stacked">
                  <div className="desktop-setting-copy">
                    <span className="desktop-setting-label">列表与卡片密度</span>
                    <p>调整通知、申请、院校、资源和帮助页面的留白；日程与导师工作区保持固定密度。</p>
                  </div>
                  <div
                    className="desktop-setting-segmented"
                    role="group"
                    aria-label="列表与卡片密度"
                  >
                    {[
                      { value: 'comfortable' as const, label: '舒适' },
                      { value: 'compact' as const, label: '紧凑' }
                    ].map((option) => {
                      const selected = preferences.density === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`desktop-setting-segment${
                            selected ? ' desktop-setting-segment--selected' : ''
                          }`}
                          aria-pressed={selected}
                          onClick={() => updatePreferences({ density: option.value })}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="desktop-setting-row">
                  <div className="desktop-setting-copy">
                    <span className="desktop-setting-label">界面缩放</span>
                    <p>缩放整个应用界面；也可使用 Ctrl +、Ctrl - 和 Ctrl 0。</p>
                  </div>
                  <div className="desktop-setting-control">
                    <select
                      className="desktop-setting-select"
                      value={preferences.zoomLevel}
                      aria-label="界面缩放"
                      onChange={(event) =>
                        updatePreferences({
                          zoomLevel: Number(event.target.value) as DesktopPreferences['zoomLevel']
                        })
                      }
                    >
                      {DESKTOP_ZOOM_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {level}%
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="desktop-setting-row">
                  <div className="desktop-setting-copy">
                    <span className="desktop-setting-label">减少动态效果</span>
                  </div>
                  <div className="desktop-setting-control">
                    <DesktopSettingSwitch
                      checked={preferences.reduceMotion}
                      label="减少动态效果"
                      onChange={(checked) => updatePreferences({ reduceMotion: checked })}
                    />
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {activeCategory === 'about' ? (
            <section
              id="desktop-settings-panel-about"
              className="desktop-settings-section"
              role="tabpanel"
              aria-labelledby="desktop-settings-tab-about"
            >
              <div className="desktop-settings-section-heading">
                <span className="desktop-settings-section-icon">
                  <Info aria-hidden="true" />
                </span>
                <div className="desktop-settings-section-copy">
                  <h2 id="desktop-settings-about-title">关于</h2>
                  <p>版本、快捷键、帮助与服务说明。</p>
                </div>
              </div>

              <div className="desktop-settings-about-card">
                <div className="desktop-settings-about-mark" aria-hidden="true">
                  <Image
                    src="/desktop/seekoffer-mark.png"
                    alt=""
                    fill
                    sizes="42px"
                    className="desktop-settings-about-logo"
                  />
                </div>
                <div className="desktop-settings-about-copy">
                  <strong>寻鹿 SeekOffer</strong>
                  <span>Windows 桌面端 · 版本 {process.env.NEXT_PUBLIC_SEEKOFFER_APP_VERSION || '开发版'}</span>
                </div>
                <DesktopSettingStatus tone="success">当前版本</DesktopSettingStatus>
              </div>

              <DesktopSoftwareUpdateSettings />

              <div className="desktop-settings-group" aria-labelledby="desktop-settings-shortcuts-title">
                <div className="desktop-settings-group-heading">
                  <h3 id="desktop-settings-shortcuts-title">键盘快捷键</h3>
                  <p>按 <kbd>Ctrl + /</kbd> 随时打开完整快捷键列表。</p>
                </div>
              </div>

              <div className="desktop-settings-group" aria-label="帮助与协议">
                {[
                  { href: '/guide', label: '使用帮助', description: '了解通知库、申请与日程的使用方式', icon: CircleHelp },
                  { href: '/privacy', label: '隐私政策', description: '了解数据如何存储与使用', icon: ShieldCheck },
                  { href: '/terms', label: '用户协议', description: '查看服务条款与使用规则', icon: Info }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} className="desktop-setting-link-row">
                      <span className="desktop-setting-leading-icon">
                        <Icon aria-hidden="true" />
                      </span>
                      <span className="desktop-setting-copy">
                        <span className="desktop-setting-label">{item.label}</span>
                        <span className="desktop-setting-description">{item.description}</span>
                      </span>
                      <ChevronRight aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>

              <div className="desktop-settings-group desktop-settings-group--danger">
                <div className="desktop-setting-row">
                  <div className="desktop-setting-leading-icon">
                    <RotateCcw aria-hidden="true" />
                  </div>
                  <div className="desktop-setting-copy">
                    <span className="desktop-setting-label">恢复默认设置</span>
                    <p>
                      恢复为浅色主题、舒适密度与{' '}
                      {DESKTOP_PREFERENCES_DEFAULTS.notifications.snoozeMinutes} 分钟稍后提醒。
                    </p>
                  </div>
                  {!resetConfirmationVisible ? (
                    <div className="desktop-setting-control">
                      <button
                        ref={resetTriggerRef}
                        type="button"
                        className="desktop-setting-danger-button"
                        onClick={() => setResetConfirmationVisible(true)}
                      >
                        恢复默认
                      </button>
                    </div>
                  ) : null}
                </div>

                {resetConfirmationVisible ? (
                  <div className="desktop-settings-reset-confirmation" role="group" aria-label="确认恢复默认设置">
                    <div className="desktop-settings-reset-copy">
                      <strong>确认恢复所有设置？</strong>
                      <span>开机启动属于 Windows 系统设置，不会在此处被更改。</span>
                    </div>
                    <div className="desktop-settings-reset-actions">
                      <button
                        type="button"
                        className="desktop-setting-secondary-button"
                        onClick={closeResetConfirmation}
                      >
                        取消
                      </button>
                      <button
                        ref={resetConfirmRef}
                        type="button"
                        className="desktop-setting-danger-button desktop-setting-danger-button--confirm"
                        onClick={handleReset}
                      >
                        确认恢复
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
