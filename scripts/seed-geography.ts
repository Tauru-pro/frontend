// Seed the worldwide geography catalog: ~250 countries → ~5.000 states → ~150.000 cities.
// Source: https://github.com/dr5hn/countries-states-cities-database (countries+states+cities.json, ~46 MB)
//
// Run with: npm run seed:geography
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Idempotent: every upsert conflicts on `external_id` (the numeric id of the
// upstream dataset), so re-running never duplicates rows and never changes the
// uuid of a row that branches/seller_profiles already point at.
//
// Rows seeded before external_id existed (the original Colombia-only seed) are
// reconciled first, level by level, by accent- and case-insensitive name match:
// they adopt the dataset's external_id instead of being duplicated by it.
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DATA_URL =
  'https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/refs/heads/master/json/countries%2Bstates%2Bcities.json';

const BATCH_SIZE = 1000;

interface DatasetCity {
  id: number;
  name: string;
}

interface DatasetState {
  id: number;
  name: string;
  iso2?: string | null;
  cities?: DatasetCity[];
}

interface DatasetCountry {
  id: number;
  name: string;
  iso2: string;
  iso3: string;
  phonecode: string;
  emoji: string;
  states?: DatasetState[];
}

interface LegacyRow {
  id: string;
  name: string;
  parentId: string | null;
}

/** Accent- and case-insensitive key used to match legacy rows against the dataset. */
function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** PostgREST caps responses at 1000 rows; page through the whole table. */
async function selectAll<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  filter?: (q: any) => any,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += BATCH_SIZE) {
    let query = supabase
      .from(table)
      .select(columns)
      .range(from, from + BATCH_SIZE - 1)
      .order('id', { ascending: true });
    if (filter) query = filter(query);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < BATCH_SIZE) return rows;
  }
}

async function upsertInBatches(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`upsert ${table} [${i}..${i + batch.length}): ${error.message}`);
    process.stdout.write(`\r  ${table}: ${Math.min(i + batch.length, rows.length)}/${rows.length}`);
  }
  process.stdout.write('\n');
}

/**
 * Give legacy rows (external_id null) the external_id of their dataset
 * counterpart, matching by normalized name within the same parent. The update
 * goes through an upsert on the primary key so it batches; `extra` carries the
 * NOT NULL columns the payload must repeat.
 */
async function reconcile(
  supabase: SupabaseClient,
  table: string,
  legacy: LegacyRow[],
  /** parent uuid (null for countries) → normalized name → dataset id */
  datasetByParent: Map<string | null, Map<string, number>>,
  parentColumn: string | null,
): Promise<{ matched: number; unmatched: LegacyRow[] }> {
  const payload: Record<string, unknown>[] = [];
  const unmatched: LegacyRow[] = [];
  const claimed = new Set<number>();

  for (const row of legacy) {
    const externalId = datasetByParent.get(row.parentId)?.get(normalizeName(row.name));
    // A dataset row can only be claimed once: two legacy rows whose names
    // normalize alike (e.g. "Turbaná" / "Turbana") would otherwise collide on
    // the external_id unique index.
    if (externalId === undefined || claimed.has(externalId)) {
      unmatched.push(row);
      continue;
    }
    claimed.add(externalId);
    payload.push({
      id: row.id,
      name: row.name,
      external_id: externalId,
      ...(parentColumn ? { [parentColumn]: row.parentId } : {}),
    });
  }

  if (payload.length) await upsertInBatches(supabase, table, payload, 'id');
  return { matched: payload.length, unmatched };
}

