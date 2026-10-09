[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$FilePath
)

$ErrorActionPreference = 'Stop'

if ($env:SEEKOFFER_AUTHENTICODE_REQUIRED -ne 'true') {
  Write-Host "Authenticode skipped for non-public artifact: $(Split-Path -Leaf $FilePath)"
  exit 0
}

if ($env:SEEKOFFER_AUTHENTICODE_PROVIDER -ne 'pfx-signtool') {
  throw 'Stable Authenticode signing requires SEEKOFFER_AUTHENTICODE_PROVIDER=pfx-signtool.'
}

foreach ($requiredVariable in @(
  'SEEKOFFER_AUTHENTICODE_PFX_PATH',
  'SEEKOFFER_AUTHENTICODE_PFX_PASSWORD',
  'SEEKOFFER_AUTHENTICODE_EXPECTED_THUMBPRINT',
  'SEEKOFFER_AUTHENTICODE_TIMESTAMP_URL',
  'SEEKOFFER_AUTHENTICODE_EVIDENCE_DIR'
)) {
  $value = [Environment]::GetEnvironmentVariable($requiredVariable)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Stable Authenticode signing is missing required protected configuration: $requiredVariable."
  }
}

$resolvedTarget = (Resolve-Path -LiteralPath $FilePath -ErrorAction Stop).Path
$targetExtension = [IO.Path]::GetExtension($resolvedTarget).ToLowerInvariant()
if ($targetExtension -notin @('.exe', '.dll', '.tmp')) {
  throw "Refusing to Authenticode-sign an unsupported file type: $targetExtension"
}
$stream = [IO.File]::OpenRead($resolvedTarget)
try {
  $dosHeader = [byte[]]::new(2)
  if ($stream.Read($dosHeader, 0, 2) -ne 2 -or $dosHeader[0] -ne 0x4D -or $dosHeader[1] -ne 0x5A) {
    throw 'Refusing to Authenticode-sign a file without a Windows PE MZ header.'
  }
}
finally {
  $stream.Dispose()
}

$pfxPath = (Resolve-Path -LiteralPath $env:SEEKOFFER_AUTHENTICODE_PFX_PATH -ErrorAction Stop).Path
$expectedThumbprint = ($env:SEEKOFFER_AUTHENTICODE_EXPECTED_THUMBPRINT -replace '\s', '').ToUpperInvariant()
if ($expectedThumbprint -notmatch '^[0-9A-F]{40}$') {
  throw 'SEEKOFFER_AUTHENTICODE_EXPECTED_THUMBPRINT must be a 40-character SHA-1 certificate thumbprint.'
}

$timestampUri = $null
if (
  -not [Uri]::TryCreate(
    $env:SEEKOFFER_AUTHENTICODE_TIMESTAMP_URL,
    [UriKind]::Absolute,
    [ref]$timestampUri
  ) -or
  $timestampUri.Scheme -notin @('http', 'https')
) {
  throw 'SEEKOFFER_AUTHENTICODE_TIMESTAMP_URL must be an absolute HTTP(S) RFC 3161 endpoint.'
}

