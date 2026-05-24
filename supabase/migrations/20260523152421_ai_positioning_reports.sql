create table if not exists public.ai_positioning_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_snapshot jsonb not null default '{}'::jsonb,
  input_snapshot jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  source text not null default 'ai-page',
  created_at timestamptz not null default timezone('utc', now()),
  constraint ai_positioning_reports_source_check check (source = 'ai-page'),
  constraint ai_positioning_reports_report_check check (
    jsonb_typeof(report) = 'object'
    and length(coalesce(report ->> 'summary', '')) between 20 and 1200
  )
);

create index if not exists ai_positioning_reports_user_created_idx
on public.ai_positioning_reports (user_id, created_at desc);

alter table public.ai_positioning_reports enable row level security;

grant usage on schema public to authenticated;
revoke all privileges on public.ai_positioning_reports from anon, authenticated;
grant select, insert, delete on public.ai_positioning_reports to authenticated;

drop policy if exists "ai_positioning_reports_select_own" on public.ai_positioning_reports;
create policy "ai_positioning_reports_select_own"
on public.ai_positioning_reports
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "ai_positioning_reports_insert_own" on public.ai_positioning_reports;
create policy "ai_positioning_reports_insert_own"
on public.ai_positioning_reports
for insert
to authenticated
with check (
  auth.uid() = user_id
  and source = 'ai-page'
  and jsonb_typeof(profile_snapshot) = 'object'
  and jsonb_typeof(input_snapshot) = 'object'
  and jsonb_typeof(report) = 'object'
  and length(coalesce(report ->> 'summary', '')) between 20 and 1200
);

drop policy if exists "ai_positioning_reports_delete_own" on public.ai_positioning_reports;
create policy "ai_positioning_reports_delete_own"
on public.ai_positioning_reports
for delete
to authenticated
using (auth.uid() = user_id);
