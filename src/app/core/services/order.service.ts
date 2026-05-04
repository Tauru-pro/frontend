import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import { CheckoutFromCartDto, OrderResponse } from "../models/cart.model";
import { Observable } from "rxjs";

export interface ShippingEstimateResponse {
    pickupPoint: PickupPoint;
    breakdown: Breakdown[];
    totalShipping: number;
}

export interface Breakdown {
    sellerId: string;
    sellerName: string;
    originState: string;
    shippingCost: number;
}

export interface PickupPoint {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/orders`;

    checkoutFromCart(dto: CheckoutFromCartDto): Observable<OrderResponse> {
        return this.http.post<OrderResponse>(`${this.apiUrl}/checkout`, dto);
    }

    getShippingEstimate(pickupPointId: string): Observable<ShippingEstimateResponse> {
        const params = new HttpParams().set('pickupPointId', pickupPointId);
        return this.http.get<ShippingEstimateResponse>(`${this.apiUrl}/shipping-estimate`, { params });
    }
}