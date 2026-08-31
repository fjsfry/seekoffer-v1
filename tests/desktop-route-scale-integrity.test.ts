import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DESKTOP_ZOOM_LEVELS } from '@/lib/desktop-preferences';

const root = resolve(import.meta.dirname, '..');
const noticeCss = readFileSync(resolve(root, 'app/desktop-notice-alignment.css'), 'utf8');
const collegeCss = readFileSync(resolve(root, 'app/colleges/colleges.module.css'), 'utf8');
const resourceCss = readFileSync(resolve(root, 'app/resources/resources.module.css'), 'utf8');
const helpCss = readFileSync(resolve(root, 'app/desktop-help-center-v2.css'), 'utf8');
const settingsCss = readFileSync(resolve(root, 'components/desktop-settings-page.module.css'), 'utf8');
const workspaceCss = readFileSync(resolve(root, 'components/desktop-workspace.module.css'), 'utf8');
const coherenceCss = readFileSync(resolve(root, 'app/desktop-app-coherence.css'), 'utf8');
const settingsSource = readFileSync(resolve(root, 'components/desktop-settings-page.tsx'), 'utf8');

const requiredZooms = [80, 90, 100, 110, 125, 150, 175, 200];

describe('desktop route full-scale integrity', () => {
  it('covers every supported desktop zoom step', () => {
    expect([...DESKTOP_ZOOM_LEVELS]).toEqual(requiredZooms);
    for (const zoom of [125, 150, 175, 200]) {
      for (const stylesheet of [noticeCss, collegeCss, resourceCss, helpCss, settingsCss]) {
        expect(stylesheet).toContain(`data-zoom-level='${zoom}'`);
      }
    }
  });

  it('keeps notice titles, body copy, metadata and actions content-led', () => {
    const integrity = noticeCss.slice(noticeCss.indexOf('/* Full-scale integrity authority.'));
    expect(integrity).toMatch(/\.desktop-notice-card-copy\s*\{[^}]*grid-template-rows:\s*auto auto auto auto[^}]*overflow:\s*visible/);
    expect(integrity).toMatch(/\.desktop-notice-card-heading h2,[\s\S]*?white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/);
    expect(integrity).toMatch(/\.desktop-notice-card-meta,[\s\S]*?height:\s*auto[^}]*flex-wrap:\s*wrap/);
    expect(integrity).toMatch(/\.desktop-notice-card-department[^\{]*\{[^}]*text-overflow:\s*clip[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/);
    expect(integrity).toMatch(/desktop-notice-card-actions :is\(a, button\)[\s\S]*?height:\s*auto[^}]*white-space:\s*normal/);
    expect(integrity).toContain("[data-zoom-level='125']");
  });

  it('reflows college cards and keeps the filter footer reachable', () => {
    const integrity = collegeCss.slice(collegeCss.indexOf('/* 125%-200% uses the same'));
    expect(integrity).toMatch(/\.collegeTitleLine h2\s*\{[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/);
    expect(integrity).toMatch(/\.collegeActions\s*\{[^}]*grid-column:\s*1 \/ -1[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(integrity).toMatch(/\.collegeActions a\s*\{[^}]*height:\s*auto[^}]*white-space:\s*normal/);
    expect(collegeCss).toMatch(/\.filterPopover:popover-open\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto/);
    expect(collegeCss).toMatch(/\.filterPopoverBody\s*\{[^}]*overflow-y:\s*auto/);
  });

  it('keeps resource destination labels and full copy visible through high zoom', () => {
    const integrity = resourceCss.slice(resourceCss.indexOf('/* Full-scale integrity:'));
    expect(integrity).toMatch(/\.resourceTitle\.resourceTitle strong\s*\{[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/);
    expect(integrity).toMatch(/\.resourceDescription\.resourceDescription,[\s\S]*?-webkit-line-clamp:\s*unset/);
    expect(integrity).toMatch(/\.openAction\.openAction > span\s*\{[^}]*display:\s*inline/);
    expect(integrity).toMatch(/data-zoom-level='200'[\s\S]*?grid-template-areas:[\s\S]*?'action action'/);
  });

  it('keeps schedule and contact lists reachable instead of collapsing their master panes', () => {
    const integrity = workspaceCss.slice(workspaceCss.indexOf('/* High zoom uses a vertically scrollable single-panel workspace.'));
    expect(integrity).not.toBe('');
    expect(integrity).toMatch(/:is\(\s*\.schedulePage,\s*\.contactsPage\s*\)\s*\{[^}]*overflow-y:\s*auto\s*!important/);
    expect(integrity).toMatch(/\.workspace\s*\{[^}]*min-height:\s*420px[^}]*flex:\s*0 0 auto/);
    expect(integrity).toMatch(/:is\(\.masterScroll, \.detailScroll\)\s*\{[^}]*min-height:\s*180px/);
  });

  it('lets help cards and hero grow instead of clipping descriptions or support actions', () => {
    const integrity = helpCss.slice(helpCss.indexOf('/* Full-scale integrity.'));
    expect(integrity).toMatch(/> button p,[\s\S]*?-webkit-line-clamp:\s*unset/);
    expect(integrity).toMatch(/\.desktop-help-hero\s*\{[^}]*height:\s*auto[^}]*overflow:\s*visible/);
    expect(integrity).toMatch(/\.desktop-guide-hero-topline\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
    expect(integrity).toMatch(/\.desktop-guide-support-trigger\s*\{[^}]*white-space:\s*normal/);
  });

  it('adds a settings-only scale authority without touching the global shell', () => {
    expect(settingsSource).toContain("import styles from './desktop-settings-page.module.css'");
    expect(settingsSource).toContain('className={`${styles.integrityRoot} desktop-core-page');
    expect(settingsSource).toContain('className="desktop-settings-category-picker"');
    expect(settingsSource).toContain('aria-label="设置分类"');
    expect(settingsCss).toContain('container: settings-integrity / inline-size');
    expect(settingsCss).toMatch(/data-zoom-level='125'[\s\S]*?\.integrityRoot :global\(\.desktop-settings-layout\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
    expect(settingsCss).toMatch(/data-zoom-level='125'[\s\S]*?\.desktop-settings-nav\)[\s\S]*?display:\s*none/);
    expect(settingsCss).toMatch(/data-zoom-level='125'[\s\S]*?\.desktop-settings-category-picker\)[\s\S]*?display:\s*grid/);
    expect(settingsCss).toMatch(/@container settings-integrity \(max-width: 560px\)[\s\S]*?\.desktop-setting-row\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
    const finalSettings = coherenceCss.slice(coherenceCss.indexOf('/* Settings categories must all be available'));
    expect(finalSettings).not.toBe('');
    expect(finalSettings).toMatch(/\.desktop-settings-layout\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\)/);
    expect(finalSettings).toMatch(/\.desktop-settings-nav\s*\{[^}]*display:\s*none[^}]*overflow-x:\s*hidden/);
    expect(finalSettings).toMatch(/\.desktop-settings-category-picker\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\)/);
  });
});
