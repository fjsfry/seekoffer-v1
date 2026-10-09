import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DesktopLoadingIndicator, DesktopLoadingState, type DesktopLoadingVariant } from '../components/desktop-loading';
import { DesktopStateSurface } from '../components/desktop-state-surface';

describe('desktop loading primitives', () => {
  it('renders one accessible initial-load region with decorative placeholders', () => {
    const html = renderToStaticMarkup(React.createElement(DesktopLoadingState, {
      variant: 'notices', title: '正在读取通知', detail: '保留当前筛选条件', rows: 3
    }));
    expect(html).toContain('data-desktop-loading="notices"');
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('正在读取通知');
    expect(html).toContain('保留当前筛选条件');
    expect(html.match(/data-loading-indicator="ring"/g)).toHaveLength(1);
    expect(html).not.toContain('progressbar');
    expect(html).not.toMatch(/aria-valuenow|https?:\/\//);
  });

  it('secondary detail placeholders do not duplicate announcements or spinners', () => {
    const html = renderToStaticMarkup(React.createElement(DesktopLoadingState, {
      variant: 'detail', title: '正在读取详情', showHeading: false
    }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('data-loading-indicator');
    expect(html).not.toContain('正在读取详情');
  });

  it.each<DesktopLoadingVariant>(['applications', 'notices', 'schedule', 'contacts', 'resources', 'help', 'settings', 'detail'])('supports the %s layout without fake data', variant => {
    const html = renderToStaticMarkup(React.createElement(DesktopLoadingState, { variant, title: '正在读取', rows: 2 }));
    expect(html).toContain(`data-desktop-loading="${variant}"`);
    expect(html).not.toMatch(/10,000|100%|云端已同步|还没有/);
  });

  it('bounds the placeholder count and tolerates non-finite input', () => {
    const render = (rows: number) => renderToStaticMarkup(React.createElement(DesktopLoadingState, { title: '正在读取', rows, showHeading: false }));
    expect(render(500)).toBe(render(8));
    expect(render(-1)).toBe(render(1));
    expect(render(Number.NaN)).toBe(render(3));
  });

  it('keeps indicators decorative and keeps actions accessible', () => {
    const ring = renderToStaticMarkup(React.createElement(DesktopLoadingIndicator, { size: 'small', still: true }));
    expect(ring).toContain('aria-hidden="true"');
    expect(ring).toContain('focusable="false"');
    expect(ring).not.toContain('role="status"');
    const state = renderToStaticMarkup(React.createElement(DesktopLoadingState, {
      title: '正在读取', action: React.createElement('button', null, '重试')
    }));
    expect(state).toContain('<button>重试</button>');
  });

  it('uses the same ring for existing status surfaces, never for errors', () => {
    const props = { icon: React.createElement('span', null, 'fallback icon'), title: '状态' };
    expect(renderToStaticMarkup(React.createElement(DesktopStateSurface, { ...props, loading: true }))).toContain('data-loading-indicator="ring"');
    const error = renderToStaticMarkup(React.createElement(DesktopStateSurface, { ...props, tone: 'error' }));
    expect(error).toContain('role="alert"');
    expect(error).toContain('fallback icon');
    expect(error).not.toContain('data-loading-indicator');
  });

  it('has static system/app motion fallbacks and width-aware layouts', () => {
    const css = readFileSync(resolve(import.meta.dirname, '../components/desktop-loading.module.css'), 'utf8');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain("html[data-desktop-reduce-motion='true']");
    expect(css).toContain('.rotor, .delayed { animation: none; }');
    expect(css).toContain('@container (max-width: 420px)');
    expect(css).toContain('var(--so-surface, #fff)');
    expect(css).not.toMatch(/(?:linear|radial|conic)-gradient|url\(/);
  });
});
