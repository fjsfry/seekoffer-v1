# GitHub Actions notice sync

SeekOffer runs the public notice crawler on GitHub Actions and writes validated
records to the Cloudflare D1 Worker ingestion endpoint. The website reads the
same D1 projection, so a successful run is immediately available without a
frontend redeploy.

## Required GitHub secrets

Add these secrets in GitHub:

- `SEEKOFFER_INGEST_SECRET`: must match the `SEEKOFFER_INGEST_SECRET` Worker secret on `migration.seekoffer.com.cn`.

Optional:

- `SEEKOFFER_INGEST_URL`: defaults to `https://migration.seekoffer.com.cn/v1/internal/ingest-notices`.
- `SECONDARY_REPAIR_DETAIL_IDS`: optional comma-separated 保研信息网 article IDs to force re-fetch by detail API during full reconciliation.

## Schedule

The workflow runs incrementally once every hour at minute 20. GitHub cron uses
UTC. A bounded full reconciliation runs at `18:10 UTC` (02:10 Beijing time)
to repair historical records without putting the full crawl on the hot path.

It can also be started manually from GitHub Actions:

1. Open the repository on GitHub.
2. Go to `Actions`.
3. Select `Sync notices to Cloudflare D1`.
4. Click `Run workflow`.

For a smoke test, set:

- `primary_max_pages`: `1`
- `primary_max_details`: `5`
- `dry_run`: `true`

For production, leave the max fields empty and keep `dry_run` unchecked. Use
`sync_mode=full` only for an operator-requested reconciliation.

## Data flow

```text
GitHub Actions schedule
  -> scripts/sync-baoyan-notices-to-d1.mjs
  -> Cloudflare Worker: /v1/internal/ingest-notices
  -> Cloudflare D1: main__notices
  -> website reads published notices
```

## Notes

- Secrets must not be committed to the repository.
- The crawler orders source data by publish time, so recent notices are picked up first.
- The script filters obvious test data and non-baoyan competition notices before ingestion.
- Full reconciliation also re-fetches known historical 保研信息网 detail records whose list cards were not covered by the latest page window, so repaired school names can overwrite older weak rows.
- Every run uploads a sanitized receipt as a short-lived GitHub Actions artifact; credentials, tokens, and notice body content are excluded.
- The ingestion endpoint rejects requests without the shared secret and applies the D1 transaction atomically.
