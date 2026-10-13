import { ApiError } from "@/lib/api/errors";
import {
  batchProgress,
  chunkRows,
  createBatchRunner,
  type BatchRequest,
  type BatchResponse,
  type BatchRow,
} from "@/lib/batch/batch-machine";
import type { CsvRow } from "@/lib/batch/csv-parse";

function csvRows(count: number, invalidAt: number[] = []): CsvRow[] {
  return Array.from({ length: count }, (_, index) => ({
    index,
    rowNumber: index + 2,
    text: invalidAt.includes(index) ? "" : `texto ${index}`,
    ref: `R-${index}`,
    problem: invalidAt.includes(index) ? "empty_text" : null,
  }));
}

function ok(body: BatchRequest): BatchResponse {
  return {
    batch_id: body.batch_id!,
    model: body.model!,
    results: body.items.map((_, index) => ({
      index,
      category: "Petición",
      id: null,
      model_version: "v1",
      error: null,
    })),
  };
}

function rateLimited(retryAfter?: number) {
  return new ApiError({ status: 429, code: "rate_limited", retryAfter });
}

const unavailable = () => new ApiError({ status: 503, code: "classifier_unavailable" });

function setup(
  handler: (body: BatchRequest, call: number) => BatchResponse | Promise<BatchResponse>,
) {
  const calls: BatchRequest[] = [];
  const sleeps: number[] = [];
  let ids = 0;
  const runner = createBatchRunner({
    sendChunk: async (body) => {
      calls.push(structuredClone(body));
      return handler(body, calls.length);
    },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    uuid: () => `batch-${++ids}`,
  });
  return { runner, calls, sleeps };
}

const statuses = (rows: readonly BatchRow[]) => rows.map((row) => row.status);

