import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type * as Leaflet from 'leaflet';

export interface MapCoordinates {
  lat: number;
  lng: number;
}

const DEFAULT_CENTER: [number, number] = [4.5709, -74.2973]; // Colombia
const DEFAULT_ZOOM = 6;
const PIN_ZOOM = 14;

/**
 * Selector de ubicación reutilizable sobre Leaflet/OpenStreetMap. Nunca se
 * inicializa en SSR (Leaflet toca `window`/`document` al importarse), y
 * carga la librería con `import()` dinámico recién en el navegador.
 */
@Component({
  selector: 'app-map-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="rounded-xl overflow-hidden border border-gray-200" [style.height]="height()">
      <div #mapContainer class="w-full h-full"></div>
    </div>
    <p class="text-xs text-gray-400 mt-1.5">
      Hacé clic en el mapa o arrastrá el marcador para ajustar la ubicación exacta.
    </p>
  `,
})
export class MapPickerComponent {
  /** Posición actual/inicial (p. ej. para precargar en edición). */
  latitude = input<number | null>(null);
  longitude = input<number | null>(null);
  /** Texto libre a geocodificar y centrar (p. ej. "{ciudad}, {departamento}, Colombia"). */
  searchQuery = input<string | null>(null);
  height = input('320px');

  locationChange = output<MapCoordinates>();

  private mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  private platformId = inject(PLATFORM_ID);

  private L: typeof Leaflet | null = null;
  private map: Leaflet.Map | null = null;
  private marker: Leaflet.Marker | null = null;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      afterNextRender(() => void this.init());
    }

    effect(() => {
      const lat = this.latitude();
      const lng = this.longitude();
      if (lat != null && lng != null && this.map) {
        this.setMarker(lat, lng, true);
      }
    });

    effect(() => {
      const query = this.searchQuery();
      if (query && this.map) {
        void this.geocodeAndCenter(query);
      }
    });
  }

  private async init(): Promise<void> {
    const L = await import('leaflet');
    this.L = L;

    const initialLat = this.latitude();
    const initialLng = this.longitude();
    const hasInitial = initialLat != null && initialLng != null;
    const center: [number, number] = hasInitial ? [initialLat!, initialLng!] : DEFAULT_CENTER;

    this.map = L.map(this.mapContainer().nativeElement).setView(center, hasInitial ? PIN_ZOOM : DEFAULT_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);

    if (hasInitial) {
      this.setMarker(initialLat!, initialLng!, false);
    }

    this.map.on('click', (e: Leaflet.LeafletMouseEvent) => {
      this.setMarker(e.latlng.lat, e.latlng.lng, false);
      this.locationChange.emit({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    // Por si searchQuery ya tenía valor antes de que Leaflet terminara de cargar.
    const pendingQuery = this.searchQuery();
    if (pendingQuery) void this.geocodeAndCenter(pendingQuery);
  }

  private setMarker(lat: number, lng: number, recenter: boolean): void {
    if (!this.map || !this.L) return;
    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      this.marker = this.L.marker([lat, lng], { draggable: true }).addTo(this.map);
      this.marker.on('dragend', () => {
        const pos = this.marker!.getLatLng();
        this.locationChange.emit({ lat: pos.lat, lng: pos.lng });
      });
    }
    if (recenter) this.map.setView([lat, lng], PIN_ZOOM);
  }

  /**
   * Nominatim (búsqueda de OpenStreetMap): gratis, sin API key, sin
   * infraestructura propia. Para un panel de admin con pocos pedidos por
   * punto creado alcanza con llamarlo directo desde el navegador; si el uso
   * creciera, lo correcto sería proxyarlo por una Edge Function propia.
   */
  private async geocodeAndCenter(query: string): Promise<void> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
      );
      const results = (await res.json()) as { lat: string; lon: string }[];
      const first = results[0];
      if (!first) return;
      const lat = parseFloat(first.lat);
      const lng = parseFloat(first.lon);
      this.setMarker(lat, lng, true);
      this.locationChange.emit({ lat, lng });
    } catch {
      // Sin geocodificación el mapa queda donde estaba — el admin igual puede
      // hacer clic para ubicar el punto a mano.
    }
  }
}
