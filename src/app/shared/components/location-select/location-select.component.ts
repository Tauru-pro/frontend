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
import { City, State } from '../../../core/models/location.model';
import { SearchSelectComponent, SelectOption } from '../search-select/search-select.component';

export interface LocationSelection {
  stateId: string;
  cityId: string;
}

@Component({
  selector: 'app-location-select',
  imports: [SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="grid grid-cols-2 gap-4">
      <app-search-select
        label="Departamento"
        [required]="true"
        placeholder="Buscar departamento"
        errorMessage="El departamento es requerido"
        [options]="stateOptions()"
        [value]="selectedStateId()"
        [loading]="statesLoading()"
        [showError]="showErrors"
        (valueChange)="onStateChange($event)"
      />
      <app-search-select
        label="Municipio"
       
        [required]="true"
        errorMessage="El municipio es requerido"
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

  @Input() initialStateId: string | null = null;
  @Input() initialCityId: string | null = null;
  @Input() showErrors = false;
  @Output() selectionChange = new EventEmitter<LocationSelection | null>();

  private states = signal<State[]>([]);
  private cities = signal<City[]>([]);
  statesLoading = signal(false);
  citiesLoading = signal(false);

  selectedStateId = signal<string | null>(null);
  selectedCityId = signal<string | null>(null);
  private selectedStateName = signal<string | null>(null);

  stateOptions = computed<SelectOption[]>(() =>
    this.states().map((s) => ({ id: s.id, label: s.name }))
  );

  cityOptions = computed<SelectOption[]>(() =>
    this.cities().map((c) => ({ id: c.id, label: c.name }))
  );

  cityPlaceholder = computed(() =>
    this.citiesLoading()
      ? 'Cargando...'
      : !this.selectedStateId()
        ? 'Primero elige un departamento'
        : 'Buscar municipio'
  );

  ngOnInit(): void {
    this.loadStates();
  }

  onStateChange(stateId: string | null): void {
    this.selectedStateId.set(stateId);
    this.selectedCityId.set(null);
    this.cities.set([]);
    this.emit();

    if (stateId) {
      const stateName = this.states().find((s) => s.id === stateId)?.name ?? null;
      this.selectedStateName.set(stateName);
      if (stateName) this.loadCities(stateName);
    } else {
      this.selectedStateName.set(null);
    }
  }

  onCityChange(cityId: string | null): void {
    this.selectedCityId.set(cityId);
    this.emit();
  }

  private loadStates(): void {
    this.statesLoading.set(true);
    this.locationService.getStates().subscribe({
      next: (states) => {
        this.states.set(states);
        this.statesLoading.set(false);
        if (this.initialStateId) {
          const match = states.find((s) => s.id === this.initialStateId);
          if (match) {
            this.selectedStateId.set(match.id);
            this.selectedStateName.set(match.name);
            this.loadCities(match.name);
          }
        }
      },
      error: () => this.statesLoading.set(false),
    });
  }

  private loadCities(stateName: string): void {
    this.citiesLoading.set(true);
    this.locationService.getCities(stateName).subscribe({
      next: (cities) => {
        this.cities.set(cities);
        this.citiesLoading.set(false);
        if (this.initialCityId) {
          const match = cities.find((c) => c.id === this.initialCityId);
          if (match) {
            this.selectedCityId.set(match.id);
            this.emit();
          }
        }
      },
      error: () => this.citiesLoading.set(false),
    });
  }

  private emit(): void {
    const stateId = this.selectedStateId();
    const cityId = this.selectedCityId();
    this.selectionChange.emit(stateId && cityId ? { stateId, cityId } : null);
  }
}
