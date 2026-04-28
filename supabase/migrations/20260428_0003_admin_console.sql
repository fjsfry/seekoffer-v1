create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null default '',
  role text not null default 'ops_manager',
  status text not null default 'active',
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.notices
add column if not exists admin_status text not null default 'published',
add column if not exists admin_review_note text not null default '',
add column if not exists admin_reviewed_by text not null default '',
add column if not exists admin_reviewed_at timestamptz,
add column if not exists admin_deleted_at timestamptz;

create index if not exists notices_admin_status_idx on public.notices (admin_status, admin_deleted_at);

create table if not exists public.offer_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null default '',
  school_name text not null default '',
  major text not null default '',
  project_type text not null default '',
  result text not null default '',
  undergraduate_background text not null default '',
  content text not null default '',
  is_anonymous boolean not null default true,
  review_status text not null default 'pending',
  review_note text not null default '',
  reviewed_by text not null default '',
  reviewed_at timestamptz,
  hidden_at timestamptz,
  deleted_at timestamptz,
  reports_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists offer_posts_review_status_idx on public.offer_posts (review_status, created_at desc);
create index if not exists offer_posts_user_idx on public.offer_posts (user_id, created_at desc);

create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  type text not null default 'feedback',
  module text not null default 'system',
  target_id text not null default '',
  content text not null default '',
  status text not null default 'pending',
  handler text not null default '',
  handler_note text not null default '',
  handled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists feedback_reports_status_idx on public.feedback_reports (status, created_at desc);

create table if not exists public.user_moderation (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active',
  note text not null default '',
  updated_by text not null default '',
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_operation_logs (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null default '',
  action text not null,
  module text not null,
  target_id text not null default '',
  before_data jsonb not null default '{}'::jsonb,
  after_data jsonb not null default '{}'::jsonb,
  ip_address text not null default '',
  result text not null default 'success',
  remark text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_operation_logs_created_idx on public.admin_operation_logs (created_at desc);
create index if not exists admin_operation_logs_module_idx on public.admin_operation_logs (module, created_at desc);

create table if not exists public.admin_system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text not null default '',
  updated_by text not null default '',
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.admin_system_settings (key, value, description)
values
  ('content_review_enabled', 'true'::jsonb, '开启后，用户发布内容需要审核'),
  ('offer_submit_enabled', 'true'::jsonb, '开启后，用户可以提交 Offer 动态'),
  ('report_alert_enabled', 'true'::jsonb, '开启后，收到举报会显示提醒'),
  ('operation_log_retention_days', '180'::jsonb, '后台操作日志保留天数')
on conflict (key) do nothing;

insert into public.admin_users (email, name, role, status)
values ('admin@seekoffer.cn', 'admin', 'super_admin', 'active')
on conflict (email) do nothing;

drop trigger if exists set_admin_users_updated_at on public.admin_users;
create trigger set_admin_users_updated_at
before update on public.admin_users
for each row execute procedure public.seekoffer_set_updated_at();

drop trigger if exists set_offer_posts_updated_at on public.offer_posts;
create trigger set_offer_posts_updated_at
before update on public.offer_posts
for each row execute procedure public.seekoffer_set_updated_at();

drop trigger if exists set_feedback_reports_updated_at on public.feedback_reports;
create trigger set_feedback_reports_updated_at
before update on public.feedback_reports
for each row execute procedure public.seekoffer_set_updated_at();

alter table public.admin_users enable row level security;
alter table public.offer_posts enable row level security;
alter table public.feedback_reports enable row level security;
alter table public.user_moderation enable row level security;
alter table public.admin_operation_logs enable row level security;
alter table public.admin_system_settings enable row level security;

drop policy if exists "notices_select_public" on public.notices;
create policy "notices_select_public"
on public.notices
for select
to anon, authenticated
using (
  not is_private
  and coalesce(admin_status, 'published') = 'published'
  and admin_deleted_at is null
);

drop policy if exists "offer_posts_select_public_approved" on public.offer_posts;
create policy "offer_posts_select_public_approved"
on public.offer_posts
for select
to anon, authenticated
using (review_status = 'approved' and hidden_at is null and deleted_at is null);

drop policy if exists "offer_posts_insert_authenticated" on public.offer_posts;
create policy "offer_posts_insert_authenticated"
on public.offer_posts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "feedback_reports_insert_public" on public.feedback_reports;
create policy "feedback_reports_insert_public"
on public.feedback_reports
for insert
to anon, authenticated
with check (true);
