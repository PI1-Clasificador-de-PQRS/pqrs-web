import { ApiError } from "@/lib/api/errors";
import type { Engine, Schemas } from "@/lib/api/client";
import type { CsvRow } from "@/lib/batch/csv-parse";

/**
 * Ejecución de un lote CSV, sin React: un reducer puro y un runner asíncrono con dependencias
 * inyectadas (envío, espera e id), para probarlo sin interfaz.
 *
 *   ready ──start──▶ running ──todos los bloques──▶ done
 *                     │  ▲
 *          429 (≤ 3) ─┤  └─ fin de la cuenta regresiva: reintenta el MISMO bloque
 *                     ▼
 *                  waiting
 *                     │ 4.º 429, 503 u otro error
 *                     ▼
 *                  stopped ──retryPending──────────▶ running (mismo batch_id y motor)
 *                          └─newBatchWithModel(m)──▶ running (batch_id nuevo, motor m,
 *                                                     solo las filas pendientes)
 *
 * Las filas ya clasificadas se conservan siempre y nunca se reenvían.
 */

export const CHUNK_SIZE = 50;
export const MAX_RATE_LIMIT_RETRIES = 3;
export const DEFAULT_RETRY_AFTER_SECONDS = 5;
/** Margen bajo el MAX_BODY_BYTES (1 MiB) de la API para bloques con textos muy largos. */
export const MAX_CHUNK_BYTES = 900_000;

export type BatchRequest = Schemas["BatchRequest"];
export type BatchResponse = Schemas["BatchResponse"];
export type Category = Schemas["Category"];

export type RowStatus = "invalid" | "pending" | "classified" | "item_error";

export type BatchRow = CsvRow & {
  status: RowStatus;
  category?: Category;
  model?: Engine;
  error?: { code: string; message: string };
};

export type Phase = "idle" | "ready" | "running" | "waiting" | "stopped" | "done";

export type StopError = {
  status: number;
  code: string;
  message?: string;
  retryAfter?: number;
};

export type BatchState = {
  phase: Phase;
  rows: BatchRow[];
  batchId: string | null;
  model: Engine | null;
  wait: { secondsLeft: number; attempt: number } | null;
  error: StopError | null;
};

export type BatchAction =
  | { type: "load"; rows: readonly CsvRow[] }
  | { type: "clear" }
  | { type: "start"; batchId: string; model: Engine }
  | { type: "chunkDone"; rowIndexes: readonly number[]; response: BatchResponse }
  | { type: "wait"; secondsLeft: number; attempt: number }
  | { type: "resume" }
  | { type: "stop"; error: StopError }
  | { type: "finish" };

export const initialBatchState: BatchState = {
  phase: "idle",
  rows: [],
  batchId: null,
  model: null,
  wait: null,
  error: null,
};

function applyChunk(
  rows: BatchRow[],
  rowIndexes: readonly number[],
  response: BatchResponse,
): BatchRow[] {
  const next = rows.slice();
  const seen = new Set<number>();
  for (const result of response.results) {
    const rowIndex = rowIndexes[result.index];
    const row = rowIndex === undefined ? undefined : next[rowIndex];
    if (rowIndex === undefined || !row) continue;
    seen.add(rowIndex);
    if (result.error) {
      next[rowIndex] = { ...row, status: "item_error", error: result.error, model: undefined };
    } else if (result.category) {
      next[rowIndex] = {
        ...row,
        status: "classified",
        category: result.category,
        model: response.model,
        error: undefined,
      };
    }
  }
  for (const rowIndex of rowIndexes) {
    const row = next[rowIndex];
    if (!seen.has(rowIndex) && row?.status === "pending") {
      next[rowIndex] = {
        ...row,
        status: "item_error",
        error: { code: "missing_result", message: "La API no devolvió resultado para esta fila." },
      };
    }
  }
  return next;
}

export function batchReducer(state: BatchState, action: BatchAction): BatchState {
  switch (action.type) {
    case "load":
      return {
        ...initialBatchState,
        phase: "ready",
        rows: action.rows.map((row) => ({ ...row, status: row.problem ? "invalid" : "pending" })),
      };
    case "clear":
      return initialBatchState;
    case "start":
      return {
        ...state,
        phase: "running",
        batchId: action.batchId,
        model: action.model,
        wait: null,
        error: null,
      };
    case "chunkDone":
      return { ...state, rows: applyChunk(state.rows, action.rowIndexes, action.response) };
    case "wait":
      return {
        ...state,
        phase: "waiting",
        wait: { secondsLeft: action.secondsLeft, attempt: action.attempt },
      };
    case "resume":
      return { ...state, phase: "running", wait: null };
    case "stop":
      return { ...state, phase: "stopped", wait: null, error: action.error };
    case "finish":
      return { ...state, phase: "done", wait: null };
  }
}

