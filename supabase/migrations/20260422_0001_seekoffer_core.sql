create extension if not exists pgcrypto;

create or replace function public.seekoffer_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '',
  age text not null default '',
  undergraduate_school text not null default '',
  major text not null default '',
  grade text not null default '大四',
  target_major text not null default '',
  target_region text not null default '',
  auth_provider text not null default 'email',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    nickname,
    auth_provider
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nickname', ''),
    coalesce(new.raw_app_meta_data ->> 'provider', 'email')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_seekoffer on auth.users;
create trigger on_auth_user_created_seekoffer
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

create table if not exists public.notices (
  id text primary key,
  school_name text not null,
  department_name text not null default '',
  project_name text not null,
  project_type text not null,
  discipline text not null default '',
  publish_date text not null default '',
  deadline_date text not null default '',
  event_start_date text not null default '',
  event_end_date text not null default '',
  apply_link text not null default '',
  source_link text not null default '',
  requirements text not null default '',
  materials_required text[] not null default '{}',
  exam_interview_info text not null default '',
  contact_info text not null default '',
  remarks text not null default '',
  tags text[] not null default '{}',
  status text not null default '报名中',
  year integer not null default 2026,
  deadline_level text not null default 'future',
  source_site text not null default '',
  is_private boolean not null default false,
  collected_at text not null default '',
  updated_at text not null default '',
  last_checked_at text not null default '',
  is_verified boolean not null default false,
  change_log jsonb not null default '[]'::jsonb,
  history_records jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at_ts timestamptz not null default timezone('utc', now())
);

create index if not exists notices_year_deadline_idx on public.notices (year, deadline_date);
create index if not exists notices_publish_date_idx on public.notices (publish_date desc);
create index if not exists notices_source_site_idx on public.notices (source_site);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null references public.notices(id) on delete cascade,
  is_favorited boolean not null default true,
  my_status text not null default '已收藏',
  priority_level text not null default '中',
  materials_progress integer not null default 0,
  cv_ready boolean not null default false,
  transcript_ready boolean not null default false,
  ranking_proof_ready boolean not null default false,
  recommendation_ready boolean not null default false,
  personal_statement_ready boolean not null default false,
  contact_supervisor_done boolean not null default false,
  submitted_at text not null default '',
  interview_time text not null default '',
  result_status text not null default '未出结果',
  my_notes text not null default '',
  custom_reminder_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint applications_user_project_unique unique (user_id, project_id)
);

create index if not exists applications_user_idx on public.applications (user_id, updated_at desc);
create index if not exists applications_project_idx on public.applications (project_id);

create table if not exists public.ai_waitlist_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  wechat_id text not null,
  primary_need text not null,
  details text not null default '',
  submitted_at_text text not null default '',
  source text not null default 'ai-page',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.crawler_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'cloudbase-sync',
  notices_received integer not null default 0,
  notices_upserted integer not null default 0,
  success boolean not null default false,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute procedure public.seekoffer_set_updated_at();

drop trigger if exists set_applications_updated_at on public.applications;
create trigger set_applications_updated_at
before update on public.applications
for each row execute procedure public.seekoffer_set_updated_at();

alter table public.profiles enable row level security;
alter table public.notices enable row level security;
alter table public.applications enable row level security;
alter table public.ai_waitlist_leads enable row level security;
alter table public.crawler_runs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "notices_select_public" on public.notices;
create policy "notices_select_public"
on public.notices
for select
to anon, authenticated
using (not is_private);

drop policy if exists "notices_select_private_owner" on public.notices;
create policy "notices_select_private_owner"
on public.notices
for select
to authenticated
using (is_private and created_by = auth.uid());

drop policy if exists "notices_insert_manual" on public.notices;
create policy "notices_insert_manual"
on public.notices
for insert
to authenticated
with check (
  created_by = auth.uid()
  and is_private = true
  and source_site = '用户手动录入'
);

drop policy if exists "notices_update_manual" on public.notices;
create policy "notices_update_manual"
on public.notices
for update
to authenticated
using (created_by = auth.uid() and is_private = true and source_site = '用户手动录入')
with check (created_by = auth.uid() and is_private = true and source_site = '用户手动录入');

drop policy if exists "notices_delete_manual" on public.notices;
create policy "notices_delete_manual"
on public.notices
for delete
to authenticated
using (created_by = auth.uid() and is_private = true and source_site = '用户手动录入');

drop policy if exists "applications_select_own" on public.applications;
create policy "applications_select_own"
on public.applications
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "applications_insert_own" on public.applications;
create policy "applications_insert_own"
on public.applications
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "applications_update_own" on public.applications;
create policy "applications_update_own"
on public.applications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "applications_delete_own" on public.applications;
create policy "applications_delete_own"
on public.applications
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "ai_waitlist_insert_public" on public.ai_waitlist_leads;
create policy "ai_waitlist_insert_public"
on public.ai_waitlist_leads
for insert
to anon, authenticated
with check (true);

drop policy if exists "ai_waitlist_select_own" on public.ai_waitlist_leads;
create policy "ai_waitlist_select_own"
on public.ai_waitlist_leads
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "crawler_runs_service_only" on public.crawler_runs;
create policy "crawler_runs_service_only"
on public.crawler_runs
for select
to authenticated
using (false);
