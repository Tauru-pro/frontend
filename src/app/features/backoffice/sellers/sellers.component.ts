import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';


@Component({
  selector: 'app-users',
  imports: [],
  template: `

      <div class="space-y-6">

        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold text-gray-900">Vendedores</h1>
            <p class="text-sm text-gray-500 mt-0.5">Provedores de semen taurino</p>
          </div>
          <button
            type="button"
            (click)="router.navigate(['/admin/seller/new'])"
            class="flex items-center gap-2 btn-primary px-4 py-2.5 text-sm"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Nuevo vendedor
          </button>
        </div>
      </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SellersComponent {

  protected router = inject(Router);
}

