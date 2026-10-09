import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DesktopScheduleWorkspace, DesktopScheduleItem } from '../components/desktop-schedule-workspace';
import type { DesktopContactsWorkspace, DesktopMentorContact } from '../components/desktop-contacts-workspace';

type ScheduleProps = Parameters<typeof DesktopScheduleWorkspace>[0];
type ContactsProps = Parameters<typeof DesktopContactsWorkspace>[0];
const noop = () => undefined;
const scheduleProps: ScheduleProps = {
  items: [], allItems: [], totalCount: 0, typeFilter: '全部', doneFilter: '全部', keyword: '',
  onTypeFilterChange: noop, onDoneFilterChange: noop, onKeywordChange: noop,
  calendarMonth: '2026-10', onCalendarMonthChange: noop, onCreateTodo: () => '',
  onUpdateTodo: noop, onDeleteTodo: noop, onDoneChange: noop, onClearCompleted: noop,
  syncStatus: 'syncing', onRetrySync: noop, contextOwner: 'loading-test-owner'
};
const contactsProps: ContactsProps = {
  contacts: [], initialContactId: '', totalCount: 0, summary: { total: 0, delivered: 0, replied: 0, followUp: 0 },
  rangeFilter: '全部', feedbackFilter: '全部', deliveryFilter: '全部', keyword: '', sort: 'updated',
  onRangeFilterChange: noop, onFeedbackFilterChange: noop, onDeliveryFilterChange: noop,
  onKeywordChange: noop, onSortChange: noop, onResetFilters: noop, onAddContact: () => '',
  draftContactId: '', onDiscardContactDraft: noop, onContactChange: noop, onDeleteContact: noop,
  syncStatus: 'syncing', onRetrySync: noop, contextOwner: 'loading-test-owner'
};

let schedule: typeof DesktopScheduleWorkspace;
let contacts: typeof DesktopContactsWorkspace;
let status: typeof import('../components/desktop-workspace-status');

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_SEEKOFFER_SURFACE', 'desktop');
  schedule = (await import('../components/desktop-schedule-workspace')).DesktopScheduleWorkspace;
  contacts = (await import('../components/desktop-contacts-workspace')).DesktopContactsWorkspace;
  status = await import('../components/desktop-workspace-status');
}, 30000); // Cold transforms include the workspace's icon library, not a network wait.
afterAll(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('workbench read readiness is independent of save status', () => {
  const owned = { ownerId: 'b', localOwnerId: 'b', remoteOwnerId: 'b', remoteStatus: 'ready' as const, requiresRemote: true };
  it('does not expose the previous account before local and remote ownership match', () => {
    expect(status.resolveWorkspaceReadStatus({ ...owned, localOwnerId: 'a' })).toBe('loading');
    expect(status.resolveWorkspaceReadStatus({ ...owned, remoteOwnerId: 'a' })).toBe('loading');
    expect(status.resolveWorkspaceReadStatus(owned)).toBe('ready');
  });
  it('terminates failed first reads and supports a fresh retry or offline-only account', () => {
    expect(status.resolveWorkspaceReadStatus({ ...owned, remoteStatus: 'error' })).toBe('error');
    expect(status.resolveWorkspaceReadStatus({ ...owned, remoteStatus: 'loading' })).toBe('loading');
    expect(status.resolveWorkspaceReadStatus({ ...owned, requiresRemote: false, remoteOwnerId: '' })).toBe('ready');
  });
});

describe.each(['schedule', 'contacts'] as const)('%s initial and cached loading states', (kind) => {
  function render(readStatus: 'loading' | 'error' | 'ready', cached = false) {
    if (kind === 'schedule') {
      const item: DesktopScheduleItem = { id: 'cached', title: '本机已有日程', detail: '用户保留的本机内容', date: '', dateLabel: '待安排', type: '其他', category: '申请', priority: '重要不紧急', done: false };
      return renderToStaticMarkup(createElement(schedule, { ...scheduleProps, readStatus, syncStatus: readStatus === 'error' ? 'error' : 'syncing', ...(cached ? { items: [item], allItems: [item], totalCount: 1 } : {}) }));
    }
    const contact: DesktopMentorContact = { id: 'cached', schoolName: '本机大学', departmentName: '', mentorName: '本机已有导师', mentorTitle: '', schoolRange: '普通高校', email: '', researchDirection: '', homepage: '', photoCacheKey: '', photoSourceUrl: '', photoPageUrl: '', photoUpdatedAt: '', deliveryStatus: '未投递', feedbackStatus: '未联系', contactChannel: '', lastContactDate: '', nextFollowUpDate: '', contactNotes: '', notes: '', privacyNotice: '', updatedAt: '2026-10-09T01:00:00Z' };
    return renderToStaticMarkup(createElement(contacts, { ...contactsProps, readStatus, syncStatus: readStatus === 'error' ? 'error' : 'syncing', ...(cached ? { contacts: [contact], totalCount: 1, summary: { total: 1, delivered: 0, replied: 0, followUp: 0 } } : {}) }));
  }

  it('renders one accessible loading region instead of an empty state or false zero count', () => {
    const html = render('loading');
    expect(html).toContain(`data-desktop-loading="${kind}"`);
    expect(html).toContain('data-loading-indicator="ring"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain(kind === 'schedule' ? '还没有日程' : '还没有导师联系人');
    expect(html).not.toContain('本机已保存');
    expect(html).not.toContain(kind === 'schedule' ? '未完成 0 项' : '共 0 位');
  });
  it('replaces a failed first read with a retry action, not an infinite skeleton', () => {
    const html = render('error');
    expect(html).toContain('重新加载');
    expect(html).toContain('这不代表没有记录');
    expect(html).not.toContain('data-desktop-loading');
    expect(html).not.toContain('data-loading-indicator');
  });
  it('shows a genuine empty state only after the read completes', () => {
    expect(render('ready')).toContain(kind === 'schedule' ? '还没有日程' : '还没有导师联系人');
  });
  it.each(['loading', 'error'] as const)('preserves cached content and actions during background %s', (readStatus) => {
    const html = render(readStatus, true);
    expect(html).toContain(kind === 'schedule' ? '本机已有日程' : '本机已有导师');
    expect(html).not.toContain('data-desktop-loading');
    expect(html).not.toContain('这不代表没有记录');
    expect(html).toContain(readStatus === 'error' ? '重新同步' : '正在同步');
  });
});

it('keeps local edits and save acknowledgements separate from loading readiness', () => {
  const page = readFileSync(resolve(import.meta.dirname, '../app/me/page.tsx'), 'utf8');
  expect(page).toContain('const reconciled=reconcileWorkbench(before,current,mergedState)');
  expect(page).toContain("setWorkbenchRead({ ownerId: syncableUserId, status: 'ready' })");
  expect(page).toContain("// Reading the remote baseline does not acknowledge local edits yet.");
  expect(page).toContain("if (change.userId !== profileOwnerId) return");
  expect(page).toContain('localWorkbenchOwnerId !== profileOwnerId');
  const scheduleSource = readFileSync(resolve(import.meta.dirname, '../components/desktop-schedule-workspace.tsx'), 'utf8');
  expect(scheduleSource.match(/if \(submittingRef.current\) return/g)).toHaveLength(2);
  expect(scheduleSource.match(/aria-busy=\{submitState === 'saving'\}/g)).toHaveLength(2);
  const manual = readFileSync(resolve(import.meta.dirname, '../components/desktop-manual-application-dialog.tsx'), 'utf8');
  expect(manual).toContain('if (submittingRef.current) return');
  expect(manual).toContain('aria-busy={submitting}');
});
