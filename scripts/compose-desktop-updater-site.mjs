import { createHash } from 'node:crypto';
import {
  copyFile,
  cp,
  mkdir,
  readFile,
  readdir,
  stat
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  assertStableDesktopUpgrade,
  validateDesktopUpdateManifest,
  validateDesktopVersion
} from './desktop-update-manifest.mjs';

const WINDOWS_TARGET = 'windows-x86_64';
const POINTER_PATHS = new Set(['latest.json', 'stable/latest.json']);

function sha256(content) {
  return createHash('sha256').update(content).digest('hex').toUpperCase();
}

async function requireFile(filePath, label) {
  const fileStats = await stat(filePath).catch(() => null);
  if (!fileStats?.isFile()) throw new Error(`${label}不存在：${filePath}`);
  return filePath;
}

async function requireDirectory(directoryPath, label) {
  const directoryStats = await stat(directoryPath).catch(() => null);
  if (!directoryStats?.isDirectory()) {
    throw new Error(`${label}不存在：${directoryPath}`);
  }
  return directoryPath;
}

async function listFiles(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) return listFiles(entryPath);
      return entry.isFile() ? [entryPath] : [];
    })
  );
  return nested.flat();
}

async function readManifestPair(siteDirectory, label) {
  const rootPath = await requireFile(
    path.join(siteDirectory, 'latest.json'),
    `${label}根更新清单`
  );
  const stablePath = await requireFile(
    path.join(siteDirectory, 'stable', 'latest.json'),
    `${label}Stable 更新清单`
  );
  const [rootBytes, stableBytes] = await Promise.all([
    readFile(rootPath),
    readFile(stablePath)
  ]);
  if (!rootBytes.equals(stableBytes)) {
    throw new Error(`${label}的 latest.json 与 stable/latest.json 必须逐字节一致`);
  }
  const manifest = JSON.parse(rootBytes.toString('utf8'));
  validateDesktopUpdateManifest(manifest);
  return { manifest, rootBytes, rootPath, stablePath };
}

async function readHashesByRelativePath(directoryPath, ignoredPaths = new Set()) {
  const files = await listFiles(directoryPath);
  const hashes = new Map();
  for (const filePath of files) {
    const relativePath = path
      .relative(directoryPath, filePath)
      .split(path.sep)
      .join('/');
    if (ignoredPaths.has(relativePath)) continue;
    hashes.set(relativePath, sha256(await readFile(filePath)));
  }
  return hashes;
}

function assertSameHashes(expected, actual, label) {
  if (expected.size !== actual.size) {
    throw new Error(`${label}文件数量发生变化：${expected.size} !== ${actual.size}`);
  }
  for (const [relativePath, expectedHash] of expected) {
    const actualHash = actual.get(relativePath);
    if (actualHash !== expectedHash) {
      throw new Error(`${label}文件被修改：${relativePath}`);
    }
  }
}

function parseSha256Sums(text) {
  const entries = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = line.match(/^([0-9A-Fa-f]{64})\s+(.+)$/);
    if (!match) throw new Error(`SHA256SUMS.txt 行格式无效：${line}`);
    entries.set(match[2], match[1].toUpperCase());
  }
  return entries;
}

async function validateCandidateArtifact(candidateDirectory, manifest) {
  const version = validateDesktopVersion(manifest.version);
  const releaseTag = `desktop-v${version}`;
  const artifactDirectory = await requireDirectory(
    path.join(candidateDirectory, 'artifacts', releaseTag),
    '候选版本化资产目录'
  );
  const installerName = `SeekOffer-Desktop-v${version}-Windows-x64-Setup.exe`;
  const signatureName = `${installerName}.sig`;
  const installerPath = await requireFile(
    path.join(artifactDirectory, installerName),
    '候选安装包'
  );
  const signaturePath = await requireFile(
    path.join(artifactDirectory, signatureName),
    '候选 Tauri 签名'
  );
  const sumsPath = await requireFile(
    path.join(artifactDirectory, 'SHA256SUMS.txt'),
    '候选 SHA256SUMS'
  );
  const [installerBytes, signatureBytes, sumsText] = await Promise.all([
    readFile(installerPath),
    readFile(signaturePath),
    readFile(sumsPath, 'utf8')
  ]);
  const sums = parseSha256Sums(sumsText);
  if (sums.get(installerName) !== sha256(installerBytes)) {
    throw new Error('候选安装包 SHA-256 与 SHA256SUMS.txt 不一致');
  }
  if (sums.get(signatureName) !== sha256(signatureBytes)) {
    throw new Error('候选 .sig SHA-256 与 SHA256SUMS.txt 不一致');
  }
  const target = manifest.platforms?.[WINDOWS_TARGET];
  if (target?.signature !== signatureBytes.toString('utf8').trim()) {
    throw new Error('候选清单签名与 .sig 文件不一致');
  }
  const manifestUrl = new URL(target.url);
  if (!manifestUrl.pathname.endsWith(`/${releaseTag}/${installerName}`)) {
    throw new Error('候选清单 URL 未绑定当前版本化资产');
  }
  return { artifactDirectory, installerName, releaseTag, version };
}

