export const DESKTOP_RELEASE = {
  version: '0.2.22',
  releaseDate: '2026-09-01',
  releaseTag: 'desktop-v0.2.22',
  installerName: 'SeekOffer-Desktop-v0.2.22-Windows-x64-Setup.exe',
  installerSize: '32.1 MB',
  installerSizeBytes: 33_674_743,
  installerSha256: '34FD53CD2880EC4D254AF7532166926B474C6AC7CE9C0B8F4D39E97C8A99B4F8',
  signatureSha256: 'CDC7EE03AD596B20A338CE94C4F521B7C1FC738AE7589C3677E3F4D29B966238',
  manifestUrl: 'https://seekoffer-desktop-updates.vercel.app/stable/latest.json',
  installerUrl:
    'https://seekoffer-desktop-updates.vercel.app/artifacts/desktop-v0.2.22/SeekOffer-Desktop-v0.2.22-Windows-x64-Setup.exe'
} as const;

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
    const expectedPath =
      `/fjsfry/seekoffer-v1/releases/download/desktop-v${version}/` +
      `SeekOffer-Desktop-v${version}-Windows-x64-Setup.exe`;

    return url.protocol === 'https:' && url.hostname === 'github.com' && url.pathname === expectedPath;
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
