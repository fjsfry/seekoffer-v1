'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, ShieldCheck, X } from 'lucide-react';
import { DesktopLoadingIndicator } from '@/components/desktop-loading';
import { getSessionHydrationError } from '@/lib/user-session';
import { startNativeLogin } from '@/lib/native-auth-bridge';
import { prepareExplicitD1SignInRetry } from '@/lib/clerk-d1-session';
import { useUserSessionContext } from './user-session-provider';
import styles from './native-login-panel.module.css';

type LoginPhase = 'idle' | 'waiting-browser' | 'syncing-account' | 'error';

export function NativeLoginPanel({ onClose, onSuccess }: {
  onClose?: () => void;
  onSuccess?: () => void;
}) {
  const { refresh } = useUserSessionContext();
  const [phase, setPhase] = useState<LoginPhase>('idle');
  const [error, setError] = useState('');
  const mountedRef = useRef(true);
  const pendingRef = useRef(false);
  const attemptRef = useRef(0);
  const labelId = useId();
  const descriptionId = useId();
  const statusId = useId();
  const busy = phase === 'waiting-browser' || phase === 'syncing-account';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      attemptRef.current += 1;
    };
  }, []);

  async function login() {
    // The ref also guards two clicks before React commits the disabled button.
    if (pendingRef.current) return;
    pendingRef.current = true;
    const attempt = ++attemptRef.current;
    const isCurrent = () => mountedRef.current && attempt === attemptRef.current;
    setPhase('waiting-browser');
    setError('');
    try {
      prepareExplicitD1SignInRetry();
      await startNativeLogin();
      if (!isCurrent()) return;
      // This transition only occurs after native OAuth has really completed.
      setPhase('syncing-account');
      const user = await refresh();
      if (!isCurrent()) return;
      if (getSessionHydrationError() || !user?.loggedIn || !user.userId) {
        throw new Error('授权已完成，但账号资料暂时未同步。请检查网络后重新连接。');
      }
      setPhase('idle');
      onSuccess?.();
    } catch (cause) {
      if (!isCurrent()) return;
      setError(cause instanceof Error ? cause.message : '登录尚未完成，请稍后重试。');
      setPhase('error');
    } finally {
      if (isCurrent()) pendingRef.current = false;
    }
  }

  return (
    <section className={styles.panel} aria-labelledby={labelId} aria-describedby={descriptionId} data-native-login-phase={phase}>
      {onClose ? <button type="button" className={styles.close} aria-label="关闭登录" onClick={onClose}>
        <X size={18} aria-hidden="true" />
      </button> : null}
      <div className={styles.headingMark} aria-hidden="true"><ShieldCheck size={26} /></div>
      <h2 id={labelId} className={styles.title}>登录寻鹿 SeekOffer</h2>
      <p id={descriptionId} className={styles.description}>
        使用原来的寻鹿账号。我们会在系统浏览器中打开安全登录页，授权后即可继续使用桌面工作台。
      </p>

      <div className={styles.feedback} data-active={busy || Boolean(error)}>
        {busy ? <div className={styles.status} id={statusId} role="status" aria-live="polite" aria-atomic="true">
          <DesktopLoadingIndicator size="medium" delayed />
          <div>
            <strong>{phase === 'waiting-browser' ? '等待浏览器授权' : '正在同步账号'}</strong>
            <p>{phase === 'waiting-browser'
              ? '请在打开的浏览器中完成登录，再返回这扇窗口。'
              : '已收到登录授权，正在读取你的账号信息。'}</p>
          </div>
        </div> : error ? <p className={styles.error} role="alert">{error}</p> : <p className={styles.idleNote}>
          网页端与桌面端使用同一个账号，无需重新注册。
        </p>}
      </div>

      <button
        type="button"
        className={styles.primary}
        disabled={busy}
        aria-busy={busy}
        aria-describedby={busy ? statusId : undefined}
        onClick={() => void login()}
      >
        <span>{phase === 'waiting-browser' ? '等待浏览器授权' : phase === 'syncing-account' ? '正在同步账号' : error ? '重新连接登录' : '在系统浏览器登录'}</span>
        {!busy ? <ArrowUpRight size={18} aria-hidden="true" /> : null}
      </button>
      <p className={styles.privacy}>本机申请、日程与档案会保留，账号凭据由系统安全存储。</p>
    </section>
  );
}
