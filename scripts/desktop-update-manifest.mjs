import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WINDOWS_X64_TARGET = 'windows-x86_64';
const RELEASE_CHANNELS = new Set(['stable', 'beta', 'internal-test']);
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function sha256Hex(content) {
  return createHash('sha256').update(content).digest('hex').toUpperCase();
}

export function validateDesktopVersion(version) {
  if (typeof version !== 'string' || !SEMVER_PATTERN.test(version)) {
    throw new Error(`桌面端版本不是有效的 SemVer：${String(version)}`);
  }
  return version;
}

export function validateReleaseChannel(channel, version) {
  if (!RELEASE_CHANNELS.has(channel)) {
    throw new Error(`不支持的桌面发布通道：${String(channel)}`);
  }

  const validatedVersion = validateDesktopVersion(version);
  const prerelease = validatedVersion.includes('-');
  if (channel === 'stable' && prerelease) {
    throw new Error(`stable 通道不能发布预发布版本：${validatedVersion}`);
  }
  if (channel === 'beta' && !prerelease) {
    throw new Error(`beta 通道必须使用 SemVer 预发布版本：${validatedVersion}`);
  }
  return channel;
}

function stableVersionCore(version) {
  const validated = validateDesktopVersion(version);
  if (validated.includes('-')) {
    throw new Error(`Stable 版本不能包含预发布标识：${validated}`);
  }
  const core = validated.split('+', 1)[0].split('.').map((part) => BigInt(part));
  return { validated, core };
}

export function compareStableDesktopVersions(leftVersion, rightVersion) {
  const left = stableVersionCore(leftVersion);
  const right = stableVersionCore(rightVersion);
  for (let index = 0; index < 3; index += 1) {
    if (left.core[index] > right.core[index]) return 1;
    if (left.core[index] < right.core[index]) return -1;
  }
  return 0;
}

export function assertStableDesktopUpgrade(candidateVersion, currentVersion) {
  const candidate = stableVersionCore(candidateVersion).validated;
  const current = stableVersionCore(currentVersion).validated;
  if (compareStableDesktopVersions(candidate, current) <= 0) {
    throw new Error(`Stable 版本必须单调递增：候选 ${candidate}，当前 ${current}`);
  }
  return { candidate, current };
}

export function expectedDesktopReleaseTag(version) {
  return `desktop-v${validateDesktopVersion(version)}`;
}

export function validateDesktopReleaseTag(tag, version, { required = false } = {}) {
  const expectedTag = expectedDesktopReleaseTag(version);
  if (!tag) {
    if (required) {
      throw new Error(`缺少桌面发布 Tag；期望 ${expectedTag}`);
    }
    return null;
  }
  if (tag !== expectedTag) {
    throw new Error(`桌面发布 Tag 与版本不一致：收到 ${tag}，期望 ${expectedTag}`);
  }
  return tag;
}

export function validateRepositorySlug(repository) {
  if (
    typeof repository !== 'string' ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)
  ) {
    throw new Error(`GitHub 仓库标识无效：${String(repository)}`);
  }
  return repository;
}

export function validateUpdaterSignature(signature) {
  if (typeof signature !== 'string') {
    throw new Error('更新签名必须是文本');
  }
  const normalized = signature.trim();
  if (normalized.length < 32 || normalized.length > 16_384 || normalized.includes('\0')) {
    throw new Error('更新签名为空、过短、过长或包含非法空字节');
  }
  if (/^https?:\/\//i.test(normalized)) {
    throw new Error('更新签名必须是 .sig 文件内容，不能是签名 URL');
  }
  if (
    /untrusted comment:\s*minisign (?:encrypted )?secret key/i.test(normalized) ||
    /BEGIN (?:ENCRYPTED )?PRIVATE KEY/i.test(normalized)
  ) {
    throw new Error('更新签名文件疑似包含私钥材料，拒绝发布');
  }
  return normalized;
}

export function buildDesktopArtifactUrl({
  repository,
  tag,
  installerName,
  assetBaseUrl
}) {
  const repositorySlug = validateRepositorySlug(repository);
  if (!/^desktop-v/.test(tag)) {
    throw new Error(`桌面发布 Tag 格式无效：${String(tag)}`);
  }
  if (
    typeof installerName !== 'string' ||
    !/^SeekOffer-Desktop-v.+-Windows-x64-Setup\.exe$/.test(installerName)
  ) {
    throw new Error(`桌面安装包文件名无效：${String(installerName)}`);
  }

  const base = new URL(
    assetBaseUrl || `https://github.com/${repositorySlug}/releases/download/`
  );
  if (base.protocol !== 'https:' || base.username || base.password) {
    throw new Error('更新资产基础地址必须是没有凭据的 HTTPS URL');
  }
  const encodedPath = [tag, installerName].map(encodeURIComponent).join('/');
  return new URL(encodedPath, `${base.href.replace(/\/$/, '')}/`).href;
}

