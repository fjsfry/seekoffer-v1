import { execFileSync } from 'node:child_process';
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertNoReleaseSecretLeak, sha256Hex, validateDesktopUpdateManifest, validateUpdaterSignature } from './desktop-update-manifest.mjs';
import { verifyDesktopD1Export } from './verify-desktop-d1-export.mjs';

// One release only. This neither changes the Stable CI policy nor turns the
// existing internal-test package into a Stable package in place.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const AUTHORIZED_RELEASE = Object.freeze({
  version: '0.2.29', tag: 'desktop-v0.2.29', repository: 'fjsfry/seekoffer-v1',
  acknowledgement: '--acknowledge-unsigned-publisher',
  policyBaselineRevision: '0443ee78fdbd7097b102647814b007195496170b',
  sourceName: 'v0.2.29-internal-test', outputName: 'v0.2.29-authorized-public',
  installerName: 'SeekOffer-Desktop-v0.2.29-Windows-x64-Setup.exe',
  artifactUrl: 'https://github.com/fjsfry/seekoffer-v1/releases/download/desktop-v0.2.29/SeekOffer-Desktop-v0.2.29-Windows-x64-Setup.exe'
});
const SIGNATURE_NAME = `${AUTHORIZED_RELEASE.installerName}.sig`;
const PUBLIC_FILES = Object.freeze([AUTHORIZED_RELEASE.installerName, SIGNATURE_NAME, 'latest.json', 'SHA256SUMS.txt', 'RELEASE-NOTES.zh-CN.md', 'INSTALL.zh-CN.md']);
const SOURCE = path.join(ROOT, 'releases', 'seekoffer-desktop', AUTHORIZED_RELEASE.sourceName);
const OUTPUT = path.join(ROOT, 'releases', 'seekoffer-desktop', AUTHORIZED_RELEASE.outputName);

function requireCondition(condition, message) { if (!condition) throw new Error(message); }

export function requireReleaseAcknowledgement(args) {
  requireCondition(args.length === 1 && args[0] === AUTHORIZED_RELEASE.acknowledgement,
    '仅允许本次固定 0.2.29 授权组装：node scripts/prepare-desktop-v0.2.29-authorized-release.mjs --acknowledge-unsigned-publisher；安装包没有 Windows 发布者证书，仍必须通过真实 Tauri Minisign 验签。');
}

export function assertAuthorizedReleaseText(text) {
  assertNoReleaseSecretLeak(text);
  const privateMarker = /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|untrusted comment:\s*minisign (?:encrypted )?secret key/i;
  requireCondition(!privateMarker.test(text), '公开文件包含私钥材料');
  for (const candidate of text.match(/[A-Za-z0-9+/]{40,}={0,2}/g) || []) {
    requireCondition(!privateMarker.test(Buffer.from(candidate, 'base64').toString('utf8')), '公开文件包含 Base64 私钥材料');
  }
}

export function parseAuthorizedSums(text) {
  const sums = new Map();
  for (const line of text.split(/\r?\n/).filter(line => line.trim())) {
    const match = line.match(/^([A-Fa-f0-9]{64}) {2}([^/\\]+)$/);
    requireCondition(Boolean(match), 'SHA256SUMS 行无效');
    requireCondition(!sums.has(match[2]), 'SHA256SUMS 存在重复条目');
    sums.set(match[2], match[1].toUpperCase());
  }
  requireCondition(sums.size === 3, 'SHA256SUMS 必须且仅包含安装包、签名、清单');
  return sums;
}

