/**
 * The installer currently advertised by the public website.
 *
 * Keep this metadata separate from the Tauri updater manifest: the website's
 * manual installer is published through the verified download worker while
 * the in-app updater has its own release channel and lifecycle.
 */
export const PUBLISHED_DESKTOP_RELEASE = {
  version: '0.2.26',
  releaseDate: '2026-09-12',
  installerName: 'SeekOffer-Desktop-v0.2.26-Windows-x64-Setup.exe',
  installerSize: '24.45 MiB',
  installerSizeBytes: 25_633_770,
  installerSha256: '405683bace090365f8a84c8169b6b56b26967ca7b42c76f2a58ffdd2c7feeb27',
  installerUrl:
    'https://seekoffer-client-downloads.seekoffer-9268f8c5.workers.dev/files/405683bace09/SeekOffer-Desktop-v0.2.26-Windows-x64-Setup.exe',
  verificationUrl: 'https://seekoffer-client-downloads.seekoffer-9268f8c5.workers.dev',
  provenanceUrl: 'https://seekoffer-client-downloads.seekoffer-9268f8c5.workers.dev/provenance.json',
  checksumsUrl: 'https://seekoffer-client-downloads.seekoffer-9268f8c5.workers.dev/SHA256SUMS.txt',
  pageUrl: 'https://www.seekoffer.com.cn/download/'
} as const;
