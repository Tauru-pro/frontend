import { inject, Injectable } from '@angular/core';
import { PaginatedResponse } from '../models/product.model';
import { CreateUserDto, SellerProfile, UserProfile } from '../models/user.model';
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

interface SellerProfileWithOwnerRow {
  id: string;
  user_id: string;
  business_name: string | null;
  contact_phone: string | null;
  logo_key: string | null;
  address: string | null;
  status: SellerProfile['status'];
  profiles: { email: string; created_at: string } | null;
}

function mapSellerProfileWithOwnerRow(row: SellerProfileWithOwnerRow): SellerProfile {
  return {
    id: row.id,
    userId: row.user_id,
    bussinesName: row.business_name ?? '',
    contactPhone: row.contact_phone ?? undefined,
    logoKey: row.logo_key ?? '',
    address: row.address ?? undefined,
    status: row.status,
    email: row.profiles?.email,
    createdAt: row.profiles?.created_at,
  };
}

@Injectable({ providedIn: 'root' })
export class UserService {
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

  async getSellers(page = 1, limit = 10): Promise<PaginatedResponse<SellerProfile>> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await this.supabase
      .from('seller_profiles')
      .select('*, profiles!inner(email, created_at)', { count: 'exact' })
      .order('business_name', { ascending: true })
      .range(from, to);
    if (error) throw error;

    const total = count ?? 0;
    return {
      data: (data as unknown as SellerProfileWithOwnerRow[]).map(mapSellerProfileWithOwnerRow),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createUser(dto: CreateUserDto): Promise<void> {
    const { error } = await this.supabase.functions.invoke('admin-create-user', { body: dto });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      throw new Error(status === 409 ? 'EMAIL_EXISTS' : error.message);
    }
  }
}
