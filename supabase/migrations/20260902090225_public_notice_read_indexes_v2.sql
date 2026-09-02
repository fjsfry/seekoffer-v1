create index if not exists notices_public_feed_v2_idx
  on public.notices (year, publish_date desc, id asc)
  where is_private = false
    and admin_status = 'published'
    and admin_deleted_at is null;

create index if not exists notices_public_deadline_v2_idx
  on public.notices (year, deadline_date asc, id asc)
  where is_private = false
    and admin_status = 'published'
    and admin_deleted_at is null;
