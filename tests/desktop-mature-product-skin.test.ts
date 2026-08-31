import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration } from 'postcss';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const cssPath = resolve(root, 'app/desktop-app-coherence.css');
const cssSource = readFileSync(cssPath, 'utf8');
const startMarker = '/* BEGIN MATURE DESKTOP PRODUCT SKIN V2 — BOUNDING BOX PRESERVED';
const endMarker = '/* END MATURE DESKTOP PRODUCT SKIN V2 */';
const start = cssSource.indexOf(startMarker);
const end = cssSource.indexOf(endMarker);
const skinSource = cssSource.slice(start, end + endMarker.length);
const stylesheet = postcss.parse(skinSource, { from: cssPath });

function luminance(hex: string) {
  const channels = hex.match(/[0-9a-f]{2}/gi)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe('mature desktop product skin', () => {
  it('is a final visual authority with a frozen layout contract', () => {
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(cssSource.trimEnd().endsWith(endMarker)).toBe(true);
    expect(skinSource).not.toContain('[class*=');
    expect(skinSource).not.toContain('@container');

    const forbiddenLayoutProperties = new Set([
      'display',
      'position',
      'inset',
      'top',
      'right',
      'bottom',
      'left',
      'width',
      'min-width',
      'max-width',
      'height',
      'min-height',
      'max-height',
      'padding',
      'padding-block',
      'padding-inline',
      'margin',
      'margin-block',
      'margin-inline',
      'gap',
      'row-gap',
      'column-gap',
      'grid-template-columns',
      'grid-template-rows',
      'grid-area',
      'grid-column',
      'grid-row',
      'flex',
      'flex-direction',
      'align-items',
      'justify-content',
      'overflow',
      'overflow-x',
      'overflow-y'
    ]);
    const violations: string[] = [];
    const allowedVisualProperties = new Set([
      'color',
      'background',
      'background-color',
      'background-image',
      'border-color',
      'border-radius',
      'box-shadow',
      'font-weight',
      'font-synthesis',
      'letter-spacing',
      'text-rendering',
      '-webkit-font-smoothing',
      'caret-color',
      'accent-color',
      'color-scheme',
      'transition-duration',
      'transition-property',
      'transition-timing-function',
      'transform',
      'outline',
      'outline-color',
      'outline-offset',
      'opacity',
      'cursor',
      'scrollbar-color',
      '-webkit-backdrop-filter',
      'backdrop-filter',
      'scroll-behavior',
      'animation-duration',
      'animation-iteration-count',
      'forced-color-adjust'
    ]);
    const unexpectedVisualProperties: string[] = [];
    stylesheet.walkDecls((declaration: Declaration) => {
      if (forbiddenLayoutProperties.has(declaration.prop)) {
        violations.push(`${declaration.prop}: ${declaration.value}`);
      }
      if (!declaration.prop.startsWith('--') && !allowedVisualProperties.has(declaration.prop)) {
        unexpectedVisualProperties.push(`${declaration.prop}: ${declaration.value}`);
      }
    });

    expect(violations).toEqual([]);
    expect(unexpectedVisualProperties).toEqual([]);

    const radiusValues: string[] = [];
    stylesheet.walkDecls('border-radius', (declaration: Declaration) => {
      radiusValues.push(declaration.value.replace(/\s*!important\s*$/, '').trim());
    });
    expect(radiusValues.length).toBeGreaterThan(0);
    expect(radiusValues.every((value) => /^var\(--product-radius-[a-z-]+\)$/.test(value))).toBe(true);
    expect(skinSource).not.toContain('transition: all');
  });

  it('uses semantic surface, text, brand and interaction-state tokens', () => {
    for (const token of [
      '--so-canvas',
      '--so-surface',
      '--so-surface-hover',
      '--so-surface-pressed',
      '--so-border',
      '--so-border-strong',
      '--so-text',
      '--so-text-secondary',
      '--so-text-tertiary',
      '--so-brand',
      '--so-brand-hover',
      '--so-brand-pressed',
      '--so-brand-soft',
      '--so-control-bg',
      '--so-control-bg-hover',
      '--so-control-bg-pressed',
      '--so-control-bg-selected',
      '--so-control-border',
      '--so-control-border-hover',
      '--so-control-border-focus',
      '--so-focus-ring-color',
      '--so-text-disabled',
      '--product-radius-control',
      '--product-radius-item',
      '--product-radius-tag',
      '--product-radius-panel',
      '--product-focus-ring'
    ]) {
      expect(skinSource).toContain(`${token}:`);
    }

    expect(skinSource).toContain("[data-desktop-theme='dark']");
    expect(skinSource).toContain('--so-on-brand: #ffffff');
    expect(skinSource).toContain('--so-text-tertiary: #686f78');
    expect(skinSource).toContain('--product-action-bg: #0f6b61');
  });

  it('keeps tertiary interface copy readable on the light and dark surfaces', () => {
    expect(contrast('#686f78', '#f5f6f8')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#686f78', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#8f959f', '#292b30')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', '#0f6b61')).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps ordinary surfaces quiet and reserves elevation for overlays', () => {
    expect(skinSource).toContain('.desktop-application-object-row');
    expect(skinSource).toContain(".desktop-schedule-list > [role='listitem']");
    expect(skinSource).toContain(".desktop-contacts-list > [role='listitem']");
    expect(skinSource).toContain('.desktop-resource-item');
    expect(skinSource).toContain('.desktop-notice-card');
    expect(skinSource).toContain('.desktop-college-card');
    expect(skinSource).toContain('box-shadow: none !important');
    expect(skinSource).toContain('transform: none !important');
    expect(skinSource).toContain('box-shadow: var(--so-shadow-popover) !important');
    expect(skinSource).toContain('box-shadow: var(--so-shadow-dialog) !important');
    expect(skinSource).toContain('box-shadow: var(--so-shadow-float) !important');
    expect(skinSource).not.toMatch(/(?:linear|radial|conic)-gradient\(/);
  });

  it('defines complete rest, hover, pressed, focus and disabled feedback', () => {
    expect(skinSource).toContain(':hover:not(:disabled)');
    expect(skinSource).toContain(':active:not(:disabled)');
    expect(skinSource).toContain(':focus-visible');
    expect(skinSource).toContain(':disabled');
    expect(skinSource).toContain("[aria-disabled='true']");
    expect(skinSource).toContain('background: var(--app-primary-bg-hover) !important');
    expect(skinSource).toContain('background: var(--app-primary-bg-pressed) !important');
    expect(skinSource).toContain('background: var(--so-control-bg-pressed) !important');
    expect(skinSource).toContain('cursor: not-allowed !important');
    expect(skinSource).toContain('transition-duration: var(--motion-hover) !important');
    expect(skinSource).toContain('transition-timing-function: var(--motion-ease-standard) !important');
  });

  it('covers navigation, controls, cards, filters, overlays, toasts and reduced motion', () => {
    for (const selectorFragment of [
      '.desktop-primary-nav-item',
      '.desktop-page-header',
      '.desktop-notice-search-field',
      "input:not([type='checkbox'])",
      '.desktop-page-primary-action',
      '.desktop-setting-secondary-button',
      '.desktop-resource-filter',
      '.desktop-notice-card-tags > span',
      '.desktop-command-dialog',
      '.desktop-project-context-menu',
      '.desktop-feedback-toast',
      ".desktop-feedback-toast[data-feedback-state='success']",
      ".desktop-feedback-toast[data-feedback-state='error']",
      ".desktop-feedback-toast[data-feedback-state='undo']",
      "data-desktop-reduce-motion='true'",
      '@media (prefers-reduced-motion: reduce)',
      '@media (forced-colors: active)'
    ]) {
      expect(skinSource).toContain(selectorFragment);
    }
    expect(skinSource).toContain('transition-duration: 0.01ms !important');
    expect(skinSource).toContain('animation-duration: 0.01ms !important');
  });
});
