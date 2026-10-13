"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TextLink } from "@/components/text-link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/errors";
import {
  hasFilters,
  parseHistorySearch,
  rangeError,
  toHistorySearch,
  type HistoryFilters as Filters,
  type HistoryState,
} from "@/lib/history/filters";
import { useClassifications } from "@/lib/history/use-classifications";
import { formatNumber } from "@/lib/time/format";
import { HistoryFilters } from "./history-filters";
import { HistoryTable } from "./history-table";
import { Pagination } from "./pagination";

function resultsLabel(total: number) {
  return total === 1 ? "1 resultado" : `${formatNumber(total)} resultados`;
}

export function HistoryView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = parseHistorySearch(searchParams);
  const filtersActive = hasFilters(state);
  const invalidRange = rangeError(state);
  const query = useClassifications(state);

  // `push` (no `replace`): cada búsqueda queda en el historial del navegador.
  function navigate(next: Partial<HistoryState>) {
    router.push(`${pathname}${toHistorySearch(next)}`);
  }

  function applyFilters(filters: Filters) {
    // Solo los filtros: un filtro nuevo siempre empieza en la página 1.
    const { dateFrom, dateTo, category, model, source, batchId } = filters;
    navigate({ dateFrom, dateTo, category, model, source, batchId, pageSize: state.pageSize });
  }

  function clearFilters() {
    navigate({ pageSize: state.pageSize });
  }

  const data = query.data;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Historial</h1>
        <p className="mt-1 text-muted-foreground">
          Clasificaciones de tu organización, de la más reciente a la más antigua.
        </p>
      </div>

      <HistoryFilters
        key={searchParams.toString()}
        initial={state}
        onApply={applyFilters}
        onClear={clearFilters}
      />

      <div aria-live="polite" className="flex flex-col gap-4">
        {invalidRange ? (
          <Alert variant="destructive">
            <AlertDescription>{invalidRange}</AlertDescription>
          </Alert>
        ) : query.isPending ? (
          <div className="flex flex-col gap-2" role="status" aria-label="Cargando el historial">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : query.isError && !data ? (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-col items-start gap-2">
              <span>{errorMessage(query.error)}</span>
              <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        ) : data && data.total === 0 ? (
          filtersActive ? (
            <div className="rounded-lg border p-6 text-center">
              <p className="font-medium">Ningún resultado con estos filtros.</p>
              <Button className="mt-3" variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border p-6 text-center">
              <p className="font-medium">Aún no hay clasificaciones.</p>
              <p className="mt-1 text-muted-foreground">
                <TextLink href="/clasificar">Clasifica un texto o un lote</TextLink> y aparecerá
                aquí.
              </p>
            </div>
          )
        ) : data ? (
          <>
            <p className="text-sm font-medium">{resultsLabel(data.total)}</p>
            {query.isError && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage(query.error)}</AlertDescription>
              </Alert>
            )}
            {data.items.length === 0 ? (
              <div className="rounded-lg border p-6 text-center">
                <p className="font-medium">Esta página no tiene resultados.</p>
                <Button
                  className="mt-3"
                  variant="outline"
                  onClick={() => navigate({ ...state, page: 1 })}
                >
                  Ir a la primera página
                </Button>
              </div>
            ) : (
              <HistoryTable items={data.items} busy={query.isPlaceholderData} />
            )}
            <Pagination
              page={state.page}
              pageSize={state.pageSize}
              total={data.total}
              busy={query.isPlaceholderData}
              onPage={(page) => navigate({ ...state, page })}
              onPageSize={(pageSize) => navigate({ ...state, pageSize, page: 1 })}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}
