/**
 * Zona horaria única del dashboard. Toda petición a `/classifications` y `/metrics/summary` la
 * envía como `tz`, y todas las fechas se calculan y se muestran en ella: nunca en la zona del
 * navegador ni en UTC.
 */
export const APP_TIMEZONE = "America/Bogota";

/** Fecha de calendario `YYYY-MM-DD` (sin hora ni zona). */
export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const localDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Día local en `APP_TIMEZONE` de un instante. */
export function toAppDate(instant: Date): IsoDate {
  return localDateFormat.format(instant);
}

/** Hoy en `APP_TIMEZONE`. */
export function todayInAppZone(now: Date = new Date()): IsoDate {
  return toAppDate(now);
}

export function isValidIsoDate(value: string): value is IsoDate {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// La aritmética de fechas de calendario se hace en UTC, donde no hay cambios de hora: una fecha
// sin zona no se desplaza.
function toUtc(date: IsoDate): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const utc = toUtc(date);
  utc.setUTCDate(utc.getUTCDate() + days);
  return fromUtc(utc);
}

export function startOfMonth(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`;
}

/** Lunes de la semana de `date`. */
export function mondayOf(date: IsoDate): IsoDate {
  const weekday = (toUtc(date).getUTCDay() + 6) % 7; // 0 = lunes
  return addDays(date, -weekday);
}

/** Días entre dos fechas, contando las dos (`2026-10-01`..`2026-10-01` = 1). */
export function daysInRange(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000) + 1;
}
