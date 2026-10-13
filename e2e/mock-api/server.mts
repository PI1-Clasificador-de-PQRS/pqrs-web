/**
 * API simulada de pqrs-api para el E2E (solo pruebas). Implementa las rutas de la lista blanca
 * del BFF según `openapi/openapi.json`, con estado en memoria, y verifica en cada petición las
 * cabeceras que debe poner el proxy del dashboard.
 *
 * Uso: `node e2e/mock-api/server.mts` (Node 24 ejecuta TypeScript sin compilar).
 *
 * Variables: MOCK_API_PORT (4010), MOCK_PROXY_SECRET (e2e-proxy-secret),
 * E2E_PASSWORD (clave-de-prueba-e2e), SESSION_COOKIE_NAME (pqrs_session).
 */
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  anonymize,
  CATEGORIES,
  classifyText,
  createStore,
  E2E_ORGANIZATION,
  OTHER_ORGANIZATION,
  ENGINES,
  MODEL_VERSIONS,
  SOURCES,
  type Engine,
  type Schemas,
  type StoredClassification,
} from "./store.mts";
import { buildSeries, isIsoDate, isValidTimeZone, localDate, type Granularity } from "./tz.mts";

const PORT = Number(process.env.MOCK_API_PORT ?? 4010);
const PROXY_SECRET = process.env.MOCK_PROXY_SECRET ?? "e2e-proxy-secret";
const COOKIE = process.env.SESSION_COOKIE_NAME ?? "pqrs_session";
/** La zona que el dashboard debe enviar siempre. */
const EXPECTED_TZ = "America/Bogota";
const MAX_TEXT_CHARS = 5000;
const MAX_REF_CHARS = 100;
const MAX_BATCH_ITEMS = 50;
const MAX_PERIODS = 400;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const store = createStore(process.env.E2E_PASSWORD ?? "clave-de-prueba-e2e");

/** Fallos de las cabeceras del proxy. Playwright exige que la lista esté vacía tras cada prueba. */
let violations: { method: string; path: string; problem: string }[] = [];

class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function send(
  res: ServerResponse,
  status: number,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  if (body === undefined) {
    res.writeHead(status, headers).end();
    return;
  }
  res
    .writeHead(status, { "content-type": "application/json", ...headers })
    .end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(422, "invalid_request", "El cuerpo no es JSON válido.");
  }
}

