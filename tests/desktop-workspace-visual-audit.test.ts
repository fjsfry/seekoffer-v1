import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { schedulePopoverPlacement } from '../components/desktop-schedule-popover';

const css = readFileSync(resolve(import.meta.dirname, '../components/desktop-workspace.module.css'), 'utf8');
const audit = css.slice(css.indexOf('/* A compact, left-aligned header'), css.indexOf('/* Shared surface finish'));

describe('desktop workspace narrow-window visual audit', () => {
  it('keeps collection headings anchored left without forcing actions into a tall stack', () => {
    expect(audit).toContain(':is(.schedulePage, .contactsPage) .pageHeader');
    expect(audit).toMatch(/\.pageHeader\s*\{[^}]*flex-direction:\s*row\s*!important;[^}]*flex-wrap:\s*wrap\s*!important;/);
    expect(audit).toMatch(/\.pageHeading\s*\{[^}]*flex:\s*1 1 168px\s*!important;[^}]*text-align:\s*left\s*!important;/);
    expect(audit).toMatch(/\.headerActions\s*\{[^}]*width:\s*auto\s*!important;[^}]*flex-wrap:\s*wrap\s*!important;/);
    expect(audit).toMatch(/\.headerActions > \*\s*\{[^}]*width:\s*auto\s*!important;[^}]*max-width:\s*100%\s*!important;/);
  });

  it('uses available collection width to keep category filters compact and fully visible', () => {
    expect(audit).toContain('@container schedule-workspace-page (max-width: 720px) and (min-width: 420px)');
    expect(audit).toContain('grid-template-columns: repeat(4, minmax(0, 1fr)) !important;');
    expect(audit).toContain('grid-template-columns: minmax(0, 1fr) 112px !important;');
    expect(audit).toMatch(/\.searchBox\s*\{[^}]*grid-column:\s*1\s*!important;[^}]*grid-row:\s*2\s*!important;/);
    expect(audit).toMatch(/\.scheduleAdvancedFilters\s*\{[^}]*grid-column:\s*2\s*!important;[^}]*grid-row:\s*2\s*!important;/);
    expect(audit).toContain('@container schedule-workspace-page (max-width: 419px)');
    expect(audit).toContain('grid-template-columns: repeat(3, minmax(0, 1fr)) !important;');
    expect(audit).toContain('@container schedule-workspace-page (max-width: 720px) and (min-width: 500px)');
    expect(audit).toContain('grid-template-columns: minmax(268px, 1fr) minmax(170px, .7fr) !important;');
    expect(audit).not.toContain('display: none');
  });

  it('keeps the manual application submit icon and label on one line at high zoom', () => {
    expect(css).toMatch(/\.manualApplicationSaveButton\s*\{[^}]*display:\s*inline-flex\s*!important;[^}]*flex-wrap:\s*nowrap\s*!important;[^}]*white-space:\s*nowrap\s*!important;/);
  });

  it.each([0.8, 1, 1.25, 1.5, 1.75, 2])('keeps schedule filter/category/priority popovers inside the window at %sx', (scale) => {
    for (const [viewportWidth, viewportHeight] of [[720, 600], [960, 640], [1440, 900]]) {
      for (const preferredWidth of [320, 360, 380]) {
        const geometry = schedulePopoverPlacement({
          trigger: { left: viewportWidth - 140, top: viewportHeight - 200, bottom: viewportHeight - 160, width: 112 * scale },
          triggerLayoutWidth: 112,
          viewportWidth,
          viewportHeight,
          preferredWidth,
          estimatedHeight: 318
        });
        expect(geometry.left * scale).toBeGreaterThanOrEqual(12);
        expect(geometry.top * scale).toBeGreaterThanOrEqual(12);
        expect((geometry.left + geometry.width) * scale).toBeLessThanOrEqual(viewportWidth - 12 + .001);
        expect((geometry.top + geometry.maxHeight) * scale).toBeLessThanOrEqual(viewportHeight - 12 + .001);
      }
    }
  });

  it('falls back safely when a trigger has no measurable layout width', () => {
    expect(schedulePopoverPlacement({ trigger: { left: 400, top: 100, bottom: 140, width: 100 }, triggerLayoutWidth: 0, viewportWidth: 720, viewportHeight: 600, preferredWidth: 320, estimatedHeight: 318 }).width).toBe(320);
  });
});
