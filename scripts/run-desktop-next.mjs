import { spawn } from 'node:child_process';
import { resolveDesktopD1BuildEnvironment } from './desktop-d1-build-config.mjs';

// The browser is a UI preview; native authentication runs in the isolated
// Tauri development application with its own identifier and credential store.
const mode = process.argv[2];
if (mode !== 'build' && mode !== 'dev') {
  throw new Error('用法：node scripts/run-desktop-next.mjs <build|dev>');
}
if (process.env.NEXT_PUBLIC_BACKEND_PROVIDER && process.env.NEXT_PUBLIC_BACKEND_PROVIDER !== 'd1') {
  throw new Error('DESKTOP_BACKEND_MUST_BE_D1');
}
if (mode === 'dev') {
  const env = resolveDesktopD1BuildEnvironment(process.env);
  const args = process.argv.slice(3).filter(value => value !== '--');
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', ...args], {
    env, stdio: 'inherit', windowsHide: true
  });
  child.on('error', () => { process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
} else {
  await import('./run-desktop-d1.mjs');
}
