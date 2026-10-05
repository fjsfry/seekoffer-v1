const baseUrl = (process.env.API_BASE_URL || 'https://migration.seekoffer.com.cn').replace(/\/$/, '');
const response = await fetch(`${baseUrl}/v1/resources/products`, {headers: {Accept: 'application/json'}, cache: 'no-store', redirect: 'error'});
const detail = {status: response.status, rowsRead: response.headers.get('x-d1-rows-read'), requestId: response.headers.get('x-request-id')};
const receipt = {event: 'd1_readiness_preflight', checkedAt: new Date().toISOString(), baseUrl, ...detail, ready: response.ok, reason: response.ok ? null : response.status === 402 ? 'D1_SERVICE_QUOTA_EXCEEDED' : `D1_READINESS_HTTP_${response.status}`};
console.log(JSON.stringify(receipt));
if (process.env.D1_PREFLIGHT_RECEIPT_PATH) {
  await import('node:fs/promises').then(({writeFile}) => writeFile(process.env.D1_PREFLIGHT_RECEIPT_PATH, `${JSON.stringify(receipt)}\n`, 'utf8'));
}
if (process.env.GITHUB_OUTPUT) {
  await import('node:fs/promises').then(({appendFile}) => appendFile(process.env.GITHUB_OUTPUT, `ready=${receipt.ready}\nreason=${receipt.reason || ''}\n`, 'utf8'));
}
if (!response.ok) {
  // A free-tier quota response is an expected deferred state. Stop before
  // source acquisition and let the next scheduled run retry automatically.
  if (response.status === 402) {
    process.stdout.write('::warning::D1 free-tier read quota is exhausted; notice sync deferred before crawling.\n');
    process.exit(0);
  }
  throw new Error(receipt.reason);
}
