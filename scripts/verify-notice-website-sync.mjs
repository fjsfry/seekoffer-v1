import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_SITE = 'https://www.seekoffer.com.cn';
const DEFAULT_API = 'https://migration.seekoffer.com.cn';

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

async function readJson(fetchImpl, url) {
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`WEBSITE_HTTP_${response.status}`);
  return response.json();
}

export async function verifyNoticeWebsite({
  fetchImpl = fetch,
  site = DEFAULT_SITE,
  api = DEFAULT_API
} = {}) {
  const list = await readJson(fetchImpl, `${api}/v1/notices?page=1&pageSize=16&sort=publish`);
  assert(Array.isArray(list.items), 'INVALID_WEBSITE_PAGE');
  assert(Number.isSafeInteger(list.pagination?.total), 'INVALID_WEBSITE_PAGINATION');
  assert(list.items.length <= 16, 'WEBSITE_PAGE_TOO_LARGE');
  assert(
    list.items.every((item, index) =>
      typeof item?.id === 'string' &&
      !Object.keys(item).some((key) => /^(admin|created_by|createdBy|password|secret)/i.test(key)) &&
      (index === 0 || String(list.items[index - 1].publishDate || '') >= String(item.publishDate || ''))
    ),
    'PUBLIC_SORT_OR_FIELD_BOUNDARY'
  );

  let detailChecked = false;
  if (list.items[0]) {
    const detail = await readJson(fetchImpl, `${api}/v1/notices/${encodeURIComponent(list.items[0].id)}`);
    assert(detail.id === list.items[0].id, 'WEBSITE_DETAIL_MISMATCH');
    assert(!Object.keys(detail).some((key) => /^(admin|created_by|createdBy|password|secret)/i.test(key)), 'PRIVATE_FIELD_EXPOSED');
    detailChecked = true;
  }

  const warm = await readJson(fetchImpl, `${api}/v1/notices?page=1&pageSize=16&sort=publish`);
  assert(warm.pagination?.total === list.pagination.total, 'WEBSITE_COUNT_CHANGED');
  return {
    at: new Date().toISOString(),
    state: 'WEBSITE_SYNC_VERIFIED',
    total: list.pagination.total,
    latestDate: list.items[0]?.publishDate || null,
    detailChecked,
    site,
    api
  };
}

async function main() {
  let report;
  try {
    report = await verifyNoticeWebsite();
  } catch (error) {
    report = {
      at: new Date().toISOString(),
      state: 'WEBSITE_SYNC_FAILED',
      code: /^[A-Z_0-9]+$/.test(error?.message || '') ? error.message : 'READ_VERIFICATION_FAILED'
    };
    process.exitCode = 1;
  }
  if (process.env.NOTICE_WEBSITE_RECEIPT_PATH) {
    fs.writeFileSync(process.env.NOTICE_WEBSITE_RECEIPT_PATH, JSON.stringify(report, null, 2), { mode: 0o600 });
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### D1 → production website\n\nStatus: **${report.state}**\n\n` +
        (report.code
          ? `Error: ${report.code}\n`
          : `Public notices: ${report.total}; newest publication: ${report.latestDate}; detail checked: ${report.detailChecked}.\n\nThis check is anonymous and read-only.\n`)
    );
  }
  console.log(JSON.stringify(report));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
