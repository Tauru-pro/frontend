import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  withComputed,
  withHooks,
  patchState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { Bull, BullMedia, BullStraw, StrawType } from '../models/bull.model';
import { CartService } from '../services/cart.service';

export interface CartItem {
  bull: {
    id: string;
    sellerId: string;
    name: string;
    breed: string;
    media: BullMedia[];
  };
  selectedStraw: {
    id: string;
    strawType: StrawType;
    price: number;
    minOrderQuantity: number;
  };
  quantity: number;
}

interface CartState {
  items: CartItem[];
  loading: boolean;
  error: string | null;
}

export const CartStore = signalStore(
  { providedIn: 'root' },
  withState<CartState>({ items: [], loading: false, error: null }),
  withComputed((store) => ({
    count: computed(() => store.items().reduce((sum, i) => sum + i.quantity, 0)),
    total: computed(() =>
      store.items().reduce((sum, i) => sum + i.selectedStraw.price * i.quantity, 0)
    ),
  })),
  withMethods((store) => {
    const cartService = inject(CartService);
    return {
      async loadCart(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          await firstValueFrom(cartService.getCart());
          patchState(store, { loading: false });
        } catch {
          patchState(store, { loading: false });
        }
      },

      async addItem(bull: Bull, straw: BullStraw, qty = 1): Promise<void> {
        const effectiveQty = Math.max(qty, straw.minOrderQuantity);
        const current = store.items();
        const idx = current.findIndex(
          (i) => i.bull.id === bull.id && i.selectedStraw.id === straw.id
        );
        const snapshot = current;
        if (idx >= 0) {
          const updated = [...current];
          updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + effectiveQty };
          patchState(store, { items: updated });
        } else {
          patchState(store, {
            items: [...current, { bull, selectedStraw: straw, quantity: effectiveQty }],
          });
        }
        try {
          await firstValueFrom(
            cartService.addItem({ productId: straw.id, quantity: effectiveQty })
          );
          patchState(store, { error: null });
        } catch {
          patchState(store, { items: snapshot, error: 'No se pudo agregar el ítem al carrito.' });
        }
      },

      async updateQuantity(bullId: string, strawId: string, qty: number): Promise<void> {
        const snapshot = store.items();
        const item = snapshot.find((i) => i.bull.id === bullId && i.selectedStraw.id === strawId);
        const min = item?.selectedStraw.minOrderQuantity ?? 1;
        if (qty < min) return;
        const updated = snapshot.map((i) =>
          i.bull.id === bullId && i.selectedStraw.id === strawId ? { ...i, quantity: qty } : i
        );
        patchState(store, { items: updated });
        try {
          await firstValueFrom(cartService.updateItem(strawId, { quantity: qty }));
          patchState(store, { error: null });
        } catch {
          patchState(store, { items: snapshot, error: 'No se pudo actualizar la cantidad.' });
        }
      },

      async removeItem(bullId: string, strawId: string): Promise<void> {
        const snapshot = store.items();
        patchState(store, {
          items: snapshot.filter(
            (i) => !(i.bull.id === bullId && i.selectedStraw.id === strawId)
          ),
        });
        try {
          await firstValueFrom(cartService.removeItem(strawId));
          patchState(store, { error: null });
        } catch {
          patchState(store, { items: snapshot, error: 'No se pudo eliminar el ítem.' });
        }
      },

      async clear(): Promise<void> {
        const snapshot = store.items();
        patchState(store, { items: [] });
        try {
          await firstValueFrom(cartService.clearCart());
          patchState(store, { error: null });
        } catch {
          patchState(store, { items: snapshot, error: 'No se pudo vaciar el carrito.' });
        }
      },
    };
  }),
  withHooks({
    onInit(store) {
      store.loadCart();
    },
  })
);
