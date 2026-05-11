create table if not exists public.site_visitors (
  visitor_id text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_path text not null default '',
  last_title text not null default '',
  last_referrer text not null default '',
  last_locale text not null default '',
  last_timezone text not null default '',
  last_user_agent text not null default '',
  first_session_id text not null default '',
  last_session_id text not null default '',
  visit_count integer not null default 1 check (visit_count >= 1),
  page_view_count integer not null default 0 check (page_view_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_visit_events (
  id bigserial primary key,
  visitor_id text not null references public.site_visitors(visitor_id) on delete cascade,
  session_id text not null default '',
  event_type text not null default 'pageview' check (event_type in ('pageview', 'heartbeat')),
  path text not null default '',
  title text not null default '',
  referrer text not null default '',
  locale text not null default '',
  timezone text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists site_visitors_last_seen_idx
  on public.site_visitors (last_seen_at desc);

create index if not exists site_visitors_first_seen_idx
  on public.site_visitors (first_seen_at desc);

create index if not exists site_visit_events_created_idx
  on public.site_visit_events (created_at desc);

create index if not exists site_visit_events_visitor_created_idx
  on public.site_visit_events (visitor_id, created_at desc);

alter table public.site_visitors enable row level security;
alter table public.site_visit_events enable row level security;

drop policy if exists site_visitors_private_deny on public.site_visitors;
create policy site_visitors_private_deny
  on public.site_visitors
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists site_visit_events_private_deny on public.site_visit_events;
create policy site_visit_events_private_deny
  on public.site_visit_events
  for all
  to anon, authenticated
  using (false)
  with check (false);
