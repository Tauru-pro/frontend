import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { City, State } from '../models/location.model';

@Injectable({ providedIn: 'root' })
export class LocationService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/locations`;

  getStates(name?: string): Observable<State[]> {
    let params = new HttpParams();
    if (name) params = params.set('name', name);
    return this.http.get<State[]>(`${this.base}/states`, { params });
  }

  getCities(stateId: string, name?: string): Observable<City[]> {
    let params = new HttpParams();
    if (name) params = params.set('name', name);
    return this.http.get<City[]>(`${this.base}/states/${stateId}/cities`, { params });
  }
}
