import Papa from "papaparse";
import { refTooLong, textProblem } from "@/lib/classify/text-rules";

export const MAX_ROWS = 500;

export type RowProblem = "empty_text" | "text_too_long" | "ref_too_long";

export type CsvRow = {
  /** Posición entre las filas de datos (desde 0). */
  index: number;
  /** Número de línea lógica en el archivo (el encabezado es la 1). */
  rowNumber: number;
  text: string;
  ref: string | null;
  problem: RowProblem | null;
};

export type CsvParseResult =
  { ok: true; rows: CsvRow[]; delimiter: string } | { ok: false; error: string };

const TEXT_COLUMN = "texto";
const REF_COLUMN = "referencia";

/** Encabezado sin BOM, espacios, mayúsculas ni tildes: «Referéncia » → «referencia». */
export function normalizeHeader(header: string): string {
  return header
    .replace(/^﻿/, "")
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function rowProblem(text: string, ref: string | null): RowProblem | null {
  const problem = textProblem(text);
  if (problem === "empty") return "empty_text";
  if (problem === "too_long") return "text_too_long";
  if (ref !== null && refTooLong(ref)) return "ref_too_long";
  return null;
}

/** Lee un CSV ya decodificado. Detecta el separador `,` o `;` (Excel en español usa `;`). */
export function parseCsvText(content: string): CsvParseResult {
  const parsed = Papa.parse<Record<string, string | undefined>>(content.replace(/^﻿/, ""), {
    header: true,
    delimitersToGuess: [",", ";"],
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });

  const unclosedQuote = parsed.errors.find((error) => error.code === "MissingQuotes");
  if (unclosedQuote) {
    const line =
      unclosedQuote.row !== undefined ? ` (cerca de la fila ${unclosedQuote.row + 2})` : "";
    return {
      ok: false,
      error: `El archivo tiene comillas sin cerrar${line}. Revísalo y vuelve a cargarlo.`,
    };
  }

  const fields = parsed.meta.fields ?? [];
  if (!fields.includes(TEXT_COLUMN)) {
    return {
      ok: false,
      error:
        "El archivo no tiene la columna «texto». La primera fila debe ser el encabezado, con una columna «texto» y, si quieres, otra «referencia».",
    };
  }
  if (parsed.data.length === 0) {
    return { ok: false, error: "El archivo no tiene filas para clasificar." };
  }
  if (parsed.data.length > MAX_ROWS) {
    return {
      ok: false,
      error: `El archivo tiene ${parsed.data.length} filas y el máximo es ${MAX_ROWS}. Divídelo en varios archivos.`,
    };
  }

  const rows = parsed.data.map((record, index): CsvRow => {
    const text = (record[TEXT_COLUMN] ?? "").trim();
    const rawRef = (record[REF_COLUMN] ?? "").trim();
    const ref = rawRef === "" ? null : rawRef;
    return { index, rowNumber: index + 2, text, ref, problem: rowProblem(text, ref) };
  });
  return { ok: true, rows, delimiter: parsed.meta.delimiter };
}

/** Lee el archivo como UTF-8 estricto (con o sin BOM). */
export async function parseCsvFile(file: Blob): Promise<CsvParseResult> {
  let content: string;
  try {
    content = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    return {
      ok: false,
      error:
        "El archivo no está en UTF-8. En Excel, usa «Guardar como» y elige «CSV UTF-8 (delimitado por comas)».",
    };
  }
  return parseCsvText(content);
}

export const ROW_PROBLEM_MESSAGES: Record<RowProblem, string> = {
  empty_text: "Texto vacío",
  text_too_long: "El texto supera los 5.000 caracteres",
  ref_too_long: "La referencia supera los 100 caracteres",
};
