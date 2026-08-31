import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');

async function getDesktopPreferenceBootstrap() {
  const layoutSource = await readFile(resolve(projectRoot, 'app/build-surface.desktop.tsx'), 'utf8');
  const match = layoutSource.match(/const desktopPreferenceBootstrap = `([\s\S]*?)`;/);
  if (!match) throw new Error('Desktop preference bootstrap was not found.');
  return match[1];
}

async function runBootstrap(storedValue: string | null, systemPrefersDark = false) {
  const bootstrap = await getDesktopPreferenceBootstrap();
  const documentElement = {
    dataset: {} as Record<string, string>,
    style: { colorScheme: '', zoom: '' }
  };

  runInNewContext(bootstrap, {
    document: { documentElement },
    localStorage: { getItem: () => storedValue },
    matchMedia: () => ({ matches: systemPrefersDark })
  });

  return documentElement;
}

describe('desktop preference bootstrap', () => {
  it.each([
    [80, '0.8'],
    [90, '0.9'],
    [100, '1'],
    [110, '1.1'],
    [125, '1.25'],
    [150, '1.5'],
    [175, '1.75'],
    [200, '2']
  ])('applies the saved %i%% zoom before the desktop app hydrates', async (zoomLevel, zoom) => {
    const root = await runBootstrap(JSON.stringify({ zoomLevel, reduceMotion: true }));

    expect(root.dataset.desktopZoomLevel).toBe(String(zoomLevel));
    expect(root.dataset.desktopReduceMotion).toBe('true');
    expect(root.style.zoom).toBe(zoom);
  });

  it.each([
    null,
    '{malformed',
    JSON.stringify({ zoomLevel: 79 }),
    JSON.stringify({ zoomLevel: 201 }),
    JSON.stringify({ zoomLevel: '150' }),
    JSON.stringify({ zoomLevel: null })
  ])('falls back to 100%% for absent or invalid stored zoom: %s', async (storedValue) => {
    const root = await runBootstrap(storedValue);

    expect(root.dataset.desktopZoomLevel).toBe('100');
    expect(root.style.zoom).toBe('1');
  });

  it.each([
    ['light', true, 'light'],
    ['light', false, 'light'],
    ['dark', true, 'dark'],
    ['dark', false, 'dark'],
    ['system', true, 'dark'],
    ['system', false, 'light']
  ])(
    'resolves the saved %s theme before hydration when system dark is %s',
    async (theme, systemPrefersDark, expectedTheme) => {
      const root = await runBootstrap(JSON.stringify({ theme }), systemPrefersDark);

      expect(root.dataset.desktopThemePreference).toBe(theme);
      expect(root.dataset.desktopTheme).toBe(expectedTheme);
      expect(root.style.colorScheme).toBe(expectedTheme);
    }
  );

  it('falls back to light before hydration for invalid or corrupt theme values', async () => {
    const invalid = await runBootstrap(JSON.stringify({ theme: 'midnight' }), true);
    const corrupt = await runBootstrap('{broken', true);

    expect(invalid.dataset.desktopTheme).toBe('light');
    expect(corrupt.dataset.desktopTheme).toBe('light');
  });
});
