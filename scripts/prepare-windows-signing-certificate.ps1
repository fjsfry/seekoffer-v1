[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

foreach ($requiredVariable in @(
  'WINDOWS_CERTIFICATE',
  'WINDOWS_CERTIFICATE_PASSWORD',
  'SEEKOFFER_AUTHENTICODE_EXPECTED_THUMBPRINT',
  'SEEKOFFER_AUTHENTICODE_TIMESTAMP_URL',
  'RUNNER_TEMP',
  'GITHUB_ENV'
)) {
  $value = [Environment]::GetEnvironmentVariable($requiredVariable)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Protected Stable environment is missing required Authenticode configuration: $requiredVariable."
  }
}

$expectedThumbprint = ($env:SEEKOFFER_AUTHENTICODE_EXPECTED_THUMBPRINT -replace '\s', '').ToUpperInvariant()
if ($expectedThumbprint -notmatch '^[0-9A-F]{40}$') {
  throw 'WINDOWS_CERTIFICATE_THUMBPRINT must be a 40-character SHA-1 certificate thumbprint.'
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
  throw 'WINDOWS_TIMESTAMP_URL must be an absolute HTTP(S) RFC 3161 endpoint.'
}

$certificateDirectory = Join-Path $env:RUNNER_TEMP ("seekoffer-authenticode-{0}" -f [Guid]::NewGuid().ToString('N'))
$certificatePath = Join-Path $certificateDirectory 'windows-code-signing.pfx'
New-Item -ItemType Directory -Path $certificateDirectory | Out-Null

try {
  try {
    $certificateBytes = [Convert]::FromBase64String($env:WINDOWS_CERTIFICATE.Trim())
  }
  catch {
    throw 'WINDOWS_CERTIFICATE is not valid Base64-encoded PFX content.'
  }

  if ($certificateBytes.Length -lt 512) {
    throw 'WINDOWS_CERTIFICATE decoded to an unexpectedly small PFX file.'
  }
  [IO.File]::WriteAllBytes($certificatePath, $certificateBytes)
  [Array]::Clear($certificateBytes, 0, $certificateBytes.Length)

  $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $fileAcl = [Security.AccessControl.FileSecurity]::new()
  $fileAcl.SetOwner($currentUser)
  $fileAcl.SetAccessRuleProtection($true, $false)
  $fileAcl.AddAccessRule(
    [Security.AccessControl.FileSystemAccessRule]::new(
      $currentUser,
      [Security.AccessControl.FileSystemRights]::FullControl,
      [Security.AccessControl.AccessControlType]::Allow
    )
  )
  Set-Acl -LiteralPath $certificatePath -AclObject $fileAcl

  $flags = [Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet
  $certificate = [Security.Cryptography.X509Certificates.X509Certificate2]::new(
    $certificatePath,
    $env:WINDOWS_CERTIFICATE_PASSWORD,
    $flags
  )
  try {
    if (-not $certificate.HasPrivateKey) {
      throw 'The protected PFX does not contain a private key.'
    }
    if ($certificate.NotAfter.ToUniversalTime() -le [DateTime]::UtcNow.AddDays(14)) {
      throw 'The protected code-signing certificate expires in 14 days or less.'
    }
    $actualThumbprint = ($certificate.Thumbprint -replace '\s', '').ToUpperInvariant()
    if ($actualThumbprint -ne $expectedThumbprint) {
      throw 'The protected PFX does not match WINDOWS_CERTIFICATE_THUMBPRINT.'
    }

    $hasCodeSigningEku = $false
    foreach ($extension in $certificate.Extensions) {
      if (
        $extension -is [Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]
      ) {
        foreach ($oid in $extension.EnhancedKeyUsages) {
          if ($oid.Value -eq '1.3.6.1.5.5.7.3.3') {
            $hasCodeSigningEku = $true
          }
        }
      }
    }
    if (-not $hasCodeSigningEku) {
      throw 'The protected certificate does not include the Code Signing EKU.'
    }
  }
  finally {
    $certificate.Dispose()
  }

  $auditLogPath = Join-Path $certificateDirectory ("authenticode-audit-{0}.jsonl" -f [Guid]::NewGuid().ToString('N'))
  $evidenceDirectory = Join-Path $certificateDirectory 'signed-evidence'
  New-Item -ItemType Directory -Path $evidenceDirectory | Out-Null
  $auditStream = [IO.File]::Open(
    $auditLogPath,
    [IO.FileMode]::CreateNew,
    [IO.FileAccess]::Write,
    [IO.FileShare]::None
  )
  $auditStream.Dispose()
  @(
    "SEEKOFFER_AUTHENTICODE_REQUIRED=true"
    "SEEKOFFER_AUTHENTICODE_PROVIDER=pfx-signtool"
    "SEEKOFFER_AUTHENTICODE_PFX_PATH=$certificatePath"
    "SEEKOFFER_AUTHENTICODE_EXPECTED_THUMBPRINT=$expectedThumbprint"
    "SEEKOFFER_AUTHENTICODE_TIMESTAMP_URL=$($timestampUri.AbsoluteUri)"
    "SEEKOFFER_AUTHENTICODE_AUDIT_LOG=$auditLogPath"
    "SEEKOFFER_AUTHENTICODE_TEMP_DIR=$certificateDirectory"
    "SEEKOFFER_AUTHENTICODE_EVIDENCE_DIR=$evidenceDirectory"
  ) | Out-File -LiteralPath $env:GITHUB_ENV -Encoding utf8 -Append
}
catch {
  Remove-Item -LiteralPath $certificateDirectory -Recurse -Force -ErrorAction SilentlyContinue
  throw
}
finally {
  $certificateBytes = $null
}
