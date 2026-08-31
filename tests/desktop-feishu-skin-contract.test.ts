import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration } from 'postcss';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const cssPath = resolve(root, 'app/desktop-app-coherence.css');
const cssSource = readFileSync(cssPath, 'utf8');
const startMarker = '/* BEGIN FEISHU-INSPIRED SKIN ONLY — GEOMETRY FROZEN';
const endMarker = '/* END FEISHU-INSPIRED SKIN ONLY — GEOMETRY FROZEN */';
const start = cssSource.indexOf(startMarker);
const end = cssSource.indexOf(endMarker);
const skinSource = start >= 0 && end > start ? cssSource.slice(start, end + endMarker.length) : '';

const allowedVisualProperties = new Set([
  'accent-color',
  'background',
  'background-color',
  'border-color',
  'box-shadow',
  'caret-color',
  'color',
  'color-scheme',
  'fill',
  'outline-color',
  'stroke',
  'text-decoration-color'
]);

const allowedVisualToken = /^--(?:so-(?:canvas|surface|border|divider|text|brand|danger|success|warning|on-brand|scrollbar|shadow|scrim)|desktop-(?:canvas|surface|border|text|accent|danger|warning|shadow))/;
const geometryToken = /^--.*(?:width|height|size|line|radius|gap|space|padding|margin|inset|rail|titlebar|control|search|compact|page|max|min|font)/i;

describe('Feishu-inspired desktop skin contract', () => {
  it('lives in the final coherence authority and keeps SeekOffer green as the brand', () => {
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(skinSource).toContain('--so-canvas: #f5f6f7');
    expect(skinSource).toContain('--so-text: #1f2329');
    expect(skinSource).toContain('--so-border: #dee0e3');
    expect(skinSource).toContain('--so-brand: #0f6b61');
    expect(skinSource).toContain('--so-canvas: #171a1f !important');
    expect(skinSource).toContain('--so-surface: #202329 !important');
  });

  it('contains visual declarations only and cannot alter layout geometry', () => {
    const stylesheet = postcss.parse(skinSource, { from: cssPath });
    const unexpected: string[] = [];

    stylesheet.walkDecls((declaration: Declaration) => {
      if (declaration.prop.startsWith('--')) {
        if (!allowedVisualToken.test(declaration.prop) || geometryToken.test(declaration.prop)) {
          unexpected.push(declaration.prop);
        }
        return;
      }
      if (!allowedVisualProperties.has(declaration.prop)) unexpected.push(declaration.prop);
    });

    expect([...new Set(unexpected)]).toEqual([]);
    for (const forbidden of [
      '--so-rail-w',
      '--app-page-header-h',
      '--app-page-title-size',
      '--app-control-h',
      'grid-template',
      'display:',
      'position:',
      'padding:',
      'margin:',
      'width:',
      'height:',
      'transform:'
    ]) {
      expect(skinSource).not.toContain(forbidden);
    }
  });

  it('covers the shared chrome, surfaces, controls, states and overlays', () => {
    for (const selector of [
      '.desktop-topbar',
      '.desktop-primary-rail',
      '.desktop-view-stage',
      '.desktop-page-header',
      '.desktop-notice-card',
      '.desktop-college-card',
      '.desktop-resource-toolbar',
      '.desktop-guide-home',
      '.desktop-settings-group',
      '.desktop-command-dialog',
      '.desktop-reminder-center',
      '.desktop-global-dialog-panel'
    ]) {
      expect(skinSource).toContain(selector);
    }
    expect(skinSource).toContain(':focus-within');
    expect(skinSource).toContain(':focus-visible');
    expect(skinSource).toContain("[aria-current='page']");
    expect(skinSource).toContain("[aria-selected='true']");
  });

  it('publishes palette variables and overlay skins at the document root for portaled UI', () => {
    expect(skinSource).toMatch(/html\.seekoffer-desktop-surface,\s*\n\.desktop-app-shell/);
    expect(skinSource).toMatch(/html\.seekoffer-desktop-surface\[data-desktop-theme='dark'\],/);
    expect(skinSource).toMatch(/html\.seekoffer-desktop-surface\s+:is\(\s*\n\s*\.desktop-command-dialog,/);
    expect(skinSource).toContain('.desktop-global-dialog-panel');
    expect(skinSource).toContain('.desktop-manual-application-dialog');
    expect(skinSource).toContain('.desktop-update-toast');
    expect(skinSource).toContain('.desktop-guide-support-overlay');
  });

  it('leaves the approved geometry baseline intact outside the skin block', () => {
    expect(cssSource).toContain('--so-rail-w: 188px !important');
    expect(cssSource).toContain('--app-page-header-h: 88px');
    expect(cssSource).toContain('--app-page-title-size: 28px');
    expect(cssSource).toContain('--app-control-h: 36px');
    expect(cssSource).toContain('--app-search-h: 40px');
  });
});
