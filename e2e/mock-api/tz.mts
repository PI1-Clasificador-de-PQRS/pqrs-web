/**
 * Semántica de `tz` de la API, reimplementada con `Intl`: los filtros de fecha y la serie usan
 * días locales de la zona pedida.
 */

/** `true` si `tz` es una zona IANA que `Intl` reconoce. */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const formats = new Map<string, Intl.DateTimeFormat>();

/** Día local (`YYYY-MM-DD`) de un instante en la zona `tz`. */
export function localDate(instant: Date, tz: string): string {
  let format = formats.get(tz);
  if (!format) {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formats.set(tz, format);
  }
  return format.format(instant);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function addDays(date: string, days: number): string {
  const utc = new Date(`${date}T00:00:00Z`);
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

/** Lunes de la semana de `date` (las semanas empiezan en lunes). */
export function mondayOf(date: string): string {
  const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(date, -weekday);
}

export type Granularity = "day" | "week";

/**
 * Serie sin huecos de `from` a `to` (inclusive), con un período por día o por semana. Devuelve
 * `null` si supera `maxPeriods`.
 */
export function buildSeries(
  localDates: readonly string[],
  from: string,
  to: string,
  granularity: Granularity,
  maxPeriods: number,
): { period: string; count: number }[] | null {
  const step = granularity === "week" ? 7 : 1;
  const bucket = (date: string) => (granularity === "week" ? mondayOf(date) : date);
  const counts = new Map<string, number>();
  for (const date of localDates) counts.set(bucket(date), (counts.get(bucket(date)) ?? 0) + 1);

  const series: { period: string; count: number }[] = [];
  for (let period = bucket(from); period <= to; period = addDays(period, step)) {
    if (series.length >= maxPeriods) return null;
    series.push({ period, count: counts.get(period) ?? 0 });
  }
  return series;
}
