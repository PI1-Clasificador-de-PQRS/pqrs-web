import type { Category } from "@/lib/pqrs/labels";

/**
 * Un color fijo por categoría, igual en todos los gráficos. Validados en el orden canónico
 * sobre fondo blanco: contraste ≥ 3:1 y separación suficiente con daltonismo. El color nunca va
 * solo: las barras llevan su valor y cada gráfico tiene vista de tabla.
 */
export const CATEGORY_COLORS: Record<Category, string> = {
  Petición: "#2a78d6",
  Reclamo: "#c94f1a",
  Denuncia: "#13865d",
  "Solicitud de información": "#9a6a00",
};

/** Series de un solo color (tiempo, motor, origen): neutro, para no sugerir una categoría. */
export const NEUTRAL_SERIES_COLOR = "#475569";
