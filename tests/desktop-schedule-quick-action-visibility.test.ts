import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('desktop schedule quick action visibility', () => {
  it('reserves the side inspector footprint instead of placing row actions beneath it', async () => {
    const css = await readFile(resolve(root, 'components/desktop-workspace.module.css'), 'utf8');

    expect(css).toContain(".schedulePage .workspace[data-detail-open='true'] .masterScroll");
    expect(css).toContain('padding-right: clamp(440px, 42cqi, 560px);');
    expect(css).toContain('transition-duration: var(--motion-panel, 250ms);');
    expect(css).toContain('Schedule detail-open stability authority');
    expect(css).toMatch(
      /workspace\[data-detail-open='true'\][\s\S]*?\.scheduleContentGrid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) !important/
    );
    expect(css).toContain(
      'padding-right: calc(clamp(440px, 42cqi, 560px) + 16px) !important'
    );
    expect(css).toMatch(
      /workspace\[data-detail-open='true'\][\s\S]*?\.categoryFilterBar\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\) !important/
    );
  });
});
