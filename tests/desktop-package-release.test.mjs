import { spawnSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  utimes,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '..');
const packagingScriptSource = await readFile(
  path.join(projectRoot, 'scripts', 'package-desktop-release.mjs'),
  'utf8'
);
const updateManifestHelperSource = await readFile(
  path.join(projectRoot, 'scripts', 'desktop-update-manifest.mjs'),
  'utf8'
);
const updaterSignatureVerifierSource = await readFile(
  path.join(projectRoot, 'src-tauri', 'examples', 'verify_updater_signature.rs'),
  'utf8'
);
const MINISIGN_PUBLIC_KEY_TEXT = [
  'untrusted comment: minisign public key',
  'RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3',
  ''
].join('\n');
const MINISIGN_SIGNATURE_TEXT = [
  'untrusted comment: signature from minisign secret key',
  'RWQf6LRCGA9i59SLOFxz6NxvASXDJeRtuZykwQepbDEGt87ig1BNpWaVWuNrm73YiIiJbq71Wi+dP9eKL8OC351vwIasSSbXxwA=',
  'trusted comment: timestamp:1555779966\tfile:test',
  'QtKMXWyYcwdpZAlPF7tE2ENJkRd1ujvKjlj1m9RtHTBnZPa5WKU5uWRs5GoP5M/VqE81QFuMKI5k/SfNQUaOAA=='
].join('\n');
const TAURI_PUBLIC_KEY = Buffer.from(MINISIGN_PUBLIC_KEY_TEXT, 'utf8').toString(
  'base64'
);
const TAURI_SIGNATURE = Buffer.from(MINISIGN_SIGNATURE_TEXT, 'utf8').toString(
  'base64'
);
const temporaryRoots = [];

