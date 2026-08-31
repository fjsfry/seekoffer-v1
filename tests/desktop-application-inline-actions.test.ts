import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const homeSource = readFileSync(resolve(root, 'components/desktop-home.tsx'), 'utf8');
const actionSource = readFileSync(resolve(root, 'components/application-action-button.tsx'), 'utf8');
const noticeSource = readFileSync(resolve(root, 'app/notices/page.tsx'), 'utf8');
const coherenceCss = readFileSync(resolve(root, 'app/desktop-app-coherence.css'), 'utf8');

describe('desktop inline application actions', () => {
  it('edits status from the card with a real keyboard-operable select', () => {
    expect(homeSource).toContain('desktop-application-inline-status');
    expect(homeSource).toContain('aria-label={`更新${getDisplaySchoolName(row.project.schoolName)}申请状态`}');
    expect(homeSource).toContain("{userStatusOptions.map((status) => (");
    expect(homeSource).toMatch(
      /void updateProjectRecord\(\s*row,\s*\{ myStatus: event\.target\.value as UserProjectStatus \},\s*'status'\s*\)/
    );
  });

  it('isolates pending and completion state to the affected row', () => {
    expect(homeSource).toContain('const [projectActionStates, setProjectActionStates]');
    expect(homeSource).toContain('const pendingProjectIdsRef = useRef(new Set<string>())');
    expect(homeSource).toContain('aria-busy={rowActionState?.phase === \'pending\'}');
    expect(homeSource).toContain("data-action-state={rowActionState?.phase || 'idle'}");
    expect(coherenceCss).toContain(".desktop-application-object-row[data-action-state='pending']");
    expect(coherenceCss).toContain(".desktop-application-object-row[data-action-state='success']");
    expect(coherenceCss).toContain(".desktop-application-object-row[data-action-state='error']");
  });

  it('opens the matching project surface from the visible current-action control', () => {
    expect(homeSource).toContain('className="desktop-application-object-next-cta"');
    expect(homeSource).toContain('event.stopPropagation();');
    expect(homeSource).toContain('void handleApplicationCardJourneyAction(');
    expect(homeSource).toContain('openProjectInspector(row, trigger, true);');
    expect(homeSource).toContain('window.requestAnimationFrame(() => setActiveWorkspaceTab(journey.tab));');
    expect(homeSource).toContain("if (journey.command === 'resume_application' || journey.command === 'open_notice')");
    expect(homeSource).toContain("const cardAction = actionExpired ? '申请已截止' : rowJourney.action;");
  });

  it('undoes only the fields from the completed mutation and persists the inverse patch', () => {
    expect(homeSource).toContain('const previousPatch = createPreviousProjectPatch');
    expect(homeSource).toContain("actionLabel: allowUndo ? '撤销' : undefined");
    expect(homeSource).toContain('await updateProjectRecord(latestRow, previousPatch, fieldKey, {');
    expect(homeSource).toContain('allowUndo: false');
    expect(homeSource).toContain('isUndo: true');
    expect(homeSource).toMatch(
      /restoreProjectPatch\(\s*applicationsRef\.current,\s*projectId,\s*previousPatch\s*\)/
    );
    expect(homeSource).not.toContain('setApplications(previousApplications)');
  });

  it('morphs a successful notice action into navigation without pretending remote deletion is undo-safe', () => {
    expect(actionSource).toContain("added ? addedLabel || '查看申请'");
    expect(actionSource).toContain("if (added) {");
    expect(actionSource).toContain("router.push('/')");
    expect(actionSource).toContain("data-action-state={pending ? 'pending' : added ? 'added' : 'idle'}");
    expect(actionSource).not.toContain('deleteUserProject');
    expect(noticeSource).toContain("deadlineLevel === 'expired' ? null");
  });
});