async function main() {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ---------------------------------------------------------------- 1. fetch
  console.log('Fetching worldwide geography dataset (~46 MB)...');
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Failed to fetch data: ${res.status} ${res.statusText}`);
  const raw = await res.text();
  const countries: DatasetCountry[] = JSON.parse(raw);

  const datasetStates = countries.flatMap((c) => c.states ?? []);
  const datasetCities = datasetStates.flatMap((s) => s.cities ?? []);
  console.log(
    `Parsed ${(raw.length / 1e6).toFixed(1)} MB — ` +
      `${countries.length} countries, ${datasetStates.length} states, ${datasetCities.length} cities`,
  );

  // ------------------------------------------------- 2. reconcile countries
  // Legacy rows must adopt their external_id *before* the load, or the load
  // would insert a second "Colombia" and trip the countries.name unique index.
  console.log('\nReconciling legacy countries...');
  const legacyCountries = await selectAll<{ id: string; name: string }>(
    supabase,
    'countries',
    'id, name',
    (q) => q.is('external_id', null),
  );
  const countryIdByName = new Map(countries.map((c) => [normalizeName(c.name), c.id]));
  const countryReport = await reconcile(
    supabase,
    'countries',
    legacyCountries.map((c) => ({ id: c.id, name: c.name, parentId: null })),
    new Map([[null, countryIdByName]]),
    null,
  );
  console.log(
    `  matched ${countryReport.matched}, unmatched ${countryReport.unmatched.length}` +
      (legacyCountries.length ? '' : ' (nothing legacy to reconcile)'),
  );

  // ------------------------------------------------------- 3. load countries
  console.log('\nLoading countries...');
  await upsertInBatches(
    supabase,
    'countries',
    countries.map((c) => ({
      external_id: c.id,
      name: c.name,
      iso2: c.iso2?.toUpperCase() ?? null,
      iso3: c.iso3?.toUpperCase() ?? null,
      phonecode: c.phonecode || null,
      emoji: c.emoji || null,
    })),
    'external_id',
  );

  const countryRows = await selectAll<{ id: string; external_id: number }>(
    supabase,
    'countries',
    'id, external_id',
    (q) => q.not('external_id', 'is', null),
  );
  const countryUuidByExternalId = new Map(countryRows.map((r) => [r.external_id, r.id]));
  console.log(`  ${countryUuidByExternalId.size} countries in catalog`);

  // ---------------------------------------------------- 4. reconcile states
  console.log('\nReconciling legacy states...');
  const legacyStates = await selectAll<{ id: string; name: string; country_id: string }>(
    supabase,
    'states',
    'id, name, country_id',
    (q) => q.is('external_id', null),
  );
  const statesByCountryUuid = new Map<string | null, Map<string, number>>();
  for (const country of countries) {
    const uuid = countryUuidByExternalId.get(country.id);
    if (!uuid) continue;
    statesByCountryUuid.set(
      uuid,
      new Map((country.states ?? []).map((s) => [normalizeName(s.name), s.id])),
    );
  }
  const stateReport = await reconcile(
    supabase,
    'states',
    legacyStates.map((s) => ({ id: s.id, name: s.name, parentId: s.country_id })),
    statesByCountryUuid,
    'country_id',
  );
  console.log(`  matched ${stateReport.matched}, unmatched ${stateReport.unmatched.length}`);

  // ---------------------------------------------------------- 5. load states
  console.log('\nLoading states...');
  const stateRows: Record<string, unknown>[] = [];
  let skippedStates = 0;
  for (const country of countries) {
    const countryUuid = countryUuidByExternalId.get(country.id);
    if (!countryUuid) {
      console.warn(`\n  no uuid for country ${country.name} (${country.id}) — skipping its states`);
      continue;
    }
    // states carries UNIQUE (country_id, name); keep the first of any duplicate.
    const seen = new Set<string>();
    for (const state of country.states ?? []) {
      const key = normalizeName(state.name);
      if (seen.has(key)) {
        skippedStates++;
        continue;
      }
      seen.add(key);
      stateRows.push({
        external_id: state.id,
        name: state.name,
        country_id: countryUuid,
        state_code: state.iso2 || null,
      });
    }
  }
  await upsertInBatches(supabase, 'states', stateRows, 'external_id');
  if (skippedStates) console.log(`  skipped ${skippedStates} duplicate state names`);

  const stateIdRows = await selectAll<{ id: string; external_id: number }>(
    supabase,
    'states',
    'id, external_id',
    (q) => q.not('external_id', 'is', null),
  );
  const stateUuidByExternalId = new Map(stateIdRows.map((r) => [r.external_id, r.id]));
  console.log(`  ${stateUuidByExternalId.size} states in catalog`);

  // ---------------------------------------------------- 6. reconcile cities
  console.log('\nReconciling legacy cities...');
  const legacyCities = await selectAll<{ id: string; name: string; state_id: string }>(
    supabase,
    'cities',
    'id, name, state_id',
    (q) => q.is('external_id', null),
  );
  const citiesByStateUuid = new Map<string | null, Map<string, number>>();
  for (const state of datasetStates) {
    const uuid = stateUuidByExternalId.get(state.id);
    if (!uuid) continue;
    citiesByStateUuid.set(
      uuid,
      new Map((state.cities ?? []).map((c) => [normalizeName(c.name), c.id])),
    );
  }
  const cityReport = await reconcile(
    supabase,
    'cities',
    legacyCities.map((c) => ({ id: c.id, name: c.name, parentId: c.state_id })),
    citiesByStateUuid,
    'state_id',
  );
  console.log(`  matched ${cityReport.matched}, unmatched ${cityReport.unmatched.length}`);

  // ---------------------------------------------------------- 7. load cities
  console.log('\nLoading cities...');
  const cityRows: Record<string, unknown>[] = [];
  let skippedCities = 0;
  for (const state of datasetStates) {
    const stateUuid = stateUuidByExternalId.get(state.id);
    if (!stateUuid) continue;
    // cities carries UNIQUE (state_id, name); keep the first of any duplicate.
    const seen = new Set<string>();
    for (const city of state.cities ?? []) {
      const key = normalizeName(city.name);
      if (seen.has(key)) {
        skippedCities++;
        continue;
      }
      seen.add(key);
      cityRows.push({ external_id: city.id, name: city.name, state_id: stateUuid });
    }
  }
  await upsertInBatches(supabase, 'cities', cityRows, 'external_id');
  if (skippedCities) console.log(`  skipped ${skippedCities} duplicate city names`);

  // ------------------------------------------------------------- 8. cleanup
  // Legacy rows with no dataset counterpart: drop the ones nothing points at,
  // keep (and report) the ones a branch or a seller profile still references.
  console.log('\nCleaning up unmatched legacy rows...');
  const staleCityIds = cityReport.unmatched.map((c) => c.id);
  const referenced = new Set<string>();
  if (staleCityIds.length) {
    for (const table of ['branches', 'seller_profiles']) {
      const { data, error } = await supabase
        .from(table)
        .select('city_id')
        .in('city_id', staleCityIds);
      if (error) throw error;
      for (const row of (data ?? []) as { city_id: string }[]) referenced.add(row.city_id);
    }
  }

  const deletableCityIds = staleCityIds.filter((id) => !referenced.has(id));
  for (let i = 0; i < deletableCityIds.length; i += BATCH_SIZE) {
    const { error } = await supabase
      .from('cities')
      .delete()
      .in('id', deletableCityIds.slice(i, i + BATCH_SIZE));
    if (error) throw error;
  }

  // A legacy state/country is only removable once it has no children left —
  // deleting one cascades, and a cascade could take a referenced city with it.
  let deletedStates = 0;
  for (const state of stateReport.unmatched) {
    const { count, error } = await supabase
      .from('cities')
      .select('id', { count: 'exact', head: true })
      .eq('state_id', state.id);
    if (error) throw error;
    if (count === 0) {
      const { error: delError } = await supabase.from('states').delete().eq('id', state.id);
      if (delError) throw delError;
      deletedStates++;
    }
  }

  let deletedCountries = 0;
  for (const country of countryReport.unmatched) {
    const { count, error } = await supabase
      .from('states')
      .select('id', { count: 'exact', head: true })
      .eq('country_id', country.id);
    if (error) throw error;
    if (count === 0) {
      const { error: delError } = await supabase.from('countries').delete().eq('id', country.id);
      if (delError) throw delError;
      deletedCountries++;
    }
  }

  // --------------------------------------------------------------- 9. report
  console.log('\n--- Summary ---');
  console.log(`Countries: ${countries.length} loaded, ${countryReport.matched} legacy reconciled`);
  console.log(`States:    ${stateRows.length} loaded, ${stateReport.matched} legacy reconciled`);
  console.log(`Cities:    ${cityRows.length} loaded, ${cityReport.matched} legacy reconciled`);
  console.log(
    `Removed unmatched legacy rows: ${deletableCityIds.length} cities, ` +
      `${deletedStates} states, ${deletedCountries} countries`,
  );

  if (referenced.size) {
    console.log(
      `\nKept ${referenced.size} unmatched legacy cities because branches/seller_profiles ` +
        'still reference them — review manually:',
    );
    for (const city of cityReport.unmatched.filter((c) => referenced.has(c.id))) {
      console.log(`  ${city.name} (${city.id})`);
    }
  }

  const leftoverStates = stateReport.unmatched.length - deletedStates;
  if (leftoverStates > 0) {
    console.log(`\nKept ${leftoverStates} unmatched legacy states that still have cities.`);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
