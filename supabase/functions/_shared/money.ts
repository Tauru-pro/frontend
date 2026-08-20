// Every table in checkout-orders-wompi stores money as whole COP pesos
// (matches products.price / PricePipe elsewhere in this app). Wompi's API
// works exclusively in cents (amount_in_cents), so the ×100/÷100 conversion
// is centralized here — every function that talks to Wompi imports this
// instead of multiplying/dividing inline (see design.md Decision 2).

export function toCents(pesos: number): number {
  return Math.round(pesos * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents / 100);
}
