import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AddCartItemDto,
  CartResponse,
  CheckoutFromCartDto,
  MergeCartDto,
  OrderResponse,
  UpdateCartItemDto,
} from '../models/cart.model';

@Injectable({ providedIn: 'root' })
export class CartService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/cart`;

  getCart(): Observable<CartResponse> {
    return this.http.get<CartResponse>(this.apiUrl);
  }

  addItem(dto: AddCartItemDto): Observable<CartResponse> {
    return this.http.post<CartResponse>(`${this.apiUrl}/items`, dto);
  }

  updateItem(productId: string, dto: UpdateCartItemDto): Observable<CartResponse> {
    return this.http.patch<CartResponse>(`${this.apiUrl}/items/${productId}`, dto);
  }

  removeItem(productId: string): Observable<CartResponse> {
    return this.http.delete<CartResponse>(`${this.apiUrl}/items/${productId}`);
  }

  clearCart(): Observable<void> {
    return this.http.delete<void>(this.apiUrl);
  }

  validateCart(): Observable<unknown> {
    return this.http.post<unknown>(`${this.apiUrl}/validate`, null);
  }

  mergeCart(dto: MergeCartDto): Observable<CartResponse> {
    return this.http.post<CartResponse>(`${this.apiUrl}/merge`, dto);
  }


}