function assertIndependentOutput(baseDirectory, candidateDirectory, outputDirectory) {
  for (const inputDirectory of [baseDirectory, candidateDirectory]) {
    const relative = path.relative(inputDirectory, outputDirectory);
    if (!relative || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
      throw new Error('输出目录不能位于输入 updater-site 内部');
    }
  }
}

export async function composeDesktopUpdaterSite({
  baseDirectory,
  candidateDirectory,
  outputDirectory,
  expectedVersion
}) {
  const base = path.resolve(baseDirectory);
  const candidate = path.resolve(candidateDirectory);
  const output = path.resolve(outputDirectory);
  assertIndependentOutput(base, candidate, output);
  await requireDirectory(base, '已验证生产 updater-site');
  await requireDirectory(candidate, '已验证 Stable 候选 updater-site');
  if (await stat(output).catch(() => null)) {
    throw new Error(`输出目录已存在，拒绝覆盖：${output}`);
  }

  const [basePair, candidatePair] = await Promise.all([
    readManifestPair(base, '生产基线'),
    readManifestPair(candidate, 'Stable 候选')
  ]);
  const version = validateDesktopVersion(candidatePair.manifest.version);
  if (expectedVersion && version !== validateDesktopVersion(expectedVersion)) {
    throw new Error(`候选版本不一致：${version} !== ${expectedVersion}`);
  }
  assertStableDesktopUpgrade(version, basePair.manifest.version);

  const [baseVercel, candidateVercel] = await Promise.all([
    readFile(await requireFile(path.join(base, 'vercel.json'), '生产 vercel.json')),
    readFile(await requireFile(path.join(candidate, 'vercel.json'), '候选 vercel.json'))
  ]);
  if (JSON.stringify(JSON.parse(baseVercel)) !== JSON.stringify(JSON.parse(candidateVercel))) {
    throw new Error('候选 updater-site 的缓存/CORS 策略与生产基线不一致');
  }

  const candidateArtifact = await validateCandidateArtifact(
    candidate,
    candidatePair.manifest
  );
  const outputArtifactDirectory = path.join(
    output,
    'artifacts',
    candidateArtifact.releaseTag
  );
  if (await stat(path.join(base, 'artifacts', candidateArtifact.releaseTag)).catch(() => null)) {
    throw new Error(`生产基线已包含 ${candidateArtifact.releaseTag}，拒绝覆盖不可变资产`);
  }

  const baseImmutableHashes = await readHashesByRelativePath(base, POINTER_PATHS);
  const candidateArtifactHashes = await readHashesByRelativePath(
    candidateArtifact.artifactDirectory
  );

  await cp(base, output, { recursive: true, errorOnExist: true, force: false });
  await mkdir(path.dirname(outputArtifactDirectory), { recursive: true });
  await cp(candidateArtifact.artifactDirectory, outputArtifactDirectory, {
    recursive: true,
    errorOnExist: true,
    force: false
  });
  await mkdir(path.join(output, 'stable'), { recursive: true });
  await copyFile(candidatePair.rootPath, path.join(output, 'latest.json'));
  await copyFile(candidatePair.stablePath, path.join(output, 'stable', 'latest.json'));

  const [outputPair, outputImmutableHashes, outputCandidateHashes] = await Promise.all([
    readManifestPair(output, '组装结果'),
    readHashesByRelativePath(output, new Set([
      ...POINTER_PATHS,
      ...[...candidateArtifactHashes.keys()].map(
        (relativePath) => `artifacts/${candidateArtifact.releaseTag}/${relativePath}`
      )
    ])),
    readHashesByRelativePath(outputArtifactDirectory)
  ]);
  validateDesktopUpdateManifest(outputPair.manifest, { expectedVersion: version });
  assertSameHashes(baseImmutableHashes, outputImmutableHashes, '生产历史资产');
  assertSameHashes(candidateArtifactHashes, outputCandidateHashes, '候选版本化资产');

  return {
    baseVersion: basePair.manifest.version,
    version,
    releaseTag: candidateArtifact.releaseTag,
    outputDirectory: output,
    preservedFileCount: baseImmutableHashes.size,
    candidateFileCount: candidateArtifactHashes.size
  };
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) return '';
  return process.argv[index + 1];
}

async function main() {
  const baseDirectory = readOption('--base');
  const candidateDirectory = readOption('--candidate');
  const outputDirectory = readOption('--output');
  const expectedVersion = readOption('--version') || undefined;
  if (!baseDirectory || !candidateDirectory || !outputDirectory) {
    throw new Error(
      '用法：node scripts/compose-desktop-updater-site.mjs --base <production-site> --candidate <stable-site> --output <new-site> [--version x.y.z]'
    );
  }
  const result = await composeDesktopUpdaterSite({
    baseDirectory,
    candidateDirectory,
    outputDirectory,
    expectedVersion
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : '';
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
