import { Pipe, PipeTransform } from '@angular/core';

const FORMATTER = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/**
 * Formato único de precio para todo el recorrido de compra — tarjeta, ficha,
 * carrito y checkout. Antes cada superficie hacía su propio `toFixed(2)` con un
 * literal "USD", lo que mostraba `$30000.00` en la ficha y `$30.000` en la
 * tarjeta para el mismo producto.
 */
@Pipe({ name: 'price' })
export class PricePipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return FORMATTER.format(value ?? 0);
  }
}
