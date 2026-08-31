import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration } from 'postcss';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const coherencePath = resolve(root, 'app/desktop-app-coherence.css');
const interactionsPath = resolve(root, 'app/desktop-interactions.css');
const coherence = readFileSync(coherencePath, 'utf8');
const interactions = readFileSync(interactionsPath, 'utf8');
const activeModulePaths = [
  'components/desktop-reminder-center.module.css',
  'components/desktop-workspace.module.css',
  'components/desktop-state-surface.module.css',
  'app/colleges/colleges.module.css',
  'app/guide/guide.module.css',
  'app/resources/resources.module.css'
].map((path) => resolve(root, path));
const activeGlobalPaths = [
  'app/desktop-notice-alignment.css',
  'app/desktop-resource-center.css',
  'app/desktop-guide-center.css',
  'app/desktop-help-center-v2.css',
  'app/desktop-app-coherence.css'
].map((path) => resolve(root, path));

function rgb(hex: string) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
}

function luminance(hex: string) {
  const channels = rgb(hex).map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(left: string, right: string) {
  const a = luminance(left);
  const b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('desktop product design system', () => {
  it('publishes one mature Windows typography, spacing and geometry vocabulary', () => {
    for (const token of [
      '"Segoe UI Variable", "Microsoft YaHei UI"',
      '--app-type-page-title: 28px/36px',
      '--app-type-workspace-title: 24px/32px',
      '--app-type-section-title: 20px/28px',
      '--app-type-card-title: 16px/24px',
      '--app-type-body: 14px/22px',
      '--app-type-meta: 13px/20px',
      '--app-type-caption: 12px/18px',
      '--app-space-1: 4px',
      '--app-space-10: 40px',
      '--app-radius-control: 8px',
      '--app-radius-card: 12px',
      '--app-radius-panel: 12px'
    ]) {
      expect(coherence).toContain(token);
    }
    expect(coherence).not.toMatch(/font-weight:\s*(?:650|700|800|900|bold)\b/);
  });

  it('keeps required copy at 12px or larger in the active route modules', () => {
    const violations: string[] = [];
    const invalidWeights: string[] = [];
    for (const path of activeModulePaths) {
      const stylesheet = postcss.parse(readFileSync(path, 'utf8'), { from: path });
      stylesheet.walkDecls('font-size', (declaration: Declaration) => {
        const value = declaration.value.trim();
        const match = /^(\d+(?:\.\d+)?)px$/.exec(value);
        if (match && Number(match[1]) < 12) {
          violations.push(`${path}:${declaration.source?.start?.line ?? 0}:${value}`);
        }
      });
    }
    for (const path of [...activeModulePaths, ...activeGlobalPaths]) {
      const stylesheet = postcss.parse(readFileSync(path, 'utf8'), { from: path });
      stylesheet.walkDecls('font-weight', (declaration: Declaration) => {
        const value = declaration.value.replace(/\s*!important\s*$/, '').trim();
        if (/^\d+$/.test(value) && !['400', '500', '600'].includes(value)) {
          invalidWeights.push(`${path}:${declaration.source?.start?.line ?? 0}:${value}`);
        }
      });
    }
    expect(violations).toEqual([]);
    expect(invalidWeights).toEqual([]);
  });

  it('uses the Windows 83/167/250ms ladder for route-module transitions', () => {
    for (const token of [
      '--motion-faster: 83ms',
      '--motion-fast: 167ms',
      '--motion-normal: 250ms',
      '--motion-ease-enter: cubic-bezier(0, 0, 0, 1)',
      '--motion-ease-move: cubic-bezier(0.55, 0.55, 0, 1)',
      '--motion-ease-exit: cubic-bezier(1, 0, 1, 1)'
    ]) {
      expect(interactions).toContain(token);
    }

    const unexpected: string[] = [];
    for (const path of [...activeModulePaths, ...activeGlobalPaths]) {
      const stylesheet = postcss.parse(readFileSync(path, 'utf8'), { from: path });
      stylesheet.walkDecls((declaration: Declaration) => {
        if (!/^(?:transition|transition-duration)$/.test(declaration.prop)) return;
        for (const match of declaration.value.matchAll(/(?<![\w-])(\d+(?:\.\d+)?)ms\b/g)) {
          if (!['0', '0.01', '83', '167', '250'].includes(match[1])) {
            unexpected.push(`${path}:${declaration.source?.start?.line ?? 0}:${match[1]}ms`);
          }
        }
      });
    }
    expect(unexpected).toEqual([]);
    expect(interactions).toContain("html[data-desktop-reduce-motion='true']");
    expect(interactions).toContain('@media (prefers-reduced-motion: reduce)');
    expect(coherence).toContain("html.seekoffer-desktop-surface[data-desktop-reduce-motion='true']");
    expect(coherence).toMatch(/data-desktop-reduce-motion='true'[\s\S]*?\.desktop-reminder-center\s*\{[^}]*transform:\s*none\s*!important[^}]*transition:\s*none\s*!important/);
  });

  it('uses readable semantic colors in light and dark themes', () => {
    expect(coherence).toContain('--so-text: #1f2329');
    expect(coherence).toContain('--so-text-secondary: #646a73');
    expect(coherence).toContain('--so-brand: #0f6b61');
    expect(coherence).toContain('--so-warning: #8a5200');
    expect(coherence).toContain('--so-canvas: #171a1f !important');
    expect(coherence).toContain('--so-surface: #202329 !important');
    expect(coherence).toContain('--so-text-secondary: #c5c9d0 !important');
    expect(contrast('#1f2329', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#646a73', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', '#0f6b61')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#c9443d', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#8a5200', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#8a5200', '#fff5e6')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#f2f3f5', '#202329')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#c5c9d0', '#202329')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#41b3a4', '#202329')).toBeGreaterThanOrEqual(4.5);
  });

  it('covers focus, selected, pressed, disabled, loading and overlay feedback states', () => {
    for (const state of [
      ':focus-visible',
      "[aria-selected='true']",
      ':active',
      ':disabled',
      "[data-feedback-state='pending']",
      '.desktop-feedback-pending-icon',
      '.desktop-global-dialog-panel',
      '.desktop-project-inspector'
    ]) {
      expect(`${coherence}\n${interactions}`).toContain(state);
    }
    expect(coherence).toContain('transition-duration: var(--motion-faster, 83ms) !important');
  });

  it('owns the semantic shell, command, shortcut and updater primitives', () => {
    for (const selector of [
      '.desktop-search-trigger-copy',
      '.desktop-toolbar-badge',
      '.desktop-command-search',
      '.desktop-command-option-title',
      '.desktop-command-option-description',
      '.desktop-shortcut-dialog',
      '.desktop-shortcut-row',
      '.desktop-global-dialog-header',
      '.desktop-global-dialog-description',
      '.desktop-update-toast-title',
      '.desktop-update-progress-track',
      '.desktop-update-release-notes'
    ]) {
      expect(coherence).toContain(selector);
    }
  });
});
