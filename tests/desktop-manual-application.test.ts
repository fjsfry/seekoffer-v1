import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateManualApplicationInput } from '@/lib/desktop-manual-application';
import {
  consumeDesktopApplicationSyncRequest,
  consumeDesktopNewApplicationRequest,
  DESKTOP_APPLICATION_SYNC_EVENT,
  DESKTOP_NEW_APPLICATION_EVENT,
  requestDesktopApplicationSync,
  requestDesktopNewApplication
} from '@/lib/desktop-route-events';

const root = process.cwd();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('manual application validation', () => {
  it('normalizes a complete project before it reaches storage', () => {
    const result = validateManualApplicationInput({
      schoolName: '  清华大学  ',
      departmentName: '  计算机系 ',
      projectName: '  2027 年预推免  ',
      projectType: '预推免',
      discipline: ' 人工智能 ',
      deadlineDate: '2026-09-01T18:00',
      eventStartDate: '2026-09-10T08:30',
      eventEndDate: '2026-09-12T17:00',
      applyLink: 'https://example.edu/apply'
    });

    expect(result).toEqual({
      ok: true,
      value: {
        schoolName: '清华大学',
        departmentName: '计算机系',
        projectName: '2027 年预推免',
        projectType: '预推免',
        discipline: '人工智能',
        deadlineDate: '2026-09-01 18:00',
        eventStartDate: '2026-09-10 08:30',
        eventEndDate: '2026-09-12 17:00',
        applyLink: 'https://example.edu/apply'
      }
    });
  });

  it('rejects incomplete, unsafe or contradictory input with a field target', () => {
    const base = {
      schoolName: '北京大学',
      departmentName: '',
      projectName: '预推免',
      projectType: '预推免' as const,
      discipline: '',
      deadlineDate: '2026-09-01T18:00'
    };

    expect(validateManualApplicationInput({ ...base, schoolName: ' ' })).toMatchObject({
      ok: false,
      field: 'schoolName'
    });
    expect(validateManualApplicationInput({ ...base, applyLink: 'javascript:alert(1)' })).toMatchObject({
      ok: false,
      field: 'applyLink'
    });
    expect(
      validateManualApplicationInput({
        ...base,
        eventStartDate: '2026-09-12T17:00',
        eventEndDate: '2026-09-10T08:30'
      })
    ).toMatchObject({ ok: false, field: 'eventEndDate' });
  });
});

describe('desktop manual application workflow', () => {
  it('bridges a forced application sync across Settings closing and consumes it once', () => {
    const values = new Map<string, string>();
    const dispatched: string[] = [];
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key)
      },
      dispatchEvent: (event: Event) => {
        dispatched.push(event.type);
        return true;
      }
    });

    requestDesktopApplicationSync();

    expect(dispatched).toEqual([DESKTOP_APPLICATION_SYNC_EVENT]);
    expect(consumeDesktopApplicationSyncRequest()).toBe(true);
    expect(consumeDesktopApplicationSyncRequest()).toBe(false);
  });

  it('bridges Ctrl+N across a route change without leaving a stale request', () => {
    const values = new Map<string, string>();
    const dispatched: string[] = [];
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key)
      },
      dispatchEvent: (event: Event) => {
        dispatched.push(event.type);
        return true;
      }
    });

    requestDesktopNewApplication();

    expect(dispatched).toEqual([DESKTOP_NEW_APPLICATION_EVENT]);
    expect(consumeDesktopNewApplicationRequest()).toBe(true);
    expect(consumeDesktopNewApplicationRequest()).toBe(false);
  });

  it('opens a real accessible modal from both add entry points', () => {
    const home = fs.readFileSync(path.join(root, 'components/desktop-home.tsx'), 'utf8');
    const dialog = fs.readFileSync(
      path.join(root, 'components/desktop-manual-application-dialog.tsx'),
      'utf8'
    );
    const shell = fs.readFileSync(path.join(root, 'components/desktop-app-shell.tsx'), 'utf8');
    const routeEvents = fs.readFileSync(path.join(root, 'lib/desktop-route-events.ts'), 'utf8');

    expect(home).toContain('aria-label="手动添加申请项目"');
    expect(home).toContain('aria-haspopup="dialog"');
    expect(home).toContain('手动添加申请');
    expect(home).toContain('<DesktopManualApplicationDialog');
    expect(home).toContain('setSelectedId(result.item.userProjectId)');
    expect(home).toContain('result.ownerUserId !== userId');
    expect(home).toContain('readLocalApplicationRows(result.ownerUserId)');
    expect(home).toContain('userId={userId}');
    expect(dialog).toContain('createPortal(');
    expect(dialog).toContain('useAccessibleModal(requestClose)');
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog).toContain("trackDesktopPendingWrite('manual-application-create'");
    expect(dialog).toContain('createManualApplicationEntry(validation.value, userId)');
    expect(shell).toContain('requestDesktopNewApplication();');
    expect(shell).toContain("if (!isCurrentDesktopHref('/'))");
    expect(shell).toContain('runDesktopCreateIntent(createIntent');
    expect(shell).not.toContain("message: '从通知库添加申请项目'");
    expect(home).toContain('DESKTOP_NEW_APPLICATION_EVENT');
    expect(home).toContain('consumeDesktopNewApplicationRequest()');
    expect(routeEvents).toContain("'seekoffer:desktop-new-application'");
    expect(routeEvents).toContain('window.sessionStorage.setItem');
  });

  it('persists first, isolates the account and retries remote synchronization in the background', () => {
    const cloudbase = fs.readFileSync(path.join(root, 'lib/cloudbase-data.ts'), 'utf8');

    expect(cloudbase).toContain("logWorkspaceSyncWarning('manual-application-add-sync', error)");
    expect(cloudbase).toContain('persistManualApplicationWorkspaceAtomically(');
    expect(cloudbase).toContain('scheduleManualApplicationWorkspaceSync(storageOwner);');
    expect(cloudbase).toContain('ownerUserId: storageOwner.userId');
    expect(cloudbase).toContain('syncPending: true');
    expect(cloudbase).toContain("window.addEventListener('online'");
    expect(cloudbase.indexOf('persistManualApplicationWorkspaceAtomically(')).toBeLessThan(
      cloudbase.indexOf('scheduleManualApplicationWorkspaceSync(storageOwner);')
    );
  });

  it('uses the zoom-corrected desktop viewport and collapses its form at high zoom', () => {
    const css = fs.readFileSync(path.join(root, 'app/desktop-flagship.css'), 'utf8');

    expect(css).toContain('.seekoffer-desktop-surface .desktop-manual-application-backdrop');
    expect(css).toContain('width: var(--desktop-zoomed-viewport-width, 100%);');
    expect(css).toContain('height: var(--desktop-zoomed-viewport-height, 100%);');
    expect(css).toMatch(
      /html\[data-desktop-zoom-level='200'\] \.desktop-manual-application-grid[\s\S]*grid-template-columns: minmax\(0, 1fr\)/
    );
  });
});
