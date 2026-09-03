import 'server-only';

import { DESKTOP_RELEASE } from '@/lib/desktop-download';

export const DESKTOP_DOWNLOAD_CUSTOM_ORIGIN = 'https://download.seekoffer.com.cn';
export const DESKTOP_DOWNLOAD_LEGACY_ORIGIN =
  'https://seekoffer-desktop-updates.vercel.app';
export const DESKTOP_DOWNLOAD_GITHUB_ORIGIN = 'https://github.com';

type DesktopDownloadPrimaryOrigin =
  | typeof DESKTOP_DOWNLOAD_CUSTOM_ORIGIN
  | typeof DESKTOP_DOWNLOAD_LEGACY_ORIGIN;

export type DesktopDownloadUrls = {
  primaryOrigin: DesktopDownloadPrimaryOrigin;
  primaryInstallerUrl: string;
  legacyInstallerUrl: string;
  githubInstallerUrl: string;
  primaryManifestUrl: string;
  legacyManifestUrl: string;
};

export type PublicDesktopRelease = {
  version: string;
  installerUrl: string;
  publishedAt: string | null;
};

type DesktopReleaseManifest = {
  version?: unknown;
  pub_date?: unknown;
  platforms?: {
    'windows-x86_64'?: {
      url?: unknown;
    };
  };
};

function isSupportedVersion(value: unknown): value is string {
  return typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value);
}

export function isOfficialInstallerUrl(value: unknown, version: string): value is string {
  if (typeof value !== 'string' || !isSupportedVersion(version)) return false;

  const releaseTag = `desktop-v${version}`;
  const installerName = `SeekOffer-Desktop-v${version}-Windows-x64-Setup.exe`;
  const artifactPath = `/artifacts/${releaseTag}/${installerName}`;

  return (
    value === `${DESKTOP_DOWNLOAD_CUSTOM_ORIGIN}${artifactPath}` ||
    value === `${DESKTOP_DOWNLOAD_LEGACY_ORIGIN}${artifactPath}` ||
    value ===
      `${DESKTOP_DOWNLOAD_GITHUB_ORIGIN}/fjsfry/seekoffer-v1/releases/download/` +
        `${releaseTag}/${installerName}`
  );
}

export function parsePublicDesktopRelease(value: unknown): PublicDesktopRelease | null {
  if (!value || typeof value !== 'object') return null;

  const manifest = value as DesktopReleaseManifest;
  const version = manifest.version;
  const installerUrl = manifest.platforms?.['windows-x86_64']?.url;

  if (!isSupportedVersion(version) || !isOfficialInstallerUrl(installerUrl, version)) {
    return null;
  }

  return {
    version,
    installerUrl,
    publishedAt: typeof manifest.pub_date === 'string' ? manifest.pub_date : null
  };
}

function resolvePrimaryOrigin(value: string | undefined): DesktopDownloadPrimaryOrigin {
  const candidate = value?.trim();

  if (candidate === DESKTOP_DOWNLOAD_CUSTOM_ORIGIN) {
    return DESKTOP_DOWNLOAD_CUSTOM_ORIGIN;
  }

  if (candidate === DESKTOP_DOWNLOAD_LEGACY_ORIGIN) {
    return DESKTOP_DOWNLOAD_LEGACY_ORIGIN;
  }

  return DESKTOP_DOWNLOAD_LEGACY_ORIGIN;
}

export function getDesktopDownloadUrls(
  configuredPrimaryOrigin = process.env.DESKTOP_DOWNLOAD_PRIMARY_ORIGIN
): DesktopDownloadUrls {
  const primaryOrigin = resolvePrimaryOrigin(configuredPrimaryOrigin);
  const artifactPath = `/artifacts/${DESKTOP_RELEASE.releaseTag}/${DESKTOP_RELEASE.installerName}`;
  const manifestPath = '/stable/latest.json';

  return {
    primaryOrigin,
    primaryInstallerUrl: `${primaryOrigin}${artifactPath}`,
    legacyInstallerUrl: `${DESKTOP_DOWNLOAD_LEGACY_ORIGIN}${artifactPath}`,
    githubInstallerUrl:
      `${DESKTOP_DOWNLOAD_GITHUB_ORIGIN}/fjsfry/seekoffer-v1/releases/download/` +
      `${DESKTOP_RELEASE.releaseTag}/${DESKTOP_RELEASE.installerName}`,
    primaryManifestUrl: `${primaryOrigin}${manifestPath}`,
    legacyManifestUrl: `${DESKTOP_DOWNLOAD_LEGACY_ORIGIN}${manifestPath}`
  };
}
