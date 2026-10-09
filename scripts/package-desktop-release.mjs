import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveDesktopAuthConfig,
  verifyDesktopAuthExport
} from './desktop-auth-config.mjs';
import {
  assertStableDesktopUpgrade,
  assertNoReleaseSecretLeak,
  buildDesktopArtifactUrl,
  createDesktopUpdateManifest,
  expectedDesktopReleaseTag,
  sha256Hex,
  validateDesktopReleaseTag,
  validateReleaseChannel,
  validateUpdaterSignature,
  verifyDesktopUpdateManifestFile
} from './desktop-update-manifest.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');

const packageJsonPath = path.join(projectRoot, 'package.json');
const tauriConfigPath = path.join(projectRoot, 'src-tauri', 'tauri.conf.json');
const tauriReleaseConfigPath = path.join(
  projectRoot,
  'src-tauri',
  'tauri.release.conf.json'
);
const cargoTomlPath = path.join(projectRoot, 'src-tauri', 'Cargo.toml');
const cargoLockPath = path.join(projectRoot, 'src-tauri', 'Cargo.lock');
const cargoBuildScriptPath = path.join(projectRoot, 'src-tauri', 'build.rs');
const updaterSignatureVerifierPath = path.join(
  projectRoot,
  'src-tauri',
  'examples',
  'verify_updater_signature.rs'
);
const updateManifestHelperPath = path.join(
  projectRoot,
  'scripts',
  'desktop-update-manifest.mjs'
);
const desktopReleaseWorkflowPath = path.join(
  projectRoot,
  '.github',
  'workflows',
  'desktop-release.yml'
);
const localDesktopReleaseHelperPath = path.join(
  projectRoot,
  'scripts',
  'invoke-desktop-signed-release.ps1'
);

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
const tauriConfig = JSON.parse(await readFile(tauriConfigPath, 'utf8'));
const cargoToml = await readFile(cargoTomlPath, 'utf8');
const cargoLock = await readFile(cargoLockPath, 'utf8');

const cargoVersion = cargoToml.match(
  /^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m
)?.[1];
const cargoLockVersions = cargoLock
  .split(/^\[\[package\]\]\s*$/m)
  .slice(1)
  .filter(
    (packageSection) =>
      packageSection.match(/^name\s*=\s*"([^"]+)"/m)?.[1] === 'seekoffer-desktop'
  )
  .map((packageSection) => packageSection.match(/^version\s*=\s*"([^"]+)"/m)?.[1])
  .filter(Boolean);
const cargoLockVersion =
  cargoLockVersions.length === 1 ? cargoLockVersions[0] : undefined;
const versions = {
  packageJson: packageJson.version,
  tauri: tauriConfig.version,
  cargo: cargoVersion,
  cargoLock: cargoLockVersion
};

const distinctVersions = new Set(Object.values(versions));
if (distinctVersions.size !== 1 || distinctVersions.has(undefined)) {
  throw new Error(`桌面端版本不一致：${JSON.stringify(versions)}`);
}

const version = packageJson.version;
const releaseChannel = process.env.SEEKOFFER_RELEASE_CHANNEL || 'internal-test';
validateReleaseChannel(releaseChannel, version);
const stableRelease = releaseChannel === 'stable';
if (stableRelease) {
  const currentStableVersion = process.env.SEEKOFFER_CURRENT_STABLE_VERSION || '';
  if (!currentStableVersion) {
    throw new Error('Stable 打包缺少经过线上清单验证的当前版本基线');
  }
  assertStableDesktopUpgrade(version, currentStableVersion);
}
const configuredReleaseTag =
  process.env.SEEKOFFER_RELEASE_TAG || process.env.GITHUB_REF_NAME || '';
const requireReleaseTag =
  stableRelease || process.env.SEEKOFFER_REQUIRE_RELEASE_TAG === 'true';
