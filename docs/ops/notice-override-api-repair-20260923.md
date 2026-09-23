# Recovery notice override API repair — prepared, not deployed

The public recovery endpoint previously materialized `LIMIT 4001` records and
failed above 4,000 overrides. The hourly synchronization no longer depends on
this endpoint; the production serving-path repair is already on main. This
separate candidate removes the legacy endpoint's capacity failure.

## Candidate behavior

- Read at most 101 ordered keys for a 100-entry page through the runtime state's
  primary-key index. No catalog-wide scan, offset pagination, or snapshot warmup.
- Check both ingestion and visibility versions before and after database/cache
  reads. Reject stale requested versions with HTTP 409. Cache keys use a new v3
  namespace; old eager snapshots cannot be reused.
- Validate cache and D1 values against the public-field allowlist. Reject
  malformed cursors, private fields and oversized payloads. Public reads perform
  zero D1 writes.
- Recovery consumers restart once on 409 and share page, byte and elapsed-time
  budgets across attempts. They never return partial catalog data as complete.

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

## Deployment boundary and rollback

This candidate has not been uploaded to Cloudflare. Automatic approval review
rejected a preflight that read Wrangler OAuth credentials and downloaded live
Worker modules/settings. The temporary inspection script has been deleted.

After authorization, inspect the currently deployed API version, routes,
bindings and module hashes using the authenticated deployment tooling. Preserve
the live settings and secrets, identify the exact live source baseline, and
apply only the reviewed reader change. Stop if that baseline differs from the
candidate's expected API integration. Record the previous version for rollback.

Validate the candidate in an isolated preview with synthetic D1 data, then
deploy the narrowly scoped API change. Verify a first page, continuation page,
warm page, and stale-version 409 on the public endpoint without user/account
reads or database writes. Verify the main website serving-path check still
passes. On regression, restore the recorded previous Worker version; do not
change the working hourly schedule or use repeat ingestion as a read repair.
