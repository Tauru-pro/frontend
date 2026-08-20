-- Payments + payment_attempts: part of checkout-orders-wompi. One `payments`
-- row per order-payment-intent, one `payment_attempts` row per retry (see
-- design.md Decision 5 / proposal §10 — retries never overwrite history).
-- provider_reference is UNIQUE per Wompi's own requirement that references
-- are never reused once used (proposal §16).

create table if not exists public.payments (
  id                        uuid primary key default gen_random_uuid(),
  order_id                  uuid not null references public.orders (id) on delete cascade,
  provider                  text not null default 'WOMPI',
  provider_transaction_id   text,
  provider_reference        text not null,
  status                    text not null default 'CREATED' check (status in (
                              'CREATED', 'PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR', 'EXPIRED'
                            )),
  amount                    integer not null,
  currency                  text not null default 'COP',
  payment_method            text,
  failure_reason            text,
  raw_response              jsonb,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  approved_at               timestamptz,
  unique (provider_transaction_id),
  unique (provider_reference)
);

create index if not exists payments_order_id_idx on public.payments (order_id);
create index if not exists payments_status_idx on public.payments (status);

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;

-- Read-only for the owning buyer; all writes go through service_role Edge
-- Functions (create-checkout, wompi-webhook, retry-payment, reconcile-payments).
create policy "payments_select_own" on public.payments
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id and o.user_id = auth.uid()
    )
  );

create policy "payments_select_admin" on public.payments
  for select using ((auth.jwt() ->> 'user_role') in ('ADMIN', 'SUPER_ADMIN'));

create table if not exists public.payment_attempts (
  id                        uuid primary key default gen_random_uuid(),
  payment_id                uuid not null references public.payments (id) on delete cascade,
  attempt_number            integer not null,
  reference                 text not null unique,
  provider_transaction_id   text,
  status                    text not null default 'CREATED' check (status in (
                              'CREATED', 'PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR', 'EXPIRED'
                            )),
  amount                    integer not null,
  created_at                timestamptz not null default now(),
  completed_at              timestamptz,
  unique (payment_id, attempt_number)
);

create index if not exists payment_attempts_payment_id_idx on public.payment_attempts (payment_id);

alter table public.payment_attempts enable row level security;

create policy "payment_attempts_select_own" on public.payment_attempts
  for select using (
    exists (
      select 1 from public.payments p
      join public.orders o on o.id = p.order_id
      where p.id = payment_attempts.payment_id and o.user_id = auth.uid()
    )
  );

create policy "payment_attempts_select_admin" on public.payment_attempts
  for select using ((auth.jwt() ->> 'user_role') in ('ADMIN', 'SUPER_ADMIN'));