const releaseTag =
  validateDesktopReleaseTag(configuredReleaseTag, version, {
    required: requireReleaseTag
  }) || expectedDesktopReleaseTag(version);
const githubRepository = process.env.GITHUB_REPOSITORY || 'fjsfry/seekoffer-v1';
const repositoryVisibility =
  process.env.SEEKOFFER_REPOSITORY_VISIBILITY || 'unknown';
if (
  (stableRelease || process.env.SEEKOFFER_REQUIRE_PUBLIC_REPOSITORY === 'true') &&
  repositoryVisibility !== 'public'
) {
  throw new Error(
    `自动更新资产必须来自公开仓库；当前可见性为 ${repositoryVisibility}`
  );
}
const sourceInstallerName = `${tauriConfig.productName}_${version}_x64-setup.exe`;
const sourceInstallerPath = path.join(
  projectRoot,
  'src-tauri',
  'target',
  'release',
  'bundle',
  'nsis',
  sourceInstallerName
);
const sourceSignaturePath = `${sourceInstallerPath}.sig`;
const signedMainEvidencePath = path.join(
  projectRoot,
  'src-tauri',
  'target',
  'release',
  'authenticode-evidence',
  'seekoffer-desktop.exe'
);
const sourceInstallerStats = await stat(sourceInstallerPath);
let sourceSignatureStats;
try {
  sourceSignatureStats = await stat(sourceSignaturePath);
} catch {
  throw new Error(
    `缺少 Tauri 更新签名：${sourceSignaturePath}\n请配置 TAURI_SIGNING_PRIVATE_KEY 后重新运行桌面构建。`
  );
}
if (sourceSignatureStats.size <= 0) {
  throw new Error(`Tauri 更新签名为空：${sourceSignaturePath}`);
}
if (sourceSignatureStats.mtimeMs + 1_000 < sourceInstallerStats.mtimeMs) {
  throw new Error(
    [
      'Tauri 更新签名早于安装包，拒绝发布可能不匹配的签名。',
      `安装包时间：${sourceInstallerStats.mtime.toISOString()}`,
      `签名时间：${sourceSignatureStats.mtime.toISOString()}`
    ].join('\n')
  );
}
const updaterSignature = validateUpdaterSignature(
  await readFile(sourceSignaturePath, 'utf8')
);
verifyUpdaterSignatureWithEmbeddedKey({
  installerPath: sourceInstallerPath,
  signaturePath: sourceSignaturePath,
  publicKey: tauriConfig.plugins?.updater?.pubkey
});
const authenticode = readAuthenticodeEvidence(sourceInstallerPath);
const authenticodeStatus = authenticode.status;
const requireValidAuthenticode =
  stableRelease || process.env.SEEKOFFER_REQUIRE_VALID_AUTHENTICODE === 'true';
if (requireValidAuthenticode && authenticodeStatus !== 'Valid') {
  throw new Error(
    `正式发布要求有效的 Windows Authenticode 签名；当前状态为 ${authenticodeStatus}`
  );
}
const expectedThumbprint = (
  process.env.SEEKOFFER_AUTHENTICODE_EXPECTED_THUMBPRINT || ''
)
  .replace(/\s/g, '')
  .toUpperCase();
