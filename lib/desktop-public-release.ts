/**
 * The installer currently advertised by the public website.
 *
 * Keep this metadata separate from the Tauri updater manifest: the website's
 * manual installer is published through the verified download worker while
 * the in-app updater has its own release channel and lifecycle.
 */
export const PUBLISHED_DESKTOP_RELEASE = {
  version: '0.2.29',
  releaseDate: '2026-10-09',
  installerName: 'SeekOffer-Desktop-v0.2.29-Windows-x64-Setup.exe',
  installerSize: '24.53 MiB',
  installerSizeBytes: 25_729_545,
  installerSha256: 'b7141bdfd22ea1464b05e7bdc16b38a7cd20b67b6c0240bb15141718665e5015',
  installerUrl:
    'https://seekoffer-client-downloads.seekoffer-9268f8c5.workers.dev/files/b7141bdfd22e/SeekOffer-Desktop-v0.2.29-Windows-x64-Setup.exe',
  verificationUrl: 'https://seekoffer-client-downloads.seekoffer-9268f8c5.workers.dev',
  provenanceUrl: 'https://seekoffer-client-downloads.seekoffer-9268f8c5.workers.dev/provenance.json',
  checksumsUrl: 'https://seekoffer-client-downloads.seekoffer-9268f8c5.workers.dev/SHA256SUMS.txt',
  pageUrl: 'https://www.seekoffer.com.cn/download/'
} as const;
