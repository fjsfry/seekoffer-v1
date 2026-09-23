# Notice synchronization reliability — 2026-09-23

## Confirmed incident

Four scheduled runs failed from September 22 13:26 UTC through September 23
00:37 UTC. In run `35802877596`, acquisition processed 2,126 candidates in 355
batches, changed 6 notices, and returned `complete: true`, zero remaining.
The separate website check then received HTTP 503 three times from
`migration.seekoffer.com.cn/v1/public/notice-overrides`, each reporting 4,007
rows read. No ingestion rollback occurred.

That recovery API's implementation in the production migration lineage reads
`LIMIT 4001` and throws `SNAPSHOT_REFRESH_REQUIRED` above 4,000 entries. Retrying
cannot repair that deterministic capacity error. The production website already
uses the reviewed D1 index deployed on September 19, independent of that API.

## Changes on main

- Verify the actual production serving path: bounded 16-item list, live metadata
  with the requested version, a notice detail, and the warm list. Metadata rejects
  stale versions with 409; warm list must retain the same version, IDs, dates and
  count. Recovery shards are no longer downloaded just to read a version.
- Keep quota/authorization failures fatal. Temporary read retries remain bounded
  and share one budget across the complete check. No failed check is downgraded
  to success; no repeat ingestion is used to recover a website read.
- Validate both cold and warm pages, publication dates, duplicate IDs, private
  field boundaries, count, size, and the existing warm-read limit (at most four
  D1 rows). A 50,000-notice fixture uses the same four verification requests.
- Require authenticated D1 2xx receipts to account for every candidate as changed,
  unchanged or protected. Invalid receipts stop with `INVALID_INGEST_RECEIPT`
  rather than falsely reporting a completed import. Missing ingest credentials
  fail before contacting any acquisition source.
- Preserve individual stage outcomes and sanitized downloadable receipts in
  Actions. Failed acquisition and failed website verification remain distinct.

## Validation

Before release the patched public verifier passed against production: 9,976
public notices, latest publication 2026-09-22, detail verified, warm cache HIT
with one D1 row read, no writes and no transient retries.

Use `node --test tests/notice-d1-transport.test.mjs tests/notice-website-sync.test.mjs tests/notice-sync-run-report.test.mjs`
for the targeted regression suite. The workflow executes these before ingesting.

## Separate recovery API work

The migration-lineage API has an independent prepared pagination repair:
constant-cost keyset pages and strict current-version validation replace eager
whole-snapshot materialization. Its legacy consumer must restart once on 409.
This Worker is separate from main and must not be deployed with the obsolete
preview configuration or by merging the complete migration branch into main.
Main's repair does not claim to deploy or restore that legacy API.

The production preflight that reads Wrangler credentials and downloads live
Worker modules/settings was blocked by automatic approval review. A live API
change requires authorization for that preflight and a reviewed deployment
preserving the current modules, secrets, settings and routes.

## Operations

Inspect the final Actions summary and `notice-sync-<run>-<attempt>`
artifact first. A completed import remains completed even when the independent
website check fails. Do not disable the hourly schedule, suppress failures, or
raise retry loops to mask deterministic errors. Investigate the recorded stage
and error code; retain quota stop behavior. The next scheduled run reacquires
and idempotently reconciles the lookback window.