async function writeFixtureFile(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
  return filePath;
}

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'seekoffer-desktop-package-'));
  temporaryRoots.push(root);

  const inputFiles = await Promise.all([
    writeFixtureFile(
      root,
      'package.json',
      `${JSON.stringify({
        name: 'seekoffer-package-test',
        version: '0.2.5',
        homepage: 'https://example.com'
      })}\n`
    ),
    writeFixtureFile(root, 'package-lock.json', '{}\n'),
    writeFixtureFile(root, 'next.config.mjs', 'export default {};\n'),
    writeFixtureFile(root, 'tsconfig.json', '{}\n'),
    writeFixtureFile(
      root,
      'src-tauri/tauri.conf.json',
      `${JSON.stringify({
        productName: 'SeekOffer Test',
        version: '0.2.5',
        identifier: 'com.seekoffer.test',
        bundle: {
          createUpdaterArtifacts: true,
          publisher: 'SeekOffer',
          windows: {
            nsis: {
              installerHooks: './windows/installer-hooks.nsh',
              installerIcon: 'icons/icon.ico',
              uninstallerIcon: 'icons/icon.ico',
              headerImage: 'windows/assets/installer-header.bmp',
              uninstallerHeaderImage: 'windows/assets/installer-header.bmp',
              sidebarImage: 'windows/assets/installer-sidebar.bmp',
              customLanguageFiles: {
                SimpChinese: './windows/languages/SimpChinese.nsh',
                English: './windows/languages/English.nsh'
              }
            }
          }
        },
        plugins: {
          updater: {
            pubkey: TAURI_PUBLIC_KEY
          }
        }
      })}\n`
    ),
    writeFixtureFile(
      root,
      'src-tauri/tauri.release.conf.json',
      '{"build":{"beforeBuildCommand":""}}\n'
    ),
    writeFixtureFile(
      root,
      'src-tauri/Cargo.toml',
      [
        '[package]',
        'name = "seekoffer-desktop"',
        'version = "0.2.5"',
        'edition = "2021"',
        '',
        '[dev-dependencies]',
        'base64 = "0.22.1"',
        'minisign-verify = "0.2.5"',
        ''
      ].join('\n')
    ),
    writeFixtureFile(
      root,
      'src-tauri/Cargo.lock',
      [
        'version = 4',
        '',
        '[[package]]',
        'name = "base64"',
        'version = "0.22.1"',
        'source = "registry+https://github.com/rust-lang/crates.io-index"',
        'checksum = "72b3254f16251a8381aa12e40e3c4d2f0199f8c6508fbecb9d91f575e0fbb8c6"',
        '',
        '[[package]]',
        'name = "minisign-verify"',
        'version = "0.2.5"',
        'source = "registry+https://github.com/rust-lang/crates.io-index"',
        'checksum = "22f9645cb765ea72b8111f36c522475d2daa0d22c957a9826437e97534bc4e9e"',
        '',
        '[[package]]',
        'name = "seekoffer-desktop"',
        'version = "0.2.5"',
        'dependencies = [',
        ' "base64",',
        ' "minisign-verify",',
        ']',
        ''
      ].join('\n')
    ),
    writeFixtureFile(root, 'src-tauri/build.rs', 'fn main() {}\n'),
    writeFixtureFile(
      root,
      'src-tauri/examples/verify_updater_signature.rs',
      updaterSignatureVerifierSource
    ),
    writeFixtureFile(
      root,
      'src-tauri/windows/installer-hooks.nsh',
      '!macro NSIS_HOOK_PREUNINSTALL\n!macroend\n'
    ),
    writeFixtureFile(root, 'src-tauri/icons/icon.ico', 'test icon'),
    writeFixtureFile(
      root,
      'src-tauri/windows/assets/installer-header.bmp',
      'test header'
    ),
    writeFixtureFile(
      root,
      'src-tauri/windows/assets/installer-sidebar.bmp',
      'test sidebar'
    ),
    writeFixtureFile(
      root,
      'src-tauri/windows/languages/SimpChinese.nsh',
      'LangString createDesktop ${LANG_SIMPCHINESE} "创建快捷方式"\n'
    ),
    writeFixtureFile(
      root,
      'src-tauri/windows/languages/English.nsh',
      'LangString createDesktop ${LANG_ENGLISH} "Create shortcut"\n'
    ),
    writeFixtureFile(
      root,
      'src-tauri/windows/generate-installer-assets.mjs',
      '// fixture asset generator\n'
    ),
    writeFixtureFile(
      root,
      'scripts/desktop-auth-config.mjs',
      [
        'export async function resolveDesktopAuthConfig() { return {}; }',
        'export async function verifyDesktopAuthExport() {}',
        ''
      ].join('\n')
    ),
    writeFixtureFile(
      root,
      'scripts/prepare-windows-signing-certificate.ps1',
      '# fixture Authenticode preparation\n'
    ),
    writeFixtureFile(
      root,
      'scripts/sign-windows-artifact.ps1',
      '# fixture Authenticode signer\n'
    ),
    writeFixtureFile(
      root,
      'scripts/invoke-desktop-signed-release.ps1',
      '# fixture local release helper\n'
    ),
    writeFixtureFile(
      root,
      '.github/workflows/desktop-release.yml',
      'name: fixture desktop release\n'
    ),
    writeFixtureFile(root, 'scripts/run-desktop-next.mjs', ''),
    writeFixtureFile(root, 'scripts/verify-build-target-isolation.mjs', ''),
    writeFixtureFile(root, 'scripts/verify-desktop-auth-export.mjs', ''),
    writeFixtureFile(
      root,
      'scripts/desktop-update-manifest.mjs',
      updateManifestHelperSource
    ),
    writeFixtureFile(root, 'scripts/package-desktop-release.mjs', packagingScriptSource)
  ]);

  await Promise.all(
    [
      'app',
      'components',
      'lib',
      'public',
      'src-tauri/capabilities',
      'src-tauri/icons',
      'src-tauri/src',
      '.next-desktop'
    ].map((relativePath) => mkdir(path.join(root, relativePath), { recursive: true }))
  );

  await Promise.all([
    writeFixtureFile(root, 'docs/releases/desktop-v0.2.5.md', '# Release\n'),
    writeFixtureFile(root, 'docs/releases/desktop-install.zh-CN.md', '# Install\n'),
    writeFixtureFile(root, 'docs/design-qa/desktop-app-v0.2.5.md', '# QA\n')
  ]);

  const installerPath = await writeFixtureFile(
    root,
    'src-tauri/target/release/bundle/nsis/SeekOffer Test_0.2.5_x64-setup.exe',
    'test'
  );
  const signaturePath = await writeFixtureFile(
    root,
    'src-tauri/target/release/bundle/nsis/SeekOffer Test_0.2.5_x64-setup.exe.sig',
    `${TAURI_SIGNATURE}\n`
  );
  const oldTime = new Date(Date.now() - 60_000);
  const installerTime = new Date(Date.now() - 30_000);
  const signatureTime = new Date(Date.now() - 20_000);
  await Promise.all(inputFiles.map((filePath) => utimes(filePath, oldTime, oldTime)));
  await utimes(installerPath, installerTime, installerTime);
  await utimes(signaturePath, signatureTime, signatureTime);

  return {
    root,
    installerPath,
    signaturePath,
    scriptPath: path.join(root, 'scripts/package-desktop-release.mjs')
  };
}

