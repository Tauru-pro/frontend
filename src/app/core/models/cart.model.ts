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

export interface CartItemResponse {
  id: string;
  productId: string;
  quantity: number;
}

export interface CartResponse {
  id: string;
  items: CartItemResponse[];
}
