import {probeD1} from './d1-readiness-core.mjs';

const baseUrl = (process.env.API_BASE_URL || 'https://migration.seekoffer.com.cn').replace(/\/$/, '');
const receipt = await probeD1({baseUrl,secret:process.env.SEEKOFFER_INGEST_SECRET});
console.log(JSON.stringify(receipt));
if (process.env.D1_PREFLIGHT_RECEIPT_PATH) {
  await import('node:fs/promises').then(({writeFile}) => writeFile(process.env.D1_PREFLIGHT_RECEIPT_PATH, `${JSON.stringify(receipt)}\n`, 'utf8'));
}
if (process.env.GITHUB_OUTPUT) {
  await import('node:fs/promises').then(({appendFile}) => appendFile(process.env.GITHUB_OUTPUT, `ready=${receipt.ready}\nreason=${receipt.reason || ''}\n`, 'utf8'));
}
if (!receipt.ready) {
  // A free-tier quota response is an expected deferred state. Stop before
  // source acquisition and let the next scheduled run retry automatically.
  if (receipt.deferred) {
    process.stdout.write(`::warning::${receipt.reason}; notice sync deferred before crawling.\n`);
    process.exit(0);
  }
  throw new Error(receipt.reason);
}
