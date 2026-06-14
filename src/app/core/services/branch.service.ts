import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Branch, CreateBranchDto, UpdateBranchDto, BranchStatus } from '../models/branch.model';
import { PaginatedResponse } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class BranchService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/branches`;

  getMyBranches(page = 1, limit = 10, status?: BranchStatus): Observable<PaginatedResponse<Branch>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    if (status) params = params.set('status', status);
    return this.http.get<PaginatedResponse<Branch>>(this.apiUrl, { params });
  }

  getBranch(id: string): Observable<Branch> {
    return this.http.get<Branch>(`${this.apiUrl}/${id}`);
  }

  createBranch(dto: CreateBranchDto): Observable<Branch> {
    return this.http.post<Branch>(this.apiUrl, dto);
  }

  updateBranch(id: string, dto: UpdateBranchDto): Observable<Branch> {
    return this.http.patch<Branch>(`${this.apiUrl}/${id}`, dto);
  }

  deleteBranch(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  setMain(id: string): Observable<Branch> {
    return this.http.patch<Branch>(`${this.apiUrl}/${id}/set-main`, null);
  }
}
