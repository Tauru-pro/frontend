// Seed Colombia geography: country → 33 departments (states) → ~1120 municipalities (cities).
// Source: https://raw.githubusercontent.com/marcovega/colombia-json/master/colombia.min.json
//
// Run with: npm run seed:geography
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Idempotent: uses upsert with onConflict so re-running is safe.
import { createClient } from '@supabase/supabase-js';

const DATA_URL =
  'https://raw.githubusercontent.com/marcovega/colombia-json/master/colombia.min.json';

interface ColombiaEntry {
  departamento: string;
  ciudades: string[];
}

async function main() {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // 1. Fetch Colombia JSON
  console.log('Fetching Colombia geography data...');
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Failed to fetch data: ${res.statusText}`);
  const entries: ColombiaEntry[] = await res.json();
  console.log(`Got ${entries.length} departments`);

  // 2. Upsert Colombia
  const { data: country, error: countryErr } = await supabase
    .from('countries')
    .upsert({ name: 'Colombia' }, { onConflict: 'name' })
    .select('id')
    .single();
  if (countryErr) throw countryErr;
  const countryId = country.id as string;
  console.log(`Country upserted — id: ${countryId}`);

  // 3. Upsert departments
  const { data: states, error: statesErr } = await supabase
    .from('states')
    .upsert(
      entries.map((e) => ({ name: e.departamento, country_id: countryId })),
      { onConflict: 'country_id,name' },
    )
    .select('id, name');
  if (statesErr) throw statesErr;
  console.log(`Upserted ${states.length} departments`);

  const stateByName = new Map<string, string>(
    (states as { id: string; name: string }[]).map((s) => [s.name, s.id]),
  );

  // 4. Upsert cities per department (one batch per department)
  let totalCities = 0;
  for (const entry of entries) {
    const stateId = stateByName.get(entry.departamento);
    if (!stateId) {
      console.warn(`Unknown department (no id): ${entry.departamento}`);
      continue;
    }
    // Deduplicate city names within the same department (source JSON may repeat names).
    const unique = [...new Set(entry.ciudades)];
    const cityRows = unique.map((c) => ({ name: c, state_id: stateId }));
    const { error: citiesErr } = await supabase
      .from('cities')
      .upsert(cityRows, { onConflict: 'state_id,name' });
    if (citiesErr) throw citiesErr;
    totalCities += cityRows.length;
  }

  console.log(`Done! Upserted ${totalCities} cities across ${entries.length} departments.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
