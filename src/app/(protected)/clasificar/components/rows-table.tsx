"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ModelInfo } from "@/lib/api/client";
import { messageForCode } from "@/lib/api/errors";
import type { BatchRow } from "@/lib/batch/batch-machine";
import { ROW_PROBLEM_MESSAGES } from "@/lib/batch/csv-parse";
import { findModel } from "@/lib/models/use-models";

export const PAGE_SIZE = 25;

function StatusCell({ row, started }: { row: BatchRow; started: boolean }) {
  switch (row.status) {
    case "invalid":
      return (
        <span className="text-destructive">
          Inválida: {row.problem ? ROW_PROBLEM_MESSAGES[row.problem] : "fila no válida"}
        </span>
      );
    case "pending":
      return (
        <span className="text-muted-foreground">{started ? "Pendiente" : "Lista para enviar"}</span>
      );
    case "classified":
      return <span className="font-medium">{row.category}</span>;
    case "item_error":
      return (
        <span className="text-destructive">
          Error: {row.error ? messageForCode(row.error.code, row.error.message) : "sin detalle"}
        </span>
      );
  }
}

/** Tabla paginada en el cliente: vista previa antes de enviar y resultados después. */
export function RowsTable({
  rows,
  started,
  models,
  caption,
}: {
  rows: readonly BatchRow[];
  started: boolean;
  models: readonly ModelInfo[] | undefined;
  caption: string;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-2">
      <Table>
        <caption className="sr-only">{caption}</caption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Fila</TableHead>
            <TableHead className="w-32">Referencia</TableHead>
            <TableHead>Texto</TableHead>
            <TableHead className="w-56">{started ? "Resultado" : "Estado"}</TableHead>
            {started && <TableHead className="w-32">Motor</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((row) => (
            <TableRow key={row.index}>
              <TableCell>{row.rowNumber}</TableCell>
              <TableCell className="max-w-32 truncate" title={row.ref ?? undefined}>
                {row.ref ?? "—"}
              </TableCell>
              <TableCell className="max-w-md">
                <span className="line-clamp-2 whitespace-normal break-words">
                  {row.text || <em className="text-muted-foreground">(vacío)</em>}
                </span>
              </TableCell>
              <TableCell className="whitespace-normal">
                <StatusCell row={row} started={started} />
              </TableCell>
              {started && (
                <TableCell className="whitespace-normal">
                  {row.model ? (findModel(models, row.model)?.label ?? row.model) : "—"}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {pages > 1 && (
        <nav aria-label="Páginas de la tabla" className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {current + 1} de {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(current + 1)}
            disabled={current >= pages - 1}
          >
            Siguiente
          </Button>
        </nav>
      )}
    </div>
  );
}
