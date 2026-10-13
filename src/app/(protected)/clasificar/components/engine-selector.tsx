"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Engine, ModelInfo } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { findModel, formatF1, unavailableReasonText } from "@/lib/models/use-models";

export const ENGINE_SELECTOR_ID = "selector-motor";

/** Lleva el foco al selector (por ejemplo, tras un 503, para elegir otro motor). */
export function focusEngineSelector() {
  const target =
    document.querySelector<HTMLElement>(`#${ENGINE_SELECTOR_ID} [role="radio"]:not([disabled])`) ??
    document.getElementById(ENGINE_SELECTOR_ID);
  target?.scrollIntoView({ block: "center" });
  target?.focus();
}

export function EngineSelector({
  query,
  value,
  onChange,
  locked = false,
}: {
  query: UseQueryResult<ModelInfo[]>;
  value: Engine | null;
  onChange: (engine: Engine) => void;
  /** Mientras un lote está en curso el motor queda fijo. */
  locked?: boolean;
}) {
  const models = query.data;
  const selected = findModel(models, value);

  return (
    <section aria-labelledby="titulo-motor" className="flex flex-col gap-3">
      <h2 id="titulo-motor" className="text-lg font-semibold">
        Motor de clasificación
      </h2>
      {query.isPending && <p className="text-sm text-muted-foreground">Consultando motores…</p>}
      {query.isError && !models && (
        <Alert variant="destructive">
          <AlertDescription>
            No se pudo consultar los motores disponibles. {errorMessage(query.error)}
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-fit"
              onClick={() => void query.refetch()}
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {models && (
        <RadioGroup
          id={ENGINE_SELECTOR_ID}
          aria-labelledby="titulo-motor"
          value={value ?? ""}
          onValueChange={(next) => onChange(next as Engine)}
          disabled={locked}
          className="grid gap-3 sm:grid-cols-2"
        >
          {models.map((model) => {
            const itemId = `motor-${model.id}`;
            const detailId = `${itemId}-detalle`;
            return (
              <div
                key={model.id}
                className="flex items-start gap-3 rounded-lg border p-3 has-[[data-state=checked]]:border-primary"
              >
                <RadioGroupItem
                  id={itemId}
                  value={model.id}
                  disabled={locked || !model.available}
                  aria-describedby={detailId}
                  className="mt-1"
                />
                <div className="flex flex-col gap-1">
                  <Label htmlFor={itemId}>{model.label}</Label>
                  <p id={detailId} className="text-sm text-muted-foreground">
                    F1-macro de evaluación: {formatF1(model.evaluation.f1_macro)}
                    {!model.available && (
                      <>
                        {" · "}
                        <span className="font-medium text-destructive">
                          {unavailableReasonText(model)}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </RadioGroup>
      )}
      {models && value === null && (
        <p className="text-sm text-muted-foreground">
          Ningún motor está disponible en este momento. La lista se actualiza cada minuto.
        </p>
      )}
      {selected && !selected.available && (
        <p role="status" className="text-sm text-destructive">
          El motor seleccionado no está disponible ({unavailableReasonText(selected)}). Espera o
          elige otro motor.
        </p>
      )}
      {locked && (
        <p className="text-sm text-muted-foreground">
          El motor queda fijo mientras el lote está en curso.
        </p>
      )}
    </section>
  );
}
