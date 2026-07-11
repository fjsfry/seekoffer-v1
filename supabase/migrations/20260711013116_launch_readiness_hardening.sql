alter table public.offer_posts
add column if not exists content_type text not null default 'offer',
add column if not exists title text not null default '',
add column if not exists category text not null default '',
add column if not exists is_official boolean not null default false,
add column if not exists source_label text not null default '',
add column if not exists comments_count integer not null default 0,
add column if not exists follows_count integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'offer_posts_content_type_check'
  ) then
    alter table public.offer_posts
      add constraint offer_posts_content_type_check
      check (content_type in ('offer', 'discussion'));
  end if;
end;
$$;

create index if not exists offer_posts_public_feed_idx
  on public.offer_posts (content_type, review_status, created_at desc)
  where hidden_at is null and deleted_at is null;

revoke select on public.offer_posts from anon, authenticated;
grant select (
  id,
  content_type,
  title,
  category,
  author_name,
  school_name,
  major,
  project_type,
  result,
  undergraduate_background,
  content,
  is_anonymous,
  is_official,
  source_label,
  comments_count,
  follows_count,
  reports_count,
  created_at
) on public.offer_posts to anon, authenticated;

create table if not exists public.offer_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.offer_posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null default '',
  content text not null default '',
  is_anonymous boolean not null default true,
  review_status text not null default 'approved',
  hidden_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists offer_comments_public_idx
  on public.offer_comments (post_id, review_status, created_at)
  where hidden_at is null and deleted_at is null;
create index if not exists offer_comments_user_idx
  on public.offer_comments (user_id, created_at desc);

create table if not exists public.offer_post_follows (
  post_id uuid not null references public.offer_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, user_id)
);

create index if not exists offer_post_follows_user_idx
  on public.offer_post_follows (user_id, created_at desc);

alter table public.offer_comments enable row level security;
alter table public.offer_post_follows enable row level security;

revoke all privileges on public.offer_comments from anon, authenticated;
grant select (
  id,
  post_id,
  author_name,
  content,
  is_anonymous,
  review_status,
  created_at,
  updated_at
) on public.offer_comments to anon, authenticated;
grant insert (post_id, user_id, author_name, content, is_anonymous)
  on public.offer_comments to authenticated;

drop policy if exists offer_comments_select_public on public.offer_comments;
create policy offer_comments_select_public
on public.offer_comments
for select
to anon, authenticated
using (review_status = 'approved' and hidden_at is null and deleted_at is null);

drop policy if exists offer_comments_insert_authenticated on public.offer_comments;
create policy offer_comments_insert_authenticated
on public.offer_comments
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and review_status = 'approved'
  and hidden_at is null
  and deleted_at is null
  and length(trim(author_name)) between 1 and 80
  and length(trim(content)) between 2 and 800
  and exists (
    select 1
    from public.offer_posts post
    where post.id = post_id
      and post.review_status = 'approved'
      and post.hidden_at is null
      and post.deleted_at is null
  )
);

revoke all privileges on public.offer_post_follows from anon, authenticated;
grant select, insert, delete on public.offer_post_follows to authenticated;

drop policy if exists offer_post_follows_select_own on public.offer_post_follows;
create policy offer_post_follows_select_own
on public.offer_post_follows
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists offer_post_follows_insert_own on public.offer_post_follows;
create policy offer_post_follows_insert_own
on public.offer_post_follows
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists offer_post_follows_delete_own on public.offer_post_follows;
create policy offer_post_follows_delete_own
on public.offer_post_follows
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke insert on public.offer_posts from authenticated;
grant insert (
  user_id,
  author_name,
  school_name,
  major,
  project_type,
  result,
  undergraduate_background,
  content,
  is_anonymous,
  content_type,
  title,
  category
) on public.offer_posts to authenticated;

