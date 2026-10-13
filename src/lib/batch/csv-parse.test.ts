import { MAX_ROWS, normalizeHeader, parseCsvFile, parseCsvText } from "@/lib/batch/csv-parse";

function rowsOf(content: string) {
  const result = parseCsvText(content);
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("parseCsvText", () => {
  it("lee un archivo separado por comas", () => {
    const result = rowsOf('texto,referencia\n"Hola, necesito ayuda",R-1\nOtro texto,R-2\n');
    expect(result.delimiter).toBe(",");
    expect(result.rows.map((row) => [row.text, row.ref, row.rowNumber])).toEqual([
      ["Hola, necesito ayuda", "R-1", 2],
      ["Otro texto", "R-2", 3],
    ]);
  });

  it("detecta el separador ; de Excel en español aunque los textos tengan comas", () => {
    const result = rowsOf(
      "referencia;texto\r\nR-1;Solicito, por favor, una copia\r\nR-2;Queja por el servicio, otra vez\r\n",
    );
    expect(result.delimiter).toBe(";");
    expect(result.rows.map((row) => row.text)).toEqual([
      "Solicito, por favor, una copia",
      "Queja por el servicio, otra vez",
    ]);
  });

  it("ignora el BOM y acepta encabezados con mayúsculas, espacios o tildes", () => {
    const result = rowsOf("﻿ TEXTO ;Referéncia\nUno;A\n");
    expect(result.rows[0]).toMatchObject({ text: "Uno", ref: "A", problem: null });
    expect(normalizeHeader("﻿Téxto ")).toBe("texto");
  });

  it("la columna referencia es opcional", () => {
    expect(rowsOf("texto\nSolo texto\n").rows[0]).toMatchObject({ text: "Solo texto", ref: null });
  });

  it("rechaza un archivo sin la columna texto", () => {
    const result = parseCsvText("descripcion;referencia\nAlgo;R-1\n");
    expect(result).toEqual({ ok: false, error: expect.stringContaining("columna «texto»") });
  });

  it("rechaza más de 500 filas y acepta exactamente 500", () => {
    const make = (n: number) =>
      `texto\n${Array.from({ length: n }, (_, i) => `fila ${i}`).join("\n")}\n`;
    expect(parseCsvText(make(MAX_ROWS)).ok).toBe(true);
    const result = parseCsvText(make(MAX_ROWS + 1));
    expect(result).toEqual({ ok: false, error: expect.stringContaining("501 filas") });
  });

  it("rechaza un archivo sin filas de datos", () => {
    expect(parseCsvText("texto;referencia\n\n").ok).toBe(false);
  });

  it("salta líneas totalmente vacías y marca como inválidas las filas con texto vacío", () => {
    const result = rowsOf("texto;referencia\nUno;A\n\n;;\n   ;B\nDos;C\n");
    expect(result.rows.map((row) => [row.text, row.ref, row.problem])).toEqual([
      ["Uno", "A", null],
      ["", "B", "empty_text"],
      ["Dos", "C", null],
    ]);
  });

  it("marca textos de más de 5.000 caracteres (contados en code points)", () => {
    const ok = "ñ".repeat(5000);
    const emojis = "😀".repeat(5000); // 5.000 code points, 10.000 unidades UTF-16
    const result = rowsOf(`texto\n${ok}\n${"a".repeat(5001)}\n${emojis}\n  ${ok}  \n`);
    expect(result.rows.map((row) => row.problem)).toEqual([null, "text_too_long", null, null]);
  });

  it("marca referencias de más de 100 caracteres", () => {
    const result = rowsOf(`texto;referencia\nUno;${"r".repeat(100)}\nDos;${"r".repeat(101)}\n`);
    expect(result.rows.map((row) => row.problem)).toEqual([null, "ref_too_long"]);
  });
});

describe("parseCsvFile", () => {
  it("lee UTF-8 con BOM", async () => {
    const bytes = new TextEncoder().encode("﻿texto;referencia\nPetición de información;Á-1\n");
    const result = await parseCsvFile(new Blob([bytes]));
    expect(result).toMatchObject({
      ok: true,
      rows: [{ text: "Petición de información", ref: "Á-1" }],
    });
  });

  it("rechaza un archivo que no es UTF-8 (por ejemplo, Windows-1252)", async () => {
    const latin1 = new Uint8Array([
      0x74, 0x65, 0x78, 0x74, 0x6f, 0x0a, 0x50, 0x65, 0x74, 0x69, 0x63, 0x69, 0xf3, 0x6e,
    ]);
    const result = await parseCsvFile(new Blob([latin1]));
    expect(result).toEqual({ ok: false, error: expect.stringContaining("UTF-8") });
  });
});