/** Pure validation for tests; assembly always collects Git/Windows/crypto evidence live. */
export function validateAuthorizedInputs({ buildInfo, files, git, authenticode, packageVersion, tauriVersion, tauriIdentifier }) {
  const release = AUTHORIZED_RELEASE;
  requireCondition(packageVersion === release.version && tauriVersion === release.version && buildInfo.version === release.version,
    '本脚本只接受固定 0.2.29 版本');
  requireCondition(tauriIdentifier === 'com.seekoffer.desktop' && buildInfo.applicationId === tauriIdentifier, '必须使用正式桌面应用标识');
  requireCondition(buildInfo.releaseChannel === 'internal-test', '输入必须仍是原始 internal-test 包');
  requireCondition(buildInfo.platform === 'windows' && buildInfo.architecture === 'x64' && buildInfo.bundleType === 'nsis', '输入不是 Windows x64 NSIS 包');
  requireCondition(buildInfo.automaticUpdatesConfigured === true, '输入未配置自动更新');
  requireCondition(buildInfo.source?.workingTreeDirty === false && git.status === '', '拒绝脏源代码工作区或脏构建证据');
  requireCondition(/^[a-f0-9]{40}$/.test(git.head) && git.head === buildInfo.source?.revision && git.tagCommit === git.head, '构建提交、HEAD 与 desktop-v0.2.29 Tag 必须一致');
  requireCondition(git.tagType === 'tag', '必须使用固定版本的 annotated Tag');
  requireCondition(buildInfo.source?.repository === release.repository && /^https:\/\/github\.com\/fjsfry\/seekoffer-v1(?:\.git)?\/?$|^git@github\.com:fjsfry\/seekoffer-v1(?:\.git)?$/.test(git.origin), 'Git 来源不是固定寻鹿仓库');
  requireCondition(Number.isInteger(buildInfo.source?.buildInputFileCount) && buildInfo.source.buildInputFileCount > 0 && /^[A-Fa-f0-9]{64}$/.test(buildInfo.source.buildInputsSha256), '缺少构建输入指纹');
  const builtAt = Date.parse(buildInfo.builtAt), packagedAt = Date.parse(buildInfo.packagedAt);
  requireCondition(Number.isFinite(builtAt) && Number.isFinite(packagedAt) && builtAt <= packagedAt && builtAt >= git.commitTime * 1000 && packagedAt <= Date.now() + 300000, '构建时间证据无效或早于源提交');
  requireCondition(authenticode.status === 'NotSigned' && !authenticode.thumbprint && authenticode.timestamped === false,
    '本次授权仅接受确认为 NotSigned 且没有伪造发布者/时间戳的安装包');
  requireCondition(/^0\.2\.29(?:\.0)?$/.test(authenticode.productVersion), '安装包 Windows 产品版本不是 0.2.29');
  requireCondition(buildInfo.installer?.authenticodeStatus === 'NotSigned' && !buildInfo.installer.authenticodeThumbprint && buildInfo.installer.authenticodeTimestamped === false && buildInfo.applicationAuthenticode === null, '构建记录错误地声明 Windows 签名或状态不符');
  requireCondition(Object.keys(files).sort().join('\n') === [...PUBLIC_FILES].sort().join('\n'), 'public 输入包含额外文件或缺失必需资产');
  const installer = files[release.installerName], signatureBytes = files[SIGNATURE_NAME], manifestBytes = files['latest.json'];
  requireCondition(Buffer.isBuffer(installer) && installer.length > 100000 && installer[0] === 0x4d && installer[1] === 0x5a, '输入不是有效尺寸的 Windows 安装包');
  const hashes = Object.fromEntries(PUBLIC_FILES.map(name => [name, sha256Hex(files[name])]));
  for (const name of PUBLIC_FILES.filter(name => name !== release.installerName)) assertAuthorizedReleaseText(files[name].toString('utf8'));
  requireCondition(buildInfo.installer.file === `public/${release.installerName}` && buildInfo.installer.sizeBytes === installer.length && buildInfo.installer.sha256?.toUpperCase() === hashes[release.installerName], '安装包与 build-info 的大小/SHA-256 不一致');
  const updater = buildInfo.updater;
  requireCondition(updater?.releaseTag === release.tag && updater.target === 'windows-x86_64' && updater.artifactUrl === release.artifactUrl && updater.signatureCryptographicallyVerified === true, '更新源/Tag/原验签记录不符');
  requireCondition(updater.signatureFile === `public/${SIGNATURE_NAME}` && updater.signatureSha256?.toUpperCase() === hashes[SIGNATURE_NAME] && updater.manifestFile === 'public/latest.json' && updater.manifestSha256?.toUpperCase() === hashes['latest.json'], '签名/清单与 build-info 的 SHA-256 不一致');
  const signature = validateUpdaterSignature(signatureBytes.toString('utf8'));
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  validateDesktopUpdateManifest(manifest, { expectedVersion: release.version, expectedUrl: release.artifactUrl, expectedSignature: signature });
  requireCondition(Date.parse(manifest.pub_date) === builtAt, '清单发布时间与构建证据不一致');
  requireCondition(Object.keys(manifest.platforms).length === 1 && manifest.notes === files['RELEASE-NOTES.zh-CN.md'].toString('utf8').trim(), '清单平台或发布说明不匹配');
  const sums = parseAuthorizedSums(files['SHA256SUMS.txt'].toString('utf8'));
  for (const name of [release.installerName, SIGNATURE_NAME, 'latest.json']) requireCondition(sums.get(name) === hashes[name], `SHA256SUMS 与 ${name} 不一致`);
  return { hashes, manifest };
}

