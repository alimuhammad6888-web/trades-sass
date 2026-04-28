-- ============================================================
-- 003_reconcile_inbox_twilio_schema.sql
-- Reconciles repo schema with manually applied Inbox/Twilio DB changes.
-- Safe to run on a fresh DB or an already-updated DB.
-- ============================================================

begin;

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- business_settings
-- ------------------------------------------------------------
alter table public.business_settings
  add column if not exists notification_phone text,
  add column if not exists missed_call_text_enabled boolean not null default true,
  add column if not exists missed_call_auto_reply text default 'Sorry we missed your call — how can we help?';

create index if not exists idx_business_settings_phone
  on public.business_settings(phone);

-- ------------------------------------------------------------
-- customers
-- ------------------------------------------------------------
alter table public.customers
  add column if not exists inbox_status text,
  add column if not exists inbox_snoozed_until timestamptz,
  add column if not exists inbox_last_action_at timestamptz;

create index if not exists idx_customers_tenant_phone
  on public.customers(tenant_id, phone);

-- ------------------------------------------------------------
-- inbox_threads
-- ------------------------------------------------------------
create table if not exists public.inbox_threads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  source text,
  status text,
  last_message_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inbox_threads
  add column if not exists source text,
  add column if not exists status text,
  add column if not exists last_message_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_inbox_threads_tenant_customer
  on public.inbox_threads(tenant_id, customer_id);

create index if not exists idx_inbox_threads_tenant_last_message_at
  on public.inbox_threads(tenant_id, last_message_at desc);

drop trigger if exists trg_inbox_threads_updated_at on public.inbox_threads;

create trigger trg_inbox_threads_updated_at
before update on public.inbox_threads
for each row execute function public.set_updated_at();

alter table public.inbox_threads enable row level security;
alter table public.inbox_threads force row level security;

drop policy if exists inbox_threads_select on public.inbox_threads;
drop policy if exists inbox_threads_insert on public.inbox_threads;
drop policy if exists inbox_threads_update on public.inbox_threads;
drop policy if exists inbox_threads_delete on public.inbox_threads;

create policy inbox_threads_select
  on public.inbox_threads
  for select
  using (tenant_id = public.auth_tenant_id());

create policy inbox_threads_insert
  on public.inbox_threads
  for insert
  with check (tenant_id = public.auth_tenant_id());

create policy inbox_threads_update
  on public.inbox_threads
  for update
  using (tenant_id = public.auth_tenant_id())
  with check (tenant_id = public.auth_tenant_id());

create policy inbox_threads_delete
  on public.inbox_threads
  for delete
  using (tenant_id = public.auth_tenant_id());

-- ------------------------------------------------------------
-- inbox_messages
-- ------------------------------------------------------------
create table if not exists public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.inbox_threads(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  direction text not null,
  channel text not null,
  subject text,
  body text not null default '',
  from_email text,
  to_email text,
  body_purged boolean not null default false,
  purged_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.inbox_messages
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade,
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists direction text,
  add column if not exists channel text,
  add column if not exists subject text,
  add column if not exists body text not null default '',
  add column if not exists from_email text,
  add column if not exists to_email text,
  add column if not exists body_purged boolean not null default false,
  add column if not exists purged_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

alter table public.inbox_messages
  alter column body set default '',
  alter column body_purged set default false,
  alter column created_at set default now();

alter table public.inbox_messages
  drop constraint if exists inbox_messages_channel_check;

alter table public.inbox_messages
  add constraint inbox_messages_channel_check
  check (channel in ('web_form', 'email', 'sms'));

alter table public.inbox_messages
  drop constraint if exists inbox_messages_direction_check;

alter table public.inbox_messages
  add constraint inbox_messages_direction_check
  check (direction in ('inbound', 'outbound'));

create index if not exists idx_inbox_messages_thread_id
  on public.inbox_messages(thread_id);

create index if not exists idx_inbox_messages_tenant_created_at
  on public.inbox_messages(tenant_id, created_at desc);

create index if not exists idx_inbox_messages_customer_id
  on public.inbox_messages(customer_id);

alter table public.inbox_messages enable row level security;
alter table public.inbox_messages force row level security;

drop policy if exists inbox_messages_select on public.inbox_messages;
drop policy if exists inbox_messages_insert on public.inbox_messages;
drop policy if exists inbox_messages_update on public.inbox_messages;
drop policy if exists inbox_messages_delete on public.inbox_messages;

create policy inbox_messages_select
  on public.inbox_messages
  for select
  using (tenant_id = public.auth_tenant_id());

create policy inbox_messages_insert
  on public.inbox_messages
  for insert
  with check (tenant_id = public.auth_tenant_id());

create policy inbox_messages_update
  on public.inbox_messages
  for update
  using (tenant_id = public.auth_tenant_id())
  with check (tenant_id = public.auth_tenant_id());

create policy inbox_messages_delete
  on public.inbox_messages
  for delete
  using (tenant_id = public.auth_tenant_id());

-- ------------------------------------------------------------
-- twilio_webhook_events
-- ------------------------------------------------------------
create table if not exists public.twilio_webhook_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_type text not null,
  provider_sid text not null,
  created_at timestamptz not null default now(),
  unique (event_type, provider_sid)
);

