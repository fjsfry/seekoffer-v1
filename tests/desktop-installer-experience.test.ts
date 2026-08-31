import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const tauriConfig = JSON.parse(
  readFileSync(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8')
) as {
  bundle: {
    windows: {
      nsis: {
        template?: string;
        installMode: string;
        compression: string;
        installerIcon: string;
        uninstallerIcon: string;
        headerImage: string;
        uninstallerHeaderImage: string;
        sidebarImage: string;
        installerHooks: string;
        displayLanguageSelector: boolean;
        languages: string[];
        customLanguageFiles: Record<string, string>;
      };
    };
  };
  plugins: {
    updater: {
      pubkey: string;
      endpoints: string[];
      windows: { installMode: string };
    };
  };
};

const nsis = tauriConfig.bundle.windows.nsis;
const windowsRoot = resolve(root, 'src-tauri');
const hooks = readFileSync(resolve(windowsRoot, nsis.installerHooks), 'utf8');
const generator = readFileSync(
  resolve(windowsRoot, 'windows/generate-installer-assets.mjs'),
  'utf8'
);

const tauriLanguageKeys = [
  'addOrReinstall',
  'alreadyInstalled',
  'alreadyInstalledLong',
  'appRunning',
  'appRunningOkKill',
  'chooseMaintenanceOption',
  'choowHowToInstall',
  'createDesktop',
  'dontUninstall',
  'dontUninstallDowngrade',
  'failedToKillApp',
  'installingWebview2',
  'newerVersionInstalled',
  'older',
  'olderOrUnknownVersionInstalled',
  'silentDowngrades',
  'unableToUninstall',
  'uninstallApp',
  'uninstallBeforeInstalling',
  'unknown',
  'webview2AbortError',
  'webview2DownloadError',
  'webview2DownloadSuccess',
  'webview2Downloading',
  'webview2InstallError',
  'webview2InstallSuccess',
  'deleteAppData'
];

function readBmpHeader(relativePath: string) {
  const bytes = readFileSync(resolve(windowsRoot, relativePath));
  return {
    bytes,
    signature: bytes.toString('ascii', 0, 2),
    declaredSize: bytes.readUInt32LE(2),
    pixelOffset: bytes.readUInt32LE(10),
    dibSize: bytes.readUInt32LE(14),
    width: bytes.readInt32LE(18),
    height: bytes.readInt32LE(22),
    planes: bytes.readUInt16LE(26),
    bitDepth: bytes.readUInt16LE(28),
    compression: bytes.readUInt32LE(30)
  };
}

describe('desktop installer product experience', () => {
  it('uses the official auditable Tauri NSIS extension surface', () => {
    expect(nsis.template).toBeUndefined();
    expect(nsis.installMode).toBe('currentUser');
    expect(nsis.compression).toBe('lzma');
    expect(nsis.displayLanguageSelector).toBe(false);
    expect(nsis.languages).toEqual(['SimpChinese', 'English']);
    expect(nsis.installerIcon).toBe('icons/icon.ico');
    expect(nsis.uninstallerIcon).toBe(nsis.installerIcon);
    expect(nsis.uninstallerHeaderImage).toBe(nsis.headerImage);
    expect(nsis.customLanguageFiles).toEqual({
      SimpChinese: './windows/languages/SimpChinese.nsh',
      English: './windows/languages/English.nsh'
    });
  });

  it('keeps updater behaviour and trust configuration unchanged', () => {
    expect(tauriConfig.plugins.updater.pubkey).toMatch(/\S{80,}/);
    expect(tauriConfig.plugins.updater.endpoints).toEqual([
      'https://seekoffer-desktop-updates.vercel.app/stable/latest.json',
      'https://seekoffer-desktop-updates.vercel.app/latest.json'
    ]);
    expect(tauriConfig.plugins.updater.windows.installMode).toBe('passive');
  });

  it.each([
    ['header', nsis.headerImage, 150, 57],
    ['sidebar', nsis.sidebarImage, 164, 314]
  ])('ships a valid 24-bit NSIS %s bitmap', (_label, relativePath, width, height) => {
    const metadata = readBmpHeader(relativePath);

    expect(metadata.signature).toBe('BM');
    expect(metadata.declaredSize).toBe(metadata.bytes.length);
    expect(metadata.pixelOffset).toBe(54);
    expect(metadata.dibSize).toBe(40);
    expect(metadata.width).toBe(width);
    expect(metadata.height).toBe(height);
    expect(metadata.planes).toBe(1);
    expect(metadata.bitDepth).toBe(24);
    expect(metadata.compression).toBe(0);
    expect(metadata.bytes.length).toBeGreaterThan(width * height * 3);
  });

  it('keeps installer artwork reproducible and native-font aligned', () => {
    expect(generator).toContain("font-family=\"Segoe UI Variable, Microsoft YaHei UI");
    expect(generator).toContain('fill=\"#0F6B61\"');
    expect(generator).toContain('fill=\"#1F2329\"');
    expect(generator).toContain('fill=\"#646A73\"');
    expect(generator).toContain('fill=\"#DEE0E3\"');
    expect(generator).not.toContain('linearGradient');
    expect(generator).not.toContain('font-weight=\"700\"');
    expect(generator).toContain('width: 150');
    expect(generator).toContain('height: 57');
    expect(generator).toContain('width: 164');
    expect(generator).toContain('height: 314');
    expect(generator).toContain("'seekoffer-app-icon-v2.png'");
    expect(generator).toContain('encodeBmp24');
  });

  it.each(Object.entries(nsis.customLanguageFiles))(
    'provides complete, concise %s lifecycle copy',
    (_language, relativePath) => {
      const source = readFileSync(resolve(windowsRoot, relativePath), 'utf8');
      const names = Array.from(
        source.matchAll(/^LangString\s+(\w+)\s+/gm),
        (match) => match[1]
      );

      expect(new Set(names).size).toBe(names.length);
      expect(names).toEqual(expect.arrayContaining(tauriLanguageKeys));
      expect(source).toContain('seekofferPreparing');
      expect(source).toContain('seekofferUpdating');
      expect(source).toContain('seekofferUpdateFinalizing');
      expect(source).toContain('seekofferRemoving');
      expect(source).toContain('seekofferWelcomeTitle');
      expect(source).toContain('seekofferWelcomeText');
      expect(source).toContain('seekofferFinishTitle');
      expect(source).toContain('seekofferFinishText');
      expect(source).not.toContain('version $R4');
      expect(source).not.toMatch(/https?:\/\//);
      expect(source).not.toMatch(/TAURI_SIGNING|PRIVATE_KEY|PASSWORD/);
    }
  );

  it('adds calm lifecycle feedback without interrupting silent or update flows', () => {
    expect(hooks).toContain('!macro NSIS_HOOK_PREINSTALL');
    expect(hooks).toContain('!macro NSIS_HOOK_POSTINSTALL');
    expect(hooks).toContain('!macro NSIS_HOOK_PREUNINSTALL');
    expect(hooks).toContain('${If} $UpdateMode = 1');
    expect(hooks).toContain('${If} $UpdateMode <> 1');
    expect(hooks).toContain('StartupApproved\\Run');
    expect(hooks).toContain('!define MUI_ABORTWARNING');
    expect(hooks).toContain('!define MUI_WELCOMEPAGE_TITLE "$(seekofferWelcomeTitle)"');
    expect(hooks).toContain('!define MUI_WELCOMEPAGE_TEXT "$(seekofferWelcomeText)"');
    expect(hooks).toContain('!define MUI_FINISHPAGE_TITLE "$(seekofferFinishTitle)"');
    expect(hooks).toContain('!define MUI_FINISHPAGE_TEXT "$(seekofferFinishText)"');
    expect(hooks).not.toContain('MessageBox');
    expect(hooks).not.toMatch(/Exec(?:Wait)?\s/);
    expect(hooks).not.toMatch(/https?:\/\//);
  });
});
