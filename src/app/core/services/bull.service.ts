import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Bull,
  BullStatus,
  CreateBullDto,
  CreateBullStrawDto,
  BullStraw,
  BullMedia,
  PaginatedBulls,
  UpdateBullDto,
  UpdateBullStrawDto,
} from '../models/bull.model';
import { ConfirmMediaUploadDto, RequestUploadUrlDto, ResponseUploadDto } from '../models/upload.model';

@Injectable({ providedIn: 'root' })
export class BullService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/bulls`;

  getMyBulls(page = 1, limit = 10, status?: BullStatus): Observable<PaginatedBulls> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    if (status) params = params.set('status', status);
    return this.http.get<PaginatedBulls>(`${this.apiUrl}/me`, { params });
  }

  getCatalogBulls(page = 1, limit = 12, breed?: string, minPrice?: number, maxPrice?: number): Observable<PaginatedBulls> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString())
      .set('status', 'ACTIVE');
    if (breed) params = params.set('breed', breed);
    if (minPrice != null) params = params.set('minPrice', minPrice.toString());
    if (maxPrice != null) params = params.set('maxPrice', maxPrice.toString());
    return this.http.get<PaginatedBulls>(this.apiUrl, { params });
  }

  getBull(id: string): Observable<Bull> {
    return this.http.get<Bull>(`${this.apiUrl}/${id}`);
  }

  createBull(dto: CreateBullDto): Observable<Bull> {
    return this.http.post<Bull>(this.apiUrl, dto);
  }

  updateBull(id: string, dto: UpdateBullDto): Observable<Bull> {
    return this.http.patch<Bull>(`${this.apiUrl}/${id}`, dto);
  }

  deleteBull(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  createStraw(bullId: string, dto: CreateBullStrawDto): Observable<BullStraw> {
    return this.http.post<BullStraw>(`${this.apiUrl}/${bullId}/straws`, dto);
  }

  updateStraw(bullId: string, strawId: string, dto: UpdateBullStrawDto): Observable<BullStraw> {
    return this.http.patch<BullStraw>(`${this.apiUrl}/${bullId}/straws/${strawId}`, dto);
  }

  deleteStraw(bullId: string, strawId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${bullId}/straws/${strawId}`);
  }

  requestPresignedUrl(id: string, body: RequestUploadUrlDto): Observable<ResponseUploadDto> {
    return this.http.post<ResponseUploadDto>(`${this.apiUrl}/${id}/media/presign`, body);
  }

  confirmMediaUpload(id: string, body: ConfirmMediaUploadDto): Observable<BullMedia> {
    return this.http.post<BullMedia>(`${this.apiUrl}/${id}/media/confirm`, body);
  }

  deleteMedia(id: string, mediaId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}/media/${mediaId}`);
  }

  setCoverImage(id: string, mediaId: string): Observable<BullMedia> {
    return this.http.patch<BullMedia>(`${this.apiUrl}/${id}/media/${mediaId}/cover`, null);
  }
}
