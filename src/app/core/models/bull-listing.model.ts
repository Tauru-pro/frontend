import { StrawType } from './product.model';

/** Una pajilla aprobada del toro — una variante de la tarjeta. */
export interface BullListingVariant {
  id: string;
  name: string;
  strawType: StrawType | null;
  price: number;
  minOrderQuantity: number;
  stockQuantity: number;
}

/**
 * Toro publicable tal y como lo sirve la vista `bull_listings`: un toro por
 * fila con sus pajillas aprobadas dentro. Alimenta tanto la sección de
 * destacados de la portada como la pestaña de genética del catálogo, que solo
 * se distinguen por el filtro `isFeatured`.
 */
export interface BullListing {
  bullId: string;
  bullName: string;
  isFeatured: boolean;
  breedId: string | null;
  breedName: string | null;
  breedSlug: string | null;
  sellerId: string;
  sellerName: string;
  coverUrl: string | null;
  minPrice: number;
  maxPrice: number;
  straws: BullListingVariant[];
}