function Resolve-SignTool {
  $programFilesX86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
  if (-not [string]::IsNullOrWhiteSpace($programFilesX86)) {
    $windowsKits = (Resolve-Path -LiteralPath (Join-Path $programFilesX86 'Windows Kits\10\bin') -ErrorAction Stop).Path
    $candidate = Get-ChildItem -LiteralPath $windowsKits -Filter signtool.exe -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object { $_.DirectoryName -match '\\x64$' } |
      Sort-Object FullName -Descending |
      Select-Object -First 1
    if ($null -ne $candidate) {
      $resolvedCandidate = (Resolve-Path -LiteralPath $candidate.FullName -ErrorAction Stop).Path
      if (-not $resolvedCandidate.StartsWith("$windowsKits\", [StringComparison]::OrdinalIgnoreCase)) {
        throw 'The selected SignTool is outside the pinned Windows SDK directory.'
      }
      Import-Module Microsoft.PowerShell.Security -Scope Local -ErrorAction Stop
      $toolSignature = Get-AuthenticodeSignature -LiteralPath $resolvedCandidate
      if ($toolSignature.Status -ne 'Valid') {
        throw "The Windows SDK SignTool is not Authenticode-valid: $($toolSignature.Status)."
      }
      if ($toolSignature.SignerCertificate.Subject -notmatch '(?:^|,\s*)O=Microsoft Corporation(?:,|$)') {
        throw 'The Windows SDK SignTool is not signed by Microsoft Corporation.'
      }
      return $resolvedCandidate
    }
  }

  throw 'A Microsoft-signed x64 signtool.exe was not found under the Windows SDK.'
}

$signtool = Resolve-SignTool
$password = $env:SEEKOFFER_AUTHENTICODE_PFX_PASSWORD
try {
  & $signtool sign `
    /fd SHA256 `
    /td SHA256 `
    /tr $timestampUri.AbsoluteUri `
    /f $pfxPath `
    /p $password `
    /d 'SeekOffer Desktop' `
    /du 'https://www.seekoffer.com.cn' `
    $resolvedTarget
  if ($LASTEXITCODE -ne 0) {
    throw "signtool sign failed with exit code $LASTEXITCODE."
  }

  & $signtool verify /pa /all /v $resolvedTarget
  if ($LASTEXITCODE -ne 0) {
    throw "signtool verify failed with exit code $LASTEXITCODE."
  }

  Import-Module Microsoft.PowerShell.Security -Scope Local -ErrorAction Stop
  $signature = Get-AuthenticodeSignature -LiteralPath $resolvedTarget
  $actualThumbprint = ($signature.SignerCertificate.Thumbprint -replace '\s', '').ToUpperInvariant()
  if ($signature.Status -ne 'Valid') {
    throw "Authenticode validation failed with status $($signature.Status)."
  }
  if ($actualThumbprint -ne $expectedThumbprint) {
    throw 'The signed artifact certificate does not match the protected expected thumbprint.'
  }
  if ($null -eq $signature.TimeStamperCertificate) {
    throw 'The Authenticode signature is missing a trusted timestamp.'
  }

  $artifactSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedTarget).Hash
  $evidencePath = $resolvedTarget
  $targetName = [IO.Path]::GetFileName($resolvedTarget)
  if (
    $targetName -ieq 'seekoffer-desktop.exe' -or
    $targetExtension -eq '.tmp'
  ) {
    $evidenceDirectory = (Resolve-Path -LiteralPath $env:SEEKOFFER_AUTHENTICODE_EVIDENCE_DIR -ErrorAction Stop).Path
    $evidenceName = if ($targetName -ieq 'seekoffer-desktop.exe') {
      'signed-seekoffer-desktop.exe'
    }
    else {
      "signed-nsis-uninstaller-$($artifactSha256.Substring(0, 16)).exe"
    }
    $evidencePath = Join-Path $evidenceDirectory $evidenceName
    [IO.File]::Copy($resolvedTarget, $evidencePath, $false)
    $evidenceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $evidencePath).Hash
    if ($evidenceHash -ne $artifactSha256) {
      throw "The preserved Authenticode evidence hash does not match $targetName."
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($env:SEEKOFFER_AUTHENTICODE_AUDIT_LOG)) {
    $auditRecord = [ordered]@{
      file = [IO.Path]::GetFileName($resolvedTarget)
      path = $resolvedTarget
      evidencePath = $evidencePath
      sha256 = $artifactSha256
      thumbprint = $actualThumbprint
      status = $signature.Status.ToString()
      timestamped = $true
    }
    $auditLine = ($auditRecord | ConvertTo-Json -Compress) + [Environment]::NewLine
    $auditBytes = [Text.Encoding]::UTF8.GetBytes($auditLine)
    $auditStream = [IO.File]::Open(
      $env:SEEKOFFER_AUTHENTICODE_AUDIT_LOG,
      [IO.FileMode]::Open,
      [IO.FileAccess]::Write,
      [IO.FileShare]::None
    )
    try {
      $auditStream.Seek(0, [IO.SeekOrigin]::End) | Out-Null
      $auditStream.Write($auditBytes, 0, $auditBytes.Length)
      $auditStream.Flush($true)
    }
    finally {
      $auditStream.Dispose()
      [Array]::Clear($auditBytes, 0, $auditBytes.Length)
    }
  }
}
finally {
  $password = $null
}
