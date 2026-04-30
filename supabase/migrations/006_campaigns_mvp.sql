-- ============================================================
-- 006_campaigns_mvp.sql
-- Campaigns MVP: campaigns, recipients, events, and channel opt-outs.
-- ============================================================

begin;

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- campaigns
-- Supports legacy campaigns table from 000_full_schema.sql and
-- layers in the columns needed for the campaigns MVP.
-- ------------------------------------------------------------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  channel text not null,
  status text not null default 'draft',
  subject text,
  message_body text not null,
  audience_type text not null default 'all_customers',
  cta_url text,
  cta_label text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  recipient_count integer not null default 0,
  delivered_count integer not null default 0,
  clicked_count integer not null default 0,
  failed_count integer not null default 0,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.campaigns
  add column if not exists name text,
  add column if not exists channel text,
  add column if not exists subject text,
  add column if not exists message_body text,
  add column if not exists audience_type text default 'all_customers',
  add column if not exists cta_url text,
  add column if not exists cta_label text,
  add column if not exists recipient_count integer not null default 0,
  add column if not exists delivered_count integer not null default 0,
  add column if not exists clicked_count integer not null default 0,
  add column if not exists failed_count integer not null default 0,
  add column if not exists created_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.campaigns
set
  name = coalesce(name, title),
  channel = coalesce(
    channel,
    case
      when channels is not null and 'email' = any(channels::text[]) then 'email'
      else 'email'
    end
  ),
  subject = coalesce(subject, email_subject),
  message_body = coalesce(message_body, body),
  delivered_count = case
    when delivered_count = 0 and coalesce(sent_count, 0) > 0 then sent_count
    else delivered_count
  end,
  clicked_count = case
    when clicked_count = 0 and coalesce(click_count, 0) > 0 then click_count
    else clicked_count
  end,
  created_by_user_id = coalesce(created_by_user_id, created_by)
where
  name is null
  or channel is null
  or message_body is null
  or subject is null
  or (delivered_count = 0 and coalesce(sent_count, 0) > 0)
  or (clicked_count = 0 and coalesce(click_count, 0) > 0)
  or created_by_user_id is null;

update public.campaigns
set channel = 'email'
where channel is null;

alter table public.campaigns
  alter column name set not null,
  alter column channel set not null,
  alter column message_body set not null,
  alter column audience_type set default 'all_customers',
  alter column audience_type set not null,
  alter column recipient_count set default 0,
  alter column recipient_count set not null,
  alter column delivered_count set default 0,
  alter column delivered_count set not null,
  alter column clicked_count set default 0,
  alter column clicked_count set not null,
  alter column failed_count set default 0,
  alter column failed_count set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.campaigns
  drop constraint if exists campaigns_channel_check;

alter table public.campaigns
  add constraint campaigns_channel_check
  check (channel in ('email', 'sms'));

alter table public.campaigns
  drop constraint if exists campaigns_status_check;

alter table public.campaigns
  add constraint campaigns_status_check
  check (status::text in ('draft', 'scheduled', 'sending', 'sent', 'failed'));

alter table public.campaigns
  drop constraint if exists campaigns_audience_type_check;

alter table public.campaigns
  add constraint campaigns_audience_type_check
  check (audience_type in ('all_customers'));

create index if not exists idx_campaigns_tenant_created_at
  on public.campaigns(tenant_id, created_at desc);

create index if not exists idx_campaigns_tenant_status_created_at
  on public.campaigns(tenant_id, status, created_at desc);

create index if not exists idx_campaigns_tenant_channel_created_at
  on public.campaigns(tenant_id, channel, created_at desc);

drop trigger if exists trg_campaigns_updated_at on public.campaigns;

create trigger trg_campaigns_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

alter table public.campaigns enable row level security;
alter table public.campaigns force row level security;

drop policy if exists campaigns_select on public.campaigns;
drop policy if exists campaigns_insert on public.campaigns;
drop policy if exists campaigns_update on public.campaigns;
drop policy if exists campaigns_delete on public.campaigns;
drop policy if exists "campaigns_select" on public.campaigns;
drop policy if exists "campaigns_insert" on public.campaigns;
drop policy if exists "campaigns_update" on public.campaigns;
drop policy if exists "campaigns_delete" on public.campaigns;