let mainAuthenticode = {
  status: 'not-required',
  thumbprint: '',
  timestamped: false,
  sha256: ''
};
if (stableRelease) {
  if (!/^[0-9A-F]{40}$/.test(expectedThumbprint)) {
    throw new Error('Stable 发布缺少钉扎的 40 位 Authenticode 证书指纹');
  }
  try {
    await stat(signedMainEvidencePath);
  } catch {
    throw new Error('Stable 发布缺少 Tauri 恢复前的已签主程序证据');
  }
  mainAuthenticode = {
    ...readAuthenticodeEvidence(signedMainEvidencePath),
    sha256: sha256Hex(await readFile(signedMainEvidencePath))
  };
  if (mainAuthenticode.status !== 'Valid') {
    throw new Error(
      `Stable 已签主程序证据不是有效 Authenticode：${mainAuthenticode.status}`
    );
  }
  if (mainAuthenticode.thumbprint !== expectedThumbprint) {
    throw new Error('Stable 已签主程序证据与钉扎证书指纹不一致');
  }
  if (!mainAuthenticode.timestamped) {
    throw new Error('Stable 已签主程序证据缺少可信 Authenticode 时间戳');
  }
  if (authenticode.thumbprint !== expectedThumbprint) {
    throw new Error('Stable 安装包的 Authenticode 证书与钉扎指纹不一致');
  }
  if (!authenticode.timestamped) {
    throw new Error('Stable 安装包缺少可信 Authenticode 时间戳');
  }
}
const gitStatusResult = runGit(['status', '--porcelain']);
const gitRevisionResult = runGit(['rev-parse', 'HEAD']);
const gitStatus = gitStatusResult.value;
if (stableRelease || process.env.SEEKOFFER_REQUIRE_CLEAN_SOURCE === 'true') {
  if (!gitStatusResult.ok || !gitRevisionResult.ok) {
    throw new Error('自动更新发布必须从有效的 Git 工作区构建');
  }
  if (gitStatus) {
    throw new Error('自动更新发布拒绝脏工作区；请提交或移除所有变更后重试');
  }
}
const desktopAuthConfig = await resolveDesktopAuthConfig({ projectRoot });
await verifyDesktopAuthExport({
  distDirectory: path.join(projectRoot, '.next-desktop'),
  config: desktopAuthConfig
});

async function listFilesRecursively(targetPath) {
  const targetStats = await stat(targetPath);
  if (targetStats.isFile()) return [targetPath];

  const entries = await readdir(targetPath, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map((entry) =>
      listFilesRecursively(path.join(targetPath, entry.name))
    )
  );
  return nestedFiles.flat();
}

const nsisConfig = tauriConfig.bundle?.windows?.nsis ?? {};
const configuredInstallerPaths = [
  nsisConfig.template,
  nsisConfig.headerImage,
  nsisConfig.sidebarImage,
  nsisConfig.installerIcon,
  nsisConfig.uninstallerIcon,
  nsisConfig.uninstallerHeaderImage,
  nsisConfig.installerHooks,
  ...Object.values(nsisConfig.customLanguageFiles ?? {})
]
  .filter((configuredPath) => typeof configuredPath === 'string')
  .map((configuredPath) => configuredPath.trim())
  .filter(Boolean)
  .map((configuredPath) =>
    path.resolve(path.dirname(tauriConfigPath), configuredPath)
  );

