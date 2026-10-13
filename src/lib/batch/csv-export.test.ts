import Papa from "papaparse";
import type { BatchRow } from "@/lib/batch/batch-machine";
import { buildResultsCsv, EXPORT_COLUMNS, neutralizeFormula } from "@/lib/batch/csv-export";

const base = { problem: null, ref: null } as const;

const rows: BatchRow[] = [
  {
    ...base,
    index: 0,
    rowNumber: 2,
    text: "Solicito copia; urgente",
    ref: "R-1",
    status: "classified",
    category: "Petición",
    model: "classifier",
  },
  {
    ...base,
    index: 1,
    rowNumber: 3,
    text: '=HYPERLINK("http://x")',
    status: "item_error",
    error: { code: "invalid_text", message: "x" },
  },
  {
    ...base,
    index: 2,
    rowNumber: 4,
    text: "",
    ref: "+57 300",
    status: "invalid",
    problem: "empty_text",
  },
  { ...base, index: 3, rowNumber: 5, text: "-2+3", ref: "@ref", status: "pending" },
  { ...base, index: 4, rowNumber: 6, text: "\tTab", status: "pending" },
];

describe("buildResultsCsv", () => {
  const csv = buildResultsCsv(rows);

  it("empieza por BOM y usa ; y CRLF", () => {
    expect(csv.startsWith("﻿referencia;texto;categoria;motor;estado;error\r\n")).toBe(true);
  });

  it("tiene las columnas pedidas y una fila por cada fila del archivo", () => {
    const parsed = Papa.parse<string[]>(csv.slice(1), { delimiter: ";", skipEmptyLines: true });
    expect(parsed.data[0]).toEqual([...EXPORT_COLUMNS]);
    expect(parsed.data.slice(1)).toEqual([
      ["R-1", "Solicito copia; urgente", "Petición", "classifier", "clasificada", ""],
      [
        "",
        '\'=HYPERLINK("http://x")',
        "",
        "",
        "error",
        "El texto está vacío o supera los 5.000 caracteres.",
      ],
      ["'+57 300", "", "", "", "inválida", "Texto vacío"],
      ["'@ref", "'-2+3", "", "", "pendiente", ""],
      ["", "'\tTab", "", "", "pendiente", ""],
    ]);
  });
});

describe("neutralizeFormula", () => {
  it.each(["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx"])("antepone ' a %j", (value) => {
    expect(neutralizeFormula(value)).toBe(`'${value}`);
  });

  it("no toca el resto", () => {
    expect(neutralizeFormula("Hola = mundo")).toBe("Hola = mundo");
  });
});
