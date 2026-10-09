'use client';

import { RefreshCw, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';
import { emitDesktopFeedback } from '@/lib/desktop-route-events';

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[SeekOffer] route rendering failed', error);
    emitDesktopFeedback({
      message: '当前页面未能完成加载',
      detail: '应用框架仍可使用，你可以重新尝试',
      tone: 'error',
      duration: 6000
    });
  }, [error]);

  return (
    <section
      className="desktop-route-error-page"
      aria-labelledby="desktop-route-error-title"
    >
      <div className="desktop-route-error" role="alert">
        <span className="desktop-route-error-icon" aria-hidden="true">
          <RefreshCw />
        </span>
        <div className="desktop-route-error-copy">
          <p>页面恢复</p>
          <h1 id="desktop-route-error-title">这一页暂时没有加载完成</h1>
          <span>你的账号和已保存数据不会因此丢失。请先重试，仍未恢复时再重新加载应用。</span>
        </div>
        <div className="desktop-route-error-actions">
          <button type="button" className="desktop-primary-command" onClick={reset}>
            <RefreshCw aria-hidden="true" />
            重新尝试
          </button>
          <button
            type="button"
            className="desktop-secondary-command"
            onClick={() => window.location.reload()}
          >
            <RotateCcw aria-hidden="true" />
            重新加载应用
          </button>
        </div>
      </div>
    </section>
  );
}
