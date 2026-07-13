create table if not exists public.wechat_daily_publications (
  digest_date date primary key,
  status text not null default 'preparing',
  notice_count integer not null default 0,
  included_notice_count integer not null default 0,
  notice_ids text[] not null default '{}',
  article_title text not null default '',
  article_digest text not null default '',
  content_source_url text not null default '',
  content_html text not null default '',
  wechat_media_id text not null default '',
  wechat_thumb_media_id text not null default '',
  error_code text not null default '',
  error_message text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint wechat_daily_publications_status_check
    check (status in ('preparing', 'dry_run', 'drafted', 'skipped', 'failed')),
  constraint wechat_daily_publications_notice_count_check
    check (notice_count >= 0 and included_notice_count >= 0 and included_notice_count <= notice_count)
);

create index if not exists wechat_daily_publications_status_created_idx
  on public.wechat_daily_publications (status, created_at desc);

alter table public.wechat_daily_publications enable row level security;

revoke all on table public.wechat_daily_publications from anon, authenticated;
revoke all on table public.wechat_daily_publications from service_role;
grant select, insert, update on table public.wechat_daily_publications to service_role;

comment on table public.wechat_daily_publications is
  'Private execution log and idempotency lock for the daily WeChat Official Account digest.';
