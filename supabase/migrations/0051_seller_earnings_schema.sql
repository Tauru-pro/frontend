-- seller-dashboard-commissions-settlements, 3.1: seller_earnings — one row
-- per (payment, seller), created only on genuine payment approval (0052),
-- freezing the commission that applied at that moment (design.md Decision 5).
-- Unlike orders/payments (where a seller never gets direct RLS SELECT
-- because the row spans potentially multiple sellers — 0046's Decision 4),
-- a seller_earnings row is fully scoped to one seller by construction, so a
-- plain RLS policy is sufficient here (design.md Decision 10) — no
-- security-definer RPC needed just to read.

create table if not exists public.seller_earnings (
  id                      uuid primary key default gen_random_uuid(),
  seller_id               uuid not null references public.seller_profiles (id),
  order_id                uuid not null references public.orders (id),
  payment_id              uuid not null references public.payments (id),
  gross_amount            integer not null,
  commission_rate         numeric(5,2) not null default 0,
  commission_amount       integer not null default 0,
  seller_net_amount       integer not null,
  status                  text not null default 'PENDING' check (status in (
                            'PENDING', 'AVAILABLE', 'IN_SETTLEMENT', 'SETTLED', 'REVERSED'
                          )),
  needs_commission_review boolean not null default false,
  reversal_of_earning_id  uuid references public.seller_earnings (id),
  backfilled              boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (gross_amount - commission_amount = seller_net_amount)
);

create index if not exists seller_earnings_seller_id_idx on public.seller_earnings (seller_id);
create index if not exists seller_earnings_order_id_idx on public.seller_earnings (order_id);
create index if not exists seller_earnings_status_idx on public.seller_earnings (seller_id, status);
create index if not exists seller_earnings_needs_review_idx on public.seller_earnings (needs_commission_review) where needs_commission_review;

-- Idempotency (proposal §14) applies to the ORIGINAL earning created by
-- apply_payment_approved for a given (payment, seller) — a reversal row
-- (reversal_of_earning_id is not null) intentionally shares the same
-- payment_id/seller_id as the earning it compensates, so the uniqueness
-- constraint only covers original rows. At most one reversal per original
-- earning is enforced separately below.
create unique index if not exists seller_earnings_payment_seller_original_unique
  on public.seller_earnings (payment_id, seller_id)
  where reversal_of_earning_id is null;

create unique index if not exists seller_earnings_reversal_of_unique
  on public.seller_earnings (reversal_of_earning_id)
  where reversal_of_earning_id is not null;

drop trigger if exists seller_earnings_set_updated_at on public.seller_earnings;
create trigger seller_earnings_set_updated_at
  before update on public.seller_earnings
  for each row execute function public.set_updated_at();

alter table public.seller_earnings enable row level security;

-- Seller reads only their own earnings (design.md Decision 10). No
-- INSERT/UPDATE/DELETE policy for any client role — RLS enabled with no
-- matching write policy means Postgres rejects the write outright, same
-- pattern as order_seller_fulfillments (0043) and webhook_events (0033).
-- All writes happen through apply_payment_approved (service_role) or the
-- admin-only SECURITY DEFINER functions in later migrations.
create policy "seller_earnings_select_own" on public.seller_earnings
  for select using (
    seller_id = (select id from public.seller_profiles where user_id = auth.uid())
  );

create policy "seller_earnings_select_admin" on public.seller_earnings
  for select using ((auth.jwt() ->> 'user_role') in ('ADMIN', 'SUPER_ADMIN'));

-- Lets the seller dashboard subscribe to postgres_changes directly on this
-- table (RLS already scopes what each subscriber receives).
alter publication supabase_realtime add table public.seller_earnings;
