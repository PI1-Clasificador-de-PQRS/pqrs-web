import {
  customRangeError,
  effectiveGranularity,
  parseMetricsSearch,
  resolveRange,
  toMetricsSearch,
  toSummaryQuery,
  type MetricsSearch,
} from "@/lib/metrics/period";
import { todayInAppZone } from "@/lib/time/zone";

describe("período de Métricas ↔ URL", () => {
  it("por defecto: últimos 30 días, por día", () => {
    expect(parseMetricsSearch(new URLSearchParams())).toEqual({
      preset: "30d",
      granularity: "day",
    });
    expect(toMetricsSearch({ preset: "30d", granularity: "day" })).toBe("");
  });

  it("ida y vuelta con un rango personalizado", () => {
    const search: MetricsSearch = {
      preset: "custom",
      dateFrom: "2026-01-01",
      dateTo: "2026-03-31",
      granularity: "week",
    };
    expect(parseMetricsSearch(new URLSearchParams(toMetricsSearch(search)))).toEqual(search);
  });

  it("ignora las fechas fuera del rango personalizado y los valores inválidos", () => {
    expect(
      parseMetricsSearch(new URLSearchParams("period=7d&date_from=2026-01-01&granularity=mes")),
    ).toEqual({ preset: "7d", granularity: "day" });
    expect(parseMetricsSearch(new URLSearchParams("period=anual"))).toMatchObject({
      preset: "30d",
    });
  });

  it("valida el rango personalizado", () => {
    const base = { preset: "custom" as const, granularity: "day" as const };
    expect(customRangeError({ ...base, dateFrom: "2026-10-01" })).toMatch(/Elige/);
    expect(customRangeError({ ...base, dateFrom: "2026-10-12", dateTo: "2026-10-01" })).toMatch(
      /posterior/,
    );
    expect(customRangeError({ ...base, dateFrom: "2026-10-01", dateTo: "2026-10-12" })).toBeNull();
  });
});

describe("rangos predefinidos con la fecha de Bogotá", () => {
  const originalTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "Europe/Madrid";
    vi.useFakeTimers();
    // 23:30 del 31 de octubre en Bogotá: en UTC (y en Madrid) ya es 1 de noviembre.
    vi.setSystemTime(new Date("2026-11-01T04:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = originalTz;
  });

  it("últimos 7 días, últimos 30 días y este mes", () => {
    const today = todayInAppZone();
    expect(today).toBe("2026-10-31");
    const range = (preset: MetricsSearch["preset"]) =>
      resolveRange({ preset, granularity: "day" }, today);
    expect(range("7d")).toEqual({ dateFrom: "2026-10-25", dateTo: "2026-10-31" });
    expect(range("30d")).toEqual({ dateFrom: "2026-10-02", dateTo: "2026-10-31" });
    expect(range("month")).toEqual({ dateFrom: "2026-10-01", dateTo: "2026-10-31" });
    expect(range("all")).toEqual({});
  });
});

describe("granularidad efectiva", () => {
  it("cambia a semana con más de 400 días por día", () => {
    expect(effectiveGranularity({ dateFrom: "2025-01-01", dateTo: "2026-02-04" }, "day")).toEqual({
      granularity: "day",
    }); // 400 días exactos
    expect(effectiveGranularity({ dateFrom: "2025-01-01", dateTo: "2026-02-05" }, "day")).toEqual({
      granularity: "week",
      forcedReason: "long_range",
    });
    expect(effectiveGranularity({ dateFrom: "2020-01-01", dateTo: "2026-02-05" }, "week")).toEqual({
      granularity: "week",
    });
  });

  it("todo el historial siempre por semana", () => {
    expect(effectiveGranularity({}, "day")).toEqual({
      granularity: "week",
      forcedReason: "all_history",
    });
    expect(effectiveGranularity({}, "week")).toEqual({ granularity: "week" });
  });

  it("la consulta siempre lleva tz=America/Bogota", () => {
    expect(toSummaryQuery({}, "week")).toEqual({
      date_from: undefined,
      date_to: undefined,
      granularity: "week",
      tz: "America/Bogota",
    });
  });
});
