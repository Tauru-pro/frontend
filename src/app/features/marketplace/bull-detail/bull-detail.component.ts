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
import { Bull, BullMedia } from '../../../core/models/bull.model';

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

  bull = signal<Bull | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  activeImageUrl = signal<string | null>(null);

  images = computed<BullMedia[]>(() =>
    (this.bull()?.media ?? []).filter((m) => m.mediaType === 'image')
  );

  mediaUrl(storagePath: string): string {
    return this.bullService.getMediaPublicUrl(storagePath);
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
        const cover =
          bull.media.find((m) => m.isCover && m.mediaType === 'image') ??
          bull.media.find((m) => m.mediaType === 'image');
        if (cover) this.activeImageUrl.set(this.mediaUrl(cover.storagePath));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la información del toro.');
        this.loading.set(false);
      },
    });
  }

  selectImage(media: BullMedia): void {
    this.activeImageUrl.set(this.mediaUrl(media.storagePath));
  }
}
