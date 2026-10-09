import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

// Real desktop UI, synthetic account and native bridge. Never install software,
// send notifications or transmit private data while auditing presentation.
const directory = path.resolve(process.env.SEEKOFFER_REVIEW_EXPORT || '.next-desktop');
const output = path.resolve(process.env.SEEKOFFER_REVIEW_OUTPUT || 'artifacts/desktop-shell-visual-20261009');
fs.mkdirSync(output, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.txt': 'text/x-component', '.woff2': 'font/woff2' };
const server = process.env.SEEKOFFER_REVIEW_URL ? null : http.createServer((request, response) => {
  let file = path.resolve(directory, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(directory + path.sep) && file !== directory) return response.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return response.writeHead(404).end();
  response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(response);
});
if (server) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.SEEKOFFER_REVIEW_URL || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const checks = [], screenshots = [], geometry = [], errors = [], blocked = [];
let activePage;
function check(name, result, detail) { checks.push({ name, passed: Boolean(result), ...(detail ? { detail } : {}) }); }

async function fixture({ width = 1440, height = 900, zoom = 100, dark = false, phase = 'available' } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await context.addInitScript(({ zoom, dark, phase }) => {
    localStorage.setItem('seekoffer-desktop-preferences-v1', JSON.stringify({ version: 1, theme: dark ? 'dark' : 'light', zoomLevel: zoom, reduceMotion: true, launchDestination: 'last' }));
    sessionStorage.setItem('seekoffer-desktop-launch-applied-v1', 'true');
    let callback = 0;
    const snapshot = { currentVersion: '0.2.28', version: '0.2.29', notes: '- 修复界面提示定位。\n- 统一多页面布局与交互。', publishedAt: '2026-10-09', phase, downloadedBytes: 0, totalBytes: 25672873, percent: null, errorCode: phase === 'error' ? 'UPDATE_CHECK_ERROR' : null, errorMessage: phase === 'error' ? '合成网络错误' : null, retryable: true, lastCheckedAt: new Date().toISOString() };
    window.__visualFixture = { snapshot, calls: [] };
    window.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
      transformCallback: () => ++callback, unregisterCallback: () => {},
      invoke: async (command, args) => {
        window.__visualFixture.calls.push(command);
        if (command === 'native_auth_session') return { accessToken: 'SYNTHETIC_UI_TOKEN', subject: 'user_visual_fixture', email: 'visual@example.invalid', sessionId: 'synthetic-ui', expiresAt: Date.now() / 1000 + 3600 };
        if (command === 'get_desktop_update_snapshot') return { ...snapshot };
        if (command === 'check_for_desktop_update') return { ...snapshot, lastCheckedAt: new Date().toISOString() };
        if (command === 'download_desktop_update') { snapshot.phase = 'readyToInstall'; snapshot.percent = 100; snapshot.downloadedBytes = snapshot.totalBytes; return { ...snapshot }; }
        if (command === 'install_desktop_update') throw new Error('INSTALL_FORBIDDEN_IN_VISUAL_AUDIT');
        if (command === 'plugin:window|inner_size') return { width: innerWidth, height: innerHeight };
        if (command === 'plugin:window|scale_factor') return 1;
        if (command === 'plugin:window|is_maximized' || command === 'plugin:autostart|is_enabled') return false;
        if (command === 'plugin:notification|is_permission_granted') return false;
        if (command === 'plugin:app|version') return '0.2.28';
        if (command === 'native_public_request') return { items: [], pagination: { page: 1, pageSize: 16, total: 0, totalPages: 1 }, stats: { total2026: 0, todayUpdates: 0, deadlineWithin3Days: 0 }, facets: { regions: [], schools: [], categories: [], disciplines: [], collegeStats: [] }, sideData: { urgentProjects: [], latestProjects: [], topColleges: [], todaySchoolUpdates: { rows: [] }, latestPublishDate: '' } };
        return 1;
      }
    };
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  }, { zoom, dark, phase });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === base) return route.continue();
    if (url.origin !== 'https://migration.seekoffer.com.cn') { blocked.push(url.hostname); return route.abort(); }
    let result;
    if (url.pathname === '/v1/me/profile' && route.request().method() === 'GET') result = { id: '00000000-0000-4000-8000-000000000010', nickname: '独立界面验收', age: '', undergraduate_school: '', major: '', grade: '大四', target_major: '', target_region: '', sync_revision: 1 };
    else if (url.pathname === '/v1/me/applications' && route.request().method() === 'GET') result = { items: [], nextCursor: null };
    else if (url.pathname === '/v1/me/workbench' && route.request().method() === 'GET') result = { user_id: '00000000-0000-4000-8000-000000000010', custom_todos: [], mentor_contacts: [], completed_todo_ids: [], sync_revision: 1 };
    else if (url.pathname === '/v1/me/billing' && route.request().method() === 'POST' && route.request().postDataJSON().action === 'get-entitlement') result = { isPro: false, entitlement: { status: 'free' }, applicationCount: 0, freeLimit: 5, plans: [] };
    else { errors.push(`Unexpected synthetic API: ${route.request().method()} ${url.pathname}`); return route.abort(); }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  });
  const page = await context.newPage();
  activePage = page;
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '全部申请', exact: true }).waitFor({ timeout: 60000 });
  await page.getByText('还没有申请项目', { exact: true }).waitFor({ timeout: 30000 });
  return { page, context };
}

