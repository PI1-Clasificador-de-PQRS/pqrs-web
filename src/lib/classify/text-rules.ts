/** Límites de la API, contados como ella: en code points y tras quitar espacios de los extremos. */
export const MAX_TEXT_CHARS = 5000;
export const MAX_REF_CHARS = 100;

/** Longitud en code points (como `len()` en Python), no en unidades UTF-16. */
export function countChars(value: string): number {
  return Array.from(value).length;
}

export type TextProblem = "empty" | "too_long";

export function textProblem(text: string): TextProblem | null {
  const length = countChars(text.trim());
  if (length === 0) return "empty";
  if (length > MAX_TEXT_CHARS) return "too_long";
  return null;
}

export function refTooLong(ref: string): boolean {
  return countChars(ref) > MAX_REF_CHARS;
}

const numberFormat = new Intl.NumberFormat("es-CO");

export function formatCount(value: number): string {
  return numberFormat.format(value);
}
