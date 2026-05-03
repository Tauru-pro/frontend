import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';

export interface SelectOption {
  id: string;
  label: string;
}

@Component({
  selector: 'app-search-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      @if (label) {
        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          {{ label }}
          @if (required) { <span class="text-red-400">*</span> }
        </label>
      }

      <div class="relative">
        <input
          type="text"
          [value]="inputValue()"
          (input)="onSearch($event)"
          (focus)="open()"
          (blur)="close()"
          [disabled]="_disabled() || _loading()"
          [placeholder]="_loading() ? 'Cargando...' : placeholder"
          class="w-full border rounded-xl px-3.5 py-2.5 pr-9 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 transition-all disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
          [class.border-gray-200]="!showValidationError()"
          [class.focus:ring-primary]="!showValidationError()"
          [class.focus:ring-primary\/10]="!showValidationError()"
          [class.focus:border-primary]="!showValidationError()"
          [class.border-red-300]="showValidationError()"
          [class.focus:ring-red-100]="showValidationError()"
        />

        <!-- Right icon: spinner while loading, chevron otherwise -->
        <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
          @if (_loading()) {
            <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          } @else {
            <svg
              class="w-4 h-4 transition-transform duration-150"
              [class.rotate-180]="dropdownOpen()"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          }
        </div>

        <!-- Dropdown list -->
        @if (dropdownOpen()) {
          <div class="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
            @if (filteredOptions().length === 0) {
              <div class="px-4 py-3 text-sm text-gray-400 text-center">Sin resultados</div>
            }
            @for (option of filteredOptions(); track option.id) {
              <button
                type="button"
                (mousedown)="select(option)"
                class="w-full text-left px-4 py-2.5 text-sm transition-colors"
                [class.bg-primary]="selectedOption()?.id === option.id"
                [class.text-white]="selectedOption()?.id === option.id"
                [class.font-medium]="selectedOption()?.id === option.id"
                [class.hover:bg-gray-50]="selectedOption()?.id !== option.id"
              >
                {{ option.label }}
              </button>
            }
          </div>
        }
      </div>

      @if (showValidationError()) {
        <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
          <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
          {{ errorMessage }}
        </p>
      }
    </div>
  `,
})
export class SearchSelectComponent {
  // --- Inputs bridged to signals for use in computed() ---
  private _optionsSig = signal<SelectOption[]>([]);
  private _valueSig = signal<string | null>(null);
  _loading = signal(false);
  _disabled = signal(false);
  private _showErrorSig = signal(false);

  @Input() set options(v: SelectOption[]) { this._optionsSig.set(v ?? []); }
  @Input() set value(v: string | null) { this._valueSig.set(v); }
  @Input() set loading(v: boolean) { this._loading.set(v); }
  @Input() set disabled(v: boolean) { this._disabled.set(v); }
  @Input() set showError(v: boolean) { this._showErrorSig.set(v); }

  @Input() placeholder = 'Seleccionar';
  @Input() label = '';
  @Input() required = false;
  @Input() errorMessage = 'Este campo es requerido';

  @Output() valueChange = new EventEmitter<string | null>();

  // --- Internal state ---
  search = signal('');
  dropdownOpen = signal(false);
  touched = signal(false);

  // --- Computed ---
  selectedOption = computed(() =>
    this._optionsSig().find((o) => o.id === this._valueSig()) ?? null
  );

  filteredOptions = computed(() => {
    const q = this.search().toLowerCase().trim();
    return q
      ? this._optionsSig().filter((o) => o.label.toLowerCase().includes(q))
      : this._optionsSig();
  });

  inputValue = computed(() =>
    this.dropdownOpen() ? this.search() : (this.selectedOption()?.label ?? '')
  );

  showValidationError = computed(() =>
    (this.touched() || this._showErrorSig()) && !this.selectedOption()
  );

  // --- Methods ---
  open(): void {
    if (this._disabled() || this._loading()) return;
    this.search.set('');
    this.dropdownOpen.set(true);
  }

  close(): void {
    setTimeout(() => {
      this.dropdownOpen.set(false);
      this.touched.set(true);
    }, 150);
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  select(option: SelectOption): void {
    this.dropdownOpen.set(false);
    this.touched.set(true);
    this.valueChange.emit(option.id);
  }
}
