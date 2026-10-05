const baseUrl = (process.env.API_BASE_URL || 'https://migration.seekoffer.com.cn').replace(/\/$/, '');

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {redirect: 'error', ...init});
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = {text: text.slice(0, 120)}; }
  return {status: response.status, body, headers: {requestId: response.headers.get('x-request-id'), rowsRead: response.headers.get('x-d1-rows-read')}};
}

const checks = [];
function check(name, ok, detail) {
  checks.push({name, ok, detail});
  console.log(JSON.stringify({event: 'payment_preflight_check', name, ok, detail}));
}

const health = await request('/health');
check('health', health.status === 200 && health.body?.status === 'ok' && health.body?.backend === 'd1', {status: health.status, backend: health.body?.backend || null, mode: health.body?.mode || null});

const products = await request('/v1/resources/products');
const quotaDeferred = products.status === 402 && products.body?.error === 'SERVICE_QUOTA_EXCEEDED';
if (quotaDeferred) {
  checks.push({name: 'published_products', ok: true, deferred: true, detail: {status: products.status, state: 'D1_SERVICE_QUOTA_EXCEEDED'}});
  console.log(JSON.stringify({event: 'payment_preflight_check', name: 'published_products', ok: true, deferred: true, detail: {status: products.status, state: 'D1_SERVICE_QUOTA_EXCEEDED'}}));
  console.log('::warning::D1 free-tier quota is exhausted; payment catalog verification deferred.');
} else {
  check('published_products', products.status === 200 && Array.isArray(products.body?.items), {status: products.status, count: Array.isArray(products.body?.items) ? products.body.items.length : 0});
}

// Deliberately unsigned and non-existent. The callback route must reject it
// before any payment/order state can be changed. This never reaches JianPay.
const callback = await request('/v1/payments/jianpay/notify', {
  method: 'POST',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify({clientNo: 'preflight', merchantOrderNo: 'RCP00000000PREFLIGHT', orderId: 'preflight-provider-order', amount: 1, status: 2, payMethod: 'wx', sign: '0'.repeat(32)})
});
check('unsigned_callback_rejected', [400, 401, 403].includes(callback.status), {status: callback.status});

const failed = checks.filter((item) => !item.ok);
const deferred = checks.filter((item) => item.deferred);
console.log(JSON.stringify({event: 'payment_preflight_summary', baseUrl, passed: checks.length - failed.length, deferred: deferred.length, failed: failed.length, checks}));
if (failed.length) process.exitCode = 1;
