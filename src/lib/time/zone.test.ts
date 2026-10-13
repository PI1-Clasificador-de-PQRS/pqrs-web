import { formatDateTime, formatNumber, formatPercent, formatPlainDate } from "@/lib/time/format";
import {
  addDays,
  daysInRange,
  isValidIsoDate,
  mondayOf,
  startOfMonth,
  todayInAppZone,
} from "@/lib/time/zone";

describe("zona horaria del dashboard", () => {
  const originalTz = process.env.TZ;

  beforeEach(() => {
    // El navegador en otra zona: nada debe depender de ella.
    process.env.TZ = "Asia/Tokyo";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = originalTz;
  });

  it("hoy es la fecha de Bogotá aunque en UTC (y en el navegador) ya sea el día siguiente", () => {
    // 23:30 del 12 de octubre en Bogotá = 04:30 UTC del 13 = 13:30 del 13 en Tokio.
    vi.setSystemTime(new Date("2026-10-13T04:30:00Z"));
    expect(new Date().getDate()).toBe(13);
    expect(todayInAppZone()).toBe("2026-10-12");
  });

  it("01:00 UTC se muestra como el día anterior a las 20:00", () => {
    const text = formatDateTime("2026-10-13T01:00:00Z");
    expect(text).toMatch(/12/);
    expect(text).not.toMatch(/13/);
    expect(text).toMatch(/20:00/);
  });

  it("formatea una fecha de calendario sin desplazarla de día", () => {
    expect(formatPlainDate("2026-10-12")).toMatch(/^12 de oct\.? de 2026$/);
    expect(formatPlainDate("2026-01-01")).toMatch(/^1 de ene\.? de 2026$/);
  });
});

describe("aritmética de fechas", () => {
  it("suma días, cruza meses y años", () => {
    expect(addDays("2026-10-12", -6)).toBe("2026-10-06");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("calcula el inicio del mes y el lunes de la semana", () => {
    expect(startOfMonth("2026-10-12")).toBe("2026-10-01");
    expect(mondayOf("2026-10-12")).toBe("2026-10-12"); // lunes
    expect(mondayOf("2026-10-18")).toBe("2026-10-12"); // domingo
  });

  it("cuenta los días de un rango inclusivo", () => {
    expect(daysInRange("2026-10-01", "2026-10-01")).toBe(1);
    expect(daysInRange("2025-01-01", "2025-12-31")).toBe(365);
  });

  it("valida fechas YYYY-MM-DD reales", () => {
    expect(isValidIsoDate("2026-02-28")).toBe(true);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("12/10/2026")).toBe(false);
  });
});

describe("números es-CO", () => {
  it("usa . para miles y , para decimales", () => {
    expect(formatNumber(12345)).toBe("12.345");
    expect(formatPercent(0.4555)).toMatch(/^45,6\s?%$/);
  });
});
