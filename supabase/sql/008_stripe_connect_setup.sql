alter table public.tenant_billing
add column if not exists connected_account_id text,
add column if not exists booking_payments_enabled boolean not null default false,
add column if not exists stripe_connect_charges_enabled boolean not null default false,
add column if not exists stripe_connect_details_submitted boolean not null default false;
