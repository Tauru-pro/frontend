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
import { ProductService } from '../../../core/services/product.service';
import {
  CreateProductDto,
  ProductOrigin,
  ProductType,
  RegistrationType,
  UpdateProductDto,
} from '../../../core/models/product.model';

interface ProductFormModel {
  productType: ProductType;
  name: string;
  description: string;
  breed: string;
  origin: ProductOrigin;
  registrationType: RegistrationType | '';
  bullName: string;
  invimaRegistration: string;
  pricePerDose: number;
  stockQuantity: number;
}

@Component({
  selector: 'app-product-form',
  imports: [RouterLink, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl mx-auto space-y-6">

      <!-- Page header -->
      <div class="flex items-center gap-4">
        <a
          routerLink="/seller/products"
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl font-bold text-gray-900">
            {{ isEditMode() ? 'Editar producto' : 'Nuevo producto' }}
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">
            {{ isEditMode() ? 'Modifica los datos de tu producto' : 'Completa los datos para publicar tu producto' }}
          </p>
        </div>
      </div>

      @if (loading()) {
        <div class="space-y-4">
          @for (_ of [1,2,3]; track $index) {
            <div class="h-32 bg-gray-100 rounded-2xl animate-pulse"></div>
          }
        </div>
      } @else {

        <form (submit)="onSubmit(); $event.preventDefault()" class="space-y-6">

          <!-- Section 1: Información básica -->
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Información básica</h2>

            <!-- Tipo de producto -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Tipo de producto <span class="text-red-400">*</span>
              </label>
              @if (isEditMode()) {
                <div class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-500 bg-gray-50">
                  {{ model().productType === 'STRAW' ? 'Pajilla (semen bovino)' : 'Insumo veterinario' }}
                </div>
              } @else {
                <select
                  [formField]="productForm.productType"
                  class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0B1D2E]/10 focus:border-[#0B1D2E] transition-all bg-white"
                >
                  <option value="">Selecciona un tipo</option>
                  <option value="STRAW">Pajilla (semen bovino)</option>
                  <option value="SUPPLIES">Insumo veterinario</option>
                </select>
                @if (productForm.productType().touched() && productForm.productType().errors().length) {
                  <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {{ productForm.productType().errors()[0].message }}
                  </p>
                }
              }
            </div>

            <!-- Nombre -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre del producto <span class="text-red-400">*</span>
              </label>
              <input
                type="text"
                [formField]="productForm.name"
                placeholder="Ej. Pajilla Angus Premium"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0B1D2E]/10 focus:border-[#0B1D2E] transition-all"
              />
              @if (productForm.name().touched() && productForm.name().errors().length) {
                <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  {{ productForm.name().errors()[0].message }}
                </p>
              }
            </div>

            <!-- Descripción -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
              <textarea
                [formField]="productForm.description"
                rows="3"
                placeholder="Describe las características del producto..."
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0B1D2E]/10 focus:border-[#0B1D2E] transition-all resize-none"
              ></textarea>
            </div>
          </div>

          <!-- Section 2: Información genética -->
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Información genética</h2>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <!-- Raza -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Raza <span class="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  [formField]="productForm.breed"
                  placeholder="Ej. Angus, Holstein, Brahman"
                  class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0B1D2E]/10 focus:border-[#0B1D2E] transition-all"
                />
                @if (productForm.breed().touched() && productForm.breed().errors().length) {
                  <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {{ productForm.breed().errors()[0].message }}
                  </p>
                }
              </div>

              <!-- Origen -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Origen <span class="text-red-400">*</span>
                </label>
                <select
                  [formField]="productForm.origin"
                  class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0B1D2E]/10 focus:border-[#0B1D2E] transition-all bg-white"
                >
                  <option value="">Selecciona origen</option>
                  <option value="NATIONAL">Nacional</option>
                  <option value="IMPORTED">Importado</option>
                </select>
                @if (productForm.origin().touched() && productForm.origin().errors().length) {
                  <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {{ productForm.origin().errors()[0].message }}
                  </p>
                }
              </div>

              <!-- Tipo de registro -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Tipo de registro</label>
                <select
                  [formField]="productForm.registrationType"
                  class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0B1D2E]/10 focus:border-[#0B1D2E] transition-all bg-white"
                >
                  <option value="">Sin registro</option>
                  <option value="PURO">Puro Registro</option>
                  <option value="COMERCIAL">Comercial</option>
                </select>
              </div>

              <!-- Nombre del toro -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Nombre del toro</label>
                <input
                  type="text"
                  [formField]="productForm.bullName"
                  placeholder="Ej. Titan 7892"
                  class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0B1D2E]/10 focus:border-[#0B1D2E] transition-all"
                />
              </div>
            </div>
          </div>

          <!-- Section 3: Regulatorio -->
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Información regulatoria</h2>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Registro INVIMA
                @if (model().productType === 'SUPPLIES') {
                  <span class="text-red-400">*</span>
                }
              </label>
              <input
                type="text"
                [formField]="productForm.invimaRegistration"
                placeholder="Ej. INVIMA 2023M-0012345"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0B1D2E]/10 focus:border-[#0B1D2E] transition-all"
              />
              @if (model().productType === 'SUPPLIES') {
                <p class="text-gray-400 text-xs mt-1.5">Requerido para insumos veterinarios.</p>
              }
              @if (productForm.invimaRegistration().touched() && productForm.invimaRegistration().errors().length) {
                <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  {{ productForm.invimaRegistration().errors()[0].message }}
                </p>
              }
            </div>
          </div>

          <!-- Section 4: Precio y stock -->
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Precio y stock</h2>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <!-- Precio por dosis -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Precio por dosis (COP) <span class="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  [formField]="productForm.pricePerDose"
                  placeholder="0"
               
                  step="0.01"
                  class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0B1D2E]/10 focus:border-[#0B1D2E] transition-all"
                />
                @if (productForm.pricePerDose().touched() && productForm.pricePerDose().errors().length) {
                  <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {{ productForm.pricePerDose().errors()[0].message }}
                  </p>
                }
              </div>

              <!-- Stock -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Cantidad en stock <span class="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  [formField]="productForm.stockQuantity"
                  placeholder="0"
              
                  step="1"
                  class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0B1D2E]/10 focus:border-[#0B1D2E] transition-all"
                />
                @if (productForm.stockQuantity().touched() && productForm.stockQuantity().errors().length) {
                  <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {{ productForm.stockQuantity().errors()[0].message }}
                  </p>
                }
              </div>
            </div>
          </div>

          <!-- ICA error banner -->
          @if (icaError()) {
            <div class="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
              <div class="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div>
                <p class="font-semibold text-amber-800 text-sm">Validación ICA requerida</p>
                <p class="text-amber-600 text-sm mt-1">
                  Tu cuenta no tiene una validación ICA activa. Contacta al administrador para
                  habilitar la gestión de productos.
                </p>
              </div>
            </div>
          }

          <!-- Generic error -->
          @if (errorMsg()) {
            <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {{ errorMsg() }}
            </div>
          }

          <!-- Actions -->
          <div class="flex gap-3 justify-end pb-6">
            <a
              routerLink="/seller/products"
              class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </a>
            <button
              type="submit"
              [disabled]="saving()"
              class="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#0B1D2E] rounded-xl hover:bg-[#162a3d] disabled:opacity-50 transition-colors"
            >
              @if (saving()) {
                <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Guardando...
              } @else {
                {{ isEditMode() ? 'Guardar cambios' : 'Crear producto' }}
              }
            </button>
          </div>

        </form>
      }
    </div>
  `,
})
export default class ProductFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);

  isEditMode = signal(false);
  productId = signal<string | null>(null);
  loading = signal(false);
  saving = signal(false);
  icaError = signal(false);
  errorMsg = signal<string | null>(null);

  model = signal<ProductFormModel>({
    productType: 'STRAW',
    name: '',
    description: '',
    breed: '',
    origin: 'NATIONAL',
    registrationType: '',
    bullName: '',
    invimaRegistration: '',
    pricePerDose: 0,
    stockQuantity: 0,
  });

  productForm = form(this.model, (s) => {
    required(s.productType, { message: 'El tipo de producto es requerido' });
    required(s.name, { message: 'El nombre es requerido' });
    minLength(s.name, 3, { message: 'El nombre debe tener al menos 3 caracteres' });
    required(s.breed, { message: 'La raza es requerida' });
    minLength(s.breed, 2, { message: 'La raza debe tener al menos 2 caracteres' });
    required(s.origin, { message: 'El origen es requerido' });
    required(s.pricePerDose, { message: 'El precio es requerido' });
    validate(s.pricePerDose, ({ value }) =>
      (value() as number) <= 0
        ? { kind: 'min', message: 'El precio debe ser mayor a 0' }
        : undefined,
    );
    validate(s.stockQuantity, ({ value }) =>
      (value() as number) < 0
        ? { kind: 'min', message: 'El stock no puede ser negativo' }
        : undefined,
    );
    validate(s.invimaRegistration, ({ value, valueOf }) =>
      valueOf(s.productType) === 'SUPPLIES' && !(value() as string)?.trim()
        ? { kind: 'required', message: 'El registro INVIMA es requerido para insumos' }
        : undefined,
    );
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.productId.set(id);
      this.loadForEdit(id);
    }
  }

  private loadForEdit(id: string): void {
    this.loading.set(true);
    this.productService.getProduct(id).subscribe({
      next: (product) => {
        this.model.set({
          productType: product.productType,
          name: product.name,
          description: product.description ?? '',
          breed: product.breed,
          origin: product.origin,
          registrationType: product.registrationType ?? '',
          bullName: product.bullName ?? '',
          invimaRegistration: product.invimaRegistration ?? '',
          pricePerDose: product.pricePerDose,
          stockQuantity: product.stockQuantity,
        });
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('No se pudo cargar el producto. Intenta de nuevo.');
        this.loading.set(false);
      },
    });
  }

  onSubmit(): void {
    this.icaError.set(false);
    this.errorMsg.set(null);
    submit(this.productForm, async () => {
      this.saving.set(true);
      try {
        const values = this.model();
        if (this.isEditMode()) {
          const dto: UpdateProductDto = {
            name: values.name,
            description: values.description || undefined,
            breed: values.breed,
            origin: values.origin,
            registrationType: values.registrationType || undefined,
            bullName: values.bullName || undefined,
            invimaRegistration: values.invimaRegistration || undefined,
            pricePerDose: Number(values.pricePerDose),
            stockQuantity: Number(values.stockQuantity),
          };
          await firstValueFrom(this.productService.updateProduct(this.productId()!, dto));
        } else {
          const dto: CreateProductDto = {
            productType: values.productType,
            name: values.name,
            description: values.description || undefined,
            breed: values.breed,
            origin: values.origin,
            registrationType: values.registrationType || undefined,
            bullName: values.bullName || undefined,
            invimaRegistration: values.invimaRegistration || undefined,
            pricePerDose: Number(values.pricePerDose),
            stockQuantity: Number(values.stockQuantity),
          };
          await firstValueFrom(this.productService.createProduct(dto));
        }
        this.router.navigate(['/seller/products']);
      } catch (err) {
        const status = (err as HttpErrorResponse)?.status;
        if (status === 403) {
          this.icaError.set(true);
        } else {
          this.errorMsg.set('Ocurrió un error al guardar. Intenta de nuevo.');
        }
      } finally {
        this.saving.set(false);
      }
    });
  }
}
