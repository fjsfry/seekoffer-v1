import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_RELEASE } from '@/lib/desktop-download';

vi.mock('server-only', () => ({}));

import {
  DESKTOP_DOWNLOAD_CUSTOM_ORIGIN,
  DESKTOP_DOWNLOAD_LEGACY_ORIGIN,
  getDesktopDownloadUrls,
  isOfficialInstallerUrl,
  parsePublicDesktopRelease
} from '@/lib/server/desktop-download-urls';
import * as githubRoute from '@/app/download/windows/github/route';
import * as latestRoute from '@/app/download/windows/latest/route';
import * as legacyRoute from '@/app/download/windows/legacy/route';

const version = DESKTOP_RELEASE.version;
const installerName = DESKTOP_RELEASE.installerName;
const artifactPath = `/artifacts/desktop-v${version}/${installerName}`;
const customInstallerUrl = `${DESKTOP_DOWNLOAD_CUSTOM_ORIGIN}${artifactPath}`;
const legacyInstallerUrl = `${DESKTOP_DOWNLOAD_LEGACY_ORIGIN}${artifactPath}`;
const githubInstallerUrl =
  `https://github.com/fjsfry/seekoffer-v1/releases/download/desktop-v${version}/` +
  installerName;
const originalPrimaryOrigin = process.env.DESKTOP_DOWNLOAD_PRIMARY_ORIGIN;

function expectPermanentRedirect(response: Response, location: string) {
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toBe(location);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
}

afterEach(() => {
  if (originalPrimaryOrigin === undefined) {
    delete process.env.DESKTOP_DOWNLOAD_PRIMARY_ORIGIN;
  } else {
    process.env.DESKTOP_DOWNLOAD_PRIMARY_ORIGIN = originalPrimaryOrigin;
  }
});

describe('desktop download URL policy', () => {
  it.each([customInstallerUrl, legacyInstallerUrl, githubInstallerUrl])(
    'accepts the exact official installer URL %s',
    (installerUrl) => {
      expect(isOfficialInstallerUrl(installerUrl, version)).toBe(true);
      expect(
        parsePublicDesktopRelease({
          version,
          pub_date: '2026-09-01T07:31:46.223Z',
          platforms: {
            'windows-x86_64': { url: installerUrl }
          }
        })
      ).toEqual({
        version,
        installerUrl,
        publishedAt: '2026-09-01T07:31:46.223Z'
      });
    }
  );

  it.each([
    `http://download.seekoffer.com.cn${artifactPath}`,
    `https://download.seekoffer.com.cn:443${artifactPath}`,
    `https://user@download.seekoffer.com.cn${artifactPath}`,
    `https://download.seekoffer.com.cn.evil.example${artifactPath}`,
    `${customInstallerUrl}?source=website`,
    `${customInstallerUrl}#download`,
    `${customInstallerUrl}/`,
    customInstallerUrl.replace('desktop-v0.2.22', 'desktop-v0.2.21'),
    customInstallerUrl.replace(installerName, 'SeekOffer-Desktop-v0.2.22-Windows-arm64-Setup.exe'),
    githubInstallerUrl.replace('/fjsfry/seekoffer-v1/', '/attacker/seekoffer-v1/'),
    githubInstallerUrl.replace('/desktop-v0.2.22/', '/v0.2.22/'),
    githubInstallerUrl.replace('SeekOffer-', 'SeekOffer%2D')
  ])('rejects a non-canonical or untrusted installer URL %s', (installerUrl) => {
    expect(isOfficialInstallerUrl(installerUrl, version)).toBe(false);
    expect(
      parsePublicDesktopRelease({
        version,
        platforms: {
          'windows-x86_64': { url: installerUrl }
        }
      })
    ).toBeNull();
  });

  it('generates all installer and manifest URLs from version metadata', () => {
    expect(getDesktopDownloadUrls(DESKTOP_DOWNLOAD_CUSTOM_ORIGIN)).toEqual({
      primaryOrigin: DESKTOP_DOWNLOAD_CUSTOM_ORIGIN,
      primaryInstallerUrl: customInstallerUrl,
      legacyInstallerUrl,
      githubInstallerUrl,
      primaryManifestUrl: `${DESKTOP_DOWNLOAD_CUSTOM_ORIGIN}/stable/latest.json`,
      legacyManifestUrl: `${DESKTOP_DOWNLOAD_LEGACY_ORIGIN}/stable/latest.json`
    });
  });

  it.each([
    '',
    'https://download.seekoffer.com.cn/',
    'http://download.seekoffer.com.cn',
    'https://download.seekoffer.com.cn.evil.example',
    'https://github.com',
    'javascript:alert(1)'
  ])('safely falls back to the legacy origin for an unset or invalid value %s', (value) => {
    const urls = getDesktopDownloadUrls(value);

    expect(urls.primaryOrigin).toBe(DESKTOP_DOWNLOAD_LEGACY_ORIGIN);
    expect(urls.primaryInstallerUrl).toBe(legacyInstallerUrl);
    expect(urls.primaryManifestUrl).toBe(
      `${DESKTOP_DOWNLOAD_LEGACY_ORIGIN}/stable/latest.json`
    );
  });

  it('allows the explicit legacy origin during the compatibility window', () => {
    const urls = getDesktopDownloadUrls(DESKTOP_DOWNLOAD_LEGACY_ORIGIN);

    expect(urls.primaryOrigin).toBe(DESKTOP_DOWNLOAD_LEGACY_ORIGIN);
    expect(urls.primaryInstallerUrl).toBe(legacyInstallerUrl);
  });
});

