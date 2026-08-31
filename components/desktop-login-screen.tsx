'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { LoginMethodPanel } from '@/components/login-method-panel';
import {
  DesktopWindowControls,
  useDesktopTitlebarDrag
} from '@/components/desktop-window-controls';

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

  useEffect(() => {
    setStalled(false);
    const timer = window.setTimeout(() => setStalled(true), 8000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const isEntering = phase === 'enter-workbench';
  const title = isEntering ? '正在进入全部申请' : '正在启动寻鹿';
  const description = isEntering
    ? '正在同步你的申请项目与最新进度'
    : '正在准备申请项目与提醒';

  async function handleRetry() {
    if (!onRetry || retrying) return;
    setRetrying(true);
    setStalled(false);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div
      className="desktop-auth-shell desktop-startup-shell"
      data-startup-phase={phase}
      data-feedback-state={stalled ? 'stalled' : retrying ? 'pending' : 'loading'}
    >
      <DesktopAuthTitlebar />
      <main className="desktop-startup-stage" aria-busy={!stalled || retrying}>
        <section
          className="desktop-startup-content"
          aria-labelledby="desktop-startup-title"
          aria-describedby="desktop-startup-description"
        >
          <div className="desktop-startup-mark" aria-hidden="true">
            <Image
              src="/desktop/seekoffer-mark.png"
              alt=""
              fill
              sizes="80px"
              priority
              className="desktop-brand-logo-image"
            />
          </div>
          <p className="desktop-startup-wordmark">寻鹿 SeekOffer</p>
          <h1 id="desktop-startup-title">{title}</h1>
          <p id="desktop-startup-description" className="desktop-startup-description">
            {description}
          </p>
          <div
            className="desktop-startup-progress"
            role="progressbar"
            aria-label={isEntering ? '正在同步申请数据' : '正在启动应用'}
          >
            <span />
          </div>
          {stalled ? (
            <div className="desktop-startup-recovery" role="status">
              <span>
                {isEntering
                  ? '全部申请同步时间比平时稍长，你可以重新尝试。'
                  : '启动时间比平时稍长，你可以重新连接登录服务。'}
              </span>
              <button
                type="button"
                onClick={() => void handleRetry()}
                disabled={retrying}
                aria-busy={retrying}
                data-feedback-state={retrying ? 'pending' : 'idle'}
              >
                {retrying ? '正在重试…' : '重新尝试'}
              </button>
            </div>
          ) : (
            <span className="desktop-startup-status" role="status" aria-live="polite">
              请稍候
            </span>
          )}
        </section>
        <p className="desktop-startup-footnote">统一管理通知、材料、进度与截止提醒</p>
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
