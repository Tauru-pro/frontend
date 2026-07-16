import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  template: `<!-- ===== FOOTER ===== -->
    <footer class="bg-footer text-gray-400 pt-12 pb-6">
      <div class="max-w-[1400px] mx-auto px-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <!-- Brand column -->
          <!-- BRAND: replace this "T" box with <img src="/brand/tauvo-lockup-white.svg">
               on the dark footer once the file exists — see public/brand/README.md -->
          <div class="lg:col-span-2">
            <div class="flex items-center gap-2 mb-4">
              <div
                class="w-9 h-9 bg-secondary rounded-lg flex items-center justify-center text-white font-bold text-lg"
              >
                T
              </div>
              <div class="leading-none">
                <span class="text-xl font-bold text-white">TAUVO</span>
                <span class="text-accent font-bold text-xl">.</span>
                <div class="text-[10px] text-gray-500 tracking-widest uppercase">Market</div>
              </div>
            </div>
            <p class="text-sm text-gray-500 leading-relaxed mb-4 max-w-xs">
              Tu marketplace de confianza en genética bovina. Encuentra toros y pajillas de semen de
              la mejor calidad para mejorar tu hato ganadero.
            </p>
            <div class="space-y-1.5 text-sm text-gray-500">
              <div class="flex items-center gap-2">
                <span>📞</span>
                <span>+1 (800) 123-4567</span>
              </div>
              <div class="flex items-center gap-2">
                <span>✉️</span>
                <span>support&#64;taurumarket.com</span>
              </div>
              <div class="flex items-center gap-2">
                <span>📍</span>
                <span>123 Fresh St, Greenville, CA 90210</span>
              </div>
            </div>
          </div>

          <!-- Quick Links -->
          <div>
            <h4 class="text-white font-semibold mb-4 text-sm uppercase tracking-widest">
              Enlaces rápidos
            </h4>
            <ul class="space-y-2.5 text-sm">
              <li>
                <a
                  routerLink="/become-seller"
                  class="text-accent font-semibold hover:text-white transition-colors inline-flex items-center gap-1.5"
                >
                  Quiero ser proveedor
                </a>
              </li>
              @for (
                link of ['Inicio', 'Nosotros', 'Nuestra historia', 'Blog', 'Contacto'];
                track link
              ) {
                <li>
                  <a href="#" class="hover:text-accent transition-colors">{{ link }}</a>
                </li>
              }
            </ul>
          </div>

          <!-- Information -->
          <div>
            <h4 class="text-white font-semibold mb-4 text-sm uppercase tracking-widest">
              Información
            </h4>
            <ul class="space-y-2.5 text-sm">
              @for (link of tracks; track link) {
                <li>
                  <a href="#" class="hover:text-accent transition-colors">{{ link }}</a>
                </li>
              }
            </ul>
          </div>
        </div>

        <!-- Bottom bar -->
        <div
          class="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <p class="text-xs text-gray-600">© 2026 TAUVO Market. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  tracks: string[] = [
    'Política de privacidad',
    'Términos y condiciones',
    'Política de envíos',
    'Política de devoluciones',
    'Preguntas frecuentes',
    'Rastrear pedido',
  ];
}
