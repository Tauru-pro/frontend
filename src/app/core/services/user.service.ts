import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../models/product.model';
import { CreateUserDto, SellerProfile, UpdateUserDto, UserProfile } from '../models/user.model';
import { RoutesApp } from '../../shared/const/routes';

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/${RoutesApp.admin}/users`;

  getUsers(page = 1, limit = 10): Observable<PaginatedResponse<UserProfile>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    return this.http.get<PaginatedResponse<UserProfile>>(this.apiUrl, { params });
  }

  getSellers(page = 1, limit = 10): Observable<PaginatedResponse<SellerProfile>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    const url = `${environment.apiUrl}/${RoutesApp.admin}/${RoutesApp.sellers}`;
    return this.http.get<PaginatedResponse<SellerProfile>>(url, { params });
  }

  getUser(id: string): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}/${id}`);
  }

  createUser(dto: CreateUserDto): Observable<UserProfile> {
    return this.http.post<UserProfile>(`${this.apiUrl}/create`, dto);
  }

}
