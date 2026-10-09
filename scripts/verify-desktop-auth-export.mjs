import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveDesktopAuthConfig,
  verifyDesktopAuthExport
} from './desktop-auth-config.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const config = await resolveDesktopAuthConfig({ projectRoot });
const result = await verifyDesktopAuthExport({
  distDirectory: path.join(projectRoot, '.next-desktop'),
  config
});

console.log(
  `桌面认证产物校验通过（${result.keyType}；扫描 ${result.scannedFiles} 个静态脚本；未发现高权限 key）。`
);
