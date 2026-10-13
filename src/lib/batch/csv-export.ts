import Papa from "papaparse";
import { messageForCode } from "@/lib/api/errors";
import type { BatchRow } from "@/lib/batch/batch-machine";
import { ROW_PROBLEM_MESSAGES } from "@/lib/batch/csv-parse";

export const EXPORT_COLUMNS = [
  "referencia",
  "texto",
  "categoria",
  "motor",
  "estado",
  "error",
] as const;

const STATUS_LABELS: Record<BatchRow["status"], string> = {
  pending: "pendiente",
  classified: "clasificada",
  item_error: "error",
  invalid: "inválida",
};

/**
 * Evita la inyección de fórmulas: una celda que empieza por `=`, `+`, `-`, `@`, tabulador o
 * retorno de carro se antepone con `'` para que Excel la trate como texto.
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function rowError(row: BatchRow): string {
  if (row.status === "invalid" && row.problem) return ROW_PROBLEM_MESSAGES[row.problem];
  if (row.status === "item_error" && row.error) {
    return messageForCode(row.error.code, row.error.message);
  }
  return "";
}

/** CSV de resultados en UTF-8 con BOM y separador `;`, para que Excel en español lo abra bien. */
export function buildResultsCsv(rows: readonly BatchRow[]): string {
  const data = rows.map((row) =>
    [
      row.ref ?? "",
      row.text,
      row.category ?? "",
      row.model ?? "",
      STATUS_LABELS[row.status],
      rowError(row),
    ].map(neutralizeFormula),
  );
  const csv = Papa.unparse(
    { fields: [...EXPORT_COLUMNS], data },
    { delimiter: ";", newline: "\r\n", header: true },
  );
  return `﻿${csv}\r\n`;
}

/** Descarga en el navegador sin enviar el contenido a ningún sitio. */
export function downloadCsv(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
