create table public.onboarding_requests (
  id uuid primary key default gen_random_uuid(),

  status text not null default 'new',

  business_name text not null,
  owner_name text,
  owner_email text not null,
  owner_phone text,

  business_phone text,
  business_email text,
  trade_category text,
  service_area text,
  business_address text,

  desired_slug text,
  plan_interest text,

  brand_color text,
  google_review_url text,
  yelp_review_url text,

  services_text text,
  business_hours_text text,
  notes text,

  source text default 'public_onboarding',

  tenant_id uuid references tenants(id),
  auth_user_id uuid,

  invite_status text not null default 'not_invited',
  invited_at timestamptz,

  auto_create_ready boolean default false,
  auto_create_error text,

  processed_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists onboarding_requests_status_idx
on public.onboarding_requests (status);
