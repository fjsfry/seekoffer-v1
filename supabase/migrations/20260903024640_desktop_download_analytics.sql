-- Applied to production as migration 20260903024640.
create table if not exists public.desktop_download_attempts (
  id bigint generated always as identity primary key,
  attempt_id uuid not null,
  release_version text not null,
  platform text not null,
  source text not null,
  created_at timestamptz not null default now(),
  constraint desktop_download_attempts_attempt_id_key unique (attempt_id),
  constraint desktop_download_attempts_release_version_check check (
    length(release_version) between 1 and 32
    and release_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'
  ),
  constraint desktop_download_attempts_platform_check check (
    platform = 'windows_x86_64'
  ),
  constraint desktop_download_attempts_source_check check (
    source = 'website_download_page'
  )
);

comment on table public.desktop_download_attempts is
  'Private, append-only website desktop download-start attempts. This is not proof of a completed download or installation.';

create index if not exists desktop_download_attempts_created_at_idx
  on public.desktop_download_attempts (created_at desc);

create index if not exists desktop_download_attempts_release_created_at_idx
  on public.desktop_download_attempts (release_version, created_at desc);

alter table public.desktop_download_attempts enable row level security;
alter table public.desktop_download_attempts force row level security;

revoke all on table public.desktop_download_attempts from public, anon, authenticated, service_role;
grant select, insert on table public.desktop_download_attempts to service_role;

revoke all on sequence public.desktop_download_attempts_id_seq from public, anon, authenticated, service_role;
grant usage on sequence public.desktop_download_attempts_id_seq to service_role;

create or replace function public.seekoffer_record_desktop_download_attempt(
  p_attempt_id uuid,
  p_release_version text,
  p_platform text,
  p_source text
)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  was_inserted boolean := false;
begin
  if p_attempt_id is null then
    raise exception 'attempt_id is required' using errcode = '22023';
  end if;

  if p_release_version is null
    or length(p_release_version) not between 1 and 32
    or p_release_version !~ '^[0-9]+\.[0-9]+\.[0-9]+$' then
    raise exception 'invalid release_version' using errcode = '22023';
  end if;

  if p_platform is distinct from 'windows_x86_64' then
    raise exception 'invalid platform' using errcode = '22023';
  end if;

  if p_source is distinct from 'website_download_page' then
    raise exception 'invalid source' using errcode = '22023';
  end if;

  with inserted_attempt as (
    insert into public.desktop_download_attempts (
      attempt_id,
      release_version,
      platform,
      source
    )
    values (
      p_attempt_id,
      p_release_version,
      p_platform,
      p_source
    )
    on conflict (attempt_id) do nothing
    returning 1
  )
  select exists(select 1 from inserted_attempt) into was_inserted;

  return was_inserted;
end;
$$;

revoke all on function public.seekoffer_record_desktop_download_attempt(uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.seekoffer_record_desktop_download_attempt(uuid, text, text, text)
  to service_role;

create or replace function public.seekoffer_get_desktop_download_metrics()
returns table (
  total bigint,
  today bigint,
  seven_days bigint,
  tracking_started_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with boundaries as (
    select
      date_trunc('day', timezone('Asia/Shanghai', now())) at time zone 'Asia/Shanghai'
        as beijing_today_start
  )
  select
    count(*)::bigint as total,
    count(*) filter (
      where attempts.created_at >= boundaries.beijing_today_start
    )::bigint as today,
    count(*) filter (
      where attempts.created_at >= boundaries.beijing_today_start - interval '6 days'
    )::bigint as seven_days,
    '2026-09-03 00:00:00+08'::timestamptz as tracking_started_at
  from public.desktop_download_attempts as attempts
  cross join boundaries;
$$;

revoke all on function public.seekoffer_get_desktop_download_metrics()
  from public, anon, authenticated, service_role;
grant execute on function public.seekoffer_get_desktop_download_metrics()
  to service_role;
