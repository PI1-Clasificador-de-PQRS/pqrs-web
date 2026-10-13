import {
  addDays,
  APP_TIMEZONE,
  daysInRange,
  isValidIsoDate,
  startOfMonth,
  type IsoDate,
} from "@/lib/time/zone";

/**
 * Período de Métricas. Vive en la URL (`period`, `date_from`, `date_to`, `granularity`). Los
 * rangos predefinidos se calculan con la fecha de hoy en `APP_TIMEZONE`.
 */
export const PRESETS = ["7d", "30d", "month", "all", "custom"] as const;
export type Preset = (typeof PRESETS)[number];
export const DEFAULT_PRESET: Preset = "30d";

export const PRESET_LABELS: Record<Preset, string> = {
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  month: "Este mes",
  all: "Todo el historial",
  custom: "Rango personalizado",
};

export type Granularity = "day" | "week";
export const GRANULARITY_LABELS: Record<Granularity, string> = { day: "Día", week: "Semana" };

/** La API responde 422 con más de 400 períodos. */
export const MAX_DAY_PERIODS = 400;

export type MetricsSearch = {
  preset: Preset;
  /** Solo con `custom`. */
  dateFrom?: IsoDate;
  dateTo?: IsoDate;
  granularity: Granularity;
};

export type DateRange = { dateFrom?: IsoDate; dateTo?: IsoDate };

type ReadableParams = { get(name: string): string | null };

function isPreset(value: string | null): value is Preset {
  return value !== null && (PRESETS as readonly string[]).includes(value);
}

function validDate(value: string | null): IsoDate | undefined {
  return value && isValidIsoDate(value) ? value : undefined;
}

export function parseMetricsSearch(params: ReadableParams): MetricsSearch {
  const period = params.get("period");
  const preset = isPreset(period) ? period : DEFAULT_PRESET;
  const granularity = params.get("granularity") === "week" ? "week" : "day";
  if (preset !== "custom") return { preset, granularity };
  return {
    preset,
    dateFrom: validDate(params.get("date_from")),
    dateTo: validDate(params.get("date_to")),
    granularity,
  };
}

export function toMetricsSearch(search: MetricsSearch): string {
  const params = new URLSearchParams();
  if (search.preset !== DEFAULT_PRESET) params.set("period", search.preset);
  if (search.preset === "custom") {
    if (search.dateFrom) params.set("date_from", search.dateFrom);
    if (search.dateTo) params.set("date_to", search.dateTo);
  }
  if (search.granularity !== "day") params.set("granularity", search.granularity);
  const value = params.toString();
  return value ? `?${value}` : "";
}

/** Rango de fechas del período. «Todo el historial» no tiene fechas. */
export function resolveRange(search: MetricsSearch, today: IsoDate): DateRange {
  switch (search.preset) {
    case "7d":
      return { dateFrom: addDays(today, -6), dateTo: today };
    case "30d":
      return { dateFrom: addDays(today, -29), dateTo: today };
    case "month":
      return { dateFrom: startOfMonth(today), dateTo: today };
    case "all":
      return {};
    case "custom":
      return { dateFrom: search.dateFrom, dateTo: search.dateTo };
  }
}

export function customRangeError(search: MetricsSearch): string | null {
  if (search.preset !== "custom") return null;
  if (!search.dateFrom || !search.dateTo) return "Elige la fecha inicial y la final del rango.";
  if (search.dateFrom > search.dateTo) {
    return "La fecha «Desde» no puede ser posterior a la fecha «Hasta».";
  }
  return null;
}

export type GranularityChoice = {
  granularity: Granularity;
  /** Por qué se usa semana aunque se pidió día. */
  forcedReason?: "all_history" | "long_range";
};

/**
 * Granularidad que se envía: «todo el historial» siempre por semana, y un rango por día de más
 * de 400 días pasa a semana (la API rechaza más de 400 períodos).
 */
export function effectiveGranularity(range: DateRange, requested: Granularity): GranularityChoice {
  if (!range.dateFrom || !range.dateTo) {
    return requested === "week"
      ? { granularity: "week" }
      : { granularity: "week", forcedReason: "all_history" };
  }
  if (requested === "day" && daysInRange(range.dateFrom, range.dateTo) > MAX_DAY_PERIODS) {
    return { granularity: "week", forcedReason: "long_range" };
  }
  return { granularity: requested };
}

/** Parámetros de `GET /metrics/summary`. Siempre con `tz=APP_TIMEZONE`. */
export function toSummaryQuery(range: DateRange, granularity: Granularity) {
  return {
    date_from: range.dateFrom,
    date_to: range.dateTo,
    granularity,
    tz: APP_TIMEZONE,
  };
}
