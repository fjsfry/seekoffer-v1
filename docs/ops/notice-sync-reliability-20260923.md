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

## Separate recovery API deployment

The migration-lineage API has an independent deployed pagination repair:
constant-cost keyset pages and strict current-version validation replace eager
whole-snapshot materialization. Its legacy consumer must restart once on 409.
This Worker is separate from main. After explicit deployment authorization,
only the reader in the exact live release bundle was replaced, preserving every
other byte. Do not deploy the complete migration source tree or its historical
preview configuration; it includes unrelated unreleased features.

Deployment at 2026-09-23 08:01:09 UTC activated API version
`75ee9fc3-7b9f-41f4-be36-2641d297e6b2` at 100%. All bindings, secret binding
names, runtime settings, domains, routes and the separate frontend version
matched the preflight. Rollback version: `51db5cb4-19ac-4957-834b-1d44d2bccbef`.

The complete deployed candidate passed actual Workerd/D1 tests with 4,001 and
20,000 synthetic records and preserved authentication boundaries. Anonymous
production verification traversed all 4,110 overrides across 42 pages in 48.8
seconds: no duplicates, consistent version/cursors, maximum 100 records and
81,502 bytes per page, and zero database writes. The warm page read 6 D1 rows;
a stale requested version returned 409 after 3 reads. The independent website
check again passed for 9,976 notices, valid detail, and a one-row warm read.

The recovery consumer source has a bounded 409 restart and configurable
budgets, but was not deployed with this API-only change. The active production
website uses its independent D1 index.

## Operations

Inspect the final Actions summary and `notice-sync-<run>-<attempt>`
artifact first. A completed import remains completed even when the independent
website check fails. Do not disable the hourly schedule, suppress failures, or
raise retry loops to mask deterministic errors. Investigate the recorded stage
and error code; retain quota stop behavior. The next scheduled run reacquires
and idempotently reconciles the lookback window.

## Observed successful run

Run `35828484714` (commit `f03e7c20f977e83deca1d9d76b26f749d041e34b`) completed all
stages successfully on September 23 at 06:54:44 UTC. The sanitized receipt records
`SYNC_AND_WEBSITE_VERIFIED`: preflight and ingestion both succeeded, ingestion was
complete with 2,126 candidates in 355 batches, 3 notices changed, 1,397 were
unchanged, 726 were protected, zero remained, and D1 reported 4,278 reads and 33
writes. The newest source date was 2026-09-22.

The website check also succeeded with version
`3a9cec27-dfe0-4c00-83fd-c319d4f07bc0`, 9,976 public notices, newest publication
2026-09-22, detail verification enabled, zero transient retries, and all reported
write counters zero.
Its four bounded requests read 8,225 rows in total (8,223 cold list, one metadata,
one warm list; the detail endpoint reported no row counters). The receipt is retained
as artifact `notice-sync-35828484714-1` and contains no account data.

## Successful full synchronization after the API deployment

Run `35835292363` (commit `02e3d3b013b0ed7951212f4f24f958471e61e905`) completed
all stages on September 23 at 08:11 UTC. The receipt records 2,126 candidates in
355 batches: 24 upserts, 1,376 unchanged, 726 protected, zero remaining; D1 reported
133,116 rows read and 407 rows written by ingestion. Latest source date: 2026-09-23.

Website verification passed for 9,996 notices, latest publication 2026-09-23,
version `d25626f2-5c76-487c-8775-c66f192d870e`, valid detail and zero retries.
The warm request read one row. Public verification reported zero writes and
did not access accounts. Artifact `notice-sync-35835292363-1` retains the
sanitized end-to-end receipt for 14 days.
