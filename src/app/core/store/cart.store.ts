import { computed } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { Bull, BullStraw } from '../models/bull.model';

export interface CartItem {
  bull: Bull;
  selectedStraw: BullStraw;
  quantity: number;
}

interface CartState {
  items: CartItem[];
}

export const CartStore = signalStore(
  { providedIn: 'root' },
  withState<CartState>({ items: [] }),
  withComputed((store) => ({
    count: computed(() => store.items().reduce((sum, i) => sum + i.quantity, 0)),
    total: computed(() => store.items().reduce((sum, i) => sum + i.selectedStraw.price * i.quantity, 0)),
  })),
  withMethods((store) => ({
    addItem(bull: Bull, straw: BullStraw, qty = 1): void {
      const current = store.items();
      const idx = current.findIndex(
        (i) => i.bull.id === bull.id && i.selectedStraw.id === straw.id
      );
      if (idx >= 0) {
        const updated = [...current];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + qty };
        patchState(store, { items: updated });
      } else {
        patchState(store, { items: [...current, { bull, selectedStraw: straw, quantity: qty }] });
      }
    },
    updateQuantity(bullId: string, strawId: string, qty: number): void {
      if (qty < 1) return;
      const updated = store.items().map((i) =>
        i.bull.id === bullId && i.selectedStraw.id === strawId
          ? { ...i, quantity: qty }
          : i
      );
      patchState(store, { items: updated });
    },
    removeItem(bullId: string, strawId: string): void {
      patchState(store, {
        items: store.items().filter(
          (i) => !(i.bull.id === bullId && i.selectedStraw.id === strawId)
        ),
      });
    },
    clear(): void {
      patchState(store, { items: [] });
    },
  }))
);
