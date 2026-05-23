grant usage on schema public to anon, authenticated;

revoke all privileges on public.offer_posts from anon, authenticated;
grant select on public.offer_posts to anon, authenticated;
grant insert (
  user_id,
  author_name,
  school_name,
  major,
  project_type,
  result,
  undergraduate_background,
  content,
  is_anonymous
) on public.offer_posts to authenticated;

drop policy if exists "offer_posts_insert_authenticated" on public.offer_posts;
create policy "offer_posts_insert_authenticated"
on public.offer_posts
for insert
to authenticated
with check (
  auth.uid() = user_id
  and review_status = 'pending'
  and hidden_at is null
  and deleted_at is null
  and reports_count = 0
  and length(trim(author_name)) between 1 and 80
  and length(trim(school_name)) between 1 and 80
  and length(trim(major)) between 1 and 80
  and project_type in ('夏令营', '预推免', '九推', '直博', '硕士', '博士', '其他')
  and result in ('录取', '放弃', '候补', '补录传闻', '官方确认')
  and length(trim(undergraduate_background)) between 1 and 120
  and length(trim(content)) between 12 and 1200
);

revoke all privileges on public.feedback_reports from anon, authenticated;
grant insert (
  user_id,
  type,
  module,
  target_id,
  content
) on public.feedback_reports to anon, authenticated;

drop policy if exists "feedback_reports_insert_public" on public.feedback_reports;
create policy "feedback_reports_insert_public"
on public.feedback_reports
for insert
to anon, authenticated
with check (
  (user_id is null or auth.uid() = user_id)
  and type in ('feedback', 'report')
  and module in ('system', 'notice', 'offer', 'user', 'billing', 'admin')
  and status = 'pending'
  and length(trim(target_id)) <= 120
  and length(trim(content)) between 8 and 1200
);

create schema if not exists private;

create or replace function private.seekoffer_increment_offer_report_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.type = 'report' and new.module = 'offer' and length(trim(new.target_id)) > 0 then
    update public.offer_posts
    set reports_count = reports_count + 1
    where id::text = new.target_id
      and deleted_at is null;
  end if;

  return new;
end;
$$;

revoke all on function private.seekoffer_increment_offer_report_count() from public, anon, authenticated;

drop trigger if exists increment_offer_report_count_on_feedback on public.feedback_reports;
create trigger increment_offer_report_count_on_feedback
after insert on public.feedback_reports
for each row execute function private.seekoffer_increment_offer_report_count();
