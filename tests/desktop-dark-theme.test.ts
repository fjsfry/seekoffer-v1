import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');

describe('desktop dark theme contract', () => {
  it('applies the saved theme before hydration and follows Windows changes after hydration', async () => {
    const [layoutSource, authGateSource, shellSource] = await Promise.all([
      readFile(resolve(projectRoot, 'app/build-surface.desktop.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-auth-gate.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-app-shell.tsx'), 'utf8')
    ]);

    expect(layoutSource).toContain('<script');
    expect(layoutSource).toContain('id="desktop-preference-bootstrap"');
    expect(layoutSource).toContain("var allowedThemes = ['system', 'light', 'dark']");
    expect(layoutSource).toContain('document.documentElement.dataset.desktopTheme = resolvedTheme');
    expect(layoutSource).toContain('document.documentElement.style.colorScheme = resolvedTheme');
    expect(authGateSource).toContain("window.matchMedia('(prefers-color-scheme: dark)')");
    expect(authGateSource).toContain("colorSchemeMedia.addEventListener('change', handleColorSchemeChange)");
    expect(authGateSource).toContain("currentPreferences.theme === 'system'");
    expect(shellSource).toContain('resolveDesktopTheme(preferences.theme, media.matches)');
  });

  it('keeps dark styling in the single flagship authority and scopes it to desktop surfaces', async () => {
    const [layoutSource, flagshipCss] = await Promise.all([
      readFile(resolve(projectRoot, 'app/build-surface.desktop.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'app/desktop-flagship.css'), 'utf8')
    ]);

    expect(layoutSource.match(/import '\.\/desktop-flagship\.css'/g)).toHaveLength(1);
    expect(flagshipCss).toContain("html.seekoffer-desktop-surface[data-desktop-theme='dark']");
    expect(flagshipCss).toContain('--so-canvas: #101615 !important');
    expect(flagshipCss).toContain('--so-surface: #18201f !important');
    expect(flagshipCss).toContain('--so-text: #edf4f2 !important');
    expect(flagshipCss).toContain('@media (forced-colors: none)');
    expect(flagshipCss).not.toContain('body[data-desktop-theme');
  });

  it('gives login, splash, settings, and CSS-module workspaces explicit dark behavior', async () => {
    const [
      splashSource,
      settingsSource,
      flagshipCss,
      workspaceCss,
      workspaceStatusCss,
      stateSurfaceCss
    ] = await Promise.all([
      readFile(resolve(projectRoot, 'public/desktop-splash.html'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-settings-page.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'app/desktop-flagship.css'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-workspace.module.css'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-workspace-status.module.css'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-state-surface.module.css'), 'utf8')
    ]);

    expect(splashSource).toContain('<meta name="color-scheme" content="light dark" />');
    expect(splashSource).toContain(':root[data-desktop-theme="dark"]');
    expect(splashSource.indexOf("localStorage.getItem('seekoffer-desktop-preferences-v1')")).toBeLessThan(
      splashSource.indexOf('<style>')
    );
    expect(settingsSource).toContain("value: 'system'");
    expect(settingsSource).toContain("value: 'dark'");
    expect(settingsSource).toContain('desktop-theme-save-state');
    expect(flagshipCss).toContain('.desktop-login-stage::after');
    expect(workspaceCss).toContain(":global(html[data-desktop-theme='dark']) .page");
    expect(workspaceStatusCss).toContain('var(--so-danger-soft');
    expect(stateSurfaceCss).toContain('--state-accent: var(--so-warning');
    expect(stateSurfaceCss).toContain('--state-accent: var(--so-danger');
  });

  it('themes body portals and scrollbars instead of leaving light islands in dark mode', async () => {
    const [flagshipCss, confirmSource, updaterSource] = await Promise.all([
      readFile(resolve(projectRoot, 'app/desktop-flagship.css'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-confirm-dialog.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-update-provider.tsx'), 'utf8')
    ]);

    expect(flagshipCss).toContain('--so-scrollbar-thumb: #536560 !important');
    expect(flagshipCss).toContain('scrollbar-color: var(--so-scrollbar-thumb) transparent');
    expect(flagshipCss).toContain('.desktop-global-dialog-panel,');
    expect(flagshipCss).toContain('.desktop-update-toast');
    expect(flagshipCss).toContain('.desktop-global-dialog-secondary,');
    expect(flagshipCss).toContain('.desktop-update-toast-dismiss');
    expect(confirmSource).toContain('desktop-global-dialog-icon--danger');
    expect(confirmSource).toContain('desktop-global-dialog-secondary');
    expect(updaterSource).toContain('desktop-global-dialog-icon--update');
    expect(updaterSource).toContain('desktop-update-toast-copy');
  });

  it('preserves reduced-motion and forced-color safeguards', async () => {
    const [flagshipCss, splashSource, workspaceCss, stateSurfaceCss] = await Promise.all([
      readFile(resolve(projectRoot, 'app/desktop-flagship.css'), 'utf8'),
      readFile(resolve(projectRoot, 'public/desktop-splash.html'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-workspace.module.css'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-state-surface.module.css'), 'utf8')
    ]);

    expect(flagshipCss).toContain('@media (forced-colors: active)');
    expect(flagshipCss).toContain("html[data-desktop-reduce-motion='true']");
    expect(splashSource).toContain('@media (prefers-reduced-motion: reduce)');
    expect(workspaceCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(stateSurfaceCss).toContain(":global(html[data-desktop-reduce-motion='true'])");
  });
});
