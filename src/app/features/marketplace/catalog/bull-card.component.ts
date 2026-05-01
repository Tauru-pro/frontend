import {
  Component,
  input,
  signal,
  computed,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Bull, BullStraw, StrawType } from '../../../core/models/bull.model';
import { CartStore } from '../../../core/store/cart.store';
import { environment } from '../../../../environments/environment';

const STRAW_LABELS: Record<StrawType, string> = {
  CONVENTIONAL: 'Convencional',
  SEXADO_MALE: 'Sexado ♂',
  SEXADO_FEMALE: 'Sexado ♀',
};

@Component({
  selector: 'app-bull-card',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 overflow-hidden group flex flex-col h-full">

      <!-- Image -->
      <div class="relative bg-surface-muted h-48 flex items-center justify-center overflow-hidden flex-shrink-0">
        @if (coverUrl()) {
          <img [src]="coverUrl()!" alt="{{ bull().name }}"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        } @else {
          <span class="text-7xl select-none group-hover:scale-110 transition-transform duration-300">🐂</span>
        }

        <!-- Origin badge -->
        <span class="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
          [class]="bull().origin === 'IMPORTED' ? 'bg-accent text-white' : 'bg-secondary text-white'">
          {{ bull().origin === 'IMPORTED' ? 'Importado' : 'Nacional' }}
        </span>
      </div>

      <!-- Body -->
      <div class="p-4 flex flex-col flex-1 gap-2">

        <!-- Name & breed -->
        <div>
          <h3 class="text-sm font-bold text-primary leading-tight line-clamp-2 mb-0.5">{{ bull().name }}</h3>
          <p class="text-xs text-gray-400">{{ bull().breed }}</p>
        </div>

        <!-- Straw selector (only when ≥2 active straws) -->
        @if (activeStraws().length >= 2) {
          <div class="flex flex-wrap gap-1.5">
            @for (straw of activeStraws(); track straw.id) {
              <button
                (click)="selectedStraw.set(straw)"
                class="text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors"
                [class]="selectedStraw()?.id === straw.id
                  ? 'bg-primary text-white border-primary'
                  : 'border-gray-200 text-gray-500 hover:border-primary hover:text-primary'">
                {{ strawLabel(straw.strawType) }}
              </button>
            }
          </div>
        } @else if (activeStraws().length === 1) {
          <p class="text-[10px] text-gray-400 font-medium">{{ strawLabel(activeStraws()[0].strawType) }}</p>
        }

        <!-- Price -->
        <div class="mt-auto pt-2">
          @if (selectedStraw()) {
            <span class="text-xl font-bold text-secondary">$ {{ selectedStraw()!.price.toFixed(2)}}</span>
            <span class="text-xs text-gray-400 ml-1">/ dosis</span>
          } @else {
            <span class="text-sm text-gray-400 italic">Sin stock activo</span>
          }
        </div>

        <!-- Actions -->
        <div class="flex gap-2 mt-2">
          <a [routerLink]="['/catalog', bull().id]"
            class="flex-1 text-center btn-primary-outline text-xs py-2 rounded-lg font-medium">
            Ver Detalle
          </a>
          <button
            [disabled]="!selectedStraw()"
            (click)="addToCart()"
            class="flex-1 btn-primary text-xs py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
            + Carrito
          </button>
        </div>
      </div>
    </div>
  
  `,
})
export class BullCardComponent implements OnInit {
  bull = input.required<Bull>();

  private cartStore = inject(CartStore);

  selectedStraw = signal<BullStraw | null>(null);

  activeStraws = computed(() =>
    this.bull().straws.filter((s) => s.status === 'ACTIVE')
  );

  coverUrl = computed(() => {
    const cover = this.bull().media.find((m) => m.isCover && m.mediaType === 'image')
      ?? this.bull().media.find((m) => m.mediaType === 'image');
    return cover ? `${environment.cdn}/${cover.s3Key}` : null;
  });

  ngOnInit(): void {
    const straws = this.activeStraws();
    if (straws.length > 0) this.selectedStraw.set(straws[0]);
  }

  strawLabel(type: StrawType): string {
    return STRAW_LABELS[type];
  }

  addToCart(): void {
    const straw = this.selectedStraw();
    if (!straw) return;
    this.cartStore.addItem(this.bull(), straw);
  }
}
