import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../models/product.model';
import { CreateUserDto, SellerProfile, UserProfile } from '../models/user.model';
import { RoutesApp } from '../../shared/const/routes';
import { SupabaseClientService } from '../auth/supabase-client';

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: UserProfile['role'];
  status: UserProfile['status'];
  created_at: string;
}

function mapProfileRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name ?? undefined,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  };
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private supabase = inject(SupabaseClientService).client;

  async getUsers(page = 1, limit = 10): Promise<PaginatedResponse<UserProfile>> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await this.supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;

    const total = count ?? 0;
    return {
      data: (data as ProfileRow[]).map(mapProfileRow),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Sellers are still managed by the legacy backend (out of scope for the
  // Supabase auth migration), so this keeps hitting environment.apiUrl.
  getSellers(page = 1, limit = 10): Observable<PaginatedResponse<SellerProfile>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    const url = `${environment.apiUrl}/${RoutesApp.admin}/${RoutesApp.sellers}`;
    return this.http.get<PaginatedResponse<SellerProfile>>(url, { params });
  }

  async createUser(dto: CreateUserDto): Promise<void> {
    const { error } = await this.supabase.functions.invoke('admin-create-user', { body: dto });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      throw new Error(status === 409 ? 'EMAIL_EXISTS' : error.message);
    }
  }
}
