import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  filterDesktopExpiredApplications,
  getDesktopExpiredApplicationCount,
  getNextVisibleDesktopApplicationId,
  isDesktopApplicationExpired,
  isStrictDesktopApplicationDeadline
} from '../lib/desktop-application-visibility';

const projectRoot = process.cwd();
const now = Date.parse('2026-08-16T12:00:00+08:00');

type Row = {
  id: string;
  deadlineDate?: string | null;
};

const rows: Row[] = [
  { id: 'expired', deadlineDate: '2026-08-15 18:00' },
  { id: 'today', deadlineDate: '2026-08-16' },
  { id: 'future', deadlineDate: '2026-08-20 18:00' },
  { id: 'missing', deadlineDate: '' },
  { id: 'invalid', deadlineDate: '待通知' }
];

describe('desktop expired application visibility', () => {
  it('uses the actual deadline timestamp and never hides missing or invalid dates', () => {
    expect(isDesktopApplicationExpired('2026-08-15 18:00', now)).toBe(true);
    expect(isDesktopApplicationExpired('2026-08-16', now)).toBe(false);
    expect(isDesktopApplicationExpired('2026-08-16 11:59', now)).toBe(true);
    expect(isDesktopApplicationExpired('2026-08-16T12:00:00+08:00', now)).toBe(true);
    expect(isDesktopApplicationExpired('2026-08-16T04:00:00Z', now)).toBe(true);
    expect(isDesktopApplicationExpired('2026-08-16T13:01:00+09:00', now)).toBe(false);
    expect(isDesktopApplicationExpired('', now)).toBe(false);
    expect(isDesktopApplicationExpired(null, now)).toBe(false);
    expect(isDesktopApplicationExpired('待通知', now)).toBe(false);
  });

  it('rejects impossible calendar dates instead of letting JavaScript roll them forward', () => {
    expect(isStrictDesktopApplicationDeadline('2026-02-30')).toBe(false);
    expect(isStrictDesktopApplicationDeadline('2025-02-29 18:00')).toBe(false);
    expect(isStrictDesktopApplicationDeadline('2024-02-29 18:00')).toBe(true);
    expect(isStrictDesktopApplicationDeadline('2026-04-31T12:00:00+08:00')).toBe(false);
    expect(isDesktopApplicationExpired('2026-02-30', now)).toBe(false);
    expect(isDesktopApplicationExpired('2025-02-29 18:00', now)).toBe(false);
    expect(isDesktopApplicationExpired('2024-02-29 18:00', now)).toBe(true);
  });

  it('combines with an already-filtered result without mutating application records', () => {
    const sourceSnapshot = structuredClone(rows);
    const matchingRows = rows.filter((row) => row.id !== 'future');

    expect(getDesktopExpiredApplicationCount(matchingRows, (row) => row.deadlineDate, now)).toBe(1);
    expect(
      filterDesktopExpiredApplications(matchingRows, true, (row) => row.deadlineDate, now)
        .map((row) => row.id)
    ).toEqual(['today', 'missing', 'invalid']);
    expect(
      filterDesktopExpiredApplications(matchingRows, false, (row) => row.deadlineDate, now)
        .map((row) => row.id)
    ).toEqual(['expired', 'today', 'missing', 'invalid']);
    expect(rows).toEqual(sourceSnapshot);
  });

  it('keeps the current selection when visible and safely selects the first remaining row', () => {
    const visibleRows = filterDesktopExpiredApplications(rows, true, (row) => row.deadlineDate, now);

    expect(getNextVisibleDesktopApplicationId(visibleRows, 'future', (row) => row.id)).toBe('future');
    expect(getNextVisibleDesktopApplicationId(visibleRows, 'expired', (row) => row.id)).toBe('today');
    expect(getNextVisibleDesktopApplicationId([], 'expired', (row: Row) => row.id)).toBe('');
  });

  it('keeps the preference account-scoped and exposes a reversible accessible desktop control', () => {
    const source = readFileSync(resolve(projectRoot, 'components/desktop-home.tsx'), 'utf8');
    const css = readFileSync(resolve(projectRoot, 'app/desktop-flagship.css'), 'utf8');

    expect(source).toContain("const applicationContextStoragePrefix = 'seekoffer-desktop-application-context-v1:'");
    expect(source).toContain('hideExpired: boolean;');
    expect(source).toContain('hideExpired: parsed.hideExpired === true');
    expect(source).toContain('aria-pressed={hideExpired}');
    expect(source).toContain('<span>隐藏截止项目</span>');
    expect(source).toContain('显示 {expiredMatchingCount} 个已截止项目');
    expect(source).toContain('申请记录和材料不会被删除');
    expect(source).toContain('hideExpired && isDesktopApplicationExpired(result.project.deadlineDate, creationNow)');
    expect(source).toContain('if (revealExpiredCreatedProject) setHideExpired(false)');
    expect(source).toContain("message: revealExpiredCreatedProject ? '申请已添加并显示' : '申请已添加'");
    expect(source).toContain('已暂时关闭“隐藏截止项目”并选中');
    expect(source).toContain("window.addEventListener('focus', refreshDeadlineClock)");
    expect(source).toContain("document.removeEventListener('visibilitychange', handleVisibilityChange)");
    expect(source).toContain('const flushApplicationContext = useCallback(() =>');
    expect(source).toContain('flushApplicationContext();');
    expect(css).toContain('.desktop-app-shell:is(.desktop-app-shell) .desktop-expired-project-toggle');
    expect(css).toContain(".desktop-expired-project-toggle[aria-pressed='true']");
  });
});
