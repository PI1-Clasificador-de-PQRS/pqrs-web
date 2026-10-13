import { CategoryHelp } from "@/app/(protected)/clasificar/components/category-help";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MetricsSummary } from "@/lib/metrics/summary";
import { ENGINE_LABELS, ENGINES } from "@/lib/pqrs/labels";

const f1Format = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatF1OrUnavailable(value: number | null | undefined): string {
  return value == null ? "No disponible" : f1Format.format(value);
}

export function EvaluationCard({ evaluation }: { evaluation: MetricsSummary["evaluation"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base">Evaluación de los motores</h2>
        </CardTitle>
        <CardDescription>
          Evaluado sobre 66 solicitudes reales etiquetadas a mano (partición de prueba del
          proyecto).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          {ENGINES.map((engine) => (
            <div key={engine} className="rounded-lg border p-3">
              <dt className="text-sm text-muted-foreground">{ENGINE_LABELS[engine]} · F1-macro</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {formatF1OrUnavailable(evaluation[engine].f1_macro)}
              </dd>
            </div>
          ))}
        </dl>
        <CategoryHelp />
      </CardContent>
    </Card>
  );
}
