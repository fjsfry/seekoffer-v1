'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { LoginMethodPanel } from '@/components/login-method-panel';
import { DesktopLoadingIndicator } from '@/components/desktop-loading';
import {
  DesktopWindowControls,
  useDesktopTitlebarDrag
} from '@/components/desktop-window-controls';
import styles from './desktop-login-screen.module.css';

type StartupPhase = 'restore-session' | 'enter-workbench';

function DesktopAuthTitlebar() {
  const handleTitlebarMouseDown = useDesktopTitlebarDrag();

  return (
    <header className="desktop-auth-titlebar" onMouseDown={handleTitlebarMouseDown}>
      <div className="desktop-auth-brand">
        <span className="desktop-auth-brand-mark">
          <Image
            src="/desktop/seekoffer-mark.png"
            alt="寻鹿"
            fill
            sizes="42px"
            priority
            className="desktop-brand-logo-image"
          />
        </span>
        <span className="desktop-auth-brand-wordmark">
          <strong>寻鹿</strong>
          <span>SeekOffer</span>
        </span>
      </div>
      <div
        className="desktop-titlebar-drag min-w-8 flex-1 self-stretch"
        aria-hidden="true"
      />
      <DesktopWindowControls />
    </header>
  );
}

export function DesktopStartupScreen({
  phase,
  onRetry
}: {
  phase: StartupPhase;
  onRetry?: () => void | Promise<void>;
}) {
  const [stalled, setStalled] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [retryError, setRetryError] = useState('');
  const mountedRef = useRef(true);
  const retryPendingRef = useRef(false);
  const retryGenerationRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      retryGenerationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    retryGenerationRef.current += 1;
    retryPendingRef.current = false;
    setRetrying(false);
    setRetryError('');
  }, [phase]);

  useEffect(() => {
    setStalled(false);
    const timer = window.setTimeout(() => setStalled(true), 8000);
    return () => window.clearTimeout(timer);
  }, [phase, retryAttempt]);

  const isEntering = phase === 'enter-workbench';
  const title = isEntering ? '正在进入工作台' : '正在启动寻鹿';
  const description = isEntering
    ? '正在确认账号并准备工作区'
    : '正在恢复登录状态，准备你的工作区';
  const status = retryError
    ? '暂时未能连接'
    : retrying
      ? '正在重新连接'
      : stalled
        ? '连接时间比平时稍长'
        : '请稍候';

  async function handleRetry() {
    if (!onRetry || retryPendingRef.current) return;
    retryPendingRef.current = true;
    const generation = ++retryGenerationRef.current;
    setRetrying(true);
    setStalled(false);
    setRetryError('');
    setRetryAttempt(attempt => attempt + 1);
    try {
      await onRetry();
    } catch {
      if (mountedRef.current && retryGenerationRef.current === generation) {
        setRetryError('请检查网络连接后重试；本机保存的申请和日程不会被清除。');
        setStalled(true);
      }
    } finally {
      if (mountedRef.current && retryGenerationRef.current === generation) {
        retryPendingRef.current = false;
        setRetrying(false);
      }
    }
  }

  return (
    <div
      className={`desktop-auth-shell ${styles.startupShell}`}
      data-startup-phase={phase}
      data-feedback-state={retryError ? 'error' : retrying ? 'pending' : stalled ? 'stalled' : 'loading'}
    >
      <DesktopAuthTitlebar />
      <main className={styles.startupStage} aria-busy={!retryError}>
        <section
          className={styles.startupContent}
          aria-labelledby="desktop-startup-title"
          aria-describedby="desktop-startup-description"
        >
          <div className={styles.startupMark} aria-hidden="true">
            <Image
              src="/desktop/seekoffer-mark.png"
              alt=""
              fill
              sizes="64px"
              priority
              className="desktop-brand-logo-image"
            />
          </div>
          <p className={styles.startupWordmark}>寻鹿 SeekOffer</p>
          <h1 id="desktop-startup-title" className={styles.startupTitle}>{title}</h1>
          <p id="desktop-startup-description" className={styles.startupDescription}>
            {description}
          </p>
          <div className={styles.startupFeedback} role="status" aria-live="polite" aria-atomic="true">
            <DesktopLoadingIndicator size="large" still={Boolean(retryError)} />
            <span>{status}</span>
          </div>
          <div className={styles.startupRecovery}>
            {stalled || retryError ? <>
              <p>{retryError || '可以稍等片刻，或检查网络后重新连接。'}</p>
              {onRetry ? <button
                type="button"
                onClick={() => void handleRetry()}
                disabled={retrying}
                aria-busy={retrying}
                data-feedback-state={retrying ? 'pending' : 'idle'}
              >
                {retrying ? '正在重试…' : '重新尝试'}
              </button> : null}
            </> : null}
          </div>
        </section>
        <p className={styles.startupFootnote}>通知、申请、材料与提醒，一处管理</p>
      </main>
    </div>
  );
}

export function DesktopLoginScreen({ onSuccess }: { onSuccess?: () => void }) {
  return (
    <div className="desktop-auth-shell desktop-login-shell">
      <DesktopAuthTitlebar />
      <main className="desktop-login-stage">
        <Image
          src="/desktop/seekoffer-login-background-v2.webp"
          alt=""
          fill
          sizes="100vw"
          priority
          className="desktop-auth-landscape"
        />

        <div className="desktop-auth-form-region">
          <LoginMethodPanel mode="desktop" allowGuest={false} onSuccess={onSuccess} />
        </div>
      </main>
    </div>
  );
}
