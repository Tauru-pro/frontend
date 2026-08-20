import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CheckoutPaymentIntent } from '../models/order.model';

// Wompi's Widget script exposes a global constructor once loaded — there is
// no npm package for it, so this is the officially documented integration
// path (proposal §20). Never marks anything paid: the callback here is
// purely "the widget closed", the actual outcome comes from the webhook via
// PaymentService (proposal §21).
declare global {
  interface Window {
    WidgetCheckout?: new (config: WompiWidgetConfig) => WompiWidgetInstance;
  }
}

interface WompiWidgetConfig {
  currency: string;
  amountInCents: number;
  reference: string;
  publicKey: string;
  redirectUrl?: string;
  signature: { integrity: string };
}

export interface WompiWidgetResult {
  transaction?: { id: string; status: string; reference: string };
}

interface WompiWidgetInstance {
  open(callback: (result: WompiWidgetResult) => void): void;
}

const WIDGET_SRC = 'https://checkout.wompi.co/widget.js';

@Injectable({ providedIn: 'root' })
export class WompiCheckoutService {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private scriptLoadPromise: Promise<void> | null = null;

  private loadScript(): Promise<void> {
    if (!this.isBrowser) return Promise.reject(new Error('WompiCheckoutService solo funciona en el navegador.'));
    if (this.scriptLoadPromise) return this.scriptLoadPromise;

    this.scriptLoadPromise = new Promise((resolve, reject) => {
      if (window.WidgetCheckout) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = WIDGET_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar el widget de pagos.'));
      document.head.appendChild(script);
    });
    return this.scriptLoadPromise;
  }

  /**
   * Opens the Wompi Widget for the given payment intent. `onResult` fires when
   * the buyer closes/finishes the widget — treat it only as "stopped
   * interacting", never as confirmation of payment (that comes from the
   * webhook, surfaced via PaymentService on the result page).
   */
  async open(intent: CheckoutPaymentIntent, onResult: (result: WompiWidgetResult) => void): Promise<void> {
    await this.loadScript();
    if (!window.WidgetCheckout) throw new Error('El widget de pagos no está disponible.');

    const checkout = new window.WidgetCheckout({
      currency: intent.currency,
      amountInCents: intent.amountInCents,
      reference: intent.reference,
      publicKey: intent.publicKey,
      redirectUrl: intent.redirectUrl,
      signature: { integrity: intent.integritySignature },
    });
    checkout.open(onResult);
  }
}
