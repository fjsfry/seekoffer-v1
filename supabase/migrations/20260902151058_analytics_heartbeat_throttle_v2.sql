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
set search_path = ''
as $$
declare
  should_count_pageview boolean := false;
  is_new_session boolean := false;
begin
  if p_visitor_id !~ '^v_[A-Za-z0-9_-]{16,90}$'
    or p_session_id !~ '^s_[A-Za-z0-9_-]{16,90}$'
    or p_event_type not in ('pageview', 'heartbeat') then
    raise exception 'invalid_analytics_payload';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_visitor_id || ':' || p_session_id, 0));

  is_new_session := p_event_type = 'pageview' and not exists (
    select 1
    from public.site_visit_events session_event
    where session_event.visitor_id = p_visitor_id
      and session_event.session_id = p_session_id
  );

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
      when is_new_session then 1
      else 0
    end,
    page_view_count = public.site_visitors.page_view_count + case when should_count_pageview then 1 else 0 end,
    last_session_id = excluded.last_session_id,
    updated_at = excluded.updated_at
  where p_event_type = 'pageview'
    or public.site_visitors.last_seen_at < now() - interval '2 minutes';

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