create policy campaigns_select
  on public.campaigns
  for select
  using (tenant_id = public.auth_tenant_id());

create policy campaigns_insert
  on public.campaigns
  for insert
  with check (tenant_id = public.auth_tenant_id());

create policy campaigns_update
  on public.campaigns
  for update
  using (tenant_id = public.auth_tenant_id())
  with check (tenant_id = public.auth_tenant_id());

create policy campaigns_delete
  on public.campaigns
  for delete
  using (tenant_id = public.auth_tenant_id());

-- ------------------------------------------------------------
-- campaign_recipients
-- One row per recipient per campaign per channel.
-- ------------------------------------------------------------
create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  channel text not null,
  delivery_status text not null default 'pending',
  destination text,
  provider_message_id text,
  unsubscribe_token text,
  click_token text,
  sent_at timestamptz,
  clicked_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  unique (campaign_id, customer_id, channel)
);

alter table public.campaign_recipients
  add column if not exists destination text,
  add column if not exists provider_message_id text,
  add column if not exists unsubscribe_token text,
  add column if not exists click_token text,
  add column if not exists sent_at timestamptz,
  add column if not exists clicked_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists failure_reason text,
  add column if not exists created_at timestamptz not null default now();

alter table public.campaign_recipients
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.campaign_recipients
  drop constraint if exists campaign_recipients_channel_check;

alter table public.campaign_recipients
  add constraint campaign_recipients_channel_check
  check (channel in ('email', 'sms'));

alter table public.campaign_recipients
  drop constraint if exists campaign_recipients_delivery_status_check;

alter table public.campaign_recipients
  add constraint campaign_recipients_delivery_status_check
  check (delivery_status in ('pending', 'sent', 'failed', 'skipped', 'clicked', 'unsubscribed'));

create unique index if not exists idx_campaign_recipients_unsubscribe_token
  on public.campaign_recipients(unsubscribe_token)
  where unsubscribe_token is not null;

create unique index if not exists idx_campaign_recipients_click_token
  on public.campaign_recipients(click_token)
  where click_token is not null;

create index if not exists idx_campaign_recipients_campaign_id
  on public.campaign_recipients(campaign_id);

create index if not exists idx_campaign_recipients_tenant_created_at
  on public.campaign_recipients(tenant_id, created_at desc);

create index if not exists idx_campaign_recipients_customer_channel
  on public.campaign_recipients(customer_id, channel);

create index if not exists idx_campaign_recipients_campaign_status
  on public.campaign_recipients(campaign_id, delivery_status);

alter table public.campaign_recipients enable row level security;
alter table public.campaign_recipients force row level security;

drop policy if exists campaign_recipients_select on public.campaign_recipients;
drop policy if exists campaign_recipients_insert on public.campaign_recipients;
drop policy if exists campaign_recipients_update on public.campaign_recipients;
drop policy if exists campaign_recipients_delete on public.campaign_recipients;

create policy campaign_recipients_select
  on public.campaign_recipients
  for select
  using (tenant_id = public.auth_tenant_id());

create policy campaign_recipients_insert
  on public.campaign_recipients
  for insert
  with check (tenant_id = public.auth_tenant_id());

create policy campaign_recipients_update
  on public.campaign_recipients
  for update
  using (tenant_id = public.auth_tenant_id())
  with check (tenant_id = public.auth_tenant_id());

create policy campaign_recipients_delete
  on public.campaign_recipients
  for delete
  using (tenant_id = public.auth_tenant_id());