function runPackagingScript(fixture, environment = {}) {
  return spawnSync(process.execPath, [fixture.scriptPath], {
    cwd: fixture.root,
    encoding: 'utf8',
    env: {
      ...process.env,
      CARGO_NET_OFFLINE: 'true',
      CARGO_TARGET_DIR: path.join(fixture.root, '.cargo-target'),
      ...environment
    }
  });
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe('desktop release packaging guard', () => {
  it(
    'packages when every declared build input is older than the installer',
    async () => {
      const fixture = await createFixture();
      const result = runPackagingScript(fixture);

    expect(result.status, result.stderr).toBe(0);
    const packagedInstaller = path.join(
      fixture.root,
      'releases/seekoffer-desktop/v0.2.5-internal-test/public/SeekOffer-Desktop-v0.2.5-Windows-x64-Setup.exe'
    );
    await expect(stat(packagedInstaller)).resolves.toMatchObject({ size: 4 });
    const publicDirectory = path.dirname(packagedInstaller);
    const signature = await readFile(`${packagedInstaller}.sig`, 'utf8');
    const updateManifest = JSON.parse(
      await readFile(path.join(publicDirectory, 'latest.json'), 'utf8')
    );
    expect(signature.trim()).toBe(TAURI_SIGNATURE);
    expect(updateManifest).toMatchObject({
      version: '0.2.5',
      platforms: {
        'windows-x86_64': {
          signature: TAURI_SIGNATURE,
          url: 'https://github.com/fjsfry/seekoffer-v1/releases/download/desktop-v0.2.5/SeekOffer-Desktop-v0.2.5-Windows-x64-Setup.exe'
        }
      }
    });
    await expect(
      readFile(
        path.join(
          fixture.root,
          'releases/seekoffer-desktop/v0.2.5-internal-test/updater-site/internal-test/latest.json'
        ),
        'utf8'
      )
    ).resolves.toContain('windows-x86_64');
    await expect(
      stat(
        path.join(
          fixture.root,
          'releases/seekoffer-desktop/v0.2.5-internal-test/updater-site/latest.json'
        )
      )
    ).rejects.toMatchObject({ code: 'ENOENT' });
    const updaterSiteRoot = path.join(
      fixture.root,
      'releases/seekoffer-desktop/v0.2.5-internal-test/updater-site'
    );
    await expect(
      stat(
        path.join(
          updaterSiteRoot,
          'artifacts/desktop-v0.2.5/SeekOffer-Desktop-v0.2.5-Windows-x64-Setup.exe'
        )
      )
    ).resolves.toMatchObject({ size: 4 });
    const updaterSiteConfig = JSON.parse(
      await readFile(path.join(updaterSiteRoot, 'vercel.json'), 'utf8')
    );
    expect(JSON.stringify(updaterSiteConfig)).toContain('no-store');
    expect(JSON.stringify(updaterSiteConfig)).toContain('immutable');
    const buildInfo = JSON.parse(
      await readFile(
        path.join(
          fixture.root,
          'releases/seekoffer-desktop/v0.2.5-internal-test/internal/build-info.json'
        ),
        'utf8'
      )
    );
      expect(buildInfo.updater.signatureCryptographicallyVerified).toBe(true);
      if (process.platform === 'win32') {
        expect(buildInfo.installer.authenticodeStatus).toBe('unchecked');
      }
    },
    15_000
  );

  it(
    'refuses to overwrite an immutable same-version release without an explicit internal opt-in',
    async () => {
      const fixture = await createFixture();
      const first = runPackagingScript(fixture);
      expect(first.status, first.stderr).toBe(0);

      const blocked = runPackagingScript(fixture);
      expect(blocked.status).not.toBe(0);
      expect(`${blocked.stdout}\n${blocked.stderr}`).toContain('拒绝覆盖不可变产物');

      const allowed = runPackagingScript(fixture, {
        SEEKOFFER_ALLOW_INTERNAL_REPACKAGE: 'true'
      });
      expect(allowed.status, allowed.stderr).toBe(0);
    },
    15_000
  );

  it('rejects packaging when the Tauri updater signature is missing', async () => {
    const fixture = await createFixture();
    await rm(fixture.signaturePath);

    const result = runPackagingScript(fixture);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('TAURI_SIGNING_PRIVATE_KEY');
  });

  it('rejects a signature older than its installer', async () => {
    const fixture = await createFixture();
    const staleTime = new Date(Date.now() - 120_000);
    await utimes(fixture.signaturePath, staleTime, staleTime);

    const result = runPackagingScript(fixture);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('Tauri');
  });

  it('rejects a cryptographically invalid updater signature before packaging', async () => {
    const fixture = await createFixture();
    await writeFile(fixture.installerPath, 'tampered installer bytes', 'utf8');
    const signatureTime = new Date(Date.now() + 1_000);
    await utimes(fixture.signaturePath, signatureTime, signatureTime);

    const result = runPackagingScript(fixture);
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain('发布前密码学验签失败');
    expect(output).toContain('签名不匹配');
  });

  it('rejects a release tag that does not exactly match the package version', async () => {
    const fixture = await createFixture();
    const result = runPackagingScript(fixture, {
      SEEKOFFER_REQUIRE_RELEASE_TAG: 'true',
      SEEKOFFER_RELEASE_TAG: 'desktop-v9.9.9'
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('desktop-v0.2.5');
  });

  it('requires a real clean Git source when CI clean-source enforcement is enabled', async () => {
    const fixture = await createFixture();
    const result = runPackagingScript(fixture, {
      SEEKOFFER_REQUIRE_CLEAN_SOURCE: 'true'
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('Git');
  });

  it('refuses private repositories for publicly downloadable update assets', async () => {
    const fixture = await createFixture();
    const result = runPackagingScript(fixture, {
      SEEKOFFER_REQUIRE_PUBLIC_REPOSITORY: 'true',
      SEEKOFFER_REPOSITORY_VISIBILITY: 'private'
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('private');
  });

  it('refuses a public release when Authenticode is not Valid', async () => {
    const fixture = await createFixture();
    const result = runPackagingScript(fixture, {
      SEEKOFFER_REQUIRE_VALID_AUTHENTICODE: 'true'
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('Authenticode');
  });

  it('makes Authenticode non-bypassable for the stable channel', async () => {
    const fixture = await createFixture();
    const result = runPackagingScript(fixture, {
      SEEKOFFER_RELEASE_CHANNEL: 'stable',
      SEEKOFFER_RELEASE_TAG: 'desktop-v0.2.5',
      SEEKOFFER_CURRENT_STABLE_VERSION: '0.2.4',
      SEEKOFFER_REPOSITORY_VISIBILITY: 'public',
      SEEKOFFER_REQUIRE_VALID_AUTHENTICODE: 'false'
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('Authenticode');
  });

  it('makes the online Stable version baseline non-bypassable for packaging', async () => {
    const fixture = await createFixture();
    const result = runPackagingScript(fixture, {
      SEEKOFFER_RELEASE_CHANNEL: 'stable',
      SEEKOFFER_RELEASE_TAG: 'desktop-v0.2.5',
      SEEKOFFER_REPOSITORY_VISIBILITY: 'public'
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('当前版本基线');
  });

  it('refuses to copy a release document containing a configured signing secret', async () => {
    const fixture = await createFixture();
    await writeFile(
      path.join(fixture.root, 'docs/releases/desktop-v0.2.5.md'),
      '# Release\naccidental-signing-password\n',
      'utf8'
    );
    const inputTime = new Date(Date.now() - 50_000);
    await utimes(
      path.join(fixture.root, 'docs/releases/desktop-v0.2.5.md'),
      inputTime,
      inputTime
    );
    const result = runPackagingScript(fixture, {
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: 'accidental-signing-password'
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('发布文档包含敏感材料');
  });

  it('uses DESKTOP_UPDATE_ASSET_BASE_URL without leaking credentials into latest.json', async () => {
    const fixture = await createFixture();
    const result = runPackagingScript(fixture, {
      DESKTOP_UPDATE_ASSET_BASE_URL: 'https://downloads.example.com/seekoffer/'
    });
    expect(result.status, result.stderr).toBe(0);
    const manifestPath = path.join(
      fixture.root,
      'releases/seekoffer-desktop/v0.2.5-internal-test/public/latest.json'
    );
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    expect(manifest.platforms['windows-x86_64'].url).toBe(
      'https://downloads.example.com/seekoffer/desktop-v0.2.5/SeekOffer-Desktop-v0.2.5-Windows-x64-Setup.exe'
    );
  });

  it.each([
    ['Cargo.lock', 'src-tauri/Cargo.lock'],
    ['build.rs', 'src-tauri/build.rs'],
    ['release Tauri config', 'src-tauri/tauri.release.conf.json'],
    ['updater signature verifier', 'src-tauri/examples/verify_updater_signature.rs'],
    ['configured NSIS installer hook', 'src-tauri/windows/installer-hooks.nsh'],
    ['configured NSIS header artwork', 'src-tauri/windows/assets/installer-header.bmp'],
    ['configured NSIS sidebar artwork', 'src-tauri/windows/assets/installer-sidebar.bmp'],
    ['configured NSIS Chinese copy', 'src-tauri/windows/languages/SimpChinese.nsh'],
    ['configured NSIS English copy', 'src-tauri/windows/languages/English.nsh'],
    ['NSIS artwork generator', 'src-tauri/windows/generate-installer-assets.mjs'],
    ['Authenticode certificate preparation', 'scripts/prepare-windows-signing-certificate.ps1'],
    ['Tauri Authenticode sign command', 'scripts/sign-windows-artifact.ps1'],
    ['local release helper', 'scripts/invoke-desktop-signed-release.ps1'],
    ['desktop release workflow', '.github/workflows/desktop-release.yml'],
    ['build target isolation verifier', 'scripts/verify-build-target-isolation.mjs']
  ])('rejects an installer older than %s', async (_label, relativePath) => {
    const fixture = await createFixture();
    const newerTime = new Date(Date.now());
    await utimes(path.join(fixture.root, relativePath), newerTime, newerTime);

    const result = runPackagingScript(fixture);
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain('安装包早于桌面端构建输入，拒绝整理旧二进制。');
    expect(output).toContain(path.basename(relativePath));
  });

  it('rejects a Cargo.lock package version that differs from the other desktop versions', async () => {
    const fixture = await createFixture();
    const cargoLockPath = path.join(fixture.root, 'src-tauri/Cargo.lock');
    await writeFile(
      cargoLockPath,
      'version = 4\n\n[[package]]\nname = "seekoffer-desktop"\nversion = "9.9.9"\n',
      'utf8'
    );

    const result = runPackagingScript(fixture);
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain('桌面端版本不一致');
    expect(output).toContain('"cargoLock":"9.9.9"');
  });

  it('keeps the current desktop release metadata aligned at v0.2.21', async () => {
    const [packageRaw, packageLockRaw, tauriRaw, cargoTomlRaw, cargoLockRaw, releaseNotes, designQa] =
      await Promise.all([
        readFile(path.join(projectRoot, 'package.json'), 'utf8'),
        readFile(path.join(projectRoot, 'package-lock.json'), 'utf8'),
        readFile(path.join(projectRoot, 'src-tauri/tauri.conf.json'), 'utf8'),
        readFile(path.join(projectRoot, 'src-tauri/Cargo.toml'), 'utf8'),
        readFile(path.join(projectRoot, 'src-tauri/Cargo.lock'), 'utf8'),
        readFile(path.join(projectRoot, 'docs/releases/desktop-v0.2.21.md'), 'utf8'),
        readFile(path.join(projectRoot, 'docs/design-qa/desktop-app-v0.2.21.md'), 'utf8')
      ]);

    const packageJson = JSON.parse(packageRaw);
    const packageLock = JSON.parse(packageLockRaw);
    const tauriConfig = JSON.parse(tauriRaw);
    const cargoPackageVersion = cargoTomlRaw.match(
      /\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/
    )?.[1];
    const cargoLockPackageVersion = cargoLockRaw.match(
      /\[\[package\]\]\s*\nname\s*=\s*"seekoffer-desktop"\s*\nversion\s*=\s*"([^"]+)"/
    )?.[1];

    expect(packageJson.version).toBe('0.2.21');
    expect(packageLock.version).toBe(packageJson.version);
    expect(packageLock.packages[''].version).toBe(packageJson.version);
    expect(tauriConfig.version).toBe(packageJson.version);
    expect(tauriConfig.plugins?.updater?.endpoints).toEqual([
      'https://seekoffer-desktop-updates.vercel.app/stable/latest.json',
      'https://seekoffer-desktop-updates.vercel.app/latest.json'
    ]);
    expect(cargoPackageVersion).toBe(packageJson.version);
    expect(cargoLockPackageVersion).toBe(packageJson.version);
    expect(releaseNotes).toContain('v0.2.21');
    expect(designQa).toContain('v0.2.21');
  });
});
