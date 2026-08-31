import fs from 'node:fs';
import path from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const cssPath = path.join(root, 'app', 'desktop-flagship.css');
const cssSource = fs.readFileSync(cssPath, 'utf8');
const layoutSource = fs.readFileSync(path.join(root, 'app', 'build-surface.desktop.tsx'), 'utf8');
const stylesheet = postcss.parse(cssSource, { from: cssPath });

function rootTokens() {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.includes('.seekoffer-desktop-surface')) return;
    rule.walkDecls((declaration: Declaration) => {
      if (declaration.prop.startsWith('--')) values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

describe('SeekOffer Image2 desktop design system', () => {
  it('keeps the four approved Image2 concepts as the visual source of truth', () => {
    const expectedFiles = [
      '01-workbench.png',
      '02-settings.png',
      '03-information-library.png',
      '04-schedule.png'
    ];
    const manifestPath = path.join(
      root,
      'docs',
      'design-qa',
      'desktop-image2-redesign-v1.manifest.json'
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      schemaVersion: number;
      sourceDirectory: string;
      files: Array<{ file: string; bytes: number; sha256: string }>;
    };

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.sourceDirectory).toBe('artifacts/desktop-image2-redesign-v1');
    expect(manifest.files.map((item) => item.file)).toEqual(expectedFiles);
    for (const item of manifest.files) {
      expect(item.bytes).toBeGreaterThan(0);
      expect(item.sha256).toMatch(/^[0-9A-F]{64}$/);
    }
    expect(
      fs.existsSync(path.join(root, 'docs', 'design-qa', 'desktop-image2-redesign-v1.md'))
    ).toBe(true);
  });

  it('derives the desktop palette and type scale from the SeekOffer website', () => {
    const tokens = rootTokens();
    expect(tokens.get('--so-canvas')).toBe('#f7faf9');
    expect(tokens.get('--so-surface')).toBe('#ffffff');
    expect(tokens.get('--so-brand')).toBe('#17494d');
    expect(tokens.get('--so-brand-hover')).toBe('#102f34');
    expect(tokens.get('--so-brand-soft')).toBe('#eff7f6');
    expect(tokens.get('--so-text')).toBe('#122026');
    expect(tokens.get('--so-text-secondary')).toBe('#475b62');
    expect(tokens.get('--so-border')).toBe('#dfe8e5');
    expect(tokens.get('--desktop-type-page-title')).toBe('24px');
    expect(tokens.get('--desktop-type-section-title')).toBe('17px');
    expect(tokens.get('--desktop-type-body')).toBe('14px');
    expect(tokens.get('--desktop-type-caption')).toBe('12px');
    expect(tokens.get('--desktop-control-height')).toBe('40px');
  });

  it('uses one final coherence authority after the route-specific desktop layers', () => {
    const desktopImports = [...layoutSource.matchAll(/import\s+['"]\.\/(desktop[^'"]*\.css)['"]/g)].map(
      (match) => match[1]
    );
    expect(desktopImports.at(-1)).toBe('desktop-app-coherence.css');
    expect(desktopImports.filter((file) => file === 'desktop-app-coherence.css')).toHaveLength(1);
    expect(new Set(desktopImports).size).toBe(desktopImports.length);
    expect(layoutSource).not.toContain('desktop-image2.css');
  });

  it('keeps production UI free of AI-style visual shortcuts and undersized copy', () => {
    expect(cssSource).not.toMatch(/font-size:\s*(?:9|11|11\.5)px/);
    expect(cssSource).not.toMatch(/font-weight:\s*(?:550|650|750)/);
    expect(cssSource).not.toMatch(/(?:linear|radial)-gradient\(/);
    expect(cssSource).not.toMatch(/transition:\s*all\b/);
    expect(cssSource).not.toContain('[class*=');
  });

  it('ships all core page compositions under the same tokens', () => {
    for (const selector of [
      '.desktop-qq-workbench-layout',
      '.desktop-settings-layout',
      '.desktop-schedule-layout',
      '.desktop-contacts-list',
      '.desktop-notice-library',
      '.desktop-college-grid',
      '.desktop-resource-page',
      '.desktop-secondary-page',
      '.desktop-route-loading',
      '.desktop-reminder-center'
    ]) {
      expect(cssSource, selector).toContain(selector);
    }
  });
});