alter table public.twilio_webhook_events
  add column if not exists created_at timestamptz not null default now();

alter table public.twilio_webhook_events
  drop constraint if exists twilio_webhook_events_event_type_check;

alter table public.twilio_webhook_events
  add constraint twilio_webhook_events_event_type_check
  check (event_type in ('voice_status', 'inbound_sms'));

create index if not exists idx_twilio_webhook_events_tenant_id
  on public.twilio_webhook_events(tenant_id);

alter table public.twilio_webhook_events enable row level security;
alter table public.twilio_webhook_events force row level security;

drop policy if exists twilio_webhook_events_select on public.twilio_webhook_events;
drop policy if exists twilio_webhook_events_insert on public.twilio_webhook_events;
drop policy if exists twilio_webhook_events_update on public.twilio_webhook_events;
drop policy if exists twilio_webhook_events_delete on public.twilio_webhook_events;

create policy twilio_webhook_events_select
  on public.twilio_webhook_events
  for select
  using (tenant_id = public.auth_tenant_id());

create policy twilio_webhook_events_insert
  on public.twilio_webhook_events
  for insert
  with check (tenant_id = public.auth_tenant_id());

create policy twilio_webhook_events_update
  on public.twilio_webhook_events
  for update
  using (tenant_id = public.auth_tenant_id())
  with check (tenant_id = public.auth_tenant_id());

create policy twilio_webhook_events_delete
  on public.twilio_webhook_events
  for delete
  using (tenant_id = public.auth_tenant_id());

-- ------------------------------------------------------------
-- quick_reply_tokens
-- ------------------------------------------------------------
create table if not exists public.quick_reply_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  thread_id uuid references public.inbox_threads(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.quick_reply_tokens
  add column if not exists used_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_quick_reply_tokens_token
  on public.quick_reply_tokens(token);

create index if not exists idx_quick_reply_tokens_expires_at
  on public.quick_reply_tokens(expires_at);

alter table public.quick_reply_tokens enable row level security;
alter table public.quick_reply_tokens force row level security;

drop policy if exists quick_reply_tokens_select on public.quick_reply_tokens;
drop policy if exists quick_reply_tokens_insert on public.quick_reply_tokens;
drop policy if exists quick_reply_tokens_update on public.quick_reply_tokens;
drop policy if exists quick_reply_tokens_delete on public.quick_reply_tokens;

create policy quick_reply_tokens_select
  on public.quick_reply_tokens
  for select
  using (tenant_id = public.auth_tenant_id());

create policy quick_reply_tokens_insert
  on public.quick_reply_tokens
  for insert
  with check (tenant_id = public.auth_tenant_id());

create policy quick_reply_tokens_update
  on public.quick_reply_tokens
  for update
  using (tenant_id = public.auth_tenant_id())
  with check (tenant_id = public.auth_tenant_id());

create policy quick_reply_tokens_delete
  on public.quick_reply_tokens
  for delete
  using (tenant_id = public.auth_tenant_id());

commit;
