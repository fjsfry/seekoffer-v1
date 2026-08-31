import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  getDesktopFeedbackGroup,
  resolveDesktopFeedbackState,
  type DesktopFeedback
} from '@/lib/desktop-route-events';

const root = resolve(import.meta.dirname, '..');
const shellSource = readFileSync(resolve(root, 'components/desktop-app-shell.tsx'), 'utf8');
const eventSource = readFileSync(resolve(root, 'lib/desktop-route-events.ts'), 'utf8');
const interactionCss = readFileSync(resolve(root, 'app/desktop-interactions.css'), 'utf8');
const coherenceCss = readFileSync(resolve(root, 'app/desktop-app-coherence.css'), 'utf8');
const workspaceCss = readFileSync(resolve(root, 'components/desktop-workspace.module.css'), 'utf8');

function sourceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex, `missing ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `missing ${end}`).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('desktop interaction foundation', () => {
  it('offers direct create commands and bridges each action through its target route', () => {
    for (const [label, href] of [
      ['新建申请', 'desktop://new-application'],
      ['新建日程', 'desktop://new-schedule'],
      ['添加导师', 'desktop://new-contact']
    ]) {
      expect(shellSource).toContain(`label: '${label}'`);
      expect(shellSource).toContain(`href: '${href}'`);
    }

    expect(shellSource).toContain("const pendingDirectCreateRef = useRef<DesktopDirectCreateIntent | null>(null)");
    expect(shellSource).toContain("requestDirectCreate('application')");
    expect(shellSource).toContain("requestDirectCreate('schedule')");
    expect(shellSource).toContain("requestDirectCreate('contact')");
    expect(shellSource).toContain('pendingDirectCreateRef.current = intent;');
    expect(shellSource).toContain('emitDesktopRouteChange(href);');
    expect(shellSource).toContain('router.push(href);');
    expect(shellSource).toContain('requestDesktopNewApplication();');
    expect(shellSource).toContain('requestDesktopNewSchedule();');
    expect(shellSource).toContain('requestDesktopNewContact();');
    expect(shellSource).toContain(".filter((value) => !commandItems.some((item) => item.label === value))");
    expect(shellSource).toContain("if (href.startsWith('/notices?q=')) rememberCommandQuery(commandQuery);");
  });

  it('normalizes pending, success, error and undo feedback and supports explicit replacement groups', () => {
    const undo = vi.fn();
    const cases: Array<[DesktopFeedback, string]> = [
      [{ message: '等待', state: 'pending' }, 'pending'],
      [{ message: '完成', tone: 'success' }, 'success'],
      [{ message: '失败', tone: 'error' }, 'error'],
      [{ message: '已删除', actionLabel: '撤销', onAction: undo }, 'undo']
    ];
    for (const [feedback, state] of cases) {
      expect(resolveDesktopFeedbackState(feedback)).toBe(state);
    }
    expect(getDesktopFeedbackGroup({ message: '同步中', state: 'pending', group: 'sync:workspace' }))
      .toBe('sync:workspace');
    expect(eventSource).toContain("export type DesktopFeedbackState = 'pending' | 'success' | 'error' | 'undo'");

    const listener = sourceBetween(
      shellSource,
      'const handleFeedback = (event: Event) => {',
      'window.addEventListener(DESKTOP_FEEDBACK_EVENT, handleFeedback)'
    );
    expect(listener).toContain('const group = getDesktopFeedbackGroup(feedback);');
    expect(listener).toContain('feedbackGroupRef.current === group');
    expect(listener).toContain('if (!replacesCurrentGroup) setFeedbackVisible(false);');
    expect(listener).toContain('if (replacesCurrentGroup)');
    expect(shellSource).toContain('data-feedback-state={feedbackState || undefined}');
    expect(shellSource).toContain('data-feedback-group={getDesktopFeedbackGroup(feedbackItem)}');
    expect(shellSource).toContain('feedback.actionLabel && feedback.onAction');
    expect(shellSource).toContain('Math.max(8000, requestedDuration)');
  });

  it('announces feedback actions and limits Ctrl+Z undo to non-editable targets', () => {
    const keyHandler = sourceBetween(
      shellSource,
      'const handleKeyDown = (event: KeyboardEvent) => {',
      "window.addEventListener('keydown', handleKeyDown)"
    );
    const undoIndex = keyHandler.indexOf("event.key.toLowerCase() === 'z'");
    const editableGuardIndex = keyHandler.indexOf('!isEditableTarget(event.target)', undoIndex);
    const preventIndex = keyHandler.indexOf('event.preventDefault();', editableGuardIndex);
    expect(undoIndex).toBeGreaterThan(-1);
    expect(editableGuardIndex).toBeGreaterThan(undoIndex);
    expect(preventIndex).toBeGreaterThan(editableGuardIndex);
    expect(keyHandler).toContain("undoFeedback?.actionLabel === '撤销'");
    expect(keyHandler).toContain('runFeedbackAction(undoFeedback);');
    expect(shellSource).toContain("actionLabel === '撤销' ? '已撤销最近操作'");
    expect(shellSource).toContain('{feedbackAnnouncement}');
    expect(shellSource).toContain("['撤销最近操作（提示可用时）', 'Ctrl + Z']");
  });

  it('uses the Windows 83/167/250ms motion ladder with faster exits and complete reduced-motion fallbacks', () => {
    for (const declaration of [
      '--motion-faster: 83ms',
      '--motion-fast: 167ms',
      '--motion-normal: 250ms',
      '--motion-press: var(--motion-faster)',
      '--motion-hover: var(--motion-faster)',
      '--motion-popup: var(--motion-fast)',
      '--motion-panel: var(--motion-normal)',
      '--motion-modal: var(--motion-fast)',
      '--motion-route: var(--motion-fast)',
      '--motion-popup-exit: var(--motion-faster)',
      '--motion-panel-exit: var(--motion-fast)',
      '--motion-modal-exit: var(--motion-faster)'
    ]) {
      expect(interactionCss).toContain(declaration);
    }
    expect(interactionCss).toContain('animation: desktop-view-enter var(--motion-route)');
    expect(interactionCss).toContain('animation: desktop-popover-enter var(--motion-popup)');
    expect(interactionCss).toContain('animation: desktop-dialog-enter var(--motion-modal)');
    expect(interactionCss).toContain(".desktop-feedback-toast[data-feedback-state='undo']");
    expect(interactionCss).toContain('.desktop-feedback-pending-icon');
    expect(interactionCss).toContain("html[data-desktop-reduce-motion='true']");
    expect(interactionCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(interactionCss).toMatch(/desktop-feedback-pending-icon[\s\S]*?animation:\s*none !important/);
  });

  it('retains the route-owned scroll and focus restoration model', () => {
    expect(shellSource).toContain('scrollPositionsRef.current.set(');
    expect(shellSource).toContain('contentRegionRef.current.scrollTop');
    expect(shellSource).toContain('scrollPositionsRef.current.get(routeKey) || 0');
    expect(shellSource).toContain("querySelector<HTMLElement>('#main-content')?.focus({ preventScroll: true })");
    expect(shellSource).toContain('lastRouteKeyRef.current = routeKey;');
  });

  it('uses one pressed-state and motion grammar across shell, workspaces and body portals', () => {
    expect(workspaceCss).toMatch(
      /\.primaryButton:active:not\(:disabled\)\s*\{[^}]*background:\s*var\(--app-primary-bg-pressed/
    );
    expect(workspaceCss).toMatch(
      /\.secondaryButton:active:not\(:disabled\)[\s\S]*?background:\s*var\(--so-surface-pressed/
    );
    expect(workspaceCss).toMatch(
      /\.dangerButton:active:not\(:disabled\)\s*\{[^}]*background:\s*color-mix/
    );
    expect(workspaceCss).toMatch(
      /\.iconButton:active:not\(:disabled\)\s*\{[^}]*background:\s*var\(--so-surface-pressed/
    );
    expect(workspaceCss).toMatch(
      /\.viewToggle button\[aria-pressed='true'\]\s*\{[^}]*background:\s*var\(--so-surface[^}]*box-shadow:\s*inset/
    );

    expect(coherenceCss).toContain('Interactive parity for portals and transient command surfaces');
    expect(coherenceCss).toMatch(
      /desktop-manual-application-actions > button[\s\S]*?transition-duration:\s*var\(--motion-hover, 83ms\)/
    );
    expect(coherenceCss).toMatch(
      /desktop-guide-issue-types[\s\S]*?> button:active:not\(\[aria-pressed='true'\]\)[\s\S]*?background:\s*var\(--so-control-bg-pressed\)/
    );
    expect(coherenceCss).toMatch(
      /desktop-guide-copy-template:active\s*\{[^}]*background:\s*var\(--so-brand-pressed\)/
    );
    expect(coherenceCss).toMatch(
      /desktop-reminder-center \[role='tab'\]\[aria-selected='true'\][\s\S]*?background:\s*var\(--so-surface\)[\s\S]*?box-shadow:\s*inset/
    );
    expect(coherenceCss).toMatch(
      /desktop-command-option\[aria-selected='true'\]:active[\s\S]*?background:\s*var\(--so-surface-pressed\)/
    );
    expect(coherenceCss).toContain('--so-opacity-disabled: 0.46');
    expect(coherenceCss).toMatch(
      /#schedule-board button:disabled,[\s\S]*?desktop-manual-application-actions > button:disabled[\s\S]*?opacity:\s*var\(--so-opacity-disabled, 0\.46\)/
    );
    expect(coherenceCss).toMatch(
      /@media \(forced-colors: active\)[\s\S]*?desktop-reminder-center \[role='tab'\]\[aria-selected='true'\][\s\S]*?desktop-command-option\[aria-selected='true'\][\s\S]*?background:\s*Highlight/
    );
  });
});
