[CmdletBinding()]
param(
  [string]$PrivateKeyPath = "$env:USERPROFILE\.tauri\seekoffer-updater.key",
  [string]$ProtectedPasswordPath = "$env:LOCALAPPDATA\SeekOffer\release-secrets\updater-password.dpapi",
  [ValidateSet('internal-test', 'stable')]
  [string]$ReleaseChannel = 'internal-test',
  [switch]$SkipPackage
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

# This helper protects and injects only the Tauri updater Minisign key.
# It does not provision a public-trust Windows Authenticode certificate.
# Public Stable releases must use the protected GitHub workflow, whose Tauri
# signCommand signs the patched app binary, uninstaller and final NSIS package.

if ($ReleaseChannel -eq 'stable') {
  throw 'Local release helpers cannot create Stable-named artifacts. Public Stable releases must use protected CI, a clean tag, a pinned Authenticode certificate and the non-bypassable Stable gate.'
}

if (-not (Test-Path -LiteralPath $PrivateKeyPath -PathType Leaf)) {
  throw "Tauri updater private key was not found: $PrivateKeyPath"
}

if (-not (Test-Path -LiteralPath $ProtectedPasswordPath -PathType Leaf)) {
  throw "The DPAPI-protected signing password was not found: $ProtectedPasswordPath"
}

$previousReleaseChannel = $env:SEEKOFFER_RELEASE_CHANNEL
$previousRepositoryVisibility = $env:SEEKOFFER_REPOSITORY_VISIBILITY
$previousAssetBaseUrl = $env:DESKTOP_UPDATE_ASSET_BASE_URL
$previousSigningPrivateKey = $env:TAURI_SIGNING_PRIVATE_KEY
$previousSigningPrivateKeyPassword = $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD
$passwordPointer = [IntPtr]::Zero
$plainPassword = $null
$securePassword = $null

# Do not allow secrets inherited from the caller to leak into compilation,
# dependency lifecycle scripts, tests, or release validation.
Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue

# Load and verify the DPAPI cmdlet before running long child builds. Some
# Windows PowerShell hosts can fail deferred module autoload after the release
# compiler exits, leaving a valid binary without the updater bundle/signature.
Import-Module Microsoft.PowerShell.Security -Scope Local -ErrorAction Stop
$secureStringCommand = Get-Command ConvertTo-SecureString -CommandType Cmdlet -ErrorAction Stop
if ($secureStringCommand.Source -ne 'Microsoft.PowerShell.Security') {
  throw 'ConvertTo-SecureString did not resolve to Microsoft.PowerShell.Security.'
}

Push-Location $projectRoot
try {
  $env:SEEKOFFER_RELEASE_CHANNEL = $ReleaseChannel
  if (-not $env:SEEKOFFER_REPOSITORY_VISIBILITY) {
    $env:SEEKOFFER_REPOSITORY_VISIBILITY = 'public'
  }
  # Build all repository-controlled JavaScript and Rust without exposing the signing secret.
  & npm.cmd run desktop:compile
  if ($LASTEXITCODE -ne 0) {
    throw "Desktop compilation failed with exit code $LASTEXITCODE"
  }

  $protectedPassword = [IO.File]::ReadAllText($ProtectedPasswordPath).Trim()
  $securePassword = ConvertTo-SecureString $protectedPassword
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)

  try {
    # Only Tauri's final NSIS bundle/sign step receives the permanent updater key.
    $env:TAURI_SIGNING_PRIVATE_KEY = $PrivateKeyPath
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $plainPassword
    & npm.cmd run desktop:bundle
    if ($LASTEXITCODE -ne 0) {
      throw "Signed desktop bundling failed with exit code $LASTEXITCODE"
    }
  }
  finally {
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
    if ($passwordPointer -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
      $passwordPointer = [IntPtr]::Zero
    }
    $plainPassword = $null
    $securePassword = $null
  }

  if (-not $SkipPackage) {
    # Validation only needs the final artifact, signature and embedded public key.
    & npm.cmd run desktop:package
    if ($LASTEXITCODE -ne 0) {
      throw "Desktop release packaging failed with exit code $LASTEXITCODE"
    }
  }
}
finally {
  Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
  if ($passwordPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }
  $env:SEEKOFFER_RELEASE_CHANNEL = $previousReleaseChannel
  $env:SEEKOFFER_REPOSITORY_VISIBILITY = $previousRepositoryVisibility
  $env:DESKTOP_UPDATE_ASSET_BASE_URL = $previousAssetBaseUrl
  if ($null -eq $previousSigningPrivateKey) {
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
  }
  else {
    $env:TAURI_SIGNING_PRIVATE_KEY = $previousSigningPrivateKey
  }
  if ($null -eq $previousSigningPrivateKeyPassword) {
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
  }
  else {
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $previousSigningPrivateKeyPassword
  }
  Pop-Location
}