const buildInputPaths = [
  path.join(projectRoot, 'app'),
  path.join(projectRoot, 'components'),
  path.join(projectRoot, 'lib'),
  path.join(projectRoot, 'public'),
  path.join(projectRoot, 'src-tauri', 'capabilities'),
  path.join(projectRoot, 'src-tauri', 'icons'),
  path.join(projectRoot, 'src-tauri', 'src'),
  path.join(projectRoot, '.next-desktop'),
  packageJsonPath,
  path.join(projectRoot, 'package-lock.json'),
  path.join(projectRoot, 'next.config.mjs'),
  path.join(projectRoot, 'tsconfig.json'),
  tauriConfigPath,
  tauriReleaseConfigPath,
  cargoTomlPath,
  cargoLockPath,
  cargoBuildScriptPath,
  updaterSignatureVerifierPath,
  ...configuredInstallerPaths,
  path.join(
    projectRoot,
    'src-tauri',
    'windows',
    'generate-installer-assets.mjs'
  ),
  path.join(projectRoot, 'scripts', 'desktop-auth-config.mjs'),
  desktopReleaseWorkflowPath,
  localDesktopReleaseHelperPath,
  path.join(projectRoot, 'scripts', 'prepare-windows-signing-certificate.ps1'),
  path.join(projectRoot, 'scripts', 'sign-windows-artifact.ps1'),
  path.join(projectRoot, 'scripts', 'run-desktop-next.mjs'),
  path.join(projectRoot, 'scripts', 'verify-build-target-isolation.mjs'),
  path.join(projectRoot, 'scripts', 'verify-desktop-auth-export.mjs'),
  updateManifestHelperPath,
  fileURLToPath(import.meta.url)
];
const buildInputFiles = (
  await Promise.all(buildInputPaths.map((inputPath) => listFilesRecursively(inputPath)))
).flat();
const buildInputStats = await Promise.all(
  buildInputFiles.map(async (inputPath) => ({
    inputPath,
    stats: await stat(inputPath)
  }))
);
const buildInputHashes = await Promise.all(
  buildInputFiles.map(async (inputPath) => ({
    path: path.relative(projectRoot, inputPath).replaceAll(path.sep, '/'),
    sha256: sha256Hex(await readFile(inputPath))
  }))
);
buildInputHashes.sort((left, right) => left.path.localeCompare(right.path, 'en'));
const buildInputsSha256 = sha256Hex(
  Buffer.from(
    buildInputHashes.map((entry) => `${entry.sha256}  ${entry.path}`).join('\n'),
    'utf8'
  )
);
const newestBuildInput = buildInputStats.reduce((latest, candidate) =>
  candidate.stats.mtimeMs > latest.stats.mtimeMs ? candidate : latest
);

if (newestBuildInput.stats.mtimeMs > sourceInstallerStats.mtimeMs + 1_000) {
  throw new Error(
    [
      '安装包早于桌面端构建输入，拒绝整理旧二进制。',
      `最新输入：${newestBuildInput.inputPath}`,
      `输入时间：${newestBuildInput.stats.mtime.toISOString()}`,
      `安装包时间：${sourceInstallerStats.mtime.toISOString()}`,
      '请先运行 npm run desktop:build。'
    ].join('\n')
  );
}

const releaseDirectory = path.join(
  projectRoot,
  'releases',
  'seekoffer-desktop',
  `v${version}-${releaseChannel}`
);
const publicDirectory = path.join(releaseDirectory, 'public');
const internalDirectory = path.join(releaseDirectory, 'internal');
const screenshotDirectory = path.join(internalDirectory, 'screenshots');
const updaterSiteDirectory = path.join(releaseDirectory, 'updater-site');
const updaterSiteChannelDirectory = path.join(updaterSiteDirectory, releaseChannel);
const updaterSiteArtifactDirectory = path.join(
  updaterSiteDirectory,
  'artifacts',
  releaseTag
);
const installerName = `SeekOffer-Desktop-v${version}-Windows-x64-Setup.exe`;
const installerPath = path.join(publicDirectory, installerName);
const signatureName = `${installerName}.sig`;
const signaturePath = path.join(publicDirectory, signatureName);
const updateManifestPath = path.join(publicDirectory, 'latest.json');
const releaseNotesSource = path.join(projectRoot, 'docs', 'releases', `desktop-v${version}.md`);
const releaseNotesTarget = path.join(publicDirectory, 'RELEASE-NOTES.zh-CN.md');
const installGuideSource = path.join(projectRoot, 'docs', 'releases', 'desktop-install.zh-CN.md');
const installGuideTarget = path.join(publicDirectory, 'INSTALL.zh-CN.md');
const designQaSource = path.join(projectRoot, 'docs', 'design-qa', `desktop-app-v${version}.md`);
const designQaTarget = path.join(internalDirectory, 'design-qa.md');
const signedMainEvidenceTarget = path.join(
  internalDirectory,
  'signed-seekoffer-desktop.exe'
);
// Current-release screenshots are only packaged after a fresh runtime capture.
// Never carry forward an older build's screenshots as evidence for a new build.
const screenshotSources = [];

