-- Applications may reference notices that are bundled from crawler snapshots
-- before the same notice has been mirrored into Supabase. Keep project_id
-- indexed, but do not hard-fail user actions when the public notice row is
-- temporarily absent from the notices table.
alter table public.applications
  drop constraint if exists applications_project_id_fkey;
