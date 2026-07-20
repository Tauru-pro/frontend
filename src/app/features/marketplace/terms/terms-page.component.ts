import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TermsService } from '../../../core/services/terms.service';
import { TermsAudience, TermsDocument } from '../../../core/models/terms.model';

@Component({
  selector: 'app-terms-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl mx-auto px-4 py-10">
      <nav class="flex items-center gap-2 text-xs text-gray-400 mb-6">
        <a routerLink="/" class="hover:text-secondary transition-colors">Inicio</a>
        <span>›</span>
        <span class="text-primary font-medium">{{ title() }}</span>
      </nav>

      <h1 class="text-2xl font-bold text-primary mb-2">{{ title() }}</h1>

      @if (loading()) {
        <div class="space-y-3 mt-6">
          @for (_ of [1,2,3,4,5]; track $index) {
            <div class="h-4 bg-gray-100 rounded animate-pulse"></div>
          }
        </div>
      } @else if (error()) {
        <p class="text-sm text-gray-500 mt-6">No se pudieron cargar los términos. Intenta de nuevo más tarde.</p>
      } @else if (terms(); as t) {
        <p class="text-xs text-gray-400 mb-6">Versión {{ t.version }}</p>
        <div class="bg-white rounded-2xl border border-gray-100 p-6 md:p-8 text-sm text-gray-600 leading-relaxed whitespace-pre-line">
          {{ t.content }}
        </div>
      }
    </div>
  `,
})
export default class TermsPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private termsService = inject(TermsService);

  loading = signal(true);
  error = signal(false);
  terms = signal<TermsDocument | null>(null);
  title = signal('Términos y Condiciones');

  async ngOnInit(): Promise<void> {
    const param = (this.route.snapshot.paramMap.get('audience') ?? 'seller').toLowerCase();
    const audience: TermsAudience = param === 'buyer' ? 'BUYER' : 'SELLER';
    this.title.set(
      audience === 'SELLER'
        ? 'Términos y Condiciones del Proveedor'
        : 'Términos y Condiciones',
    );
    try {
      this.terms.set(await firstValueFrom(this.termsService.getCurrent(audience)));
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
