-- Harden admin-adjacent database primitives reported by Supabase Security Advisor.

create or replace function public.seekoffer_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop policy if exists "ai_waitlist_insert_public" on public.ai_waitlist_leads;
create policy "ai_waitlist_insert_public"
on public.ai_waitlist_leads
for insert
to anon, authenticated
with check (
  length(trim(wechat_id)) between 2 and 80
  and primary_need in ('申请风险评估', '材料短板提示', '提炼简章要求')
  and length(trim(details)) <= 800
  and source = 'ai-page'
  and (
    user_id is null
    or user_id = auth.uid()
  )
);

drop policy if exists "feedback_reports_insert_public" on public.feedback_reports;
create policy "feedback_reports_insert_public"
on public.feedback_reports
for insert
to anon, authenticated
with check (
  type in ('feedback', 'report')
  and module in ('system', 'notice', 'offer', 'user', 'billing', 'admin')
  and length(trim(content)) between 4 and 2000
  and length(trim(target_id)) <= 120
  and status = 'pending'
  and handler = ''
  and handler_note = ''
  and handled_at is null
  and (
    user_id is null
    or user_id = auth.uid()
  )
);

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'handle_new_user_profile'
      and p.pronargs = 0
  ) then
    revoke execute on function public.handle_new_user_profile() from public, anon, authenticated;
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
      and p.pronargs = 0
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'seekoffer_user_has_active_pro'
      and p.pronargs = 1
  ) then
    revoke execute on function public.seekoffer_user_has_active_pro(uuid) from public, anon, authenticated;
  end if;
end $$;
