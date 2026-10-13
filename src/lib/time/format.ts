import { APP_TIMEZONE, type IsoDate } from "@/lib/time/zone";

const dateTimeFormat = new Intl.DateTimeFormat("es-CO", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const plainDateFormat = new Intl.DateTimeFormat("es-CO", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
});

const shortPlainDateFormat = new Intl.DateTimeFormat("es-CO", {
  timeZone: APP_TIMEZONE,
  month: "short",
  day: "numeric",
});

const numberFormat = new Intl.NumberFormat("es-CO");

const percentFormat = new Intl.NumberFormat("es-CO", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Un instante de la API (`created_at`), en `APP_TIMEZONE`: «12 oct 2026, 20:00». */
export function formatDateTime(instant: string): string {
  return dateTimeFormat.format(new Date(instant));
}

/**
 * Una fecha de calendario (`YYYY-MM-DD`, ya local de `APP_TIMEZONE`). Se construye a las 12:00
 * UTC, que en Bogotá sigue siendo el mismo día, y se formatea en `APP_TIMEZONE`.
 */
function plainDate(date: IsoDate): Date {
  return new Date(`${date}T12:00:00Z`);
}

export function formatPlainDate(date: IsoDate): string {
  return plainDateFormat.format(plainDate(date));
}

export function formatShortPlainDate(date: IsoDate): string {
  return shortPlainDateFormat.format(plainDate(date));
}

/** Miles con `.` y decimales con `,`. */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** `ratio` entre 0 y 1: «45,5 %». */
export function formatPercent(ratio: number): string {
  return percentFormat.format(ratio);
}
