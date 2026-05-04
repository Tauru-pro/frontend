import { BullMedia, StrawType } from './bull.model';

export interface AddCartItemDto {
  productId: string;
  quantity: number;
}

export interface UpdateCartItemDto {
  quantity: number;
}

export interface MergeCartDto {
  sessionId: string;
}

export interface CartItemBullResponse {
  id: string;
  name: string;
  s3key: string;
}

export interface CartItemStrawResponse {
  id: string;
  strawType: StrawType;
  price: number;
  minOrderQuantity: number;
}

export interface CartItemResponse {
  productType: string;
  bull: CartItemBullResponse;
  selectedStraw: CartItemStrawResponse;
  quantity: number;
}

export interface CartResponse {
  id?: string;
  items: CartItemResponse[];
}

export interface CheckoutFromCartDto {
  buyerFullName: string;
  buyerEmail: string;
  buyerPhone?: string;
  buyerCity?: string;
  buyerAddress?: string;
  pickupPointId: string;
  containerId?: string;
  notes?: string;
}

export interface OrderResponse {
  id: string;
  paymentUrl: string;
}
