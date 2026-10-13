"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { pageCount, PAGE_SIZES, type PageSize } from "@/lib/history/filters";
import { formatNumber } from "@/lib/time/format";

export function Pagination({
  page,
  pageSize,
  total,
  busy,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: PageSize;
  total: number;
  busy: boolean;
  onPage: (page: number) => void;
  onPageSize: (pageSize: PageSize) => void;
}) {
  const id = useId();
  const pages = pageCount(total, pageSize);

  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="font-normal">
          Por página
        </Label>
        <NativeSelect
          id={id}
          className="w-20"
          value={pageSize}
          onChange={(event) => onPageSize(Number(event.target.value) as PageSize)}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => onPage(page - 1)} disabled={page <= 1 || busy}>
          Anterior
        </Button>
        <span className="text-sm" aria-live="polite">
          Página {formatNumber(page)} de {formatNumber(pages)}
        </span>
        <Button variant="outline" onClick={() => onPage(page + 1)} disabled={page >= pages || busy}>
          Siguiente
        </Button>
      </div>
    </nav>
  );
}