function readCookie(req: IncomingMessage, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index !== -1 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return undefined;
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Lo que el proxy del dashboard debe garantizar en cada petición a `/api/v1`. */
function checkProxyHeaders(req: IncomingMessage, url: URL, path: string) {
  const method = req.method ?? "GET";
  const fail = (status: number, code: string, problem: string) => {
    violations.push({ method, path, problem });
    throw new HttpError(status, code, problem);
  };
  if (req.headers["x-api-key"] !== undefined) {
    fail(403, "proxy_required", "X-API-Key no debe llegar desde el proxy del dashboard.");
  }
  if (req.headers["x-pqrs-proxy-secret"] !== PROXY_SECRET) {
    fail(403, "proxy_required", "Falta X-PQRS-Proxy-Secret o no es válido.");
  }
  if (MUTATING.has(method) && path !== "auth/login" && req.headers["x-pqrs-csrf"] !== "1") {
    fail(403, "csrf_required", "Falta X-PQRS-CSRF: 1.");
  }
  if (
    (path === "classifications" || path === "metrics/summary") &&
    url.searchParams.get("tz") !== EXPECTED_TZ
  ) {
    fail(422, "invalid_request", `Se esperaba tz=${EXPECTED_TZ}.`);
  }
}

function requireSession(req: IncomingMessage) {
  const session = store.session(readCookie(req, COOKIE));
  if (!session) throw new HttpError(401, "session_required", "Esta ruta requiere sesión.");
  if (session.expired) throw new HttpError(401, "session_expired", "La sesión expiró.");
  return store.userById(session.userId)!;
}

function meResponse(userId: string): Schemas["MeResponse"] {
  const user = store.userById(userId)!;
  return {
    user: { id: user.id, email: user.email, name: user.name },
    organization: store.organization(user.organizationId),
  };
}

function toOut(item: StoredClassification): Schemas["ClassificationOut"] {
  return {
    id: item.id,
    text_anonymized: item.text_anonymized,
    category: item.category,
    model: item.model,
    model_version: item.model_version,
    source: item.source,
    external_ref: item.external_ref,
    batch_id: item.batch_id,
    created_at: item.created_at,
  };
}

function invalid(message: string): never {
  throw new HttpError(422, "invalid_request", message);
}

function engineFor(model: unknown): Engine {
  if (model !== undefined && model !== null && !ENGINES.includes(model as Engine)) {
    invalid("Motor desconocido.");
  }
  const engine = (model as Engine | null | undefined) ?? "classifier";
  const info = store.models().find((candidate) => candidate.id === engine);
  if (!info?.available) {
    throw new HttpError(
      503,
      engine === "llm" ? "llm_unavailable" : "classifier_unavailable",
      "El motor no está disponible.",
    );
  }
  return engine;
}

function textProblem(text: unknown): boolean {
  return typeof text !== "string" || text.trim() === "" || Array.from(text).length > MAX_TEXT_CHARS;
}

function refProblem(ref: unknown): boolean {
  return (
    ref !== undefined &&
    ref !== null &&
    (typeof ref !== "string" || Array.from(ref).length > MAX_REF_CHARS)
  );
}

function saveClassification(opts: {
  organizationId: string;
  text: string;
  engine: Engine;
  source: StoredClassification["source"];
  externalRef?: string | null;
  batchId?: string | null;
  createdAt?: string;
  category?: StoredClassification["category"];
}): StoredClassification {
  return store.add({
    id: randomUUID(),
    organizationId: opts.organizationId,
    text_anonymized: anonymize(opts.text.trim()),
    category: opts.category ?? classifyText(opts.text),
    model: opts.engine,
    model_version: MODEL_VERSIONS[opts.engine],
    source: opts.source,
    external_ref: opts.externalRef ?? null,
    batch_id: opts.batchId ?? null,
    created_at: opts.createdAt ?? new Date().toISOString(),
  });
}

type DateFilter = { tz: string; dateFrom?: string; dateTo?: string };

function readDateFilter(params: URLSearchParams): DateFilter {
  const tz = params.get("tz") ?? "UTC";
  if (!isValidTimeZone(tz)) invalid("Zona horaria inválida.");
  const dateFrom = params.get("date_from") ?? undefined;
  const dateTo = params.get("date_to") ?? undefined;
  for (const date of [dateFrom, dateTo]) {
    if (date !== undefined && !isIsoDate(date)) invalid("Fecha inválida (YYYY-MM-DD).");
  }
  if (dateFrom && dateTo && dateFrom > dateTo)
    invalid("date_from no puede ser posterior a date_to.");
  return { tz, dateFrom, dateTo };
}

/** Mismo filtro de fechas para `/classifications` y `/metrics/summary`: los totales coinciden. */
function inRange(item: StoredClassification, filter: DateFilter): boolean {
  const day = localDate(new Date(item.created_at), filter.tz);
  return (!filter.dateFrom || day >= filter.dateFrom) && (!filter.dateTo || day <= filter.dateTo);
}

function listClassifications(
  organizationId: string,
  params: URLSearchParams,
): Schemas["ClassificationPage"] {
  const filter = readDateFilter(params);
  const category = params.get("category");
  const model = params.get("model");
  const source = params.get("source");
  const batchId = params.get("batch_id");
  if (category && !CATEGORIES.includes(category as never)) invalid("Categoría desconocida.");
  if (model && !ENGINES.includes(model as never)) invalid("Motor desconocido.");
  if (source && !SOURCES.includes(source as never)) invalid("Origen desconocido.");
  if (batchId && !UUID.test(batchId)) invalid("batch_id no es un UUID.");
  const page = Number(params.get("page") ?? 1);
  const pageSize = Number(params.get("page_size") ?? 20);
  if (!Number.isInteger(page) || page < 1) invalid("page debe ser ≥ 1.");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
    invalid("page_size entre 1 y 100.");

  const matches = store
    .classifications(organizationId)
    .filter(
      (item) =>
        inRange(item, filter) &&
        (!category || item.category === category) &&
        (!model || item.model === model) &&
        (!source || item.source === source) &&
        (!batchId || item.batch_id === batchId.toLowerCase()),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.seq - a.seq);

  return {
    items: matches.slice((page - 1) * pageSize, page * pageSize).map(toOut),
    total: matches.length,
    page,
    page_size: pageSize,
  };
}

function countBy<K extends string>(keys: readonly K[], values: readonly K[]): Record<K, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  for (const value of values) counts[value] += 1;
  return counts;
}

