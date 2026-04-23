create table if not exists public.workbench_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  completed_todo_ids jsonb not null default '[]'::jsonb,
  custom_todos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_workbench_states_updated_at on public.workbench_states;
create trigger set_workbench_states_updated_at
before update on public.workbench_states
for each row execute procedure public.seekoffer_set_updated_at();

alter table public.workbench_states enable row level security;

drop policy if exists "workbench_states_select_own" on public.workbench_states;
create policy "workbench_states_select_own"
on public.workbench_states
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "workbench_states_insert_own" on public.workbench_states;
create policy "workbench_states_insert_own"
on public.workbench_states
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "workbench_states_update_own" on public.workbench_states;
create policy "workbench_states_update_own"
on public.workbench_states
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "workbench_states_delete_own" on public.workbench_states;
create policy "workbench_states_delete_own"
on public.workbench_states
for delete
to authenticated
using (auth.uid() = user_id);
