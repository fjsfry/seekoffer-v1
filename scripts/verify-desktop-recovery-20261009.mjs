import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

// This uses the actual compiled desktop UI, with synthetic native IPC and HTTP.
// Only localhost files are allowed onto the network; no production mutation occurs.
const directory = path.resolve(process.env.SEEKOFFER_REVIEW_EXPORT || '.next-desktop');
const output = path.resolve('artifacts/desktop-recovery-20261009-browser');
fs.mkdirSync(output, { recursive: true });
assert.ok(fs.existsSync(path.join(directory, 'index.html')), 'Build the desktop export before running this check.');
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
const owner = '00000000-0000-4000-8000-000000000001';
const marker = '回归测试：保留本机日程';
const newTitle = '回归测试：新日程写入云端';
const initialTodo = { id: 'synthetic-local-todo', text: marker, category: '申请', priority: '重要不紧急', completed: false, createdAt: '2026-10-09T00:00:00Z', updatedAt: '2026-10-09T00:00:00Z' };
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.txt': 'text/x-component', '.woff2': 'font/woff2' };
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
const requests = [], mutations = [], blockedRequests = [], pageErrors = [], routeErrors = [], viewports = [];
const contexts = [];

async function fixtureContext(label) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: 'block' });
  contexts.push(context);
  let workbench = { user_id: owner, completed_todo_ids: [], custom_todos: [], mentor_contacts: [], sync_revision: 1 };
  await context.addInitScript(({ owner, initialTodo }) => {
    if (!sessionStorage.getItem('synthetic-recovery-initialized')) {
      sessionStorage.setItem('synthetic-recovery-initialized', 'true');
      sessionStorage.setItem('synthetic-native-state', 'expired');
      localStorage.setItem('seekoffer-d1-user-session', JSON.stringify({
        loggedIn: true, authProvider: 'password', userId: owner, email: 'native@example.invalid', phone: '',
        profile: { nickname: '合成恢复测试', age: '', undergraduateSchool: '', major: '', grade: '大四', targetMajor: '', targetRegion: '' }
      }));
      localStorage.setItem(`seekoffer-workbench-custom-todos:owner:${owner}`, JSON.stringify([initialTodo]));
    }
    let callback = 0;
    window.__fixtureIpc = [];
    window.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
      transformCallback: () => ++callback,
      unregisterCallback: () => {},
      invoke: async (command, args) => {
        window.__fixtureIpc.push(command);
        if (command === 'native_auth_session') {
          const status = sessionStorage.getItem('synthetic-native-state');
          if (status === 'expired') throw 'NATIVE_REAUTHENTICATION_REQUIRED';
          if (status !== 'ready') return null;
          return { accessToken: 'SYNTHETIC_NATIVE_TOKEN', subject: 'user_native_synthetic', email: 'native@example.invalid', sessionId: 'synthetic-recovery-session', expiresAt: Date.now() / 1000 + 3600 };
        }
        if (command === 'native_auth_login') {
          sessionStorage.setItem('synthetic-native-state', 'ready');
          return { accessToken: 'SYNTHETIC_NATIVE_TOKEN', subject: 'user_native_synthetic', email: 'native@example.invalid', sessionId: 'synthetic-recovery-session', expiresAt: Date.now() / 1000 + 3600 };
        }
        if (command === 'native_auth_sign_out') { sessionStorage.setItem('synthetic-native-state', 'signed-out'); return; }
        if (command === 'plugin:window|inner_size') return { width: innerWidth, height: innerHeight };
        if (command === 'plugin:window|scale_factor') return 1;
        if (command === 'plugin:window|is_maximized' || command === 'plugin:autostart|is_enabled') return false;
        if (command === 'plugin:updater|check') return null;
        if (command === 'plugin:app|version') return '0.2.27';
        if (command === 'native_public_request') {
          const url = new URL(args.path, 'https://synthetic.invalid');
          if (url.pathname === '/v1/notices') return {
            items: [], pagination: { page: 1, pageSize: Number(url.searchParams.get('pageSize') || 16), total: 0, totalPages: 1 },
            stats: { total2026: 0, todayUpdates: 0, deadlineWithin3Days: 0 },
            facets: { regions: [], schools: [], categories: [], disciplines: [], collegeStats: [] },
            sideData: { urgentProjects: [], latestProjects: [], topColleges: [], todaySchoolUpdates: { rows: [] }, latestPublishDate: '' }, servedAt: new Date().toISOString()
          };
          throw Error('SYNTHETIC_PUBLIC_ROUTE_NOT_PROVIDED');
        }
        return 1;
      }
    };
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  }, { owner, initialTodo });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === base) return route.continue();
    requests.push({ label, host: url.hostname, path: url.pathname, method: request.method() });
    if (url.origin !== 'https://migration.seekoffer.com.cn') {
      blockedRequests.push({ label, host: url.hostname, path: url.pathname, method: request.method() });
      return route.abort();
    }
    try {
      assert.equal(request.headers()['x-seekoffer-client'], 'desktop-pkce');
      assert.equal(request.headers().authorization, 'Bearer SYNTHETIC_NATIVE_TOKEN');
      let response;
      if (url.pathname === '/v1/me/profile' && request.method() === 'GET') {
        response = { id: owner, nickname: '合成恢复测试', age: '', undergraduate_school: '', major: '', grade: '大四', target_major: '', target_region: '', sync_revision: 1 };
      } else if (url.pathname === '/v1/me/applications' && request.method() === 'GET') {
        response = { items: [], nextCursor: null };
      } else if (url.pathname === '/v1/me/workbench' && request.method() === 'GET') {
        response = workbench;
      } else if (url.pathname === '/v1/me/workbench' && request.method() === 'PUT') {
        const payload = request.postDataJSON();
        assert.equal(request.headers()['x-workspace-owner'], owner);
        assert.equal(payload.expectedRevision, workbench.sync_revision);
        assert.ok(Array.isArray(payload.custom_todos));
        const revision = workbench.sync_revision + 1;
        workbench = { ...payload, user_id: owner, sync_revision: revision };
        delete workbench.expectedRevision;
        mutations.push({ label, method: 'PUT', path: url.pathname, expectedRevision: payload.expectedRevision, returnedRevision: revision, todoIds: payload.custom_todos.map(todo => todo.id), titles: payload.custom_todos.map(todo => todo.text) });
        response = { sync_revision: revision };
      } else if (url.pathname === '/v1/me/billing' && request.method() === 'POST') {
        assert.equal(request.postDataJSON().action, 'get-entitlement');
        response = { entitlement: { user_id: owner, plan_id: null, status: 'free', starts_at: null, expires_at: null }, isPro: false, applicationCount: 0, freeLimit: 5, plans: [] };
      } else throw Error(`Unprovided synthetic route: ${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    } catch (error) {
      routeErrors.push(String(error.message));
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"SYNTHETIC_ASSERTION_FAILED"}' });
    }
  });
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push({ label, message: error.message }));
  return { context, page, readCloud: () => workbench };
}

async function assertLocalPreserved(page) {
  const value = await page.evaluate(owner => localStorage.getItem(`seekoffer-workbench-custom-todos:owner:${owner}`), owner);
  assert.ok(JSON.parse(value || '[]').some(todo => todo.id === initialTodo.id && todo.text === marker), 'The cached local todo must survive login recovery and logout.');
}

async function inspectViewport(page, route, width) {
  await page.setViewportSize({ width, height: 960 });
  await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' });
  const title = route.startsWith('/resources') ? '资源中心' : '日程与提醒';
  await page.getByRole('heading', { name: title, exact: true }).waitFor({ timeout: 15000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(300);
  const geometry = await page.evaluate(() => {
    const selector = '.desktop-app-shell,.desktop-content-region,.desktop-resource-page,.desktop-resource-workspace,[aria-label="日程列表"],[aria-label="日程事项"]';
    return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, elements: [...document.querySelectorAll(selector)].map(element => ({
      name: element.getAttribute('aria-label') || element.className, width: element.clientWidth, scrollWidth: element.scrollWidth,
      left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right
    })).filter(element => element.width > 0) };
  });
  assert.ok(geometry.documentWidth <= width + 2, `Document overflows at ${width}: ${JSON.stringify(geometry)}`);
  assert.ok(geometry.elements.every(element => element.scrollWidth <= element.width + 3 && element.left >= -2 && element.right <= width + 2), `Workspace overflows at ${width}: ${JSON.stringify(geometry)}`);
  viewports.push({ route, width, geometry });
  await page.screenshot({ path: path.join(output, `${route.startsWith('/resources') ? 'resources' : 'schedule'}-${width}.png`), fullPage: false });
}

let activePage;
try {
  const recovered = await fixtureContext('recover');
  activePage = recovered.page;
  await activePage.goto(`${base}/me/?view=schedule`, { waitUntil: 'domcontentloaded' });
  await activePage.getByRole('button', { name: '重新登录', exact: true }).waitFor({ timeout: 20000 });
  await assertLocalPreserved(activePage);
  assert.equal(requests.filter(request => request.label === 'recover' && request.host === 'migration.seekoffer.com.cn').length, 0, 'Expired native credentials must not produce private HTTP requests.');
  await activePage.screenshot({ path: path.join(output, 'expired-session-preserved.png'), fullPage: false });
  await activePage.getByRole('button', { name: '重新登录', exact: true }).click();
  await activePage.getByRole('button', { name: '重新登录', exact: true }).waitFor({ state: 'hidden', timeout: 15000 });
  await activePage.getByRole('heading', { name: '日程与提醒', exact: true }).waitFor({ timeout: 15000 });
  await activePage.getByText(marker, { exact: true }).first().waitFor();
  await assertLocalPreserved(activePage);
  assert.ok(requests.some(request => request.label === 'recover' && request.path === '/v1/me/profile'));
  await activePage.getByRole('button', { name: '新建日程', exact: true }).first().click();
  await activePage.locator('[data-schedule-create-title]').fill(newTitle);
  await activePage.getByRole('button', { name: '保存日程', exact: true }).click();
  await activePage.waitForFunction(({ owner, title }) => {
    const baseline = JSON.parse(localStorage.getItem(`seekoffer:workbench-baseline:v1:${owner}`) || '{}');
    return baseline.customTodos?.some(todo => todo.text === title);
  }, { owner, title: newTitle }, { timeout: 15000 });
  assert.ok(recovered.readCloud().custom_todos.some(todo => todo.text === newTitle));
  assert.ok(mutations.some(change => change.titles.includes(newTitle) && change.returnedRevision === change.expectedRevision + 1));
  const savedCount = mutations.length;
  // Acknowledgement state must settle instead of recursively issuing PUTs.
  await activePage.waitForTimeout(1600);
  assert.equal(mutations.length, savedCount, 'Acknowledged state must not start an endless write loop.');
  for (const width of [1440, 960]) {
    await inspectViewport(activePage, '/resources/', width);
    await inspectViewport(activePage, '/me/?view=schedule', width);
  }

  const expiredLogout = await fixtureContext('logout-expired');
  activePage = expiredLogout.page;
  await activePage.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  await activePage.getByRole('button', { name: '重新登录', exact: true }).waitFor({ timeout: 20000 });
  await activePage.getByRole('button', { name: /^设置/ }).click();
  await activePage.getByRole('tab', { name: /账号与同步/ }).click();
  await activePage.getByRole('button', { name: '退出登录', exact: true }).click();
  await activePage.waitForFunction(() => localStorage.getItem('seekoffer-d1-user-session') === null, undefined, { timeout: 10000 });
  await activePage.getByRole('button', { name: '在系统浏览器登录', exact: true }).waitFor({ timeout: 10000 });
  await assertLocalPreserved(activePage);
  const logoutIpc = await activePage.evaluate(() => window.__fixtureIpc);
  assert.ok(logoutIpc.includes('native_auth_sign_out'));
  assert.ok(!logoutIpc.includes('native_auth_login'));
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(routeErrors, []);
  assert.ok(!requests.some(request => request.host.includes('supabase')));
  assert.deepEqual(fingerprintExport(), exportFingerprint, 'The compiled export changed while this verification was running.');
  const result = {
    at: new Date().toISOString(), layer: 'compiled-desktop-export-Chromium-synthetic-IPC-and-HTTP',
    exportDirectory: directory, exportFingerprint,
    realNativeOAuth: false, productionWrites: 0, expiredSessionLocalDataPreserved: true,
    reauthenticationRestored: true, expiredSessionSignOut: true, scheduleSaveAcknowledged: true,
    stableAfterAcknowledgement: true, viewports, mutations, blockedExternalRequests: blockedRequests.length,
    pageErrors, routeErrors
  };
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) {
  const result = { state: 'DESKTOP_RECOVERY_REGRESSION_FAILED', error: String(error.stack || error), pageErrors, routeErrors, requests, mutations, body: await activePage?.locator('body').innerText().catch(() => '') };
  fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify(result, null, 2));
  await activePage?.screenshot({ path: path.join(output, 'failure.png'), fullPage: false }).catch(() => {});
  console.error(JSON.stringify({ ...result, body: result.body?.slice(0, 3000) }));
  process.exitCode = 1;
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
