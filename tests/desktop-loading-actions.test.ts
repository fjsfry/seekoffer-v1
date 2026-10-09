import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ states: [] as unknown[] }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: (initial: unknown) => [fixture.states.length ? fixture.states.shift() : (typeof initial === 'function' ? initial() : initial), vi.fn()]
  };
});
vi.mock('next/navigation', () => ({ usePathname: () => '/notices', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/hooks/use-user-session', () => ({ useUserSessionState: () => ({ loggedIn: true, ready: true }) }));
vi.mock('@/lib/cloudbase-data', () => ({
  addProjectToApplicationTable: vi.fn(), fetchUserProjects: vi.fn(), watchApplicationTable: vi.fn(),
  fetchApplicationRows: vi.fn(), updateUserProject: vi.fn()
}));
vi.mock('@/lib/auth-intent', () => ({ openAuthModal: vi.fn(), writeAuthIntent: vi.fn() }));
vi.mock('@/lib/desktop-pending-writes', () => ({ trackDesktopPendingWrite: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_SEEKOFFER_SURFACE', 'desktop');
  vi.stubGlobal('React', React);
  fixture.states = [];
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('rendered desktop loading actions', () => {
  it('renders a disabled busy add button with one decorative shared ring', async () => {
    fixture.states = [false, true, ''];
    const { ApplicationActionButton } = await import('@/components/application-action-button');
    const html = renderToStaticMarkup(React.createElement(ApplicationActionButton, { projectId: 'fixture' }));
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html.match(/data-loading-indicator="ring"/g)).toHaveLength(1);
    expect(html).toContain('加入中...');
    expect(html).not.toContain('animate-spin');
  });

  it('keeps the existing web button presentation', async () => {
    vi.stubEnv('NEXT_PUBLIC_SEEKOFFER_SURFACE', 'web');
    fixture.states = [false, true, ''];
    const { ApplicationActionButton } = await import('@/components/application-action-button');
    const html = renderToStaticMarkup(React.createElement(ApplicationActionButton, { projectId: 'fixture' }));
    expect(html).toContain('animate-spin');
    expect(html).not.toContain('data-loading-indicator');
  });

  it('renders initial detail loading separately from a true empty application', async () => {
    fixture.states = [null, false, false, '', '', '', 0];
    const { NoticeWorkbenchPanel } = await import('@/components/notice-workbench-panel');
    const html = renderToStaticMarkup(React.createElement(NoticeWorkbenchPanel, { projectId: 'fixture' }));
    expect(html).toContain('data-desktop-loading="detail"');
    expect(html).toContain('正在读取申请状态');
    expect(html).not.toContain('默认状态：已收藏');
  });

  it('stops the spinner and offers retry after a failed read', async () => {
    fixture.states = [null, true, false, '', '暂时无法读取申请状态，请检查网络后重试。', '', 0];
    const { NoticeWorkbenchPanel } = await import('@/components/notice-workbench-panel');
    const html = renderToStaticMarkup(React.createElement(NoticeWorkbenchPanel, { projectId: 'fixture' }));
    expect(html).toContain('role="alert"');
    expect(html).toContain('重新加载');
    expect(html).not.toContain('data-loading-indicator');
    expect(html).not.toContain('默认状态：已收藏');
  });
});
