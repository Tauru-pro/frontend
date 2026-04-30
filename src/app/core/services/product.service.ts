import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateProductDto,
  PaginatedResponse,
  Product,
  ProductMedia,
  ProductStatus,
  UpdateProductDto,
} from '../models/product.model';
import { ConfirmMediaUploadDto, RequestUploadUrlDto, ResponseUploadDto } from '../models/upload.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/products`;

  getMyProducts(
    page = 1,
    limit = 10,
    status?: ProductStatus,
  ): Observable<PaginatedResponse<Product>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    if (status) params = params.set('status', status);
    return this.http.get<PaginatedResponse<Product>>(`${this.apiUrl}/me`, { params });
  }

  getProduct(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`);
  }

  createProduct(dto: CreateProductDto): Observable<Product> {
    return this.http.post<Product>(this.apiUrl, dto);
  }

  updateProduct(id: string, dto: UpdateProductDto): Observable<Product> {
    return this.http.patch<Product>(`${this.apiUrl}/${id}`, dto);
  }

  deleteProduct(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  requestPresignedUrl(id: string, body: RequestUploadUrlDto) {
    return this.http.post<ResponseUploadDto>(`${this.apiUrl}/${id}/media/presign`, body)
  }

  confirmMediaUpload(id: string, body: ConfirmMediaUploadDto) {
    return this.http.post<ProductMedia>(`${this.apiUrl}/${id}/media/confirm`, body)
  }

  deleteMedia(id: string, mediaId: string) {
    return this.http.delete<void>(`${this.apiUrl}/${id}/media/${mediaId}`)
  }

  setCoverImage(id: string, mediaId: string) {
    return this.http.patch<ProductMedia>(`${this.apiUrl}/${id}/media/${mediaId}/cover`, null)
  }

}
