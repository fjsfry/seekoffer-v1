import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const workflowSource = readFileSync(
  resolve(root, '.github/workflows/desktop-release.yml'),
  'utf8'
).replace(/\r\n/g, '\n');
const releaseConfig = JSON.parse(
  readFileSync(resolve(root, 'src-tauri/tauri.release.conf.json'), 'utf8')
);
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const prepareSource = readFileSync(
  resolve(root, 'scripts/prepare-windows-signing-certificate.ps1'),
  'utf8'
).replace(/\r\n/g, '\n');
const signerSource = readFileSync(
  resolve(root, 'scripts/sign-windows-artifact.ps1'),
  'utf8'
).replace(/\r\n/g, '\n');
const packagingSource = readFileSync(
  resolve(root, 'scripts/package-desktop-release.mjs'),
  'utf8'
).replace(/\r\n/g, '\n');
const localReleaseSource = readFileSync(
  resolve(root, 'scripts/invoke-desktop-signed-release.ps1'),
  'utf8'
).replace(/\r\n/g, '\n');
const operationsSource = readFileSync(
  resolve(root, 'docs/desktop-auto-update-operations.md'),
  'utf8'
).replace(/\r\n/g, '\n');

function findStepSource(name) {
  const marker = `      - name: ${name}`;
  const start = workflowSource.indexOf(marker);
  expect(start, name).toBeGreaterThanOrEqual(0);
  const next = workflowSource.indexOf('\n      - name:', start + marker.length);
  return workflowSource.slice(start, next === -1 ? undefined : next);
}

