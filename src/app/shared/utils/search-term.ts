const DISALLOWED_CHARS = /[^\p{L}\p{N}\s/-]/gu;
const MAX_SEARCH_LENGTH = 60;

/**
 * Allowlist en vez de blocklist: solo letras, números, espacios, "/" y "-" —
 * lo justo para nombres de producto y códigos de toro (ej. "117/2", "11/17").
 * De paso elimina cualquier carácter con significado especial para SQL o para
 * la sintaxis de filtros `ilike`/`or` de PostgREST (comillas, ";", ",", "()",
 * "%", "_", "\"...). Se aplica tanto en la UI como, otra vez, dentro del
 * servicio que arma la consulta: la URL (`?q=`) es editable a mano.
 *
 * No recorta espacios: se usa también mientras el usuario escribe, y recortar
 * ahí impediría teclear un espacio entre palabras. El `.trim()` final queda a
 * cargo de quien decide si hay o no un término de búsqueda.
 */
export function sanitizeSearchTerm(raw: string): string {
  return raw.normalize('NFC').replace(DISALLOWED_CHARS, '').slice(0, MAX_SEARCH_LENGTH);
}
