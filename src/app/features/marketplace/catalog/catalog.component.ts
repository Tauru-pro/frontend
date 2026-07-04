import {
  Component,
  signal,
  computed,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BullService } from '../../../core/services/bull.service';
import { Bull } from '../../../core/models/bull.model';
import { BullCardComponent } from './bull-card.component';

@Component({
  selector: 'app-catalog',
  imports: [RouterLink, FormsModule, BullCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalog.component.html',
})
export default class CatalogComponent implements OnInit {
  private bullService = inject(BullService);

  bulls = signal<Bull[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  currentPage = signal(1);
  totalPages = signal(1);
  totalItems = signal(0);

  // Filters
  selectedBreed = signal<string>('');
  minPrice = signal<number | null>(null);
  maxPrice = signal<number | null>(null);

  breeds = computed(() => {
    const all = this.bulls().map((b) => b.breed);
    return [...new Set(all)].sort();
  });

  readonly limit = 12;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.bullService
      .getCatalogBulls(this.currentPage(), this.limit)
      .subscribe({
        next: (res) => {
          this.bulls.set(res.data);
          this.totalItems.set(res.total);
          this.totalPages.set(Math.ceil(res.total / this.limit));
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No se pudo cargar el catálogo. Intenta de nuevo.');
          this.loading.set(false);
        },
      });
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.load();
  }

  clearFilters(): void {
    this.selectedBreed.set('');
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.currentPage.set(1);
    this.load();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  pages(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i + 1);
  }
}
