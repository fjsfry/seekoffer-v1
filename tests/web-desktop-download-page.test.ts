import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePublicDesktopRelease } from '@/lib/desktop-download';
import { PUBLISHED_DESKTOP_RELEASE } from '@/lib/desktop-public-release';

const root = process.cwd();
const downloadPageSource = readFileSync(resolve(root, 'app/download/page.tsx'), 'utf8');
const downloadActionSource = readFileSync(resolve(root, 'components/desktop-download-action.tsx'), 'utf8');
const headerSource = readFileSync(resolve(root, 'components/site-header.tsx'), 'utf8');
const homeSource = readFileSync(resolve(root, 'app/page.tsx'), 'utf8');
const siteContentSource = readFileSync(resolve(root, 'lib/site-content.ts'), 'utf8');
const sitemapSource = readFileSync(resolve(root, 'app/sitemap.ts'), 'utf8');
const vercelIgnoreSource = readFileSync(resolve(root, '.vercelignore'), 'utf8');

describe('public desktop download experience', () => {
  it('uses the verified public v0.2.26 release as the shared website source', () => {
    expect(PUBLISHED_DESKTOP_RELEASE.version).toBe('0.2.26');
    expect(PUBLISHED_DESKTOP_RELEASE.installerSizeBytes).toBe(25_633_770);
    expect(PUBLISHED_DESKTOP_RELEASE.installerUrl).toBe(
      'https://seekoffer-client-downloads.seekoffer-9268f8c5.workers.dev/files/405683bace09/SeekOffer-Desktop-v0.2.26-Windows-x64-Setup.exe'
    );
    expect(PUBLISHED_DESKTOP_RELEASE.installerSha256).toBe(
      '405683bace090365f8a84c8169b6b56b26967ca7b42c76f2a58ffdd2c7feeb27'
    );
    expect(PUBLISHED_DESKTOP_RELEASE.provenanceUrl).toContain('/provenance.json');
    expect(PUBLISHED_DESKTOP_RELEASE.checksumsUrl).toContain('/SHA256SUMS.txt');
  });

  it('accepts only the official installer shapes from a public updater manifest', () => {
    const verifiedInstallerUrl =
      'https://github.com/fjsfry/seekoffer-v1/releases/download/desktop-v0.2.22/SeekOffer-Desktop-v0.2.22-Windows-x64-Setup.exe';

    expect(
      parsePublicDesktopRelease({
        version: '0.2.22',
        pub_date: '2026-09-01T07:31:46.223Z',
        platforms: {
          'windows-x86_64': {
            url: verifiedInstallerUrl
          }
        }
      })
    ).toEqual({
      version: '0.2.22',
      installerUrl: verifiedInstallerUrl,
      publishedAt: '2026-09-01T07:31:46.223Z'
    });

    const verifiedWorkerInstallerUrl = PUBLISHED_DESKTOP_RELEASE.installerUrl;
    expect(
      parsePublicDesktopRelease({
        version: '0.2.26',
        platforms: {
          'windows-x86_64': {
            url: verifiedWorkerInstallerUrl
          }
        }
      })
    ).toEqual({
      version: '0.2.26',
      installerUrl: verifiedWorkerInstallerUrl,
      publishedAt: null
    });

    expect(
      parsePublicDesktopRelease({
        version: '0.2.26',
        platforms: {
          'windows-x86_64': {
            url: `${verifiedWorkerInstallerUrl}?download=1`
          }
        }
      })
    ).toBeNull();

    expect(
      parsePublicDesktopRelease({
        version: '0.2.26',
        platforms: {
          'windows-x86_64': {
            url: verifiedWorkerInstallerUrl.replace(
              'https://',
              'https://attacker:secret@'
            )
          }
        }
      })
    ).toBeNull();

    expect(
      parsePublicDesktopRelease({
        version: '0.2.22',
        platforms: {
          'windows-x86_64': {
            url: 'https://seekoffer-client-downloads.seekoffer-9268f8c5.workers.dev.evil.example/files/405683bace09/SeekOffer-Desktop-v0.2.26-Windows-x64-Setup.exe'
          }
        }
      })
    ).toBeNull();
  });

  it('builds a dedicated canonical download page with product value, trust and installation guidance', () => {
    expect(downloadPageSource).toContain("path: '/download'");
    expect(downloadPageSource).toContain("'@type': 'SoftwareApplication'");
    expect(downloadPageSource).toContain('<DesktopDownloadAction />');
    expect(downloadPageSource).toContain('把保研申请，');
    expect(downloadPageSource).toContain('Windows 10 / 11');
    expect(downloadPageSource).not.toContain('官方发布与安全说明');
    expect(downloadPageSource).not.toContain('查看安装安全说明');
    expect(downloadPageSource).not.toContain('data-download-surface="security"');
    expect(downloadActionSource).not.toContain('未知发布者');
    expect(downloadActionSource).not.toContain('查看安全说明');
    expect(downloadPageSource).not.toContain('GitHub');
    expect(downloadActionSource).not.toContain('GitHub');
    expect(downloadPageSource).toContain('/desktop/seekoffer-workbench-download.png');
    expect(downloadActionSource).toContain("href={PUBLISHED_DESKTOP_RELEASE.installerUrl}");
    expect(downloadActionSource).toContain('继续使用网页版');
    expect(downloadActionSource).toContain("platform === 'windows'");
    expect(downloadActionSource).toContain('复制到 Windows 电脑打开');
    expect(downloadActionSource).toContain('PUBLISHED_DESKTOP_RELEASE.pageUrl');
    expect(
      statSync(resolve(root, 'public/desktop/seekoffer-workbench-download.png')).size
    ).toBeGreaterThan(100_000);
  });

  it('keeps every structural panel pure white while preserving the site background between cards', () => {
    for (const surface of ['hero', 'hero-facts', 'benefits', 'installation', 'faq']) {
      expect(downloadPageSource).toMatch(
        new RegExp(`data-download-surface="${surface}"[\\s\\S]{0,320}bg-white`)
      );
    }
    expect(downloadPageSource).toMatch(/data-download-surface="trust"[\s\S]{0,1000}bg-white/);

    expect(downloadPageSource).not.toContain('page-hero');
    expect(downloadPageSource).not.toContain('product-card');
    expect(downloadPageSource).not.toContain('bg-slate-50/65');
    expect(downloadPageSource).not.toContain('bg-amber-50/75');
    expect(downloadPageSource).not.toContain('bg-brand/10 blur-3xl');
    expect(downloadPageSource).not.toContain('bg-brand/15 blur-3xl');
    expect(downloadPageSource).toContain('const heroFacts = [');
    expect(downloadPageSource).toContain('lg:grid-cols-5');
    expect(downloadPageSource).toContain('md:grid-cols-2');
  });

  it('places download as a utility action instead of an eighth business navigation category', () => {
    const navItemsBlock = headerSource.slice(
      headerSource.indexOf('const navItems'),
      headerSource.indexOf('export function SiteHeader')
    );

    expect(navItemsBlock).not.toContain("href: '/download'");
    expect(headerSource).toContain('aria-label="下载寻鹿桌面端"');
    expect(headerSource).toContain('下载寻鹿桌面端');
    expect(homeSource).toContain('Windows 桌面端 v{PUBLISHED_DESKTOP_RELEASE.version}');
    expect(siteContentSource).toContain("{ label: '桌面端下载', href: '/download' }");
    const footerProductBlock = siteContentSource.slice(
      siteContentSource.indexOf("title: '产品'"),
      siteContentSource.indexOf("title: '帮助'")
    );
    expect(footerProductBlock).not.toContain("label: '全部申请'");
    expect(footerProductBlock.lastIndexOf("label: '桌面端下载'")).toBeGreaterThan(
      footerProductBlock.lastIndexOf("label: 'Pro 升级'")
    );
    expect(sitemapSource).toContain("'/download'");
    expect(vercelIgnoreSource).toMatch(/^releases\/$/m);
  });
});
