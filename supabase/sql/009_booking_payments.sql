alter table public.bookings
add column if not exists payment_status text not null default 'unpaid',
add column if not exists stripe_checkout_session_id text,
add column if not exists stripe_payment_intent_id text,
add column if not exists amount_paid integer,
add column if not exists currency text not null default 'usd';

alter table public.bookings
  drop constraint if exists bookings_payment_status_check;

alter table public.bookings
  add constraint bookings_payment_status_check
  check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded'));

create unique index if not exists bookings_stripe_checkout_session_id_key
  on public.bookings (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists bookings_stripe_payment_intent_id_key
  on public.bookings (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
