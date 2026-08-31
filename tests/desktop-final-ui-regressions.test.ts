import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');

function read(path: string) {
  return readFileSync(resolve(root, path), 'utf8');
}

function sourceBlock(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

function relativeLuminance(hex: string) {
  const channels = hex
    .replace('#', '')
    .match(/.{2}/g)!
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(left: string, right: string) {
  const first = relativeLuminance(left);
  const second = relativeLuminance(right);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe('desktop final UI regression guards', () => {
  it('uses the defined surface hover token in settings and workspace status controls', () => {
    const settingsCss = read('components/desktop-settings-page.module.css');
    const workspaceStatusCss = read('components/desktop-workspace-status.module.css');

    expect(settingsCss).not.toContain('var(--so-hover');
    expect(workspaceStatusCss).not.toContain('var(--so-hover');
    expect(settingsCss.match(/var\(--so-surface-hover/g)).toHaveLength(4);
    expect(workspaceStatusCss).toContain('background: var(--so-surface-hover, #eff0f1)');
  });

  it('keeps a visible command-search focus indicator for keyboard users', () => {
    const coherenceCss = read('app/desktop-app-coherence.css');
    const inputBlock = sourceBlock(
      coherenceCss,
      '.desktop-app-shell:is(.desktop-app-shell) .desktop-command-input {',
      '.desktop-app-shell:is(.desktop-app-shell) .desktop-command-input:focus-visible {'
    );

    expect(coherenceCss).toContain('.desktop-command-search:focus-within');
    expect(coherenceCss).toMatch(/\.desktop-command-search:focus-within\s*\{[\s\S]*?box-shadow:\s*inset 0 0 0 2px var\(--so-brand\)/);
    expect(coherenceCss).toMatch(/\.desktop-command-input:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--so-brand\)/);
    expect(inputBlock).not.toMatch(/outline:\s*(?:0|none)/);
  });

  it('gives the auth shell and every form control one shared UI font stack', () => {
    const coherenceCss = read('app/desktop-app-coherence.css');

    expect(coherenceCss).toMatch(/\.desktop-auth-shell:is\(\.desktop-auth-shell\)\s*\{[\s\S]*?--desktop-ui-font:/);
    expect(coherenceCss).toMatch(/\.desktop-auth-shell:is\(\.desktop-auth-shell\) :is\(button, input, select, textarea\)\s*\{[\s\S]*?font-family:\s*var\(--desktop-ui-font\)/);
  });

  it('keeps a visible login-field focus ring after the final skin cascade', () => {
    const coherenceCss = read('app/desktop-app-coherence.css');

    expect(coherenceCss).toMatch(
      /\.desktop-login-field:focus-within\s*\{[\s\S]*?border-color:\s*var\(--so-brand\) !important;[\s\S]*?box-shadow:\s*0 0 0 3px/
    );
    expect(coherenceCss).toMatch(
      /\.desktop-login-field\s+input:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--so-brand\) !important;/
    );
  });

  it('keeps light-theme metadata and category colors above normal-text contrast', () => {
    const coherenceCss = read('app/desktop-app-coherence.css');
    const resourceCss = read('app/desktop-resource-center.css');
    const guideCss = read('app/desktop-guide-center.css');

    expect(coherenceCss).toContain('--so-text-tertiary: #686f78;');
    expect(contrast('#686f78', '#f5f6f7')).toBeGreaterThanOrEqual(4.5);
    expect(coherenceCss).toContain('--so-danger: #b93631;');
    expect(contrast('#b93631', '#fff0ef')).toBeGreaterThanOrEqual(4.5);
    expect(coherenceCss).toMatch(
      /\.desktop-notice-deadline-list\s*>\s*\.text-slate-400\s*\{[\s\S]*?color:\s*var\(--so-text-secondary\) !important;/
    );
    for (const color of ['#5b4bb7', '#245ea8', '#0f6b61', '#9a5200']) {
      expect(resourceCss).toContain(`--resource-category: ${color};`);
      expect(contrast(color, '#f8f9fa')).toBeGreaterThanOrEqual(4.5);
    }
    for (const color of [
      '#0f6b61',
      '#245ea8',
      '#5b4bb7',
      '#9a5200',
      '#0b6f82',
      '#5d6878',
      '#a54820'
    ]) {
      expect(guideCss).toContain(`--guide-topic: ${color};`);
      expect(contrast(color, '#f8f9fa')).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('reasserts reduced motion after every final skin transition rule', () => {
    const coherenceCss = read('app/desktop-app-coherence.css');
    const finalReducedMotion = coherenceCss.slice(
      coherenceCss.lastIndexOf("html.seekoffer-desktop-surface[data-desktop-reduce-motion='true']")
    );

    expect(finalReducedMotion).toContain('animation-duration: 0.01ms !important;');
    expect(finalReducedMotion).toContain('transition-duration: 0.01ms !important;');
    expect(finalReducedMotion).toContain('animation-iteration-count: 1 !important;');
  });

  it('keeps dark filled primary actions on the accessible dark brand fill', () => {
    const coherenceCss = read('app/desktop-app-coherence.css');

    expect(contrast('#0f6b61', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#0c5e56', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#094d46', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(coherenceCss).toContain('--app-primary-bg-pressed: #094d46;');
    expect(coherenceCss).toContain("nav[aria-label='通知分页'] button[aria-current='page']");
    expect(coherenceCss).toContain("nav[aria-label='院校库分页'] button[aria-current='page']");
    expect(coherenceCss).toContain('.desktop-guide-support-cta > button');
    expect(coherenceCss).toMatch(
      /data-desktop-theme='dark'[\s\S]*?background:\s*var\(--app-primary-bg\) !important;/
    );
  });
});
