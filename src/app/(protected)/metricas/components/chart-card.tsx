"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ChartRow } from "@/lib/metrics/summary";
import { formatNumber } from "@/lib/time/format";

/** Resumen en texto del gráfico para lectores de pantalla: «Petición: 12; Reclamo: 3…». */
export function chartSummary(rows: readonly ChartRow[]): string {
  if (rows.length === 0) return "Sin datos.";
  return `${rows.map((row) => `${row.label}: ${formatNumber(row.value)}`).join("; ")}.`;
}

/**
 * Marco común de los gráficos: título, resumen para lectores de pantalla y el botón «Ver como
 * tabla», que muestra exactamente las mismas filas que el gráfico.
 */
export function ChartCard({
  title,
  rows,
  labelHeader,
  valueHeader = "Clasificaciones",
  summary,
  children,
}: {
  title: string;
  rows: readonly ChartRow[];
  labelHeader: string;
  valueHeader?: string;
  /** Resumen en texto; por defecto, la lista de valores. */
  summary?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const [asTable, setAsTable] = useState(false);

  return (
    <Card role="figure" aria-labelledby={`${id}-title`} aria-describedby={`${id}-summary`}>
      <CardHeader>
        <CardTitle>
          <h2 id={`${id}-title`} className="text-base">
            {title}
          </h2>
        </CardTitle>
        <CardAction>
          <Button
            size="sm"
            variant="outline"
            aria-pressed={asTable}
            onClick={() => setAsTable((value) => !value)}
          >
            {asTable ? "Ver como gráfico" : "Ver como tabla"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p id={`${id}-summary`} className="sr-only">
          {summary ?? chartSummary(rows)}
        </p>
        {asTable ? (
          <Table>
            <TableCaption className="sr-only">{title}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{labelHeader}</TableHead>
                <TableHead className="text-right">{valueHeader}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(row.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div aria-hidden="true">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}
