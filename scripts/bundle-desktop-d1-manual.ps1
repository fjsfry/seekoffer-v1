[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$seekRoot=[IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$seekConfig=Get-Content -LiteralPath (Join-Path $seekRoot 'src-tauri/tauri.conf.json') -Raw | ConvertFrom-Json
$seekExe=Join-Path $seekRoot 'src-tauri/target/release/seekoffer-desktop.exe'
if($seekConfig.identifier -ne 'com.seekoffer.desktop' -or $seekConfig.version -ne '0.2.26'){throw 'MANUAL_RELEASE_SCOPE'}
if((Get-Item -LiteralPath $seekExe).VersionInfo.ProductVersion -ne '0.2.26'){throw 'EXECUTABLE_VERSION_SCOPE'}
$seekBytes=[IO.File]::ReadAllBytes($seekExe)
$seekText=[Text.Encoding]::UTF8.GetString($seekBytes)
if($seekText.Contains('--remote-debugging-port=54387') -or $seekText.Contains('synthetic-workbench-v1')){throw 'ACCEPTANCE_EXECUTABLE_EXCLUDED'}
$seekProof=Get-Content -LiteralPath (Join-Path $seekRoot 'artifacts/desktop-recurrence-20260912/native-workbench-verification.json') -Raw | ConvertFrom-Json
if($seekProof.state -ne 'PASSED'){throw 'NATIVE_ACCEPTANCE_REQUIRED'}
$seekPrivateKey=Join-Path $env:USERPROFILE '.tauri/seekoffer-updater.key'
$seekPasswordFile=Join-Path $env:LOCALAPPDATA 'SeekOffer/release-secrets/updater-password.dpapi'
if(!(Test-Path -LiteralPath $seekPrivateKey) -or !(Test-Path -LiteralPath $seekPasswordFile)){throw 'SIGNING_CREDENTIAL_UNAVAILABLE'}
if($env:SEEKOFFER_RELEASE_CHANNEL -eq 'stable' -or $env:SEEKOFFER_AUTHENTICODE_REQUIRED -eq 'true'){throw 'STABLE_RELEASE_NOT_AUTHORIZED_BY_THIS_HELPER'}
if($env:TAURI_SIGNING_PRIVATE_KEY -or $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD){throw 'UNEXPECTED_INHERITED_SIGNING_CREDENTIAL'}
$seekPointer=[IntPtr]::Zero
Push-Location $seekRoot
try {
  Import-Module Microsoft.PowerShell.Security -ErrorAction Stop
  $seekSecure=ConvertTo-SecureString ([IO.File]::ReadAllText($seekPasswordFile).Trim())
  $seekPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($seekSecure)
  $env:TAURI_SIGNING_PRIVATE_KEY=$seekPrivateKey
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($seekPointer)
  # No build, lifecycle scripts, remote publish or account changes. Only the
  # already installed official Tauri bundler receives the signing environment.
  & 'D:/node/node.exe' node_modules/@tauri-apps/cli/tauri.js bundle --bundles nsis --config src-tauri/tauri.release.conf.json
  if($LASTEXITCODE -ne 0){throw 'MANUAL_BUNDLE_FAILED'}
}
finally {
  Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
  if($seekPointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($seekPointer)}
  $seekSecure=$null
  Pop-Location
}
