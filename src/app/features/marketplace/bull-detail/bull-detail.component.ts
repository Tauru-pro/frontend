import {
  Component,
  signal,
  computed,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BullService } from '../../../core/services/bull.service';
import { CartStore } from '../../../core/store/cart.store';
import { Bull, BullMedia, BullStraw, StrawType } from '../../../core/models/bull.model';
import { environment } from '../../../../environments/environment';

const STRAW_LABELS: Record<StrawType, string> = {
  CONVENTIONAL: 'Convencional',
  SEXADO_MALE: 'Sexado ♂',
  SEXADO_FEMALE: 'Sexado ♀',
};

const ORIGIN_LABELS: Record<string, string> = {
  NATIONAL: 'Nacional',
  IMPORTED: 'Importado',
};

const REG_LABELS: Record<string, string> = {
  PURO: 'Puro',
  COMERCIAL: 'Comercial',
};

@Component({
  selector: 'app-bull-detail',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bull-detail.component.html',
})
export default class BullDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private bullService = inject(BullService);
  private cartStore = inject(CartStore);

  bull = signal<Bull | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  selectedStraw = signal<BullStraw | null>(null);
  activeImageUrl = signal<string | null>(null);
  addedToCart = signal(false);

  activeStraws = computed(() =>
    (this.bull()?.straws ?? []).filter((s) => s.status === 'ACTIVE')
  );

  images = computed<BullMedia[]>(() =>
    (this.bull()?.media ?? []).filter((m) => m.mediaType === 'image')
  );

  mediaUrl(key: string): string {
    return `${environment.cdn}/${key}`;
  }

  strawLabel(type: StrawType): string {
    return STRAW_LABELS[type];
  }

  originLabel(origin: string): string {
    return ORIGIN_LABELS[origin] ?? origin;
  }

  regLabel(reg: string | null): string {
    return reg ? (REG_LABELS[reg] ?? reg) : '—';
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Toro no encontrado.');
      this.loading.set(false);
      return;
    }

    this.bullService.getBull(id).subscribe({
      next: (bull) => {
        this.bull.set(bull);
        const straws = bull.straws.filter((s) => s.status === 'ACTIVE');
        if (straws.length > 0) this.selectedStraw.set(straws[0]);

        const cover =
          bull.media.find((m) => m.isCover && m.mediaType === 'image') ??
          bull.media.find((m) => m.mediaType === 'image');
        if (cover) this.activeImageUrl.set(this.mediaUrl(cover.s3Key));

        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la información del toro.');
        this.loading.set(false);
      },
    });
  }

  selectImage(media: BullMedia): void {
    this.activeImageUrl.set(this.mediaUrl(media.s3Key));
  }

  addToCart(): void {
    const straw = this.selectedStraw();
    const bull = this.bull();
    if (!straw || !bull) return;
    this.cartStore.addItem(bull, straw);
    this.addedToCart.set(true);
    setTimeout(() => this.addedToCart.set(false), 2000);
  }
}
