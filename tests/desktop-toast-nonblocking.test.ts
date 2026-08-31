import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('desktop feedback placement', () => {
  it('does not show a redundant toast over the form opened by a direct-create command', async () => {
    const source = await readFile(resolve(root, 'components/desktop-app-shell.tsx'), 'utf8');
    const start = source.indexOf('const requestDirectCreate');
    const end = source.indexOf('useEffect(() => {', start);
    const handler = source.slice(start, end);

    expect(handler).toContain('setRouteAnnouncement(directCreateLabels[intent])');
    expect(handler).not.toContain('emitDesktopFeedback({');
    expect(handler).not.toContain('正在打开编辑面板');
  });

  it('anchors feedback beside the rail instead of covering bottom-right primary actions', async () => {
    const css = await readFile(resolve(root, 'app/desktop-flagship.css'), 'utf8');
    const start = css.indexOf('.desktop-app-shell .desktop-feedback-toast {');
    const end = css.indexOf('}', start);
    const rule = css.slice(start, end);

    expect(rule).toContain('left: calc(var(--so-rail-w) + 12px) !important;');
    expect(rule).toContain('right: auto !important;');
    expect(rule).not.toContain('calc(var(--desktop-zoomed-viewport-width, 100%) - 412px)');
  });
});
