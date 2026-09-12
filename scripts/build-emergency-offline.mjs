import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { emergencyNotices } from '../tests/fixtures/emergency-notices.mjs';

if (process.env.VERCEL) throw new Error('FIXTURE_BUILD_IS_LOCAL_ONLY');
const root = process.cwd();
mkdirSync(resolve(root, 'artifacts/emergency'), { recursive: true });
const fixture = resolve(root, 'artifacts/emergency/notices.fixture.json');
writeFileSync(fixture, JSON.stringify(emergencyNotices()));
const dataFile = resolve(root, 'data/baoyantongzhi-notices-2026.json');
const original = readFileSync(dataFile);
const nextEnvFile = resolve(root, 'next-env.d.ts');
const originalNextEnv = readFileSync(nextEnvFile);
try {
  writeFileSync(dataFile, readFileSync(fixture));
  const env = { ...process.env, SEEKOFFER_OFFLINE_FIXTURE: fixture, SEEKOFFER_EMERGENCY_BUILD: 'true', NEXT_TELEMETRY_DISABLED: '1',
    NODE_OPTIONS: `--require "${resolve(root, 'scripts/emergency-network-guard.cjs').replaceAll('\\', '/')}"` };
  for (const key of Object.keys(env)) if (/SUPABASE|REVALIDATE_TOKEN|VERCEL|CLOUDBASE|SMTP|PAYMENT|WECHAT|DATABASE_URL/.test(key)) delete env[key];
  const result = spawnSync(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'build'], { env, stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally {
  writeFileSync(dataFile, original);
  writeFileSync(nextEnvFile, originalNextEnv);
}
