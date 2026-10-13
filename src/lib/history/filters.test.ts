import {
  historyHref,
  pageCount,
  parseHistorySearch,
  rangeError,
  toClassificationsQuery,
  toHistorySearch,
  type HistoryState,
} from "@/lib/history/filters";

const BATCH = "0b9d6c58-4d6f-4f7e-9d8e-3c1d2e0f9a11";

describe("filtros del Historial ↔ URL", () => {
  it("lee todos los filtros y la página desde la URL", () => {
    const state = parseHistorySearch(
      new URLSearchParams({
        date_from: "2026-10-01",
        date_to: "2026-10-12",
        category: "Solicitud de información",
        model: "classifier",
        source: "ui_batch",
        batch_id: BATCH,
        page: "3",
        page_size: "50",
      }),
    );
    expect(state).toEqual({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-12",
      category: "Solicitud de información",
      model: "classifier",
      source: "ui_batch",
      batchId: BATCH,
      page: 3,
      pageSize: 50,
    });
  });

  it("ignora los valores inválidos y usa los valores por defecto", () => {
    const state = parseHistorySearch(
      new URLSearchParams({
        date_from: "2026-02-30",
        category: "Queja",
        model: "gpt",
        source: "web",
        batch_id: "no-es-uuid",
        page: "-2",
        page_size: "30",
      }),
    );
    expect(state).toEqual({ page: 1, pageSize: 20 });
  });

  it("ida y vuelta: estado → URL → estado", () => {
    const state: HistoryState = {
      dateFrom: "2026-10-01",
      dateTo: "2026-10-12",
      category: "Petición",
      model: "llm",
      source: "api",
      batchId: BATCH,
      page: 2,
      pageSize: 100,
    };
    const search = toHistorySearch(state);
    expect(parseHistorySearch(new URLSearchParams(search))).toEqual(state);
  });

  it("no escribe en la URL los valores por defecto", () => {
    expect(toHistorySearch({ page: 1, pageSize: 20 })).toBe("");
    expect(historyHref({ batchId: BATCH })).toBe(`/historial?batch_id=${BATCH}`);
  });
});

describe("validación de fechas", () => {
  it("rechaza un rango invertido y acepta un solo día", () => {
    expect(rangeError({ dateFrom: "2026-10-12", dateTo: "2026-10-01" })).toMatch(/posterior/);
    expect(rangeError({ dateFrom: "2026-10-12", dateTo: "2026-10-12" })).toBeNull();
    expect(rangeError({ dateFrom: "2026-10-12" })).toBeNull();
  });
});

describe("consulta a la API", () => {
  it("siempre incluye tz=America/Bogota", () => {
    expect(toClassificationsQuery({ page: 1, pageSize: 20 })).toMatchObject({
      page: 1,
      page_size: 20,
      tz: "America/Bogota",
    });
  });
});

describe("paginación", () => {
  it("calcula el número de páginas", () => {
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(20, 20)).toBe(1);
    expect(pageCount(21, 20)).toBe(2);
    expect(pageCount(101, 50)).toBe(3);
  });
});
