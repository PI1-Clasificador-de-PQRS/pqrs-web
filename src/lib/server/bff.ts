import "server-only";

import { clientIpFromForwardedFor } from "@/lib/server/client-ip";
import { getEnv, type ServerEnv } from "@/lib/server/env";

/**
 * Proxy BFF: el único camino del navegador a pqrs-api. El navegador nunca maneja credenciales:
 * este módulo añade el secreto del proxy, la IP del navegador y la cabecera CSRF de la API, y
 * solo reenvía la cookie de sesión. Las reglas están documentadas en AGENTS.md.
 *
 * No registra nunca cuerpos, cookies ni cabeceras.
 */

type Method = "GET" | "POST";

type RouteRule = {
  method: Method;
  pattern: RegExp;
  /** El login no lleva X-PQRS-CSRF (la API no lo exige), aunque sí pasa la verificación CSRF. */
  isLogin?: boolean;
};

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

/** Lista blanca de rutas (relativas a /api/v1) y métodos. Todo lo demás responde 404. */
const ROUTES: readonly RouteRule[] = [
  { method: "POST", pattern: /^auth\/login$/, isLogin: true },
  { method: "POST", pattern: /^auth\/logout$/ },
  { method: "GET", pattern: /^me$/ },
  { method: "GET", pattern: /^models$/ },
  { method: "POST", pattern: /^classify$/ },
  { method: "POST", pattern: /^classify\/batch$/ },
  { method: "GET", pattern: /^classifications$/ },
  { method: "GET", pattern: new RegExp(`^classifications/${UUID}$`) },
  { method: "GET", pattern: /^metrics\/summary$/ },
];

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Cabeceras de la petición del navegador que sí pasan a la API (además de las que se añaden). */
const FORWARDED_REQUEST_HEADERS = ["accept", "accept-language", "content-type"] as const;

export const REQUESTED_WITH_VALUE = "pqrs-web";
export const MAX_BODY_BYTES = 2 * 1024 * 1024;
export const UPSTREAM_TIMEOUT_MS = 120_000;

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json(
    { detail: { code, message } },
    { status, headers: { "cache-control": "no-store" } },
  );
}

function findRoute(method: string, path: string): RouteRule | undefined {
  return ROUTES.find((rule) => rule.method === method && rule.pattern.test(path));
}

/**
 * Verificación CSRF del lado del navegador para métodos que modifican datos:
 * `X-Requested-With: pqrs-web` y, además, `Origin` del mismo host que el dashboard o, sin
 * `Origin`, `Sec-Fetch-Site: same-origin`. Un `Origin` ajeno se rechaza siempre.
 */
export function passesCsrfCheck(headers: Headers): boolean {
  if (headers.get("x-requested-with") !== REQUESTED_WITH_VALUE) return false;
  const origin = headers.get("origin");
  if (origin) {
    const host = headers.get("host");
    try {
      return host !== null && new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return headers.get("sec-fetch-site") === "same-origin";
}

function readCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return undefined;
}

/**
 * Cabeceras hacia la API. Se parte de cero (no se copia y se borra), así que `X-API-Key`,
 * `Authorization`, `X-Forwarded-*`, cualquier `X-PQRS-*` del navegador y las cookies ajenas
 * nunca salen.
 */
function buildUpstreamHeaders(
  incoming: Headers,
  env: ServerEnv,
  opts: { addCsrf: boolean },
): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = incoming.get(name);
    if (value) headers.set(name, value);
  }
  const session = readCookie(incoming.get("cookie"), env.sessionCookieName);
  if (session) headers.set("cookie", `${env.sessionCookieName}=${session}`);
  headers.set("x-pqrs-proxy-secret", env.proxySharedSecret);
  const ip = clientIpFromForwardedFor(incoming.get("x-forwarded-for"), env.trustedProxyHops);
  if (ip) headers.set("x-pqrs-client-ip", ip);
  if (opts.addCsrf) headers.set("x-pqrs-csrf", "1");
  return headers;
}

async function readBody(request: Request): Promise<ArrayBuffer | "too_large"> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return "too_large";
  const body = await request.arrayBuffer();
  return body.byteLength > MAX_BODY_BYTES ? "too_large" : body;
}

/** Copia el status y el cuerpo de la API; solo deja pasar `Set-Cookie` y `Retry-After`. */
async function toBrowserResponse(upstream: Response): Promise<Response> {
  const headers = new Headers({ "cache-control": "no-store" });
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  for (const cookie of upstream.headers.getSetCookie()) headers.append("set-cookie", cookie);
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) headers.set("retry-after", retryAfter);

  const hasBody = upstream.status !== 204 && upstream.status !== 304;
  const body = hasBody ? await upstream.arrayBuffer() : null;
  return new Response(body, { status: upstream.status, headers });
}

/**
 * Atiende una petición del navegador a `/api/proxy/<path>` reenviándola a
 * `${API_BASE_URL}/api/v1/<path>`.
 */
export async function proxyRequest(
  request: Request,
  pathSegments: readonly string[],
  env: ServerEnv = getEnv(),
): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = pathSegments.join("/");
  const route = findRoute(method, path);
  if (!route) return errorResponse(404, "not_found", "Recurso no encontrado.");

  const mutating = MUTATING_METHODS.has(method);
  if (mutating && !passesCsrfCheck(request.headers)) {
    return errorResponse(
      403,
      "csrf_required",
      "La petición no pasó la verificación de origen del panel.",
    );
  }

  let body: ArrayBuffer | undefined;
  if (mutating) {
    const read = await readBody(request);
    if (read === "too_large") {
      return errorResponse(
        413,
        "payload_too_large",
        "El cuerpo de la petición supera el tamaño máximo permitido.",
      );
    }
    body = read;
  }

  const target = new URL(`${env.apiBaseUrl}/api/v1/${path}`);
  if (method === "GET") target.search = new URL(request.url).search;

  try {
    const upstream = await fetch(target, {
      method,
      headers: buildUpstreamHeaders(request.headers, env, {
        addCsrf: mutating && !route.isLogin,
      }),
      body,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    return await toBrowserResponse(upstream);
  } catch (error) {
    // Solo el tipo de error: nada de URL con datos, cuerpos ni cabeceras.
    console.error(
      `[proxy] ${method} ${route.pattern.source}: API no disponible (${(error as Error).name})`,
    );
    return errorResponse(502, "api_unreachable", "No se pudo contactar la API de clasificación.");
  }
}
