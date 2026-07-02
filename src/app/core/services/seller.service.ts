import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SellerProfile, UpdateSellerProfileDto } from '../models/user.model';
import { ResponseUploadDto } from '../models/upload.model';
import { SupabaseClientService } from '../auth/supabase-client';

interface SellerProfileRow {
  id: string;
  user_id: string;
  business_name: string | null;
  description: string | null;
  country: string | null;
  business_hours: string | null;
  contact_phone: string | null;
  logo_key: string | null;
  address: string | null;
  status: SellerProfile['status'];
}

function mapSellerProfileRow(row: SellerProfileRow): SellerProfile {
  return {
    id: row.id,
    userId: row.user_id,
    bussinesName: row.business_name ?? '',
    description: row.description ?? undefined,
    country: row.country ?? undefined,
    businessHours: row.business_hours ?? undefined,
    contactPhone: row.contact_phone ?? undefined,
    logoKey: row.logo_key ?? '',
    address: row.address ?? undefined,
    status: row.status,
  };
}

@Injectable({ providedIn: 'root' })
export class SellerService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;
  private supabase = inject(SupabaseClientService).client;

  private async currentUserId(): Promise<string> {
    const { data } = await this.supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) throw new Error('Not authenticated');
    return userId;
  }

  async getMyProfile(): Promise<SellerProfile | null> {
    const userId = await this.currentUserId();
    const { data, error } = await this.supabase
      .from('seller_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapSellerProfileRow(data as SellerProfileRow) : null;
  }

  // Self-service: creates the store record on first save, updates it on
  // every subsequent save (ON CONFLICT (user_id) requires the unique
  // constraint added alongside this).
  async updateMyProfile(dto: UpdateSellerProfileDto): Promise<SellerProfile> {
    const userId = await this.currentUserId();

    const row: Record<string, unknown> = { user_id: userId };
    if (dto.bussinesName !== undefined) row['business_name'] = dto.bussinesName;
    if (dto.description !== undefined) row['description'] = dto.description;
    if (dto.country !== undefined) row['country'] = dto.country;
    if (dto.businessHours !== undefined) row['business_hours'] = dto.businessHours;
    if (dto.contactPhone !== undefined) row['contact_phone'] = dto.contactPhone;
    if (dto.cityId !== undefined) row['city_id'] = dto.cityId;
    if (dto.address !== undefined) row['address'] = dto.address;
    if (dto.logoKey !== undefined) row['logo_key'] = dto.logoKey;

    const { data, error } = await this.supabase
      .from('seller_profiles')
      .upsert(row, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapSellerProfileRow(data as SellerProfileRow);
  }

  // Needs the legacy backend's AWS-credentialed presign endpoint —
  // out of scope to migrate file storage here.
  getPresignedUrl(mimeType: string): Observable<ResponseUploadDto> {
    return this.http.post<ResponseUploadDto>(
      `${this.baseUrl}/users/seller-profile/logo/presign`,
      { mimeType }
    );
  }

  // Persists directly to Supabase (upsert, same reasoning as
  // updateMyProfile) instead of the legacy /logo/confirm endpoint, which
  // would write to a database the app no longer reads.
  async confirm(s3Key: string): Promise<void> {
    const userId = await this.currentUserId();
    const { error } = await this.supabase
      .from('seller_profiles')
      .upsert({ user_id: userId, logo_key: s3Key }, { onConflict: 'user_id' });
    if (error) throw new Error(error.message);
  }
}
