export type DesktopNavigationSection =
  | 'workbench'
  | 'today'
  | 'information'
  | 'colleges'
  | 'resources'
  | 'schedule'
  | 'contacts'
  | 'help'
  | 'settings'
  | 'other';

export type DesktopCreateIntent = 'application' | 'today-item' | 'schedule-item' | 'mentor-contact';

function matchesRoute(pathname: string, routes: string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function getDesktopNavigationSection(
  pathname: string,
  activeView = ''
): DesktopNavigationSection {
  if (pathname === '/' || matchesRoute(pathname, ['/applications'])) return 'workbench';
  if (pathname === '/todos') return 'today';
  if (pathname === '/calendar') return 'schedule';
  if (pathname === '/me' || pathname.startsWith('/me/')) {
    if (activeView === 'schedule') return 'schedule';
    if (activeView === 'contacts') return 'contacts';
    return 'other';
  }
  if (matchesRoute(pathname, ['/notices', '/deadlines', '/competitions'])) {
    return 'information';
  }
  if (matchesRoute(pathname, ['/colleges'])) return 'colleges';
  if (matchesRoute(pathname, ['/resources', '/gpa', '/knowledge', '/consulting', '/data-quality'])) {
    return 'resources';
  }
  if (matchesRoute(pathname, ['/guide', '/faq', '/community'])) return 'help';
  if (matchesRoute(pathname, ['/about', '/privacy', '/terms', '/disclaimer', '/pro'])) {
    return 'settings';
  }
  return 'other';
}

export function getDesktopCreateIntent(
  pathname: string,
  activeView = '',
  settingsOpen = false
): DesktopCreateIntent | null {
  if (settingsOpen) return null;
  if (pathname === '/' || matchesRoute(pathname, ['/applications'])) return 'application';
  if (pathname === '/todos') return 'today-item';
  if (pathname === '/calendar' || (pathname === '/me' && activeView === 'schedule')) {
    return 'schedule-item';
  }
  if (pathname === '/me' && activeView === 'contacts') return 'mentor-contact';
  return null;
}

export function getDesktopCreateShortcutLabel(intent: DesktopCreateIntent | null) {
  if (intent === 'application') return '添加申请项目';
  if (intent === 'today-item' || intent === 'schedule-item') return '新建日程事项';
  if (intent === 'mentor-contact') return '添加导师联系人';
  return '当前页面无新增操作';
}

export function runDesktopCreateIntent(
  intent: DesktopCreateIntent | null,
  actions: Record<DesktopCreateIntent, () => void>
) {
  if (!intent) return false;
  actions[intent]();
  return true;
}