export async function assertFreshAuthorizedOutput(directory) {
  const existing = await lstat(directory).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
  requireCondition(!existing, '授权输出目录已存在，拒绝覆盖不可变目录/资产');
}

function runGit(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function readWindowsEvidence(installerPath) {
  requireCondition(process.platform === 'win32', '必须在 Windows 实际读取 Authenticode，不能以 unchecked 替代');
  const systemRoot = process.env.SystemRoot || process.env.WINDIR;
  requireCondition(Boolean(systemRoot), 'Windows 系统目录不可用');
  const script = [
    '$ErrorActionPreference = "Stop"',
    'Remove-TypeData -TypeName System.Security.AccessControl.ObjectSecurity -ErrorAction SilentlyContinue',
    'Import-Module Microsoft.PowerShell.Security -Scope Local -ErrorAction Stop',
    '$signature = Get-AuthenticodeSignature -LiteralPath $env:SEEKOFFER_AUTHORIZED_0229_INSTALLER',
    '$file = Get-Item -LiteralPath $env:SEEKOFFER_AUTHORIZED_0229_INSTALLER',
    '[pscustomobject]@{ status=$signature.Status.ToString(); thumbprint=if ($signature.SignerCertificate) {$signature.SignerCertificate.Thumbprint} else {""}; timestamped=$null -ne $signature.TimeStamperCertificate; productVersion=$file.VersionInfo.ProductVersion } | ConvertTo-Json -Compress'
  ].join('\n');
  return JSON.parse(execFileSync(path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, SEEKOFFER_AUTHORIZED_0229_INSTALLER: installerPath }
  }).trim());
}

function verifyRealMinisign(installerPath, signaturePath, publicKey) {
  requireCondition(typeof publicKey === 'string' && publicKey.trim(), '缺少内嵌 Tauri updater 公钥');
  // Do not accept a build-info boolean or a text-pattern check as cryptographic proof.
  execFileSync('cargo', ['run', '--quiet', '--locked', '--manifest-path', path.join(ROOT, 'src-tauri', 'Cargo.toml'), '--example', 'verify_updater_signature', '--', installerPath, signaturePath, publicKey.trim()], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  });
}

async function readPlainFile(file) {
  requireCondition((await lstat(file)).isFile(), `输入不是普通文件或为符号链接：${file}`);
  return readFile(file);
}

