import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Supply, CreateSupplyDto, UpdateSupplyDto } from '../models/supply.model';
import { PaginatedResponse } from '../models/product.model';
import { RequestUploadUrlDto, ResponseUploadDto, ConfirmMediaUploadDto } from '../models/upload.model';
import { SupplyMedia } from '../models/supply.model';

@Injectable({ providedIn: 'root' })
export class SupplyService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/supplies`;

  getMySupplies(page = 1, limit = 10): Observable<PaginatedResponse<Supply>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    return this.http.get<PaginatedResponse<Supply>>(this.apiUrl, { params });
  }

  getSupply(id: string): Observable<Supply> {
    return this.http.get<Supply>(`${this.apiUrl}/${id}`);
  }

  createSupply(dto: CreateSupplyDto): Observable<Supply> {
    return this.http.post<Supply>(this.apiUrl, dto);
  }

  updateSupply(id: string, dto: UpdateSupplyDto): Observable<Supply> {
    return this.http.patch<Supply>(`${this.apiUrl}/${id}`, dto);
  }

  deleteSupply(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  activateSupply(id: string): Observable<Supply> {
    return this.http.patch<Supply>(`${this.apiUrl}/${id}/activate`, null);
  }

  requestPresignedUrl(id: string, body: RequestUploadUrlDto): Observable<ResponseUploadDto> {
    return this.http.post<ResponseUploadDto>(`${this.apiUrl}/${id}/media/presign`, body);
  }

  confirmMediaUpload(id: string, body: ConfirmMediaUploadDto): Observable<SupplyMedia> {
    return this.http.post<SupplyMedia>(`${this.apiUrl}/${id}/media/confirm`, body);
  }

  deleteMedia(id: string, mediaId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}/media/${mediaId}`);
  }

  setCoverImage(id: string, mediaId: string): Observable<SupplyMedia> {
    return this.http.patch<SupplyMedia>(`${this.apiUrl}/${id}/media/${mediaId}/cover`, null);
  }
}
