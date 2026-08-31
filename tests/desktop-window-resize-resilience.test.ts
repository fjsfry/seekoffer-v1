import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const coherenceCss = readFileSync(resolve(root, 'app/desktop-app-coherence.css'), 'utf8');
const workspaceCss = readFileSync(resolve(root, 'components/desktop-workspace.module.css'), 'utf8');
const settingsCss = readFileSync(resolve(root, 'components/desktop-settings-page.module.css'), 'utf8');
const collegeCss = readFileSync(resolve(root, 'app/colleges/colleges.module.css'), 'utf8');
const helpCss = readFileSync(resolve(root, 'app/desktop-help-center-v2.css'), 'utf8');
const tauriConfig = JSON.parse(
  readFileSync(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8')
) as {
  app: { windows: Array<Record<string, unknown>> };
};

describe('desktop window resize resilience', () => {
  it('keeps the native window resizable with a practical 960x640 lower bound', () => {
    const mainWindow = tauriConfig.app.windows[0];
    expect(mainWindow.width).toBe(1440);
    expect(mainWindow.height).toBe(900);
    expect(mainWindow.minWidth).toBe(960);
    expect(mainWindow.minHeight).toBe(640);
    expect(mainWindow.resizable).toBe(true);
  });

  it('prioritizes caption controls and retains labelled navigation below the native width', () => {
    const marker = 'BEGIN NARROW DESKTOP WINDOW RESILIENCE';
    const start = coherenceCss.indexOf(marker);
    const end = coherenceCss.indexOf('END NARROW DESKTOP WINDOW RESILIENCE', start);
    const authority = coherenceCss.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(authority).toMatch(/max-width:\s*720px[\s\S]*?--so-rail-w:\s*148px !important/);
    expect(authority).toMatch(/\.desktop-search-trigger[\s\S]*?width:\s*40px !important/);
    expect(authority).toMatch(/\.desktop-window-controls\s*\{[^}]*width:\s*108px !important[^}]*min-width:\s*108px !important/);
    expect(authority).toMatch(/\.desktop-caption-button\s*\{[^}]*width:\s*36px !important/);
    expect(authority).toMatch(/max-width:\s*560px[\s\S]*?--so-rail-w:\s*128px !important/);
    expect(authority).not.toMatch(/desktop-primary-nav-item[^}]*display:\s*none/);
    expect(authority).toMatch(
      /\.desktop-college-page-toolbar-controls\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) !important/
    );
    expect(authority).toMatch(
      /\.desktop-college-page-toolbar-controls > :last-child > button\s*\{[^}]*width:\s*100% !important/
    );
  });

  it('gives the extreme browser fallback a two-row application header', () => {
    const marker = 'BEGIN NARROW DESKTOP WINDOW RESILIENCE';
    const authority = coherenceCss.slice(
      coherenceCss.indexOf(marker),
      coherenceCss.indexOf('END NARROW DESKTOP WINDOW RESILIENCE')
    );
    expect(authority).toMatch(
      /max-width:\s*480px[\s\S]*?\.desktop-application-context-header\s*\{[^}]*grid-template-rows:\s*auto auto !important/
    );
    expect(authority).toMatch(
      /\.desktop-application-context-copy h1\s*\{[^}]*white-space:\s*nowrap !important/
    );
    expect(authority).toMatch(
      /\.desktop-application-context-add\s*\{[^}]*grid-row:\s*2 !important[^}]*justify-self:\s*end !important/
    );
  });

  it('preserves the expired-project label and count at 80% zoom', () => {
    expect(coherenceCss).toMatch(
      /data-zoom-level='80'[\s\S]*?\.desktop-expired-project-toggle\s*\{[^}]*grid-template-columns:\s*minmax\(104px, 1fr\) 34px !important[^}]*grid-template-rows:\s*auto auto !important/
    );
    expect(coherenceCss).toMatch(
      /data-zoom-level='80'[\s\S]*?\.desktop-expired-project-toggle-copy > span\s*\{[^}]*overflow:\s*visible !important[^}]*text-overflow:\s*clip !important/
    );
    expect(coherenceCss).toMatch(
      /data-zoom-level='80'[\s\S]*?\.desktop-expired-project-toggle-count\s*\{[^}]*grid-row:\s*2 !important[^}]*text-overflow:\s*ellipsis !important/
    );
  });

  it('auto-places application facts before the grid reflows to three, two and one columns', () => {
    const marker = 'FINAL NOTICE-LIBRARY PARITY AUTHORITY';
    const authority = coherenceCss.slice(
      coherenceCss.indexOf(marker),
      coherenceCss.indexOf('END FINAL NOTICE-LIBRARY PARITY AUTHORITY')
    );
    expect(authority).toMatch(
      /max-width:\s*899px[\s\S]*?\.desktop-application-object-facts\s*>\s*\.desktop-application-object-fact\s*\{[^}]*grid-column:\s*auto !important[^}]*grid-row:\s*auto !important/
    );
    expect(authority).toMatch(/max-width:\s*699px[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\) !important/);
    expect(authority).toMatch(/max-width:\s*319px[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) !important/);
  });

  it('uses a bounded stacked schedule row and removes the supporting rail before collision', () => {
    const authority = workspaceCss.slice(
      workspaceCss.indexOf('Narrow-window schedule resilience authority')
    );
    expect(authority).toMatch(
      /max-width:\s*1079px[\s\S]*?\.scheduleSummaryRail\s*\{[^}]*display:\s*none !important/
    );
    expect(authority).toMatch(
      /max-width:\s*700px[\s\S]*?\.scheduleListRow\s*\{[^}]*width:\s*100% !important[^}]*grid-template-columns:\s*44px minmax\(0, 1fr\) !important[^}]*grid-template-rows:\s*auto auto auto !important/
    );
    expect(authority).toMatch(
      /\.scheduleListRow \.rowEnd\s*\{[^}]*max-width:\s*100% !important[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 92px !important/
    );
    expect(authority).toMatch(
      /max-height:\s*640px[\s\S]*?\.masterPane\s*\{[^}]*display:\s*block !important[^}]*height:\s*100% !important[^}]*overflow-y:\s*auto !important/
    );
    expect(authority).toMatch(
      /max-height:\s*640px[\s\S]*?\.masterToolbar\s*\{[^}]*height:\s*auto !important[^}]*min-height:\s*max-content !important[^}]*max-height:\s*none !important[^}]*overflow:\s*visible !important/
    );
    expect(authority).toMatch(
      /max-height:\s*640px[\s\S]*?\.scheduleContentGrid\s*\{[^}]*min-height:\s*320px !important[^}]*margin-top:\s*12px !important[^}]*overflow:\s*visible !important/
    );
  });

  it('collapses settings to its category picker and one content column', () => {
    expect(settingsCss).toMatch(
      /@container settings-integrity \(max-width:\s*700px\)[\s\S]*?\.desktop-settings-layout\)\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) !important/
    );
    expect(settingsCss).toMatch(
      /max-width:\s*700px[\s\S]*?\.desktop-settings-nav\)\s*\{[^}]*display:\s*none !important/
    );
    expect(settingsCss).toMatch(
      /max-width:\s*700px[\s\S]*?\.desktop-settings-category-picker\)\s*\{[^}]*display:\s*grid !important/
    );
    expect(settingsCss).toMatch(
      /max-width:\s*700px[\s\S]*?\.desktop-settings-content\)\s*\{[^}]*width:\s*100% !important[^}]*max-width:\s*none !important/
    );
    expect(settingsCss).toMatch(
      /@media \(max-width:\s*900px\)[\s\S]*?\.desktop-settings-layout\)\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) !important/
    );
    expect(settingsCss).toMatch(
      /max-width:\s*900px[\s\S]*?\.desktop-settings-layout\)\s*\{[^}]*grid-template-areas:[^}]*'settings-picker'[^}]*'settings-panel' !important/
    );
    expect(settingsCss).toMatch(
      /max-width:\s*900px[\s\S]*?\.desktop-settings-category-picker\)\s*\{[^}]*width:\s*100% !important[^}]*display:\s*grid !important[^}]*grid-area:\s*settings-picker !important/
    );
    expect(settingsCss).toMatch(
      /max-width:\s*900px[\s\S]*?\.desktop-settings-content\)\s*\{[^}]*grid-area:\s*settings-panel !important[^}]*grid-row:\s*2 !important/
    );
    expect(settingsCss).toMatch(
      /@media \(max-width:\s*640px\)[\s\S]*?\.desktop-settings-category-picker\)\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) !important/
    );
    expect(settingsCss).toMatch(
      /max-width:\s*900px[\s\S]*?\.desktop-setting-row\)[\s\S]*?display:\s*grid !important[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) !important/
    );
    expect(settingsCss).toMatch(
      /max-width:\s*900px[\s\S]*?\.desktop-setting-control\)\s*\{[^}]*justify-content:\s*flex-start !important[^}]*flex-wrap:\s*wrap !important/
    );
  });

  it('keeps the extreme college card bounded and moves secondary stats to a second row', () => {
    expect(collegeCss).toMatch(
      /@media \(max-width:\s*480px\)[\s\S]*?\.collegeCard,[\s\S]*?\.collegeStats,[\s\S]*?max-width:\s*100%/
    );
    expect(collegeCss).toMatch(
      /max-width:\s*480px[\s\S]*?\.collegeStats\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto[^}]*grid-template-rows:\s*auto auto/
    );
    expect(collegeCss).toMatch(
      /max-width:\s*480px[\s\S]*?\.noticeSecondary\s*\{[^}]*grid-column:\s*1 \/ -1[^}]*grid-row:\s*2/
    );
  });

  it('keeps the compact help section action on one readable line', () => {
    expect(helpCss).toMatch(
      /@media \(max-width:\s*560px\)[\s\S]*?\.desktop-guide-section-heading > button\s*\{[^}]*min-width:\s*80px !important[^}]*white-space:\s*nowrap !important/
    );
  });
});
