import { ApiError, errorMessage, formatSeconds } from "@/lib/api/errors";

/** Mensaje de un error al clasificar, con el tiempo de espera cuando la API lo indica. */
export function classifyErrorMessage(error: unknown): string {
  const base = errorMessage(error);
  if (!(error instanceof ApiError)) return base;
  if (error.status === 429) {
    const wait = error.retryAfter ?? undefined;
    return wait !== undefined
      ? `${base} Espera ${formatSeconds(wait)} antes de volver a intentarlo.`
      : `${base} Espera un momento antes de volver a intentarlo.`;
  }
  if (error.status === 503) {
    const wait =
      error.retryAfter !== undefined
        ? ` Puedes reintentar en ${formatSeconds(error.retryAfter)}`
        : " Puedes reintentar";
    return `${base}${wait} o elegir otro motor.`;
  }
  return base;
}
