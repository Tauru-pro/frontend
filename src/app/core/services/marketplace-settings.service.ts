import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MarketplaceSettings, UpdateMarketplaceSettingsDto } from '../models/marketplace-settings.model';

@Injectable({ providedIn: 'root' })
export class MarketplaceSettingsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/marketplace/settings`;

  getSettings(): Observable<MarketplaceSettings> {
    return this.http.get<MarketplaceSettings>(this.apiUrl);
  }

  updateSettings(dto: UpdateMarketplaceSettingsDto): Observable<MarketplaceSettings> {
    return this.http.patch<MarketplaceSettings>(this.apiUrl, dto);
  }

  requestLogoUpload(mimeType: string): Observable<{ uploadUrl: string; s3Key: string }> {
    return this.http.post<{ uploadUrl: string; s3Key: string }>(
      `${this.apiUrl}/logo/upload-url`,
      { mimeType },
    );
  }

  confirmLogoUpload(s3Key: string): Observable<MarketplaceSettings> {
    return this.http.post<MarketplaceSettings>(`${this.apiUrl}/logo/confirm`, { s3Key });
  }

  removeLogo(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/logo`);
  }
}