export function batchProgress(rows: readonly BatchRow[]) {
  let total = 0;
  let processed = 0;
  let classified = 0;
  let itemErrors = 0;
  let pending = 0;
  let invalid = 0;
  for (const row of rows) {
    if (row.status === "invalid") {
      invalid++;
      continue;
    }
    total++;
    if (row.status === "pending") pending++;
    else {
      processed++;
      if (row.status === "classified") classified++;
      else itemErrors++;
    }
  }
  return { total, processed, classified, itemErrors, pending, invalid };
}

export function isBatchActive(phase: Phase): boolean {
  return phase === "running" || phase === "waiting";
}

const encoder = new TextEncoder();

function itemFor(row: BatchRow): Schemas["BatchItem"] {
  return { text: row.text, external_ref: row.ref };
}

/** Bloques de hasta 50 filas, partidos antes si el JSON se acercara al límite de la API. */
export function chunkRows(rows: readonly BatchRow[]): BatchRow[][] {
  const chunks: BatchRow[][] = [];
  let current: BatchRow[] = [];
  let bytes = 0;
  for (const row of rows) {
    const size = encoder.encode(JSON.stringify(itemFor(row))).byteLength + 1;
    if (current.length > 0 && (current.length === CHUNK_SIZE || bytes + size > MAX_CHUNK_BYTES)) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(row);
    bytes += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export type BatchDeps = {
  sendChunk: (body: BatchRequest, signal: AbortSignal) => Promise<BatchResponse>;
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  uuid: () => string;
};

function toStopError(error: unknown): StopError {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      code: error.code,
      message: error.apiMessage,
      retryAfter: error.retryAfter,
    };
  }
  return { status: 0, code: "network_error" };
}

function isAbort(error: unknown, signal: AbortSignal) {
  return signal.aborted || (error instanceof DOMException && error.name === "AbortError");
}

/** Pequeño store observable con el estado del lote y las operaciones permitidas. */
export function createBatchRunner(deps: BatchDeps) {
  let state = initialBatchState;
  let controller: AbortController | null = null;
  const listeners = new Set<() => void>();

  function dispatch(action: BatchAction) {
    state = batchReducer(state, action);
    for (const listener of listeners) listener();
  }

  async function execute(batchId: string, model: Engine, signal: AbortSignal) {
    const pending = state.rows.filter((row) => row.status === "pending");
    for (const chunk of chunkRows(pending)) {
      const body: BatchRequest = { batch_id: batchId, model, items: chunk.map(itemFor) };
      let attempt = 0;
      for (;;) {
        if (signal.aborted) return;
        try {
          const response = await deps.sendChunk(body, signal);
          if (signal.aborted) return;
          dispatch({ type: "chunkDone", rowIndexes: chunk.map((row) => row.index), response });
          break;
        } catch (error) {
          if (isAbort(error, signal)) return;
          const rateLimited =
            error instanceof ApiError && error.status === 429 && error.code === "rate_limited";
          if (rateLimited && attempt < MAX_RATE_LIMIT_RETRIES) {
            attempt++;
            const seconds = Math.max(1, error.retryAfter ?? DEFAULT_RETRY_AFTER_SECONDS);
            try {
              for (let left = seconds; left > 0; left--) {
                dispatch({ type: "wait", secondsLeft: left, attempt });
                await deps.sleep(1000, signal);
              }
            } catch (sleepError) {
              if (isAbort(sleepError, signal)) return;
              throw sleepError;
            }
            dispatch({ type: "resume" });
            continue;
          }
          dispatch({ type: "stop", error: toStopError(error) });
          return;
        }
      }
    }
    dispatch({ type: "finish" });
  }

  function run(batchId: string, model: Engine): Promise<void> {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    dispatch({ type: "start", batchId, model });
    return execute(batchId, model, current.signal);
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    load(rows: readonly CsvRow[]) {
      controller?.abort();
      dispatch({ type: "load", rows });
    },
    clear() {
      controller?.abort();
      dispatch({ type: "clear" });
    },
    /** Fija un `batch_id` nuevo y el motor, y envía las filas válidas. */
    start(model: Engine): Promise<void> {
      if (state.phase !== "ready") return Promise.resolve();
      return run(deps.uuid(), model);
    },
    /** Tras un fallo: reenvía las pendientes con el mismo motor y el mismo `batch_id`. */
    retryPending(): Promise<void> {
      if (state.phase !== "stopped" || !state.batchId || !state.model) return Promise.resolve();
      return run(state.batchId, state.model);
    },
    /** Tras un fallo: deja el lote anterior y envía las pendientes en otro lote con otro motor. */
    newBatchWithModel(model: Engine): Promise<void> {
      if (state.phase !== "stopped") return Promise.resolve();
      return run(deps.uuid(), model);
    },
    cancel() {
      controller?.abort();
    },
  };
}

export type BatchRunner = ReturnType<typeof createBatchRunner>;
