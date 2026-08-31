import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');
const cssSource = readFileSync(resolve(projectRoot, 'app/desktop-flagship.css'), 'utf8');
const coherenceSource = readFileSync(resolve(projectRoot, 'app/desktop-app-coherence.css'), 'utf8');
const homeSource = readFileSync(resolve(projectRoot, 'components/desktop-home.tsx'), 'utf8');
const stylesheet = postcss.parse(cssSource, { from: 'app/desktop-flagship.css' });
const finalMarker = '/* APPLICATION REFERENCE LIST AUTHORITY';
const finalStart = coherenceSource.indexOf(finalMarker);
const finalEnd = coherenceSource.indexOf('/* END FINAL NOTICE-LIBRARY PARITY AUTHORITY */', finalStart);
const finalStylesheet = postcss.parse(
  coherenceSource.slice(finalStart, finalEnd),
  { from: 'app/desktop-app-coherence.css' }
);

function declarations(selector: string) {
  const values = new Map<string, string>();
  stylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.includes(selector)) return;
    rule.walkDecls((declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

function finalDeclarations(selector: string) {
  const values = new Map<string, string>();
  finalStylesheet.walkRules((rule: Rule) => {
    if (!rule.selectors.some((candidate) => candidate.includes(selector))) return;
    if (rule.parent?.type !== 'root') return;
    rule.walkDecls((declaration) => {
      values.set(declaration.prop, declaration.value.replace(/\s*!important\s*$/, '').trim());
    });
  });
  return values;
}

describe('Image2 application workbench visual contract', () => {
  it('uses the final scan-first application row rather than a legacy fixed-height layer', () => {
    expect(finalStart).toBeGreaterThanOrEqual(0);
    expect(finalEnd).toBeGreaterThan(finalStart);
    const row = finalDeclarations('.desktop-application-object-row');
    const title = finalDeclarations('.desktop-application-object-copy strong');
    const department = finalDeclarations(
      '.desktop-application-object-copy > div > span:not(.desktop-application-object-priority)'
    );
    const supporting = finalDeclarations('.desktop-application-object-project-title');

    expect(row.get('height')).toBe('auto');
    expect(row.get('min-height')).toBe('130px');
    expect(row.get('max-height')).toBe('none');
    expect(row.get('margin')).toBe('0');
    expect(row.get('border-radius')).toBe('14px');
    expect(title.get('font-size')).toBe('20px');
    expect(department.get('font-size')).toBe('13px');
    expect(supporting.get('font-size')).toBe('13px');
  });

  it('turns overview, progress, next step and materials into one continuous work surface', () => {
    const overview = declarations('.desktop-app-shell .desktop-project-overview-grid');
    const overviewCell = declarations('.desktop-app-shell .desktop-project-overview-card');
    const stage = declarations('.desktop-app-shell .desktop-project-stage-section');
    const nextStep = declarations('.desktop-app-shell .desktop-project-next-action');
    const materials = declarations(
      '.desktop-app-shell .desktop-project-material-overview-section'
    );
    const materialRow = declarations(
      '.desktop-app-shell .desktop-project-workspace-checklist > .desktop-project-material-row'
    );

    expect(overview.get('border')).toBe('0');
    expect(overview.get('border-bottom')).toBe('1px solid var(--so-border)');
    expect(overview.get('background')).toBe('transparent');
    expect(overviewCell.get('background')).toBe('transparent');
    expect(overviewCell.get('box-shadow')).toBe('none');
    expect(stage.get('border-bottom')).toBe('1px solid var(--so-border)');
    expect(stage.get('background')).toBe('transparent');
    expect(nextStep.get('background')).toBe('#f4faf7');
    expect(nextStep.get('box-shadow')).toBe('none');
    expect(materials.get('background')).toBe('transparent');
    expect(materialRow.get('min-height')).toBe('52px');
    expect(materialRow.get('font-size')).toBe('13px');
  });

  it('keeps the existing split-pane behavior while adding workbench-specific semantics', () => {
    const layout = declarations('.desktop-app-shell .desktop-workbench-layout');
    const splitter = declarations('.desktop-app-shell .desktop-workbench-splitter');
    const list = declarations('.desktop-app-shell .desktop-project-table-body');
    const detail = declarations('.desktop-app-shell .desktop-project-workspace-body');

    expect(layout.get('grid-template-columns')).toContain('--desktop-master-width');
    expect(splitter.get('cursor')).toBe('col-resize');
    expect(list.get('overflow-y')).toBe('auto');
    expect(detail.get('overflow-y')).toBe('auto');
    expect(homeSource).toContain('className="desktop-project-workspace-mark"');
    expect(homeSource.match(/className="desktop-project-workspace-primary desktop-project-workspace-primary-action"/g)).toHaveLength(1);
    expect(homeSource).toContain('desktop-project-overview-strip');
    expect(homeSource).toContain('desktop-project-stage-workflow');
    expect(homeSource).toContain('desktop-project-next-step-surface');
    expect(homeSource).toContain('desktop-project-material-surface');
    expect(homeSource).toContain('className="desktop-project-material-row"');
  });

  it('puts one primary next action before the optional seven-stage timeline', () => {
    const overviewStart = homeSource.indexOf('activeWorkspaceTab === \'overview\'');
    const overviewSource = homeSource.slice(
      overviewStart,
      homeSource.indexOf("activeWorkspaceTab === 'materials'", overviewStart)
    );
    const nextActionIndex = overviewSource.indexOf('desktop-project-next-step-surface');
    const overviewSummaryIndex = overviewSource.indexOf('desktop-project-overview-strip');
    const stageTimelineIndex = overviewSource.indexOf('desktop-project-stage-workflow');

    expect(nextActionIndex).toBeGreaterThan(0);
    expect(overviewSummaryIndex).toBeGreaterThan(nextActionIndex);
    expect(stageTimelineIndex).toBeGreaterThan(nextActionIndex);
    expect(overviewSource.match(/desktop-project-workspace-primary-action/g)).toHaveLength(1);
    expect(overviewSource).toContain('aria-expanded={stageTimelineExpanded}');
    expect(overviewSource).toContain('aria-controls="desktop-project-stage-timeline"');
    expect(overviewSource).toContain("stageTimelineExpanded ? (");
    expect(overviewSource).toContain('aria-label="完整申请进度"');
    expect(overviewSource).toContain(
      "style={compactInspector ? { gridColumn: '2', justifySelf: 'start' } : undefined}"
    );
  });

  it('shows real project identity, deadline distance and every priority in dedicated cells', () => {
    expect(homeSource).not.toContain("const showPriorityEmphasis = row.item.priorityLevel === '高';");
    expect(homeSource).not.toContain('showRecommendedEmphasis');
    expect(homeSource).toContain('const projectTitle = normalizeNoticeTitle(row.project.projectName, 180);');
    expect(homeSource).toContain('，${projectTitle}，当前状态：${row.item.myStatus}');
    expect(homeSource).toContain('desktop-application-object-project-meta');
    expect(homeSource).toContain('desktop-application-object-project-title');
    expect(homeSource).toContain('desktop-application-deadline-distance');
    expect(homeSource).toContain('desktop-application-object-priority-cell');
    expect(homeSource).toContain("return { label: '高优先级', tone: 'high' as const };");
    expect(homeSource).toContain("return { label: '中优先级', tone: 'medium' as const };");
    expect(homeSource).toContain("return { label: '低优先级', tone: 'low' as const };");
  });
});
