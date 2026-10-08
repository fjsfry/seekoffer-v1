# Admin analytics recovery - 2026-10-08

## Root cause

The web visitor tracker posted no requestId and also sent heartbeat events.
The current Cloudflare endpoint requires a UUID requestId and accepts only
pageview events. Requests were rejected with HTTP 400 before database access.
The dashboard ignored available/coverage/reason and converted missing values to
zero, making an interrupted collector look like a healthy dashboard.

## Changes

- Frontend sends validated, bounded pageview payloads with UUID request IDs.
- Visible route visits only; no periodic heartbeat or background-tab collection.
- Strip query strings, fragments, referrer paths, and control characters.
- Session/browser identifiers retain their existing storage keys.
- Duplicate views within 30 seconds are suppressed. Backend receipts preserve
  idempotency and the original migrated event sequence.
- Rejected or failed collection requests impose a shared browser cooldown;
  reaching the daily event budget pauses collection until UTC midnight.
- Analytics snapshots include generatedAt, lastReceivedAt and budgetResetsAt.
  Old cache fallback is explicitly unavailable, including across Beijing midnight.
- Dashboard distinguishes unknown values from zero, retains successful data on
  partial failures, exposes snapshot timestamps and collection coverage, and
  removes the invalid user/visitor conversion calculation.
- Lifetime visitors, registered profiles and recently observed visitors are
  labeled independently. Recent visits are not described as real-time presence.
- Dashboard polls at most once a minute while visible. Admin shell no longer
  queries unused visitor metrics.
- Network failures have a Chinese user-facing message.

## Free-tier safeguards

No plan upgrade, new infrastructure, schema migration, or quota increase.
Production collection remains limited to 300 accepted events per UTC day.
Dashboard explicitly says this is incomplete collected traffic, not total traffic.
Historical missing pageviews cannot be reconstructed.

Existing hourly lifetime/overview aggregation and one-minute analytics caching
remain unchanged. Indexed visitor/time lookups remain in use.

Cloudflare pricing reference:
https://developers.cloudflare.com/d1/platform/pricing/

## Source and deployment

API source:
E:/Codex/data/worktrees/unified-commerce-pro/seekoffer-web

Production frontend source:
E:/Codex/项目/商业项目/SeekOffer/推免星/seekoffer-web/artifacts/web-pro-release-20261008

The five changed frontend files and admin-api error handling were also applied
to the existing pro-maturity-candidate-20261007 tree. Its experimental API changes
were not deployed. The unrelated dirty main/desktop workspace was not overwritten.
Do not deploy that main workspace as the web production baseline.

Cloudflare version: 1f7fd225-a8d9-4d28-953e-05c121d6179d.
Previous Cloudflare version: 488d5ae1-3426-4bc6-88c0-3327358dc114.
Previous production frontend: dpl_BZPHFcWuQeaogToWoTLfCRuQ9Sjm.
Final production frontend: dpl_V7t9LuCwG5CSr8yu8dTFiUNMT2Rc.
Deployment URL:
https://seekoffer-v1-53oe1wjf1-fjs1352256858-2004s-projects.vercel.app
Custom domain: https://www.seekoffer.com.cn/admin/dashboard/

## Verification

- 63 backend/contract regression tests pass (30 quota/analytics, 22 payment,
  11 resource-commerce).
- Frontend and Worker type checks pass; changed frontend files pass ESLint.
- Production frontend static build passes.
- A real browser navigation posted /v1/analytics: HTTP 200,
  recorded=true, deduplicated=false; response reported 15 D1 rows read.
- Dashboard subsequently showed one visitor and one pageview, with an updated
  collection timestamp. No synthetic production event or account was inserted.
- Offline refresh retained previous overview values and showed unavailable
  traffic metrics instead of fabricated zeros. The final version was rechecked
  and displayed the Chinese network error and retained-snapshot notice.
  Connectivity was restored and the dashboard refreshed successfully.
- Mobile viewport 390px has no document or metric-card horizontal overflow.
- Desktop viewport 1440px has no document horizontal overflow.
- At 18:12 Beijing time the live dashboard had received 4 visitors and 8 pageviews.
- Price remains CNY 9.90; no real payment was made.

Screenshots:
E:/Codex/项目/商业项目/SeekOffer/推免星/seekoffer-web/artifacts/admin-analytics-fix-20261008/

The recovery does not claim full visitor coverage while the 300-event safety
budget is in place, nor does it imply that an absence of new visits is a failure.
