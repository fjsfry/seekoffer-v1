import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DESKTOP_RELEASE } from '@/lib/desktop-download';
import { footerColumns } from '@/lib/site-content';

const root = process.cwd();
const downloadPageSource = readFileSync(resolve(root, 'app/download/page.tsx'), 'utf8');
const downloadActionSource = readFileSync(
  resolve(root, 'components/desktop-download-action.tsx'),
  'utf8'
);
const downloadAttemptClientSource = readFileSync(
  resolve(root, 'lib/client/desktop-download-attempt.ts'),
  'utf8'
);
const desktopReleaseSource = readFileSync(resolve(root, 'lib/desktop-download.ts'), 'utf8');
const headerSource = readFileSync(resolve(root, 'components/site-header.tsx'), 'utf8');
const homeSource = readFileSync(resolve(root, 'app/page.tsx'), 'utf8');
const siteContentSource = readFileSync(resolve(root, 'lib/site-content.ts'), 'utf8');
const sitemapSource = readFileSync(resolve(root, 'app/sitemap.ts'), 'utf8');
const vercelIgnoreSource = readFileSync(resolve(root, '.vercelignore'), 'utf8');

describe('desktop-only addition to the production website baseline', () => {
  it('uses verified public v0.2.22 metadata without exposing delivery origins', () => {
    expect(DESKTOP_RELEASE.version).toBe('0.2.22');
    expect(DESKTOP_RELEASE.installerSizeBytes).toBe(33_674_743);
    expect(DESKTOP_RELEASE.installerSha256).toMatch(/^[A-F0-9]{64}$/);
    expect('installerUrl' in DESKTOP_RELEASE).toBe(false);
    expect('manifestUrl' in DESKTOP_RELEASE).toBe(false);
    expect(desktopReleaseSource).not.toContain('process.env');
    expect(desktopReleaseSource).not.toContain('seekoffer-desktop-updates.vercel.app');
    expect(desktopReleaseSource).not.toContain('download.seekoffer.com.cn');
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
    expect(downloadActionSource).toContain("const canOfferWindowsDownload = platform !== 'other'");
    expect(downloadActionSource).toContain("const PERMANENT_DOWNLOAD_PATH = '/download/windows/latest/'");
    expect(downloadActionSource).toContain("const BACKUP_DOWNLOAD_PATH = '/download/windows/github/'");
    expect(downloadActionSource).toContain('href={PERMANENT_DOWNLOAD_PATH}');
    expect(downloadActionSource).toContain('href={BACKUP_DOWNLOAD_PATH}');
    expect(downloadActionSource).toContain('target="_blank"');
    expect(downloadActionSource).toContain('rel="noopener noreferrer"');
    expect(downloadActionSource).toContain('onClick={handleDownloadClick}');
    expect(downloadActionSource).toContain('queueDesktopDownloadAttempt()');
    expect(downloadActionSource).toContain('在新标签页打开');
    expect(downloadActionSource).toContain('已发起下载请求，请查看新标签页');
    expect(downloadActionSource).toContain('https://www.seekoffer.com.cn/download/windows/latest');
    expect(downloadActionSource).not.toContain('<form');
    expect(downloadActionSource).not.toContain('/api/desktop-download/windows/');
    expect(downloadActionSource).not.toContain('下载已开始');
    expect(downloadActionSource).not.toContain('window.open');
    expect(downloadActionSource).not.toContain('preventDefault');
    expect(downloadActionSource).not.toContain('@/lib/server/');
    expect(downloadActionSource).not.toContain('seekoffer-desktop-updates.vercel.app');
    expect(downloadActionSource).not.toContain('download.seekoffer.com.cn/artifacts/');
    expect(downloadActionSource).not.toMatch(/<a[\s\S]{0,240}\sdownload(?:=|\s|>)/);
    expect(downloadAttemptClientSource).toContain('window.navigator.sendBeacon.bind');
    expect(downloadAttemptClientSource).toContain('keepalive: true');
    expect(downloadAttemptClientSource).not.toMatch(/await\s+transport\.fetcher/);
    expect(downloadPageSource).toContain(
      "downloadUrl: absoluteUrl('/download/windows/latest')"
    );
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

  it('describes the limited desktop download metric accurately in the privacy policy', () => {
    const privacySource = readFileSync(resolve(root, 'app/privacy/page.tsx'), 'utf8');

    expect(privacySource).toContain('更新日期：2026 年 9 月 3 日');
    expect(privacySource).toContain('仅记录按钮发起时间、桌面端版本和设备平台');
    expect(privacySource).toContain('不保存 IP 地址、账号信息或任何申请内容');
    expect(privacySource).toContain('不代表安装包下载完成或软件安装完成');
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
