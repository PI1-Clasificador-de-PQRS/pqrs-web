/**
 * Catálogo único de mensajes de error en español, a partir del `code` estable de la API.
 * Si llega un código desconocido se muestra el `message` de la API.
 */

export type ApiErrorBody = { detail: { code: string; message: string } };

const MESSAGES: Record<string, string> = {
  missing_credentials: "Tu sesión no es válida. Inicia sesión de nuevo.",
  invalid_credentials: "Correo o contraseña incorrectos.",
  session_expired: "Tu sesión expiró. Inicia sesión de nuevo.",
  session_required: "Esta acción requiere iniciar sesión.",
  csrf_required: "La solicitud se bloqueó por seguridad. Recarga la página e inténtalo de nuevo.",
  proxy_required:
    "El panel no pudo comunicarse de forma segura con el servicio. Avisa al administrador.",
  not_found: "No se encontró lo que buscabas.",
  method_not_allowed: "Esta operación no está permitida.",
  batch_too_large: "El bloque supera el máximo de 50 textos.",
  payload_too_large: "El texto es demasiado grande para enviarlo.",
  invalid_request: "El texto no es válido. Revisa que no esté vacío ni supere 5.000 caracteres.",
  invalid_text: "El texto está vacío o supera los 5.000 caracteres.",
  invalid_external_ref: "La referencia supera los 100 caracteres.",
  too_many_attempts: "Demasiados intentos de inicio de sesión.",
  rate_limited: "Se alcanzó el límite de solicitudes por minuto.",
  llm_unavailable: "El motor LLM no está disponible en este momento.",
  classifier_unavailable: "El clasificador local no está disponible en este momento.",
  database_unavailable: "El servicio no puede guardar datos en este momento. Inténtalo más tarde.",
  internal_error: "Ocurrió un error inesperado en el servicio. Inténtalo más tarde.",
  api_unreachable: "No se pudo contactar el servicio de clasificación. Inténtalo más tarde.",
  network_error: "No hay conexión con el panel. Revisa tu conexión a internet.",
};

const FALLBACK = "Ocurrió un error inesperado. Inténtalo de nuevo.";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly apiMessage: string | undefined;
  /** Segundos de `Retry-After`, si la respuesta lo trae. */
  readonly retryAfter: number | undefined;

  constructor(opts: { status: number; code: string; apiMessage?: string; retryAfter?: number }) {
    super(`${opts.status} ${opts.code}`);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code;
    this.apiMessage = opts.apiMessage;
    this.retryAfter = opts.retryAfter;
  }
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("detail" in value)) return false;
  const detail = (value as { detail: unknown }).detail;
  return (
    typeof detail === "object" &&
    detail !== null &&
    typeof (detail as { code?: unknown }).code === "string" &&
    typeof (detail as { message?: unknown }).message === "string"
  );
}

/** Segundos de una cabecera `Retry-After` (número o fecha HTTP). */
export function parseRetryAfter(
  value: string | null | undefined,
  now = Date.now(),
): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - now) / 1000));
}

export function toApiError(status: number, body: unknown, headers?: Headers): ApiError {
  const retryAfter = parseRetryAfter(headers?.get("retry-after"));
  if (isApiErrorBody(body)) {
    return new ApiError({
      status,
      code: body.detail.code,
      apiMessage: body.detail.message,
      retryAfter,
    });
  }
  return new ApiError({ status, code: "unknown", retryAfter });
}

export function networkError(): ApiError {
  return new ApiError({ status: 0, code: "network_error" });
}

export function messageForCode(code: string, apiMessage?: string): string {
  return MESSAGES[code] ?? apiMessage ?? FALLBACK;
}

/** Mensaje en español para mostrar al usuario a partir de cualquier error. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return messageForCode(error.code, error.apiMessage);
  return FALLBACK;
}

export function formatSeconds(seconds: number): string {
  return seconds === 1 ? "1 segundo" : `${seconds} segundos`;
}