const expectedReleaseParent = path.join(projectRoot, 'releases', 'seekoffer-desktop');
if (path.dirname(releaseDirectory) !== expectedReleaseParent) {
  throw new Error(`拒绝清理预期目录之外的发布包：${releaseDirectory}`);
}

let releaseDirectoryExists = false;
try {
  await stat(releaseDirectory);
  releaseDirectoryExists = true;
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

if (releaseDirectoryExists) {
  const allowInternalRepackage =
    releaseChannel === 'internal-test' &&
    process.env.SEEKOFFER_ALLOW_INTERNAL_REPACKAGE === 'true';
  if (!allowInternalRepackage) {
    throw new Error(
      `同版本发布目录已存在，拒绝覆盖不可变产物：${releaseDirectory}。` +
      '仅在尚未分发的 internal-test 暂存包需要重整时，显式设置 SEEKOFFER_ALLOW_INTERNAL_REPACKAGE=true。'
    );
  }
  await rm(releaseDirectory, { recursive: true, force: true });
}
await mkdir(publicDirectory, { recursive: true });
await mkdir(screenshotDirectory, { recursive: true });
await mkdir(updaterSiteChannelDirectory, { recursive: true });
await mkdir(updaterSiteArtifactDirectory, { recursive: true });
const copiedTextSources = await Promise.all(
  [releaseNotesSource, installGuideSource, designQaSource].map(async (sourcePath) => ({
    sourcePath,
    content: await readFile(sourcePath, 'utf8')
  }))
);
for (const { sourcePath, content } of copiedTextSources) {
  try {
    assertNoReleaseSecretLeak(content);
  } catch (error) {
    throw new Error(`发布文档包含敏感材料：${sourcePath}\n${error.message}`);
  }
}
await copyFile(sourceInstallerPath, installerPath);
await copyFile(sourceSignaturePath, signaturePath);
await copyFile(releaseNotesSource, releaseNotesTarget);
await copyFile(installGuideSource, installGuideTarget);
await copyFile(designQaSource, designQaTarget);
if (stableRelease) {
  await copyFile(signedMainEvidencePath, signedMainEvidenceTarget);
}

const installerBytes = await readFile(installerPath);
const sha256 = createHash('sha256').update(installerBytes).digest('hex').toUpperCase();
const signatureBytes = await readFile(signaturePath);
const signatureSha256 = sha256Hex(signatureBytes);
const releaseNotes = await readFile(releaseNotesTarget, 'utf8');
const artifactUrl = buildDesktopArtifactUrl({
  repository: githubRepository,
  tag: releaseTag,
  installerName,
  assetBaseUrl: process.env.DESKTOP_UPDATE_ASSET_BASE_URL
});
const updateManifest = createDesktopUpdateManifest({
  version,
  notes: releaseNotes,
  pubDate: sourceInstallerStats.mtime,
  artifactUrl,
  signature: updaterSignature
});
const updateManifestJson = `${JSON.stringify(updateManifest, null, 2)}\n`;
assertNoReleaseSecretLeak(updateManifestJson);
await writeFile(updateManifestPath, updateManifestJson, 'utf8');
// This directory is deliberately isolated from the main Next.js/Vercel output.
// Release automation may archive it, but publishing it requires a separate,
// explicit updater-site deployment after the immutable binary assets exist.
if (stableRelease) {
  await writeFile(
    path.join(updaterSiteDirectory, 'latest.json'),
    updateManifestJson,
    'utf8'
  );
}
await writeFile(
  path.join(updaterSiteChannelDirectory, 'latest.json'),
  updateManifestJson,
  'utf8'
);
await writeFile(
  path.join(updaterSiteDirectory, 'vercel.json'),
  `${JSON.stringify(
    {
      headers: [
        {
          source: '/latest.json',
          headers: [
            {
              key: 'Cache-Control',
              value: 'no-store, max-age=0'
            },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Access-Control-Allow-Origin', value: '*' }
          ]
        },
        {
          source: '/:channel/latest.json',
          headers: [
            { key: 'Cache-Control', value: 'no-store, max-age=0' },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Access-Control-Allow-Origin', value: '*' }
          ]
        },
        {
          source: '/artifacts/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable'
            },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Access-Control-Allow-Origin', value: '*' }
          ]
        }
      ]
    },
    null,
    2
  )}\n`,
  'utf8'
);
await copyFile(
  installerPath,
  path.join(updaterSiteArtifactDirectory, installerName)
);
await copyFile(
  signaturePath,
  path.join(updaterSiteArtifactDirectory, signatureName)
);
await verifyDesktopUpdateManifestFile(updateManifestPath, {
  expectedVersion: version,
  expectedUrl: artifactUrl,
  expectedSignature: updaterSignature
});
const updateManifestSha256 = sha256Hex(await readFile(updateManifestPath));

function runGit(args) {
  try {
    return {
      ok: true,
      value: execFileSync('git', args, {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim()
    };
  } catch {
    return { ok: false, value: '' };
  }
}

function readAuthenticodeEvidence(filePath) {
  if (process.platform !== 'win32') {
    return { status: 'unchecked', thumbprint: '', timestamped: false };
  }

  const header = readFileSync(filePath).subarray(0, 2);
  const isPortableExecutable = header[0] === 0x4d && header[1] === 0x5a;
  if (!isPortableExecutable) {
    return { status: 'unchecked', thumbprint: '', timestamped: false };
  }

  try {
    const systemRoot = process.env.SystemRoot || process.env.WINDIR;
    if (!systemRoot) throw new Error('Windows system root is unavailable');
    const powershellPath = path.join(
      systemRoot,
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe'
    );
    const authenticodeScript = [
      'Remove-TypeData -TypeName System.Security.AccessControl.ObjectSecurity -ErrorAction SilentlyContinue',
      'Import-Module Microsoft.PowerShell.Security -Scope Local -ErrorAction Stop',
      '$signature = Get-AuthenticodeSignature -LiteralPath $env:SEEK_DESKTOP_INSTALLER',
      '[pscustomobject]@{',
      'status = $signature.Status.ToString()',
      "thumbprint = if ($null -ne $signature.SignerCertificate) { ($signature.SignerCertificate.Thumbprint -replace '\\s', '').ToUpperInvariant() } else { '' }",
      'timestamped = $null -ne $signature.TimeStamperCertificate',
      '} | ConvertTo-Json -Compress'
    ].join('\n');
    const serialized = execFileSync(
      powershellPath,
      [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(authenticodeScript, 'utf16le').toString('base64')
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, SEEK_DESKTOP_INSTALLER: filePath },
        stdio: ['ignore', 'pipe', 'ignore']
      }
    ).trim();
    const parsed = JSON.parse(serialized);
    return {
      status: typeof parsed.status === 'string' ? parsed.status : 'unknown',
      thumbprint:
        typeof parsed.thumbprint === 'string'
          ? parsed.thumbprint.replace(/\s/g, '').toUpperCase()
          : '',
      timestamped: parsed.timestamped === true
    };
  } catch (error) {
    throw new Error(`无法读取 Windows Authenticode 状态：${error.message}`);
  }
}

function verifyUpdaterSignatureWithEmbeddedKey({
  installerPath,
  signaturePath,
  publicKey
}) {
  if (typeof publicKey !== 'string' || !publicKey.trim()) {
    throw new Error('tauri.conf.json 缺少 plugins.updater.pubkey，无法执行发布前验签');
  }

  try {
    execFileSync(
      'cargo',
      [
        'run',
        '--quiet',
        '--locked',
        '--manifest-path',
        cargoTomlPath,
        '--example',
        'verify_updater_signature',
        '--',
        installerPath,
        signaturePath,
        publicKey.trim()
      ],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );
  } catch (error) {
    const verifierOutput = [error?.stderr, error?.stdout]
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => value.trim())
      .join('\n');
    throw new Error(
      [
        'Tauri updater 发布前密码学验签失败，拒绝打包。',
        '安装包、.sig 或 tauri.conf.json 内嵌公钥至少有一项不匹配。',
        verifierOutput || error?.message || 'Rust 验签器未能运行'
      ].join('\n')
    );
  }
}

const manifest = {
  schemaVersion: 1,
  productName: tauriConfig.productName,
  applicationId: tauriConfig.identifier,
  publisher: tauriConfig.bundle?.publisher ?? null,
  homepage: tauriConfig.bundle?.homepage ?? packageJson.homepage ?? null,
  copyright: tauriConfig.bundle?.copyright ?? null,
  version,
  releaseChannel,
  platform: 'windows',
  architecture: 'x64',
  bundleType: 'nsis',
  installer: {
    file: `public/${installerName}`,
    sizeBytes: sourceInstallerStats.size,
    sha256,
    authenticodeStatus,
    authenticodeThumbprint: authenticode.thumbprint || null,
    authenticodeTimestamped: authenticode.timestamped
  },
  applicationAuthenticode: stableRelease
    ? {
        file: 'internal/signed-seekoffer-desktop.exe',
        sha256: mainAuthenticode.sha256,
        status: mainAuthenticode.status,
        thumbprint: mainAuthenticode.thumbprint,
        timestamped: mainAuthenticode.timestamped
      }
    : null,
  updater: {
    releaseTag,
    target: 'windows-x86_64',
    artifactUrl,
    signatureCryptographicallyVerified: true,
    signatureFile: `public/${signatureName}`,
    signatureSha256,
    manifestFile: 'public/latest.json',
    manifestSha256: updateManifestSha256,
    isolatedUpdaterSite: `updater-site/${releaseChannel}/latest.json`
  },
  releaseNotes: 'public/RELEASE-NOTES.zh-CN.md',
  installGuide: 'public/INSTALL.zh-CN.md',
  designQa: 'internal/design-qa.md',
  screenshots: screenshotSources.map((fileName) => `internal/screenshots/${fileName}`),
  automaticUpdatesConfigured:
    tauriConfig.bundle?.createUpdaterArtifacts === true &&
    Boolean(tauriConfig.plugins?.updater?.pubkey),
  source: {
    revision: gitRevisionResult.value || null,
    workingTreeDirty: !gitStatusResult.ok || Boolean(gitStatus),
    repository: githubRepository,
    repositoryVisibility,
    buildInputFileCount: buildInputHashes.length,
    buildInputsSha256
  },
  builtAt: sourceInstallerStats.mtime.toISOString(),
  packagedAt: new Date().toISOString()
};

await writeFile(
  path.join(publicDirectory, 'SHA256SUMS.txt'),
  [
    `${sha256}  ${installerName}`,
    `${signatureSha256}  ${signatureName}`,
    `${updateManifestSha256}  latest.json`,
    ''
  ].join('\n'),
  'utf8'
);
await copyFile(
  path.join(publicDirectory, 'SHA256SUMS.txt'),
  path.join(updaterSiteArtifactDirectory, 'SHA256SUMS.txt')
);
const buildInfoJson = `${JSON.stringify(manifest, null, 2)}\n`;
assertNoReleaseSecretLeak(buildInfoJson);
await writeFile(
  path.join(internalDirectory, 'build-info.json'),
  buildInfoJson,
  'utf8'
);

console.log(`桌面发布包已整理：${releaseDirectory}`);
console.log(`公开交付目录：${publicDirectory}`);
console.log(`安装包：${installerName}`);
console.log(`SHA256：${sha256}`);
console.log(`更新签名：${signatureName}`);
console.log(`更新清单：latest.json`);
console.log(`Authenticode：${authenticodeStatus}`);
