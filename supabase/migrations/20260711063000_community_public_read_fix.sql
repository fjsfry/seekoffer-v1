grant select (
  review_status,
  hidden_at,
  deleted_at
) on public.offer_posts to anon, authenticated;

grant select (
  hidden_at,
  deleted_at
) on public.offer_comments to anon, authenticated;
