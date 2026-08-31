import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyBuildTargetIsolation } from '../scripts/verify-build-target-isolation.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temporaryDirectories = [];

async function createStaticExport({ target, leakDesktop = false }) {
  const directory = await mkdtemp(path.join(tmpdir(), `seekoffer-${target}-surface-`));
  temporaryDirectories.push(directory);
  const staticDirectory = path.join(directory, '_next', 'static');
  await mkdir(staticDirectory, { recursive: true });

  const desktopHtml = target === 'desktop'
    ? ' class="seekoffer-desktop-surface"><script id="desktop-preference-bootstrap"'
    : '><script';
  const desktopCss = target === 'desktop' || leakDesktop
    ? '.desktop-titlebar{}.desktop-primary-nav-item{}.desktop-update-toast{}'
    : '.site-shell{}';
  const desktopJs = target === 'desktop' || leakDesktop
    ? '"desktop_frontend_ready";"desktop-app-shell";"desktop-update-toast";'
    : '"site-shell";';

  await Promise.all([
    writeFile(
      path.join(directory, 'index.html'),
      `<html${desktopHtml}></script><link rel="stylesheet" href="/_next/static/app.css"><script src="/_next/static/app.js"></script></html>`,
      'utf8'
    ),
    writeFile(path.join(staticDirectory, 'app.css'), desktopCss, 'utf8'),
    writeFile(path.join(staticDirectory, 'app.js'), desktopJs, 'utf8')
  ]);

  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

describe('desktop build target isolation', () => {
  it('keeps the root layout target-neutral and owns desktop imports in the aliased surface', async () => {
    const [layout, webSurface, desktopSurface, nextConfig, desktopRunner, packageRaw] = await Promise.all([
      readFile(path.join(root, 'app', 'layout.tsx'), 'utf8'),
      readFile(path.join(root, 'app', 'build-surface.tsx'), 'utf8'),
      readFile(path.join(root, 'app', 'build-surface.desktop.tsx'), 'utf8'),
      readFile(path.join(root, 'next.config.mjs'), 'utf8'),
      readFile(path.join(root, 'scripts', 'run-desktop-next.mjs'), 'utf8'),
      readFile(path.join(root, 'package.json'), 'utf8')
    ]);

    expect(layout).toContain("from 'seekoffer-build-surface'");
    expect(layout).toContain("import './globals.css'");
    expect(layout).not.toContain("import './desktop");
    expect(layout).not.toContain("from '@/components/desktop");

    expect(webSurface).toContain('AuthActionBridge');
    expect(webSurface).toContain('VisitorPresenceTracker');
    expect(webSurface).not.toContain('DesktopAppShell');
    expect(webSurface).not.toContain("import './desktop");

    const globalDesktopCssImports = desktopSurface.match(/import '\.\/desktop[^']*\.css';/g) || [];
    expect(globalDesktopCssImports).toHaveLength(11);
    expect(desktopSurface).toContain('DesktopAppShell');
    expect(desktopSurface).toContain('DesktopAuthGate');
    expect(desktopSurface).toContain('DesktopUpdateProvider');

    expect(nextConfig).toContain("process.env.SEEKOFFER_BUILD_TARGET");
    expect(nextConfig).toContain("'seekoffer-build-surface': buildSurfaceRelativeModule");
    expect(nextConfig).toContain("config.resolve.alias['seekoffer-build-surface'] = buildSurfaceModule");
    expect(desktopRunner).toContain("childEnv.SEEKOFFER_BUILD_TARGET = 'desktop'");
    expect(desktopRunner).toContain('verifyBuildTargetIsolation({');
    const packageScripts = JSON.parse(packageRaw).scripts;
    expect(packageScripts.dev).toContain(
      'SEEKOFFER_BUILD_TARGET=web NEXT_PUBLIC_SEEKOFFER_SURFACE=web next dev'
    );
    expect(packageScripts.build).toContain(
      'SEEKOFFER_BUILD_TARGET=web NEXT_PUBLIC_SEEKOFFER_SURFACE=web next build'
    );
    expect(packageScripts.build).toContain(
      'verify-build-target-isolation.mjs web .next-web'
    );
  });

  it('accepts isolated web and desktop static exports', async () => {
    const [webDirectory, desktopDirectory] = await Promise.all([
      createStaticExport({ target: 'web' }),
      createStaticExport({ target: 'desktop' })
    ]);

    expect(
      verifyBuildTargetIsolation({ target: 'web', distDirectory: webDirectory })
    ).toMatchObject({ target: 'web', htmlFiles: 1, cssAssets: 1, jsAssets: 1 });
    expect(
      verifyBuildTargetIsolation({ target: 'desktop', distDirectory: desktopDirectory })
    ).toMatchObject({ target: 'desktop', htmlFiles: 1, cssAssets: 1, jsAssets: 1 });
  });

  it('rejects desktop shell, auth, update and global-style markers in a web export', async () => {
    const webDirectory = await createStaticExport({ target: 'web', leakDesktop: true });

    expect(() =>
      verifyBuildTargetIsolation({ target: 'web', distDirectory: webDirectory })
    ).toThrow(/web (CSS|JS) 产物泄漏了桌面标记/);
  });
});
