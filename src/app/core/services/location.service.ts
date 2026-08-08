import { inject, Injectable } from '@angular/core';
import { from, map, Observable, shareReplay } from 'rxjs';
import { City, CityLocation, Country, State } from '../models/location.model';
import { SupabaseClientService } from '../auth/supabase-client';

// Every lookup filters by parent id, never by name: the catalog is worldwide and
// state names repeat across countries ("Córdoba" exists in Colombia, Argentina
// and Spain), so a name filter would mix cities from unrelated countries.

interface CountryRow {
  id: string;
  name: string;
  iso2: string;
  iso3: string | null;
  phonecode: string | null;
  emoji: string | null;
}

interface StateRow {
  id: string;
  name: string;
  country_id: string;
}

interface CityRow {
  id: string;
  name: string;
  state_id: string;
}

// The largest states in the catalog hold several thousand cities, well past the
// 1000-row default PostgREST applies when no limit is given.
const ROW_LIMIT = 10000;

@Injectable({ providedIn: 'root' })
export class LocationService {
  private supabase = inject(SupabaseClientService).client;

  // Cached: a screen can hold several country selectors at once (the location
  // selector plus one phone input per phone field), and the catalog is
  // read-only, so one fetch per session serves them all.
  private countries$?: Observable<Country[]>;

  getCountries(): Observable<Country[]> {
    if (!this.countries$) {
      const query = this.supabase
        .from('countries')
        .select('id, name, iso2, iso3, phonecode, emoji')
        .not('iso2', 'is', null)
        .order('name', { ascending: true })
        .limit(500);

      this.countries$ = from(query).pipe(
        map(({ data, error }) => {
          if (error) throw error;
          return (data as CountryRow[]).map(toCountry);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.countries$;
  }

  getCountryByIso2(iso2: string): Observable<Country | null> {
    const query = this.supabase
      .from('countries')
      .select('id, name, iso2, iso3, phonecode, emoji')
      .eq('iso2', iso2.toUpperCase())
      .maybeSingle();

    return from(query).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data ? toCountry(data as CountryRow) : null;
      }),
    );
  }

  getStates(countryId: string): Observable<State[]> {
    const query = this.supabase
      .from('states')
      .select('id, name, country_id')
      .eq('country_id', countryId)
      .order('name', { ascending: true })
      .limit(ROW_LIMIT);

    return from(query).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data as StateRow[]).map((row) => ({
          id: row.id,
          name: row.name,
          countryId: row.country_id,
        }));
      }),
    );
  }

  getCities(stateId: string): Observable<City[]> {
    const query = this.supabase
      .from('cities')
      .select('id, name, state_id')
      .eq('state_id', stateId)
      .order('name', { ascending: true })
      .limit(ROW_LIMIT);

    return from(query).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data as CityRow[]).map((row) => ({
          id: row.id,
          name: row.name,
          stateId: row.state_id,
        }));
      }),
    );
  }

  /**
   * Walks a city up to its state and country. Records only store `city_id`, so
   * an edit form needs this to preselect the country and state combos.
   */
  getCityLocation(cityId: string): Observable<CityLocation | null> {
    const query = this.supabase
      .from('cities')
      .select('id, state_id, states!inner(country_id)')
      .eq('id', cityId)
      .maybeSingle();

    return from(query).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        if (!data) return null;
        const row = data as unknown as {
          id: string;
          state_id: string;
          // Supabase types embedded relations as arrays even for a single match.
          states: { country_id: string } | { country_id: string }[];
        };
        const state = Array.isArray(row.states) ? row.states[0] : row.states;
        if (!state) return null;
        return { cityId: row.id, stateId: row.state_id, countryId: state.country_id };
      }),
    );
  }
}

function toCountry(row: CountryRow): Country {
  return {
    id: row.id,
    name: row.name,
    iso2: row.iso2,
    iso3: row.iso3 ?? undefined,
    phonecode: row.phonecode ?? '',
    emoji: row.emoji ?? '',
  };
}
