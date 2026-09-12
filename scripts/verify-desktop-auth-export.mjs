import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {verifyDesktopD1Export} from './verify-desktop-d1-export.mjs';
import {resolveDesktopD1BuildEnvironment} from './desktop-d1-build-config.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
resolveDesktopD1BuildEnvironment(process.env);
const result = await verifyDesktopD1Export(path.join(projectRoot, '.next-desktop'));

console.log(
  `桌面认证产物校验通过（D1 / Clerk PKCE；扫描 ${result.scannedFiles} 个文件；未发现已知高权限 key）。`
);
