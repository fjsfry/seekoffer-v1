# Recovery notice override API repair — deployed 2026-09-23

The public recovery endpoint previously materialized `LIMIT 4001` records and
failed above 4,000 overrides. The hourly synchronization no longer depends on
this endpoint; the production serving-path repair is already on main. This
separate deployed repair removes the legacy endpoint's capacity failure.

## Candidate behavior

- Read at most 101 ordered keys for a 100-entry page through the runtime state's
  primary-key index. No catalog-wide scan, offset pagination, or snapshot warmup.
- Check both ingestion and visibility versions before and after database/cache
  reads. Reject stale requested versions with HTTP 409. Cache keys use a new v3
  namespace; old eager snapshots cannot be reused.
- Validate cache and D1 values against the public-field allowlist. Reject
  malformed cursors, private fields and oversized payloads. Public reads perform
  zero D1 writes.
- The prepared recovery consumer source restarts once on 409 and shares page,
  byte and elapsed-time budgets across attempts. It never returns partial data
  as complete. This source change was not included in the API-only deployment;
  the active website uses its independent D1 index.

The branch also contains the already released synchronization and receipt
changes so that its operational scripts remain consistent with main. Do not
merge the entire migration lineage into main or deploy its historical preview
configuration.

## Verified locally

From `workers/seekoffer-api`:

```powershell
npm run typecheck
npm run test:notice-overrides
```

The reader suite has 10 SQLite/contract cases and one self-contained actual
Worker/D1 integration case. At both 4,001 and 20,000 records, the real D1 test
measures 113 cold rows read, 8 warm rows read, 4 stale-version rows read, at most
4 cold queries, and zero public writes. Its query plan uses an indexed range
search; unrelated runtime-state sentinels never appear in responses.

The existing broader `scripts/migration/test-ingest-workerd.mjs` assertions are
updated for strict 409/restart semantics. That legacy harness could not run in
this isolated checkout because its Python launcher and exported remote-index
artifact were unavailable. The new integration case requires neither dependency.

## Deployment evidence and rollback

After explicit user authorization, the exact accepted live bundle was downloaded
and matched to its recorded SHA. Only `readNoticeOverrides` was replaced; the
rest of the JavaScript bundle remained byte-identical. The complete candidate
then passed an additional actual Workerd/D1 test, including authentication and
ingestion access boundaries. The full historical source tree was not deployed.

- Worker: `seekoffer-api-isolated-preview`; domain: `migration.seekoffer.com.cn`.
- Deployed at 2026-09-23 08:01:09 UTC (16:01:09 Asia/Shanghai).
- Current version: `75ee9fc3-7b9f-41f4-be36-2641d297e6b2`, 100%.
- Rollback version: `51db5cb4-19ac-4957-834b-1d44d2bccbef`.
- Previous entry SHA-256: `197f013356e21979a1ec8f2aff2a7bb991451e07ed1485a703fdcf309b7c4dc8`.
- Deployed entry SHA-256: `b956aa21cefb925598f7dc43cdaa14ffa8abba0d440d0a51f5682a0f54fcb991`.
- All 23 bindings, secret binding names, runtime settings, domains and routes
  matched before and after. Frontend version remained
  `5bbde4b5-f8dd-4d54-bef5-4c62aa6bff5f`. No D1 migration or production writes.

Anonymous post-deploy checks returned 200 for the first and continuation pages
(100 records each, 110 rows read), 200 for the warm page (6 rows read), and 409
`NOTICE_VERSION_CHANGED` for a stale version (3 rows read). Every measured
request reported zero writes. API health passed. The independent website check
also passed: 9,976 notices, latest date 2026-09-22, valid detail, warm HIT with one
D1 row read, zero retries.

A complete production traversal subsequently verified 4,110 records across 42
pages in 48.8 seconds, using 3,131,078 response bytes and 4,322 D1 rows read.
There were no duplicate IDs, mixed versions, non-progressing cursors or writes.
Every page stayed within 100 records and 81,502 bytes, including continuation
past the former 4,000-record failure boundary.

Local deployment receipts, module backups and synthetic test proof are retained
under ignored `artifacts/notice-api-deploy-20260923/`. The preparation and deploy
scripts refuse changed live versions/hashes, untested candidate hashes and
repeated deployment attempts. Do not rerun them to deploy unrelated work.

If a regression requires rollback, from `workers/seekoffer-api` use:

```powershell
npx wrangler rollback 51db5cb4-19ac-4957-834b-1d44d2bccbef --name seekoffer-api-isolated-preview --config wrangler.website-recovery.jsonc --message "Rollback notice overlay reader repair" --yes
```

Then recheck the website, bindings and routes. This restores the old recovery
endpoint capacity limitation but leaves the repaired hourly workflow independent
of that endpoint. Do not repeat ingestion as a read repair.
