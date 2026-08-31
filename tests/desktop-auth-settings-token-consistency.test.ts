import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration } from 'postcss';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const settingsPath = resolve(root, 'components/desktop-settings-page.module.css');
const statePath = resolve(root, 'components/desktop-state-surface.module.css');
const statusPath = resolve(root, 'components/desktop-workspace-status.module.css');
const settingsCss = readFileSync(settingsPath, 'utf8');
const stateCss = readFileSync(statePath, 'utf8');
const statusCss = readFileSync(statusPath, 'utf8');
const loginSource = readFileSync(resolve(root, 'components/login-method-panel.tsx'), 'utf8');
const startupSource = readFileSync(resolve(root, 'components/desktop-login-screen.tsx'), 'utf8');
const settingsSource = readFileSync(resolve(root, 'components/desktop-settings-page.tsx'), 'utf8');

describe('desktop auth and settings token consistency', () => {
  it('keeps module-owned copy readable and within the 400/500/600 weight system', () => {
    const violations: string[] = [];
    const invalidWeights: string[] = [];

    for (const path of [settingsPath, statePath, statusPath]) {
      const stylesheet = postcss.parse(readFileSync(path, 'utf8'), { from: path });
      stylesheet.walkDecls((declaration: Declaration) => {
        if (declaration.prop === 'font-size') {
          const match = /^(\d+(?:\.\d+)?)px(?:\s*!important)?$/.exec(declaration.value.trim());
          if (match && Number(match[1]) < 12) {
            violations.push(`${path}:${declaration.source?.start?.line ?? 0}:${declaration.value}`);
          }
        }
        if (declaration.prop === 'font-weight') {
          const value = declaration.value.replace(/\s*!important$/, '').trim();
          if (!['400', '500', '600'].includes(value)) {
            invalidWeights.push(`${path}:${declaration.source?.start?.line ?? 0}:${value}`);
          }
        }
      });
    }

    expect(violations).toEqual([]);
    expect(invalidWeights).toEqual([]);
    expect(settingsCss).toContain('font-family: inherit');
    expect(stateCss).toContain('font-family: inherit');
    expect(statusCss).toContain('font-family: inherit');
  });

  it('uses semantic palette and geometry tokens instead of route-specific theme branches', () => {
    for (const source of [settingsCss, stateCss, statusCss]) {
      expect(source).toContain('var(--so-');
      expect(source).not.toContain("data-desktop-theme='dark'");
    }
    expect(settingsCss).toContain('var(--app-radius-control');
    expect(settingsCss).toContain('var(--app-radius-card');
    expect(stateCss).toContain('var(--app-radius-panel');
    expect(statusCss).toContain('var(--app-radius-control');
  });

  it('covers pointer, keyboard, disabled and reduced-motion states', () => {
    for (const state of [':hover', ':active', ':focus-visible', ':disabled']) {
      expect(`${settingsCss}\n${stateCss}\n${statusCss}`).toContain(state);
    }
    for (const source of [settingsCss, stateCss, statusCss]) {
      expect(source).toContain('@media (prefers-reduced-motion: reduce)');
    }
    expect(settingsCss).toContain("html[data-desktop-reduce-motion='true']");
    expect(stateCss).toContain("html[data-desktop-reduce-motion='true']");
    expect(statusCss).toContain("html[data-desktop-reduce-motion='true']");
  });

  it('exposes auth, startup and settings feedback states without changing their business flow', () => {
    expect(loginSource).toContain('data-auth-view={activeView}');
    expect(loginSource).toContain("data-auth-mode={registering ? 'register' : 'login'}");
    expect(loginSource).toContain('aria-busy={desktopSubmitBusy}');
    expect(loginSource).toContain("data-feedback-state={desktopSubmitBusy ? 'pending' : 'idle'}");
    expect(startupSource).toContain('data-startup-phase={phase}');
    expect(startupSource).toContain('role="progressbar"');
    expect(startupSource).toContain('aria-busy={retrying}');
    expect(settingsSource).toContain('data-settings-category={activeCategory}');
    expect(settingsSource).toContain("data-state={active ? 'active' : 'idle'}");
    expect(settingsSource).toContain('aria-busy={manualSyncBusy || syncStatus');
  });
});
