# Seekoffer Web -> Supabase

This repository now contains the minimum migration assets needed to move the
Seekoffer Web frontend from CloudBase-backed auth/data to Supabase-backed
auth/data while keeping the CloudBase crawler as the hourly executor.

## What is included

- `supabase/migrations/20260422_0001_seekoffer_core.sql`
  Creates the core schema, indexes, RLS policies, and the automatic
  `profiles` trigger.
- `supabase/functions/ingest-notices/index.ts`
  The write entry used by the CloudBase crawler.
- `scripts/import-cloudbase-export-to-supabase.mjs`
  Imports exported CloudBase JSON into Supabase tables.

## Supabase project setup

1. Create a staging project and a production project.
2. In Auth:
   - Enable Email + Password.
   - Enable Email OTP / Magic Link.
   - Optionally enable Anonymous Sign-Ins if you want to preserve trial mode.
3. In Email:
   - Configure your verified Resend sender.
   - For the login panel's 6-digit code tab, edit the **Magic Link** template so
     the email contains `{{ .Token }}` and does not only rely on
     `{{ .ConfirmationURL }}`. Supabase sends a link when the template uses
     `{{ .ConfirmationURL }}`, and sends a 6-digit OTP when it uses
     `{{ .Token }}`.
   - Keep **Confirm sign up** as the first-registration confirmation email
     unless you also add a dedicated signup-code verification flow.
4. Run the SQL migration in the SQL editor.

## Environment variables

Frontend (`Vercel`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL=https://www.seekoffer.com.cn`
- `NEXT_PUBLIC_SUPABASE_ENABLE_ANONYMOUS=true`

Server / local scripts:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_INGEST_SECRET`

CloudBase crawler:

- `SUPABASE_INGEST_URL`
- `SUPABASE_INGEST_SECRET`

## Importing old CloudBase data

Export the old CloudBase collections first, then run:

```bash
npm run import:cloudbase-export -- ../exports/notices.json ../exports/web_user_workspace.json ../exports/user-map.json
```

`user-map.json` is required if you want to migrate old `web_user_workspace`
documents into the new Supabase user tables, because the old CloudBase user ids
do not match new `auth.users.id` values.

Format:

```json
{
  "old-cloudbase-user-id": "new-supabase-user-uuid"
}
```

## CloudBase crawler cutover

After deploying `ingest-notices`, set these CloudBase environment variables:

- `SUPABASE_INGEST_URL=https://<project-ref>.functions.supabase.co/ingest-notices`
- `SUPABASE_INGEST_SECRET=<same secret as Supabase function env>`

Then redeploy the CloudBase function so every hourly run writes into
`public.notices`.
