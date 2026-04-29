-- ============================================================
-- 005_review_automation.sql
-- Review request tokens and internal customer feedback capture.
-- ============================================================

begin;

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- business_settings additions
-- ------------------------------------------------------------
alter table public.business_settings
  add column if not exists google_review_url text,
  add column if not exists yelp_review_url text;

-- ------------------------------------------------------------
-- review_tokens
-- One request token per booking for MVP, reusable until expiration.
-- ------------------------------------------------------------
create table if not exists public.review_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (booking_id)
);

alter table public.review_tokens
  add column if not exists used_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_review_tokens_token
  on public.review_tokens(token);

create index if not exists idx_review_tokens_expires_at
  on public.review_tokens(expires_at);

create index if not exists idx_review_tokens_tenant_booking
  on public.review_tokens(tenant_id, booking_id);

alter table public.review_tokens enable row level security;
alter table public.review_tokens force row level security;

drop policy if exists review_tokens_select on public.review_tokens;
drop policy if exists review_tokens_insert on public.review_tokens;
drop policy if exists review_tokens_update on public.review_tokens;
drop policy if exists review_tokens_delete on public.review_tokens;

create policy review_tokens_select
  on public.review_tokens
  for select
  using (tenant_id = public.auth_tenant_id());

create policy review_tokens_insert
  on public.review_tokens
  for insert
  with check (tenant_id = public.auth_tenant_id());

create policy review_tokens_update
  on public.review_tokens
  for update
  using (tenant_id = public.auth_tenant_id())
  with check (tenant_id = public.auth_tenant_id());

create policy review_tokens_delete
  on public.review_tokens
  for delete
  using (tenant_id = public.auth_tenant_id());

-- ------------------------------------------------------------
-- customer_feedback
-- Stores internal feedback first, regardless of whether
-- external review links are shown.
-- ------------------------------------------------------------
create table if not exists public.customer_feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  review_token_id uuid references public.review_tokens(id) on delete set null,
  rating integer not null,
  is_positive boolean not null,
  feedback_text text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.customer_feedback
  add column if not exists is_positive boolean,
  add column if not exists feedback_text text,
  add column if not exists submitted_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

alter table public.customer_feedback
  alter column submitted_at set default now(),
  alter column created_at set default now();

alter table public.customer_feedback
  drop constraint if exists customer_feedback_rating_check;

alter table public.customer_feedback
  add constraint customer_feedback_rating_check
  check (rating between 1 and 5);

create index if not exists idx_customer_feedback_tenant_submitted
  on public.customer_feedback(tenant_id, submitted_at desc);

create index if not exists idx_customer_feedback_booking_id
  on public.customer_feedback(booking_id);

create index if not exists idx_customer_feedback_customer_id
  on public.customer_feedback(customer_id);

alter table public.customer_feedback enable row level security;
alter table public.customer_feedback force row level security;

drop policy if exists customer_feedback_select on public.customer_feedback;
drop policy if exists customer_feedback_insert on public.customer_feedback;
drop policy if exists customer_feedback_update on public.customer_feedback;
drop policy if exists customer_feedback_delete on public.customer_feedback;

create policy customer_feedback_select
  on public.customer_feedback
  for select
  using (tenant_id = public.auth_tenant_id());

create policy customer_feedback_insert
  on public.customer_feedback
  for insert
  with check (tenant_id = public.auth_tenant_id());

create policy customer_feedback_update
  on public.customer_feedback
  for update
  using (tenant_id = public.auth_tenant_id())
  with check (tenant_id = public.auth_tenant_id());

create policy customer_feedback_delete
  on public.customer_feedback
  for delete
  using (tenant_id = public.auth_tenant_id());

commit;
