"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TextLink } from "@/components/text-link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/errors";
import { historyHref } from "@/lib/history/filters";
import {
  customRangeError,
  effectiveGranularity,
  MAX_DAY_PERIODS,
  parseMetricsSearch,
  resolveRange,
  toMetricsSearch,
  type MetricsSearch,
} from "@/lib/metrics/period";
import {
  categoryRows,
  engineRows,
  sourceRows,
  timeseriesRows,
  type ChartRow,
} from "@/lib/metrics/summary";
import { useMetricsSummary } from "@/lib/metrics/use-metrics-summary";
import { formatNumber, formatPlainDate } from "@/lib/time/format";
import { todayInAppZone } from "@/lib/time/zone";
import { ChartCard } from "./chart-card";
import { ColumnChart, HorizontalBarChart, TimeseriesChart } from "./charts";
import { EvaluationCard } from "./evaluation-card";
import { PeriodSelector } from "./period-selector";
import { SummaryCards } from "./summary-cards";

function timeseriesSummary(rows: readonly ChartRow[]): string {
  if (rows.length === 0) return "Sin datos.";
  const max = rows.reduce((best, row) => (row.value > best.value ? row : best));
  return `${formatNumber(rows.length)} períodos, de ${rows[0]!.label} a ${rows.at(-1)!.label}. El máximo fue ${formatNumber(max.value)} (${max.label}).`;
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Cargando las métricas">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

export function MetricsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = parseMetricsSearch(searchParams);
  const rangeProblem = customRangeError(search);
  const range = resolveRange(search, todayInAppZone());
  const choice = effectiveGranularity(range, search.granularity);
  const query = useMetricsSummary(range, choice.granularity, rangeProblem === null);
  const summary = query.data;

  function navigate(next: MetricsSearch) {
    router.push(`${pathname}${toMetricsSearch(next)}`);
  }

  const periodText =
    range.dateFrom && range.dateTo
      ? `Del ${formatPlainDate(range.dateFrom)} al ${formatPlainDate(range.dateTo)}`
      : "Todo el historial";

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Métricas</h1>
        <p className="mt-1 text-muted-foreground">{periodText}</p>
      </div>

      <PeriodSelector
        key={searchParams.toString()}
        search={search}
        granularityLocked={search.preset === "all"}
        onChange={navigate}
      />

      {choice.forcedReason === "long_range" && (
        <Alert>
          <AlertDescription>
            El rango supera {formatNumber(MAX_DAY_PERIODS)} días, así que se agrupa por semana.
          </AlertDescription>
        </Alert>
      )}
      {choice.forcedReason === "all_history" && (
        <p className="text-sm text-muted-foreground">
          Con todo el historial, la serie se agrupa por semana.
        </p>
      )}

      <div aria-live="polite" className="flex flex-col gap-6">
        {rangeProblem ? (
          <Alert>
            <AlertDescription>{rangeProblem}</AlertDescription>
          </Alert>
        ) : query.isPending ? (
          <LoadingSkeleton />
        ) : query.isError && !summary ? (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-col items-start gap-2">
              <span>{errorMessage(query.error)}</span>
              <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        ) : summary ? (
          <div
            className={
              query.isPlaceholderData ? "flex flex-col gap-6 opacity-60" : "flex flex-col gap-6"
            }
            aria-busy={query.isPlaceholderData}
          >
            {query.isError && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage(query.error)}</AlertDescription>
              </Alert>
            )}
            <SummaryCards
              summary={summary}
              historyLink={historyHref({ dateFrom: range.dateFrom, dateTo: range.dateTo })}
            />
            {summary.total === 0 ? (
              <div className="rounded-lg border p-6 text-center">
                <p className="font-medium">No hay clasificaciones en este período.</p>
                <p className="mt-1 text-muted-foreground">
                  <TextLink href="/clasificar">Clasifica un texto o un lote</TextLink> o elige otro
                  período.
                </p>
              </div>
            ) : (
              <MetricsCharts summary={summary} granularity={choice.granularity} />
            )}
            <EvaluationCard evaluation={summary.evaluation} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MetricsCharts({
  summary,
  granularity,
}: {
  summary: NonNullable<ReturnType<typeof useMetricsSummary>["data"]>;
  granularity: "day" | "week";
}) {
  const categories = categoryRows(summary.by_category);
  const series = timeseriesRows(summary.timeseries, granularity);
  const engines = engineRows(summary.by_model);
  const sources = sourceRows(summary.by_source);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Clasificaciones por categoría" rows={categories} labelHeader="Categoría">
        <ColumnChart rows={categories} />
      </ChartCard>
      <ChartCard
        title={granularity === "week" ? "Clasificaciones por semana" : "Clasificaciones por día"}
        rows={series}
        labelHeader={granularity === "week" ? "Semana" : "Día"}
        summary={timeseriesSummary(series)}
      >
        <TimeseriesChart rows={series} />
      </ChartCard>
      <ChartCard title="Clasificaciones por motor" rows={engines} labelHeader="Motor">
        <HorizontalBarChart rows={engines} />
      </ChartCard>
      <ChartCard title="Clasificaciones por origen" rows={sources} labelHeader="Origen">
        <HorizontalBarChart rows={sources} />
      </ChartCard>
    </div>
  );
}
