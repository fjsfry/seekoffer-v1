import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {PUBLISHED_DESKTOP_RELEASE} from '../lib/desktop-public-release';
import {DESKTOP_RELEASE, parsePublicDesktopRelease} from '../lib/desktop-download';

const root = process.cwd();
const workerOrigin = 'https://seekoffer-client-downloads.seekoffer-9268f8c5.workers.dev';

describe('verified public desktop 0.2.28 download metadata', () => {
  it('advertises the exact verified installer without changing the domestic delivery host', () => {
    expect(PUBLISHED_DESKTOP_RELEASE).toMatchObject({
      version: '0.2.28', releaseDate: '2026-10-09',
      installerName: 'SeekOffer-Desktop-v0.2.28-Windows-x64-Setup.exe',
      installerSizeBytes: 25_672_873, installerSize: '24.48 MiB',
      installerSha256: '22e764449df98483d86623d13012b30efc1727d934e6db257680a112cdcc0d60',
      installerUrl: `${workerOrigin}/files/22e764449df9/SeekOffer-Desktop-v0.2.28-Windows-x64-Setup.exe`
    });
    expect(DESKTOP_RELEASE).toBe(PUBLISHED_DESKTOP_RELEASE);
    expect(PUBLISHED_DESKTOP_RELEASE.installerSize).toBe(`${(PUBLISHED_DESKTOP_RELEASE.installerSizeBytes / 1_048_576).toFixed(2)} MiB`);
    expect(PUBLISHED_DESKTOP_RELEASE.installerSizeBytes).toBeLessThan(25 * 1_048_576);
  });

  it('keeps checksum and provenance links on the existing verification service', () => {
    expect(PUBLISHED_DESKTOP_RELEASE.verificationUrl).toBe(workerOrigin);
    expect(PUBLISHED_DESKTOP_RELEASE.provenanceUrl).toBe(`${workerOrigin}/provenance.json`);
    expect(PUBLISHED_DESKTOP_RELEASE.checksumsUrl).toBe(`${workerOrigin}/SHA256SUMS.txt`);
    expect(PUBLISHED_DESKTOP_RELEASE.pageUrl).toBe('https://www.seekoffer.com.cn/download/');
    expect(PUBLISHED_DESKTOP_RELEASE.installerUrl).not.toContain('github.com');
  });

  it('accepts the immutable worker path and rejects wrong-version or altered URLs', () => {
    const manifest = {version: PUBLISHED_DESKTOP_RELEASE.version, platforms: {'windows-x86_64': {url: PUBLISHED_DESKTOP_RELEASE.installerUrl}}};
    expect(parsePublicDesktopRelease(manifest)).toEqual({version: '0.2.28', installerUrl: PUBLISHED_DESKTOP_RELEASE.installerUrl, publishedAt: null});
    expect(parsePublicDesktopRelease({...manifest, version: '0.2.26'})).toBeNull();
    expect(parsePublicDesktopRelease({...manifest, platforms: {'windows-x86_64': {url: `${PUBLISHED_DESKTOP_RELEASE.installerUrl}?download=1`}}})).toBeNull();
  });

  it('retains existing download action and page consumers of shared metadata', () => {
    const action = readFileSync(resolve(root, 'components/desktop-download-action.tsx'), 'utf8');
    const page = readFileSync(resolve(root, 'app/download/page.tsx'), 'utf8');
    expect(action).toContain('href={PUBLISHED_DESKTOP_RELEASE.installerUrl}');
    expect(action).toContain('PUBLISHED_DESKTOP_RELEASE.verificationUrl');
    expect(page).toContain('softwareVersion: DESKTOP_RELEASE.version');
    expect(page).toContain('downloadUrl: DESKTOP_RELEASE.installerUrl');
    expect(page).toContain('<DesktopDownloadAction />');
  });
});
