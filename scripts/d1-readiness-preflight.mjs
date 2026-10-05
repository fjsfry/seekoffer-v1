const baseUrl = (process.env.API_BASE_URL || 'https://migration.seekoffer.com.cn').replace(/\/$/, '');
const response = await fetch(`${baseUrl}/v1/resources/products`, {headers: {Accept: 'application/json'}, cache: 'no-store', redirect: 'error'});
const detail = {status: response.status, rowsRead: response.headers.get('x-d1-rows-read'), requestId: response.headers.get('x-request-id')};
console.log(JSON.stringify({event: 'd1_readiness_preflight', ...detail}));
if (!response.ok) {
  // Do not print the provider response body or any operational detail. The
  // next scheduled run will retry after the free-tier window resets.
  throw new Error(response.status === 402 ? 'D1_SERVICE_QUOTA_EXCEEDED' : `D1_READINESS_HTTP_${response.status}`);
}
