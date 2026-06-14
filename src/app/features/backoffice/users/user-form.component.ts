import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  form,
  FormField,
  submit,
  required,
  minLength,
  validate,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { UserService } from '../../../core/services/user.service';
import { CreateUserDto, UpdateUserDto, UserRole, UserStatus } from '../../../core/models/user.model';

interface UserFormModel {
  fullName: string;
  email: string;
  role: UserRole | '';
}

@Component({
  selector: 'app-user-form',
  imports: [RouterLink, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-2xl mx-auto space-y-6">

      <!-- Page header -->
      <div class="flex items-center gap-4">
        <a
          routerLink="/admin/users"
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl font-bold text-gray-900">
            Nuevo usuario
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">
            'Completa los datos para registrar un nuevo usuario
          </p>
        </div>
      </div>

      @if (loading()) {
        <div class="space-y-4">
          @for (_ of [1, 2]; track $index) {
            <div class="h-40 bg-gray-100 rounded-2xl animate-pulse"></div>
          }
        </div>
      } @else {

        <form (submit)="onSubmit(); $event.preventDefault()" class="space-y-6">

          <!-- InformaciÃ³n personal -->
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Información personal</h2>

            <!-- Nombre completo -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre completo <span class="text-red-400">*</span>
              </label>
              <input
                type="text"
                [formField]="userForm.fullName"
                placeholder="Ej. Carlos Rodríguez"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
              />
              @if (userForm.fullName().touched() && userForm.fullName().errors().length) {
                <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  {{ userForm.fullName().errors()[0].message }}
                </p>
              }
            </div>

            <!-- Email (solo en creaciÃ³n) -->
      
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Correo electrónico <span class="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  [formField]="userForm.email"
                  placeholder="correo@ejemplo.com"
                  class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                />
                @if (userForm.email().touched() && userForm.email().errors().length) {
                  <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {{ userForm.email().errors()[0].message }}
                  </p>
                }
              </div>
          </div>

          <!-- Cuenta y acceso -->
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Cuenta y acceso</h2>

            <div class="grid grid-cols-1  gap-5">
              <!-- Rol -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Rol <span class="text-red-400">*</span>
                </label>
                <select
                  [formField]="userForm.role"
                  class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all bg-white"
                >
                  <option value="">Selecciona un rol</option>
                  <option value="ADMIN">Admin</option>
                  <option value="SELLER">Vendedor</option>
                  <option value="BUYER">Comprador</option>
                </select>
                @if (userForm.role().touched() && userForm.role().errors().length) {
                  <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {{ userForm.role().errors()[0].message }}
                  </p>
                }
              </div>
            </div>

     
          </div>

          <!-- Error genÃ©rico -->
          @if (errorMsg()) {
            <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {{ errorMsg() }}
            </div>
          }

          <!-- Acciones -->
          <div class="flex gap-3 justify-end pb-6">
            <a
              routerLink="/admin/users"
              class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </a>
            <button
              type="submit"
              [disabled]="saving()"
              class="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm"
            >
              @if (saving()) {
                <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Guardando...
              } @else {
                 Crear usuario
              }
            </button>
          </div>

        </form>
      }
    </div>
  `,
})
export default class UserFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private userService = inject(UserService);


  userId = signal<string | null>(null);
  currentEmail = signal('');
  loading = signal(false);
  saving = signal(false);
  errorMsg = signal<string | null>(null);

  model = signal<UserFormModel>({
    fullName: '',
    email: '',
    role: ''
  });

  userForm = form(this.model, (s) => {
    required(s.fullName, { message: 'El nombre es requerido' });
    minLength(s.fullName, 2, { message: 'El nombre debe tener al menos 2 caracteres' });
    required(s.role, { message: 'El rol es requerido' });

    validate(s.email, ({ value }) => {

      const v = (value() as string)?.trim();
      if (!v) return { kind: 'required', message: 'El correo es requerido' };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
        return { kind: 'email', message: 'Ingresa un correo vÃ¡lido' };
      return undefined;
    });
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.userId.set(id);

    }
  }



  onSubmit(): void {
    this.errorMsg.set(null);
    submit(this.userForm, async () => {
      this.saving.set(true);
      try {
        const values = this.model();

        const dto: CreateUserDto = {
          email: values.email,
          fullName: values.fullName,
          role: values.role as UserRole
        };
        await firstValueFrom(this.userService.createUser(dto));

        this.router.navigate(['/admin/users']);
      } catch (err) {
        const status = (err as HttpErrorResponse)?.status;
        if (status === 409) {
          this.errorMsg.set('Ya existe un usuario con ese correo electrÃ³nico.');
        } else {
          this.errorMsg.set('OcurriÃ³ un error al guardar. Intenta de nuevo.');
        }
      } finally {
        this.saving.set(false);
      }
    });
  }
}

