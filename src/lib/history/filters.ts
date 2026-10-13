import {
  isCategory,
  isEngine,
  isSource,
  type Category,
  type Engine,
  type Source,
} from "@/lib/pqrs/labels";
import { APP_TIMEZONE, isValidIsoDate, type IsoDate } from "@/lib/time/zone";

/**
 * Filtros del Historial. Viven en la URL con los mismos nombres que la API
 * (`/historial?batch_id=…` funciona tal cual), así se pueden compartir y el botón Atrás funciona.
 */
export type HistoryFilters = {
  dateFrom?: IsoDate;
  dateTo?: IsoDate;
  category?: Category;
  model?: Engine;
  source?: Source;
  batchId?: string;
};

export type HistoryState = HistoryFilters & { page: number; pageSize: PageSize };

export const PAGE_SIZES = [20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 20;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ReadableParams = { get(name: string): string | null };

function read(params: ReadableParams, name: string): string | undefined {
  const value = params.get(name)?.trim();
  return value ? value : undefined;
}

/** URL → estado. Un valor que no es válido se ignora (como si no estuviera). */
export function parseHistorySearch(params: ReadableParams): HistoryState {
  const dateFrom = read(params, "date_from");
  const dateTo = read(params, "date_to");
  const category = read(params, "category");
  const model = read(params, "model");
  const source = read(params, "source");
  const batchId = read(params, "batch_id");
  const page = Number(read(params, "page"));
  const pageSize = Number(read(params, "page_size"));

  return {
    dateFrom: dateFrom && isValidIsoDate(dateFrom) ? dateFrom : undefined,
    dateTo: dateTo && isValidIsoDate(dateTo) ? dateTo : undefined,
    category: category && isCategory(category) ? category : undefined,
    model: model && isEngine(model) ? model : undefined,
    source: source && isSource(source) ? source : undefined,
    batchId: batchId && UUID.test(batchId) ? batchId.toLowerCase() : undefined,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize)
      ? (pageSize as PageSize)
      : DEFAULT_PAGE_SIZE,
  };
}

/** Estado → URL. Los valores por defecto (página 1, 20 por página) no se escriben. */
export function toHistorySearch(state: Partial<HistoryState>): string {
  const params = new URLSearchParams();
  if (state.dateFrom) params.set("date_from", state.dateFrom);
  if (state.dateTo) params.set("date_to", state.dateTo);
  if (state.category) params.set("category", state.category);
  if (state.model) params.set("model", state.model);
  if (state.source) params.set("source", state.source);
  if (state.batchId) params.set("batch_id", state.batchId);
  if (state.page && state.page > 1) params.set("page", String(state.page));
  if (state.pageSize && state.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("page_size", String(state.pageSize));
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function historyHref(state: Partial<HistoryState> = {}): string {
  return `/historial${toHistorySearch(state)}`;
}

export function hasFilters(filters: HistoryFilters): boolean {
  return Boolean(
    filters.dateFrom ||
    filters.dateTo ||
    filters.category ||
    filters.model ||
    filters.source ||
    filters.batchId,
  );
}

export const INVERTED_RANGE_MESSAGE = "La fecha «Desde» no puede ser posterior a la fecha «Hasta».";

/** Fechas invertidas: se validan antes de enviar (la API respondería 422). */
export function rangeError(filters: Pick<HistoryFilters, "dateFrom" | "dateTo">): string | null {
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    return INVERTED_RANGE_MESSAGE;
  }
  return null;
}

/** Parámetros de `GET /classifications`. Siempre con `tz=APP_TIMEZONE`. */
export function toClassificationsQuery(state: HistoryState) {
  return {
    date_from: state.dateFrom,
    date_to: state.dateTo,
    category: state.category,
    model: state.model,
    source: state.source,
    batch_id: state.batchId,
    page: state.page,
    page_size: state.pageSize,
    tz: APP_TIMEZONE,
  };
}

/** Total de páginas (al menos 1, para mostrar «Página 1 de 1» aunque no haya resultados). */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
