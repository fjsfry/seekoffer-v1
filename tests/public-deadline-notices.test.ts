import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const page = readFileSync(resolve(root, 'app/deadlines/page.tsx'), 'utf8');
const repository = readFileSync(
  resolve(root, 'lib/server/public-notice-catalog.ts'),
  'utf8'
);

describe('public deadline notice window', () => {
  it('loads the dedicated same-origin deadline endpoint', () => {
    expect(page).toContain('fetchPublicDeadlineNotices(controller.signal)');
    expect(page).not.toContain('fetchDeadlineNotices');
    expect(page).not.toContain('fetchPublicNotices');
    expect(page).toContain("setLoadError('截止提醒暂时无法更新");
    expect(page).not.toContain('if (active) setProjects([])');
    expect(page).toContain("result.source === 'bundled'");
  });

  it('queries only the eight-day database window with explicit columns', () => {
    expect(repository).toContain(".select(NOTICE_DEADLINE_COLUMNS)");
    expect(repository).toContain(".gte('deadline_date', date)");
    expect(repository).toContain(".lt('deadline_date', addBeijingDays(date, 8))");
    expect(repository).toContain(".order('deadline_date', { ascending: true })");
    expect(repository).toContain('const DEADLINE_PAGE_SIZE = 200');
    expect(repository).toContain('.range(from, from + DEADLINE_PAGE_SIZE - 1)');
    expect(repository).toContain('pageRows.length < DEADLINE_PAGE_SIZE');
    expect(repository).not.toContain('.limit(DEADLINE_RESULT_LIMIT)');
    expect(repository).not.toContain(".select('*')");
  });
});
