import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const masterIconPath = resolve(root, 'public/desktop/seekoffer-app-icon-v2.png');
const tauriIconsDirectory = resolve(root, 'src-tauri/icons');

async function readCornerAlphas(path: string) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alphaAt = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3];

  return {
    info,
    corners: [
      alphaAt(0, 0),
      alphaAt(info.width - 1, 0),
      alphaAt(0, info.height - 1),
      alphaAt(info.width - 1, info.height - 1)
    ],
    center: alphaAt(Math.floor(info.width / 2), Math.floor(info.height / 2))
  };
}

describe('desktop application icon assets', () => {
  it('keeps a high-resolution rounded-square master with transparent outer corners', async () => {
    const metadata = await sharp(masterIconPath).metadata();
    const alpha = await readCornerAlphas(masterIconPath);

    expect(metadata.width).toBe(metadata.height);
    expect(metadata.width).toBeGreaterThanOrEqual(1024);
    expect(metadata.hasAlpha).toBe(true);
    expect(alpha.corners).toEqual([0, 0, 0, 0]);
    expect(alpha.center).toBe(255);
  });

  it('exports the rounded master to every Windows bundle icon declared by Tauri', async () => {
    const tauriConfig = JSON.parse(
      readFileSync(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8')
    ) as {
      bundle: {
        icon: string[];
        windows: { nsis: { installerIcon: string } };
      };
    };
    const declaredIcons = tauriConfig.bundle.icon;

    expect(declaredIcons).toEqual(
      expect.arrayContaining([
        'icons/32x32.png',
        'icons/128x128.png',
        'icons/128x128@2x.png',
        'icons/icon.icns',
        'icons/icon.ico'
      ])
    );
    expect(tauriConfig.bundle.windows.nsis.installerIcon).toBe('icons/icon.ico');

    for (const relativePath of declaredIcons) {
      expect(statSync(resolve(root, 'src-tauri', relativePath)).size, relativePath).toBeGreaterThan(256);
    }

    const smallIcon = await readCornerAlphas(resolve(tauriIconsDirectory, '32x32.png'));
    expect(smallIcon.info.width).toBe(32);
    expect(smallIcon.info.height).toBe(32);
    expect(smallIcon.corners).toEqual([0, 0, 0, 0]);
    expect(smallIcon.center).toBe(255);
  });
});
