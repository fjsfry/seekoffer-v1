import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DESKTOP_NEW_CONTACT_EVENT,
  DESKTOP_NEW_SCHEDULE_EVENT,
  requestDesktopNewContact,
  requestDesktopNewSchedule
} from '@/lib/desktop-route-events';

const projectRoot = resolve(import.meta.dirname, '..');
const shellSource = readFileSync(resolve(projectRoot, 'components/desktop-app-shell.tsx'), 'utf8').replace(/\r\n/g, '\n');
const scheduleSource = readFileSync(
  resolve(projectRoot, 'components/desktop-schedule-workspace.tsx'),
  'utf8'
).replace(/\r\n/g, '\n');
const contactsSource = readFileSync(
  resolve(projectRoot, 'components/desktop-contacts-workspace.tsx'),
  'utf8'
).replace(/\r\n/g, '\n');
const noticesSource = readFileSync(resolve(projectRoot, 'app/notices/page.tsx'), 'utf8').replace(/\r\n/g, '\n');
const homeSource = readFileSync(resolve(projectRoot, 'components/desktop-home.tsx'), 'utf8').replace(/\r\n/g, '\n');
const routeEventsSource = readFileSync(resolve(projectRoot, 'lib/desktop-route-events.ts'), 'utf8').replace(/\r\n/g, '\n');
const originalWindow = globalThis.window;

function sourceBetween(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);

  expect(start, `missing start marker: ${startMarker}`).toBeGreaterThanOrEqual(0);
  expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow
  });
});

