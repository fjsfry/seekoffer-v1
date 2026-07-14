-- Restore the two registered users created while anonymous visitor tracking was unintentionally disabled.
with recovery_candidates as (
  select
    row_number() over (order by created_at, id) as recovery_index,
    created_at
  from public.profiles
  where created_at >= timestamptz '2026-07-13 16:00:00+00'
    and created_at <= timestamptz '2026-07-14 04:13:00+00'
  order by created_at, id
  limit 2
)
insert into public.site_visitors (
  visitor_id,
  first_seen_at,
  last_seen_at,
  last_path,
  last_locale,
  last_timezone,
  visit_count,
  page_view_count,
  created_at,
  updated_at
)
select
  'v_recovered_20260714_' || lpad(recovery_index::text, 2, '0'),
  created_at,
  created_at,
  '/',
  'zh-CN',
  'Asia/Shanghai',
  1,
  0,
  created_at,
  created_at
from recovery_candidates
on conflict (visitor_id) do nothing;
