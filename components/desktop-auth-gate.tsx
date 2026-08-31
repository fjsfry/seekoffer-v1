'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useUserSessionState } from '@/hooks/use-user-session';
import { DesktopLoginScreen, DesktopStartupScreen } from '@/components/desktop-login-screen';
import { isMemberSession } from '@/lib/user-session';
import {
  DESKTOP_PREFERENCES_CHANGE_EVENT,
  readDesktopPreferences,
  resolveDesktopTheme,
  type DesktopPreferences
} from '@/lib/desktop-preferences';

export function DesktopAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { ready, isMember, refresh } = useUserSessionState();
  const [finishingLogin, setFinishingLogin] = useState(false);
  const frontendReadyReportedRef = useRef(false);

  useEffect(() => {
    if (frontendReadyReportedRef.current || !('__TAURI_INTERNALS__' in window)) return;
    frontendReadyReportedRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      void import('@tauri-apps/api/core')
        .then(({ invoke }) => invoke<boolean>('desktop_frontend_ready'))
        .catch(() => undefined);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const colorSchemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    let currentPreferences = readDesktopPreferences();

    const applyPreferences = (preferences: DesktopPreferences) => {
      const effectiveZoomLevel = preferences.zoomLevel;
      const resolvedTheme = resolveDesktopTheme(preferences.theme, colorSchemeMedia.matches);
      document.documentElement.dataset.desktopThemePreference = preferences.theme;
      document.documentElement.dataset.desktopTheme = resolvedTheme;
      document.documentElement.dataset.desktopReduceMotion = String(preferences.reduceMotion);
      document.documentElement.dataset.desktopZoomLevel = String(effectiveZoomLevel);
      document.documentElement.style.setProperty('color-scheme', resolvedTheme);
      document.documentElement.style.setProperty('zoom', String(effectiveZoomLevel / 100));

      if ('__TAURI_INTERNALS__' in window) {
        void import('@tauri-apps/api/webview')
          .then(({ getCurrentWebview }) => getCurrentWebview().setZoom(1))
          .catch(() => undefined);
      }
    };

    applyPreferences(currentPreferences);
    const handlePreferencesChange = (event: Event) => {
      currentPreferences =
        (event as CustomEvent<DesktopPreferences>).detail || readDesktopPreferences();
      applyPreferences(currentPreferences);
    };
    const handleColorSchemeChange = () => {
      if (currentPreferences.theme === 'system') {
        applyPreferences(currentPreferences);
      }
    };
    window.addEventListener(DESKTOP_PREFERENCES_CHANGE_EVENT, handlePreferencesChange);
    colorSchemeMedia.addEventListener('change', handleColorSchemeChange);
    return () => {
      window.removeEventListener(DESKTOP_PREFERENCES_CHANGE_EVENT, handlePreferencesChange);
      colorSchemeMedia.removeEventListener('change', handleColorSchemeChange);
    };
  }, []);

  async function finishLogin() {
    setFinishingLogin(true);
    try {
      const session = await refresh();
      setFinishingLogin(false);
      if (isMemberSession(session)) {
        router.replace('/');
        return;
      }
    } catch {
      setFinishingLogin(false);
    }
  }

  if (!ready) {
    return (
      <DesktopStartupScreen
        phase="restore-session"
        onRetry={async () => {
          await refresh();
        }}
      />
    );
  }

  if (finishingLogin) {
    return <DesktopStartupScreen phase="enter-workbench" onRetry={finishLogin} />;
  }

  if (!isMember) {
    return (
      <DesktopLoginScreen
        onSuccess={() => {
          void finishLogin();
        }}
      />
    );
  }

  return children;
}
