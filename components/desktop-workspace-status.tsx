'use client';

import {
  ArrowSync20Regular,
  CheckmarkCircle20Regular,
  CloudOff20Regular,
  Save20Regular
} from '@fluentui/react-icons';
import styles from './desktop-workspace-status.module.css';

export type DesktopWorkspaceSyncStatus = 'local' | 'syncing' | 'synced' | 'error';

function formatSyncTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export function DesktopWorkspaceStatus({
  status,
  lastSyncedAt,
  onRetry
}: {
  status: DesktopWorkspaceSyncStatus;
  lastSyncedAt?: string;
  onRetry: () => void;
}) {
  const lastTime = formatSyncTime(lastSyncedAt);

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
      <div className={styles.status} role="status" aria-live="polite">
        <ArrowSync20Regular className={styles.icon} aria-hidden="true" />
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
