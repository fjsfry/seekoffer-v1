import { describe, expect, it, vi } from 'vitest';
import {
  getDesktopCreateIntent,
  getDesktopCreateShortcutLabel,
  getDesktopNavigationSection,
  runDesktopCreateIntent,
  type DesktopCreateIntent
} from '@/lib/desktop-shell-behavior';

describe('desktop shell navigation and create behavior', () => {
  it.each([
    ['/gpa', '', 'resources'],
    ['/knowledge/article', '', 'resources'],
    ['/consulting', '', 'resources'],
    ['/data-quality', '', 'resources'],
    ['/faq', '', 'help'],
    ['/guide/getting-started', '', 'help'],
    ['/community', '', 'help'],
    ['/privacy', '', 'settings'],
    ['/terms', '', 'settings'],
    ['/about', '', 'settings'],
    ['/notices/example', '', 'information'],
    ['/deadlines', '', 'information'],
    ['/me', 'schedule', 'schedule'],
    ['/me', 'contacts', 'contacts']
  ])('maps %s (%s) to its stable parent %s', (pathname, view, expected) => {
    expect(getDesktopNavigationSection(pathname, view)).toBe(expected);
  });

  it.each([
    ['/', '', false, 'application', '添加申请项目'],
    ['/todos', '', false, 'today-item', '新建日程事项'],
    ['/me', 'schedule', false, 'schedule-item', '新建日程事项'],
    ['/me', 'contacts', false, 'mentor-contact', '添加导师联系人'],
    ['/resources', '', false, null, '当前页面无新增操作'],
    ['/', '', true, null, '当前页面无新增操作']
  ])(
    'resolves the current-page Ctrl+N intent for %s (%s)',
    (pathname, view, settingsOpen, expectedIntent, expectedLabel) => {
      const intent = getDesktopCreateIntent(pathname, view, settingsOpen);
      expect(intent).toBe(expectedIntent);
      expect(getDesktopCreateShortcutLabel(intent)).toBe(expectedLabel);
    }
  );

  it('runs only the action for the resolved create intent and reports unsupported pages', () => {
    const actions = {
      application: vi.fn(),
      'today-item': vi.fn(),
      'schedule-item': vi.fn(),
      'mentor-contact': vi.fn()
    } satisfies Record<DesktopCreateIntent, () => void>;

    expect(runDesktopCreateIntent('mentor-contact', actions)).toBe(true);
    expect(actions['mentor-contact']).toHaveBeenCalledOnce();
    expect(actions.application).not.toHaveBeenCalled();
    expect(actions['today-item']).not.toHaveBeenCalled();
    expect(actions['schedule-item']).not.toHaveBeenCalled();
    expect(runDesktopCreateIntent(null, actions)).toBe(false);
  });
});
