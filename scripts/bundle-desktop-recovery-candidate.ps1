[CmdletBinding()]
param([switch]$ValidateOnly)

# Internal 0.2.27 candidate only. This helper neither compiles nor publishes.
# Public native probes and synthetic Chromium checks are not real OAuth acceptance.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$seekRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$seekVersion = '0.2.27'
$seekConfig = Get-Content -LiteralPath (Join-Path $seekRoot 'src-tauri/tauri.conf.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$seekPackage = Get-Content -LiteralPath (Join-Path $seekRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$seekCargo = [IO.File]::ReadAllText((Join-Path $seekRoot 'src-tauri/Cargo.toml'))
$seekCargoLock = [IO.File]::ReadAllText((Join-Path $seekRoot 'src-tauri/Cargo.lock'))
$seekCargoVersion = [regex]::Match($seekCargo, '(?ms)^\[package\].*?^version\s*=\s*"([^"]+)"').Groups[1].Value
$seekLockVersion = [regex]::Match($seekCargoLock, '(?m)^name = "seekoffer-desktop"\r?\nversion = "([^"]+)"').Groups[1].Value
if ($seekConfig.identifier -ne 'com.seekoffer.desktop' -or @($seekConfig.version, $seekPackage.version, $seekCargoVersion, $seekLockVersion).Where({ $_ -ne $seekVersion }).Count -ne 0) {
  throw 'RECOVERY_CANDIDATE_VERSION_OR_IDENTIFIER_MISMATCH'
}
if (($env:SEEKOFFER_RELEASE_CHANNEL -and $env:SEEKOFFER_RELEASE_CHANNEL -ne 'internal-test') -or $env:SEEKOFFER_AUTHENTICODE_REQUIRED -eq 'true' -or $env:SEEKOFFER_REQUIRE_VALID_AUTHENTICODE -eq 'true') {
  throw 'THIS_HELPER_IS_INTERNAL_TEST_ONLY_USE_STABLE_RELEASE_GATES_FOR_PUBLIC_RELEASE'
}
if ($env:TAURI_CONFIG -or $env:NODE_OPTIONS) { throw 'UNEXPECTED_BUILD_OR_RUNTIME_OVERRIDE' }
if ($env:TAURI_SIGNING_PRIVATE_KEY -or $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) { throw 'UNEXPECTED_INHERITED_SIGNING_CREDENTIAL' }

$seekExe = Join-Path $seekRoot 'src-tauri/target/release/seekoffer-desktop.exe'
$seekExeInfo = Get-Item -LiteralPath $seekExe
if ($seekExeInfo.VersionInfo.ProductVersion -ne $seekVersion) { throw 'CANDIDATE_EXECUTABLE_VERSION_MISMATCH' }
$seekExeText = [Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($seekExe))
foreach ($seekMarker in @('--remote-debugging-port=', '--auto-open-devtools-for-tabs', 'synthetic-workbench-v1', 'SYNTHETIC_NATIVE_TOKEN')) {
  if ($seekExeText.Contains($seekMarker)) { throw 'ACCEPTANCE_DEBUG_OR_SYNTHETIC_EXECUTABLE_EXCLUDED' }
}
$seekExeText = $null
$seekIndex = Get-Item -LiteralPath (Join-Path $seekRoot '.next-desktop/index.html')
if ($seekExeInfo.LastWriteTimeUtc -lt $seekIndex.LastWriteTimeUtc) { throw 'RELEASE_EXECUTABLE_PREDATES_CURRENT_EXPORT' }
$seekIndexHash = (Get-FileHash -LiteralPath $seekIndex.FullName -Algorithm SHA256).Hash.ToLowerInvariant()

$seekNativeRoot = Join-Path $seekRoot 'artifacts/desktop-recovery-20261009-native'
$seekNativeFile = Get-Item -LiteralPath (Join-Path $seekNativeRoot 'd1-native-public-probe.json')
$seekEmbeddedFile = Get-Item -LiteralPath (Join-Path $seekNativeRoot 'd1-native-embedded-probe.json')
$seekNative = Get-Content -LiteralPath $seekNativeFile.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
$seekEmbedded = Get-Content -LiteralPath $seekEmbeddedFile.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
if ($seekNativeFile.LastWriteTimeUtc -lt $seekIndex.LastWriteTimeUtc -or $seekEmbeddedFile.LastWriteTimeUtc -lt $seekIndex.LastWriteTimeUtc) { throw 'NATIVE_PROBE_PREDATES_CURRENT_EXPORT' }
if ($seekEmbedded.identifier -ne 'com.seekoffer.desktop.recoveryacceptance20261009' -or $seekEmbedded.embeddedIndexSHA256 -ne $seekIndexHash -or $seekEmbedded.embeddedIndexBytes -ne $seekIndex.Length) { throw 'NATIVE_EMBEDDED_EXPORT_NOT_CURRENT' }
if ($seekEmbedded.windowScope -notin @('http://tauri.localhost', 'tauri://localhost') -or $seekEmbedded.hasDesktopAuthShell -ne $true) { throw 'NATIVE_EMBEDDED_DESKTOP_SCOPE_NOT_VERIFIED' }
if ($null -ne $seekNative.error -or $seekNative.count -lt 1 -or $seekNative.count -gt 40 -or $seekNative.total -lt $seekNative.count -or $seekNative.bytes -le 0 -or $seekNative.bytes -gt 2097152 -or $seekNative.detailMatches -ne $true -or $seekNative.scopeRejected -ne $true -or $seekNative.loginButton -ne $true) { throw 'NATIVE_PUBLIC_PROBE_NOT_PASSED' }
if ($seekNative.privateRowsWritten -ne 0 -or $seekNative.testAccountMatches -ne $false -or $seekNative.profileStatus -ne 0 -or $seekNative.applicationStatus -ne 0 -or $seekNative.entitlementState -ne 'not_checked') { throw 'PUBLIC_ONLY_NATIVE_EVIDENCE_SCOPE_CHANGED' }

$seekBrowserPath = Join-Path $seekRoot 'artifacts/desktop-recovery-20261009-browser/result.json'
$seekBrowser = Get-Content -LiteralPath $seekBrowserPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($seekBrowser.layer -ne 'compiled-desktop-export-Chromium-synthetic-IPC-and-HTTP' -or $seekBrowser.productionWrites -ne 0 -or $seekBrowser.realNativeOAuth -ne $false -or @($seekBrowser.pageErrors).Count -ne 0 -or @($seekBrowser.routeErrors).Count -ne 0) { throw 'COMPILED_RECOVERY_BROWSER_EVIDENCE_NOT_PASSED' }
foreach ($seekCheck in @('expiredSessionLocalDataPreserved', 'reauthenticationRestored', 'expiredSessionSignOut', 'scheduleSaveAcknowledged', 'stableAfterAcknowledgement')) {
  if ($seekBrowser.$seekCheck -ne $true) { throw "COMPILED_RECOVERY_CHECK_MISSING: $seekCheck" }
}
if ([IO.Path]::GetFullPath($seekBrowser.exportDirectory) -ne [IO.Path]::GetFullPath((Join-Path $seekRoot '.next-desktop'))) { throw 'BROWSER_EXPORT_DIRECTORY_MISMATCH' }
if ([DateTimeOffset]::Parse($seekBrowser.at).UtcDateTime -lt $seekIndex.LastWriteTimeUtc) { throw 'BROWSER_PROOF_PREDATES_CURRENT_EXPORT' }

$seekNode = (Get-Command node.exe -ErrorAction Stop).Source
$seekFingerprintScript = @'
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const project = process.argv[1], root = path.join(project, '.next-desktop'), files = [];
function visit(dir) { for (const entry of fs.readdirSync(dir, {withFileTypes: true})) { const p = path.join(dir, entry.name); if (entry.isDirectory()) visit(p); else if (/\.(?:html|js|css|json|txt|wasm)$/.test(entry.name)) files.push(path.relative(root, p).replaceAll('\\', '/')); } }
visit(root);
const hash = createHash('sha256').update('seekoffer-desktop-export-v1\0');
for (const file of files.sort()) hash.update(file).update('\0').update(fs.readFileSync(path.join(root, file))).update('\0');
const {verifyDesktopD1Export} = await import(pathToFileURL(path.join(project, 'scripts/verify-desktop-d1-export.mjs')));
const exportVerification = await verifyDesktopD1Export(root);
console.log(JSON.stringify({algorithm:'sha256-path-and-content-v1',sha256:hash.digest('hex'),fileCount:files.length,secretScan:exportVerification.secretScan}));
'@
$seekFingerprintRaw = & $seekNode --input-type=module -e $seekFingerprintScript $seekRoot
if ($LASTEXITCODE -ne 0) { throw 'CURRENT_DESKTOP_EXPORT_VERIFICATION_FAILED' }
$seekFingerprint = $seekFingerprintRaw | ConvertFrom-Json
if ($seekFingerprint.algorithm -ne $seekBrowser.exportFingerprint.algorithm -or $seekFingerprint.sha256 -ne $seekBrowser.exportFingerprint.sha256 -or $seekFingerprint.fileCount -ne $seekBrowser.exportFingerprint.fileCount -or $seekFingerprint.secretScan -ne 'passed') { throw 'BROWSER_PROOF_EXPORT_FINGERPRINT_MISMATCH' }

if ($ValidateOnly) {
  Write-Host 'Internal candidate prerequisites passed. No signing credential was opened, no bundle was created, and nothing was published.'
  return
}

$seekPrivateKey = Join-Path $env:USERPROFILE '.tauri/seekoffer-updater.key'
$seekPasswordFile = Join-Path $env:LOCALAPPDATA 'SeekOffer/release-secrets/updater-password.dpapi'
if (!(Test-Path -LiteralPath $seekPrivateKey -PathType Leaf) -or !(Test-Path -LiteralPath $seekPasswordFile -PathType Leaf)) { throw 'SIGNING_CREDENTIAL_UNAVAILABLE' }
$seekTauriCli = Join-Path $seekRoot 'node_modules/@tauri-apps/cli/tauri.js'
$seekReleaseConfig = Join-Path $seekRoot 'src-tauri/tauri.release.conf.json'
$seekPointer = [IntPtr]::Zero
$seekSecure = $null
$seekStart = $null
$seekProcess = $null
try {
  Import-Module Microsoft.PowerShell.Security -ErrorAction Stop
  $seekSecure = ConvertTo-SecureString ([IO.File]::ReadAllText($seekPasswordFile).Trim())
  $seekPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seekSecure)
  $seekStart = [Diagnostics.ProcessStartInfo]::new()
  $seekStart.FileName = $seekNode
  $seekStart.Arguments = '"' + $seekTauriCli + '" bundle --bundles nsis --config "' + $seekReleaseConfig + '"'
  $seekStart.WorkingDirectory = $seekRoot
  $seekStart.UseShellExecute = $false
  $seekStart.CreateNoWindow = $true
  # Credentials exist only in this bundler child environment. No Next/Cargo build,
  # npm lifecycle, upload, Git operation, updater promotion, or deployment runs.
  $seekStart.EnvironmentVariables['SEEKOFFER_RELEASE_CHANNEL'] = 'internal-test'
  $seekStart.EnvironmentVariables['TAURI_SIGNING_PRIVATE_KEY'] = $seekPrivateKey
  $seekStart.EnvironmentVariables['TAURI_SIGNING_PRIVATE_KEY_PASSWORD'] = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($seekPointer)
  $seekProcess = [Diagnostics.Process]::Start($seekStart)
  $seekProcess.WaitForExit()
  if ($seekProcess.ExitCode -ne 0) { throw 'INTERNAL_RECOVERY_BUNDLE_FAILED' }
}
finally {
  if ($null -ne $seekStart) {
    $seekStart.EnvironmentVariables.Remove('TAURI_SIGNING_PRIVATE_KEY')
    $seekStart.EnvironmentVariables.Remove('TAURI_SIGNING_PRIVATE_KEY_PASSWORD')
  }
  if ($seekPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($seekPointer) }
  if ($null -ne $seekSecure) { $seekSecure.Dispose() }
  if ($null -ne $seekProcess) { $seekProcess.Dispose() }
  $seekStart = $null
  $seekSecure = $null
}
Write-Host '0.2.27 internal-test NSIS candidate bundled. See the acceptance record for native validation; this command does not publish the release.'
