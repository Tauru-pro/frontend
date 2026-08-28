-- seller-dashboard-commissions-settlements, 1.1: seller_segments — the
-- normalized catalog of commercial segments a seller can belong to
-- (DISTRIBUTOR / LABORATORY / LIVESTOCK_COMPANY), replacing any notion of
-- reading a seller's free-form onboarding survey answers to determine their
-- commission tier (design.md Decision 1). Segments are deactivated, never
-- deleted, once referenced (proposal §6) — enforced below by simply not
-- allowing delete via RLS/no-op rather than a restrictive FK, since a
-- catalog row referenced by seller_profiles/commission rules already can't
-- be deleted while referenced (FK RESTRICT is the default).

create table if not exists public.seller_segments (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists seller_segments_set_updated_at on public.seller_segments;
create trigger seller_segments_set_updated_at
  before update on public.seller_segments
  for each row execute function public.set_updated_at();

insert into public.seller_segments (code, name, description)
values
  ('DISTRIBUTOR', 'Distribuidor', 'Distribuidor de material genético bovino'),
  ('LABORATORY', 'Laboratorio', 'Laboratorio productor de material genético bovino'),
  ('LIVESTOCK_COMPANY', 'Empresa ganadera', 'Empresa ganadera que comercializa material genético propio')
on conflict (code) do nothing;

alter table public.seller_segments enable row level security;

-- Any authenticated user can read the catalog (needed to render segment
-- names on the seller dashboard/settings and the admin assignment picker);
-- only SUPER_ADMIN manages it, same split as onboarding_survey_questions (0011).
create policy "seller_segments_select_auth" on public.seller_segments
  for select to authenticated using (true);

create policy "seller_segments_all_super_admin" on public.seller_segments
  for all using ((auth.jwt() ->> 'user_role') = 'SUPER_ADMIN')
  with check ((auth.jwt() ->> 'user_role') = 'SUPER_ADMIN');
