/**
 * The installer currently advertised by the public website.
 *
 * Keep this metadata separate from the Tauri updater manifest: the website's
 * manual installer is published through the verified download worker while
 * the in-app updater has its own release channel and lifecycle.
 */
export const PUBLISHED_DESKTOP_RELEASE = {
  version: '0.2.28',
  releaseDate: '2026-10-09',
  installerName: 'SeekOffer-Desktop-v0.2.28-Windows-x64-Setup.exe',
  installerSize: '24.48 MiB',
  installerSizeBytes: 25_672_873,
  installerSha256: '22e764449df98483d86623d13012b30efc1727d934e6db257680a112cdcc0d60',
  installerUrl:
    'https://seekoffer-client-downloads.seekoffer-9268f8c5.workers.dev/files/22e764449df9/SeekOffer-Desktop-v0.2.28-Windows-x64-Setup.exe',
  verificationUrl: 'https://seekoffer-client-downloads.seekoffer-9268f8c5.workers.dev',
  provenanceUrl: 'https://seekoffer-client-downloads.seekoffer-9268f8c5.workers.dev/provenance.json',
  checksumsUrl: 'https://seekoffer-client-downloads.seekoffer-9268f8c5.workers.dev/SHA256SUMS.txt',
  pageUrl: 'https://www.seekoffer.com.cn/download/'
} as const;
