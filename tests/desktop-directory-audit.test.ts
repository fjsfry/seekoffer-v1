import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { collegePopoverPlacement } from '../app/colleges/college-popover-placement';

const root = resolve(import.meta.dirname, '..');
const route = readFileSync(resolve(root, 'app/notices/detail/page.tsx'), 'utf8');
const css = readFileSync(resolve(root, 'app/desktop-directory-audit.css'), 'utf8');

describe('desktop directory visual audit', () => {
  it('uses the shared detail skeleton for initial routing and the pending request', () => {
    expect(route).toContain("process.env.NEXT_PUBLIC_SEEKOFFER_SURFACE === 'desktop'");
    expect(route).toContain('if (isDesktopSurface) return <DesktopDetailLoading />');
    expect(route).toContain('fallback={isDesktopSurface ? <DesktopDetailLoading />');
    expect(route).toContain('variant="detail"');
    expect(route).toContain('rows={3}');
  });

  it('makes missing and failed detail states actionable while keeping the web fallback', () => {
    expect(route).toContain('<DesktopStateSurface');
    expect(route).toContain("tone={state === 'error' ? 'error' : 'neutral'}");
    expect(route).toContain('已保存的申请记录和材料不会受到影响');
    expect(route).toContain('desktop-notice-detail-state--empty');
    expect(route).toContain('desktop-notice-detail-state--error');
    expect(route).toContain('href={href}');
  });

  it('limits reading typography changes to desktop notice details and preserves wrapping', () => {
    const selectors: string[] = [];
    postcss.parse(css).walkRules(rule => { selectors.push(...rule.selectors); });
    expect(selectors.length).toBeGreaterThan(0);
    expect(selectors.every(selector => selector.includes('.desktop-app-shell'))).toBe(true);
    expect(css).toContain('font-size: 28px');
    expect(css).toContain('font-size: 24px');
    expect(css).toContain('overflow-wrap: anywhere');
    expect(css).not.toContain('overflow: hidden');
  });

  it.each([0.8, 1, 1.25, 1.5, 1.75, 2])('bounds the college filter and footer at %s CSS zoom', scale => {
    for (const viewport of [{ width: 960, height: 720 }, { width: 1280, height: 800 }]) {
      const box = collegePopoverPlacement({
        trigger: { right: viewport.width - 70, top: 180, bottom: 180 + 40 * scale, width: 140 * scale },
        triggerLayoutWidth: 140,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height
      });
      expect(box.left * scale).toBeGreaterThanOrEqual(11.99);
      expect((box.left + box.width) * scale).toBeLessThanOrEqual(viewport.width - 11.99);
      expect(box.top * scale).toBeGreaterThanOrEqual(11.99);
      expect((box.top + box.maxHeight) * scale).toBeLessThanOrEqual(viewport.height - 11.99);
      expect(box.maxHeight).toBeGreaterThan(100);
    }
  });

  it('does not divide by zero for a temporarily unmeasurable trigger', () => {
    const placement = collegePopoverPlacement({
      trigger: { right: 800, top: 200, bottom: 240, width: 0 },
      triggerLayoutWidth: 0, viewportWidth: 960, viewportHeight: 720
    });
    expect(Object.values(placement).every(Number.isFinite)).toBe(true);
  });

  it('keeps the college header and toolbar in natural document flow at high zoom', () => {
    expect(css).toContain('.desktop-core-page:has(> .desktop-college-page-toolbar)');
    expect(css).toContain('grid-auto-rows: max-content !important');
    expect(css).toContain('height: auto !important');
    expect(css).toContain('min-height: var(--app-page-header-h, 88px) !important');
  });

  it('packs notice controls into two rows when the content width comfortably fits', () => {
    expect(css).toContain('container: notice-filter-controls / inline-size');
    expect(css).toContain('(min-width: 460px) and (max-width: 850px)');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(css).toContain('grid-column: 1 / -1');
    expect(css).toContain('grid-column: auto');
  });
});
