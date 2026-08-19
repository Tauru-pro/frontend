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
import { City, Country, State } from '../../../core/models/location.model';
import { SearchSelectComponent, SelectOption } from '../search-select/search-select.component';

export interface LocationSelection {
  countryId: string;
  stateId: string;
  cityId: string;
  countryName: string;
  stateName: string;
  cityName: string;
}

const DEFAULT_COUNTRY_ISO2 = 'CO';

@Component({
  selector: 'app-location-select',
  imports: [SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      @if (lockCountry) {
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">País</label>
          <div class="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-700 flex items-center gap-2">
            <span>🇨🇴</span><span>Colombia</span>
          </div>
        </div>
      } @else {
        <app-search-select
          label="País"
          [required]="true"
          placeholder="Buscar país"
          errorMessage="El país es requerido"
          [options]="countryOptions()"
          [value]="selectedCountryId()"
          [loading]="countriesLoading()"
          [showError]="showErrors"
          (valueChange)="onCountryChange($event)"
        />
      }
      <app-search-select
        label="Departamento/Estado"
        [required]="true"
        errorMessage="El departamento es requerido"
        [options]="stateOptions()"
        [value]="selectedStateId()"
        [loading]="statesLoading()"
        [disabled]="!selectedCountryId()"
        [placeholder]="statePlaceholder()"
        [showError]="showErrors && !!selectedCountryId()"
        (valueChange)="onStateChange($event)"
      />
      <app-search-select
        label="Ciudad"
        [required]="true"
        errorMessage="La ciudad es requerida"
        [options]="cityOptions()"
        [value]="selectedCityId()"
        [loading]="citiesLoading()"
        [disabled]="!selectedStateId()"
        [placeholder]="cityPlaceholder()"
        [showError]="showErrors && !!selectedStateId()"
        (valueChange)="onCityChange($event)"
      />
    </div>
  `,
})
export class LocationSelectComponent implements OnInit {
  private locationService = inject(LocationService);

  /** Only the city is stored on records; country and state are resolved from it. */
  @Input() initialCityId: string | null = null;
  @Input() showErrors = false;
  /** País fijo en Colombia: oculta el selector y no se puede cambiar ni llamando a `onCountryChange` directamente. */
  @Input() lockCountry = false;
  @Output() selectionChange = new EventEmitter<LocationSelection | null>();

  private countries = signal<Country[]>([]);
  private states = signal<State[]>([]);
  private cities = signal<City[]>([]);
  countriesLoading = signal(false);
  statesLoading = signal(false);
  citiesLoading = signal(false);

  selectedCountryId = signal<string | null>(null);
  selectedStateId = signal<string | null>(null);
  selectedCityId = signal<string | null>(null);

  countryOptions = computed<SelectOption[]>(() =>
    this.countries().map((c) => ({ id: c.id, label: `${c.emoji} ${c.name}`.trim() }))
  );

  stateOptions = computed<SelectOption[]>(() =>
    this.states().map((s) => ({ id: s.id, label: s.name }))
  );

  cityOptions = computed<SelectOption[]>(() =>
    this.cities().map((c) => ({ id: c.id, label: c.name }))
  );

  statePlaceholder = computed(() =>
    this.statesLoading()
      ? 'Cargando...'
      : !this.selectedCountryId()
        ? 'Primero elige un país'
        : 'Buscar departamento'
  );

  cityPlaceholder = computed(() =>
    this.citiesLoading()
      ? 'Cargando...'
      : !this.selectedStateId()
        ? 'Primero elige un departamento'
        : 'Buscar ciudad'
  );

  ngOnInit(): void {
    this.loadCountries();
  }

  onCountryChange(countryId: string | null): void {
    // Con lockCountry no hay UI para disparar esto, pero se guarda igual acá
    // por si alguien llama al método directo (consola, etc.) — no debe hacer nada.
    if (this.lockCountry) return;
    this.selectedCountryId.set(countryId);
    this.selectedStateId.set(null);
    this.selectedCityId.set(null);
    this.states.set([]);
    this.cities.set([]);
    this.emit();

    if (countryId) this.loadStates(countryId);
  }

  onStateChange(stateId: string | null): void {
    this.selectedStateId.set(stateId);
    this.selectedCityId.set(null);
    this.cities.set([]);
    this.emit();

    if (stateId) this.loadCities(stateId);
  }

  onCityChange(cityId: string | null): void {
    this.selectedCityId.set(cityId);
    this.emit();
  }

  private loadCountries(): void {
    this.countriesLoading.set(true);
    this.locationService.getCountries().subscribe({
      next: (countries) => {
        this.countries.set(countries);
        this.countriesLoading.set(false);
        if (this.initialCityId) {
          this.preselectFromCity(this.initialCityId);
        } else {
          const fallback = countries.find((c) => c.iso2 === DEFAULT_COUNTRY_ISO2);
          if (fallback) {
            this.selectedCountryId.set(fallback.id);
            this.loadStates(fallback.id);
          }
        }
      },
      error: () => this.countriesLoading.set(false),
    });
  }

  /** Editing an existing record: walk the stored city back up to its state and country. */
  private preselectFromCity(cityId: string): void {
    this.locationService.getCityLocation(cityId).subscribe({
      next: (location) => {
        if (!location) return;
        this.selectedCountryId.set(location.countryId);
        this.selectedStateId.set(location.stateId);
        this.selectedCityId.set(location.cityId);
        this.loadStates(location.countryId);
        this.loadCities(location.stateId);
        this.emit();
      },
    });
  }

  private loadStates(countryId: string): void {
    this.statesLoading.set(true);
    this.locationService.getStates(countryId).subscribe({
      next: (states) => {
        this.states.set(states);
        this.statesLoading.set(false);
      },
      error: () => this.statesLoading.set(false),
    });
  }

  private loadCities(stateId: string): void {
    this.citiesLoading.set(true);
    this.locationService.getCities(stateId).subscribe({
      next: (cities) => {
        this.cities.set(cities);
        this.citiesLoading.set(false);
      },
      error: () => this.citiesLoading.set(false),
    });
  }

  private emit(): void {
    const countryId = this.selectedCountryId();
    const stateId = this.selectedStateId();
    const cityId = this.selectedCityId();
    if (!countryId || !stateId || !cityId) {
      this.selectionChange.emit(null);
      return;
    }
    this.selectionChange.emit({
      countryId,
      stateId,
      cityId,
      countryName: this.countries().find((c) => c.id === countryId)?.name ?? '',
      stateName: this.states().find((s) => s.id === stateId)?.name ?? '',
      cityName: this.cities().find((c) => c.id === cityId)?.name ?? '',
    });
  }
}
