import type { Schemas } from "@/lib/api/client";
import { CATEGORY_COLORS } from "@/lib/pqrs/category-colors";
import {
  CATEGORIES,
  ENGINE_LABELS,
  ENGINES,
  SOURCE_LABELS,
  SOURCES,
  type Category,
  type Engine,
} from "@/lib/pqrs/labels";
import { formatPlainDate, formatShortPlainDate } from "@/lib/time/format";
import type { Granularity } from "@/lib/metrics/period";

export type MetricsSummary = Schemas["MetricsSummary"];

/** Una fila de datos: la misma alimenta el gráfico y su vista de tabla. */
export type ChartRow = {
  key: string;
  label: string;
  /** Etiqueta corta para el eje (por defecto, `label`). */
  shortLabel?: string;
  value: number;
  color?: string;
};

function count(map: Record<string, number> | undefined, key: string): number {
  return map?.[key] ?? 0;
}

/** Categorías con más clasificaciones (todas si hay empate); ninguna con total 0. */
export function topCategories(byCategory: Record<string, number>, total: number): Category[] {
  if (total === 0) return [];
  const max = Math.max(...CATEGORIES.map((category) => count(byCategory, category)));
  if (max === 0) return [];
  return CATEGORIES.filter((category) => count(byCategory, category) === max);
}

export type EngineShare = { engine: Engine; label: string; count: number; ratio: number | null };

/** Porcentaje por motor (`by_model / total`); `null` con total 0. */
export function engineShares(byModel: Record<string, number>, total: number): EngineShare[] {
  return ENGINES.map((engine) => ({
    engine,
    label: ENGINE_LABELS[engine],
    count: count(byModel, engine),
    ratio: total === 0 ? null : count(byModel, engine) / total,
  }));
}

export function categoryRows(byCategory: Record<string, number>): ChartRow[] {
  return CATEGORIES.map((category) => ({
    key: category,
    label: category,
    value: count(byCategory, category),
    color: CATEGORY_COLORS[category],
  }));
}

export function engineRows(byModel: Record<string, number>): ChartRow[] {
  return ENGINES.map((engine) => ({
    key: engine,
    label: ENGINE_LABELS[engine],
    value: count(byModel, engine),
  }));
}

export function sourceRows(bySource: Record<string, number>): ChartRow[] {
  return SOURCES.map((source) => ({
    key: source,
    label: SOURCE_LABELS[source],
    value: count(bySource, source),
  }));
}

export function timeseriesRows(
  points: readonly Schemas["TimeseriesPoint"][],
  granularity: Granularity,
): ChartRow[] {
  return points.map((point) => ({
    key: point.period,
    label:
      granularity === "week"
        ? `Semana del ${formatPlainDate(point.period)}`
        : formatPlainDate(point.period),
    shortLabel: formatShortPlainDate(point.period),
    value: point.count,
  }));
}
