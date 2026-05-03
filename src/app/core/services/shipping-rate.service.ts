import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../models/product.model';
import { ShippingRate, CreateShippingRateDto, UpdateShippingRateDto } from '../models/shipping-rate.model';

@Injectable({ providedIn: 'root' })
export class ShippingRateService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/shipping-rates`;

  getAll(page = 1, limit = 10): Observable<PaginatedResponse<ShippingRate>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    return this.http.get<PaginatedResponse<ShippingRate>>(this.apiUrl, { params });
  }

  getOne(id: string): Observable<ShippingRate> {
    return this.http.get<ShippingRate>(`${this.apiUrl}/${id}`);
  }

  create(dto: CreateShippingRateDto): Observable<ShippingRate> {
    return this.http.post<ShippingRate>(this.apiUrl, dto);
  }

  update(id: string, dto: UpdateShippingRateDto): Observable<ShippingRate> {
    return this.http.patch<ShippingRate>(`${this.apiUrl}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
