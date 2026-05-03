# GitHub Actions notice sync

Seekoffer can run the public notice crawler on GitHub Actions and write the parsed result into Supabase through the existing `ingest-notices` Edge Function.

## Required GitHub secrets

Add these secrets in GitHub:

- `SUPABASE_PROJECT_REF`: your Supabase project ref, for example `mnotoltpythkayguhnrk`.
- `SUPABASE_INGEST_SECRET`: must be the same value as the Supabase Edge Function secret `SEEKOFFER_INGEST_SECRET` / `SUPABASE_INGEST_SECRET`.

Optional:

- `SUPABASE_INGEST_URL`: only needed if the ingest endpoint is not the default `https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/ingest-notices`.

## Schedule

The workflow runs once every hour, at minute 20. GitHub cron uses UTC, so this is still hourly in Beijing time.

It can also be started manually from GitHub Actions:

1. Open the repository on GitHub.
2. Go to `Actions`.
3. Select `Sync notices to Supabase`.
4. Click `Run workflow`.

For a smoke test, set:

- `primary_max_pages`: `1`
- `primary_max_details`: `5`
- `dry_run`: `true`

For production, leave the max fields empty and keep `dry_run` unchecked.

## Data flow

```text
GitHub Actions schedule
  -> scripts/sync-baoyan-notices-to-supabase.mjs
  -> Supabase Edge Function: ingest-notices
  -> Supabase table: notices
  -> website reads published notices
```

## Notes

- Secrets must not be committed to the repository.
- The crawler orders source data by publish time, so recent notices are picked up first.
- The script filters obvious test data and non-baoyan competition notices before ingestion.