describe('desktop cross-page interaction regressions', () => {
  it('lets an already-handled Ctrl+N stop before the shell dispatches a second create action', () => {
    const keyHandler = sourceBetween(
      shellSource,
      'const handleKeyDown = (event: KeyboardEvent) => {',
      "window.addEventListener('keydown', handleKeyDown)"
    );
    const defaultPreventedGuard = keyHandler.indexOf('if (event.defaultPrevented) return;');
    const createShortcut = keyHandler.indexOf("event.key.toLowerCase() === 'n'");
    const contextualCreate = keyHandler.indexOf('handleContextualCreate();');

    expect(defaultPreventedGuard).toBeGreaterThanOrEqual(0);
    expect(createShortcut).toBeGreaterThan(defaultPreventedGuard);
    expect(contextualCreate).toBeGreaterThan(createShortcut);

    const contextualCreateHandler = sourceBetween(
      shellSource,
      'const handleContextualCreate = useCallback(() => {',
      '\n  useEffect(() => {'
    );
    expect(contextualCreateHandler).toContain("'schedule-item': () => {");
    expect(contextualCreateHandler).toContain('requestDesktopNewSchedule();');
    expect(contextualCreateHandler).toContain("'mentor-contact': () => {");
    expect(contextualCreateHandler).toContain('requestDesktopNewContact();');
    expect(contextualCreateHandler).not.toContain("querySelector<HTMLButtonElement>('[data-schedule");
    expect(contextualCreateHandler).not.toContain("querySelector<HTMLButtonElement>('[data-contact");
  });

  it('dispatches stable route events for schedule and contact creation', () => {
    const dispatched: string[] = [];
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        dispatchEvent(event: Event) {
          dispatched.push(event.type);
          return true;
        }
      }
    });

    requestDesktopNewSchedule();
    requestDesktopNewContact();

    expect(dispatched).toEqual([DESKTOP_NEW_SCHEDULE_EVENT, DESKTOP_NEW_CONTACT_EVENT]);
    expect(routeEventsSource).toContain(
      'window.dispatchEvent(new Event(DESKTOP_NEW_SCHEDULE_EVENT));'
    );
    expect(routeEventsSource).toContain(
      'window.dispatchEvent(new Event(DESKTOP_NEW_CONTACT_EVENT));'
    );
  });

  it.each([
    ['schedule', scheduleSource, 'startCreate();'],
    ['contacts', contactsSource, 'addContact();']
  ])('does not turn Ctrl+N inside a %s editor into a new record', (_name, source, createCall) => {
    const editableTargetGuard = sourceBetween(
      source,
      'function isWorkspaceEditableTarget(target: EventTarget | null) {',
      '\n}\n'
    );
    const workspaceKeyHandler = sourceBetween(
      source,
      'function handleWorkspaceKeyDown(event: ReactKeyboardEvent<HTMLElement>) {',
      '\n  }\n\n'
    );

    expect(editableTargetGuard).toContain(
      "target.closest('input, textarea, select, [contenteditable=\"true\"]')"
    );
    expect(workspaceKeyHandler).toContain("event.key.toLowerCase() === 'n'");
    expect(workspaceKeyHandler).toContain('!isWorkspaceEditableTarget(event.target)');
    expect(workspaceKeyHandler.indexOf('!isWorkspaceEditableTarget(event.target)')).toBeLessThan(
      workspaceKeyHandler.indexOf('event.preventDefault();')
    );
    expect(workspaceKeyHandler.indexOf('event.preventDefault();')).toBeLessThan(
      workspaceKeyHandler.indexOf(createCall)
    );
    expect(source).toContain('onKeyDown={handleWorkspaceKeyDown}');
  });

  it('keeps notice history metadata and scrolls the desktop route owner instead of window', () => {
    const historyHelper = sourceBetween(
      noticesSource,
      'function replaceNoticeHistory(href: string) {',
      '\n}\n'
    );
    const scrollOwnerHelper = sourceBetween(
      noticesSource,
      'function getNoticeScrollOwner() {',
      '\n}\n'
    );

    expect(historyHelper).toContain(
      "window.history.replaceState(window.history.state, '', href);"
    );
    expect(scrollOwnerHelper).toContain(
      "document.querySelector<HTMLElement>('.desktop-route-content')"
    );
    expect(scrollOwnerHelper).toContain('document.scrollingElement as HTMLElement | null');
    expect(noticesSource).toContain('getNoticeScrollOwner()?.scrollTop || 0');
    expect(noticesSource).toContain('getNoticeScrollOwner()?.scrollTo({');
    expect(noticesSource).not.toMatch(/replaceState\(\s*null\s*,/);
    expect(noticesSource).not.toContain('window.scrollY');
    expect(noticesSource).not.toContain('window.scrollTo');
  });

  it('cancels stale notice restore frames before they can scroll or rewrite history', () => {
    const restoreEffect = sourceBetween(
      noticesSource,
      'const snapshot = readNoticeListPosition();',
      '\n  }, [isNoticeLoading, currentPage, filterKey, pagedProjects.length, filterValues, advancedOpen]);'
    );
    const firstFrameIndex = restoreEffect.indexOf(
      'firstRestoreFrame = window.requestAnimationFrame(() => {'
    );
    const currentGuardIndex = restoreEffect.indexOf(
      'if (!isCurrentNoticeRestore()) return;',
      firstFrameIndex
    );
    const scrollIndex = restoreEffect.indexOf('scrollIntoView({', firstFrameIndex);
    const secondFrameIndex = restoreEffect.indexOf(
      'secondRestoreFrame = window.requestAnimationFrame(() => {'
    );
    const secondGuardIndex = restoreEffect.indexOf(
      'if (!isCurrentNoticeRestore()) return;',
      secondFrameIndex
    );
    const historyIndex = restoreEffect.indexOf('replaceNoticeHistory(restoreHref);');

    expect(restoreEffect).toContain('const expectedLocationHref =');
    expect(restoreEffect).toContain('let cancelled = false;');
    expect(restoreEffect).toContain('window.cancelAnimationFrame(firstRestoreFrame);');
    expect(restoreEffect).toContain('window.cancelAnimationFrame(secondRestoreFrame);');
    expect(restoreEffect).toContain('return cancelNoticeRestore;');
    expect(firstFrameIndex).toBeGreaterThan(-1);
    expect(currentGuardIndex).toBeGreaterThan(firstFrameIndex);
    expect(scrollIndex).toBeGreaterThan(currentGuardIndex);
    expect(secondFrameIndex).toBeGreaterThan(scrollIndex);
    expect(secondGuardIndex).toBeGreaterThan(secondFrameIndex);
    expect(historyIndex).toBeGreaterThan(secondGuardIndex);
  });

  it('gives notice pagination a navigation name and exposes the current page', () => {
    expect(noticesSource).toContain('aria-label="通知分页"');
    expect(noticesSource).toContain('aria-label="上一页"');
    expect(noticesSource).toContain('aria-label={`第 ${pageNumber} 页`}');
    expect(noticesSource).toContain(
      "aria-current={currentPage === pageNumber ? 'page' : undefined}"
    );
    expect(noticesSource).toContain('aria-label="下一页"');
  });

  it('shows the primary next action before the project summary strip', () => {
    const overviewSource = sourceBetween(
      homeSource,
      "activeWorkspaceTab === 'overview'",
      "activeWorkspaceTab === 'materials'"
    );
    const nextActionIndex = overviewSource.indexOf('desktop-project-next-step-surface');
    const summaryIndex = overviewSource.indexOf('desktop-project-overview-strip');

    expect(nextActionIndex).toBeGreaterThan(0);
    expect(summaryIndex).toBeGreaterThan(nextActionIndex);
    expect(overviewSource.match(/desktop-project-workspace-primary-action/g)).toHaveLength(1);
  });

  it('distinguishes command application loading failures and lets the user retry', () => {
    expect(shellSource).toContain("setCommandApplicationsError('申请项目暂时加载失败')");
    expect(shellSource).toContain('role="alert"');
    expect(shellSource).toContain('commandApplicationsAttemptedRef.current = false;');
    expect(shellSource).toContain("setCommandApplicationsError('');");
    expect(shellSource).toContain('commandApplicationsError,');
    expect(shellSource).toContain('重新加载');
  });
});
