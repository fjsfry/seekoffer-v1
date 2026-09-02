import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_ANNOUNCEMENT, buildSiteAnnouncementBootstrapScript } from '@/lib/site-announcement';

const root = process.cwd();
const componentSource = readFileSync(resolve(root, 'components/site-announcement.tsx'), 'utf8');
const shellSource = readFileSync(resolve(root, 'components/site-shell.tsx'), 'utf8');
const layoutSource = readFileSync(resolve(root, 'app/layout.tsx'), 'utf8');
const cssSource = readFileSync(resolve(root, 'app/globals.css'), 'utf8');

describe('public website milestone announcement', () => {
  it('keeps the campaign copy concise and routes one action to the desktop page', () => {
    expect(SITE_ANNOUNCEMENT.id).toBe('users-10000-desktop-v022');
    expect(SITE_ANNOUNCEMENT.badge).toBe('10,000+ 位同学');
    expect(SITE_ANNOUNCEMENT.title).toContain('寻鹿桌面端现已上线');
    expect(SITE_ANNOUNCEMENT.body).toContain('申请进度和关键截止');
    expect(SITE_ANNOUNCEMENT.actionHref).toBe('/download');
    expect(SITE_ANNOUNCEMENT.actionLabel).toBe('了解桌面端');
    expect(Date.parse(SITE_ANNOUNCEMENT.expiresAt)).toBeGreaterThan(Date.parse('2026-09-02'));
  });

  it('places one non-blocking announcement after the shared header and before main content', () => {
    expect(shellSource).toContain("import { SiteAnnouncement } from './site-announcement'");
    expect(shellSource.indexOf('<SiteHeader />')).toBeLessThan(
      shellSource.indexOf('<SiteAnnouncement />')
    );
    expect(shellSource.indexOf('<SiteAnnouncement />')).toBeLessThan(
      shellSource.indexOf('<main id="main-content"')
    );
    expect(componentSource).toContain('data-site-announcement={SITE_ANNOUNCEMENT.id}');
    expect(componentSource).not.toContain('role="alert"');
    expect(componentSource).not.toContain('role="dialog"');
    expect(componentSource).not.toContain('fixed');
    expect(componentSource).not.toContain('sticky');
  });

  it('persists dismissal without hydration flicker and preserves keyboard focus', () => {
    expect(componentSource).toContain("window.localStorage.setItem(SITE_ANNOUNCEMENT.storageKey, 'dismissed')");
    expect(componentSource).toContain("dataset.seekofferAnnouncementHidden = 'true'");
    expect(componentSource).toContain('aria-label="关闭网站公告"');
    expect(componentSource).toContain("document.getElementById('main-content')?.focus");
    expect(componentSource).toContain("pathname === SITE_ANNOUNCEMENT.actionHref");

    expect(layoutSource).toContain('id="seekoffer-site-announcement-bootstrap"');
    expect(layoutSource).toContain('strategy="beforeInteractive"');
    expect(layoutSource).toContain('buildSiteAnnouncementBootstrapScript()');
    expect(buildSiteAnnouncementBootstrapScript()).toContain(SITE_ANNOUNCEMENT.storageKey);
    expect(cssSource).toContain("html[data-seekoffer-announcement-hidden='true'] [data-site-announcement]");
  });
});
