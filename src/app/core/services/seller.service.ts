import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  SellerProfile,
  UpdateSellerProfileDto,
} from '../models/user.model';
import { ResponseUploadDto } from '../models/upload.model';

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

  getPresignedUrl(mimeType: string): Observable<ResponseUploadDto> {
    return this.http.post<ResponseUploadDto>(`${this.baseUrl}/users/seller-profile/logo/presign`, { mimeType });
  }


  confirm(s3Key: string): Observable<SellerProfile> {
    return this.http.post<SellerProfile>(`${this.baseUrl}/users/seller-profile/logo/confirm`, { s3Key });
  }
}
