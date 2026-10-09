import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { AUTHORIZED_RELEASE, assertAuthorizedReleaseText, assertFreshAuthorizedOutput, parseAuthorizedSums, requireReleaseAcknowledgement, validateAuthorizedInputs } from '../scripts/prepare-desktop-v0.2.29-authorized-release.mjs';
import { createDesktopUpdateManifest, sha256Hex } from '../scripts/desktop-update-manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryParent = path.join(root, 'artifacts', 'authorized-release-validation-tests');
const temporaryRoots = [];
const revision = '1234567890abcdef1234567890abcdef12345678';
const installerName = AUTHORIZED_RELEASE.installerName, signatureName = `${installerName}.sig`;

function fixture() {
  const builtAt = '2026-10-09T00:00:00.000Z';
  const installer = Buffer.alloc(100001); installer.write('MZ');
  const signature = Buffer.from('Synthetic signature fixture only. Not an actual Minisign verification.').toString('base64');
  const notes = '寻鹿 0.2.29\n';
  const manifest = createDesktopUpdateManifest({ version: '0.2.29', notes, pubDate: builtAt, artifactUrl: AUTHORIZED_RELEASE.artifactUrl, signature });
  const files = {
    [installerName]: installer, [signatureName]: Buffer.from(signature),
    'latest.json': Buffer.from(`${JSON.stringify(manifest)}\n`), 'RELEASE-NOTES.zh-CN.md': Buffer.from(notes), 'INSTALL.zh-CN.md': Buffer.from('Windows 安装指南\n')
  };
  const hashes = Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, sha256Hex(bytes)]));
  files['SHA256SUMS.txt'] = Buffer.from([installerName, signatureName, 'latest.json'].map(name => `${hashes[name]}  ${name}\n`).join(''));
  return {
    packageVersion: '0.2.29', tauriVersion: '0.2.29', tauriIdentifier: 'com.seekoffer.desktop', files,
    git: { status: '', head: revision, tagCommit: revision, tagType: 'tag', origin: 'https://github.com/fjsfry/seekoffer-v1.git', commitTime: Date.parse(builtAt) / 1000 - 60 },
    authenticode: { status: 'NotSigned', thumbprint: '', timestamped: false, productVersion: '0.2.29.0' },
    buildInfo: {
      version: '0.2.29', applicationId: 'com.seekoffer.desktop', releaseChannel: 'internal-test', platform: 'windows', architecture: 'x64', bundleType: 'nsis', automaticUpdatesConfigured: true,
      source: { revision, workingTreeDirty: false, repository: 'fjsfry/seekoffer-v1', buildInputFileCount: 3000, buildInputsSha256: 'A'.repeat(64) },
      installer: { file: `public/${installerName}`, sizeBytes: installer.length, sha256: hashes[installerName], authenticodeStatus: 'NotSigned', authenticodeThumbprint: null, authenticodeTimestamped: false },
      applicationAuthenticode: null,
      updater: { releaseTag: 'desktop-v0.2.29', target: 'windows-x86_64', artifactUrl: AUTHORIZED_RELEASE.artifactUrl, signatureCryptographicallyVerified: true, signatureFile: `public/${signatureName}`, signatureSha256: hashes[signatureName], manifestFile: 'public/latest.json', manifestSha256: hashes['latest.json'] },
      builtAt, packagedAt: builtAt
    }
  };
}

afterEach(async () => {
  for (const directory of temporaryRoots.splice(0)) {
    if (!path.resolve(directory).startsWith(path.resolve(temporaryParent) + path.sep)) throw new Error('Unsafe test cleanup target');
    await rm(directory, { recursive: true, force: true });
  }
});

