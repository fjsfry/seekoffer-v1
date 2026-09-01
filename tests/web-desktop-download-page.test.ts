import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DESKTOP_RELEASE, parsePublicDesktopRelease } from '@/lib/desktop-download';
import { footerColumns } from '@/lib/site-content';

const root = process.cwd();
const downloadPageSource = readFileSync(resolve(root, 'app/download/page.tsx'), 'utf8');
const downloadActionSource = readFileSync(
  resolve(root, 'components/desktop-download-action.tsx'),
  'utf8'
);
const headerSource = readFileSync(resolve(root, 'components/site-header.tsx'), 'utf8');
const homeSource = readFileSync(resolve(root, 'app/page.tsx'), 'utf8');
const siteContentSource = readFileSync(resolve(root, 'lib/site-content.ts'), 'utf8');
const sitemapSource = readFileSync(resolve(root, 'app/sitemap.ts'), 'utf8');
const vercelIgnoreSource = readFileSync(resolve(root, '.vercelignore'), 'utf8');

describe('desktop-only addition to the production website baseline', () => {
  it('uses the verified public v0.2.22 desktop asset', () => {
    expect(DESKTOP_RELEASE.version).toBe('0.2.22');
    expect(DESKTOP_RELEASE.installerSizeBytes).toBe(33_674_743);
    expect(DESKTOP_RELEASE.installerUrl).toBe(
      'https://seekoffer-desktop-updates.vercel.app/artifacts/desktop-v0.2.22/SeekOffer-Desktop-v0.2.22-Windows-x64-Setup.exe'
    );
    expect(DESKTOP_RELEASE.installerSha256).toMatch(/^[A-F0-9]{64}$/);
  });

  it('accepts only the expected signed-updater installer shape', () => {
    const verifiedInstallerUrl =
      'https://github.com/fjsfry/seekoffer-v1/releases/download/desktop-v0.2.22/SeekOffer-Desktop-v0.2.22-Windows-x64-Setup.exe';

    expect(
      parsePublicDesktopRelease({
        version: '0.2.22',
        pub_date: '2026-09-01T07:31:46.223Z',
        platforms: {
          'windows-x86_64': { url: verifiedInstallerUrl }
        }
      })
    ).toEqual({
      version: '0.2.22',
      installerUrl: verifiedInstallerUrl,
      publishedAt: '2026-09-01T07:31:46.223Z'
    });

    expect(
      parsePublicDesktopRelease({
        version: '0.2.22',
        platforms: {
          'windows-x86_64': { url: 'https://downloads.example.com/setup.exe' }
        }
      })
    ).toBeNull();
  });

  it('builds a canonical, pure-white download page with platform-safe actions', () => {
    expect(downloadPageSource).toContain("path: '/download'");
    expect(downloadPageSource).toContain("'@type': 'SoftwareApplication'");
    expect(downloadPageSource).toContain('<DesktopDownloadAction />');
    expect(downloadPageSource).toContain('把保研申请，');
    expect(downloadPageSource).toContain('Windows 10 / 11');
    expect(downloadPageSource).toContain(
      '/desktop/seekoffer-workbench-download-v0.2.22.png'
    );
    expect(downloadPageSource).not.toContain('GitHub');
    expect(downloadPageSource).not.toContain('官方发布与安全说明');
    expect(downloadPageSource).not.toContain('data-download-surface="security"');
    expect(downloadActionSource).toContain("platform === 'windows'");
    expect(downloadActionSource).toContain('继续使用网页版');
    expect(downloadActionSource).toContain('复制到 Windows 电脑打开');
    expect(downloadActionSource).not.toContain('GitHub');
    expect(downloadActionSource).not.toContain('未知发布者');
    expect(
      statSync(resolve(root, 'public/desktop/seekoffer-workbench-download-v0.2.22.png'))
        .size
    ).toBeGreaterThan(100_000);

    for (const surface of ['hero', 'hero-facts', 'benefits', 'installation', 'faq']) {
      expect(downloadPageSource).toMatch(
        new RegExp(`data-download-surface="${surface}"[\\s\\S]{0,320}bg-white`)
      );
    }
    expect(downloadPageSource).not.toContain('page-hero');
    expect(downloadPageSource).not.toContain('product-card');
    expect(downloadPageSource).not.toContain('lg:max-w-[1050px]');
    expect(downloadPageSource).toMatch(
      /data-download-surface="hero-facts"[\s\S]{0,240}grid w-full/
    );
    expect(downloadPageSource).toContain('lg:grid-cols-5');
    expect(downloadPageSource).toContain('md:grid-cols-2');
  });

  it('adds desktop discovery without changing the production navigation taxonomy', () => {
    const navItemsBlock = headerSource.slice(
      headerSource.indexOf('const navItems'),
      headerSource.indexOf('export function SiteHeader')
    );
    expect(navItemsBlock).not.toContain("href: '/download'");
    expect(navItemsBlock).not.toContain("href: '/pro'");
    expect(headerSource).toContain('aria-label="下载寻鹿桌面端"');
    expect(homeSource).toContain('Windows 桌面端 v{DESKTOP_RELEASE.version}');

    const footerProductBlock = siteContentSource.slice(
      siteContentSource.indexOf("title: '产品'"),
      siteContentSource.indexOf("title: '帮助'")
    );
    expect(footerProductBlock).toContain("{ label: '工作台', href: '/me' }");
    expect(footerProductBlock.lastIndexOf("label: '桌面端下载'")).toBeGreaterThan(
      footerProductBlock.lastIndexOf("label: '工作台'")
    );
    expect(footerColumns[0].links.map((item) => item.label)).toEqual([
      '通知库',
      '院校库',
      '资源库',
      'Offer 圈',
      '竞赛库',
      '工作台',
      '桌面端下载'
    ]);
    expect(sitemapSource).toContain("'/download'");
    expect(vercelIgnoreSource).toMatch(/^releases\/$/m);
  });
});
