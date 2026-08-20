-- webhook_events: audit + dedupe log for every Wompi webhook delivery. The
-- partial unique index on event_id is what makes wompi-webhook idempotent —
-- a second delivery of the same event_id hits a unique-violation on insert
-- and the function short-circuits to a 200 without touching orders/payments
-- (design.md Decision 7). When Wompi does not provide a stable event_id, the
-- fallback unique index on (transaction_id, event_type, occurred_at) covers
-- the same guarantee. No client-facing RLS policy exists — this table is
-- service_role only.

create table if not exists public.webhook_events (
  id                  uuid primary key default gen_random_uuid(),
  provider            text not null default 'WOMPI',
  event_type          text not null,
  event_id            text,
  transaction_id      text,
  occurred_at         timestamptz,
  payload             jsonb not null,
  checksum            text,
  environment         text,
  received_at         timestamptz not null default now(),
  processed_at        timestamptz,
  processing_status   text not null default 'RECEIVED' check (processing_status in (
                        'RECEIVED', 'PROCESSED', 'CHECKSUM_INVALID', 'REVIEW_REQUIRED', 'ERROR'
                      )),
  error_message       text
);

create unique index if not exists webhook_events_provider_event_id_unique
  on public.webhook_events (provider, event_id)
  where event_id is not null;

create unique index if not exists webhook_events_provider_txn_fallback_unique
  on public.webhook_events (provider, transaction_id, event_type, occurred_at)
  where event_id is null;

create index if not exists webhook_events_transaction_id_idx on public.webhook_events (transaction_id);

alter table public.webhook_events enable row level security;

create policy "webhook_events_select_admin" on public.webhook_events
  for select using ((auth.jwt() ->> 'user_role') in ('ADMIN', 'SUPER_ADMIN'));
