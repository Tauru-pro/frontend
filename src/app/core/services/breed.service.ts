import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Breed, CreateBreedDto, UpdateBreedDto } from '../models/breed.model';

@Injectable({ providedIn: 'root' })
export class BreedService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/breeds`;

  getAll(): Observable<Breed[]> {
    return this.http.get<Breed[]>(this.apiUrl);
  }

  getOne(id: string): Observable<Breed> {
    return this.http.get<Breed>(`${this.apiUrl}/${id}`);
  }

  create(dto: CreateBreedDto): Observable<Breed> {
    return this.http.post<Breed>(this.apiUrl, dto);
  }

  update(id: string, dto: UpdateBreedDto): Observable<Breed> {
    return this.http.patch<Breed>(`${this.apiUrl}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
