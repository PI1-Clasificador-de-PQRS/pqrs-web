"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, unwrap, type Engine, type ModelInfo } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { classifyErrorMessage } from "@/lib/classify/messages";
import { countChars, formatCount, MAX_TEXT_CHARS, textProblem } from "@/lib/classify/text-rules";
import { findModel, MODELS_QUERY_KEY } from "@/lib/models/use-models";
import { focusEngineSelector } from "./engine-selector";

export function SingleTab({
  engine,
  models,
}: {
  engine: Engine | null;
  models: readonly ModelInfo[] | undefined;
}) {
  const queryClient = useQueryClient();
  const textId = useId();
  const counterId = useId();
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);

  const mutation = useMutation({
    mutationFn: (vars: { text: string; model: Engine }) =>
      // Siempre con `model` explícito: la API nunca elige ni cambia de motor por nosotros.
      unwrap(api.POST("/classify", { body: { text: vars.text, model: vars.model } })),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 503) {
        void queryClient.invalidateQueries({ queryKey: MODELS_QUERY_KEY });
      }
    },
  });

  const length = countChars(text.trim());
  const problem = textProblem(text);
  const selected = findModel(models, engine);
  const engineReady = Boolean(selected?.available);
  const canSubmit = !problem && engineReady && !mutation.isPending && engine !== null;

  function submit() {
    setTouched(true);
    if (!canSubmit || engine === null) return;
    mutation.mutate({ text: text.trim(), model: engine });
  }

  const lastError = mutation.error;
  const engineFailed = lastError instanceof ApiError && lastError.status === 503;
  const result = mutation.data;
  const resultModel = result ? findModel(models, result.model) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Label htmlFor={textId}>Texto de la PQRS</Label>
        <Textarea
          id={textId}
          rows={8}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => setTouched(true)}
          aria-describedby={counterId}
          aria-invalid={touched && problem !== null}
          placeholder="Pega aquí el texto que escribió el ciudadano."
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p
            id={counterId}
            className={length > MAX_TEXT_CHARS ? "text-destructive" : "text-muted-foreground"}
          >
            {formatCount(length)} / {formatCount(MAX_TEXT_CHARS)} caracteres
            {touched && problem === "empty" && " · Escribe el texto antes de clasificar."}
            {problem === "too_long" && " · El texto supera el máximo permitido."}
          </p>
          <Button type="submit" disabled={!canSubmit}>
            {mutation.isPending ? "Clasificando…" : "Clasificar"}
          </Button>
        </div>
        {!engineReady && (
          <p className="text-sm text-muted-foreground">
            Elige un motor disponible para poder clasificar.
          </p>
        )}
      </form>

      <div aria-live="polite" className="flex flex-col gap-3">
        {mutation.isError && (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-col gap-2">
              <span>{classifyErrorMessage(lastError)}</span>
              {engineFailed && (
                <span className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={submit} disabled={!canSubmit}>
                    Reintentar
                  </Button>
                  <Button size="sm" variant="outline" onClick={focusEngineSelector}>
                    Elegir otro motor
                  </Button>
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}
        {result && !mutation.isError && (
          <section aria-label="Resultado" className="rounded-lg border p-4">
            <dl className="grid gap-2 sm:grid-cols-[max-content_1fr] sm:gap-x-6">
              <dt className="text-sm text-muted-foreground">Categoría</dt>
              <dd className="text-lg font-semibold">{result.category}</dd>
              <dt className="text-sm text-muted-foreground">Motor usado</dt>
              <dd>{resultModel?.label ?? result.model}</dd>
            </dl>
            <Link
              href="/historial"
              className="mt-3 inline-block text-sm underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Ver en el historial
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