export function createDesktopUpdateManifest({
  version,
  notes,
  pubDate,
  artifactUrl,
  signature
}) {
  const validatedVersion = validateDesktopVersion(version);
  const parsedDate = new Date(pubDate);
  if (Number.isNaN(parsedDate.valueOf())) {
    throw new Error(`更新发布日期无效：${String(pubDate)}`);
  }
  const artifact = new URL(artifactUrl);
  if (artifact.protocol !== 'https:' || artifact.username || artifact.password) {
    throw new Error('更新安装包必须使用没有凭据的 HTTPS URL');
  }

  return {
    version: validatedVersion,
    notes: typeof notes === 'string' ? notes.trim() : '',
    pub_date: parsedDate.toISOString(),
    platforms: {
      [WINDOWS_X64_TARGET]: {
        signature: validateUpdaterSignature(signature),
        url: artifact.href
      }
    }
  };
}

export function validateDesktopUpdateManifest(
  manifest,
  { expectedVersion, expectedUrl, expectedSignature } = {}
) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('latest.json 必须是 JSON 对象');
  }
  const version = validateDesktopVersion(manifest.version);
  if (expectedVersion && version !== expectedVersion) {
    throw new Error(`latest.json 版本不一致：${version} !== ${expectedVersion}`);
  }

  if (manifest.pub_date !== undefined) {
    const date = new Date(manifest.pub_date);
    if (Number.isNaN(date.valueOf()) || date.toISOString() !== manifest.pub_date) {
      throw new Error('latest.json 的 pub_date 必须是规范 RFC 3339/ISO 时间');
    }
  }

  const platforms = manifest.platforms;
  if (!platforms || typeof platforms !== 'object' || Array.isArray(platforms)) {
    throw new Error('latest.json 缺少 platforms 对象');
  }
  const target = platforms[WINDOWS_X64_TARGET];
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    throw new Error(`latest.json 缺少 ${WINDOWS_X64_TARGET} 更新项`);
  }
  const url = new URL(target.url);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('latest.json 的安装包地址必须是没有凭据的 HTTPS URL');
  }
  const signature = validateUpdaterSignature(target.signature);
  if (expectedUrl && url.href !== new URL(expectedUrl).href) {
    throw new Error(`latest.json 安装包地址不一致：${url.href}`);
  }
  if (expectedSignature && signature !== validateUpdaterSignature(expectedSignature)) {
    throw new Error('latest.json 中的签名与 .sig 文件不一致');
  }
  return manifest;
}

export function assertNoReleaseSecretLeak(text, environment = process.env) {
  const privatePatterns = [
    /-----BEGIN PRIVATE KEY-----/i,
    /-----BEGIN ENCRYPTED PRIVATE KEY-----/i,
    /untrusted comment:\s*minisign (?:encrypted )?secret key/i
  ];
  for (const pattern of privatePatterns) {
    if (pattern.test(text)) {
      throw new Error('发布产物疑似包含私钥材料');
    }
  }

  const secretNames = [
    'TAURI_SIGNING_PRIVATE_KEY',
    'TAURI_SIGNING_PRIVATE_KEY_PASSWORD',
    'WINDOWS_CERTIFICATE',
    'WINDOWS_CERTIFICATE_BASE64',
    'WINDOWS_CERTIFICATE_PASSWORD'
  ];
  for (const secretName of secretNames) {
    const value = environment[secretName];
    if (typeof value === 'string' && value.length >= 8 && text.includes(value)) {
      throw new Error(`发布产物包含 ${secretName} 的值，拒绝写入磁盘`);
    }
  }
}

export async function verifyDesktopUpdateManifestFile(
  manifestPath,
  expectations = {},
  environment = process.env
) {
  const raw = await readFile(manifestPath, 'utf8');
  assertNoReleaseSecretLeak(raw, environment);
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (error) {
    throw new Error(`latest.json 不是有效 JSON：${error.message}`);
  }
  return validateDesktopUpdateManifest(manifest, expectations);
}

function readCliOption(name) {
  const optionIndex = process.argv.indexOf(name);
  if (optionIndex === -1) return undefined;
  return process.argv[optionIndex + 1];
}

async function runCli() {
  const [, , command, inputPath] = process.argv;
  if (command !== 'verify' || !inputPath) {
    throw new Error(
      '用法：node scripts/desktop-update-manifest.mjs verify <latest.json> [--version x.y.z] [--url https://...] [--signature-file file.sig]'
    );
  }
  const signatureFile = readCliOption('--signature-file');
  const expectedSignature = signatureFile
    ? await readFile(path.resolve(signatureFile), 'utf8')
    : undefined;
  await verifyDesktopUpdateManifestFile(path.resolve(inputPath), {
    expectedVersion: readCliOption('--version'),
    expectedUrl: readCliOption('--url'),
    expectedSignature
  });
  process.stdout.write(`已验证更新清单：${path.resolve(inputPath)}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

export const desktopUpdateManifestConstants = Object.freeze({
  target: WINDOWS_X64_TARGET,
  helperPath: fileURLToPath(import.meta.url)
});
