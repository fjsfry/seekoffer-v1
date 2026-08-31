import { DesktopAppShell } from '@/components/desktop-app-shell';
import { DesktopAuthGate } from '@/components/desktop-auth-gate';
import { DesktopUpdateProvider } from '@/components/desktop-update-provider';
import { UserSessionProvider } from '@/components/user-session-provider';
import './desktop.css';
import './desktop-mature.css';
import './desktop-interactions.css';
import './desktop-qq.css';
import './desktop-mchose.css';
import './desktop-flagship.css';
import './desktop-notice-alignment.css';
import './desktop-resource-center.css';
import './desktop-guide-center.css';
import './desktop-help-center-v2.css';
import './desktop-app-coherence.css';

const desktopPreferenceBootstrap = `
try {
  var allowedZoomLevels = [80, 90, 100, 110, 125, 150, 175, 200];
  var allowedThemes = ['system', 'light', 'dark'];
  var raw = localStorage.getItem('seekoffer-desktop-preferences-v1');
  var preferences = raw ? JSON.parse(raw) : {};
  var themePreference = allowedThemes.indexOf(preferences && preferences.theme) >= 0
    ? preferences.theme
    : 'light';
  var systemPrefersDark = typeof matchMedia === 'function'
    && matchMedia('(prefers-color-scheme: dark)').matches;
  var resolvedTheme = themePreference === 'system'
    ? (systemPrefersDark ? 'dark' : 'light')
    : themePreference;
  var zoomLevel = allowedZoomLevels.indexOf(preferences && preferences.zoomLevel) >= 0
    ? preferences.zoomLevel
    : 100;
  document.documentElement.dataset.desktopThemePreference = themePreference;
  document.documentElement.dataset.desktopTheme = resolvedTheme;
  document.documentElement.dataset.desktopReduceMotion = preferences.reduceMotion === true ? 'true' : 'false';
  document.documentElement.dataset.desktopZoomLevel = String(zoomLevel);
  document.documentElement.style.colorScheme = resolvedTheme;
  document.documentElement.style.zoom = String(zoomLevel / 100);
} catch (_) {
  document.documentElement.dataset.desktopThemePreference = 'light';
  document.documentElement.dataset.desktopTheme = 'light';
  document.documentElement.dataset.desktopReduceMotion = 'false';
  document.documentElement.dataset.desktopZoomLevel = '100';
  document.documentElement.style.colorScheme = 'light';
  document.documentElement.style.zoom = '1';
}
`;

export const buildSurfaceDocument = {
  className: 'seekoffer-desktop-surface',
  suppressHydrationWarning: true
} as const;

export function BuildSurface({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <script
        id="desktop-preference-bootstrap"
        dangerouslySetInnerHTML={{ __html: desktopPreferenceBootstrap }}
      />
      <UserSessionProvider>
        <DesktopUpdateProvider>
          <DesktopAuthGate>
            <DesktopAppShell>{children}</DesktopAppShell>
          </DesktopAuthGate>
        </DesktopUpdateProvider>
      </UserSessionProvider>
    </>
  );
}