describe('one-off desktop 0.2.29 authorized public assembly', () => {
  it('pins this acknowledgement to the new version, tag, directories and immutable GitHub asset', () => {
    expect(Object.isFrozen(AUTHORIZED_RELEASE)).toBe(true);
    expect(AUTHORIZED_RELEASE).toMatchObject({
      version: '0.2.29', tag: 'desktop-v0.2.29', repository: 'fjsfry/seekoffer-v1',
      sourceName: 'v0.2.29-internal-test', outputName: 'v0.2.29-authorized-public',
      installerName: 'SeekOffer-Desktop-v0.2.29-Windows-x64-Setup.exe',
      artifactUrl: 'https://github.com/fjsfry/seekoffer-v1/releases/download/desktop-v0.2.29/SeekOffer-Desktop-v0.2.29-Windows-x64-Setup.exe',
      policyBaselineRevision: '0443ee78fdbd7097b102647814b007195496170b'
    });
  });

  it('requires an exact affirmative acknowledgement and accepts no version, path or bypass option', () => {
    expect(() => requireReleaseAcknowledgement(['--acknowledge-unsigned-publisher'])).not.toThrow();
    for (const args of [[], ['--force'], ['--version', '0.2.30'], ['--acknowledge-unsigned-publisher', '--skip-signature'], ['--acknowledge-unsigned-publisher', '--output', '../other']]) {
      expect(() => requireReleaseAcknowledgement(args)).toThrow('仅允许本次固定');
    }
  });

  it('validates fixed version and preserves the internal-test provenance instead of renaming its channel', () => {
    const input = fixture(), original = JSON.stringify(input.buildInfo);
    const result = validateAuthorizedInputs(input);
    expect(result.manifest.version).toBe('0.2.29');
    expect(JSON.stringify(input.buildInfo)).toBe(original);
    input.buildInfo.releaseChannel = 'stable';
    expect(() => validateAuthorizedInputs(input)).toThrow('仍是原始 internal-test');
    input.buildInfo.releaseChannel = 'internal-test';
    input.packageVersion = '0.2.30';
    expect(() => validateAuthorizedInputs(input)).toThrow('固定 0.2.29');
  });

  it('rejects previous and future versions in every source version field and Windows product metadata', () => {
    for (const version of ['0.2.28', '0.2.30']) {
      for (const change of [
        value => { value.packageVersion = version; },
        value => { value.tauriVersion = version; },
        value => { value.buildInfo.version = version; },
        value => { value.authenticode.productVersion = `${version}.0`; },
        value => { value.buildInfo.updater.releaseTag = `desktop-v${version}`; }
      ]) {
        const input = fixture(); change(input);
        expect(() => validateAuthorizedInputs(input)).toThrow();
      }
    }
  });

  it('requires clean build and live worktree evidence and an annotated tag at the exact source commit', () => {
    for (const change of [
      value => { value.git.status = ' M package.json'; },
      value => { value.buildInfo.source.workingTreeDirty = true; },
      value => { value.git.tagCommit = 'f'.repeat(40); },
      value => { value.buildInfo.source.revision = 'f'.repeat(40); },
      value => { value.git.tagType = 'commit'; }
    ]) {
      const input = fixture(); change(input);
      expect(() => validateAuthorizedInputs(input)).toThrow();
    }
  });

  it('rejects unchecked, invalid, falsely signed or timestamped publisher evidence', () => {
    for (const change of [
      value => { value.authenticode.status = 'unchecked'; },
      value => { value.authenticode.status = 'HashMismatch'; },
      value => { value.authenticode.status = 'Valid'; },
      value => { value.authenticode.thumbprint = 'A'.repeat(40); },
      value => { value.authenticode.timestamped = true; },
      value => { value.authenticode.productVersion = '0.2.27'; },
      value => { value.buildInfo.installer.authenticodeStatus = 'Valid'; }
    ]) {
      const input = fixture(); change(input);
      expect(() => validateAuthorizedInputs(input)).toThrow();
    }
  });

  it('rejects all three immutable asset hash mismatches', () => {
    for (const name of [installerName, signatureName, 'latest.json']) {
      const input = fixture(); input.files[name] = Buffer.concat([input.files[name], Buffer.from('tampered')]);
      expect(() => validateAuthorizedInputs(input)).toThrow();
    }
  });

  it('rejects a different repository or artifact destination even when the version matches', () => {
    const input = fixture(); input.git.origin = 'https://github.com/other/seekoffer-v1';
    expect(() => validateAuthorizedInputs(input)).toThrow('固定寻鹿仓库');
    input.git.origin = 'https://github.com/fjsfry/seekoffer-v1';
    input.buildInfo.updater.artifactUrl = 'https://example.com/desktop-v0.2.29/installer.exe';
    expect(() => validateAuthorizedInputs(input)).toThrow('更新源/Tag');
  });

  it('rejects metadata that claims no original cryptographic verification', () => {
    const input = fixture(); input.buildInfo.updater.signatureCryptographicallyVerified = false;
    expect(() => validateAuthorizedInputs(input)).toThrow('原验签记录');
  });

  it('rejects source builds older than their source commit', () => {
    const input = fixture(); input.git.commitTime += 120;
    expect(() => validateAuthorizedInputs(input)).toThrow('早于源提交');
  });

  it('rejects extra files and plaintext or Base64 private keys', () => {
    const input = fixture(); input.files['private.key'] = Buffer.from('forbidden');
    expect(() => validateAuthorizedInputs(input)).toThrow('额外文件');
    const secret = 'untrusted comment: minisign encrypted secret key\nThis is a synthetic forbidden fixture only';
    expect(() => assertAuthorizedReleaseText(secret)).toThrow('私钥');
    expect(() => assertAuthorizedReleaseText(Buffer.from(secret).toString('base64'))).toThrow('Base64 私钥');
    expect(() => assertAuthorizedReleaseText('-----BEGIN RSA PRIVATE KEY-----')).toThrow('私钥');
  });

  it('rejects duplicate or path-traversing checksum entries', () => {
    expect(() => parseAuthorizedSums(`${'A'.repeat(64)}  ../installer.exe\n`)).toThrow();
    expect(() => parseAuthorizedSums(`${'A'.repeat(64)}  a.exe\n${'A'.repeat(64)}  a.exe\n`)).toThrow('重复');
  });

  it('refuses an existing output rather than deleting or overwriting it', async () => {
    await mkdir(temporaryParent, { recursive: true });
    const directory = await mkdtemp(path.join(temporaryParent, 'case-')); temporaryRoots.push(directory);
    await expect(assertFreshAuthorizedOutput(directory)).rejects.toThrow('拒绝覆盖');
    await expect(assertFreshAuthorizedOutput(path.join(directory, 'new-output'))).resolves.toBeUndefined();
  });

  it('keeps actual assembly bound to live crypto/Windows checks with no skip hooks', async () => {
    const source = await readFile(path.join(root, 'scripts', 'prepare-desktop-v0.2.29-authorized-release.mjs'), 'utf8');
    expect(source).toContain("execFileSync('cargo', ['run', '--quiet', '--locked'");
    expect(source).toContain("'--example', 'verify_updater_signature'");
    expect(source).toContain('Get-AuthenticodeSignature -LiteralPath');
    expect(source).toContain('verifyRealMinisign(installerPath');
    expect(source).toContain("runGit(['diff', '--exit-code', AUTHORIZED_RELEASE.policyBaselineRevision, 'HEAD'");
    expect(source).toContain("await mkdir(OUTPUT)");
    expect(source).not.toContain('SEEKOFFER_ALLOW');
    expect(source).not.toContain('skipSignature');
    expect(source).not.toContain('rm(');
  });
});
