import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(__dirname, '..');

describe('desktop application loading state', () => {
  const homeSource = readFileSync(resolve(projectRoot, 'components/desktop-home.tsx'), 'utf8');
  const mchoseCss = readFileSync(resolve(projectRoot, 'app/desktop-mchose.css'), 'utf8');
  const qqCss = readFileSync(resolve(projectRoot, 'app/desktop-qq.css'), 'utf8');
  const legacyCss = [
    readFileSync(resolve(projectRoot, 'app/desktop.css'), 'utf8'),
    readFileSync(resolve(projectRoot, 'app/desktop-mature.css'), 'utf8'),
    readFileSync(resolve(projectRoot, 'app/desktop-qq.css'), 'utf8'),
    readFileSync(resolve(projectRoot, 'app/desktop-interactions.css'), 'utf8')
  ].join('\n');

  it('keeps the workspace chrome stable and uses one quiet sync status', () => {
    expect(homeSource).toContain('desktop-workbench-loading-state');
    expect(homeSource).toContain('正在同步申请');
    expect(homeSource).toContain('正在读取项目、材料与截止时间');
    expect(homeSource).not.toContain('desktop-workbench-loading-scope');
    expect(homeSource).not.toContain('同步内容');
    expect(homeSource).toContain('aria-live="polite"');
    expect(homeSource).toContain('aria-busy="true"');
    expect(homeSource).toContain('desktop-project-toolbar desktop-application-context-toolbar');
  });

  it('does not ship the old shimmer or duplicate skeleton loading treatment', () => {
    expect(homeSource).not.toContain('正在加载工作区');
    expect(legacyCss).not.toContain('desktop-workbench-skeleton');
    expect(legacyCss).not.toContain('desktop-project-row-skeleton');
    expect(mchoseCss).not.toContain('desktop-workbench-loading-step-icon');
    expect(mchoseCss).not.toContain('linear-gradient');
    expect(qqCss).toContain('@keyframes desktop-workbench-loading-spin');
    expect(qqCss).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
