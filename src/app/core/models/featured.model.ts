import { StrawType } from './product.model';

/** Una pajilla aprobada del toro destacado — una variante de la tarjeta. */
export interface FeaturedStrawVariant {
  id: string;
  name: string;
  strawType: StrawType | null;
  price: number;
  minOrderQuantity: number;
  stockQuantity: number;
}

/**
 * Toro destacado tal y como lo sirve la vista `featured_straws`: un toro por
 * fila con sus pajillas aprobadas dentro, para que la portada se pinte con una
 * sola consulta.
 */
export interface FeaturedStraw {
  bullId: string;
  bullName: string;
  breedName: string | null;
  sellerId: string;
  sellerName: string;
  coverUrl: string | null;
  straws: FeaturedStrawVariant[];
}