describe('permanent desktop download routes', () => {
  it('uses the legacy origin by default until the custom domain is enabled', () => {
    delete process.env.DESKTOP_DOWNLOAD_PRIMARY_ORIGIN;

    expectPermanentRedirect(latestRoute.GET(), legacyInstallerUrl);
  });

  it('uses the custom origin only when it is explicitly configured', () => {
    process.env.DESKTOP_DOWNLOAD_PRIMARY_ORIGIN = DESKTOP_DOWNLOAD_CUSTOM_ORIGIN;

    expectPermanentRedirect(latestRoute.GET(), customInstallerUrl);
  });

  it('falls back safely when the configured origin is not allowlisted', () => {
    process.env.DESKTOP_DOWNLOAD_PRIMARY_ORIGIN = 'https://downloads.example.com';

    expectPermanentRedirect(latestRoute.GET(), legacyInstallerUrl);
  });

  it('ignores query parameters instead of becoming an open redirect', () => {
    process.env.DESKTOP_DOWNLOAD_PRIMARY_ORIGIN = DESKTOP_DOWNLOAD_CUSTOM_ORIGIN;
    const invoke = latestRoute.GET as unknown as (request: Request) => Response;
    const response = invoke(
      new Request(
        'https://www.seekoffer.com.cn/download/windows/latest/?url=https://evil.example'
      )
    );

    expectPermanentRedirect(response, customInstallerUrl);
  });

  it('keeps GitHub and legacy as fixed independent fallback routes', () => {
    process.env.DESKTOP_DOWNLOAD_PRIMARY_ORIGIN = DESKTOP_DOWNLOAD_CUSTOM_ORIGIN;

    expectPermanentRedirect(githubRoute.GET(), githubInstallerUrl);
    expectPermanentRedirect(legacyRoute.GET(), legacyInstallerUrl);
  });

  it.each([
    ['latest', latestRoute],
    ['github', githubRoute],
    ['legacy', legacyRoute]
  ])('does not expose a POST handler from the %s GET route', (_name, route) => {
    expect('POST' in route).toBe(false);
  });

  it('documents the server-only primary origin switch', () => {
    const envExample = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');

    expect(envExample).toContain('DESKTOP_DOWNLOAD_PRIMARY_ORIGIN=');
    expect(envExample).toContain('Leave empty until download.seekoffer.com.cn is verified');
  });
});
