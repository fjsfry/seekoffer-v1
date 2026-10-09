'use client';

import { useState } from 'react';
import { useUserSessionState } from '@/hooks/use-user-session';
import { confirmD1UserSession } from '@/lib/user-session';
import { prepareExplicitD1SignInRetry } from '@/lib/clerk-d1-session';
import { startNativeLogin } from '@/lib/native-auth-bridge';
import styles from './desktop-account-recovery.module.css';

export function DesktopAccountRecovery() {
  const { desktopAuth, authError } = useUserSessionState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const needsLogin = desktopAuth.status === 'reauth-required';
  if (!needsLogin && desktopAuth.status !== 'offline' && !authError) return null;

  async function recover() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      prepareExplicitD1SignInRetry();
      if (needsLogin) await startNativeLogin();
      await confirmD1UserSession();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '连接尚未恢复，请稍后重试。'); }
    finally { setBusy(false); }
  }

  return <aside className={styles.banner} aria-label="账号连接状态" role="status">
    <div className={styles.copy}>
      <strong>{needsLogin ? '需要重新登录' : '云端暂未连接'}</strong>
      <span>{error || desktopAuth.message || authError || '可继续查看本机资料；恢复连接后再同步修改。'}</span>
    </div>
    <button type="button" disabled={busy} aria-busy={busy} onClick={() => void recover()}>
      {busy ? (needsLogin ? '请在浏览器完成登录…' : '正在连接…') : (needsLogin ? '重新登录' : '重试连接')}
    </button>
  </aside>;
}
