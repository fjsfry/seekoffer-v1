import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

// Tests the actual compiled export, without CSS/source injection or a live account.
const directory = path.resolve(process.env.SCHEDULE_POPOVER_EXPORT || '.next-desktop');
const output = path.resolve(process.env.SCHEDULE_POPOVER_OUTPUT || 'artifacts/desktop-release-v0.2.29/schedule-popover-final');
fs.mkdirSync(output, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.txt': 'text/x-component', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let file = path.resolve(directory, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(directory + path.sep) && file !== directory) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const owner = '00000000-0000-4000-8000-000000000009';
const todos = [{ id: 'synthetic-popover-todo', text: '合成回归：准备申请材料', date: '2026-10-09', category: '申请', type: '材料准备', priority: '重要不紧急', note: '仅用于本地浏览器回归，不提交真实数据。', completed: false, createdAt: '2026-10-09T00:00:00Z', updatedAt: '2026-10-09T00:00:00Z' }];
const result = { compiledSource: directory, generatedAt: new Date().toISOString(), syntheticOnly: true, productionRequests: 0, mockedRequests: [], blockedRequests: [], pageErrors: [], checks: [], configurations: [], passed: false };
const browser = await chromium.launch({ headless: true });
let currentPage;
let label = 'setup';
const triggerSelector = kind => `[class*="attributePickerTrigger"][data-${kind}]`;
const openSelector = '[popover]:popover-open';
const settle = page => page.waitForTimeout(250);

function domState() {
  const rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const detail = document.querySelector('#schedule-detail-pane');
  return {
    viewport: { width: innerWidth, height: innerHeight },
    zoom: document.querySelector('.desktop-app-shell')?.getAttribute('data-zoom-level'),
    detailOpen: !!detail && detail.getAttribute('aria-hidden') === 'false' && !detail.inert,
    createTitleCount: document.querySelectorAll('[data-schedule-create-title]').length,
    active: { tag: document.activeElement?.tagName, id: document.activeElement?.id, category: document.activeElement?.getAttribute('data-category'), priority: document.activeElement?.getAttribute('data-priority') },
    popovers: [...document.querySelectorAll('[popover]:popover-open')].map(el => ({ id: el.id, rect: rect(el), scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, text: el.textContent?.trim().slice(0, 100) })),
    triggers: [...document.querySelectorAll('[class*="attributePickerTrigger"]')].map(el => ({ kind: el.hasAttribute('data-category') ? 'category' : 'priority', expanded: el.getAttribute('aria-expanded'), rect: rect(el) })),
    events: window.__popoverEvents || []
  };
}

async function checkOpen(page, name, kind, expectedId) {
  // Deliberately wait past rAF, focus, toggle and scroll dispatch. A transient
  // screenshot or an earlier visible state cannot satisfy these assertions.
  await settle(page);
  const state = await page.evaluate(domState);
  assert.equal(state.popovers.length, 1, `${name}: exactly one actual :popover-open required`);
  if (expectedId) assert.equal(state.popovers[0].id, expectedId, `${name}: same popover must remain open`);
  if (kind) {
    assert.equal(state.detailOpen, true, `${name}: detail remains open`);
    assert.equal(state.createTitleCount, 1, `${name}: unsaved create form remains mounted`);
    assert.equal(state.triggers.find(t => t.kind === kind)?.expanded, 'true', `${name}: trigger state agrees with native popover`);
  }
  const p = state.popovers[0];
  assert.ok(p.rect.width > 0 && p.rect.height > 0, `${name}: visible surface required`);
  assert.ok(p.rect.left >= -1 && p.rect.top >= -1 && p.rect.right <= state.viewport.width + 1 && p.rect.bottom <= state.viewport.height + 1, `${name}: viewport bounds ${JSON.stringify(p.rect)}`);
  assert.ok(p.scrollWidth <= p.clientWidth + 1, `${name}: no horizontal content clipping`);
  result.checks.push({ name, state });
  return state;
}

async function escapeOnlyPopover(page, name, kind) {
  const before = await page.evaluate(domState);
  assert.equal(before.popovers.length, 1, `${name}: must start with an open popover`);
  await page.keyboard.press('Escape');
  await settle(page);
  const after = await page.evaluate(domState);
  assert.equal(after.popovers.length, 0, `${name}: first Escape closes popover`);
  assert.equal(after.detailOpen, true, `${name}: first Escape must not close detail`);
  assert.equal(after.createTitleCount, 1, `${name}: draft remains mounted`);
  assert.equal(await page.locator(triggerSelector(kind)).evaluate(el => document.activeElement === el), true, `${name}: focus returns to matching trigger`);
  result.checks.push({ name, before, after });
}

async function scrollOutside(page, name, kind, expectedId) {
  const scroll = await page.locator(triggerSelector(kind)).evaluate(trigger => {
    const candidates = [];
    for (let el = trigger.parentElement; el; el = el.parentElement) {
      if (el.scrollHeight - el.clientHeight > 16 && /auto|scroll/.test(getComputedStyle(el).overflowY)) candidates.push(el);
    }
    const el = candidates[0];
    if (!el) return { changed: false, reason: 'No scrolling ancestor' };
    const before = el.scrollTop;
    const beforeRect = trigger.getBoundingClientRect();
    const delta = before > 12 ? -8 : 8;
    el.scrollTop += delta;
    return { changed: el.scrollTop !== before, target: el.className, before, after: el.scrollTop, anchorBefore: { top: beforeRect.top, bottom: beforeRect.bottom }, anchorAfter: { top: trigger.getBoundingClientRect().top, bottom: trigger.getBoundingClientRect().bottom } };
  });
  assert.equal(scroll.changed, true, `${name}: actual outer scroll must occur: ${JSON.stringify(scroll)}`);
  const state = await checkOpen(page, name, kind, expectedId);
  result.checks.push({ name: `${name}-scroll-evidence`, scroll, state });
}

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 960, height: 640 }]) {
    const config = { ...viewport, zoom: 200 };
    label = `${viewport.width}x${viewport.height}-zoom200`;
    result.configurations.push(config);
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
    await context.addInitScript(() => {
      localStorage.setItem('seekoffer-desktop-preferences-v1', JSON.stringify({ version: 1, theme: 'light', reduceMotion: true, zoomLevel: 200, launchDestination: 'last' }));
      sessionStorage.setItem('seekoffer-desktop-launch-applied-v1', 'true');
      let callback = 0;
      window.__TAURI_INTERNALS__ = { metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } }, transformCallback: () => ++callback, unregisterCallback: () => {}, invoke: async command => {
        if (command === 'native_auth_session') return { accessToken: 'SYNTHETIC_POPOVER_TEST', subject: 'audit', email: 'audit@example.invalid', sessionId: 'synthetic-audit', expiresAt: Date.now() / 1000 + 3600 };
        if (command === 'plugin:window|inner_size') return { width: innerWidth, height: innerHeight };
        if (command === 'plugin:window|scale_factor') return 1;
        if (command === 'plugin:window|is_maximized' || command === 'plugin:autostart|is_enabled') return false;
        if (command === 'plugin:updater|check') return null;
        if (command === 'plugin:app|version') return '0.2.29';
        if (command === 'native_public_request') return { items: [], pagination: { page: 1, pageSize: 16, total: 0, totalPages: 1 }, stats: { total2026: 0, todayUpdates: 0, deadlineWithin3Days: 0 }, facets: {}, sideData: {}, servedAt: new Date().toISOString() };
        return 1;
      }};
      window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
      window.__popoverEvents = [];
      for (const type of ['toggle', 'scroll']) document.addEventListener(type, event => {
        const el = event.target;
        window.__popoverEvents.push({ type, at: performance.now(), target: el instanceof Element ? el.className : 'document', oldState: event.oldState, newState: event.newState, openCount: document.querySelectorAll('[popover]:popover-open').length });
        if (window.__popoverEvents.length > 35) window.__popoverEvents.shift();
      }, true);
    });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === base) return route.continue();
      if (url.origin !== 'https://migration.seekoffer.com.cn') { result.blockedRequests.push(`${url.origin}${url.pathname}`); return route.abort(); }
      let body;
      if (url.pathname === '/v1/me/profile') body = { id: owner, nickname: '合成界面验收', age: '', undergraduate_school: '', major: '', grade: '大四', target_major: '', target_region: '', sync_revision: 1 };
      else if (url.pathname === '/v1/me/applications') body = { items: [], nextCursor: null };
      else if (url.pathname === '/v1/me/notices/by-ids') body = { items: [], unavailableIds: [] };
      else if (url.pathname === '/v1/me/workbench') body = route.request().method() === 'PUT' ? { sync_revision: 2 } : { user_id: owner, completed_todo_ids: [], custom_todos: todos, mentor_contacts: [], sync_revision: 1 };
      else if (url.pathname === '/v1/me/billing') body = { entitlement: { user_id: owner, plan_id: null, status: 'free', starts_at: null, expires_at: null }, isPro: false, applicationCount: 0, freeLimit: 5, plans: [] };
      else { result.blockedRequests.push(`${url.origin}${url.pathname}`); return route.abort(); }
      result.mockedRequests.push({ method: route.request().method(), path: url.pathname });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    const page = currentPage = await context.newPage();
    page.on('pageerror', error => result.pageErrors.push(error.stack));
    await page.goto(`${base}/me/?view=schedule`, { waitUntil: 'domcontentloaded' });
    await page.locator('[aria-label="日程事项"] [role="listitem"]').first().waitFor({ timeout: 15000 });
    assert.equal(await page.locator('.desktop-app-shell').getAttribute('data-zoom-level'), '200');
    await page.locator('.desktop-page-header-actions').getByRole('button', { name: '新建日程', exact: true }).click();
    await page.locator('[data-schedule-create-title]').waitFor();
    await page.locator('#schedule-detail-pane summary').click();

    for (let cycle = 1; cycle <= 5; cycle++) {
      for (const kind of ['category', 'priority']) {
        const name = `${label}-cycle${cycle}-${kind}`;
        await page.locator(triggerSelector(kind)).click();
        await page.locator(openSelector).waitFor();
        const opened = await checkOpen(page, `${name}-stable`, kind);
        const id = opened.popovers[0].id;
        await scrollOutside(page, `${name}-external-scroll`, kind, id);
        if (cycle === 1) {
          await page.setViewportSize({ width: viewport.width + 40, height: viewport.height + 40 });
          await checkOpen(page, `${name}-resize-expanded`, kind, id);
          await page.setViewportSize(viewport);
          await checkOpen(page, `${name}-resize-restored`, kind, id);
          await page.screenshot({ path: path.join(output, `${label}-${kind}.png`) });
        }
        await escapeOnlyPopover(page, `${name}-escape1`, kind);
      }
    }
    // The preceding priority Escape is explicitly the first Escape; no click
    // or synthetic state change intervenes before the detail-level Escape.
    await page.keyboard.press('Escape');
    await settle(page);
    const closed = await page.evaluate(domState);
    assert.equal(closed.popovers.length, 0, `${label}: second Escape leaves no popover`);
    assert.equal(closed.detailOpen, false, `${label}: second Escape closes detail`);
    assert.equal(closed.createTitleCount, 0, `${label}: second Escape unmounts draft`);
    result.checks.push({ name: `${label}-escape2-closes-detail`, state: closed });

    await page.getByRole('button', { name: '筛选', exact: true }).click();
    await page.locator(openSelector).waitFor();
    const filters = await checkOpen(page, `${label}-filters-stable`);
    const internal = await page.locator(openSelector).evaluate(el => {
      const before = el.scrollTop;
      el.scrollTop = Math.min(el.scrollHeight - el.clientHeight, before + 20);
      return { before, after: el.scrollTop, maxScroll: el.scrollHeight - el.clientHeight };
    });
    result.checks.push({ name: `${label}-filter-internal-scroll-evidence`, internal });
    if (internal.maxScroll > 1) {
      assert.notEqual(internal.after, internal.before, `${label}: actual internal scroll required`);
      await checkOpen(page, `${label}-filter-internal-scroll-stable`, undefined, filters.popovers[0].id);
    }
    await page.keyboard.press('Escape');
    await settle(page);
    assert.equal(await page.locator(openSelector).count(), 0);
    await context.close();
  }
  // The compact picker can legitimately fit without an internal scrollbar at
  // a given zoom/viewport. When it overflows, the branch above verifies that
  // scrolling its own surface does not dismiss it.
  assert.equal(result.pageErrors.length, 0, 'No uncaught browser runtime errors');
  assert.equal(result.mockedRequests.some(request => request.method !== 'GET'), false, 'Regression must not even submit synthetic writes');
  result.passed = true;
} catch (error) {
  result.failure = { label, message: error.stack };
  if (currentPage && !currentPage.isClosed()) {
    result.failure.state = await currentPage.evaluate(domState).catch(() => null);
    await currentPage.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  }
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  console.log(JSON.stringify({ passed: result.passed, configurations: result.configurations, checks: result.checks.length, pageErrors: result.pageErrors.length, output }));
}
