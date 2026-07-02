import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { City, State } from '../models/location.model';
import { SupabaseClientService } from '../auth/supabase-client';

interface StateRow {
  id: string;
  name: string;
  country_id: string;
}

interface CityRow {
  id: string;
  name: string;
  // Supabase returns embedded relations as arrays even for !inner (single-match) joins.
  states: { id: string; name: string }[];
}

@Injectable({ providedIn: 'root' })
export class LocationService {
  private supabase = inject(SupabaseClientService).client;

  getStates(countryName = 'Colombia'): Observable<State[]> {
    const query = this.supabase
      .from('states')
      .select('id, name, country_id, countries!inner(name)')
      .eq('countries.name', countryName)
      .order('name', { ascending: true });

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

  getCities(stateName: string): Observable<City[]> {
    const query = this.supabase
      .from('cities')
      .select('id, name, states!inner(id, name)')
      .eq('states.name', stateName)
      .order('name', { ascending: true });

    return from(query).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data as CityRow[]).map((row) => ({
          id: row.id,
          name: row.name,
          state: row.states[0] ?? { id: '', name: '' },
        }));
      }),
    );
  }
}
