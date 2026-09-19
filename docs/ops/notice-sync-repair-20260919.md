# Notice ingestion / public index repair — 2026-09-19

## Incident

Scheduled `Sync notices to D1` runs on `main` were failing repeatedly. Run
`35439122141` stopped ingestion at `INVALID_SOURCE_URL` after 125 batches, with
2,637 candidates remaining. The separate public website verification then failed
with `PUBLIC_READ_UNAVAILABLE` / `PUBLIC_REFRESH_BACKOFF` (HTTP 503).

These are distinct failures; a website verification error does not undo D1 writes.
Email notifications and the hourly schedule remain enabled.

## Repairs

- The D1 transport quarantines malformed source/application links for private
  review, preserves the original value in private remarks, and permits other
  notices to proceed. It does not invent replacement links or relax server-side
  validation. Existing hidden/rejected moderation is retained.
- The deployed public index no longer performs Cache API match/query/put calls
  for each 80-row shard. A cold refresh uses read-only 500-row D1 pages, bounded
  at 40 pages, and checks the authoritative version before publishing its result.
  Hidden/private/deleted records remain excluded and failures remain fail-closed.
  Warm responses still check the current version.

## Release records

- Ingestion fix on main: `424c1abe07bd0b802300307ec950d03c824dcb9f`.
- Frontend repair source: branch `codex/notice-index-repair-20260919`, commit
  `d19f157` (separate production migration lineage; do not merge the entire old
  migration branch into main merely to apply this isolated fix).
- Frontend Worker: `seekoffer-next15-compatibility`.
- Previous version: `15a1bd72-0c0a-4aef-9a70-75043bd410ef`.
- Repaired version: `5bbde4b5-f8dd-4d54-bef5-4c62aa6bff5f` (100%).
- Entry SHA-256: `81bb515d019d44230816fb3f82c0b22cc85fa9fe7ec88787da40a287de8fdc34`.
- All 45 non-entry modules were hash-verified unchanged. Existing assets,
  database binding, secrets, live mode, routes and separate API Worker were kept.

## Verification

- 23 ingestion transport / website verification tests passed.
- Old cache loop reproduced `Too many subrequests` at request 51.
- New cold refresh: 5,001 changes / 13 requests; 19,999 changes / 42 requests;
  warm refresh / 1 request; zero database writes in capacity tests.
- 32 SQL filter/sort parity cases passed, including hidden-version invalidation
  for lists, by-ID reads and sitemaps, plus fail-closed database failure tests.
- Live verification after deployment: `WEBSITE_SYNC_VERIFIED`, 8,924 public
  notices, newest publication 2026-09-19; list, metadata and detail all HTTP 200,
  warm cache HIT, no transient retry required.
- End-to-end GitHub run: https://github.com/fjsfry/seekoffer-v1/actions/runs/35439968557
  (consult its final status and receipt; the initial website count above precedes
  this ingestion run and is not its final imported count).

## Operational guardrails

Do not disable cron/email, accept stale versions as success, increase retry loops
to mask persistent failures, erase invalid-source notices, or relax private-data
filters. Keep the normal bounded quota/backoff behavior. The local deployment
script refuses an unexpected starting version or a second ambiguous attempt.
