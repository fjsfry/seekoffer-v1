import { describe, expect, it } from 'vitest';
import {
  assertNoReleaseSecretLeak,
  assertStableDesktopUpgrade,
  buildDesktopArtifactUrl,
  compareStableDesktopVersions,
  createDesktopUpdateManifest,
  validateDesktopUpdateAssetBaseUrl,
  validateDesktopReleaseTag,
  validateDesktopUpdateManifest,
  validateReleaseChannel
} from '../scripts/desktop-update-manifest.mjs';

const signature =
  'untrusted comment: signature from minisign secret key\nRWQ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN';

describe('desktop updater release contracts', () => {
  it('creates a Tauri static manifest with an immutable GitHub tag URL', () => {
    const url = buildDesktopArtifactUrl({
      repository: 'fjsfry/seekoffer-v1',
      tag: 'desktop-v0.3.0',
      installerName: 'SeekOffer-Desktop-v0.3.0-Windows-x64-Setup.exe'
    });
    const manifest = createDesktopUpdateManifest({
      version: '0.3.0',
      notes: 'Release notes',
      pubDate: '2026-08-10T12:00:00.000Z',
      artifactUrl: url,
      signature
    });

    expect(url).toBe(
      'https://github.com/fjsfry/seekoffer-v1/releases/download/desktop-v0.3.0/SeekOffer-Desktop-v0.3.0-Windows-x64-Setup.exe'
    );
    expect(() =>
      validateDesktopUpdateManifest(manifest, {
        expectedVersion: '0.3.0',
        expectedUrl: url,
        expectedSignature: signature
      })
    ).not.toThrow();
  });

  it.each([
    [
      'current repository GitHub releases',
      'https://github.com/fjsfry/seekoffer-v1/releases/download/',
      'https://github.com/fjsfry/seekoffer-v1/releases/download/desktop-v0.3.0/SeekOffer-Desktop-v0.3.0-Windows-x64-Setup.exe'
    ],
    [
      'SeekOffer custom download domain',
      'https://download.seekoffer.com.cn/artifacts/',
      'https://download.seekoffer.com.cn/artifacts/desktop-v0.3.0/SeekOffer-Desktop-v0.3.0-Windows-x64-Setup.exe'
    ],
    [
      'legacy Vercel updater domain',
      'https://seekoffer-desktop-updates.vercel.app/artifacts/',
      'https://seekoffer-desktop-updates.vercel.app/artifacts/desktop-v0.3.0/SeekOffer-Desktop-v0.3.0-Windows-x64-Setup.exe'
    ]
  ])('supports the allowlisted %s asset base', (_label, assetBaseUrl, expectedUrl) => {
    expect(validateDesktopUpdateAssetBaseUrl(assetBaseUrl)).toBe(assetBaseUrl);
    expect(
      buildDesktopArtifactUrl({
        repository: 'fjsfry/seekoffer-v1',
        tag: 'desktop-v0.3.0',
        installerName: 'SeekOffer-Desktop-v0.3.0-Windows-x64-Setup.exe',
        assetBaseUrl
      })
    ).toBe(expectedUrl);
  });

  it.each([
    ['arbitrary HTTPS host', 'https://downloads.example.com/seekoffer/'],
    ['credentials', 'https://token@download.seekoffer.com.cn/artifacts/'],
    ['explicit port', 'https://download.seekoffer.com.cn:443/artifacts/'],
    ['query', 'https://download.seekoffer.com.cn/artifacts/?source=release'],
    ['fragment', 'https://download.seekoffer.com.cn/artifacts/#release'],
    ['wrong path', 'https://download.seekoffer.com.cn/releases/'],
    ['missing trailing slash', 'https://download.seekoffer.com.cn/artifacts'],
    [
      'wrong GitHub repository',
      'https://github.com/example/seekoffer-v1/releases/download/'
    ],
    ['HTTP', 'http://download.seekoffer.com.cn/artifacts/']
  ])('rejects a non-canonical asset base with %s', (_label, assetBaseUrl) => {
    expect(() =>
      buildDesktopArtifactUrl({
        repository: 'fjsfry/seekoffer-v1',
        tag: 'desktop-v0.3.0',
        installerName: 'SeekOffer-Desktop-v0.3.0-Windows-x64-Setup.exe',
        assetBaseUrl
      })
    ).toThrow(/官方更新资产基址/);
  });

  it('rejects an implicit GitHub base for any repository other than seekoffer-v1', () => {
    expect(() =>
      buildDesktopArtifactUrl({
        repository: 'example/seekoffer-v1',
        tag: 'desktop-v0.3.0',
        installerName: 'SeekOffer-Desktop-v0.3.0-Windows-x64-Setup.exe'
      })
    ).toThrow(/官方更新资产基址/);
  });

  it('enforces exact tag/version and stable/beta SemVer boundaries', () => {
    expect(
      validateDesktopReleaseTag('desktop-v0.3.0', '0.3.0', { required: true })
    ).toBe('desktop-v0.3.0');
    expect(() =>
      validateDesktopReleaseTag('desktop-v0.3.1', '0.3.0', { required: true })
    ).toThrow(/desktop-v0\.3\.0/);
    expect(() => validateReleaseChannel('stable', '0.4.0-beta.1')).toThrow();
    expect(() => validateReleaseChannel('beta', '0.4.0')).toThrow();
    expect(validateReleaseChannel('beta', '0.4.0-beta.1')).toBe('beta');
  });

  it('enforces monotonic Stable version promotion', () => {
    expect(assertStableDesktopUpgrade('0.2.22', '0.2.21')).toEqual({
      candidate: '0.2.22',
      current: '0.2.21'
    });
    expect(compareStableDesktopVersions('0.2.20', '0.2.19')).toBe(1);
    expect(compareStableDesktopVersions('1.0.0+build.2', '1.0.0+build.1')).toBe(0);
    expect(assertStableDesktopUpgrade('0.2.20', '0.2.19')).toEqual({
      candidate: '0.2.20',
      current: '0.2.19'
    });
    expect(() => assertStableDesktopUpgrade('0.2.19', '0.2.19')).toThrow(
      /单调递增/
    );
    expect(() => assertStableDesktopUpgrade('0.2.18', '0.2.19')).toThrow(
      /单调递增/
    );
    expect(() => assertStableDesktopUpgrade('0.3.0-beta.1', '0.2.19')).toThrow(
      /Stable/
    );
  });

  it('refuses to serialize updater or certificate private secret values', () => {
    expect(() =>
      assertNoReleaseSecretLeak('prefix super-secret-value suffix', {
        TAURI_SIGNING_PRIVATE_KEY: 'super-secret-value'
      })
    ).toThrow(/TAURI_SIGNING_PRIVATE_KEY/);
    expect(() =>
      assertNoReleaseSecretLeak('-----BEGIN PRIVATE KEY-----\nsecret')
    ).toThrow(/私钥/);
    expect(() =>
      assertNoReleaseSecretLeak(
        'untrusted comment: minisign encrypted secret key\nRWQprivate'
      )
    ).toThrow(/私钥/);
    expect(() => assertNoReleaseSecretLeak(signature)).not.toThrow();
  });

  it('rejects manifests with an external signature URL instead of signature content', () => {
    expect(() =>
      validateDesktopUpdateManifest({
        version: '0.3.0',
        platforms: {
          'windows-x86_64': {
            url: 'https://downloads.example.com/desktop-v0.3.0/setup.exe',
            signature: 'https://downloads.example.com/desktop-v0.3.0/setup.exe.sig'
          }
        }
      })
    ).toThrow(/签名/);
  });
});
