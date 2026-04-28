-- ============================================================
-- 004_sms_usage_limits_and_warnings.sql
-- SMS usage tracking, plan limits, and threshold warning records.
-- Uses calendar-month periods for MVP.
-- ============================================================

begin;

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- sms_usage_events
-- ------------------------------------------------------------
create table if not exists public.sms_usage_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  thread_id uuid references public.inbox_threads(id) on delete set null,
  direction text not null,
  event_kind text not null,
  provider_sid text,
  from_phone text,
  to_phone text,
  body text,
  segment_count integer,
  created_at timestamptz not null default now()
);

alter table public.sms_usage_events
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists thread_id uuid references public.inbox_threads(id) on delete set null,
  add column if not exists direction text,
  add column if not exists event_kind text,
  add column if not exists provider_sid text,
  add column if not exists from_phone text,
  add column if not exists to_phone text,
  add column if not exists body text,
  add column if not exists segment_count integer,
  add column if not exists created_at timestamptz not null default now();

alter table public.sms_usage_events
  alter column created_at set default now();

alter table public.sms_usage_events
  drop constraint if exists sms_usage_events_direction_check;

alter table public.sms_usage_events
  add constraint sms_usage_events_direction_check
  check (direction in ('inbound', 'outbound'));

alter table public.sms_usage_events
  drop constraint if exists sms_usage_events_event_kind_check;

alter table public.sms_usage_events
  add constraint sms_usage_events_event_kind_check
  check (
    event_kind in (
      'inbound_customer_sms',
      'missed_call_auto_reply',
      'owner_notification',
      'quick_reply'
    )
  );

create index if not exists idx_sms_usage_events_tenant_created_at
  on public.sms_usage_events(tenant_id, created_at desc);

create index if not exists idx_sms_usage_events_tenant_direction_created_at
  on public.sms_usage_events(tenant_id, direction, created_at desc);

create index if not exists idx_sms_usage_events_tenant_kind_created_at
  on public.sms_usage_events(tenant_id, event_kind, created_at desc);

create index if not exists idx_sms_usage_events_provider_sid
  on public.sms_usage_events(provider_sid);

alter table public.sms_usage_events enable row level security;
alter table public.sms_usage_events force row level security;

drop policy if exists sms_usage_events_select on public.sms_usage_events;
drop policy if exists sms_usage_events_insert on public.sms_usage_events;
drop policy if exists sms_usage_events_update on public.sms_usage_events;
drop policy if exists sms_usage_events_delete on public.sms_usage_events;

create policy sms_usage_events_select
  on public.sms_usage_events
  for select
  using (tenant_id = public.auth_tenant_id());

create policy sms_usage_events_insert
  on public.sms_usage_events
  for insert
  with check (tenant_id = public.auth_tenant_id());

create policy sms_usage_events_update
  on public.sms_usage_events
  for update
  using (tenant_id = public.auth_tenant_id())
  with check (tenant_id = public.auth_tenant_id());

create policy sms_usage_events_delete
  on public.sms_usage_events
  for delete
  using (tenant_id = public.auth_tenant_id());

-- ------------------------------------------------------------
-- sms_plan_limits
-- ------------------------------------------------------------
create table if not exists public.sms_plan_limits (
  id uuid primary key default gen_random_uuid(),
  plan text not null unique,
  monthly_sms_limit integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sms_plan_limits
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_sms_plan_limits_plan
  on public.sms_plan_limits(plan);

drop trigger if exists trg_sms_plan_limits_updated_at on public.sms_plan_limits;

create trigger trg_sms_plan_limits_updated_at
before update on public.sms_plan_limits
for each row execute function public.set_updated_at();

insert into public.sms_plan_limits (plan, monthly_sms_limit)
values
  ('starter', 0),
  ('pro', 250),
  ('enterprise', 2000)
on conflict (plan) do nothing;

-- ------------------------------------------------------------
-- sms_usage_warnings
-- ------------------------------------------------------------
create table if not exists public.sms_usage_warnings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  period_start date not null,
  threshold_percent integer not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, period_start, threshold_percent)
);

alter table public.sms_usage_warnings
  add column if not exists sent_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

alter table public.sms_usage_warnings
  drop constraint if exists sms_usage_warnings_threshold_percent_check;

alter table public.sms_usage_warnings
  add constraint sms_usage_warnings_threshold_percent_check
  check (threshold_percent in (80, 95, 100));

create index if not exists idx_sms_usage_warnings_tenant_period
  on public.sms_usage_warnings(tenant_id, period_start desc);

alter table public.sms_usage_warnings enable row level security;
alter table public.sms_usage_warnings force row level security;

drop policy if exists sms_usage_warnings_select on public.sms_usage_warnings;
drop policy if exists sms_usage_warnings_insert on public.sms_usage_warnings;
drop policy if exists sms_usage_warnings_update on public.sms_usage_warnings;
drop policy if exists sms_usage_warnings_delete on public.sms_usage_warnings;

create policy sms_usage_warnings_select
  on public.sms_usage_warnings
  for select
  using (tenant_id = public.auth_tenant_id());

create policy sms_usage_warnings_insert
  on public.sms_usage_warnings
  for insert
  with check (tenant_id = public.auth_tenant_id());

create policy sms_usage_warnings_update
  on public.sms_usage_warnings
  for update
  using (tenant_id = public.auth_tenant_id())
  with check (tenant_id = public.auth_tenant_id());

create policy sms_usage_warnings_delete
  on public.sms_usage_warnings
  for delete
  using (tenant_id = public.auth_tenant_id());

commit;
