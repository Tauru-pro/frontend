import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { LocationService } from '../../../core/services/location.service';
import { Country } from '../../../core/models/location.model';
import { SearchSelectComponent, SelectOption } from '../search-select/search-select.component';

export interface PhoneValue {
  /** Dial code in `+57` form — what gets persisted alongside the number. */
  dialCode: string;
  /** National number, digits only. */
  number: string;
  /** The two joined, for callers that store a single phone field. */
  e164: string;
}

const DEFAULT_DIAL_CODE = '+57';

@Component({
  selector: 'app-phone-input',
  imports: [SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div>
      @if (label) {
        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          {{ label }}
          @if (required) { <span class="text-red-400">*</span> }
        </label>
      }

      <div class="flex gap-2">
        <div class="w-24 sm:w-28 shrink-0">
          <app-search-select
            placeholder="País"
            [options]="countryOptions()"
            [value]="selectedCountryId()"
            [loading]="countriesLoading()"
            [disabled]="disabled"
            (valueChange)="onCountryChange($event)"
          />
        </div>

        <input
          type="tel"
          [value]="_number()"
          (input)="onNumberInput($event)"
          [disabled]="disabled"
          [placeholder]="placeholder"
          class="flex-1 min-w-0 bg-white border rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 transition-all disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
          [class.border-gray-200]="!showValidationError()"
          [class.focus:ring-primary]="!showValidationError()"
          [class.focus:border-primary]="!showValidationError()"
          [class.border-red-300]="showValidationError()"
          [class.focus:ring-red-100]="showValidationError()"
        />
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
export class PhoneInputComponent implements OnInit {
  private locationService = inject(LocationService);

  /** Stored dial code (`+57`). Applied once the catalog has loaded. */
  @Input() set dialCode(v: string | null) {
    this.pendingDialCode = v;
    if (this.countries().length) this.applyDialCode(v);
  }
  @Input() set number(v: string | null) {
    this._number.set(v ?? '');
  }

  @Input() label = '';
  @Input() placeholder = '300 000 0000';
  @Input() required = false;
  @Input() disabled = false;
  @Input() showError = false;
  @Input() errorMessage = 'El teléfono es requerido';

  @Output() valueChange = new EventEmitter<PhoneValue | null>();

  private countries = signal<Country[]>([]);
  protected _number = signal('');
  private pendingDialCode: string | null = null;
  countriesLoading = signal(false);
  selectedCountryId = signal<string | null>(null);

  countryOptions = computed<SelectOption[]>(() =>
    this.countries().map((c) => ({
      id: c.id,
      // Flag and dial code only: in a phone field the country name is noise and
      // costs width the number field needs.
      label: `${c.emoji} +${c.phonecode}`.trim(),
      // Still findable by ISO code and by name, neither of which is on screen.
      searchText: `${c.iso2} +${c.phonecode} ${c.name}`,
    }))
  );

  private selectedCountry = computed(() =>
    this.countries().find((c) => c.id === this.selectedCountryId()) ?? null
  );

  showValidationError = computed(() => this.showError && this.required && !this._number().trim());

  ngOnInit(): void {
    this.countriesLoading.set(true);
    this.locationService.getCountries().subscribe({
      next: (countries) => {
        this.countries.set(countries);
        this.countriesLoading.set(false);
        this.applyDialCode(this.pendingDialCode);
      },
      error: () => this.countriesLoading.set(false),
    });
  }

  onCountryChange(countryId: string | null): void {
    this.selectedCountryId.set(countryId);
    this.emit();
  }

  onNumberInput(event: Event): void {
    // Keep only what a phone number can contain; the country combo owns the code.
    const cleaned = (event.target as HTMLInputElement).value.replace(/[^\d\s\-().]/g, '');
    this._number.set(cleaned);
    this.emit();
  }

  /**
   * Several countries can share a dial code (+1 is USA and Canada), so the
   * catalog cannot tell us which one the user originally picked. Prefer
   * Colombia when it matches, else the first by name — the code shown is always
   * right, only the flag may differ from the original choice.
   */
  private applyDialCode(dialCode: string | null): void {
    const code = (dialCode ?? DEFAULT_DIAL_CODE).replace(/^\+/, '');
    const matches = this.countries().filter((c) => c.phonecode === code);
    const chosen = matches.find((c) => c.iso2 === 'CO') ?? matches[0] ?? null;
    this.selectedCountryId.set(chosen?.id ?? null);
  }

  private emit(): void {
    const number = this._number().replace(/[^\d]/g, '');
    if (!number) {
      this.valueChange.emit(null);
      return;
    }
    const dialCode = `+${this.selectedCountry()?.phonecode ?? DEFAULT_DIAL_CODE.slice(1)}`;
    this.valueChange.emit({ dialCode, number, e164: `${dialCode}${number}` });
  }
}
