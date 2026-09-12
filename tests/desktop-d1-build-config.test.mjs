import {describe, it, expect} from 'vitest';
import {spawnSync} from 'node:child_process';
import {resolveDesktopD1BuildEnvironment, desktopD1PublicConfig} from '../scripts/desktop-d1-build-config.mjs';

describe('migration desktop release backend', () => {
  it('uses the approved native target with no inherited backend setting', () => {
    const result = resolveDesktopD1BuildEnvironment({PATH: 'synthetic-path'});
    expect(result).toMatchObject({...desktopD1PublicConfig, SEEKOFFER_BUILD_TARGET: 'desktop', SEEKOFFER_OFFLINE_BUILD: 'true'});
    expect(result.PATH).toBe('synthetic-path');
  });
  it('does not embed stale Supabase public configuration', () => {
    const input = {NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.invalid', NEXT_PUBLIC_SUPABASE_SECRET_KEY: 'synthetic-value'};
    const result = resolveDesktopD1BuildEnvironment(input);
    expect(Object.keys(result).some(key => key.startsWith('NEXT_PUBLIC_SUPABASE_'))).toBe(false);
    expect(input.NEXT_PUBLIC_SUPABASE_URL).toBe('https://synthetic.invalid');
  });
  it.each(Object.keys(desktopD1PublicConfig))('rejects a conflicting %s without echoing its value', (name) => {
    try { resolveDesktopD1BuildEnvironment({[name]: 'synthetic-private-value'}); throw Error('NOT_REJECTED'); }
    catch (error) { expect(error.message).toBe(`DESKTOP_CONFIGURATION_MISMATCH: ${name}`); }
  });
  it('rejects a legacy build before invoking Next or accessing the network', () => {
    const result = spawnSync(process.execPath, ['scripts/run-desktop-next.mjs', 'build'], {
      windowsHide: true, encoding: 'utf8', env: {...process.env, NEXT_PUBLIC_BACKEND_PROVIDER: 'supabase'}, timeout: 5000
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('DESKTOP_BACKEND_MUST_BE_D1');
    expect(result.stdout).toBe('');
  });
});
