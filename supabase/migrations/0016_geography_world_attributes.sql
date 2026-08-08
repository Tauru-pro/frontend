-- Geography catalog goes worldwide.
--
--   * countries gain the ISO / dialing / flag attributes the address and phone
--     forms need (iso2, iso3, phonecode, emoji).
--   * all three levels gain external_id — the numeric id of the upstream
--     dr5hn/countries-states-cities-database dataset. It is the conflict target
--     the seed script upserts on, so re-running the seed reconciles rows by
--     stable identity instead of by name (upstream re-spells names between
--     releases; matching by name would orphan rows that FKs already point at).
--
-- Everything is additive and nullable: rows seeded before this migration keep
-- working with external_id / iso2 left null until the seed reconciles them.
-- RLS policies and the set_updated_at triggers from 0008 are untouched.

alter table public.countries
  add column if not exists iso2        text,
  add column if not exists iso3        text,
  add column if not exists phonecode   text,
  add column if not exists emoji       text,
  add column if not exists external_id integer;

alter table public.states
  add column if not exists state_code  text,
  add column if not exists external_id integer;

alter table public.cities
  add column if not exists external_id integer;

-- Plain (non-partial) unique indexes on purpose: Postgres treats NULLs as
-- distinct, so legacy rows that have not been reconciled yet coexist fine —
-- and, unlike a partial index, a plain one can be inferred by the bare
-- `ON CONFLICT (external_id)` that PostgREST emits for upserts.
create unique index if not exists countries_iso2_key
  on public.countries (iso2);

create unique index if not exists countries_external_id_key
  on public.countries (external_id);

create unique index if not exists states_external_id_key
  on public.states (external_id);

create unique index if not exists cities_external_id_key
  on public.cities (external_id);

-- Postgres does not index FK columns automatically. The composite UNIQUE
-- constraints from 0008 currently cover these as a left-most prefix, but the
-- combo queries (`states by country`, `cities by state`) are the hot path over
-- ~155k rows — index them explicitly so the plan does not depend on keeping
-- those composite constraints around.
create index if not exists states_country_id_idx
  on public.states (country_id);

create index if not exists cities_state_id_idx
  on public.cities (state_id);
