import { computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  signalStore,
  withState,
  withMethods,
  withComputed,
  withHooks,
  patchState,
} from '@ngrx/signals';
import { Product } from '../models/product.model';

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartState {
  items: CartItem[];
}

const STORAGE_KEY = 'tauru_cart';

function loadFromStorage(isBrowser: boolean): CartItem[] {
  if (!isBrowser) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: CartItem[], isBrowser: boolean): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage quota or private mode — ignore
  }
}

export const CartStore = signalStore(
  { providedIn: 'root' },
  withState<CartState>({ items: [] }),
  withComputed((store) => ({
    count: computed(() => store.items().reduce((sum, i) => sum + i.quantity, 0)),
    total: computed(() =>
      store.items().reduce((sum, i) => sum + i.product.price * i.quantity, 0)
    ),
  })),
  withMethods((store) => {
    const platformId = inject(PLATFORM_ID);
    const isBrowser = isPlatformBrowser(platformId);

    return {
      addItem(product: Product, qty = 1): void {
        const min = product.minOrderQuantity;
        const effectiveQty = Math.max(qty, min);
        const current = store.items();
        const idx = current.findIndex((i) => i.product.id === product.id);
        let updated: CartItem[];
        if (idx >= 0) {
          updated = current.map((item, i) =>
            i === idx ? { ...item, quantity: item.quantity + effectiveQty } : item
          );
        } else {
          updated = [...current, { product, quantity: effectiveQty }];
        }
        patchState(store, { items: updated });
        saveToStorage(updated, isBrowser);
      },

      updateQuantity(productId: string, qty: number): void {
        const current = store.items();
        const item = current.find((i) => i.product.id === productId);
        const min = item?.product.minOrderQuantity ?? 1;
        if (qty < min) return;
        const updated = current.map((i) =>
          i.product.id === productId ? { ...i, quantity: qty } : i
        );
        patchState(store, { items: updated });
        saveToStorage(updated, isBrowser);
      },

      removeItem(productId: string): void {
        const updated = store.items().filter((i) => i.product.id !== productId);
        patchState(store, { items: updated });
        saveToStorage(updated, isBrowser);
      },

      clear(): void {
        patchState(store, { items: [] });
        saveToStorage([], isBrowser);
      },
    };
  }),
  withHooks({
    onInit(store) {
      const platformId = inject(PLATFORM_ID);
      const isBrowser = isPlatformBrowser(platformId);
      const items = loadFromStorage(isBrowser);
      if (items.length > 0) patchState(store, { items });
    },
  })
);