describe('desktop Stable Authenticode release contract', () => {
  it('routes every Tauri Windows binary through the audited sign command', () => {
    expect(releaseConfig.bundle.windows.signCommand).toEqual({
      cmd: 'powershell.exe',
      args: [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        '../scripts/sign-windows-artifact.ps1',
        '%1'
      ]
    });
    expect(packageJson.scripts['desktop:bundle']).toContain(
      '--config ./src-tauri/tauri.release.conf.json'
    );
  });

  it('uses SHA-256 SignTool signing, RFC 3161 timestamping and strict verification', () => {
    expect(signerSource).toContain('& $signtool sign');
    expect(signerSource).toContain('/fd SHA256');
    expect(signerSource).toContain('/td SHA256');
    expect(signerSource).toContain('/tr $timestampUri.AbsoluteUri');
    expect(signerSource).toContain('& $signtool verify /pa /all /v');
    expect(signerSource).toContain("@('.exe', '.dll', '.tmp')");
    expect(signerSource).toContain('Windows PE MZ header');
    expect(signerSource).toContain("$signature.Status -ne 'Valid'");
    expect(signerSource).toContain('$signature.TimeStamperCertificate');
    expect(signerSource).toContain('$actualThumbprint -ne $expectedThumbprint');
    expect(signerSource).not.toContain('New-SelfSignedCertificate');
    expect(signerSource).not.toContain('Set-AuthenticodeSignature');
  });

  it('validates protected PFX identity, purpose and lifetime without importing it', () => {
    expect(prepareSource).toContain('FromBase64String');
    expect(prepareSource).toContain('X509KeyStorageFlags]::EphemeralKeySet');
    expect(prepareSource).toContain('HasPrivateKey');
    expect(prepareSource).toContain("'1.3.6.1.5.5.7.3.3'");
    expect(prepareSource).toContain('UtcNow.AddDays(14)');
    expect(prepareSource).toContain('$actualThumbprint -ne $expectedThumbprint');
    expect(prepareSource).toContain('SEEKOFFER_AUTHENTICODE_REQUIRED=true');
    expect(prepareSource).toContain("[Guid]::NewGuid().ToString('N')");
    expect(prepareSource).toContain('[IO.FileMode]::CreateNew');
    expect(prepareSource).toContain('SetAccessRuleProtection($true, $false)');
    expect(prepareSource).not.toContain('Import-PfxCertificate');
    expect(prepareSource).not.toContain('New-SelfSignedCertificate');
  });

  it('keeps certificate material out of compile and exposes it only to final bundle', () => {
    const compileName = 'Compile desktop application without signing secrets';
    const prepareName = 'Prepare protected Authenticode certificate';
    const bundleName =
      'Build Tauri-signed and Authenticode-signed NSIS update artifact';
    const verifyName = 'Verify Authenticode signing coverage';
    const cleanupName = 'Remove protected Authenticode certificate material';
    const packageName = 'Package and validate updater release';
    const compileIndex = workflowSource.indexOf(compileName);
    const prepareIndex = workflowSource.indexOf(prepareName);
    const bundleIndex = workflowSource.indexOf(bundleName);
    const verifyIndex = workflowSource.indexOf(verifyName);
    const cleanupIndex = workflowSource.indexOf(cleanupName);
    const packageIndex = workflowSource.indexOf(packageName);

    expect(compileIndex).toBeGreaterThanOrEqual(0);
    expect(compileIndex).toBeLessThan(prepareIndex);
    expect(prepareIndex).toBeLessThan(bundleIndex);
    expect(bundleIndex).toBeLessThan(verifyIndex);
    expect(verifyIndex).toBeLessThan(cleanupIndex);
    expect(cleanupIndex).toBeLessThan(packageIndex);

    const compileStep = findStepSource(compileName);
    expect(compileStep).not.toMatch(/WINDOWS_CERTIFICATE|AUTHENTICODE_PFX/);

    const prepareStep = findStepSource(prepareName);
    expect(prepareStep).toContain(
      'WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}'
    );
    expect(prepareStep).toContain(
      'WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}'
    );
    expect(prepareStep).toContain(
      'SEEKOFFER_AUTHENTICODE_EXPECTED_THUMBPRINT: ${{ vars.WINDOWS_CERTIFICATE_THUMBPRINT }}'
    );

    const bundleStep = findStepSource(bundleName);
    expect(bundleStep).toContain(
      'SEEKOFFER_AUTHENTICODE_PFX_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}'
    );
    expect(bundleStep).not.toMatch(/^\s+WINDOWS_CERTIFICATE:/m);

    const cleanupStep = findStepSource(cleanupName);
    expect(cleanupStep).toContain('if: always()');
    expect(cleanupStep).toContain('Remove-Item');
  });

  it('fails Stable unless the patched app and final installer share the pinned certificate', () => {
    expect(workflowSource).toContain(
      'name: desktop-${{ needs.prepare.outputs.channel }}'
    );
    expect(workflowSource).toContain(
      "SEEKOFFER_REQUIRE_VALID_AUTHENTICODE: 'true'"
    );

    const verifyStep = findStepSource('Verify Authenticode signing coverage');
    expect(verifyStep).toContain('src-tauri/target/release/seekoffer-desktop.exe');
    expect(verifyStep).toContain('_x64-setup.exe');
    expect(verifyStep).toContain(
      'SEEKOFFER_AUTHENTICODE_EXPECTED_THUMBPRINT'
    );
    expect(packagingSource).toContain(
      "process.env.SEEKOFFER_REQUIRE_VALID_AUTHENTICODE === 'true'"
    );
    expect(packagingSource).toContain("authenticodeStatus !== 'Valid'");
    expect(packagingSource).toContain("const stableRelease = releaseChannel === 'stable'");
    expect(packagingSource).toContain('authenticode.thumbprint !== expectedThumbprint');
    expect(packagingSource).toContain('!authenticode.timestamped');
    expect(packagingSource).toContain('SEEKOFFER_CURRENT_STABLE_VERSION');
    expect(packagingSource).toContain('assertStableDesktopUpgrade');
    expect(localReleaseSource).toContain('Local release helpers cannot create Stable-named artifacts');
  });

  it('loads the Windows security module before reading installer signatures', () => {
    expect(packagingSource).toContain(
      'Remove-TypeData -TypeName System.Security.AccessControl.ObjectSecurity -ErrorAction SilentlyContinue'
    );
    expect(packagingSource).toContain(
      'Import-Module Microsoft.PowerShell.Security -Scope Local -ErrorAction Stop'
    );
    expect(packagingSource).toContain(
      'Get-AuthenticodeSignature -LiteralPath $env:SEEK_DESKTOP_INSTALLER'
    );
  });

  it('does not interpolate untrusted Git ref names into shell source', () => {
    const metadataStep = findStepSource('Resolve and validate release metadata');
    expect(metadataStep).toContain('REF_NAME: ${{ github.ref_name }}');
    expect(metadataStep).toContain('release_tag="$REF_NAME"');
    expect(metadataStep).not.toContain("release_tag='${{ github.ref_name }}'");
    expect(metadataStep).toContain('git show-ref --verify --quiet "$tag_ref"');
    expect(metadataStep).toContain('--prune --prune-tags');
    expect(metadataStep).toContain('git checkout --detach "$release_commit"');
    expect(workflowSource).toContain('ref: ${{ needs.prepare.outputs.release_commit }}');
    expect(workflowSource.match(/--prune --prune-tags/g)).toHaveLength(3);
    expect(
      workflowSource.match(/git -C release-source show-ref --verify --quiet/g)
    ).toHaveLength(2);
  });

  it('enforces monotonic Stable versions and removes the contradictory asset URL input', () => {
    expect(workflowSource).toContain('group: desktop-stable-release');
    expect(workflowSource).toContain('assertStableDesktopUpgrade');
    expect(workflowSource).toContain('Recheck Stable version monotonicity before draft creation');
    expect(workflowSource).not.toContain('asset_base_url:');
    expect(workflowSource).not.toContain('DESKTOP_UPDATE_ASSET_BASE_URL: ${{ inputs.asset_base_url }}');
  });

  it('pins Microsoft SignTool and binds audit records to canonical paths and hashes', () => {
    expect(signerSource).toContain("'Windows Kits\\10\\bin'");
    expect(signerSource).toContain("$toolSignature.Status -ne 'Valid'");
    expect(signerSource).toContain('O=Microsoft Corporation');
    expect(signerSource).not.toContain('Get-Command signtool.exe');
    expect(signerSource).not.toContain('TAURI_WINDOWS_SIGNTOOL_PATH');
    expect(signerSource).toContain('path = $resolvedTarget');
    expect(signerSource).toContain('evidencePath = $evidencePath');
    expect(signerSource).toContain('signed-seekoffer-desktop.exe');
    expect(signerSource).toContain('signed-nsis-uninstaller-');
    expect(signerSource).toContain('[IO.FileShare]::None');

    const verifyStep = findStepSource('Verify Authenticode signing coverage');
    expect(verifyStep).toContain('$recordedHash -ne $actualHash');
    expect(verifyStep).toContain('$matchingRecords.Count -ne 1');
    expect(verifyStep).toContain('Get-AuthenticodeSignature -LiteralPath $evidencePath');
    expect(verifyStep).toContain('$matchingRecords[0].evidencePath');
    expect(verifyStep).toContain('authenticode-evidence');
  });

  it('isolates compilation from signing and reverifies the downloaded artifact on a fresh runner', () => {
    expect(workflowSource).toContain('compile:\n    name: Compile unsigned Windows application');
    expect(workflowSource).toContain('npm ci --ignore-scripts');
    expect(workflowSource).toContain('Verify and restore unsigned compile payload');
    expect(workflowSource).toContain('verify:\n    name: Reverify downloaded Windows release');
    expect(workflowSource).toContain('Downloaded Tauri updater Minisign verification failed.');
    expect(workflowSource).toContain('Downloaded artifact is not Authenticode-valid');
    expect(workflowSource).toContain('signed-seekoffer-desktop.exe');
    expect(workflowSource).toContain('NEXT_PUBLIC_SUPABASE_URL: ${{ vars.NEXT_PUBLIC_SUPABASE_URL }}');
    expect(workflowSource).toContain("- verify\n");
    expect(packagingSource).toContain('Stable 发布缺少 Tauri 恢复前的已签主程序证据');
  });

  it('treats signer scripts as immutable build inputs and documents the provider boundary', () => {
    expect(packagingSource).toContain(
      "'prepare-windows-signing-certificate.ps1'"
    );
    expect(packagingSource).toContain("'sign-windows-artifact.ps1'");
    expect(packagingSource).toContain("'desktop-release.yml'");
    expect(packagingSource).toContain("'invoke-desktop-signed-release.ps1'");
    expect(operationsSource).toContain(
      '此前的 Stable Workflow **没有真正执行 Authenticode 签名**'
    );
    expect(operationsSource).toContain(
      '受保护 PFX + SignTool 的可配置执行路径'
    );
    expect(operationsSource).toContain('不得使用自签名证书');
    expect(operationsSource).toContain('供应商、费用、主体认证和密钥托管决策');
  });

  it('never echoes, uploads or persists raw certificate secrets', () => {
    const combined = [workflowSource, prepareSource, signerSource].join('\n');
    expect(combined).not.toMatch(/Write-(?:Host|Output).+WINDOWS_CERTIFICATE/);
    expect(combined).not.toMatch(/echo.+WINDOWS_CERTIFICATE/);
    expect(combined).not.toContain('WINDOWS_CERTIFICATE=' + 'test');
    expect(combined).not.toContain('New-SelfSignedCertificate');

    const uploadStep = findStepSource('Upload validated release bundle');
    expect(uploadStep).not.toContain('seekoffer-authenticode');
    expect(uploadStep).not.toContain('.pfx');
  });
});
