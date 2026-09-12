// This migration checkout has one supported desktop backend.
const mode = process.argv[2];
if (mode !== 'build' && mode !== 'dev') {
  throw new Error('用法：node scripts/run-desktop-next.mjs <build|dev>');
}
if (process.env.NEXT_PUBLIC_BACKEND_PROVIDER && process.env.NEXT_PUBLIC_BACKEND_PROVIDER !== 'd1') {
  throw new Error('DESKTOP_BACKEND_MUST_BE_D1');
}
if (mode !== 'build') {
  throw new Error('D1 原生登录需要编译桌面程序；请运行 npm run build:desktop。');
}
await import('./run-desktop-d1.mjs');