drop policy if exists offer_posts_insert_authenticated on public.offer_posts;
create policy offer_posts_insert_authenticated
on public.offer_posts
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and content_type in ('offer', 'discussion')
  and review_status = 'pending'
  and hidden_at is null
  and deleted_at is null
  and reports_count = 0
  and comments_count = 0
  and follows_count = 0
  and is_official = false
  and source_label = ''
  and length(trim(author_name)) between 1 and 80
  and length(trim(school_name)) between 1 and 80
  and length(trim(major)) between 1 and 80
  and length(trim(content)) between 12 and 1200
  and (
    (
      content_type = 'offer'
      and project_type in ('夏令营', '预推免', '九推', '直博', '硕士', '博士', '其他')
      and result in ('录取', '放弃', '候补', '补录传闻', '官方确认')
      and length(trim(undergraduate_background)) between 1 and 120
      and title = ''
      and category = ''
    )
    or
    (
      content_type = 'discussion'
      and length(trim(title)) between 4 and 120
      and category in ('选校定位', '材料准备', '导师联系', '面试经验', 'Offer选择', '候补动态', '其他')
      and length(trim(undergraduate_background)) <= 120
    )
  )
);

create or replace function private.seekoffer_refresh_offer_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_post_id uuid;
begin
  if tg_op = 'DELETE' then
    target_post_id := old.post_id;
  else
    target_post_id := new.post_id;
  end if;

  update public.offer_posts
  set comments_count = (
    select count(*)::integer
    from public.offer_comments comment
    where comment.post_id = target_post_id
      and comment.review_status = 'approved'
      and comment.hidden_at is null
      and comment.deleted_at is null
  )
  where id = target_post_id;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function private.seekoffer_refresh_offer_comment_count() from public, anon, authenticated;

drop trigger if exists refresh_offer_comment_count on public.offer_comments;
create trigger refresh_offer_comment_count
after insert or update or delete on public.offer_comments
for each row execute function private.seekoffer_refresh_offer_comment_count();

create or replace function private.seekoffer_refresh_offer_follow_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_post_id uuid;
begin
  if tg_op = 'DELETE' then
    target_post_id := old.post_id;
  else
    target_post_id := new.post_id;
  end if;

  update public.offer_posts
  set follows_count = (
    select count(*)::integer
    from public.offer_post_follows follow_row
    where follow_row.post_id = target_post_id
  )
  where id = target_post_id;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function private.seekoffer_refresh_offer_follow_count() from public, anon, authenticated;

drop trigger if exists refresh_offer_follow_count on public.offer_post_follows;
create trigger refresh_offer_follow_count
after insert or delete on public.offer_post_follows
for each row execute function private.seekoffer_refresh_offer_follow_count();

drop trigger if exists set_offer_comments_updated_at on public.offer_comments;
create trigger set_offer_comments_updated_at
before update on public.offer_comments
for each row execute procedure public.seekoffer_set_updated_at();

insert into public.offer_posts (
  author_name,
  school_name,
  major,
  project_type,
  result,
  undergraduate_background,
  content,
  is_anonymous,
  review_status,
  review_note,
  reviewed_by,
  reviewed_at,
  content_type,
  title,
  category,
  is_official,
  source_label
)
select
  seed.author_name,
  seed.school_name,
  seed.major,
  '',
  '',
  '',
  seed.content,
  false,
  'approved',
  '官方社区引导内容',
  'system',
  timezone('utc', now()),
  'discussion',
  seed.title,
  seed.category,
  true,
  '寻鹿整理'
from (
  values
    (
      '寻鹿内容组',
      '通用讨论',
      '申请规划',
      '第一次参加夏令营，应该如何判断项目是否值得投？',
      '选校定位',
      '建议先核对项目方向、导师团队、培养方式和时间冲突，再结合自己的排名、科研与材料完成度确定优先级。讨论时请尽量说明本科层次、专业排名区间和目标方向，方便其他同学给出有效建议。'
    ),
    (
      '寻鹿内容组',
      '通用讨论',
      '材料准备',
      '个人陈述和科研经历怎样避免写成流水账？',
      '材料准备',
      '可以用问题、行动、结果和反思四段式整理科研经历。重点说明你解决了什么问题、具体承担了什么工作，以及这段经历如何影响后续研究方向。请勿在公开讨论中上传身份证、手机号或未脱敏材料。'
    ),
    (
      '寻鹿内容组',
      '通用讨论',
      'Offer选择',
      '拿到多个 Offer 后，应该按哪些维度比较？',
      'Offer选择',
      '建议至少比较导师匹配、培养方式、研究资源、去向、城市成本和承诺期限。不要只比较学校名称；公开交流时请区分学院官方信息、本人反馈和未经确认的群消息。'
    )
) as seed(author_name, school_name, major, title, category, content)
where not exists (
  select 1
  from public.offer_posts existing
  where existing.content_type = 'discussion'
    and existing.is_official = true
    and existing.title = seed.title
    and existing.deleted_at is null
);

