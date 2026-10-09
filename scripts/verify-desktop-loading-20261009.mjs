import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

// Compiled desktop UI only. Authentication and all HTTP/IPC responses below are
// synthetic; this does not test native WebView2 or contact production services.
const directory = path.resolve(process.env.SEEKOFFER_REVIEW_EXPORT || '.next-desktop');
const output = path.resolve('artifacts/desktop-loading-20261009-browser');
fs.mkdirSync(output, { recursive: true });
assert.ok(fs.existsSync(path.join(directory, 'index.html')), 'Build the desktop export first.');
const owner = '00000000-0000-4000-8000-000000000009';
const token = 'SYNTHETIC_LOADING_TOKEN';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.txt': 'text/x-component', '.woff2': 'font/woff2' };
function fingerprintExport() {
  const files = [];
  function visit(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (/\.(?:html|js|css|json|txt|wasm)$/.test(entry.name)) files.push(path.relative(directory, file).replaceAll('\\', '/'));
    }
  }
  visit(directory);
  const hash = createHash('sha256').update('seekoffer-desktop-export-v1\0');
  for (const file of files.sort()) hash.update(file).update('\0').update(fs.readFileSync(path.join(directory, file))).update('\0');
  return { algorithm: 'sha256-path-and-content-v1', sha256: hash.digest('hex'), fileCount: files.length };
}
const exportFingerprint = fingerprintExport();
const server = http.createServer((request, response) => {
  let file = path.resolve(directory, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (file !== directory && !file.startsWith(directory + path.sep)) { response.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { response.writeHead(404).end(); return; }
  response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(response);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const contexts = [], screenshots = [], checks = [], geometry = [], pageErrors = [], routeErrors = [], requests = [], mutations = [], blockedRequests = [];
let activePage;

function gate(held = false) {
  let release;
  let promise = held ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
  return {
    wait: () => promise,
    release: () => release?.(),
    hold: () => { promise = new Promise(resolve => { release = resolve; }); }
  };
}

async function scenario(label, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 920 }, serviceWorkers: 'block', reducedMotion: options.systemReduced ? 'reduce' : 'no-preference' });
  contexts.push(context);
  const state = { workbenchError: Boolean(options.workbenchError), revision: 1 };
  const waits = { profile: gate(options.profile), applications: gate(options.applications), workbench: gate(options.workbench) };
  await context.addInitScript(({ token, options }) => {
    localStorage.setItem('seekoffer-desktop-preferences-v1', JSON.stringify({ version: 1, theme: options.dark ? 'dark' : 'light', reduceMotion: Boolean(options.appReduced), zoomLevel: options.zoom || 100, launchDestination: 'last' }));
    sessionStorage.setItem('seekoffer-desktop-launch-applied-v1', 'true');
    let state = options.signedOut ? 'signed-out' : 'ready';
    const gates = new Map();
    const held = new Set(['session', 'login', 'public'].filter(key => options[key]));
    const wait = key => held.has(key) ? new Promise(resolve => { const queue = gates.get(key) || []; queue.push(resolve); gates.set(key, queue); }) : Promise.resolve();
    window.__loadingFixture = {
      calls: [],
      release(key) { held.delete(key); for (const resolve of gates.get(key) || []) resolve(); gates.delete(key); },
      hold(key) { held.add(key); }
    };
    const session = () => ({ accessToken: token, subject: 'user_loading_synthetic', email: 'loading@example.invalid', sessionId: 'synthetic-loading-session', expiresAt: Date.now() / 1000 + 3600 });
    let callback = 0;
    window.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
      transformCallback: () => ++callback, unregisterCallback: () => {},
      invoke: async (command, args) => {
        window.__loadingFixture.calls.push(command);
        if (command === 'native_auth_session') { await wait('session'); return state === 'ready' ? session() : null; }
        if (command === 'native_auth_login') { await wait('login'); state = 'ready'; return session(); }
        if (command === 'native_auth_sign_out') { state = 'signed-out'; return; }
        if (command === 'plugin:window|inner_size') return { width: innerWidth, height: innerHeight };
        if (command === 'plugin:window|scale_factor') return 1;
        if (command === 'plugin:window|is_maximized' || command === 'plugin:autostart|is_enabled') return false;
        if (command === 'plugin:updater|check') return null;
        if (command === 'plugin:app|version') return '0.2.27';
        if (command === 'native_public_request') {
          const url = new URL(args.path, 'https://synthetic.invalid');
          await wait('public');
          const items = options.noticeContent ? [{ id: 'synthetic-loading-notice', schoolName: '合成大学', departmentName: '模拟研究院', projectName: '合成验收通知：申请安排', projectType: '预推免', discipline: '计算机', publishDate: '2026-10-09', deadlineDate: '2026-10-30', deadlineLevel: 'future', tags: ['预推免'], status: '报名中', year: 2026, sourceSite: '合成验收数据', sourceLink: '', applyLink: '', collectedAt: '2026-10-09', updatedAt: '2026-10-09', isVerified: false }] : [];
          if (url.pathname === '/v1/notices') return {
            items, pagination: { page: 1, pageSize: Number(url.searchParams.get('pageSize') || 16), total: items.length, totalPages: 1 },
            stats: { total2026: items.length, todayUpdates: items.length, deadlineWithin3Days: 0 }, facets: { regions: [], schools: [], categories: [], disciplines: [], collegeStats: [] },
            sideData: { urgentProjects: [], latestProjects: [], topColleges: [], todaySchoolUpdates: { date: '', hasTodayRows: false, rows: [] }, latestPublishDate: '' }, servedAt: new Date().toISOString()
          };
          throw Error('UNPROVIDED_SYNTHETIC_PUBLIC_ROUTE');
        }
        return 1;
      }
    };
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  }, { token, options });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === base) return route.continue();
    requests.push({ label, method: request.method(), path: url.pathname, host: url.hostname });
    if (url.origin !== 'https://migration.seekoffer.com.cn') {
      blockedRequests.push({ label, host: url.hostname, path: url.pathname });
      return route.abort();
    }
    try {
      assert.equal(request.headers().authorization, `Bearer ${token}`);
      let response;
      if (url.pathname === '/v1/me/profile' && request.method() === 'GET') {
        await waits.profile.wait();
        response = { id: owner, nickname: '合成加载验收', age: '', undergraduate_school: '', major: '', grade: '大四', target_major: '', target_region: '', sync_revision: 1 };
      } else if (url.pathname === '/v1/me/applications' && request.method() === 'GET') {
        await waits.applications.wait();
        response = { items: [], nextCursor: null };
      } else if (url.pathname === '/v1/me/workbench' && request.method() === 'GET') {
        await waits.workbench.wait();
        if (state.workbenchError) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"SYNTHETIC_OFFLINE"}' });
        response = { user_id: owner, completed_todo_ids: [], custom_todos: [], mentor_contacts: [], sync_revision: state.revision };
      } else if (url.pathname === '/v1/me/workbench' && request.method() === 'PUT') {
        const payload = request.postDataJSON();
        assert.equal(payload.custom_todos.length, 0);
        assert.equal(payload.mentor_contacts.length, 0);
        mutations.push({ label, method: 'PUT', path: url.pathname, syntheticOnly: true });
        response = { sync_revision: ++state.revision };
      } else if (url.pathname === '/v1/me/billing' && request.method() === 'POST') {
        assert.equal(request.postDataJSON().action, 'get-entitlement');
        response = { entitlement: { user_id: owner, plan_id: null, status: 'free', starts_at: null, expires_at: null }, isPro: false, applicationCount: 0, freeLimit: 5, plans: [] };
      } else throw Error(`UNPROVIDED_SYNTHETIC_ROUTE: ${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    } catch (error) {
      routeErrors.push({ label, error: String(error.message) });
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"SYNTHETIC_ASSERTION_FAILED"}' });
    }
  });
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push({ label, error: error.message }));
  activePage = page;
  return { page, state, waits, context };
}

async function capture(page, name) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  // Let the intentionally short opacity entrance settle, not the fixture request.
  await page.waitForTimeout(240);
  const measurement = await page.evaluate(() => {
    const visible = element => element.checkVisibility({ checkVisibilityCSS: true }) && element.getBoundingClientRect().width > 0;
    const nodes = [...document.querySelectorAll('.desktop-auth-shell,.desktop-app-shell,.desktop-content-region,[data-desktop-loading]')].filter(visible);
    const title = document.querySelector('#schedule-page-title');
    const header = title?.closest('header');
    let scheduleHeading;
    if (title && header) {
      const titleBox = title.getBoundingClientRect(), headerBox = header.getBoundingClientRect();
      const scale = headerBox.width / header.offsetWidth;
      scheduleHeading = { actualInset: titleBox.left - headerBox.left, expectedInset: parseFloat(getComputedStyle(header).paddingLeft) * scale };
    }
    return {
      viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
      scheduleHeading,
      nodes: nodes.map(element => { const box = element.getBoundingClientRect(); return { label: element.getAttribute('data-desktop-loading') || element.className, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, left: box.left, right: box.right }; })
    };
  });
  assert.ok(measurement.documentWidth <= measurement.viewport + 2, `${name}: document overflows`);
  assert.ok(measurement.nodes.every(node => node.scrollWidth <= node.clientWidth + 3 && node.left >= -2 && node.right <= measurement.viewport + 2), `${name}: ${JSON.stringify(measurement)}`);
  if (measurement.scheduleHeading) {
    assert.ok(Math.abs(measurement.scheduleHeading.actualInset - measurement.scheduleHeading.expectedInset) <= 3, `${name}: schedule title is not left aligned: ${JSON.stringify(measurement.scheduleHeading)}`);
  }
  geometry.push({ name, ...measurement });
  const file = path.join(output, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  screenshots.push(file);
}

async function captureWidths(page, name) {
  for (const width of [1280, 960]) {
    await page.setViewportSize({ width, height: 920 });
    await capture(page, `${name}-${width}`);
  }
}

async function assertReduced(page, name) {
  const animations = await page.locator('[data-loading-indicator="ring"] > span').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).animationName));
  assert.ok(animations.length > 0, `${name}: expected a visible loading indicator`);
  assert.ok(animations.every(value => value === 'none'), `${name}: rotating despite reduced motion: ${animations}`);
  checks.push({ name, animations, passed: true });
}

try {
  const auth = await scenario('auth', { signedOut: true, session: true, login: true, profile: true });
  await auth.page.goto(base, { waitUntil: 'domcontentloaded' });
  await auth.page.locator('[data-startup-phase="restore-session"]').waitFor({ timeout: 15000 });
  await captureWidths(auth.page, 'startup');
  await auth.page.evaluate(() => window.__loadingFixture.release('session'));
  await auth.page.getByRole('button', { name: '在系统浏览器登录', exact: true }).click();
  await auth.page.locator('[data-native-login-phase="waiting-browser"]').waitFor();
  assert.equal(await auth.page.getByRole('button', { name: '等待浏览器授权', exact: true }).isDisabled(), true);
  await captureWidths(auth.page, 'login-waiting-browser');
  await auth.page.evaluate(() => window.__loadingFixture.release('login'));
  await auth.page.locator('[data-native-login-phase="syncing-account"]').waitFor();
  await captureWidths(auth.page, 'login-syncing-account');
  auth.waits.profile.release();
  await auth.page.getByRole('heading', { name: '全部申请', exact: true }).waitFor({ timeout: 15000 });
  checks.push({ name: 'startup-to-browser-authorization-to-account-sync', passed: true });

  const applications = await scenario('applications', { applications: true });
  await applications.page.goto(base, { waitUntil: 'domcontentloaded' });
  await applications.page.locator('[data-desktop-loading="applications"]').waitFor({ timeout: 15000 });
  assert.equal(await applications.page.getByText('还没有申请项目', { exact: true }).count(), 0);
  assert.equal(await applications.page.locator('[data-desktop-view-search]').isVisible(), true);
  await captureWidths(applications.page, 'applications-first-load');
  applications.waits.applications.release();
  await applications.page.getByText('还没有申请项目', { exact: true }).waitFor();
  checks.push({ name: 'applications-first-load-before-authoritative-empty', passed: true });

  const notices = await scenario('notices', { public: true, dark: true, appReduced: true, noticeContent: true });
  await notices.page.goto(`${base}/notices/`, { waitUntil: 'domcontentloaded' });
  await notices.page.locator('[data-desktop-loading="notices"]').waitFor({ timeout: 15000 });
  assert.equal(await notices.page.locator('html').getAttribute('data-desktop-theme'), 'dark');
  const noticeRings = await notices.page.locator('[data-loading-indicator="ring"]').evaluateAll(nodes => nodes.filter(node => node.checkVisibility({ checkVisibilityCSS: true })).length);
  assert.equal(noticeRings, 1, 'Initial notices should not show a second refresh spinner above its skeleton.');
  await assertReduced(notices.page, 'application-reduced-motion');
  await captureWidths(notices.page, 'notices-first-load-dark-reduced');
  await notices.page.evaluate(() => window.__loadingFixture.release('public'));
  await notices.page.locator('[data-desktop-loading="notices"]').waitFor({ state: 'hidden' });
  await notices.page.getByText('合成验收通知：申请安排', { exact: true }).waitFor();
  await notices.page.evaluate(() => window.__loadingFixture.hold('public'));
  await notices.page.getByRole('button', { name: '刷新最新', exact: true }).click();
  await notices.page.getByRole('button', { name: '刷新中', exact: true }).waitFor();
  assert.equal(await notices.page.getByText('合成验收通知：申请安排', { exact: true }).isVisible(), true);
  assert.equal(await notices.page.locator('[data-desktop-loading="notices"]').count(), 0);
  await capture(notices.page, 'notices-refresh-keeps-content');
  await notices.page.evaluate(() => window.__loadingFixture.release('public'));
  await notices.page.getByRole('button', { name: '刷新最新', exact: true }).waitFor();
  checks.push({ name: 'notices-first-load-dark-theme', passed: true });
  checks.push({ name: 'notices-background-refresh-keeps-content', passed: true });

  const schedule = await scenario('schedule', { workbench: true, workbenchError: true });
  await schedule.page.goto(`${base}/me/?view=schedule`, { waitUntil: 'domcontentloaded' });
  await schedule.page.locator('[data-desktop-loading="schedule"]').waitFor({ timeout: 15000 });
  assert.equal(await schedule.page.getByRole('heading', { name: '还没有日程', exact: true }).count(), 0);
  await captureWidths(schedule.page, 'schedule-first-load');
  schedule.waits.workbench.release();
  await schedule.page.getByText('日程暂时未能加载', { exact: true }).waitFor({ timeout: 15000 });
  assert.equal(await schedule.page.locator('[data-desktop-loading="schedule"]').count(), 0);
  await capture(schedule.page, 'schedule-read-error');
  schedule.state.workbenchError = false;
  schedule.waits.workbench.hold();
  await schedule.page.getByRole('button', { name: '重新加载', exact: true }).click();
  await schedule.page.locator('[data-desktop-loading="schedule"]').waitFor();
  await capture(schedule.page, 'schedule-retry');
  schedule.waits.workbench.release();
  await schedule.page.getByRole('heading', { name: '还没有日程', exact: true }).waitFor({ timeout: 15000 });
  checks.push({ name: 'schedule-first-load-error-stops-spinner-retry-recovers-empty', passed: true });

  const contacts = await scenario('contacts', { workbench: true, systemReduced: true, dark: true });
  await contacts.page.goto(`${base}/me/?view=contacts`, { waitUntil: 'domcontentloaded' });
  await contacts.page.locator('[data-desktop-loading="contacts"]').waitFor({ timeout: 15000 });
  assert.equal(await contacts.page.getByRole('heading', { name: '还没有导师联系人', exact: true }).count(), 0);
  await assertReduced(contacts.page, 'system-reduced-motion');
  await captureWidths(contacts.page, 'contacts-first-load-dark-reduced');
  contacts.waits.workbench.release();
  await contacts.page.getByRole('heading', { name: '还没有导师联系人', exact: true }).waitFor();
  checks.push({ name: 'contacts-first-load-before-authoritative-empty', passed: true });

  const zoomed = await scenario('applications-zoom', { applications: true, zoom: 125 });
  await zoomed.page.setViewportSize({ width: 960, height: 920 });
  await zoomed.page.goto(base, { waitUntil: 'domcontentloaded' });
  await zoomed.page.locator('[data-desktop-loading="applications"]').waitFor({ timeout: 15000 });
  assert.equal(await zoomed.page.locator('.desktop-app-shell').getAttribute('data-zoom-level'), '125');
  assert.equal(await zoomed.page.locator('html').getAttribute('data-desktop-zoom-level'), '125');
  await capture(zoomed.page, 'applications-first-load-960-zoom125');
  zoomed.waits.applications.release();
  checks.push({ name: 'narrow-960-application-preference-125-percent', passed: true });

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(routeErrors, []);
  assert.deepEqual(fingerprintExport(), exportFingerprint, 'The export changed during verification.');
  const result = { at: new Date().toISOString(), layer: 'compiled-desktop-export-Chromium-synthetic-IPC-and-HTTP', nativeWebView2Verified: false, realOAuthVerified: false, productionWrites: 0, exportDirectory: directory, exportFingerprint, checks, geometry, screenshots, mutations, blockedExternalRequests: blockedRequests.length, pageErrors, routeErrors };
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) {
  const result = { state: 'DESKTOP_LOADING_VERIFICATION_FAILED', error: String(error.stack || error), checks, pageErrors, routeErrors, requests, body: await activePage?.locator('body').innerText().catch(() => '') };
  fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify(result, null, 2));
  await activePage?.screenshot({ path: path.join(output, 'failure.png'), fullPage: false }).catch(() => {});
  console.error(JSON.stringify({ ...result, body: result.body?.slice(0, 4000) }));
  process.exitCode = 1;
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
