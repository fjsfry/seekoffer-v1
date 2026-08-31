import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration } from 'postcss';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const sources = {
  shell: readFileSync(resolve(root, 'components/desktop-app-shell.tsx'), 'utf8'),
  reminder: readFileSync(resolve(root, 'components/desktop-reminder-center.tsx'), 'utf8'),
  updater: readFileSync(resolve(root, 'components/desktop-update-provider.tsx'), 'utf8')
};
const reminderStylesPath = resolve(root, 'components/desktop-reminder-center.module.css');
const reminderStyles = readFileSync(reminderStylesPath, 'utf8');

describe('desktop shell, reminder and update semantic styling', () => {
  it('uses stable component semantics instead of visual Tailwind recipes', () => {
    const visualUtility = /(?:text|bg|border|shadow|rounded|duration)-(?:slate|gray|zinc|neutral|emerald|rose|brand|ink|white|\[|\d)/;
    const arbitraryGeometry = /(?:w|h|min-w|min-h|max-w|max-h|grid-cols|tracking|z|pt)-\[/;

    for (const [name, source] of Object.entries(sources)) {
      expect(source, name).not.toMatch(visualUtility);
      expect(source, name).not.toMatch(arbitraryGeometry);
    }

    for (const semanticClass of [
      'desktop-command-search',
      'desktop-command-option--active',
      'desktop-shortcut-dialog',
      'desktop-reminder-trigger--active',
      'desktop-global-dialog-header',
      'desktop-update-toast-title',
      'desktop-update-progress-track'
    ]) {
      expect(`${sources.shell}\n${sources.updater}`).toContain(semanticClass);
    }
  });

  it('keeps the reminder drawer on shared color, geometry and motion tokens', () => {
    for (const token of [
      'var(--so-text)',
      'var(--so-text-secondary)',
      'var(--so-surface)',
      'var(--so-divider)',
      'var(--app-radius-control)',
      'var(--motion-hover)',
      'var(--motion-ease-standard)'
    ]) {
      expect(reminderStyles).toContain(token);
    }
    expect(reminderStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(reminderStyles).toContain('@media (forced-colors: active)');
  });

  it('keeps reminder text readable and limits weight to 400, 500 and 600', () => {
    const stylesheet = postcss.parse(reminderStyles, { from: reminderStylesPath });
    const smallText: string[] = [];
    const invalidWeights: string[] = [];

    stylesheet.walkDecls((declaration: Declaration) => {
      if (declaration.prop === 'font-size') {
        const match = /^(\d+(?:\.\d+)?)px$/.exec(declaration.value.trim());
        if (match && Number(match[1]) < 12) {
          smallText.push(`${declaration.source?.start?.line ?? 0}:${declaration.value}`);
        }
      }
      if (declaration.prop === 'font-weight' && !['400', '500', '600'].includes(declaration.value.trim())) {
        invalidWeights.push(`${declaration.source?.start?.line ?? 0}:${declaration.value}`);
      }
    });

    expect(smallText).toEqual([]);
    expect(invalidWeights).toEqual([]);
  });
});
