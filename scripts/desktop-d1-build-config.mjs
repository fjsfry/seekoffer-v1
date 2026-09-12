// Public application settings, pinned to the approved SeekOffer target.
export const desktopD1PublicConfig = Object.freeze({
  NEXT_PUBLIC_BACKEND_PROVIDER: 'd1',
  NEXT_PUBLIC_D1_API_URL: 'https://migration.seekoffer.com.cn',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_Y2xlcmsuc2Vla29mZmVyLmNvbS5jbiQ'
});

export function resolveDesktopD1BuildEnvironment(input = {}) {
  for (const [name, expected] of Object.entries(desktopD1PublicConfig)) {
    if (input[name] && input[name] !== expected) {
      // Do not echo a supplied value: it could itself contain a private key.
      throw new Error(`DESKTOP_CONFIGURATION_MISMATCH: ${name}`);
    }
  }
  const env = { ...input, ...desktopD1PublicConfig,
    SEEKOFFER_BUILD_TARGET: 'desktop', NEXT_PUBLIC_SEEKOFFER_SURFACE: 'desktop',
    NEXT_TELEMETRY_DISABLED: '1', SEEKOFFER_OFFLINE_BUILD: 'true'
  };
  for (const name of Object.keys(env)) {
    if (name.startsWith('NEXT_PUBLIC_SUPABASE_')) delete env[name];
  }
  return env;
}
