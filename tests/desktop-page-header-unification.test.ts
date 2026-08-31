import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const sources = {
  applications: read('components/desktop-home.tsx'),
  schedule: read('components/desktop-schedule-workspace.tsx'),
  contacts: read('components/desktop-contacts-workspace.tsx'),
  notices: read('app/notices/page.tsx'),
  colleges: read('app/colleges/page.tsx'),
  resources: read('app/resources/desktop-resource-center.tsx'),
  guide: read('app/guide/desktop-help-center.tsx'),
  settings: read('components/desktop-settings-page.tsx')
};
const css = read('app/desktop-app-coherence.css');

describe('desktop shared page-header contract', () => {
  it('gives every top-level desktop route the same semantic header skeleton', () => {
    for (const [route, source] of Object.entries(sources)) {
      expect(source, route).toContain('desktop-page-header');
      expect(source, route).toContain('desktop-page-header-copy');
      expect(source, route).toContain('desktop-page-header-title-row');
      expect(source, route).toContain('desktop-page-header-title');
    }

    for (const route of ['schedule', 'contacts', 'notices', 'colleges', 'resources', 'guide', 'settings'] as const) {
      expect(sources[route], route).toContain('desktop-page-header-subtitle');
    }

    expect(sources.applications).toContain('desktop-page-header--embedded');
    expect(sources.applications).not.toContain('集中管理申请状态、材料与截止时间');
    expect(sources.applications).toContain('desktop-page-header-count');
  });

  it('removes one-off decorative hero icons and separates college search from its header', () => {
    expect(sources.resources).not.toContain('desktop-resource-hero-icon');
    expect(sources.guide).not.toContain('desktop-guide-hero-icon');
    expect(sources.colleges).not.toContain('className={styles.headerIcon}');
    expect(sources.colleges).toContain('desktop-college-page-toolbar');
    expect(sources.colleges).toContain('aria-label="搜索与筛选院校"');

    const desktopCollegeStart = sources.colleges.indexOf('{isDesktopSurface ? (');
    const desktopCollegeEnd = sources.colleges.indexOf(') : (', desktopCollegeStart);
    const desktopCollegeBranch = sources.colleges.slice(desktopCollegeStart, desktopCollegeEnd);
    const headerEnd = desktopCollegeBranch.indexOf('</header>');
    const searchStart = desktopCollegeBranch.indexOf('placeholder="搜索院校名称"');
    expect(headerEnd).toBeGreaterThan(0);
    expect(searchStart).toBeGreaterThan(headerEnd);
  });

  it('owns title, subtitle, count, action and surface geometry in one final CSS authority', () => {
    for (const token of [
      '--app-page-header-h: 88px',
      '--app-page-header-px: 20px',
      '--app-page-header-py: 12px',
      '--app-page-header-gap: 24px',
      '--app-page-title-size: 28px',
      '--app-page-title-line: 36px'
    ]) {
      expect(css).toContain(token);
    }

    expect(css).toContain('.desktop-page-header .desktop-page-header-title');
    expect(css).toContain('letter-spacing: -0.015em !important');
    expect(css).toContain('.desktop-page-header .desktop-page-header-subtitle');
    expect(css).toContain('font-weight: 400 !important');
    expect(css).toContain('.desktop-page-header-count');
    expect(css).toContain('font-variant-numeric: tabular-nums');
    expect(css).toContain('.desktop-page-header--embedded');
    expect(css).toContain('background: var(--so-surface) !important');
    expect(css).not.toContain('"Noto Sans SC"');
  });

  it('uses one compact title scale at accessibility zoom without hiding labels or actions', () => {
    expect(css).toMatch(/data-zoom-level='150'[\s\S]*?\.desktop-page-header \.desktop-page-header-title\s*\{[\s\S]*?font-size:\s*28px\s*!important[\s\S]*?line-height:\s*36px\s*!important/);
    expect(css).toMatch(/data-zoom-level='150'[\s\S]*?\.desktop-page-header \.desktop-page-header-subtitle\s*\{[\s\S]*?font-size:\s*13px\s*!important[\s\S]*?line-height:\s*20px\s*!important/);
    expect(css).toContain('grid-template-rows: var(--app-page-header-h) minmax(0, 1fr) !important');
  });
});
