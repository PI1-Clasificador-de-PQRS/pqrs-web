import createClient from "openapi-fetch";
import { networkError, toApiError } from "@/lib/api/errors";
import type { components, paths } from "@/lib/api/schema";

/**
 * Cliente tipado del navegador. Solo habla con el proxy BFF del dashboard (`/api/proxy/...`),
 * que reenvía a `/api/v1/...` de la API; por eso las rutas del spec se usan sin `/api/v1`.
 */
export type ProxyPaths = {
  [K in keyof paths as K extends `/api/v1/${infer Rest}` ? `/${Rest}` : never]: paths[K];
};

export type Schemas = components["schemas"];
export type Engine = Schemas["Engine"];
export type ModelInfo = Schemas["ModelInfo"];
export type MeResponse = Schemas["MeResponse"];

export const PROXY_BASE_PATH = "/api/proxy";

/** Rutas cuyo 401 no significa "sesión expirada": el formulario los maneja por su cuenta. */
const SESSION_EXEMPT_PATHS = new Set(["/auth/login", "/auth/logout"]);

export function createApiClient(opts: { baseUrl: string; onUnauthorized: () => void }) {
  const client = createClient<ProxyPaths>({
    baseUrl: opts.baseUrl,
    credentials: "same-origin",
    // Búsqueda tardía de `fetch` (openapi-fetch guarda la referencia al crear el cliente).
    fetch: (request) => globalThis.fetch(request),
    // La pide el proxy en toda petición que modifica datos (protección CSRF).
    headers: { "X-Requested-With": "pqrs-web" },
  });
  client.use({
    onResponse({ response, schemaPath }) {
      if (response.status === 401 && !SESSION_EXEMPT_PATHS.has(schemaPath)) {
        opts.onUnauthorized();
      }
    },
  });
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;

type ClientResult<T> = { data?: T; error?: unknown; response: Response };

/** Devuelve `data` o lanza `ApiError` (también ante un fallo de red). */
export async function unwrap<T>(promise: Promise<ClientResult<T>>): Promise<T> {
  let result: ClientResult<T>;
  try {
    result = await promise;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw networkError();
  }
  if (!result.response.ok) {
    throw toApiError(result.response.status, result.error, result.response.headers);
  }
  return result.data as T;
}

let unauthorizedHandler: () => void = () => {};

/** Lo registra `Providers` para limpiar la caché y redirigir ante cualquier 401. */
export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

/** Cliente compartido de la aplicación. */
export const api = createApiClient({
  baseUrl:
    typeof window === "undefined" ? PROXY_BASE_PATH : `${window.location.origin}${PROXY_BASE_PATH}`,
  onUnauthorized: () => unauthorizedHandler(),
});
