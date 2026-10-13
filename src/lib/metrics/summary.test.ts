import { categoryRows, engineShares, timeseriesRows, topCategories } from "@/lib/metrics/summary";

const zero = { Petición: 0, Reclamo: 0, Denuncia: 0, "Solicitud de información": 0 };

describe("categoría más frecuente", () => {
  it("devuelve la de mayor valor", () => {
    expect(topCategories({ ...zero, Reclamo: 5, Petición: 2 }, 7)).toEqual(["Reclamo"]);
  });

  it("con empate devuelve todas, en orden canónico", () => {
    expect(
      topCategories({ ...zero, "Solicitud de información": 3, Petición: 3, Denuncia: 1 }, 7),
    ).toEqual(["Petición", "Solicitud de información"]);
  });

  it("con total 0 no hay ninguna", () => {
    expect(topCategories(zero, 0)).toEqual([]);
  });
});

describe("porcentaje por motor", () => {
  it("divide by_model entre total", () => {
    expect(engineShares({ llm: 1, classifier: 3 }, 4)).toEqual([
      { engine: "llm", label: "LLM", count: 1, ratio: 0.25 },
      { engine: "classifier", label: "Clasificador local", count: 3, ratio: 0.75 },
    ]);
  });

  it("con total 0 no hay porcentaje", () => {
    expect(engineShares({ llm: 0, classifier: 0 }, 0).map((share) => share.ratio)).toEqual([
      null,
      null,
    ]);
  });
});

describe("filas de los gráficos", () => {
  it("categorías en orden canónico, con su color fijo", () => {
    const rows = categoryRows({
      Reclamo: 2,
      Denuncia: 1,
      "Solicitud de información": 0,
      Petición: 4,
    });
    expect(rows.map((row) => [row.label, row.value])).toEqual([
      ["Petición", 4],
      ["Reclamo", 2],
      ["Denuncia", 1],
      ["Solicitud de información", 0],
    ]);
    expect(new Set(rows.map((row) => row.color)).size).toBe(4);
  });

  it("formatea los períodos en es-CO sin desplazar el día", () => {
    const [day] = timeseriesRows([{ period: "2026-10-12", count: 3 }], "day");
    expect(day).toMatchObject({ key: "2026-10-12", value: 3 });
    expect(day!.label).toMatch(/^12 de oct\.? de 2026$/);
    const [week] = timeseriesRows([{ period: "2026-10-12", count: 3 }], "week");
    expect(week!.label).toMatch(/^Semana del 12 de oct/);
  });
});
