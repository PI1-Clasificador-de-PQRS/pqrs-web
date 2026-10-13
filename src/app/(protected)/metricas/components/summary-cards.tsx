import { CategoryBadge } from "@/components/category-badge";
import { TextLink } from "@/components/text-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { engineShares, topCategories, type MetricsSummary } from "@/lib/metrics/summary";
import { formatNumber, formatPercent } from "@/lib/time/format";

export function SummaryCards({
  summary,
  historyLink,
}: {
  summary: MetricsSummary;
  /** Historial con las mismas fechas: su total debe coincidir con esta tarjeta. */
  historyLink: string;
}) {
  const top = topCategories(summary.by_category, summary.total);
  const shares = engineShares(summary.by_model, summary.total);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-sm font-medium text-muted-foreground">Total clasificado</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-3xl font-semibold tabular-nums" data-testid="metrics-total">
            {formatNumber(summary.total)}
          </p>
          <TextLink href={historyLink} className="text-sm">
            Ver en el historial
          </TextLink>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-sm font-medium text-muted-foreground">
              {top.length > 1 ? "Categorías más frecuentes (empate)" : "Categoría más frecuente"}
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent data-testid="metrics-top-category">
          {top.length === 0 ? (
            <p className="text-3xl font-semibold">—</p>
          ) : (
            <ul className="flex flex-col gap-1 text-lg font-semibold">
              {top.map((category) => (
                <li key={category}>
                  <CategoryBadge category={category} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-sm font-medium text-muted-foreground">Por motor</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
            {shares.map((share) => (
              <div key={share.engine} className="contents">
                <dt>{share.label}</dt>
                <dd className="text-right font-semibold tabular-nums">
                  {share.ratio === null ? "—" : formatPercent(share.ratio)}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