async function capture(page, name) {
  await page.waitForTimeout(200);
  const measurement = await page.evaluate(() => {
    const selectors = ['.desktop-app-shell', '.desktop-content-region', '.desktop-settings-page', '.desktop-settings-content', '.desktop-setting-row', '.desktop-theme-option', '.desktop-feedback-toast', '.desktop-update-toast', '.desktop-global-dialog-panel', '.desktop-command-dialog', '.desktop-shortcut-dialog', '.desktop-reminder-center'];
    const nodes = [...new Set(selectors.flatMap(selector => [...document.querySelectorAll(selector)]))].filter(node => node.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }));
    return { viewport: { width: innerWidth, height: innerHeight }, documentWidth: document.documentElement.scrollWidth,
      nodes: nodes.map(node => { const rect = node.getBoundingClientRect(), css = getComputedStyle(node); return { className: node.className, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, position: css.position, display: css.display, overflowX: css.overflowX }; }) };
  });
  geometry.push({ name, ...measurement });
  check(`${name}: document has no horizontal overflow`, measurement.documentWidth <= measurement.viewport.width + 2, measurement.documentWidth);
  const overflowing = measurement.nodes.filter(node => node.left < -2 || node.right > measurement.viewport.width + 2 || node.scrollWidth > node.clientWidth + 3);
  check(`${name}: visible content stays within width`, !overflowing.length, overflowing);
  const overlays = measurement.nodes.filter(node => /desktop-(update-toast|feedback-toast|global-dialog-panel|command-dialog|shortcut-dialog)/.test(node.className));
  check(`${name}: overlays fit viewport`, overlays.every(node => node.top >= -2 && node.bottom <= measurement.viewport.height + 2), overlays);
  const file = path.join(output, `${name}.png`);
  await page.screenshot({ path: file }); screenshots.push(file);
}

async function category(page, id, label) {
  const picker = page.getByRole('combobox', { name: '设置分类', exact: true });
  if (await picker.isVisible()) await picker.selectOption(id);
  else await page.getByRole('tab', { name: new RegExp(`^${label}，`) }).click();
  await page.locator(`.desktop-settings-page[data-settings-category="${id}"]`).waitFor();
}