alter table public.workbench_states
add column if not exists mentor_contacts jsonb not null default '[]'::jsonb;

create index if not exists admin_users_user_id_idx on public.admin_users (user_id);
create index if not exists feedback_reports_user_id_idx on public.feedback_reports (user_id);

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.seekoffer_record_analytics(
  p_visitor_id text,
  p_session_id text,
  p_event_type text,
  p_path text,
  p_title text,
  p_referrer text,
  p_locale text,
  p_timezone text,
  p_user_agent text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  should_count_pageview boolean := false;
begin
  if p_visitor_id !~ '^v_[A-Za-z0-9_-]{16,90}$'
    or p_session_id !~ '^s_[A-Za-z0-9_-]{16,90}$'
    or p_event_type not in ('pageview', 'heartbeat') then
    raise exception 'invalid_analytics_payload';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_visitor_id || ':' || p_session_id, 0));

  should_count_pageview := p_event_type = 'pageview' and not exists (
    select 1
    from public.site_visit_events recent
    where recent.visitor_id = p_visitor_id
      and recent.session_id = p_session_id
      and recent.path = left(p_path, 320)
      and recent.event_type = 'pageview'
      and recent.created_at >= now() - interval '5 seconds'
  );

  insert into public.site_visitors (
    visitor_id,
    first_seen_at,
    last_seen_at,
    last_path,
    last_title,
    last_referrer,
    last_locale,
    last_timezone,
    last_user_agent,
    first_session_id,
    last_session_id,
    visit_count,
    page_view_count,
    created_at,
    updated_at
  ) values (
    p_visitor_id,
    now(),
    now(),
    left(p_path, 320),
    left(p_title, 180),
    left(p_referrer, 320),
    left(p_locale, 40),
    left(p_timezone, 80),
    left(p_user_agent, 420),
    p_session_id,
    p_session_id,
    1,
    case when should_count_pageview then 1 else 0 end,
    now(),
    now()
  )
  on conflict (visitor_id) do update set
    last_seen_at = excluded.last_seen_at,
    last_path = excluded.last_path,
    last_title = excluded.last_title,
    last_referrer = excluded.last_referrer,
    last_locale = excluded.last_locale,
    last_timezone = excluded.last_timezone,
    last_user_agent = excluded.last_user_agent,
    visit_count = public.site_visitors.visit_count + case
      when public.site_visitors.last_session_id is distinct from excluded.last_session_id then 1
      else 0
    end,
    page_view_count = public.site_visitors.page_view_count + case when should_count_pageview then 1 else 0 end,
    last_session_id = excluded.last_session_id,
    updated_at = excluded.updated_at;

  if should_count_pageview then
    insert into public.site_visit_events (
      visitor_id,
      session_id,
      event_type,
      path,
      title,
      referrer,
      locale,
      timezone
    ) values (
      p_visitor_id,
      p_session_id,
      'pageview',
      left(p_path, 320),
      left(p_title, 180),
      left(p_referrer, 320),
      left(p_locale, 40),
      left(p_timezone, 80)
    );
  end if;
end;
$$;

revoke all on function public.seekoffer_record_analytics(text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.seekoffer_record_analytics(text, text, text, text, text, text, text, text, text)
  to service_role;

create or replace function private.seekoffer_purge_expired_analytics()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.site_visit_events
  where created_at < timezone('utc', now()) - interval '180 days';

  delete from public.site_visitors
  where last_seen_at < timezone('utc', now()) - interval '180 days';
end;
$$;

revoke all on function private.seekoffer_purge_expired_analytics() from public, anon, authenticated;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'seekoffer-analytics-retention'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'seekoffer-analytics-retention',
    '23 3 * * *',
    'select private.seekoffer_purge_expired_analytics();'
  );
end;
$$;

drop policy if exists workbench_states_select_own on public.workbench_states;
create policy workbench_states_select_own
on public.workbench_states
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists workbench_states_insert_own on public.workbench_states;
create policy workbench_states_insert_own
on public.workbench_states
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists workbench_states_update_own on public.workbench_states;
create policy workbench_states_update_own
on public.workbench_states
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists workbench_states_delete_own on public.workbench_states;
create policy workbench_states_delete_own
on public.workbench_states
for delete
to authenticated
using ((select auth.uid()) = user_id);
