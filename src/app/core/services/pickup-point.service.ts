import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../models/product.model';
import { PickupPoint, CreatePickupPointDto, UpdatePickupPointDto } from '../models/pickup-point.model';

@Injectable({ providedIn: 'root' })
export class PickupPointService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/pickup-points`;

  getAll(page = 1, limit = 10): Observable<PaginatedResponse<PickupPoint>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    return this.http.get<PaginatedResponse<PickupPoint>>(this.apiUrl, { params });
  }

  getOne(id: string): Observable<PickupPoint> {
    return this.http.get<PickupPoint>(`${this.apiUrl}/${id}`);
  }

  create(dto: CreatePickupPointDto): Observable<PickupPoint> {
    return this.http.post<PickupPoint>(this.apiUrl, dto);
  }

  update(id: string, dto: UpdatePickupPointDto): Observable<PickupPoint> {
    return this.http.patch<PickupPoint>(`${this.apiUrl}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
