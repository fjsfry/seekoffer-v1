create table if not exists public.billing_plans (
  id text primary key,
  name text not null,
  description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'CNY',
  duration_days integer not null check (duration_days > 0),
  benefits jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  is_recommended boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.billing_plans (
  id,
  name,
  description,
  price_cents,
  currency,
  duration_days,
  benefits,
  sort_order,
  is_recommended,
  is_active
)
values
  (
    'pro_monthly',
    'Pro 月度',
    '适合先体验完整申请工作台。',
    1900,
    'CNY',
    31,
    '["无限申请项目跟进","多节点截止提醒","材料清单进度管理","申请表导出能力"]'::jsonb,
    10,
    false,
    true
  ),
  (
    'pro_quarter',
    'Pro 季度',
    '覆盖夏令营、预推免高峰期，当前推荐方案。',
    4900,
    'CNY',
    93,
    '["无限申请项目跟进","7/3/1 天多节点提醒","材料清单自动拆解预留","日历与导出能力","通知变更提醒预留"]'::jsonb,
    20,
    true,
    true
  ),
  (
    'pro_yearly',
    'Pro 年度',
    '适合跨阶段持续管理申请和复盘。',
    12900,
    'CNY',
    366,
    '["全年无限申请项目","多节点提醒","材料清单与日历","导出与复盘报告预留","后续 Pro 新能力优先体验"]'::jsonb,
    30,
    false,
    true
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  duration_days = excluded.duration_days,
  benefits = excluded.benefits,
  sort_order = excluded.sort_order,
  is_recommended = excluded.is_recommended,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());

create table if not exists public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.billing_plans(id),
  provider text not null check (provider in ('wechat', 'alipay', 'manual')),
  out_trade_no text not null unique,
  provider_trade_no text not null default '',
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'CNY',
  status text not null default 'pending' check (
    status in ('pending', 'paid', 'failed', 'closed', 'refunded', 'expired')
  ),
  code_url text not null default '',
  checkout_url text not null default '',
  raw_request jsonb not null default '{}'::jsonb,
  raw_response jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  expires_at timestamptz not null default (timezone('utc', now()) + interval '30 minutes'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists billing_orders_user_created_idx on public.billing_orders (user_id, created_at desc);
create index if not exists billing_orders_status_idx on public.billing_orders (status, created_at desc);
create index if not exists billing_orders_out_trade_no_idx on public.billing_orders (out_trade_no);

create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text references public.billing_plans(id),
  status text not null default 'free' check (status in ('free', 'active', 'expired', 'cancelled')),
  starts_at timestamptz,
  expires_at timestamptz,
  source_order_id uuid references public.billing_orders(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_entitlements_status_idx on public.user_entitlements (status, expires_at desc);

drop trigger if exists set_billing_plans_updated_at on public.billing_plans;
create trigger set_billing_plans_updated_at
before update on public.billing_plans
for each row execute procedure public.seekoffer_set_updated_at();

drop trigger if exists set_billing_orders_updated_at on public.billing_orders;
create trigger set_billing_orders_updated_at
before update on public.billing_orders
for each row execute procedure public.seekoffer_set_updated_at();

drop trigger if exists set_user_entitlements_updated_at on public.user_entitlements;
create trigger set_user_entitlements_updated_at
before update on public.user_entitlements
for each row execute procedure public.seekoffer_set_updated_at();

alter table public.billing_plans enable row level security;
alter table public.billing_orders enable row level security;
alter table public.user_entitlements enable row level security;

drop policy if exists "billing_plans_select_public" on public.billing_plans;
create policy "billing_plans_select_public"
on public.billing_plans
for select
to anon, authenticated
using (is_active);

drop policy if exists "billing_orders_select_own" on public.billing_orders;
create policy "billing_orders_select_own"
on public.billing_orders
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_entitlements_select_own" on public.user_entitlements;
create policy "user_entitlements_select_own"
on public.user_entitlements
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.seekoffer_user_has_active_pro(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_entitlements entitlement
    where entitlement.user_id = target_user_id
      and entitlement.status = 'active'
      and (
        entitlement.expires_at is null
        or entitlement.expires_at > timezone('utc', now())
      )
  );
$$;
