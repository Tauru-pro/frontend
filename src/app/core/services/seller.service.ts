import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PresignedUrlResponse,
  SellerProfile,
  UpdateSellerProfileDto,
} from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class SellerService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  getMyProfile(): Observable<SellerProfile> {
    return this.http.get<SellerProfile>(`${this.baseUrl}/seller-profile/me`);
  }

  updateMyProfile(dto: UpdateSellerProfileDto): Observable<SellerProfile> {
    return this.http.patch<SellerProfile>(`${this.baseUrl}/users/seller-profile`, dto);
  }

  getPresignedUrl(fileName: string, contentType: string): Observable<PresignedUrlResponse> {
    return this.http.get<PresignedUrlResponse>(`${this.baseUrl}/uploads/presigned-url`, {
      params: { fileName, contentType },
    });
  }

  uploadToS3(presignedUrl: string, file: File): Observable<void> {
    const headers = new HttpHeaders({ 'Content-Type': file.type });
    return this.http.put<void>(presignedUrl, file, { headers });
  }
}
