import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { Breed, CreateBreedDto, UpdateBreedDto } from '../models/breed.model';
import { SupabaseClientService } from '../auth/supabase-client';

interface BreedRow {
  id: string;
  name: string;
  purpose: Breed['purpose'];
  created_at: string;
  updated_at: string;
}

function mapBreedRow(row: BreedRow): Breed {
  return {
    id: row.id,
    name: row.name,
    purpose: row.purpose,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable({ providedIn: 'root' })
export class BreedService {
  private supabase = inject(SupabaseClientService).client;

  getAll(): Observable<Breed[]> {
    return from(
      this.supabase.from('breeds').select('*').order('name', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data as BreedRow[]).map(mapBreedRow);
      })
    );
  }

  getOne(id: string): Observable<Breed> {
    return from(this.supabase.from('breeds').select('*').eq('id', id).single()).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return mapBreedRow(data as BreedRow);
      })
    );
  }

  async create(dto: CreateBreedDto): Promise<Breed> {
    const { data, error } = await this.supabase.from('breeds').insert(dto).select().single();
    if (error) throw new Error(error.code === '23505' ? 'DUPLICATE_NAME' : error.message);
    return mapBreedRow(data as BreedRow);
  }

  async update(id: string, dto: UpdateBreedDto): Promise<Breed> {
    const { data, error } = await this.supabase
      .from('breeds')
      .update(dto)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.code === '23505' ? 'DUPLICATE_NAME' : error.message);
    return mapBreedRow(data as BreedRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('breeds').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}
