import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_ANNOUNCEMENT } from '@/lib/site-announcement';

const root = process.cwd();
const componentSource = readFileSync(resolve(root, 'components/site-announcement.tsx'), 'utf8');
const shellSource = readFileSync(resolve(root, 'components/site-shell.tsx'), 'utf8');
const layoutSource = readFileSync(resolve(root, 'app/layout.tsx'), 'utf8');
const cssSource = readFileSync(resolve(root, 'app/globals.css'), 'utf8');

describe('public website milestone announcement dialog', () => {
  it('combines the 10,000-user milestone with a detailed desktop launch story', () => {
    expect(SITE_ANNOUNCEMENT.id).toBe('users-10000-desktop-letter-v1');
    expect(SITE_ANNOUNCEMENT.milestone).toContain('10,000+');
    expect(SITE_ANNOUNCEMENT.title).toContain('一万位同行者');
    expect(SITE_ANNOUNCEMENT.letterParagraphs).toHaveLength(3);
    expect(SITE_ANNOUNCEMENT.letterParagraphs.join('')).toContain('一万多份信任');
    expect(SITE_ANNOUNCEMENT.productTitle).toContain('正式与你见面');
    expect(SITE_ANNOUNCEMENT.productParagraphs).toHaveLength(2);
    expect(SITE_ANNOUNCEMENT.closing).toContain('下一封好消息');
    expect(SITE_ANNOUNCEMENT.actionHref).toBe('/download');
    expect(SITE_ANNOUNCEMENT.actionLabel).toBe('了解桌面端');
    expect(SITE_ANNOUNCEMENT.secondaryActionLabel).toBe('继续浏览网站');
    expect(Date.parse(SITE_ANNOUNCEMENT.expiresAt)).toBeGreaterThan(Date.parse('2026-09-02'));

    expect(componentSource).toContain('SITE_ANNOUNCEMENT.letterParagraphs.map');
    expect(componentSource).toContain('SITE_ANNOUNCEMENT.productParagraphs.map');
    expect(componentSource).not.toContain('next/image');
    expect(componentSource).not.toContain('lucide-react');
    expect(componentSource).not.toContain('/desktop/seekoffer-workbench-download-v0.2.22.png');
  });

  it('uses a native modal dialog that only mounts after client-side eligibility checks', () => {
    expect(shellSource).toContain("import { SiteAnnouncement } from './site-announcement'");
    expect(shellSource.indexOf('<SiteHeader />')).toBeLessThan(
      shellSource.indexOf('<SiteAnnouncement />')
    );
    expect(componentSource).toContain("type AnnouncementState = 'checking' | 'open' | 'closed'");
    expect(componentSource).toContain("useState<AnnouncementState>('checking')");
    expect(componentSource).toContain("if (state !== 'open')");
    expect(componentSource).toContain('<dialog');
    expect(componentSource).toContain('dialog.showModal()');
    expect(componentSource).toContain('aria-labelledby="site-announcement-title"');
    expect(componentSource).toContain('aria-describedby="site-announcement-summary"');
    expect(componentSource).toContain('onCancel=');
    expect(componentSource).not.toContain('role="alert"');
    expect(layoutSource).not.toContain('seekoffer-site-announcement-bootstrap');
  });

  it('persists every dismissal path, restores focus, and yields to the login modal', () => {
    expect(componentSource).toContain(
      "window.localStorage.setItem(SITE_ANNOUNCEMENT.storageKey, 'dismissed')"
    );
    expect(componentSource).toContain('aria-label="关闭网站公告"');
    expect(componentSource).toContain("document.getElementById('main-content')?.focus");
    expect(componentSource).toContain("window.location.pathname.replace(/\\/$/, '')");
    expect(componentSource).toContain('event.target === event.currentTarget');
    expect(componentSource).toContain('watchAuthModal');
    expect(componentSource).toContain('dismiss(false)');
    expect(cssSource).toContain('body:has(.site-announcement-dialog[open])');
    expect(cssSource).toContain('.site-announcement-dialog::backdrop');
    expect(cssSource).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
