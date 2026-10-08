# Public notices and workbench synchronization repair

Released 2026-10-09 (Asia/Shanghai). No plan upgrade, quota reset, application deletion, or order mutation.

## Confirmed causes

- `/v1/notices` returned 503 `READ_BUDGET_EXHAUSTED`, not a provider D1 outage. The discretionary counter was 2,417,812 with a 2,500,000 limit and fixed 100,000 reservation. Normal list pages shared that allowance.
- The publish-date index did not match the JSON source-rank tiebreaker. Filtered page hydration could also choose the year index instead of the primary key: a 16-item page read 10,353 rows.
- Filtered count expiration was capped by potentially expired aggregate metadata, allowing repeated refreshes. Counts and each page scanned independently.
- `saveWorkbenchState` defaulted to revision zero on every save. Existing cloud workbenches returned 409 `REVISION_CONFLICT`, reproduced in the actual logged-in browser.

## Changes

- Added an exact public feed index and a separate bounded browsing allowance (500,000 guarded rows/day).
- Search scans have a 1,000,000-row allowance; discretionary reporting/aggregation is limited to 1,500,000. These are application protection budgets, not a meter for all account-wide D1 operations. Identity, transactions, other point reads, ingestion and other databases still consume provider quota.
- A filtered search caches ordered IDs once for all its pages. It uses a five-minute TTL (one minute for time-sensitive queries), shared leases and finite error cooldowns. A search cache hit hydrates only the selected IDs with an explicit primary-key index, rechecking publication/privacy and current filter predicates.
- Ordinary page caches follow the notice version; equivalent filter URLs share edge keys. New bounded cache storage is additive and expired successful entries are removed in small batches.
- Browser fallback expires after 30 seconds instead of five minutes. A recent last-good result for the same query is retained and labelled during a transient failure. Detail 401/403/404 responses do not revive a bundled notice. Stale summary statistics are shown as unknown, not as current-day values; expired reminders are not advertised as upcoming.
- Workbench writes are serialized per owner, use acknowledged revisions, skip unchanged writes and retry revision conflicts at most twice after reading and merging cloud state. Local tombstones and completion changes survive synchronization. Account-owner headers reject a queued request if the active account changed.
- The workbench preserves edits made while hydration is running, has finite exponential retry and reconnect retry, and offers a manual retry action. Its status describes only the data actually covered by that sync path.

## Validation

- API typecheck and 70 API regression tests passed: 37 quota/runtime, 22 payment, 11 commerce.
- Frontend typecheck, targeted ESLint and 19 focused frontend tests passed.
- Production Next.js build completed; static isolation check passed for 565 HTML files. One pre-existing resource-order image lint warning remains unrelated.
- Real API checks: default page 200 with 33 rows read; equivalent edge hit 200 with zero reads; cached filtered page 200 with 38 reads, down from 10,353 before forcing the primary key.
- The user's existing 8 applications remain visible. Actual workbench GET returned 200 (3 reads). An offline completion-toggle test used an existing test-labelled schedule item, restored its original incomplete state before reconnecting, and verified automatic recovery with PUT 200 (5 reads). No test schedule/contact was inserted or deleted.
- Desktop and 390px mobile layouts checked without horizontal overflow. Network emulation and viewport overrides restored.
- Two older unavailable notice references remain as preserved application placeholders; publication restrictions were not bypassed to make them appear available.

## Deployment

- D1: `seekoffer-core` (`531486a7-f140-488e-8759-f77d885124f3`). Applied only `0013_public_notice_feed.sql`: 30,883 reads / 10,352 writes, three statements. Existing runtime counters retained.
- Worker: `seekoffer-api-isolated-preview`, production custom domain `migration.seekoffer.com.cn`, version `b9631033-0a8f-4dff-b5bd-b4375f6cca6d`.
- Website: Vercel `seekoffer-v1`, deployment `dpl_4ThSnkYk3NbR3aRHQ3StzwGnPbzu`, promoted after authenticated smoke checks.
- Frontend was built from the existing production release directory `E:/Codex/项目/商业项目/SeekOffer/推免星/seekoffer-web/artifacts/web-pro-release-20261008`. The five changed frontend files were verified against the canonical base before copying. The dirty desktop checkout was not deployed.
- Screenshots: `E:/Codex/项目/商业项目/SeekOffer/推免星/seekoffer-web/artifacts/cloud-resilience-20261009/`.

## Operational boundaries

These changes reduce and isolate repeat reads; they do not promise unlimited free-tier traffic. An exhausted search allowance can still reject a new expensive filter while normal cached browsing and private synchronization remain independent. If Cloudflare's account-wide hard limit is reached, uncached D1 operations still fail until the provider resets it. The previous day's discretionary allowance was already spent when this repair was released, so aggregate statistics may remain stale until the UTC reset; the live list is available independently.

Do not deploy the unrelated desktop working tree or clear runtime counters as an incident workaround. Database additions are backward compatible; rollback can retain the index/cache table. The immediately preceding frontend deployment was `dpl_FmsABsM3t4iGnqbMghBvwYggYo9c` and the preceding Worker version was `ea8f5ac3-deb2-4073-91fb-ba5d2daaceb7`.
