-- Make private admin tables explicitly deny client-role access.
-- Edge Functions use the service role and bypass RLS; browser clients should not read or write these tables directly.

drop policy if exists "admin_users_private_deny" on public.admin_users;
create policy "admin_users_private_deny"
on public.admin_users
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "admin_operation_logs_private_deny" on public.admin_operation_logs;
create policy "admin_operation_logs_private_deny"
on public.admin_operation_logs
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "admin_system_settings_private_deny" on public.admin_system_settings;
create policy "admin_system_settings_private_deny"
on public.admin_system_settings
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "user_moderation_private_deny" on public.user_moderation;
create policy "user_moderation_private_deny"
on public.user_moderation
for all
to anon, authenticated
using (false)
with check (false);
