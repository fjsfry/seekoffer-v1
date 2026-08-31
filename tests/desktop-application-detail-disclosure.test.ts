import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const homeSource = readFileSync(resolve(root, 'components/desktop-home.tsx'), 'utf8');
const cssSource = readFileSync(resolve(root, 'app/desktop-app-coherence.css'), 'utf8');
const marker = '/* FINAL APPLICATION DETAIL DISCLOSURE AUTHORITY';
const markerEnd = '/* END FINAL APPLICATION DETAIL DISCLOSURE AUTHORITY */';
const start = cssSource.indexOf(marker);
const end = cssSource.indexOf(markerEnd, start);
const disclosureCss = cssSource.slice(start, end);

describe('desktop application detail disclosure', () => {
  it('keeps the application list full-width until a project is explicitly opened', () => {
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(cssSource.match(/\/\* FINAL APPLICATION DETAIL DISCLOSURE AUTHORITY/g)).toHaveLength(1);
    expect(cssSource).not.toContain('/* APPLICATION DETAIL ON DEMAND');
    expect(homeSource).toContain("data-detail-open={inspectorOpen ? 'true' : 'false'}");
    expect(disclosureCss).toMatch(
      /\.desktop-qq-workbench-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/
    );
    expect(disclosureCss).toMatch(
      /\.desktop-qq-workbench-layout > \.desktop-application-context\s*\{[^}]*width:\s*100%/
    );
    expect(disclosureCss).toMatch(
      /\[data-detail-open='false'\][\s\S]*?\.desktop-workbench-splitter\s*\{[^}]*display:\s*none/
    );
    expect(homeSource).toContain('{inspectorOpen && !compactInspector ? (');
  });

  it('opens the regular-width detail as a large right-side layer and hides it accessibly when closed', () => {
    expect(disclosureCss).toMatch(
      /\.desktop-qq-workbench-layout > \.desktop-project-workspace\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0 0 0 var\(--desktop-master-width\)[^}]*visibility:\s*hidden[^}]*pointer-events:\s*none/
    );
    expect(disclosureCss).toMatch(
      /\[data-detail-open='true'\][\s\S]*?\.desktop-project-workspace\.is-open\s*\{[^}]*visibility:\s*visible[^}]*pointer-events:\s*auto/
    );
    expect(homeSource).toContain('aria-hidden={!inspectorOpen}');
    expect(homeSource).toContain('inert={!inspectorOpen ? true : undefined}');
    expect(homeSource).toContain('aria-controls="desktop-project-workspace"');
    expect(homeSource).toContain('aria-expanded={inspectorOpen && selected}');
  });

  it('switches drawer and high-zoom layouts to one complete detail panel', () => {
    expect(disclosureCss).toMatch(
      /\[data-layout-mode='drawer'\]\[data-detail-open='true'\][\s\S]*?\.desktop-application-context\s*\{[^}]*display:\s*none/
    );
    expect(disclosureCss).toMatch(
      /\[data-layout-mode='drawer'\]\[data-detail-open='true'\][\s\S]*?\.desktop-project-workspace\.is-open\s*\{[^}]*display:\s*block/
    );
    expect(homeSource).toContain("{compactInspector ? '返回申请列表' : '关闭详情'}");
    expect(disclosureCss).toMatch(
      /\[data-layout-mode='drawer'\][\s\S]*?\.desktop-project-workspace-header\s*\{[^}]*display:\s*grid[^}]*grid-template-rows:\s*auto auto/
    );
    expect(disclosureCss).toMatch(
      /@container project-workspace \(max-width: 620px\)[\s\S]*?\.desktop-project-workspace-actions\s*\{[^}]*grid-row:\s*1[^}]*justify-content:\s*flex-start/
    );
    expect(disclosureCss).toMatch(
      /@container project-workspace \(max-width: 620px\)[\s\S]*?\.desktop-project-workspace-identity\s*\{[^}]*grid-row:\s*2/
    );
    expect(disclosureCss).toMatch(
      /\[data-layout-mode='drawer'\][\s\S]*?\.desktop-qq-workbench-layout > \.desktop-project-workspace\s*\{[^}]*overflow-y:\s*auto/
    );
    expect(disclosureCss).toMatch(
      /\[data-layout-mode='drawer'\][\s\S]*?\.desktop-project-workspace-body\s*\{[^}]*height:\s*auto[^}]*overflow:\s*visible/
    );
  });

  it('opens on click, Enter, Space and double-click without routing away', () => {
    expect(homeSource).toContain('openProjectInspector(row, event.currentTarget, event.detail > 1)');
    expect(homeSource).toContain("if (event.key === 'Enter' || event.key === ' ')");
    expect(homeSource).toContain('openProjectInspector(row, event.currentTarget, true)');

    const doubleClickStart = homeSource.indexOf('onDoubleClick={(event) => {');
    const contextMenuStart = homeSource.indexOf('onContextMenu={(event) => {', doubleClickStart);
    const doubleClickHandler = homeSource.slice(doubleClickStart, contextMenuStart);
    expect(doubleClickHandler).toContain('openProjectInspector');
    expect(doubleClickHandler).not.toContain('openOfficialProject');
    expect(doubleClickHandler).not.toContain('router.push');
  });

  it('does not let inline status or menu actions accidentally open detail', () => {
    expect(homeSource).toContain(
      "if (target?.closest('a,button,input,select,textarea,label,[role=\"button\"],[data-row-interactive]')) return;"
    );
    expect(homeSource).toContain('onClick={(event) => event.stopPropagation()}');
    expect(homeSource).toContain('className="desktop-application-object-menu-trigger"');
    expect(homeSource).toContain('event.stopPropagation();');
  });

  it('keeps no-selection stable and closes instead of silently switching an open detail', () => {
    expect(homeSource).toContain(
      "filteredRows.find((row) => row.item.userProjectId === selectedId) || null"
    );
    expect(homeSource).toContain('const selectedStillVisible = !selectedId || filteredRows.some(');
    expect(homeSource).toContain('const shouldRestoreFocus = inspectorOpen;');
    expect(homeSource).toContain("tabIndex={selected || (!selectedId && index === 0) ? 0 : -1}");
    expect(homeSource).toContain("openedLinkedProjectRef.current !== projectId");
  });

  it('supports Escape, a clear close action and focus restoration to the originating row', () => {
    expect(homeSource).toContain("detailReturnFocusRef.current = trigger || rowElement || activeElement");
    expect(homeSource).toContain('detailReturnFocusRef.current, selectedElement');
    expect(homeSource).toContain("event.key !== 'Escape'");
    expect(homeSource).toContain('setInspectorOpen(false);');
    expect(homeSource).toContain('focusSelectedRow();');
    expect(homeSource).toContain('data-project-detail-primary');
    expect(homeSource).toContain("aria-label={compactInspector ? '返回申请列表' : '关闭项目详情'}");
    expect(disclosureCss).toMatch(
      /\[data-detail-open='true'\][\s\S]*?\.desktop-inspector-close\s*\{[^}]*display:\s*inline-flex/
    );
  });
});
