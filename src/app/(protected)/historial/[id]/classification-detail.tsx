"use client";

import { CategoryBadge } from "@/components/category-badge";
import { TextLink } from "@/components/text-link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { historyHref } from "@/lib/history/filters";
import { useClassification } from "@/lib/history/use-classifications";
import { ENGINE_LABELS, SOURCE_LABELS } from "@/lib/pqrs/labels";
import { formatDateTime } from "@/lib/time/format";

export const NOT_FOUND_MESSAGE = "No encontramos esta clasificación.";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

function Empty() {
  return <span className="text-muted-foreground">—</span>;
}

export function ClassificationDetail({ id }: { id: string }) {
  const query = useClassification(id);
  const item = query.data;

  return (
    <section className="flex flex-col gap-6">
      <TextLink href="/historial" className="self-start text-sm">
        ← Volver al historial
      </TextLink>
      <h1 className="text-2xl font-semibold">Detalle de la clasificación</h1>

      <div aria-live="polite">
        {query.isPending ? (
          <div className="flex flex-col gap-3" role="status" aria-label="Cargando la clasificación">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        ) : query.isError ? (
          query.error instanceof ApiError && query.error.code === "not_found" ? (
            <div className="rounded-lg border p-6 text-center">
              <p className="font-medium">{NOT_FOUND_MESSAGE}</p>
              <p className="mt-1 text-muted-foreground">
                Puede que el enlace esté mal o que pertenezca a otra organización.
              </p>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-col items-start gap-2">
                <span>{errorMessage(query.error)}</span>
                <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          )
        ) : item ? (
          <div className="flex flex-col gap-6">
            <section aria-labelledby="texto-anonimizado">
              <h2 id="texto-anonimizado" className="text-sm text-muted-foreground">
                Texto anonimizado
              </h2>
              <p className="mt-1 rounded-lg border bg-muted/40 p-4 whitespace-pre-wrap">
                {item.text_anonymized}
              </p>
            </section>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
              <Field label="Fecha y hora">{formatDateTime(item.created_at)}</Field>
              <Field label="Categoría">
                <CategoryBadge category={item.category} />
              </Field>
              <Field label="Motor">{ENGINE_LABELS[item.model]}</Field>
              <Field label="Versión del modelo">
                <span className="font-mono text-sm">{item.model_version}</span>
              </Field>
              <Field label="Origen">{SOURCE_LABELS[item.source]}</Field>
              <Field label="Referencia externa">{item.external_ref ?? <Empty />}</Field>
              <Field label="Lote">
                {item.batch_id ? (
                  <span className="flex flex-col gap-1">
                    <span className="font-mono text-sm">{item.batch_id}</span>
                    <TextLink href={historyHref({ batchId: item.batch_id })} className="text-sm">
                      Ver todas las clasificaciones de este lote
                    </TextLink>
                  </span>
                ) : (
                  <Empty />
                )}
              </Field>
              <Field label="Identificador">
                <span className="font-mono text-sm">{item.id}</span>
              </Field>
            </dl>
          </div>
        ) : null}
      </div>
    </section>
  );
}
