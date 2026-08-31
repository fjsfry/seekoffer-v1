'use client';

import {
  Dismiss20Regular,
  Maximize20Regular,
  SquareMultiple20Regular,
  Subtract20Regular
} from '@fluentui/react-icons';
import { useCallback, useEffect, useState, type MouseEvent } from 'react';

const DESKTOP_INTERACTIVE_SELECTOR =
  'a,button,input,textarea,select,label,[role="button"],[role="link"],[contenteditable="true"],[data-window-no-drag]';

let windowModulePromise: Promise<typeof import('@tauri-apps/api/window')> | null = null;

function getDesktopWindowModule() {
  windowModulePromise ||= import('@tauri-apps/api/window');
  return windowModulePromise;
}

export function useDesktopTitlebarDrag() {
  return useCallback((event: MouseEvent<HTMLElement>) => {
    if (!('__TAURI_INTERNALS__' in window) || event.buttons !== 1) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(DESKTOP_INTERACTIVE_SELECTOR)) return;

    const clickCount = event.detail;
    event.preventDefault();
    void getDesktopWindowModule()
      .then(({ getCurrentWindow }) => (
        clickCount === 2 ? getCurrentWindow().toggleMaximize() : getCurrentWindow().startDragging()
      ))
      .catch(() => undefined);
  }, []);
}

export function DesktopWindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [windowError, setWindowError] = useState('');

  const syncMaximizedState = useCallback(async () => {
    if (!('__TAURI_INTERNALS__' in window)) return;
    try {
      const { getCurrentWindow } = await getDesktopWindowModule();
      setIsMaximized(await getCurrentWindow().isMaximized());
    } catch {
      setWindowError('窗口状态读取失败');
    }
  }, []);

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;

    let cancelled = false;
    let unlistenResize: (() => void) | undefined;
    let unlistenMove: (() => void) | undefined;

    void getDesktopWindowModule()
      .then(async ({ getCurrentWindow }) => {
        const appWindow = getCurrentWindow();
        const update = async () => {
          try {
            const nextState = await appWindow.isMaximized();
            if (!cancelled) setIsMaximized(nextState);
          } catch {
            if (!cancelled) setWindowError('窗口状态读取失败');
          }
        };

        await update();
        unlistenResize = await appWindow.onResized(() => void update());
        unlistenMove = await appWindow.onMoved(() => void update());
      })
      .catch(() => {
        if (!cancelled) setWindowError('窗口控制暂不可用');
      });

    return () => {
      cancelled = true;
      unlistenResize?.();
      unlistenMove?.();
    };
  }, []);

  async function runWindowAction(action: 'minimize' | 'maximize' | 'close') {
    if (!('__TAURI_INTERNALS__' in window)) return;
    setWindowError('');

    try {
      const { getCurrentWindow } = await getDesktopWindowModule();
      const appWindow = getCurrentWindow();
      if (action === 'minimize') await appWindow.minimize();
      if (action === 'maximize') {
        await appWindow.toggleMaximize();
        await syncMaximizedState();
      }
      if (action === 'close') await appWindow.close();
    } catch {
      setWindowError('窗口操作失败，请重试');
    }
  }

  const maximizeLabel = isMaximized ? '还原' : '最大化';
  const MaximizeIcon = isMaximized ? SquareMultiple20Regular : Maximize20Regular;

  return (
    <>
      <div
        className="desktop-window-controls flex h-full items-start self-stretch"
        role="group"
        aria-label="窗口控制"
        data-window-no-drag
      >
        <button
          type="button"
          aria-label="最小化"
          title="最小化"
          data-window-no-drag
          onClick={() => void runWindowAction('minimize')}
          className="desktop-caption-button"
        >
          <Subtract20Regular className="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          aria-label={maximizeLabel}
          title={maximizeLabel}
          data-window-no-drag
          onClick={() => void runWindowAction('maximize')}
          className="desktop-caption-button"
        >
          <MaximizeIcon className="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          aria-label="关闭到系统托盘"
          title="关闭到系统托盘"
          data-window-no-drag
          onClick={() => void runWindowAction('close')}
          className="desktop-caption-button desktop-caption-close"
        >
          <Dismiss20Regular className="h-[18px] w-[18px]" />
        </button>
      </div>
      {windowError ? (
        <span className="desktop-window-error" role="status">
          {windowError}
        </span>
      ) : null}
    </>
  );
}
