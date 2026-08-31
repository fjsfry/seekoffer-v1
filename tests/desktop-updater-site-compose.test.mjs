import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { composeDesktopUpdaterSite } from '../scripts/compose-desktop-updater-site.mjs';
import { createDesktopUpdateManifest } from '../scripts/desktop-update-manifest.mjs';

const temporaryRoots = [];
const signature =
  'untrusted comment: signature from minisign secret key\nRWQ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN';
const vercelPolicy = {
  headers: [
    {
      source: '/latest.json',
      headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }]
    }
  ]
};

function hash(content) {
  return createHash('sha256').update(content).digest('hex').toUpperCase();
}

async function createRoot() {
  const root = await mkdtemp(path.join(tmpdir(), 'seekoffer-updater-compose-'));
  temporaryRoots.push(root);
  return root;
}

async function writeStableSite(root, version, { validSums = true } = {}) {
  const releaseTag = `desktop-v${version}`;
  const installerName = `SeekOffer-Desktop-v${version}-Windows-x64-Setup.exe`;
  const signatureName = `${installerName}.sig`;
  const artifactDirectory = path.join(root, 'artifacts', releaseTag);
  const installer = Buffer.from(`installer-${version}`);
  const signatureBytes = Buffer.from(signature);
  const manifest = createDesktopUpdateManifest({
    version,
    notes: `SeekOffer ${version}`,
    pubDate: '2026-08-31T10:00:00.000Z',
    artifactUrl: `https://github.com/fjsfry/seekoffer-v1/releases/download/${releaseTag}/${installerName}`,
    signature
  });
  await mkdir(path.join(root, 'stable'), { recursive: true });
  await mkdir(artifactDirectory, { recursive: true });
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  await Promise.all([
    writeFile(path.join(root, 'latest.json'), manifestText),
    writeFile(path.join(root, 'stable', 'latest.json'), manifestText),
    writeFile(path.join(root, 'vercel.json'), `${JSON.stringify(vercelPolicy, null, 2)}\n`),
    writeFile(path.join(artifactDirectory, installerName), installer),
    writeFile(path.join(artifactDirectory, signatureName), signatureBytes),
    writeFile(
      path.join(artifactDirectory, 'SHA256SUMS.txt'),
      `${validSums ? hash(installer) : '0'.repeat(64)}  ${installerName}\n${hash(signatureBytes)}  ${signatureName}\n`
    )
  ]);
  return { artifactDirectory, installerName, manifest };
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe('desktop updater-site composition', () => {
  it('preserves historical assets while atomically advancing both Stable pointers', async () => {
    const root = await createRoot();
    const base = path.join(root, 'base');
    const candidate = path.join(root, 'candidate');
    const output = path.join(root, 'output');
    await writeStableSite(base, '0.2.19');
    await writeFile(path.join(base, 'artifacts', 'historical-anchor.txt'), 'keep-me');
    await writeStableSite(candidate, '0.2.21');

    const result = await composeDesktopUpdaterSite({
      baseDirectory: base,
      candidateDirectory: candidate,
      outputDirectory: output,
      expectedVersion: '0.2.21'
    });

    expect(result).toMatchObject({ baseVersion: '0.2.19', version: '0.2.21' });
    const rootManifest = await readFile(path.join(output, 'latest.json'));
    const stableManifest = await readFile(path.join(output, 'stable', 'latest.json'));
    expect(rootManifest.equals(stableManifest)).toBe(true);
    expect(JSON.parse(rootManifest).version).toBe('0.2.21');
    expect(await readFile(path.join(output, 'artifacts', 'historical-anchor.txt'), 'utf8')).toBe(
      'keep-me'
    );
    await expect(
      readFile(
        path.join(
          output,
          'artifacts',
          'desktop-v0.2.21',
          'SeekOffer-Desktop-v0.2.21-Windows-x64-Setup.exe'
        )
      )
    ).resolves.toBeInstanceOf(Buffer);
  });

  it('rejects an internal-test directory that has no Stable pointers', async () => {
    const root = await createRoot();
    const base = path.join(root, 'base');
    const candidate = path.join(root, 'candidate');
    await writeStableSite(base, '0.2.19');
    await mkdir(path.join(candidate, 'internal-test'), { recursive: true });
    await writeFile(path.join(candidate, 'internal-test', 'latest.json'), '{}');

    await expect(
      composeDesktopUpdaterSite({
        baseDirectory: base,
        candidateDirectory: candidate,
        outputDirectory: path.join(root, 'output')
      })
    ).rejects.toThrow('Stable 候选根更新清单不存在');
  });

  it('rejects a candidate that is not newer than the production baseline', async () => {
    const root = await createRoot();
    const base = path.join(root, 'base');
    const candidate = path.join(root, 'candidate');
    await writeStableSite(base, '0.2.19');
    await writeStableSite(candidate, '0.2.19');

    await expect(
      composeDesktopUpdaterSite({
        baseDirectory: base,
        candidateDirectory: candidate,
        outputDirectory: path.join(root, 'output')
      })
    ).rejects.toThrow('Stable 版本必须单调递增');
  });

  it('rejects candidate bytes that do not match SHA256SUMS', async () => {
    const root = await createRoot();
    const base = path.join(root, 'base');
    const candidate = path.join(root, 'candidate');
    await writeStableSite(base, '0.2.19');
    await writeStableSite(candidate, '0.2.21', { validSums: false });

    await expect(
      composeDesktopUpdaterSite({
        baseDirectory: base,
        candidateDirectory: candidate,
        outputDirectory: path.join(root, 'output')
      })
    ).rejects.toThrow('候选安装包 SHA-256');
  });

  it('never overwrites a previous promotion directory', async () => {
    const root = await createRoot();
    const base = path.join(root, 'base');
    const candidate = path.join(root, 'candidate');
    const output = path.join(root, 'output');
    await writeStableSite(base, '0.2.19');
    await writeStableSite(candidate, '0.2.21');
    await mkdir(output);

    await expect(
      composeDesktopUpdaterSite({
        baseDirectory: base,
        candidateDirectory: candidate,
        outputDirectory: output
      })
    ).rejects.toThrow('输出目录已存在');
  });
});