async function main() {
  requireReleaseAcknowledgement(process.argv.slice(2));
  await assertFreshAuthorizedOutput(OUTPUT);
  for (const directory of [path.join(ROOT, 'releases'), path.join(ROOT, 'releases', 'seekoffer-desktop'), SOURCE, path.join(SOURCE, 'public'), path.join(SOURCE, 'internal')]) {
    requireCondition((await lstat(directory)).isDirectory(), '发布输入不能使用符号链接或外部跳转目录');
  }
  const rootReal = await realpath(ROOT), sourceReal = await realpath(SOURCE);
  requireCondition(sourceReal.startsWith(rootReal + path.sep), '输入必须位于当前项目内');
  const names = (await readdir(path.join(SOURCE, 'public'))).sort();
  requireCondition(names.join('\n') === [...PUBLIC_FILES].sort().join('\n'), 'public 输入文件列表不符合固定 0.2.29 产物');
  const files = Object.fromEntries(await Promise.all(PUBLIC_FILES.map(async name => [name, await readPlainFile(path.join(SOURCE, 'public', name))])));
  const sourceBuildInfo = await readPlainFile(path.join(SOURCE, 'internal', 'build-info.json'));
  assertAuthorizedReleaseText(sourceBuildInfo.toString('utf8'));
  const buildInfo = JSON.parse(sourceBuildInfo.toString('utf8'));
  const packageJson = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  const tauri = JSON.parse(await readFile(path.join(ROOT, 'src-tauri', 'tauri.conf.json'), 'utf8'));
  const policyPaths = ['.github/workflows/desktop-release.yml', 'scripts/package-desktop-release.mjs', 'scripts/invoke-desktop-signed-release.ps1', 'scripts/sign-windows-artifact.ps1', 'scripts/prepare-windows-signing-certificate.ps1', 'src-tauri/examples/verify_updater_signature.rs'];
  runGit(['diff', '--exit-code', AUTHORIZED_RELEASE.policyBaselineRevision, 'HEAD', '--', ...policyPaths]);
  const baselineTauri = JSON.parse(runGit(['show', `${AUTHORIZED_RELEASE.policyBaselineRevision}:src-tauri/tauri.conf.json`]));
  requireCondition(tauri.plugins?.updater?.pubkey === baselineTauri.plugins?.updater?.pubkey, '更新公钥必须与原恢复版信任根一致');
  requireCondition(files['RELEASE-NOTES.zh-CN.md'].equals(await readFile(path.join(ROOT, 'docs', 'releases', 'desktop-v0.2.29.md'))) && files['INSTALL.zh-CN.md'].equals(await readFile(path.join(ROOT, 'docs', 'releases', 'desktop-install.zh-CN.md'))), '源发行说明/安装指南与干净提交不一致');
  const git = {
    status: runGit(['status', '--porcelain=v1', '--untracked-files=all']), head: runGit(['rev-parse', 'HEAD']),
    tagCommit: runGit(['rev-parse', `refs/tags/${AUTHORIZED_RELEASE.tag}^{commit}`]), tagType: runGit(['cat-file', '-t', `refs/tags/${AUTHORIZED_RELEASE.tag}`]),
    origin: runGit(['remote', 'get-url', 'origin']), commitTime: Number(runGit(['show', '-s', '--format=%ct', 'HEAD']))
  };
  const installerPath = path.join(SOURCE, 'public', AUTHORIZED_RELEASE.installerName);
  const authenticode = readWindowsEvidence(installerPath);
  const validated = validateAuthorizedInputs({ buildInfo, files, git, authenticode, packageVersion: packageJson.version, tauriVersion: tauri.version, tauriIdentifier: tauri.identifier });
  verifyRealMinisign(installerPath, path.join(SOURCE, 'public', SIGNATURE_NAME), tauri.plugins?.updater?.pubkey);
  await verifyDesktopD1Export(path.join(ROOT, '.next-desktop'));
  const checkedAt = new Date().toISOString();
  const evidence = {
    schemaVersion: 1, version: AUTHORIZED_RELEASE.version, releaseTag: AUTHORIZED_RELEASE.tag,
    assemblyKind: 'one-off-user-authorized-public-unsigned-publisher', assembledAt: checkedAt,
    authorization: { acknowledgedByCommandLine: true, requiredFlag: AUTHORIZED_RELEASE.acknowledgement, scope: 'User requested publishing desktop 0.2.29 through the existing update channel using the previously authorized unsigned-Windows-publisher compatibility process; genuine Tauri Minisign remains mandatory.' },
    windowsPublisher: { ...authenticode, signed: false, warning: 'No Windows publisher certificate. Windows may report an unknown publisher.' },
    updaterSignature: { cryptographicallyVerifiedAtAssembly: true, verifier: 'src-tauri/examples/verify_updater_signature.rs', publicKeySha256: sha256Hex(Buffer.from(tauri.plugins.updater.pubkey.trim())), installerSha256: validated.hashes[AUTHORIZED_RELEASE.installerName], signatureSha256: validated.hashes[SIGNATURE_NAME] },
    source: { directory: AUTHORIZED_RELEASE.sourceName, originalChannel: 'internal-test', originalBuildInfoSha256: sha256Hex(sourceBuildInfo), revision: git.head, annotatedTagCommit: git.tagCommit, cleanWorkingTree: true, filesUnchanged: true },
    output: { directory: AUTHORIZED_RELEASE.outputName, byteIdenticalManifestPaths: ['public/latest.json', 'updater-site/latest.json', 'updater-site/stable/latest.json'], files: validated.hashes },
    safeguards: { policyBaselineRevision: AUTHORIZED_RELEASE.policyBaselineRevision, verifiedUnchangedPolicyPaths: policyPaths, trustedUpdaterKeyUnchanged: true, stableCiPolicyUnchanged: true, genericPackagerPolicyUnchanged: true, signingHelperPolicyUnchanged: true, sourceNotPromotedInPlace: true, existingAssetsNotOverwritten: true, uploaded: false, deployed: false }
  };
  const evidenceText = `${JSON.stringify(evidence, null, 2)}\n`;
  assertAuthorizedReleaseText(evidenceText);
  const policy = {
    headers: [
      ...['/latest.json', '/:channel/latest.json'].map(source => ({ source, headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }, { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Access-Control-Allow-Origin', value: '*' }] })),
      { source: '/artifacts/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }, { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Access-Control-Allow-Origin', value: '*' }] }
    ]
  };
  // mkdir is exclusive: even a concurrently created target must never be replaced.
  await mkdir(OUTPUT);
  for (const directory of ['public', 'internal', 'updater-site/stable', `updater-site/artifacts/${AUTHORIZED_RELEASE.tag}`]) await mkdir(path.join(OUTPUT, directory), { recursive: true });
  for (const name of PUBLIC_FILES) await writeFile(path.join(OUTPUT, 'public', name), files[name], { flag: 'wx' });
  for (const relative of ['updater-site/latest.json', 'updater-site/stable/latest.json']) await writeFile(path.join(OUTPUT, relative), files['latest.json'], { flag: 'wx' });
  for (const name of [AUTHORIZED_RELEASE.installerName, SIGNATURE_NAME, 'SHA256SUMS.txt']) await writeFile(path.join(OUTPUT, 'updater-site', 'artifacts', AUTHORIZED_RELEASE.tag, name), files[name], { flag: 'wx' });
  await writeFile(path.join(OUTPUT, 'updater-site', 'vercel.json'), `${JSON.stringify(policy, null, 2)}\n`, { flag: 'wx' });
  await writeFile(path.join(OUTPUT, 'internal', 'source-build-info.json'), sourceBuildInfo, { flag: 'wx' });
  await writeFile(path.join(OUTPUT, 'internal', 'authorized-public-evidence.json'), evidenceText, { flag: 'wx' });
  for (const name of PUBLIC_FILES) {
    requireCondition(sha256Hex(await readPlainFile(path.join(SOURCE, 'public', name))) === validated.hashes[name], '源 internal-test 产物在组装期间变化');
    requireCondition(sha256Hex(await readPlainFile(path.join(OUTPUT, 'public', name))) === validated.hashes[name], '独立公开副本 SHA-256 不一致');
  }
  requireCondition((await readFile(path.join(SOURCE, 'internal', 'build-info.json'))).equals(sourceBuildInfo), '源 build-info 在组装期间变化');
  const rootManifest = await readFile(path.join(OUTPUT, 'updater-site', 'latest.json'));
  requireCondition(rootManifest.equals(files['latest.json']) && rootManifest.equals(await readFile(path.join(OUTPUT, 'updater-site', 'stable', 'latest.json'))), '三个更新清单必须逐字节一致');
  requireCondition(runGit(['status', '--porcelain=v1', '--untracked-files=all']) === '' && runGit(['rev-parse', 'HEAD']) === git.head, '组装期间源工作区发生变化');
  console.log(JSON.stringify({ outputDirectory: OUTPUT, version: AUTHORIZED_RELEASE.version, windowsPublisher: 'NotSigned', genuineMinisignVerified: true, sourceUnchanged: true, uploaded: false, deployed: false }, null, 2));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