try {
  const sizes = [
    { width: 1440, height: 900, zoom: 100 },
    { width: 960, height: 720, zoom: 100 },
    { width: 960, height: 640, zoom: 100 },
    { width: 960, height: 720, zoom: 125 },
    { width: 1280, height: 720, zoom: 150, dark: true },
    { width: 960, height: 720, zoom: 200 },
    { width: 960, height: 640, zoom: 200 }
  ];
  for (const size of sizes) {
    const { page, context } = await fixture(size);
    const label = `${size.width}x${size.height}-zoom${size.zoom}${size.dark ? '-dark' : ''}`;
    await page.locator('.desktop-update-toast').waitFor();
    await capture(page, `${label}-update-available`);
    check(`${label}: update notification has real fixed/grid layout`, await page.locator('.desktop-update-toast').evaluate(node => getComputedStyle(node).position === 'fixed' && getComputedStyle(node).display === 'grid'));
    await page.getByRole('button', { name: /^设置/ }).click();
    await page.locator('.desktop-settings-page').waitFor();
    for (const [id, title] of [['general', '常规'], ['account', '账号与同步'], ['notifications', '通知'], ['appearance', '外观'], ['about', '关于']]) {
      await category(page, id, title);
      await capture(page, `${label}-settings-${id}`);
      check(`${label}: ${id} does not duplicate update notification`, await page.locator('.desktop-update-toast:visible').count() === 0);
      const scrollTop = await page.locator('.desktop-settings-content').evaluate(node => node.scrollTop);
      check(`${label}: ${id} starts at top`, scrollTop < 2, scrollTop);
      if (id === 'about') check(`${label}: about avoids duplicate update card`, await page.locator('.desktop-update-toast:visible').count() === 0);
      await page.locator('.desktop-settings-content').evaluate(node => { node.scrollTop = node.scrollHeight; });
    }
    // Settings is non-modal; keyboard search must still present a bounded dialog.
    await page.keyboard.press('Control+k');
    await page.getByRole('dialog', { name: '搜索与快速前往', exact: true }).waitFor();
    await capture(page, `${label}-command-search`);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+/');
    await page.getByRole('dialog', { name: '键盘快捷键', exact: true }).waitFor();
    await capture(page, `${label}-shortcuts`);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^提醒中心，/ }).click();
    await page.getByRole('dialog', { name: '提醒中心', exact: true }).waitFor();
    await capture(page, `${label}-reminders`);
    await page.getByRole('button', { name: '关闭提醒中心', exact: true }).click();
    await context.close();
  }
  const { page, context } = await fixture();
  await page.locator('.desktop-update-toast').waitFor();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('seekoffer:desktop-feedback', { detail: { message: '测试反馈：本机修改已保存', tone: 'success', duration: 30000 } })));
  await page.locator('.desktop-feedback-toast').waitFor();
  await capture(page, 'feedback-and-update');
  const toastBoxes = await Promise.all(['.desktop-update-toast', '.desktop-feedback-toast'].map(selector => page.locator(selector).boundingBox()));
  const [a, b] = toastBoxes;
  check('Update and general feedback do not overlap', a && b && (a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y), toastBoxes);
  await page.getByRole('button', { name: '后台下载', exact: true }).click();
  await page.getByRole('button', { name: '重启更新', exact: true }).waitFor();
  await capture(page, 'update-ready');
  await page.getByRole('button', { name: '重启更新', exact: true }).click();
  await page.getByRole('alertdialog', { name: '重启并完成更新', exact: true }).waitFor();
  await capture(page, 'update-restart-confirmation');
  await page.getByRole('button', { name: '稍后', exact: true }).click();
  await page.getByRole('alertdialog', { name: '重启并完成更新', exact: true }).waitFor({ state: 'hidden' });
  await page.waitForTimeout(100);
  check('Restart cancellation returns focus to its trigger', await page.evaluate(() => document.activeElement?.textContent === '重启更新'));
  check('Restart cancellation does not install', !(await page.evaluate(() => window.__visualFixture.calls)).includes('install_desktop_update'));
  await page.getByRole('button', { name: '稍后处理软件更新', exact: true }).click();
  check('Dismissed card preserves settings update badge', await page.locator('.desktop-settings-update-dot').count() === 1);
  await context.close();
  for (const phase of ['error', 'upToDate', 'downloading']) {
    const { page: updatePage, context: updateContext } = await fixture({ width: 960, height: 720, zoom: 125, phase });
    await updatePage.getByRole('button', { name: /^设置/ }).click();
    await updatePage.locator('.desktop-settings-page').waitFor();
    await category(updatePage, 'about', '关于');
    await updatePage.locator('.desktop-setting-row--emphasis').scrollIntoViewIfNeeded();
    await capture(updatePage, `update-${phase}-settings`);
    if (phase !== 'downloading') {
      await updatePage.getByRole('button', { name: phase === 'error' ? '重新检查' : '检查更新', exact: true }).click();
      await updatePage.locator('.desktop-feedback-toast').waitFor();
      check(`${phase}: manual check keeps actionable feedback`, await updatePage.locator('.desktop-feedback-toast').isVisible());
      await capture(updatePage, `update-${phase}-feedback`);
    }
    await updateContext.close();
  }
} catch (error) {
  errors.push(error.stack || String(error));
  await activePage?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  const body = await activePage?.locator('body').innerText().catch(() => '');
  console.error(body?.slice(0, 4500));
} finally {
  const failed = checks.filter(check => !check.passed);
  const report = { at: new Date().toISOString(), passed: failed.length === 0 && errors.length === 0, source: base, syntheticOnly: true, productionWrites: 0, nativeInstallationTested: false, checks, geometry, screenshots, errors, blockedExternalRequests: blocked.length };
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, checks: checks.length, failed, errors, screenshots: screenshots.length, report: path.join(output, 'result.json') }, null, 2));
  if (!report.passed && process.env.SEEKOFFER_REVIEW_BASELINE !== '1') process.exitCode = 1;
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
