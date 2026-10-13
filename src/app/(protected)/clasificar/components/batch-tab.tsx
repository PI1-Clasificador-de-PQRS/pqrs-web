"use client";

import { useId, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { Engine, ModelInfo } from "@/lib/api/client";
import { formatSeconds, messageForCode } from "@/lib/api/errors";
import {
  batchProgress,
  isBatchActive,
  MAX_RATE_LIMIT_RETRIES,
  type BatchRunner,
  type BatchState,
  type StopError,
} from "@/lib/batch/batch-machine";
import { buildResultsCsv, downloadCsv } from "@/lib/batch/csv-export";
import { MAX_ROWS, parseCsvFile } from "@/lib/batch/csv-parse";
import { formatCount } from "@/lib/classify/text-rules";
import { findModel } from "@/lib/models/use-models";
import { focusEngineSelector } from "./engine-selector";
import { RowsTable } from "./rows-table";

function stopMessage(error: StopError): string {
  const base = messageForCode(error.code, error.message);
  if (error.status === 429) {
    return `${base} Se reintentó ${MAX_RATE_LIMIT_RETRIES} veces sin éxito.`;
  }
  if (error.status === 503 && error.retryAfter !== undefined) {
    return `${base} Puedes reintentar en ${formatSeconds(error.retryAfter)}.`;
  }
  return base;
}

function engineName(models: readonly ModelInfo[] | undefined, engine: Engine | null) {
  return findModel(models, engine)?.label ?? engine ?? "";
}

export function BatchTab({
  engine,
  models,
  state,
  runner,
}: {
  engine: Engine | null;
  models: readonly ModelInfo[] | undefined;
  state: BatchState;
  runner: BatchRunner;
}) {
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const progress = batchProgress(state.rows);
  const active = isBatchActive(state.phase);
  const started = state.phase !== "idle" && state.phase !== "ready";
  const selected = findModel(models, engine);
  const engineReady = Boolean(selected?.available);
  const batchEngine = findModel(models, state.model);

  async function onFile(file: File | undefined) {
    setFileError(null);
    if (!file) return;
    setReading(true);
    const result = await parseCsvFile(file);
    setReading(false);
    if (!result.ok) {
      runner.clear();
      setFileName(null);
      setFileError(result.error);
      return;
    }
    setFileName(file.name);
    runner.load(result.rows);
  }

  function reset() {
    runner.clear();
    setFileName(null);
    setFileError(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function download() {
    const base = (fileName ?? "lote").replace(/\.csv$/i, "");
    downloadCsv(buildResultsCsv(state.rows), `${base}-resultados.csv`);
  }

  return (
    <div className="flex flex-col gap-4">
      {!started && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={inputId}>Archivo CSV</Label>
          <Input
            ref={fileInput}
            id={inputId}
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void onFile(event.target.files?.[0])}
            aria-describedby={`${inputId}-ayuda`}
          />
          <p id={`${inputId}-ayuda`} className="text-sm text-muted-foreground">
            CSV en UTF-8, separado por comas o por punto y coma, con una columna «texto» y,
            opcionalmente, otra «referencia». Máximo {MAX_ROWS} filas.
          </p>
        </div>
      )}

      <div aria-live="polite">
        {reading && <p className="text-sm text-muted-foreground">Leyendo el archivo…</p>}
        {fileError && (
          <Alert variant="destructive">
            <AlertTitle>No se pudo usar el archivo</AlertTitle>
            <AlertDescription>{fileError}</AlertDescription>
          </Alert>
        )}
      </div>

      {state.phase === "ready" && (
        <section aria-label="Vista previa" className="flex flex-col gap-3">
          <p>
            <strong>{fileName}</strong>: {formatCount(state.rows.length)} filas,{" "}
            {formatCount(progress.total)} válidas
            {progress.invalid > 0 &&
              ` y ${formatCount(progress.invalid)} inválidas (no se enviarán)`}
            .
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => engine && void runner.start(engine)}
              disabled={!engineReady || progress.total === 0}
            >
              Clasificar {formatCount(progress.total)} filas con {engineName(models, engine)}
            </Button>
            <Button variant="outline" onClick={reset}>
              Cambiar archivo
            </Button>
          </div>
          {!engineReady && (
            <p className="text-sm text-muted-foreground">
              Elige un motor disponible para poder clasificar.
            </p>
          )}
          <RowsTable
            rows={state.rows}
            started={false}
            models={models}
            caption="Vista previa del archivo"
          />
        </section>
      )}

      {started && (
        <section aria-label="Resultados del lote" className="flex flex-col gap-3">
          <div aria-live="polite" className="flex flex-col gap-2">
            <p>
              {formatCount(progress.processed)} de {formatCount(progress.total)} filas procesadas
              {batchEngine && ` · Motor: ${batchEngine.label}`}
              {state.phase === "done" && " · Lote terminado"}
            </p>
            <Progress
              value={progress.total === 0 ? 100 : (progress.processed / progress.total) * 100}
              aria-label="Progreso del lote"
            />
            {state.phase === "waiting" && state.wait && (
              <p className="text-sm">
                Se alcanzó el límite de solicitudes por minuto. Reintentando en{" "}
                {formatSeconds(state.wait.secondsLeft)} (intento {state.wait.attempt} de{" "}
                {MAX_RATE_LIMIT_RETRIES}).
              </p>
            )}
            {state.phase === "done" && (
              <p className="text-sm">
                {formatCount(progress.classified)} clasificadas
                {progress.itemErrors > 0 && `, ${formatCount(progress.itemErrors)} con error`}
                {progress.invalid > 0 && `, ${formatCount(progress.invalid)} inválidas`}.
              </p>
            )}
          </div>

          {state.phase === "stopped" && state.error && (
            <Alert variant="destructive">
              <AlertTitle>El lote se detuvo</AlertTitle>
              <AlertDescription className="flex flex-col gap-3">
                <span>
                  {stopMessage(state.error)} Las {formatCount(progress.processed)} filas ya
                  procesadas se conservan; quedan {formatCount(progress.pending)} pendientes.
                </span>
                <span className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void runner.retryPending()}>
                    Reintentar pendientes con {engineName(models, state.model)}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!engineReady || engine === state.model}
                    onClick={() => engine && void runner.newBatchWithModel(engine)}
                  >
                    Nuevo lote con otro motor
                    {engine && engine !== state.model ? ` (${engineName(models, engine)})` : ""}
                  </Button>
                </span>
                {(!engineReady || engine === state.model) && (
                  <span className="text-sm">
                    Para un nuevo lote,{" "}
                    <button
                      type="button"
                      className="underline underline-offset-4"
                      onClick={focusEngineSelector}
                    >
                      elige otro motor disponible
                    </button>
                    . Las filas pendientes se enviarán como un lote nuevo.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={download} disabled={active}>
              Descargar resultados (CSV)
            </Button>
            {!active && (
              <Button variant="outline" onClick={reset}>
                Clasificar otro archivo
              </Button>
            )}
          </div>

          <RowsTable rows={state.rows} started models={models} caption="Resultados del lote" />
        </section>
      )}
    </div>
  );
}
