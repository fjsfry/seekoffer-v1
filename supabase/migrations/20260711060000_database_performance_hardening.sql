create index if not exists ai_waitlist_leads_user_id_idx
  on public.ai_waitlist_leads (user_id);
create index if not exists billing_orders_plan_id_idx
  on public.billing_orders (plan_id);
create index if not exists notices_created_by_idx
  on public.notices (created_by);
create index if not exists user_entitlements_plan_id_idx
  on public.user_entitlements (plan_id);
create index if not exists user_entitlements_source_order_id_idx
  on public.user_entitlements (source_order_id);

alter policy profiles_select_own on public.profiles
  using ((select auth.uid()) = id);
alter policy profiles_insert_own on public.profiles
  with check ((select auth.uid()) = id);
alter policy profiles_update_own on public.profiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists notices_select_public on public.notices;
drop policy if exists notices_select_private_owner on public.notices;

create policy notices_select_public
on public.notices
for select
to anon
using (
  not is_private
  and coalesce(admin_status, 'published') = 'published'
  and admin_deleted_at is null
);

create policy notices_select_authenticated
on public.notices
for select
to authenticated
using (
  (
    not is_private
    and coalesce(admin_status, 'published') = 'published'
    and admin_deleted_at is null
  )
  or (
    is_private
    and created_by = (select auth.uid())
  )
);

alter policy notices_insert_manual on public.notices
  with check (
    created_by = (select auth.uid())
    and is_private = true
    and source_site = '用户手动录入'
  );
alter policy notices_update_manual on public.notices
  using (
    created_by = (select auth.uid())
    and is_private = true
    and source_site = '用户手动录入'
  )
  with check (
    created_by = (select auth.uid())
    and is_private = true
    and source_site = '用户手动录入'
  );
alter policy notices_delete_manual on public.notices
  using (
    created_by = (select auth.uid())
    and is_private = true
    and source_site = '用户手动录入'
  );

alter policy applications_select_own on public.applications
  using ((select auth.uid()) = user_id);
alter policy applications_insert_own on public.applications
  with check ((select auth.uid()) = user_id);
alter policy applications_update_own on public.applications
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy applications_delete_own on public.applications
  using ((select auth.uid()) = user_id);

alter policy ai_waitlist_select_own on public.ai_waitlist_leads
  using (user_id = (select auth.uid()));
alter policy ai_waitlist_insert_public on public.ai_waitlist_leads
  with check (
    length(trim(wechat_id)) between 2 and 80
    and primary_need in ('申请风险评估', '材料短板提示', '提炼简章要求')
    and length(trim(details)) <= 800
    and source = 'ai-page'
    and (user_id is null or user_id = (select auth.uid()))
  );

alter policy billing_orders_select_own on public.billing_orders
  using ((select auth.uid()) = user_id);
alter policy user_entitlements_select_own on public.user_entitlements
  using ((select auth.uid()) = user_id);

alter policy feedback_reports_insert_public on public.feedback_reports
  with check (
    (user_id is null or (select auth.uid()) = user_id)
    and type in ('feedback', 'report')
    and module in ('system', 'notice', 'offer', 'user', 'billing', 'admin')
    and status = 'pending'
    and length(trim(target_id)) <= 120
    and length(trim(content)) between 8 and 1200
  );

alter policy ai_positioning_reports_select_own on public.ai_positioning_reports
  using ((select auth.uid()) = user_id);
alter policy ai_positioning_reports_insert_own on public.ai_positioning_reports
  with check (
    (select auth.uid()) = user_id
    and source = 'ai-page'
    and jsonb_typeof(profile_snapshot) = 'object'
    and jsonb_typeof(input_snapshot) = 'object'
    and jsonb_typeof(report) = 'object'
    and length(coalesce(report ->> 'summary', '')) between 20 and 1200
  );
alter policy ai_positioning_reports_delete_own on public.ai_positioning_reports
  using ((select auth.uid()) = user_id);
