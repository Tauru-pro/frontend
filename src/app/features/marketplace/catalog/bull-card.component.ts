import {
  Component,
  input,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Bull } from '../../../core/models/bull.model';
import { BullService } from '../../../core/services/bull.service';

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
          <p class="text-xs text-gray-400">{{ bull().breed.name }}</p>
        </div>

        <!-- Actions -->
        <div class="mt-auto pt-2">
          <a [routerLink]="['/catalog', bull().id]"
            class="block w-full text-center btn-primary-outline text-xs py-2 rounded-lg font-medium">
            Ver Detalle
          </a>
        </div>
      </div>
    </div>

  `,
})
export class BullCardComponent {
  bull = input.required<Bull>();

  private bullService = inject(BullService);

  coverUrl = computed(() => {
    const cover = this.bull().media.find((m) => m.isCover && m.mediaType === 'image')
      ?? this.bull().media.find((m) => m.mediaType === 'image');
    return cover ? this.bullService.getMediaPublicUrl(cover.storagePath) : null;
  });
}
