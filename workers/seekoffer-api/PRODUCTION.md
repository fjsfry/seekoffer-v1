# Production API and D1 read budget

The deployed API is `snapshot-worker.ts` with `wrangler.production.jsonc`.
The production source is tracked on `codex/online-reconciliation-20261005`.
Do not deploy an older local checkout or the legacy `index.ts` entry point.
The repository's `main` branch currently owns the scheduled ingestion scripts;
it is not the production API source. Do not merge unrelated frontend snapshots
just to update the API or its scheduled health checks.

## Release gate

From the repository root, use:

```sh
npm run deploy:production --prefix workers/seekoffer-api
```

The predeploy hook runs type checking, read-budget, payment and commerce tests.
The quota CI workflow also runs on changes to the Worker. Keep the API worktree
clean, commit the patch and push its production branch before deployment.

## Controls

- Notice admin statistics share one hourly scan across overview and list views.
- Public metadata is shared; default notice counts reuse that metadata.
- Equivalent public filters share their count-cache key.
- Optional large scans reserve 100,000 rows before executing. Reservations and
  actual row usage are shared atomically through `_runtime_state` across workers.
- The configured optional-scan budget is 2,500,000 rows/day. Indexed identity,
  per-user data, notice-ID and payment lookups remain available when it is spent.
- Uncertain failed scans keep their reservation. Failed cache refreshes back off.
- A confirmed provider incident can set `D1_QUOTA_PAUSE_UNTIL` to the known reset
  timestamp. Public cache hits remain available, while uncached public reads and
  ingestion defer without D1 access. This incident pause expires automatically;
  it must not be set as a permanent disable flag.
- Cache JSON must fit the database's 128 KiB constraint.
- All limits reset at UTC midnight, or 08:00 in Asia/Shanghai. Admin daily cards
  separately roll over at Beijing midnight.

The scan budget is a guard for the classified queries in this Worker, not an
account-wide Cloudflare billing meter or an absolute guarantee for arbitrary
traffic. Direct SQL, other Workers, point reads and write-trigger reads are not
all covered. A query exceeding its reservation emits a structured warning and
debits the measured cost. Keep headroom and inspect actual account usage.

## Verification

`GET /health` reports configuration only and performs no D1 reads.
`POST /v1/internal/d1-status` requires the existing ingestion secret, performs a
real one-row business-table read, one internal heartbeat write, and an indexed
budget lookup. It never uses HTTP/edge caching. A zero-row lookup or a successful
read alone is not proof that ingestion can write. Scheduled preflight must
use this endpoint, not the cached product or notice pages.

Administrators can query `{resource: "read_budget", action: "snapshot"}` through
the authenticated admin API. This reports guarded usage/reservations, remaining
budget and reset time; it is not the account's complete billable usage.

After quota recovery, verify uncached data, repeat-request edge hits, admin
snapshot reuse and D1 Insights. The highest-read queries should no longer be the
old repeated admin status, notice trend and lifetime visitor scans:

```sh
npx wrangler d1 insights seekoffer-core --config workers/seekoffer-api/wrangler.production.jsonc --sort-by reads --limit 15 --json
```

Do not issue repeated full exports, scans or rebuilds for monitoring. Do not log
admin tokens, ingestion secrets, raw bound parameters or personal profile data.
