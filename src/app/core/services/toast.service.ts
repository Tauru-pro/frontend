import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  toasts = signal<Toast[]>([]);

  show(message: string, durationMs = 3000): void {
    const id = this.nextId++;
    this.toasts.update((t) => [...t, { id, message }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  dismiss(id: number): void {
    this.toasts.update((t) => t.filter((toast) => toast.id !== id));
  }
}
