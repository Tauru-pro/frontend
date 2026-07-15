import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserStore } from '../../../core/store/user.store';
import { CustomerProfileService } from '../../../core/services/customer-profile.service';

@Component({
  selector: 'app-profile',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'w-full' },
  template: `
    <div class="w-full max-w-3xl mx-auto py-2 space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-primary">Mi perfil</h1>
        <p class="text-sm text-gray-500 mt-0.5">Consulta y actualiza tu información personal</p>
      </div>

      <!-- Personal info -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Información personal</h2>
          <span class="text-xs text-gray-400">{{ email() }}</span>
        </div>

        @if (successMsg()) {
          <div class="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm text-green-700">
            {{ successMsg() }}
          </div>
        }
        @if (errorMsg()) {
          <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-600">
            {{ errorMsg() }}
          </div>
        }

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo</label>
          <input
            type="text"
            [value]="fullName()"
            (input)="fullName.set($any($event.target).value)"
            class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
          />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label>
            <input
              type="tel"
              [value]="phone()"
              (input)="phone.set($any($event.target).value)"
              placeholder="Ej. 3001234567"
              class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">WhatsApp</label>
            <input
              type="tel"
              [value]="whatsapp()"
              (input)="whatsapp.set($any($event.target).value)"
              placeholder="Ej. 3001234567"
              class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
            />
          </div>
        </div>

        <div class="flex justify-end">
          <button type="button" (click)="onSave()" [disabled]="saving() || !fullName().trim()" class="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
            {{ saving() ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </div>

      <!-- Become a provider CTA (hidden once you are a seller) -->
      @if (isCustomer()) {
        <div class="bg-gradient-to-br from-primary to-primary-dark rounded-2xl p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 class="text-lg font-bold">¿Quieres vender en Tauru?</h3>
            <p class="text-sm text-white/80 mt-1 max-w-md">
              Únete como proveedor y publica tu genética bovina. Completa unos datos y empieza a vender.
            </p>
          </div>
          <a routerLink="/become-seller" class="btn-accent px-5 py-2.5 text-sm whitespace-nowrap self-start sm:self-auto">
            Quiero ser proveedor
          </a>
        </div>
      }
    </div>
  `,
})
export default class ProfileComponent implements OnInit {
  private userStore = inject(UserStore);
  private service = inject(CustomerProfileService);

  email = computed(() => this.userStore.user()?.email ?? '');
  isCustomer = computed(() => this.userStore.user()?.role === 'CUSTOMER');

  fullName = signal('');
  phone = signal('');
  whatsapp = signal('');
  saving = signal(false);
  errorMsg = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    if (!this.userStore.user()) await this.userStore.loadUser();
    const u = this.userStore.user();
    this.fullName.set(u?.fullName ?? '');
    this.phone.set(u?.customerProfile?.phone ?? '');
    this.whatsapp.set(u?.customerProfile?.whatsapp ?? '');
  }

  async onSave(): Promise<void> {
    const user = this.userStore.user();
    if (!user || !this.fullName().trim()) return;
    this.saving.set(true);
    this.errorMsg.set(null);
    this.successMsg.set(null);
    try {
      await this.service.save(user.id, {
        fullName: this.fullName().trim(),
        phone: this.phone().trim() || undefined,
        whatsapp: this.whatsapp().trim() || undefined,
      });
      await this.userStore.loadUser();
      this.successMsg.set('Datos actualizados correctamente.');
    } catch {
      this.errorMsg.set('No se pudieron guardar los cambios. Intenta de nuevo.');
    } finally {
      this.saving.set(false);
    }
  }
}
