import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');

describe('desktop shell contract', () => {
  it('keeps the native window frameless, resizable, draggable, and hidden behind a branded splash', async () => {
    const [tauriConfigRaw, capabilityRaw, rustSource, splashSource, cargoSource] = await Promise.all([
      readFile(resolve(projectRoot, 'src-tauri/tauri.conf.json'), 'utf8'),
      readFile(resolve(projectRoot, 'src-tauri/capabilities/default.json'), 'utf8'),
      readFile(resolve(projectRoot, 'src-tauri/src/lib.rs'), 'utf8'),
      readFile(resolve(projectRoot, 'public/desktop-splash.html'), 'utf8'),
      readFile(resolve(projectRoot, 'src-tauri/Cargo.toml'), 'utf8')
    ]);
    const tauriConfig = JSON.parse(tauriConfigRaw);
    const capability = JSON.parse(capabilityRaw);
    const mainWindow = tauriConfig.app.windows.find((window: { label: string }) => window.label === 'main');
    const splashWindow = tauriConfig.app.windows.find(
      (window: { label: string }) => window.label === 'splashscreen'
    );

    expect(mainWindow).toMatchObject({
      decorations: false,
      resizable: true,
      width: 1440,
      height: 900,
      minWidth: 960,
      minHeight: 640,
      visible: false,
      focus: false,
      backgroundColor: '#e6e7ed'
    });
    expect(splashWindow).toMatchObject({
      url: 'desktop-splash.html',
      width: 520,
      height: 320,
      visible: true,
      decorations: false,
      resizable: false,
      skipTaskbar: true,
      backgroundColor: '#e6e7ed'
    });
    expect(capability.windows).toContain('main');
    expect(capability.windows).not.toContain('splashscreen');
    expect(capability.permissions).toEqual(
      expect.arrayContaining([
        'core:window:allow-start-dragging',
        'core:window:allow-minimize',
        'core:window:allow-toggle-maximize',
        'core:window:allow-close',
        'core:webview:allow-set-webview-zoom'
      ])
    );
    expect(rustSource).toContain('.with_denylist(&["splashscreen"])');
    expect(rustSource).not.toContain('PageLoadEvent::Finished');
    expect(rustSource).toContain('fn reveal_main');
    expect(rustSource).toContain('fn show_main');
    expect(rustSource).toContain('run_on_main_thread');
    expect(cargoSource).toContain('features = ["tray-icon"]');
    expect(cargoSource).toContain('tauri-plugin-single-instance = "2"');
    expect(rustSource.indexOf('tauri_plugin_single_instance::init')).toBeLessThan(
      rustSource.indexOf('tauri_plugin_window_state::Builder::new()')
    );
    expect(rustSource).toContain('show_main(app);');
    expect(rustSource).toContain('TrayIconBuilder::new()');
    expect(rustSource).toContain('struct TrayCommandPayload');
    expect(rustSource).toContain('id: u64');
    expect(rustSource).toContain('command: String');
    expect(rustSource).toContain('fn queue_tray_command');
    expect(rustSource).toContain('fn take_pending_tray_command');
    expect(rustSource).toContain('fn acknowledge_tray_command');
    expect(rustSource).toContain('fn desktop_frontend_ready');
    expect(rustSource).toContain('tauri::generate_handler![');
    expect(rustSource).toContain('main.emit("seekoffer-tray-command", payload)');
    expect(rustSource).toContain('WindowEvent::CloseRequested');
    expect(rustSource).toContain('api.prevent_close()');
    expect(rustSource).toContain('let _ = window.hide()');
    expect(rustSource).toContain('"show-main" => show_main(app)');
    expect(rustSource).toContain('"quit-app" => app.exit(0)');
    expect(splashSource).toContain('./desktop/seekoffer-mark.png');
    expect(splashSource).toContain('正在启动寻鹿');
    expect(splashSource).toContain('animation: spin 900ms linear infinite');
    expect(splashSource).toContain('transform: rotate(360deg)');
    expect(splashSource).not.toContain('translateX(');
    expect(splashSource).not.toContain('_next');
    expect(splashSource).not.toMatch(/https?:\/\//);
  });

  it('requires a hydrated formal account before mounting the desktop application', async () => {
    const [layoutSource, authGateSource, loginScreenSource, loginPanelSource, userSessionSource] = await Promise.all([
      readFile(resolve(projectRoot, 'app/build-surface.desktop.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-auth-gate.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-login-screen.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/login-method-panel.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'lib/user-session.ts'), 'utf8')
    ]);

    expect(layoutSource).toContain('<DesktopAuthGate>');
    expect(layoutSource).toContain('<DesktopAppShell>{children}</DesktopAppShell>');
    expect(layoutSource.indexOf('<DesktopAuthGate>')).toBeLessThan(
      layoutSource.indexOf('<DesktopAppShell>{children}</DesktopAppShell>')
    );
    expect(authGateSource).toContain('const { ready, isMember, refresh } = useUserSessionState()');
    expect(authGateSource).toContain('if (!ready)');
    expect(authGateSource).toContain('phase="restore-session"');
    expect(authGateSource).toContain('if (finishingLogin)');
    expect(authGateSource).toContain('phase="enter-workbench"');
    expect(authGateSource).toContain('if (!isMember)');
    expect(authGateSource).toContain('isMemberSession(session)');
    expect(authGateSource).toContain("router.replace('/')");
    expect(authGateSource).toContain('const effectiveZoomLevel = preferences.zoomLevel');
    expect(authGateSource).not.toContain('ready && isMember ? preferences.zoomLevel : 100');
    expect(authGateSource).not.toContain('NODE_ENV');
    expect(authGateSource).not.toContain('DESKTOP_QA_PREVIEW');
    expect(layoutSource).toContain(
      'var allowedZoomLevels = [80, 90, 100, 110, 125, 150, 175, 200]'
    );
    expect(layoutSource).toContain(
      'document.documentElement.dataset.desktopZoomLevel = String(zoomLevel)'
    );
    expect(layoutSource).toContain(
      'document.documentElement.style.zoom = String(zoomLevel / 100)'
    );
    expect(loginScreenSource).toContain('<LoginMethodPanel mode="desktop" allowGuest={false}');
    expect(loginScreenSource).toContain('/desktop/seekoffer-login-background-v2.webp');
    expect(loginScreenSource).not.toContain('desktop-auth-watermark');
    expect(loginScreenSource).not.toContain('desktop-auth-trust');
    expect(loginScreenSource).not.toContain('正式账号安全登录');
    expect(loginScreenSource).not.toContain('申请进度多端同步');
    expect(loginScreenSource).not.toContain('onClose=');
    expect(loginPanelSource).toContain('allowGuest?: boolean');
    expect(loginPanelSource).toContain('{allowGuest ? (');
    const desktopLoginSource = loginPanelSource.slice(
      loginPanelSource.indexOf("if (mode === 'desktop')"),
      loginPanelSource.indexOf('\n  return (', loginPanelSource.indexOf("if (mode === 'desktop')"))
    );
    expect(desktopLoginSource).toContain('密码登录');
    expect(desktopLoginSource).toContain('验证码登录');
    expect(desktopLoginSource).toContain('立即注册');
    expect(desktopLoginSource).toContain('忘记密码？');
    expect(desktopLoginSource).toContain('desktop-login-security-note');
    expect(desktopLoginSource).toContain('安全登录');
    expect(desktopLoginSource).toContain('账号信息仅用于身份验证与申请数据同步');
    expect(desktopLoginSource).not.toContain('微信登录');
    expect(desktopLoginSource).not.toContain('手机登录');
    expect(desktopLoginSource).not.toContain('记住我');
    expect(userSessionSource).toContain(
      "if (provider === 'password' || provider === 'otp' || provider === 'anonymous')"
    );
    expect(userSessionSource).toContain('if (!authProvider)');
    expect(userSessionSource).toContain("if (current?.authProvider === 'anonymous')");
    expect(userSessionSource).toContain('writeUserSession(null)');
    expect(userSessionSource).toContain(
      "typeof session.userId === 'string'"
    );
  });

  it('never renders the website login promotion inside the desktop shell', async () => {
    const [loginRequiredSource, desktopShellSource] = await Promise.all([
      readFile(resolve(projectRoot, 'components/login-required-card.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-app-shell.tsx'), 'utf8')
    ]);

    expect(loginRequiredSource).toContain(
      "const isDesktopSurface = process.env.NEXT_PUBLIC_SEEKOFFER_SURFACE === 'desktop'"
    );
    expect(loginRequiredSource).toContain('if (isDesktopSurface)');
    expect(loginRequiredSource).toContain('return null;');
    expect(desktopShellSource).toContain('session={session}');
    expect(desktopShellSource).not.toContain('function handleOpenLogin()');
    expect(desktopShellSource).not.toContain("from '@/lib/auth-intent'");
    expect(desktopShellSource).not.toContain('openAuthModal(');
    expect(desktopShellSource).not.toContain('writeAuthIntent(');
    expect(desktopShellSource).not.toContain('aria-label="登录"');
  });

  it('keeps the signed-in application list visible while it refreshes in the background', async () => {
    const homeSource = await readFile(
      resolve(projectRoot, 'components/desktop-home.tsx'),
      'utf8'
    );

    expect(homeSource).toContain('const applicationCacheTtlMs = 45_000;');
    expect(homeSource).toContain('createKeyedRequestCache<ApplicationRow[]>(applicationCacheTtlMs)');
    expect(homeSource).toContain("const userId = session?.userId?.trim() || '';");
    expect(homeSource).toContain('createApplicationViewState(userId)');
    expect(homeSource).toContain('applicationRequestCache.isFresh(requestUserId)');
    expect(homeSource).not.toContain('pendingApplicationRequests.delete(userId)');
    expect(homeSource).toContain("? '申请项目暂时无法同步，当前显示上次同步的数据。'");
    expect(homeSource).toContain('aria-busy={loading}');
    expect(homeSource).not.toContain("localStorage.setItem('desktop-applications");
  });

  it('suppresses internal data-pipeline changes from user-facing desktop reminders', async () => {
    const reminderSource = await readFile(
      resolve(projectRoot, 'components/desktop-reminder-center.tsx'),
      'utf8'
    );

    expect(reminderSource).toContain(
      "import { getLatestActionableChange } from '@/lib/desktop-reminder-copy';"
    );
    expect(reminderSource).toContain(
      'const latestActionableChange = getLatestActionableChange(row.project.changeLog);'
    );
    expect(reminderSource).not.toContain("duplicate_merge: {");
    expect(reminderSource).not.toContain('已合并重复通知');
    expect(reminderSource).not.toContain("fieldLabel: '通知内容'");
  });

  it('keeps native title-bar controls available on both the login gate and app shell', async () => {
    const [siteShellSource, desktopShellSource, loginScreenSource, windowControlsSource] =
      await Promise.all([
        readFile(resolve(projectRoot, 'components/site-shell.tsx'), 'utf8'),
        readFile(resolve(projectRoot, 'components/desktop-app-shell.tsx'), 'utf8'),
        readFile(resolve(projectRoot, 'components/desktop-login-screen.tsx'), 'utf8'),
        readFile(resolve(projectRoot, 'components/desktop-window-controls.tsx'), 'utf8')
      ]);

    expect(siteShellSource).toContain('return <>{children}</>;');
    expect(windowControlsSource).toContain('getCurrentWindow().startDragging()');
    expect(windowControlsSource).toContain('getCurrentWindow().toggleMaximize()');
    expect(windowControlsSource).toContain('target.closest(DESKTOP_INTERACTIVE_SELECTOR)');
    expect(desktopShellSource).toContain('useDesktopTitlebarDrag()');
    expect(desktopShellSource).not.toContain('data-tauri-drag-region');
    expect(desktopShellSource).toContain('<DesktopWindowControls />');
    expect(loginScreenSource).toContain('useDesktopTitlebarDrag()');
    expect(loginScreenSource).not.toContain('data-tauri-drag-region');
    expect(loginScreenSource).toContain('<DesktopWindowControls />');
  });

  it('keeps six focused primary entries and places secondary utilities outside primary navigation', async () => {
    const desktopShellSource = await readFile(resolve(projectRoot, 'components/desktop-app-shell.tsx'), 'utf8');
    const primaryNavigation = desktopShellSource.slice(
      desktopShellSource.indexOf('const primaryItems'),
      desktopShellSource.indexOf('const commandItems')
    );
    const expectedEntries = [
      ['全部申请', '/'],
      ['日程提醒', '/me?view=schedule'],
      ['导师联系', '/me?view=contacts'],
      ['通知库', '/notices'],
      ['院校库', '/colleges'],
      ['资源中心', '/resources']
    ];
    const actualEntries = [
      ...primaryNavigation.matchAll(
        /label:\s*'([^']+)'[\s\S]*?href:\s*'([^']+)'[\s\S]*?section:\s*'[^']+'/g
      )
    ].map((match) => [match[1], match[2]]);

    expect(actualEntries).toEqual(expectedEntries);
    expect(primaryNavigation).not.toContain('Settings');
    expect(primaryNavigation).not.toContain("label: '设置'");
    expect(desktopShellSource).not.toContain('desktop-context-nav');
    expect(desktopShellSource).not.toContain('desktop-space-switcher');
    expect(desktopShellSource).toContain('className="desktop-nav-list desktop-nav-list--primary"');
    expect(desktopShellSource).toContain('className="desktop-nav-group-label"');
    expect(desktopShellSource).toContain("label: '申请管理'");
    expect(desktopShellSource).toContain("label: '信息与资源'");
    expect(desktopShellSource).toContain('搜索申请、学校、通知或命令');
    expect(desktopShellSource).not.toContain('工具箱');
    expect(desktopShellSource).not.toContain('Toolbox24Regular');
    expect(desktopShellSource).toContain('帮助与反馈');
    expect(desktopShellSource).toContain(
      "ariaCurrent={!settingsOpen && section === 'help' ? 'page' : undefined}"
    );
    expect(desktopShellSource).toContain('aria-label="桌面端主导航"');
    expect(desktopShellSource).toContain('ariaLabel="寻鹿 SeekOffer 首页"');
    expect(desktopShellSource).toContain('aria-label="搜索与快速前往"');
    expect(desktopShellSource).not.toContain('function DesktopAccount(');
    expect(desktopShellSource).toContain('session={session}');
    expect(desktopShellSource).toContain('role="status"');
    expect(desktopShellSource).toContain('aria-live="polite"');
    expect(desktopShellSource).toContain('aria-controls="desktop-reminder-center"');
    expect(desktopShellSource).toContain('settingsTriggerRef');
  });

  it('maps long-tail pages to a stable primary or utility parent', async () => {
    const behaviorSource = await readFile(
      resolve(projectRoot, 'lib/desktop-shell-behavior.ts'),
      'utf8'
    );

    expect(behaviorSource).toContain("['/notices', '/deadlines', '/competitions']");
    expect(behaviorSource).toContain("['/resources', '/gpa', '/knowledge', '/consulting', '/data-quality']");
    expect(behaviorSource).toContain("['/guide', '/faq', '/community']");
    expect(behaviorSource).toContain("['/about', '/privacy', '/terms', '/disclaimer', '/pro']");
  });

  it('makes the homepage an all-application workbench and keeps My Day secondary', async () => {
    const [desktopShellSource, desktopHomeSource, desktopCss] = await Promise.all([
      readFile(resolve(projectRoot, 'components/desktop-app-shell.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-home.tsx'), 'utf8'),
      Promise.all([
        readFile(resolve(projectRoot, 'app/desktop.css'), 'utf8'),
        readFile(resolve(projectRoot, 'app/desktop-mature.css'), 'utf8'),
        readFile(resolve(projectRoot, 'app/desktop-interactions.css'), 'utf8')
      ]).then((parts) => parts.join('\n'))
    ]);
    const filteredRowsSource = desktopHomeSource.slice(
      desktopHomeSource.indexOf('const filteredRows = useMemo'),
      desktopHomeSource.indexOf('useEffect(() => {', desktopHomeSource.indexOf('const filteredRows = useMemo'))
    );

    expect(desktopShellSource).not.toContain('className="desktop-history-controls');
    expect(desktopShellSource).not.toContain('className="desktop-route-label');
    expect(desktopShellSource).toContain("event.altKey && event.key === 'ArrowLeft'");
    expect(desktopShellSource).toContain("event.altKey && event.key === 'ArrowRight'");
    expect(desktopShellSource).toContain('全部功能');
    expect(desktopShellSource).toContain("routePathname === '/' ? (");
    expect(desktopShellSource).toContain('<DesktopHome');
    expect(desktopShellSource).toContain("routePathname === '/todos' ? (");
    expect(desktopShellSource).toContain('<DesktopToday');
    expect(desktopHomeSource).toContain('withApplicationSyncTimeout(fetchApplicationRows(userId))');
    expect(desktopHomeSource).toContain('readLocalApplicationRows(userId)');
    expect(desktopHomeSource).toContain('watchApplicationTable');
    expect(filteredRowsSource).toContain('applications.filter((row) =>');
    expect(filteredRowsSource).not.toContain('.slice(');
    expect(desktopHomeSource).toContain('filteredRows.map((row, index) =>');
    expect(desktopHomeSource).toContain('role="grid"');
    expect(desktopHomeSource).toContain('role="row"');
    expect(desktopHomeSource).toContain('role="gridcell"');
    expect(desktopHomeSource).toContain('aria-selected={selected}');
    expect(desktopHomeSource).toContain('aria-rowindex={index + 1}');
    expect(desktopHomeSource).toContain('aria-rowcount={filteredRows.length}');
    expect(desktopHomeSource).toContain('aria-colcount={1}');
    expect(desktopHomeSource).toContain('aria-colindex={1}');
    expect(desktopHomeSource).not.toContain('aria-colindex={4}');
    expect(desktopHomeSource).not.toContain('aria-current={selected');
    expect(desktopHomeSource).toContain('aria-label="全部申请项目"');
    expect(desktopHomeSource).toContain('className="desktop-page-header-title">全部申请</h1>');
    expect(desktopHomeSource).toContain('全部申请项目');
    expect(desktopHomeSource).toContain('全部状态');
    expect(desktopHomeSource).toContain('全部材料');
    expect(desktopHomeSource).toContain('材料清单');
    expect(desktopHomeSource).toContain('下一截止');
    expect(desktopHomeSource).toContain('项目工作区');
    expect(desktopHomeSource).toContain('aria-label="选中项目详情"');
    expect(desktopHomeSource).not.toContain('信息来源');
    expect(desktopHomeSource).not.toContain('来源：');
    expect(desktopHomeSource).not.toContain('查看院校原文');
    expect(desktopHomeSource).not.toContain('desktop-inspector-source');
    expect(desktopHomeSource).not.toContain('最终以院校官网为准');
    expect(desktopCss).toContain('--desktop-titlebar-height: 56px');
    expect(desktopCss).toContain('--desktop-statusbar-height: 34px');
    expect(desktopCss).toContain('--desktop-rail-width: 232px');
    expect(desktopCss).toContain('--desktop-accent: #147a68');
    expect(desktopCss).toContain('font-size: 28px');
    expect(desktopCss).toContain('font-size: 14px');
    expect(desktopCss).toContain('.desktop-workbench-page');
    expect(desktopCss).toContain('.desktop-project-table');
  });

  it('keeps schedule and mentor contacts as independent views without the shared workbench hero or tabs', async () => {
    const [
      desktopShellSource,
      mePageSource,
      scheduleWorkspaceSource,
      contactsWorkspaceSource,
      publishSource,
      noticeDetailSource,
      noticesSource
    ] = await Promise.all([
      readFile(resolve(projectRoot, 'components/desktop-app-shell.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'app/me/page.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-schedule-workspace.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-contacts-workspace.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'app/publish/page.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/notice-detail-view.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'app/notices/page.tsx'), 'utf8')
    ]);

    expect(desktopShellSource).toContain("href: '/me?view=schedule'");
    expect(desktopShellSource).toContain("href: '/me?view=contacts'");
    expect(desktopShellSource).toContain(
      "key={settingsOpen ? `settings-${settingsInitialCategory}` : routePathname}"
    );
    expect(desktopShellSource).not.toContain('`${pathname}-${activeView}`');
    expect(mePageSource).toContain("import { useRouter, useSearchParams } from 'next/navigation'");
    expect(mePageSource).toContain(
      "const activeSection = normalizeWorkbenchSection(searchParams.get('view'))"
    );
    expect(mePageSource).not.toContain('const [activeSection, setActiveSection]');
    expect(mePageSource).not.toContain('window.addEventListener(DESKTOP_ROUTE_CHANGE_EVENT');
    expect(mePageSource).not.toContain("window.addEventListener('popstate', readCurrentView)");
    expect(mePageSource).toContain("{activeSection === 'schedule' ? (");
    expect(mePageSource).toContain('<ScheduleWorkspace');
    expect(mePageSource).toContain("{activeSection === 'contacts' ? (");
    expect(mePageSource).toContain('<ContactsWorkspace');
    expect(scheduleWorkspaceSource).toContain('id="schedule-page-title"');
    expect(scheduleWorkspaceSource).toContain('>日程与提醒</h1>');
    expect(contactsWorkspaceSource).toContain('id="contacts-page-title"');
    expect(contactsWorkspaceSource).toContain('>导师联系</h1>');
    expect(mePageSource).not.toContain('申请工作台</h1>');
    expect(mePageSource).not.toContain('aria-label="工作台视图"');
    expect(mePageSource).not.toContain('workbench-tab-');
    expect(mePageSource).not.toContain('role="tabpanel"');
    expect(publishSource).not.toContain('信息来源');
    expect(noticeDetailSource).not.toContain('寻鹿整理说明');
    expect(noticeDetailSource).not.toContain('label="收录时间"');
    expect(noticeDetailSource).not.toContain('QQ_GROUP_URL');
    expect(noticesSource).not.toContain('title="整理说明"');
  });

  it('opens project detail on demand and uses a single accessible panel at compact widths', async () => {
    const [desktopHomeSource, desktopCss, desktopMchoseCss] = await Promise.all([
      readFile(resolve(projectRoot, 'components/desktop-home.tsx'), 'utf8'),
      Promise.all([
        readFile(resolve(projectRoot, 'app/desktop.css'), 'utf8'),
        readFile(resolve(projectRoot, 'app/desktop-mature.css'), 'utf8'),
        readFile(resolve(projectRoot, 'app/desktop-interactions.css'), 'utf8'),
        readFile(resolve(projectRoot, 'app/desktop-app-coherence.css'), 'utf8')
      ]).then((parts) => parts.join('\n')),
      readFile(resolve(projectRoot, 'app/desktop-mchose.css'), 'utf8')
    ]);

    expect(desktopHomeSource).toContain("type DesktopLayoutMode = 'wide' | 'split' | 'drawer'");
    expect(desktopHomeSource).toContain('new ResizeObserver(updateLayoutMode)');
    expect(desktopHomeSource).toContain("data-layout-mode={layoutMode}");
    expect(desktopHomeSource).toContain("data-detail-open={inspectorOpen ? 'true' : 'false'}");
    expect(desktopHomeSource).not.toContain("window.matchMedia('(max-width: 959px)')");
    expect(desktopHomeSource).not.toContain('setCompactInspector(media.matches || zoomLevel >= 150)');
    expect(desktopHomeSource).not.toContain('compactZoomLevels');
    expect(desktopHomeSource).not.toContain("attributeFilter: ['data-zoom-level']");
    expect(desktopHomeSource).toContain('compactInspector && inspectorOpen ? (');
    expect(desktopHomeSource).toContain('className="desktop-inspector-backdrop"');
    expect(desktopHomeSource).toContain('onClick={closeCompactInspector}');
    expect(desktopHomeSource).toContain("role={compactInspector ? 'dialog' : undefined}");
    expect(desktopHomeSource).toContain(
      'aria-modal={compactInspector && inspectorOpen ? true : undefined}'
    );
    expect(desktopHomeSource).toContain(
      'aria-hidden={!inspectorOpen}'
    );
    expect(desktopHomeSource).toContain(
      'inert={!inspectorOpen ? true : undefined}'
    );
    expect(desktopHomeSource).toContain('onKeyDown={handleInspectorKeyDown}');
    expect(desktopHomeSource).toContain(
      "if (!compactInspector || event.key !== 'Tab') return"
    );
    expect(desktopHomeSource).toContain(
      "detailInitialFocusRef.current === 'primary' && primary"
    );
    expect(desktopHomeSource).toContain('const focusSelectedRow = useCallback(() => {');
    expect(desktopHomeSource).toContain('detailReturnFocusRef.current, selectedElement');
    expect(desktopHomeSource).toContain('{inspectorOpen && !compactInspector ? (');
    expect(desktopMchoseCss).toContain("[data-layout-mode='drawer'] .desktop-qq-workbench-layout");
    expect(desktopMchoseCss).toContain("[data-layout-mode='drawer'] .desktop-project-workspace");
    expect(desktopCss).toContain('@media (max-width: 1260px)');
    expect(desktopCss).toContain("[data-zoom-level='150']");
    expect(desktopCss).toContain('.desktop-inspector-backdrop');
    expect(desktopCss).toContain('/* FINAL APPLICATION DETAIL DISCLOSURE AUTHORITY');
    expect(desktopCss).toContain("[data-layout-mode='drawer'][data-detail-open='true']");
    expect(desktopCss).not.toContain(
      ".desktop-app-shell[data-zoom-level='150'] .desktop-project-inspector"
    );
  });

  it('loads the mature scale layer last and restores labels hidden by legacy breakpoints', async () => {
    const [layoutSource, matureCss] = await Promise.all([
      readFile(resolve(projectRoot, 'app/build-surface.desktop.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'app/desktop-mature.css'), 'utf8')
    ]);

    expect(layoutSource.indexOf("import './desktop.css'")).toBeLessThan(
      layoutSource.indexOf("import './desktop-mature.css'")
    );
    expect(matureCss).toMatch(
      /\.desktop-brand-english\s*\{[^}]*display:\s*inline;/
    );
    expect(matureCss).toMatch(
      /\.desktop-route-label\s*\{[^}]*display:\s*inline-block;/
    );
    expect(matureCss).toMatch(
      /\.desktop-sync-label\s*\{[^}]*display:\s*inline-flex;[^}]*width:\s*auto;/
    );
    expect(matureCss).toMatch(
      /\.desktop-sync-text,\s*\.desktop-account-label\s*\{[^}]*display:\s*inline;/
    );
    expect(matureCss).toMatch(
      /\.desktop-account-button\s*\{[^}]*width:\s*auto;/
    );
    expect(matureCss).toMatch(
      /\.desktop-today-command\s*\{[^}]*display:\s*inline-flex;/
    );
    expect(matureCss.indexOf('@media (max-width: 760px)')).toBeGreaterThan(
      matureCss.indexOf('.desktop-route-label')
    );
  });

  it('supports whole-app zoom, exact levels, shortcuts, and the settings control', async () => {
    const [desktopShellSource, settingsSource, preferencesSource, capabilityRaw] =
      await Promise.all([
        readFile(resolve(projectRoot, 'components/desktop-app-shell.tsx'), 'utf8'),
        readFile(resolve(projectRoot, 'components/desktop-settings-page.tsx'), 'utf8'),
        readFile(resolve(projectRoot, 'lib/desktop-preferences.ts'), 'utf8'),
        readFile(resolve(projectRoot, 'src-tauri/capabilities/default.json'), 'utf8')
      ]);
    const capability = JSON.parse(capabilityRaw);

    expect(preferencesSource).toContain(
      'DESKTOP_ZOOM_LEVELS = [80, 90, 100, 110, 125, 150, 175, 200] as const'
    );
    expect(desktopShellSource).toContain('getCurrentWebview().setZoom(1)');
    expect(desktopShellSource).toContain(
      "document.documentElement.style.setProperty('zoom', String(requestedZoomLevel / 100))"
    );
    expect(desktopShellSource).toContain(
      "const zoomIn = event.key === '+' || event.key === '=' || event.code === 'NumpadAdd'"
    );
    expect(desktopShellSource).toContain(
      "const zoomOut = event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract'"
    );
    expect(desktopShellSource).toContain(
      "const zoomReset = event.key === '0' || event.code === 'Numpad0'"
    );
    expect(desktopShellSource).toContain('if (zoomReset) updateZoomLevel(100)');
    expect(desktopShellSource).toContain('DESKTOP_ZOOM_LEVELS.map((level) =>');
    expect(desktopShellSource).toContain('data-zoom-level={preferences.zoomLevel}');
    expect(desktopShellSource).toContain('const handleZoomMenuKeyDown = useCallback');
    expect(desktopShellSource).toContain(
      "['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)"
    );
    expect(desktopShellSource).toContain(
      "'[role=\"menuitemradio\"],[role=\"menuitem\"]'"
    );
    expect(desktopShellSource).toContain('items[nextIndex]?.focus()');
    expect(desktopShellSource).toContain(
      "'[role=\"menuitemradio\"][aria-checked=\"true\"]'"
    );
    expect(desktopShellSource).toContain('zoomTriggerRef.current?.focus()');
    expect(desktopShellSource).toContain('id="desktop-zoom-menu"');
    expect(desktopShellSource).toContain('role="menu"');
    expect(desktopShellSource).toContain('onKeyDown={handleZoomMenuKeyDown}');
    expect(desktopShellSource).toContain('role="menuitemradio"');
    expect(desktopShellSource).toContain('role="menuitem"');
    expect(desktopShellSource).toContain('aria-haspopup="menu"');
    expect(desktopShellSource).toContain(
      "aria-controls={zoomMenuOpen ? 'desktop-zoom-menu' : undefined}"
    );
    expect(settingsSource).toContain('aria-label="界面缩放"');
    expect(settingsSource).toContain('value={preferences.zoomLevel}');
    expect(settingsSource).toContain('DESKTOP_ZOOM_LEVELS.map((level) =>');
    expect(capability.permissions).toContain('core:webview:allow-set-webview-zoom');
  });

  it('offers persisted light, dark, and system appearance choices', async () => {
    const [preferencesSource, settingsSource] = await Promise.all([
      readFile(resolve(projectRoot, 'lib/desktop-preferences.ts'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-settings-page.tsx'), 'utf8')
    ]);
    const themeControlSource = settingsSource.slice(
      settingsSource.indexOf('aria-label="应用主题"'),
      settingsSource.indexOf('aria-label="内容密度"')
    );

    expect(preferencesSource).toContain("theme: 'light'");
    expect(preferencesSource).toContain(
      "theme: isOneOf(source.theme, ['system', 'light', 'dark'] as const)"
    );
    expect(settingsSource).toContain("value: 'system'");
    expect(settingsSource).toContain("value: 'light'");
    expect(settingsSource).toContain("value: 'dark'");
    expect(themeControlSource).toContain('desktopThemeOptions.map');
    expect(themeControlSource).toContain('data-theme-choice={option.value}');
    expect(themeControlSource).toContain('跟随 Windows 主题');
    expect(themeControlSource).toContain('更改将自动保存');
  });

  it('exposes a dedicated settings page outside route content and supports the Windows Ctrl+, shortcut', async () => {
    const [desktopShellSource, settingsSource] = await Promise.all([
      readFile(resolve(projectRoot, 'components/desktop-app-shell.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-settings-page.tsx'), 'utf8')
    ]);

    expect(desktopShellSource).toContain("import('./desktop-settings-page')");
    expect(desktopShellSource).toContain('module.DesktopSettingsPage');
    expect(desktopShellSource).toContain('<DesktopSettingsPage');
    expect(desktopShellSource).toContain('setSettingsOpen(true)');
    expect(desktopShellSource).toContain("openSettings('notifications')");
    expect(desktopShellSource).toContain('initialCategory={settingsInitialCategory}');
    expect(desktopShellSource).toMatch(
      /\(event\.ctrlKey \|\| event\.metaKey\)[\s\S]{0,120}event\.(?:key|code) === ['"](?:,|Comma)['"]/
    );
    expect(settingsSource).toContain('aria-label="设置分类"');
    expect(settingsSource).toContain("id: 'general'");
    expect(settingsSource).toContain("id: 'account'");
    expect(settingsSource).toContain("id: 'notifications'");
    expect(settingsSource).toContain("id: 'appearance'");
    expect(settingsSource).toContain("id: 'about'");
    expect(settingsSource).toContain('initialCategory?: DesktopSettingsCategory');
  });

  it('wires real autostart and window-state plugins with narrow desktop permissions', async () => {
    const [packageRaw, cargoRaw, rustSource, desktopCapabilityRaw, settingsSource] = await Promise.all([
      readFile(resolve(projectRoot, 'package.json'), 'utf8'),
      readFile(resolve(projectRoot, 'src-tauri/Cargo.toml'), 'utf8'),
      readFile(resolve(projectRoot, 'src-tauri/src/lib.rs'), 'utf8'),
      readFile(resolve(projectRoot, 'src-tauri/capabilities/desktop.json'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-settings-page.tsx'), 'utf8')
    ]);
    const packageJson = JSON.parse(packageRaw);
    const desktopCapability = JSON.parse(desktopCapabilityRaw);

    expect(packageJson.dependencies).toHaveProperty('@tauri-apps/plugin-autostart');
    expect(packageJson.dependencies).toHaveProperty('@tauri-apps/plugin-window-state');
    expect(cargoRaw).toContain('tauri-plugin-autostart = "2"');
    expect(cargoRaw).toContain('tauri-plugin-window-state = "2"');
    expect(rustSource).toContain('tauri_plugin_autostart::Builder::new().build()');
    expect(rustSource).toContain('tauri_plugin_window_state::Builder::new()');
    expect(rustSource).toContain('StateFlags::POSITION');
    expect(rustSource).toContain('StateFlags::SIZE');
    expect(rustSource).toContain('StateFlags::MAXIMIZED');
    expect(desktopCapability.windows).toEqual(['main']);
    expect(desktopCapability.permissions).toEqual([
      'autostart:allow-enable',
      'autostart:allow-disable',
      'autostart:allow-is-enabled'
    ]);
    expect(desktopCapability.permissions).not.toContain('autostart:default');
    expect(desktopCapability.permissions).not.toContain('window-state:default');
    expect(settingsSource).toContain("import('@tauri-apps/plugin-autostart')");
    expect(settingsSource).toContain('await isEnabled()');
    expect(settingsSource).toContain('await autostart.enable()');
    expect(settingsSource).toContain('await autostart.disable()');
  });

  it('refuses to package a desktop installer that is older than its build inputs', async () => {
    const packageScriptSource = await readFile(
      resolve(projectRoot, 'scripts/package-desktop-release.mjs'),
      'utf8'
    );

    expect(packageScriptSource).toContain('const buildInputPaths = [');
    expect(packageScriptSource).toContain(
      'newestBuildInput.stats.mtimeMs > sourceInstallerStats.mtimeMs + 1_000'
    );
    expect(packageScriptSource).toContain('安装包早于桌面端构建输入，拒绝整理旧二进制。');
    expect(packageScriptSource).toContain('请先运行 npm run desktop:build。');
  });

  it('builds reminders from real account applications without hard-coded school alerts', async () => {
    const [packageRaw, cargoRaw, rustSource, capabilityRaw, reminderSource, desktopShellSource, settingsSource] = await Promise.all([
      readFile(resolve(projectRoot, 'package.json'), 'utf8'),
      readFile(resolve(projectRoot, 'src-tauri/Cargo.toml'), 'utf8'),
      readFile(resolve(projectRoot, 'src-tauri/src/lib.rs'), 'utf8'),
      readFile(resolve(projectRoot, 'src-tauri/capabilities/default.json'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-reminder-center.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-app-shell.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-settings-page.tsx'), 'utf8')
    ]);
    const packageJson = JSON.parse(packageRaw);
    const capability = JSON.parse(capabilityRaw);
    const reminderInvocation = desktopShellSource.slice(
      desktopShellSource.indexOf('<DesktopReminderCenter'),
      desktopShellSource.indexOf('/>', desktopShellSource.indexOf('<DesktopReminderCenter')) + 2
    );

    expect(packageJson.dependencies).toHaveProperty('@tauri-apps/plugin-notification');
    expect(cargoRaw).toContain('tauri-plugin-notification = "2"');
    expect(rustSource).toContain('.plugin(tauri_plugin_notification::init())');
    expect(capability.permissions).toEqual(
      expect.arrayContaining([
        'notification:allow-is-permission-granted',
        'notification:allow-request-permission',
        'notification:allow-notify'
      ])
    );
    expect(capability.permissions).not.toContain('notification:default');
    expect(reminderSource).not.toContain('Schedule.at');
    expect(reminderSource).not.toMatch(/\bschedule\s*:/);
    expect(reminderSource).toContain('sendNotification');
    expect(reminderSource).toContain('seekoffer-desktop-reminder-state-v3');
    expect(reminderSource).toContain(
      'function buildApplicationReminders(applications: ApplicationRow[], now: number)'
    );
    expect(reminderSource).toContain('applications.forEach((row) =>');
    expect(reminderSource).toContain(
      'const schoolName = getDisplaySchoolName(row.project.schoolName)'
    );
    expect(reminderSource).toContain("return fetchApplicationRows(session?.userId || undefined);");
    expect(reminderSource).toContain('watchApplicationTable(() => void refresh())');
    expect(reminderSource).toContain('buildApplicationReminders(applications, now)');
    expect(reminderSource).toContain('const kindPriority: Record<ReminderKind, number>');
    expect(reminderSource).toContain("deadline: 0");
    expect(reminderSource).toContain("materials: 1");
    expect(reminderSource).toContain("mentor: 2");
    expect(reminderSource).toContain("change: 3");
    for (const schoolName of [
      '中国科学院大学',
      '南京大学',
      '浙江大学',
      '上海交通大学',
      '山东大学'
    ]) {
      expect(reminderSource).not.toContain(schoolName);
    }
    expect(reminderSource).toContain(
      "return `${REMINDER_STATE_KEY}:${userId || 'unknown-user'}`"
    );
    expect(reminderSource).toContain(
      "const reminderStateKey = getReminderStateKey(session?.userId || '')"
    );
    expect(reminderSource).toContain('setState(readReminderState(reminderStateKey))');
    expect(reminderSource).toContain(
      'window.localStorage.setItem(reminderStateKey, JSON.stringify(state))'
    );
    expect(reminderSource).toContain('inert={!open ? true : undefined}');
    expect(reminderSource).toContain('onKeyDown={handleDialogKeyDown}');
    expect(reminderSource).toContain('还没有可生成的提醒');
    expect(reminderSource).toContain('当前提醒都处理好了');
    expect(desktopShellSource).toContain(
      'const [unreadReminderCount, setUnreadReminderCount] = useState(0)'
    );
    expect(reminderInvocation).toContain('preferences={preferences}');
    expect(reminderInvocation).toMatch(/onPreferencesChange=\{[^}]+\}/);
    expect(reminderInvocation).toMatch(/onOpenSettings=\{[^}]+\}/);
    expect(reminderSource).toMatch(
      /reminders\.filter\(\(reminder\) =>\s*isDesktopNotificationKindEnabled\(preferences, reminder\.kind\)\s*\)/
    );
    expect(reminderSource).toContain(
      'getReminderSnoozeOptions(new Date(now), defaultSnoozeMinutes)'
    );
    expect(reminderSource).toContain(
      'defaultSnoozeMinutes={preferences.notifications.snoozeMinutes}'
    );
    expect(reminderSource).toContain('aria-haspopup="menu"');
    expect(reminderSource).toContain("event.key === 'Escape'");
    expect(reminderSource).not.toContain('requestPermission');
    expect(settingsSource).toContain('notification.requestPermission()');
  });

  it('honors project reminder opt-outs and lets read actions clear expired snoozes', async () => {
    const reminderSource = await readFile(
      resolve(projectRoot, 'components/desktop-reminder-center.tsx'),
      'utf8'
    );
    const reminderBuilderSource = reminderSource.slice(
      reminderSource.indexOf('function buildApplicationReminders'),
      reminderSource.indexOf('function buildRuntimeNotificationEvents')
    );
    const markReadSource = reminderSource.slice(
      reminderSource.indexOf('function markReminderRead'),
      reminderSource.indexOf('function handleNavigate')
    );

    expect(reminderBuilderSource).toContain('if (!row.item.customReminderEnabled) return;');
    expect(reminderBuilderSource.indexOf('if (!row.item.customReminderEnabled) return;')).toBeLessThan(
      reminderBuilderSource.indexOf("kind: 'deadline'")
    );
    expect(reminderBuilderSource.indexOf('if (!row.item.customReminderEnabled) return;')).toBeLessThan(
      reminderBuilderSource.indexOf("kind: 'materials'")
    );
    expect(reminderBuilderSource.indexOf('if (!row.item.customReminderEnabled) return;')).toBeLessThan(
      reminderBuilderSource.indexOf("kind: 'change'")
    );
    expect(reminderSource).toContain(
      'if (snoozedUntil && new Date(snoozedUntil).getTime() <= now) return true;'
    );
    expect(markReadSource).toContain('delete remainingSnoozes[id]');
    expect(markReadSource).toContain('snoozedUntil: remainingSnoozes');
    expect(markReadSource).toContain(
      'const reminderIds = enabledReminders.map((reminder) => reminder.id);'
    );
    expect(markReadSource).toContain('function undoMarkAllRead()');
    expect(markReadSource).toContain('MARK_ALL_READ_UNDO_MS');
    expect(markReadSource).toContain('markReminderIdsRead(state, reminderIds)');
    expect(markReadSource).toContain('restoreMarkedReminderIds(current, markAllReadUndo)');
    expect(reminderSource).toContain('onClick={() => markReminderRead(reminder.id)}');
  });

  it('delivers due Windows banners while running with account-scoped deduplication', async () => {
    const [reminderSource, settingsSource] = await Promise.all([
      readFile(resolve(projectRoot, 'components/desktop-reminder-center.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-settings-page.tsx'), 'utf8')
    ]);

    expect(reminderSource).toContain(
      "const RUNTIME_NOTIFICATION_STATE_KEY = 'seekoffer-desktop-runtime-notifications-v1'"
    );
    expect(reminderSource).toContain(
      "return `${RUNTIME_NOTIFICATION_STATE_KEY}:${userId || 'unknown-user'}`"
    );
    expect(reminderSource).toContain(
      "const runtimeNotificationStateKey = getRuntimeNotificationStateKey(session?.userId || '')"
    );
    expect(reminderSource).toContain(
      'const events = buildRuntimeNotificationEvents(enabledReminders, state, now)'
    );
    expect(reminderSource).toContain('const ledger = readRuntimeNotificationLedger(runtimeNotificationStateKey)');
    expect(reminderSource).toContain('!retainedDelivered[event.eventId]');
    expect(reminderSource).toContain('event.dueAt <= now');
    expect(reminderSource).toContain('event.expiresAt >= now');
    expect(reminderSource).toContain('.slice(0, RUNTIME_NOTIFICATION_BATCH_SIZE)');
    expect(reminderSource).toContain(
      'const permissionGranted = await notification.isPermissionGranted();'
    );
    expect(reminderSource).toContain(
      'if (!isCurrentNotificationTask() || !permissionGranted) return;'
    );
    expect(reminderSource).toContain('notification.sendNotification({');
    expect(reminderSource).toContain(
      'writeRuntimeNotificationLedger(runtimeNotificationStateKey,'
    );
    expect(reminderSource).toContain('!preferences.notifications.windowsDelivery');
    expect(reminderSource).toContain(
      'getNextAllowedDesktopNotificationDate(preferences, new Date(now))'
    );
    expect(reminderSource).toContain('nextAllowed.getTime() > now + 1_000');
    expect(reminderSource).toContain('runtimeNotificationSyncRef.current');
    expect(reminderSource).toContain('eventId: `snooze:v1:${reminder.id}:${snoozedUntil}`');
    expect(reminderSource).toContain('eventId: `deadline:v1:${reminder.id}:T-24h`');
    expect(reminderSource).toContain('eventId: `materials:v1:${reminder.id}:T-72h`');
    expect(reminderSource).toContain('eventId: `change:v1:${reminder.id}`');
    expect(reminderSource).not.toContain('Schedule.at');
    expect(reminderSource).not.toMatch(/\bschedule\s*:/);
    expect(settingsSource).toContain('寻鹿运行期间，会为新出现的重要事项请求显示 Windows 横幅。');
    expect(settingsSource).toContain('Windows 横幅仅在寻鹿运行期间请求发送。');
  });

  it('keeps reminder loading, sync errors, retry, and empty results distinguishable', async () => {
    const reminderSource = await readFile(
      resolve(projectRoot, 'components/desktop-reminder-center.tsx'),
      'utf8'
    );

    expect(reminderSource).toContain(
      'const [applicationsLoading, setApplicationsLoading] = useState(true)'
    );
    expect(reminderSource).toContain(
      "const [applicationsError, setApplicationsError] = useState('')"
    );
    expect(reminderSource).toContain('withReminderSyncTimeout(');
    expect(reminderSource).toContain('REMINDER_SYNC_TIMEOUT_MS');
    expect(reminderSource).toContain('REMINDER_RETRY_MS');
    expect(reminderSource).toContain('setApplicationsError(');
    expect(reminderSource).toContain("setApplicationsError('');");
    expect(reminderSource).toContain('aria-busy={applicationsLoading}');
    expect(reminderSource).toContain('onClick={() => setRefreshNonce((value) => value + 1)}');
    expect(reminderSource).toContain('role="alert"');
    expect(reminderSource).toContain('立即重试');
    expect(reminderSource).toContain('applicationsLoading && !hasUsableReminderSnapshot ? (');
    expect(reminderSource).toContain('role="status"');
    expect(reminderSource).toContain('正在同步提醒');
    expect(reminderSource).toContain(
      'const hardSyncError = Boolean(applicationsError && !hasUsableReminderSnapshot);'
    );
    expect(reminderSource).not.toContain('if (applicationsError && !applications.length)');
    expect(reminderSource).toContain('暂时无法同步提醒');
    expect(reminderSource).toContain('还没有可生成的提醒');
    expect(reminderSource).toContain('当前没有已启用的提醒');
    expect(reminderSource).toContain('当前提醒都处理好了');
  });

  it('uses a stable notice loading surface without synchronized pulse skeletons', async () => {
    const noticeSource = await readFile(resolve(projectRoot, 'app/notices/page.tsx'), 'utf8');

    expect(noticeSource).toContain('function NoticeLoadingState()');
    expect(noticeSource).toContain('function SideLoadingState({');
    expect(noticeSource).toContain('正在加载通知');
    expect(noticeSource).toContain('正在同步最新院校通知、报名截止与更新信息。');
    expect(noticeSource).toContain('完成后会保留当前筛选条件');
    expect(noticeSource).toContain('role="status"');
    expect(noticeSource).toContain('aria-live="polite"');
    expect(noticeSource).toContain('aria-busy="true"');
    expect(noticeSource).toContain('motion-safe:animate-spin');
    expect(noticeSource).not.toContain('NoticeListSkeleton');
    expect(noticeSource).not.toContain('SideLoadingRows');
    expect(noticeSource).not.toContain('animate-pulse');
  });

  it('keeps the QQ and MCHOSE desktop language consistent across shell, notices, and motion', async () => {
    const [shellSource, noticeSource, qqCss, interactionCss] = await Promise.all([
      readFile(resolve(projectRoot, 'components/desktop-app-shell.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'app/notices/page.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'app/desktop-qq.css'), 'utf8'),
      readFile(resolve(projectRoot, 'app/desktop-interactions.css'), 'utf8')
    ]);

    expect(shellSource).toContain('People24Regular');
    expect(shellSource).toContain('People24Filled');
    expect(shellSource).toContain('Building24Regular');
    expect(shellSource).toContain('Building24Filled');
    expect(shellSource).toContain('Library24Regular');
    expect(shellSource).toContain('Library24Filled');
    expect(shellSource).toContain('QuestionCircle24Regular');

    expect(noticeSource).toContain('desktop-notice-library');
    expect(noticeSource).toContain('desktop-notice-hero');
    expect(noticeSource).toContain('desktop-notice-filters');
    expect(noticeSource).toContain('desktop-notice-results');
    expect(noticeSource).toContain('desktop-notice-card');
    expect(noticeSource).toContain('desktop-notice-sidebar');

    expect(qqCss).toContain('SeekOffer desktop v0.1.9');
    expect(qqCss).toContain('.desktop-app-shell .desktop-notice-library');
    expect(qqCss).toContain('font-size: 28px !important');
    expect(qqCss).toContain('border-radius: 14px !important');
    expect(qqCss).not.toContain('.desktop-primary-nav-item:hover > span:not(.desktop-nav-badge)');
    expect(qqCss).not.toContain('.desktop-rail-utility-button:hover > span');
    expect(qqCss).toContain("[data-zoom-level='200']");

    expect(interactionCss).toContain('animation: desktop-view-enter var(--motion-route)');
    expect(interactionCss).toContain('transform: translateY(2px)');
    expect(interactionCss).toContain('background: #168070 !important');
    expect(interactionCss).toContain('animation: desktop-route-progress-v3');
    expect(interactionCss).not.toContain('desktop-route-progress-v2');
    const routeViewTransition = interactionCss.slice(
      interactionCss.indexOf('@keyframes desktop-view-enter'),
      interactionCss.indexOf(".desktop-app-shell[data-route-pending='true']")
    );
    expect(routeViewTransition).toContain('translateY(2px)');
    expect(routeViewTransition).not.toContain('translateY(8px)');
  });

  it('keeps the full desktop product on one mature interaction and layout contract', async () => {
    const [
      shellSource,
      homeSource,
      todaySource,
      reminderSource,
      windowControlsSource,
      collegeSource,
      resourceSource,
      qqCss
    ] = await Promise.all([
      readFile(resolve(projectRoot, 'components/desktop-app-shell.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-home.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-today.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-reminder-center.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'components/desktop-window-controls.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'app/colleges/page.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'app/resources/desktop-resource-center.tsx'), 'utf8'),
      readFile(resolve(projectRoot, 'app/desktop-qq.css'), 'utf8')
    ]);

    expect(shellSource).toContain('function isCurrentDesktopHref(');
    expect(shellSource).toContain("normalizeDesktopHref,");
    expect(shellSource).toContain("shouldEmitDesktopRouteChange");
    expect(shellSource).toContain('return !shouldEmitDesktopRouteChange(window.location.href, href);');
    expect(shellSource).toContain('if (isCurrentDesktopHref(href))');
    expect(shellSource).not.toContain("href: '/me?view=applications'");
    expect(homeSource).not.toContain('/me?view=applications');
    expect(todaySource).not.toContain('/me?view=applications');
    expect(reminderSource).not.toContain('/me?view=applications');

    expect(homeSource).toContain('desktop-workbench-loading-state');
    expect(homeSource).toContain('正在同步申请');
    expect(homeSource).toContain('正在读取项目、材料与截止时间');
    expect(homeSource).not.toContain('desktop-workbench-loading-scope');
    expect(homeSource).toContain('aria-busy="true"');
    expect(homeSource).not.toContain('desktop-workbench-skeleton');
    expect(homeSource).not.toContain('正在加载工作区');
    expect(homeSource).toContain('hasHardLoadError');

    expect(qqCss).toContain('.desktop-app-shell .desktop-settings-layout');
    expect(qqCss).toContain('display: grid !important');
    expect(qqCss).toContain('grid-template-columns: 232px minmax(0, 1fr) !important');
    expect(qqCss).toContain(".desktop-app-shell[data-density='compact'] .desktop-application-object-row");
    expect(qqCss).toContain('min-height: 96px !important');
    expect(qqCss).toContain('@keyframes desktop-workbench-loading-spin');
    expect(qqCss).toContain('html[data-desktop-reduce-motion=\'true\'] .desktop-workbench-loading-icon svg');
    expect(qqCss).toContain('.desktop-auth-shell');
    expect(qqCss).toContain('width: min(520px, calc(100vw - 48px)) !important');

    expect(collegeSource).toContain('desktop-college-toolbar');
    expect(collegeSource).toContain('desktop-college-card');
    expect(resourceSource).toContain('desktop-resource-toolkit');
    expect(resourceSource).toContain('desktop-resource-tool-card');
    expect(qqCss).toContain('.desktop-app-shell .desktop-college-card');
    expect(qqCss).toContain('.desktop-app-shell .desktop-resource-tool-card');
    expect(qqCss).toContain(':is(#schedule-board, #contacts-board)');

    expect(windowControlsSource).toContain('关闭到系统托盘');
    expect(qqCss).toContain('.desktop-caption-button:hover:not(.desktop-caption-close)');
    expect(qqCss).not.toContain('.desktop-caption-button:hover:not(.desktop-caption-button--close)');
  });

  it('uses one interaction protocol for feedback, modal focus, reduced motion, and zoom reflow', async () => {
    const [layoutSource, authGateSource, shellSource, homeSource, todaySource, interactionCss] =
      await Promise.all([
        readFile(resolve(projectRoot, 'app/build-surface.desktop.tsx'), 'utf8'),
        readFile(resolve(projectRoot, 'components/desktop-auth-gate.tsx'), 'utf8'),
        readFile(resolve(projectRoot, 'components/desktop-app-shell.tsx'), 'utf8'),
        readFile(resolve(projectRoot, 'components/desktop-home.tsx'), 'utf8'),
        readFile(resolve(projectRoot, 'components/desktop-today.tsx'), 'utf8'),
        readFile(resolve(projectRoot, 'app/desktop-interactions.css'), 'utf8')
      ]);

    expect(layoutSource).toContain('desktopPreferenceBootstrap');
    expect(layoutSource).toContain("import './desktop-interactions.css'");
    expect(authGateSource).toContain('document.documentElement.dataset.desktopReduceMotion');
    expect(authGateSource).toContain('getCurrentWebview().setZoom(1)');
    expect(shellSource).toContain('DESKTOP_FEEDBACK_EVENT');
    expect(shellSource).toContain('DESKTOP_MODAL_STATE_EVENT');
    expect(shellSource).toContain('className={`desktop-feedback-toast');
    expect(shellSource).toContain('useLayerPresence(commandOpen, preferences.reduceMotion)');
    expect(shellSource).toContain('inert={appModalOpen ? true : undefined}');
    expect(shellSource).toContain('inert={shellModalOpen ? true : undefined}');
    expect(shellSource).toContain('if (!preferencesReady) return;');
    expect(shellSource).toContain("event.key.toLowerCase() === 'f'");
    expect(homeSource).toContain('role="grid"');
    expect(homeSource).toContain('role="row"');
    expect(homeSource).toContain('role="gridcell"');
    expect(homeSource).toContain('aria-selected={selected}');
    expect(homeSource).toContain('aria-busy={loading}');
    expect(homeSource).toContain('zoomLevel >= 150');
    expect(homeSource).toContain("emitDesktopModalState('workbench-project-inspector', modalOpen)");
    expect(homeSource).toContain('onDoubleClick={(event) => {');
    expect(todaySource).toContain('handleQuickAddDialogKeyDown');
    expect(todaySource).toContain('quickAddTriggerRef.current?.focus({ preventScroll: true })');
    expect(todaySource).toContain('inert={quickAddOpen ? true : undefined}');
    expect(todaySource).toContain("emitDesktopModalState('today-quick-add', quickAddOpen)");
    expect(todaySource).toContain('displayManagerTriggerRef.current?.focus()');
    expect(interactionCss).toContain('--motion-press: var(--motion-faster)');
    expect(interactionCss).toContain('--motion-hover: var(--motion-faster)');
    expect(interactionCss).toContain('--motion-popup: var(--motion-fast)');
    expect(interactionCss).toContain('--motion-panel: var(--motion-normal)');
    expect(interactionCss).toContain('--motion-modal: var(--motion-fast)');
    expect(interactionCss).toContain('--motion-route: var(--motion-fast)');
    expect(interactionCss).toContain("html[data-desktop-reduce-motion='true']");
    expect(interactionCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(interactionCss).toContain(':is(.desktop-app-shell, .desktop-auth-shell) *');
    expect(interactionCss).toContain("[data-zoom-level='200']");
  });
});
