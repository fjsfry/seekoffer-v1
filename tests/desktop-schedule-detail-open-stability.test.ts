import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const cssSource = readFileSync(resolve(root, 'components/desktop-workspace.module.css'), 'utf8');
const marker = 'Schedule detail-open stability authority';
const start = cssSource.indexOf(marker);
const stabilitySource = cssSource.slice(start);

describe('desktop schedule detail-open stability', () => {
  it('collapses the hidden summary track before reserving the side peek', () => {
    expect(start).toBeGreaterThan(0);
    expect(stabilitySource).toMatch(
      /workspace\[data-detail-open='true'\][\s\S]*?\.scheduleContentGrid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) !important/
    );
    expect(stabilitySource).toContain(
      'padding-right: calc(clamp(440px, 42cqi, 560px) + 16px) !important'
    );
    expect(stabilitySource).toMatch(
      /workspace\[data-detail-open='true'\][\s\S]*?\.masterScroll\s*\{[^}]*padding-right:\s*clamp\(440px, 42cqi, 560px\) !important[^}]*transition:\s*none !important/
    );
  });

  it('keeps the compact toolbar inside the same collection footprint', () => {
    expect(stabilitySource).toMatch(
      /workspace\[data-detail-open='true'\][\s\S]*?\.masterToolbar\s*\{[^}]*grid-template-columns:\s*minmax\(280px, 1fr\) minmax\(220px, \.78fr\) !important/
    );
    expect(stabilitySource).toMatch(
      /workspace\[data-detail-open='true'\][\s\S]*?\.masterToolbar\s*\{[^}]*transition:\s*none !important/
    );
    expect(stabilitySource).toMatch(
      /workspace\[data-detail-open='true'\][\s\S]*?\.scheduleToolbarTop\s*\{[^}]*grid-row:\s*1 \/ span 2 !important/
    );
    expect(stabilitySource).toMatch(
      /workspace\[data-detail-open='true'\][\s\S]*?\.categoryFilterBar\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\) !important/
    );
  });

  it('reflows rows deliberately instead of squeezing the body track to zero', () => {
    expect(stabilitySource).toMatch(
      /workspace\[data-detail-open='true'\][\s\S]*?\.scheduleListRow\s*\{[^}]*min-height:\s*154px !important[^}]*grid-template-columns:\s*44px 92px minmax\(0, 1fr\) !important[^}]*grid-template-rows:\s*auto auto !important/
    );
    expect(stabilitySource).toMatch(
      /workspace\[data-detail-open='true'\][\s\S]*?\.scheduleListRow \.rowEnd\s*\{[^}]*grid-column:\s*1 \/ -1 !important[^}]*grid-row:\s*2 !important/
    );
    expect(stabilitySource).toMatch(
      /workspace\[data-detail-open='true'\][\s\S]*?\.scheduleListRow \.inlineQuickAction\s*\{[^}]*grid-column:\s*3 !important/
    );
  });

  it('uses the detail-only flow before the side peek would become too narrow', () => {
    expect(stabilitySource).toContain('@container schedule-workspace-page (max-width: 1079px)');
    expect(stabilitySource).toMatch(
      /workspace\[data-detail-open='true'\] \.masterPane\s*\{[^}]*display:\s*none !important/
    );
    expect(stabilitySource).toMatch(
      /workspace\[data-detail-open='true'\] \.detailPane\s*\{[^}]*position:\s*static !important[^}]*width:\s*100% !important[^}]*display:\s*flex !important/
    );
  });

  it('keeps the toolbar transition behind both reduced-motion gates', () => {
    expect(stabilitySource).toContain('@media (prefers-reduced-motion: reduce)');
    expect(stabilitySource).toContain("html[data-desktop-reduce-motion='true']");
    expect(stabilitySource).toMatch(/\.schedulePage \.masterToolbar\s*\{[^}]*transition:\s*none !important/);
  });
});
