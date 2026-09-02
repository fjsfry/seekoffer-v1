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
  it('renders the approved 10,000-user letter and desktop announcement verbatim', () => {
    expect(SITE_ANNOUNCEMENT.id).toBe('users-10000-desktop-letter-v2');
    expect(SITE_ANNOUNCEMENT.eyebrow).toBe('写给每一位正在保研路上的你');
    expect(SITE_ANNOUNCEMENT.salutation).toBe('亲爱的同学：');
    expect(SITE_ANNOUNCEMENT.title).toBe('谢谢你，让寻鹿遇见了第一万位同行者。');
    expect(SITE_ANNOUNCEMENT.letterParagraphs).toEqual([
      '从第一条被收藏的通知，到第一个被写进日程的截止日期；从一份迟迟没有动笔的申请材料，到最终按下提交按钮的那一刻——保研从来不是一条轻松、笔直的路。它有等待，有犹豫，也有无数个反复确认材料的深夜。',
      '寻鹿最初想做的事情其实很简单：把分散的信息整理得更清楚，把容易错过的节点及时提醒出来，把复杂的申请过程变成一件件能够认真完成的小事。',
      '如今，已经有超过 10,000 位同学使用寻鹿。这个数字对我们而言，不只意味着一次成长，更代表着一万份真实的选择与信任。感谢你的每一次使用、每一条反馈和每一次推荐，它们让我们知道，这件事值得继续认真做下去。'
    ]);
    expect(SITE_ANNOUNCEMENT.desktopIntro).toBe('在这个特别的时刻，我们也正式带来了');
    expect(SITE_ANNOUNCEMENT.desktopName).toBe('寻鹿桌面端');
    expect(SITE_ANNOUNCEMENT.desktopParagraphs).toEqual([
      '你可以在更加专注的桌面环境中查看保研通知、管理申请项目、整理材料进度、安排日程与提醒，让那些重要却容易遗漏的事情，始终处在清晰可见的位置。',
      '这只是寻鹿走出的又一步。我们仍会继续完善数据、打磨功能，也会认真听取每一位同学的建议。我们希望，寻鹿不只是你偶尔打开的信息网站，而是能够陪你走过整个申请阶段的可靠工具。'
    ]);
    expect(SITE_ANNOUNCEMENT.journey).toBe('10,000 不是终点，而是一段新旅程的开始。');
    expect(SITE_ANNOUNCEMENT.thanks).toBe('谢谢你与寻鹿同行。');
    expect(SITE_ANNOUNCEMENT.wish).toBe(
      '愿你认真准备的每一份材料，都能抵达它应该到达的地方；愿你经历的所有等待，最终都能收到值得的答案。'
    );
    expect(SITE_ANNOUNCEMENT.signature).toBe('寻鹿团队 敬上');
    expect(SITE_ANNOUNCEMENT.actionHref).toBe('/download');
    expect(SITE_ANNOUNCEMENT.actionLabel).toBe('了解桌面端');
    expect(SITE_ANNOUNCEMENT.secondaryActionLabel).toBe('继续浏览网站');
    expect(Date.parse(SITE_ANNOUNCEMENT.expiresAt)).toBeGreaterThan(Date.parse('2026-09-02'));

    expect(componentSource).toContain('SITE_ANNOUNCEMENT.letterParagraphs.map');
    expect(componentSource).toContain('SITE_ANNOUNCEMENT.desktopParagraphs.map');
    expect(componentSource).toContain('SITE_ANNOUNCEMENT.desktopName');
    expect(componentSource).toContain('SITE_ANNOUNCEMENT.signature');
    expect(componentSource).not.toContain('next/image');
    expect(componentSource).not.toContain('lucide-react');
    expect(componentSource).not.toContain('DESKTOP_RELEASE');
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