-- ------------------------------------------------------------
-- campaign_events
-- Append-only event log for sent, failed, clicked, unsubscribed.
-- ------------------------------------------------------------
create table if not exists public.campaign_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_recipient_id uuid references public.campaign_recipients(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  event_type text not null,
  event_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.campaign_events
  add column if not exists campaign_recipient_id uuid references public.campaign_recipients(id) on delete cascade,
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists event_metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

alter table public.campaign_events
  alter column event_type set not null,
  alter column event_metadata set default '{}'::jsonb,
  alter column event_metadata set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.campaign_events
  drop constraint if exists campaign_events_event_type_check;

alter table public.campaign_events
  add constraint campaign_events_event_type_check
  check (event_type in ('sent', 'failed', 'clicked', 'unsubscribed'));

create index if not exists idx_campaign_events_campaign_created_at
  on public.campaign_events(campaign_id, created_at desc);

create index if not exists idx_campaign_events_tenant_created_at
  on public.campaign_events(tenant_id, created_at desc);

create index if not exists idx_campaign_events_recipient_created_at
  on public.campaign_events(campaign_recipient_id, created_at desc);

create index if not exists idx_campaign_events_event_type_created_at
  on public.campaign_events(event_type, created_at desc);

alter table public.campaign_events enable row level security;
alter table public.campaign_events force row level security;

drop policy if exists campaign_events_select on public.campaign_events;
drop policy if exists campaign_events_insert on public.campaign_events;
drop policy if exists campaign_events_update on public.campaign_events;
drop policy if exists campaign_events_delete on public.campaign_events;

create policy campaign_events_select
  on public.campaign_events
  for select
  using (tenant_id = public.auth_tenant_id());

create policy campaign_events_insert
  on public.campaign_events
  for insert
  with check (tenant_id = public.auth_tenant_id());

create policy campaign_events_update
  on public.campaign_events
  for update
  using (tenant_id = public.auth_tenant_id())
  with check (tenant_id = public.auth_tenant_id());

create policy campaign_events_delete
  on public.campaign_events
  for delete
  using (tenant_id = public.auth_tenant_id());

-- ------------------------------------------------------------
-- customer_channel_opt_outs
-- Tenant-specific marketing opt-outs by channel.
-- ------------------------------------------------------------
create table if not exists public.customer_channel_opt_outs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  channel text not null,
  source text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, customer_id, channel)
);

alter table public.customer_channel_opt_outs
  add column if not exists created_at timestamptz not null default now();

alter table public.customer_channel_opt_outs
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.customer_channel_opt_outs
  drop constraint if exists customer_channel_opt_outs_channel_check;

alter table public.customer_channel_opt_outs
  add constraint customer_channel_opt_outs_channel_check
  check (channel in ('email', 'sms'));

alter table public.customer_channel_opt_outs
  drop constraint if exists customer_channel_opt_outs_source_check;

alter table public.customer_channel_opt_outs
  add constraint customer_channel_opt_outs_source_check
  check (source in ('unsubscribe_link', 'inbound_stop', 'manual'));

create index if not exists idx_customer_channel_opt_outs_tenant_channel
  on public.customer_channel_opt_outs(tenant_id, channel, created_at desc);

create index if not exists idx_customer_channel_opt_outs_customer
  on public.customer_channel_opt_outs(customer_id, created_at desc);

alter table public.customer_channel_opt_outs enable row level security;
alter table public.customer_channel_opt_outs force row level security;

drop policy if exists customer_channel_opt_outs_select on public.customer_channel_opt_outs;
drop policy if exists customer_channel_opt_outs_insert on public.customer_channel_opt_outs;
drop policy if exists customer_channel_opt_outs_update on public.customer_channel_opt_outs;
drop policy if exists customer_channel_opt_outs_delete on public.customer_channel_opt_outs;

create policy customer_channel_opt_outs_select
  on public.customer_channel_opt_outs
  for select
  using (tenant_id = public.auth_tenant_id());

create policy customer_channel_opt_outs_insert
  on public.customer_channel_opt_outs
  for insert
  with check (tenant_id = public.auth_tenant_id());

create policy customer_channel_opt_outs_update
  on public.customer_channel_opt_outs
  for update
  using (tenant_id = public.auth_tenant_id())
  with check (tenant_id = public.auth_tenant_id());

create policy customer_channel_opt_outs_delete
  on public.customer_channel_opt_outs
  for delete
  using (tenant_id = public.auth_tenant_id());

commit;
