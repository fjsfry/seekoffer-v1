import { PUBLISHED_DESKTOP_RELEASE } from './desktop-public-release';

// Compatibility export for callers that still use the old name. All public
// website surfaces should import PUBLISHED_DESKTOP_RELEASE directly.
export const DESKTOP_RELEASE = PUBLISHED_DESKTOP_RELEASE;

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

function isOfficialInstallerUrl(value: unknown, version: string): value is string {
  if (typeof value !== 'string') return false;

  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return false;
    }

    const installerName = `SeekOffer-Desktop-v${version}-Windows-x64-Setup.exe`;
    if (url.hostname === 'github.com') {
      return (
        url.pathname ===
        `/fjsfry/seekoffer-v1/releases/download/desktop-v${version}/${installerName}`
      );
    }

    if (url.hostname === 'seekoffer-desktop-updates.vercel.app') {
      return url.pathname === `/artifacts/desktop-v${version}/${installerName}`;
    }

    if (url.hostname === 'seekoffer-client-downloads.seekoffer-9268f8c5.workers.dev') {
      const pathParts = url.pathname.split('/');
      return (
        pathParts.length === 4 &&
        pathParts[1] === 'files' &&
        /^[0-9a-f]{12}$/.test(pathParts[2]) &&
        pathParts[3] === installerName
      );
    }

    return false;
  } catch {
    return false;
  }
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
