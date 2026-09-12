import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const site = 'https://www.seekoffer.com.cn', api = 'https://migration.seekoffer.com.cn';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
function requireValue(value, error) { if (!value) throw Error(error); }

// Anonymous, read-only verification with fixed hosts, bounded payloads and no
// random cache-busting. A concurrent version change gets one retry; 402 gets none.
export async function verifyNoticeWebsite({fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms))} = {}) {
  const requests = [];
  async function read(url, limit = 512000) {
    const response = await fetchImpl(url, {headers: {Accept: 'application/json'}, redirect: 'error', signal: AbortSignal.timeout(20000)});
    const record = {path: new URL(url).pathname, status: response.status,
      rowsRead: response.headers.has('x-d1-rows-read') ? Number(response.headers.get('x-d1-rows-read')) : null,
      rowsWritten: response.headers.has('x-d1-rows-written') ? Number(response.headers.get('x-d1-rows-written')) : null,
      cache: response.headers.get('x-public-count-cache') || response.headers.get('x-public-metadata-cache')};
    requests.push(record);
    if (!response.ok) { await response.body?.cancel(); throw Error('WEBSITE_HTTP_' + response.status); }
    const chunks = []; let size = 0;
    const reader = response.body.getReader();
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length;
      if (size > limit) { await reader.cancel(); throw Error('WEBSITE_PAYLOAD_BOUND'); } chunks.push(part.value); } }
    finally { reader.releaseLock(); }
    record.bytes = size;
    requireValue(record.rowsWritten === null || record.rowsWritten === 0, 'VERIFICATION_WRITE_DETECTED');
    return {data: JSON.parse(Buffer.concat(chunks)), record};
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const before = (await read(api + '/v1/public/notice-overrides')).data;
      requireValue(uuid.test(before.version), 'INVALID_SOURCE_VERSION');
      const first = await read(site + '/api/public/notices/?page=1&pageSize=16&sort=publish', 100 * 1024);
      const page = first.data;
      requireValue(Array.isArray(page.items) && page.items.length <= 16 && Number.isSafeInteger(page.pagination?.total), 'INVALID_WEBSITE_PAGE');
      if (page.metadataVersion !== before.version) throw Error('PUBLIC_VERSION_CHANGED');
      requireValue(page.items.length === Math.min(16, page.pagination.total), 'WEBSITE_PAGE_INCOMPLETE');
      requireValue(page.items.every((n, i) => typeof n.id === 'string' && !n.id.startsWith('custom-') &&
        !Object.keys(n).some(k => /^(admin|created_by|createdBy|requirements|historyRecords|history_records|change_log|password|email|secret)/i.test(k)) &&
        (i === 0 || page.items[i - 1].publishDate >= n.publishDate)), 'PUBLIC_SORT_OR_FIELD_BOUNDARY');
      const metadata = (await read(site + '/api/public/notices/metadata/?section=summary&version=' + encodeURIComponent(before.version))).data;
      requireValue(metadata.version === before.version && metadata.stats?.total2026 === page.pagination.total, 'WEBSITE_METADATA_MISMATCH');
      let detailChecked = false;
      if (page.items.length) {
        const detail = (await read(site + '/api/public/notice-detail/?id=' + encodeURIComponent(page.items[0].id), 1000000)).data;
        requireValue(detail.id === page.items[0].id, 'WEBSITE_DETAIL_MISMATCH');
        detailChecked = true;
      }
      const after = (await read(api + '/v1/public/notice-overrides')).data;
      if (after.version !== before.version) throw Error('PUBLIC_VERSION_CHANGED');
      const warm = await read(site + '/api/public/notices/?page=1&pageSize=16&sort=publish', 100 * 1024);
      if (warm.data.metadataVersion !== before.version) throw Error('PUBLIC_VERSION_CHANGED');
      requireValue(warm.data.pagination.total === page.pagination.total, 'WEBSITE_COUNT_CHANGED_WITHOUT_VERSION');
      requireValue(warm.record.rowsRead !== null && warm.record.rowsRead <= 4, 'WEBSITE_WARM_READ_BOUND');
      return {at: new Date().toISOString(), state: 'WEBSITE_SYNC_VERIFIED', version: before.version,
        total: page.pagination.total, latestDate: page.items[0]?.publishDate || null,
        listBytes: first.record.bytes, detailChecked, warmCache: warm.record.cache, requests,
        rowsRead: requests.reduce((n, r) => n + (r.rowsRead || 0), 0), accountDataRead: false};
    } catch (error) {
      if (attempt === 0 && ['PUBLIC_VERSION_CHANGED','WEBSITE_HTTP_409'].includes(error.message)) { await sleep(1000); continue; }
      throw error;
    }
  }
  throw Error('WEBSITE_VERSION_UNSTABLE');
}

async function main() {
  let report;
  try { report = await verifyNoticeWebsite(); }
  catch (error) { report = {at: new Date().toISOString(), state: 'WEBSITE_SYNC_FAILED', code: /^[A-Z_0-9]+$/.test(error.message) ? error.message : 'READ_VERIFICATION_FAILED'}; process.exitCode = 1; }
  if (process.env.NOTICE_WEBSITE_RECEIPT_PATH) fs.writeFileSync(process.env.NOTICE_WEBSITE_RECEIPT_PATH, JSON.stringify(report, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### D1 → production website\n\nStatus: **${report.state}**\n\n` + (report.code ? `Error: ${report.code}\n` :
      `Public notices: ${report.total}; newest publication: ${report.latestDate}; version: ${report.version}.\n\n` +
      `16-row payload: ${report.listBytes} bytes; detail checked: ${report.detailChecked}; warm cache: ${report.warmCache}; reported reads: ${report.rowsRead}.\n\nNo login, private account access, build, deployment or database writes are performed by this check.\n`));
  console.log(JSON.stringify(report));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
