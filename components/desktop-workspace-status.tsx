'use client';

import {
  CheckmarkCircle20Regular,
  CloudOff20Regular,
  Save20Regular
} from '@fluentui/react-icons';
import { DesktopLoadingIndicator, DesktopLoadingState } from './desktop-loading';
import { DesktopStateSurface } from './desktop-state-surface';
import styles from './desktop-workspace-status.module.css';

export type DesktopWorkspaceSyncStatus = 'local' | 'syncing' | 'synced' | 'error';
export type DesktopWorkspaceReadStatus = 'loading' | 'ready' | 'error';

/** Read readiness is scoped to the current account, never inferred from a save. */
export function resolveWorkspaceReadStatus({
  ownerId, localOwnerId, remoteOwnerId, remoteStatus, requiresRemote
}: {
  ownerId: string;
  localOwnerId: string;
  remoteOwnerId: string;
  remoteStatus: DesktopWorkspaceReadStatus;
  requiresRemote: boolean;
}): DesktopWorkspaceReadStatus {
  if (localOwnerId !== ownerId) return 'loading';
  if (!requiresRemote) return 'ready';
  return remoteOwnerId === ownerId ? remoteStatus : 'loading';
}

export function DesktopWorkspaceReadFeedback({
  kind, status, onRetry
}: {
  kind: 'schedule' | 'contacts';
  status: Exclude<DesktopWorkspaceReadStatus, 'ready'>;
  onRetry: () => void;
}) {
  const label = kind === 'schedule' ? '日程' : '导师联系';
  if (status === 'loading') {
    return <DesktopLoadingState variant={kind} title={`正在读取${label}`} detail="正在与当前账号同步，请稍候。" rows={3} />;
  }
  return (
    <DesktopStateSurface
      icon={<CloudOff20Regular aria-hidden="true" />}
      title={`${label}暂时未能加载`}
      detail="云端内容尚未读取，这不代表没有记录。请检查网络后重试，本机内容不会被清除。"
      tone="error"
      ariaLive="polite"
      action={<button type="button" onClick={onRetry}>重新加载</button>}
    />
  );
}

function formatSyncTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export function DesktopWorkspaceStatus({
  status,
  initialReadStatus = 'ready',
  lastSyncedAt,
  onRetry
}: {
  status: DesktopWorkspaceSyncStatus;
  initialReadStatus?: DesktopWorkspaceReadStatus;
  lastSyncedAt?: string;
  onRetry: () => void;
}) {
  const lastTime = formatSyncTime(lastSyncedAt);

  // The content area announces first-load states; keep this compact summary quiet.
  if (initialReadStatus !== 'ready') {
    return <div className={styles.status}>
      <span>{initialReadStatus === 'error' ? '云端内容尚未读取' : '正在读取云端工作区…'}</span>
    </div>;
  }

  if (status === 'error') {
    return (
      <div className={`${styles.status} ${styles.error}`} role="status" aria-live="polite">
        <CloudOff20Regular className={styles.icon} aria-hidden="true" />
        <span>本机已保存，云端同步失败</span>
        <button type="button" className={styles.retry} onClick={onRetry}>
          重新同步
        </button>
      </div>
    );
  }

  if (status === 'syncing') {
    return (
      <div className={styles.status} role="status" aria-live="polite" aria-busy="true">
        <DesktopLoadingIndicator size="small" delayed className={styles.icon} />
        <span>本机已保存，正在同步…</span>
      </div>
    );
  }

  if (status === 'synced') {
    return (
      <div className={styles.status} role="status" aria-live="polite">
        <CheckmarkCircle20Regular className={styles.icon} aria-hidden="true" />
        <span>{lastTime ? `本机已保存 · 云端已同步 ${lastTime}` : '本机已保存 · 云端已同步'}</span>
      </div>
    );
  }

  return (
    <div className={styles.status} role="status" aria-live="polite">
      <Save20Regular className={styles.icon} aria-hidden="true" />
      <span>本机已保存</span>
    </div>
  );
}
