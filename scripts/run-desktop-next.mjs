import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SUPABASE_LEGACY_ANON_KEY_ENV,
  SUPABASE_PUBLISHABLE_KEY_ENV,
  resolveDesktopAuthConfig,
  verifySupabasePublicAuthEndpoint,
  verifyDesktopAuthExport
} from './desktop-auth-config.mjs';
import { verifyBuildTargetIsolation } from './verify-build-target-isolation.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const mode = process.argv[2];

if (mode !== 'build' && mode !== 'dev') {
  throw new Error('用法：node scripts/run-desktop-next.mjs <build|dev> [Next.js 参数]');
}

const config = await resolveDesktopAuthConfig({
  projectRoot,
  mode: mode === 'dev' ? 'development' : 'production'
});
const childEnv = { ...process.env };
delete childEnv.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
delete childEnv.NEXT_PUBLIC_SUPABASE_SECRET_KEY;
childEnv.SEEKOFFER_BUILD_TARGET = 'desktop';
childEnv.NEXT_PUBLIC_SEEKOFFER_SURFACE = 'desktop';
childEnv.NEXT_PUBLIC_SUPABASE_URL = config.url;
childEnv[SUPABASE_PUBLISHABLE_KEY_ENV] =
  config.keyEnvName === SUPABASE_PUBLISHABLE_KEY_ENV ? config.key : '';
childEnv[SUPABASE_LEGACY_ANON_KEY_ENV] =
  config.keyEnvName === SUPABASE_LEGACY_ANON_KEY_ENV ? config.key : '';

console.log(
  `桌面登录配置已校验（${config.keyType}；来源：${config.sources.url} / ${config.sources.key}）。`
);

if (mode === 'build') {
  const connectivity = await verifySupabasePublicAuthEndpoint({ config });
  console.log(`Supabase Auth 公共端点校验通过（HTTP ${connectivity.status}）。`);
}

const require = createRequire(import.meta.url);
const nextCli = require.resolve('next/dist/bin/next');
const nextArguments = [nextCli, mode, ...process.argv.slice(3)];
const child = spawn(process.execPath, nextArguments, {
  cwd: projectRoot,
  env: childEnv,
  stdio: 'inherit'
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => child.kill(signal));
}

const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code) => resolve(code ?? 1));
});

if (exitCode !== 0) {
  process.exitCode = exitCode;
} else if (mode === 'build') {
  const result = await verifyDesktopAuthExport({
    distDirectory: path.join(projectRoot, '.next-desktop'),
    config
  });
  console.log(
    `桌面认证产物校验通过（${result.keyType}；扫描 ${result.scannedFiles} 个静态脚本；未发现高权限 key）。`
  );
  const isolationResult = verifyBuildTargetIsolation({
    target: 'desktop',
    distDirectory: path.join(projectRoot, '.next-desktop')
  });
  console.log(
    `desktop 构建隔离校验通过（${isolationResult.htmlFiles} 个 HTML，` +
      `${isolationResult.cssAssets} 个 CSS，${isolationResult.jsAssets} 个 JS）。`
  );
}