describe("runner del lote", () => {
  it("envía las filas válidas en bloques de 50, en orden, con el mismo batch_id y model", async () => {
    const { runner, calls } = setup((body) => ok(body));
    runner.load(csvRows(122, [3, 70]));
    await runner.start("llm");

    expect(calls.map((call) => call.items.length)).toEqual([50, 50, 20]);
    expect(new Set(calls.map((call) => call.batch_id))).toEqual(new Set(["batch-1"]));
    expect(new Set(calls.map((call) => call.model))).toEqual(new Set(["llm"]));
    expect(calls[0]!.items[3]).toEqual({ text: "texto 4", external_ref: "R-4" });

    const state = runner.getState();
    expect(state.phase).toBe("done");
    expect(state.rows[3]!.status).toBe("invalid");
    expect(state.rows[0]).toMatchObject({
      status: "classified",
      category: "Petición",
      model: "llm",
    });
    expect(batchProgress(state.rows)).toMatchObject({ total: 120, processed: 120, invalid: 2 });
  });

  it("asigna los errores por elemento a su fila sin afectar a las demás", async () => {
    const { runner } = setup((body) => {
      const response = ok(body);
      response.results[1] = {
        index: 1,
        category: null,
        error: { code: "invalid_external_ref", message: "Referencia demasiado larga." },
      };
      return response;
    });
    runner.load(csvRows(3));
    await runner.start("classifier");
    const rows = runner.getState().rows;
    expect(statuses(rows)).toEqual(["classified", "item_error", "classified"]);
    expect(rows[1]!.error).toEqual({
      code: "invalid_external_ref",
      message: "Referencia demasiado larga.",
    });
  });

  it("ante un 429 espera Retry-After con cuenta regresiva y reintenta el mismo bloque", async () => {
    const waits: Array<number | undefined> = [];
    const { runner, calls, sleeps } = setup((body, call) => {
      if (call === 2) throw rateLimited(3);
      return ok(body);
    });
    runner.subscribe(() => {
      const state = runner.getState();
      if (state.phase === "waiting") waits.push(state.wait?.secondsLeft);
    });
    runner.load(csvRows(60));
    await runner.start("llm");

    expect(calls.map((call) => call.items.length)).toEqual([50, 10, 10]);
    expect(calls[2]).toEqual(calls[1]);
    expect(waits).toEqual([3, 2, 1]);
    expect(sleeps).toEqual([1000, 1000, 1000]);
    expect(runner.getState().phase).toBe("done");
  });

  it("reintenta un 429 hasta 3 veces y al cuarto detiene el lote", async () => {
    const { runner, calls } = setup(() => {
      throw rateLimited();
    });
    runner.load(csvRows(5));
    await runner.start("llm");
    expect(calls).toHaveLength(4);
    expect(runner.getState()).toMatchObject({
      phase: "stopped",
      error: { status: 429, code: "rate_limited" },
    });
  });

  it("un 503 detiene el lote y conserva lo ya clasificado", async () => {
    const { runner, calls } = setup((body, call) => {
      if (call === 2) throw unavailable();
      return ok(body);
    });
    runner.load(csvRows(120));
    await runner.start("classifier");

    expect(calls).toHaveLength(2);
    const state = runner.getState();
    expect(state.phase).toBe("stopped");
    expect(state.error).toMatchObject({ status: 503, code: "classifier_unavailable" });
    expect(batchProgress(state.rows)).toMatchObject({ classified: 50, pending: 70 });
  });

  it("otro error (red) también detiene el lote", async () => {
    const { runner } = setup(() => {
      throw new TypeError("fetch failed");
    });
    runner.load(csvRows(2));
    await runner.start("classifier");
    expect(runner.getState()).toMatchObject({ phase: "stopped", error: { code: "network_error" } });
  });

  it("Reintentar pendientes usa el mismo batch_id y motor y no reenvía lo clasificado", async () => {
    let fail = true;
    const { runner, calls } = setup((body, call) => {
      if (call === 2 && fail) throw unavailable();
      return ok(body);
    });
    runner.load(csvRows(120));
    await runner.start("classifier");
    fail = false;
    await runner.retryPending();

    expect(calls.map((call) => call.items.length)).toEqual([50, 50, 50, 20]);
    expect(calls[2]!.items[0]!.text).toBe("texto 50");
    expect(new Set(calls.map((call) => call.batch_id))).toEqual(new Set(["batch-1"]));
    expect(new Set(calls.map((call) => call.model))).toEqual(new Set(["classifier"]));
    expect(runner.getState().phase).toBe("done");
  });

  it("Nuevo lote con otro motor usa otro batch_id y otro model solo para las pendientes", async () => {
    const { runner, calls } = setup((body, call) => {
      if (call === 2) throw new ApiError({ status: 503, code: "llm_unavailable" });
      return ok(body);
    });
    runner.load(csvRows(70));
    await runner.start("llm");
    await runner.newBatchWithModel("classifier");

    expect(calls.map((call) => [call.batch_id, call.model, call.items.length])).toEqual([
      ["batch-1", "llm", 50],
      ["batch-1", "llm", 20],
      ["batch-2", "classifier", 20],
    ]);
    const state = runner.getState();
    expect(state).toMatchObject({ phase: "done", batchId: "batch-2", model: "classifier" });
    expect(state.rows[0]!.model).toBe("llm");
    expect(state.rows[69]!.model).toBe("classifier");
  });

  it("no permite reintentar ni empezar fuera de su fase", async () => {
    const { runner, calls } = setup((body) => ok(body));
    await runner.retryPending();
    await runner.newBatchWithModel("llm");
    runner.load(csvRows(1));
    await runner.retryPending();
    expect(calls).toHaveLength(0);
    await runner.start("llm");
    await runner.start("llm");
    expect(calls).toHaveLength(1);
  });
});

describe("chunkRows", () => {
  it("parte antes de 50 si el cuerpo superaría el límite de bytes", () => {
    const big = "😀".repeat(5000); // ~20 KB por elemento en UTF-8
    const rows = csvRows(50).map((row) => ({ ...row, text: big, status: "pending" as const }));
    const chunks = chunkRows(rows);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flat()).toHaveLength(50);
    for (const chunk of chunks) {
      const bytes = new TextEncoder().encode(
        JSON.stringify({ items: chunk.map((r) => ({ text: r.text })) }),
      );
      expect(bytes.byteLength).toBeLessThan(1024 * 1024);
    }
  });
});