function metricsSummary(
  organizationId: string,
  params: URLSearchParams,
): Schemas["MetricsSummary"] {
  const filter = readDateFilter(params);
  const granularity = (params.get("granularity") ?? "day") as Granularity;
  if (granularity !== "day" && granularity !== "week") invalid("granularity debe ser day o week.");

  const items = store.classifications(organizationId).filter((item) => inRange(item, filter));
  const days = items.map((item) => localDate(new Date(item.created_at), filter.tz)).sort();
  // Sin fechas, la serie va de la primera a la última clasificación.
  const from = filter.dateFrom ?? days[0];
  const to = filter.dateTo ?? days.at(-1);
  let timeseries: { period: string; count: number }[] = [];
  if (from && to) {
    const series = buildSeries(days, from, to, granularity, MAX_PERIODS);
    if (!series) invalid(`El rango supera ${MAX_PERIODS} períodos.`);
    timeseries = series;
  }

  const evaluation = Object.fromEntries(
    store.models().map((model) => [model.id, { f1_macro: model.evaluation.f1_macro }]),
  ) as Schemas["EvaluationSummary"];

  return {
    total: items.length,
    by_category: countBy(
      CATEGORIES,
      items.map((item) => item.category),
    ),
    by_model: countBy(
      ENGINES,
      items.map((item) => item.model),
    ),
    by_source: countBy(
      SOURCES,
      items.map((item) => item.source),
    ),
    timeseries,
    evaluation,
    timezone: filter.tz,
  };
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL, path: string) {
  checkProxyHeaders(req, url, path);
  const method = req.method ?? "GET";
  const route = `${method} ${path}`;

  if (route === "POST auth/login") {
    const body = (await readJson(req)) as { email?: unknown; password?: unknown } | undefined;
    if (typeof body?.email !== "string" || typeof body.password !== "string") {
      invalid("Faltan el correo o la contraseña.");
    }
    const user = store.findUser(body.email, body.password);
    if (!user) throw new HttpError(401, "invalid_credentials", "Credenciales inválidas.");
    const token = store.createSession(user.id);
    return send(res, 200, meResponse(user.id), {
      "set-cookie": `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800`,
    });
  }

  if (route === "POST auth/logout") {
    store.deleteSession(readCookie(req, COOKIE));
    return send(res, 204, undefined, {
      "set-cookie": `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
    });
  }

  const user = requireSession(req);
  const organizationId = user.organizationId;

  if (route === "GET me") return send(res, 200, meResponse(user.id));
  if (route === "GET models") return send(res, 200, store.models());

  if (route === "POST classify") {
    const body = (await readJson(req)) as Schemas["ClassifyRequest"] | undefined;
    if (!body || textProblem(body.text) || refProblem(body.external_ref)) {
      invalid("Texto vacío o demasiado largo.");
    }
    const engine = engineFor(body.model);
    const item = saveClassification({
      organizationId,
      text: body.text,
      engine,
      source: "ui",
      externalRef: body.external_ref,
    });
    return send(res, 200, {
      id: item.id,
      category: item.category,
      model: item.model,
      model_version: item.model_version,
      timestamp: item.created_at,
    } satisfies Schemas["ClassifyResponse"]);
  }

  if (route === "POST classify/batch") {
    const body = (await readJson(req)) as Schemas["BatchRequest"] | undefined;
    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      invalid("El lote necesita al menos un elemento.");
    }
    if (body.items.length > MAX_BATCH_ITEMS) {
      throw new HttpError(413, "batch_too_large", "El lote supera 50 elementos.");
    }
    if (body.batch_id != null && !UUID.test(body.batch_id)) invalid("batch_id no es un UUID.");
    const engine = engineFor(body.model);
    const batchId = (body.batch_id ?? randomUUID()).toLowerCase();
    const results: Schemas["BatchItemResult"][] = body.items.map((entry, index) => {
      if (textProblem(entry.text)) {
        return {
          index,
          id: null,
          category: null,
          model_version: null,
          error: { code: "invalid_text", message: "Texto vacío o demasiado largo." },
        };
      }
      if (refProblem(entry.external_ref)) {
        return {
          index,
          id: null,
          category: null,
          model_version: null,
          error: { code: "invalid_external_ref", message: "Referencia demasiado larga." },
        };
      }
      const item = saveClassification({
        organizationId,
        text: entry.text,
        engine,
        source: "ui_batch",
        externalRef: entry.external_ref,
        batchId,
      });
      return {
        index,
        id: item.id,
        category: item.category,
        model_version: item.model_version,
        error: null,
      };
    });
    return send(res, 200, {
      batch_id: batchId,
      model: engine,
      results,
    } satisfies Schemas["BatchResponse"]);
  }

  if (route === "GET classifications") {
    return send(res, 200, listClassifications(organizationId, url.searchParams));
  }

  const detail = /^classifications\/([^/]+)$/.exec(path);
  if (method === "GET" && detail) {
    const item = store
      .classifications(organizationId)
      .find((candidate) => candidate.id === detail[1]!.toLowerCase());
    if (!item) throw new HttpError(404, "not_found", "Recurso no encontrado.");
    return send(res, 200, toOut(item));
  }

  if (route === "GET metrics/summary") {
    return send(res, 200, metricsSummary(organizationId, url.searchParams));
  }

  throw new HttpError(404, "not_found", "Recurso no encontrado.");
}

type SeedItem = {
  created_at: string;
  text: string;
  category?: StoredClassification["category"];
  model?: Engine;
  source?: StoredClassification["source"];
  batch_id?: string | null;
  external_ref?: string | null;
  /** `other` siembra en otra organización (para probar el 404 entre organizaciones). */
  organization?: "e2e" | "other";
};

/** Rutas de control, solo de la API simulada (Playwright las llama directo, nunca por el BFF). */
async function handleControl(req: IncomingMessage, res: ServerResponse, path: string) {
  const route = `${req.method} ${path}`;
  if (route === "POST /__test/reset") {
    store.reset();
    violations = [];
    return send(res, 204);
  }
  if (route === "GET /__test/violations") return send(res, 200, violations);
  if (route === "POST /__test/expire-sessions") {
    store.expireSessions();
    return send(res, 204);
  }
  if (route === "PUT /__test/models") {
    store.setModels((await readJson(req)) as Schemas["ModelInfo"][]);
    return send(res, 204);
  }
  if (route === "POST /__test/seed") {
    const body = (await readJson(req)) as { items: SeedItem[] };
    const created = body.items.map((seed) => {
      if (Number.isNaN(Date.parse(seed.created_at))) invalid("created_at inválido.");
      return toOut(
        saveClassification({
          organizationId:
            seed.organization === "other" ? OTHER_ORGANIZATION.id : E2E_ORGANIZATION.id,
          text: seed.text,
          engine: seed.model ?? "classifier",
          source: seed.source ?? "api",
          externalRef: seed.external_ref,
          batchId: seed.batch_id,
          createdAt: new Date(seed.created_at).toISOString(),
          category: seed.category,
        }),
      );
    });
    return send(res, 201, created);
  }
  throw new HttpError(404, "not_found", "Ruta de control desconocida.");
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  try {
    if (url.pathname === "/health") return send(res, 200, { status: "ok" });
    if (url.pathname.startsWith("/__test/")) return await handleControl(req, res, url.pathname);
    if (url.pathname.startsWith("/api/v1/")) {
      return await handleApi(req, res, url, url.pathname.slice("/api/v1/".length));
    }
    throw new HttpError(404, "not_found", "Recurso no encontrado.");
  } catch (error) {
    if (error instanceof HttpError) {
      return send(res, error.status, { detail: { code: error.code, message: error.message } });
    }
    console.error("[mock-api]", error);
    return send(res, 500, { detail: { code: "internal_error", message: "Error interno." } });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.warn(`[mock-api] escuchando en http://127.0.0.1:${PORT}`);
});
