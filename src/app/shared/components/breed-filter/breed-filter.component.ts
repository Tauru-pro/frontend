import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Breed } from '../../../core/models/breed.model';

/**
 * Lista de razas que enlaza al catálogo filtrado. La misma en la portada y en
 * el catálogo: cada entrada es un enlace a `/catalog?breed=<slug>`, no un
 * manejador, así que sirve igual desde una página que desde la otra.
 *
 * `queryParamsHandling="merge"` conserva el precio y la sección al cambiar de
 * raza dentro del catálogo, y no estorba en la portada, donde no hay nada que
 * conservar. `page: null` borra la página, que es lo correcto al filtrar.
 */
@Component({
  selector: 'app-breed-filter',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (layout() === 'chips') {
      <div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <a
          [routerLink]="['/catalog']"
          [queryParams]="{ breed: null, page: null }"
          queryParamsHandling="merge"
          class="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
          [class]="!activeSlug()
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-gray-200 text-gray-500 hover:border-gray-300'"
        >
          Todas
        </a>
        @for (breed of breeds(); track breed.id) {
          <a
            [routerLink]="['/catalog']"
            [queryParams]="{ breed: breed.slug, page: null }"
            queryParamsHandling="merge"
            class="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
            [class]="breed.slug === activeSlug()
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-gray-200 text-gray-500 hover:border-gray-300'"
          >
            {{ breed.name }}
          </a>
        }
      </div>
    } @else {
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        @if (showAll()) {
          <a
            [routerLink]="['/catalog']"
            [queryParams]="{ breed: null, page: null }"
            queryParamsHandling="merge"
            class="flex items-center gap-3 px-4 py-3 text-sm border-b border-gray-50 transition-colors group"
            [class]="!activeSlug()
              ? 'bg-surface-muted text-secondary font-semibold'
              : 'text-gray-700 hover:bg-surface-muted hover:text-secondary'"
          >
            <span class="flex-1 leading-tight">Todas las razas</span>
            <span class="text-gray-300 group-hover:text-accent transition-colors text-xs">›</span>
          </a>
        }
        @for (breed of breeds(); track breed.id) {
          <a
            [routerLink]="['/catalog']"
            [queryParams]="{ breed: breed.slug, page: null }"
            queryParamsHandling="merge"
            class="flex items-center gap-3 px-4 py-3 text-sm border-b border-gray-50 last:border-0 transition-colors group"
            [class]="breed.slug === activeSlug()
              ? 'bg-surface-muted text-secondary font-semibold'
              : 'text-gray-700 hover:bg-surface-muted hover:text-secondary'"
          >
            <span class="flex-1 leading-tight">{{ breed.name }}</span>
            <span class="text-gray-300 group-hover:text-accent transition-colors text-xs">›</span>
          </a>
        }
      </div>
    }
  `,
})
export class BreedFilterComponent {
  breeds = input.required<Breed[]>();
  /** Slug de la raza filtrada. Sin valor no se resalta ninguna entrada. */
  activeSlug = input<string | null>(null);
  layout = input<'list' | 'chips'>('list');
  /** La entrada "Todas las razas" solo tiene sentido donde se puede desfiltrar. */
  showAll = input(false);
}
