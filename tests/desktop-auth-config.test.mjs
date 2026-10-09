import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  parsePublicDesktopEnv,
  resolveDesktopAuthConfig,
  validateDesktopAuthConfig,
  verifyDesktopAuthExport,
  verifySupabasePublicAuthEndpoint
} from '../scripts/desktop-auth-config.mjs';
import { desktopD1PublicConfig } from '../scripts/desktop-d1-build-config.mjs';

const temporaryDirectories = [];

function mockLegacyKey(role) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role })}.signature`;
}

async function createTemporaryProject() {
  const directory = await mkdtemp(path.join(tmpdir(), 'seekoffer-desktop-auth-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

describe('desktop auth build configuration', () => {
  it('parses only the approved public desktop variables', () => {
    const parsed = parsePublicDesktopEnv([
      'NEXT_PUBLIC_SUPABASE_URL="https://project.supabase.co"',
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test',
      'SUPABASE_SERVICE_ROLE_KEY=must-not-be-read'
    ].join('\n'));

    expect(parsed).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test'
    });
  });

  it('prefers a publishable key and can fall back to ignored Vercel metadata', async () => {
    const projectRoot = await createTemporaryProject();
    await mkdir(path.join(projectRoot, '.vercel'), { recursive: true });
    await writeFile(
      path.join(projectRoot, '.vercel', '.env.production.local'),
      [
        'NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co',
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_public_key',
        `NEXT_PUBLIC_SUPABASE_ANON_KEY=${mockLegacyKey('anon')}`
      ].join('\n'),
      'utf8'
    );

    const config = await resolveDesktopAuthConfig({ projectRoot, env: {} });

    expect(config).toMatchObject({
      url: 'https://project.supabase.co',
      key: 'sb_publishable_test_public_key',
      keyType: 'publishable',
      sources: {
        url: path.join('.vercel', '.env.production.local'),
        key: path.join('.vercel', '.env.production.local')
      }
    });
  });

  it('fails before build when no public authentication configuration is available', async () => {
    const projectRoot = await createTemporaryProject();

    await expect(resolveDesktopAuthConfig({ projectRoot, env: {} })).rejects.toThrow(
      '桌面登录配置缺少 NEXT_PUBLIC_SUPABASE_URL。'
    );
  });

  it('selects a complete pair from one source instead of mixing URL and key priorities', async () => {
    const projectRoot = await createTemporaryProject();
    await mkdir(path.join(projectRoot, '.vercel'), { recursive: true });
    await writeFile(
      path.join(projectRoot, '.vercel', '.env.production.local'),
      [
        'NEXT_PUBLIC_SUPABASE_URL=https://file-project.supabase.co',
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_file_project'
      ].join('\n'),
      'utf8'
    );

    const config = await resolveDesktopAuthConfig({
      projectRoot,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: 'https://process-only-url.supabase.co'
      }
    });

    expect(config).toMatchObject({
      url: 'https://file-project.supabase.co',
      key: 'sb_publishable_file_project',
      sources: {
        url: path.join('.vercel', '.env.production.local'),
        key: path.join('.vercel', '.env.production.local')
      }
    });
  });

  it('accepts a legacy anon key but rejects secret and service-role keys without echoing them', () => {
    const anonKey = mockLegacyKey('anon');
    expect(
      validateDesktopAuthConfig({
        url: 'https://project.supabase.co',
        key: anonKey,
        keyEnvName: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        keyType: 'legacy-anon',
        sources: { url: 'test', key: 'test' }
      }).keyType
    ).toBe('legacy-anon');

    const secretKey = 'sb_secret_do_not_echo_this_value';
    expect(() =>
      validateDesktopAuthConfig({
        url: 'https://project.supabase.co',
        key: secretKey,
        keyEnvName: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
        keyType: 'publishable',
        sources: { url: 'test', key: 'test' }
      })
    ).toThrow('拒绝把 Supabase secret key 注入桌面客户端。');

    try {
      validateDesktopAuthConfig({
        url: 'https://project.supabase.co',
        key: secretKey,
        keyEnvName: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
        keyType: 'publishable',
        sources: { url: 'test', key: 'test' }
      });
    } catch (error) {
      expect(error.message).not.toContain(secretKey);
    }

    expect(() =>
      validateDesktopAuthConfig({
        url: 'https://project.supabase.co',
        key: mockLegacyKey('service_role'),
        keyEnvName: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        keyType: 'legacy-anon',
        sources: { url: 'test', key: 'test' }
      })
    ).toThrow('拒绝把 Supabase service_role key 注入桌面客户端。');
  });

  it('verifies exact public config in the static export and rejects high-privilege leakage', async () => {
    const projectRoot = await createTemporaryProject();
    const staticDirectory = path.join(projectRoot, '.next-desktop', '_next', 'static', 'chunks');
    await mkdir(staticDirectory, { recursive: true });
    const config = {
      url: 'https://project.supabase.co',
      key: 'sb_publishable_test_public_key',
      keyEnvName: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      keyType: 'publishable'
    };
    await writeFile(
      path.join(staticDirectory, 'auth.js'),
      `window.__auth=${JSON.stringify({ url: config.url, key: config.key })}`,
      'utf8'
    );

    await expect(
      verifyDesktopAuthExport({
        distDirectory: path.join(projectRoot, '.next-desktop'),
        config
      })
    ).resolves.toMatchObject({ configured: true, keyType: 'publishable' });

    await writeFile(
      path.join(staticDirectory, 'leak.js'),
      'window.__bad="sb_secret_never_ship"',
      'utf8'
    );
    await expect(
      verifyDesktopAuthExport({
        distDirectory: path.join(projectRoot, '.next-desktop'),
        config
      })
    ).rejects.toThrow('桌面静态产物中检测到 Supabase secret key。');
  });

  it('checks the public Auth endpoint without sending user credentials', async () => {
    const config = {
      url: 'https://project.supabase.co',
      key: 'sb_publishable_test_public_key'
    };
    const calls = [];
    const result = await verifySupabasePublicAuthEndpoint({
      config,
      fetchImpl: async (url, options) => {
        calls.push({ url: String(url), options });
        return { ok: true, status: 200 };
      }
    });

    expect(result).toEqual({ reachable: true, status: 200 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://project.supabase.co/auth/v1/settings');
    expect(calls[0].options.method).toBe('GET');
    expect(calls[0].options).not.toHaveProperty('body');
    expect(calls[0].options.headers).toEqual({ apikey: config.key });
  });

  it('wires the guarded runner into desktop build and revalidates during packaging', async () => {
    const projectRoot = path.resolve(import.meta.dirname, '..');
    const [packageRaw, packageScript] = await Promise.all([
      readFile(path.join(projectRoot, 'package.json'), 'utf8'),
      readFile(path.join(projectRoot, 'scripts', 'package-desktop-release.mjs'), 'utf8')
    ]);
    const packageJson = JSON.parse(packageRaw);

    expect(packageJson.scripts['build:desktop']).toBe(
      'node ./scripts/run-desktop-next.mjs build'
    );
    expect(packageJson.scripts['dev:desktop']).toBe(
      'node ./scripts/run-desktop-next.mjs dev'
    );
    expect(packageScript).toContain('resolveDesktopD1BuildEnvironment(process.env)');
    expect(packageScript).toContain("verifyDesktopD1Export(path.join(projectRoot,'.next-desktop'))");
  });

  it('launches the real dev runner with the approved desktop environment and forwarded arguments', async () => {
    const projectRoot = path.resolve(import.meta.dirname, '..');
    const fixtureRoot = await createTemporaryProject();
    const nextBin = path.join(fixtureRoot, 'node_modules', 'next', 'dist', 'bin');
    await mkdir(nextBin, { recursive: true });
    // The actual runner spawns this harmless fixture in place of a listening server.
    // Only public build settings are returned; inherited process credentials are never printed.
    await writeFile(path.join(nextBin, 'next'), `
      const keys = ['NEXT_PUBLIC_BACKEND_PROVIDER','NEXT_PUBLIC_D1_API_URL','NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY','SEEKOFFER_BUILD_TARGET','NEXT_PUBLIC_SEEKOFFER_SURFACE','NEXT_TELEMETRY_DISABLED','SEEKOFFER_OFFLINE_BUILD'];
      console.log(JSON.stringify({args: process.argv.slice(2), env: Object.fromEntries(keys.map(key => [key, process.env[key]])), staleSupabase: Object.keys(process.env).filter(key => key.startsWith('NEXT_PUBLIC_SUPABASE_'))}));
    `, 'utf8');
    const result = spawnSync(process.execPath, [path.join(projectRoot, 'scripts', 'run-desktop-next.mjs'), 'dev', '--', '--hostname', '127.0.0.1', '--port', '3000'], {
      cwd: fixtureRoot, windowsHide: true, encoding: 'utf8', timeout: 10_000,
      env: { ...process.env, ...desktopD1PublicConfig, NODE_OPTIONS: '', NEXT_PUBLIC_SUPABASE_URL: 'https://obsolete.example.invalid' }
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual({
      args: ['dev', '--hostname', '127.0.0.1', '--port', '3000'],
      env: { ...desktopD1PublicConfig, SEEKOFFER_BUILD_TARGET: 'desktop', NEXT_PUBLIC_SEEKOFFER_SURFACE: 'desktop', NEXT_TELEMETRY_DISABLED: '1', SEEKOFFER_OFFLINE_BUILD: 'true' },
      staleSupabase: []
    });
  });

  it('isolates the development app identifier without altering the release app identity', async () => {
    const projectRoot = path.resolve(import.meta.dirname, '..');
    const [base, development, release, packageJson] = await Promise.all([
      'src-tauri/tauri.conf.json', 'src-tauri/tauri.development.conf.json',
      'src-tauri/tauri.release.conf.json', 'package.json'
    ].map(async filename => JSON.parse(await readFile(path.join(projectRoot, filename), 'utf8'))));
    const developmentApp = { ...base, ...development };
    const releaseApp = { ...base, ...release };
    expect(developmentApp.identifier).toBe('com.seekoffer.desktop.development');
    expect(developmentApp.identifier).not.toBe(releaseApp.identifier);
    expect(developmentApp.bundle.active).toBe(false);
    expect(releaseApp.identifier).toBe('com.seekoffer.desktop');
    const configPath = script => path.resolve(projectRoot, script.match(/--config\s+(\S+)/)?.[1] || 'missing-config');
    expect(configPath(packageJson.scripts['desktop:dev'])).toBe(path.join(projectRoot, 'src-tauri', 'tauri.development.conf.json'));
    expect(configPath(packageJson.scripts['desktop:compile'])).toBe(path.join(projectRoot, 'src-tauri', 'tauri.release.conf.json'));
    expect(packageJson.scripts['desktop:compile']).not.toContain('tauri.development.conf.json');
  });
});
