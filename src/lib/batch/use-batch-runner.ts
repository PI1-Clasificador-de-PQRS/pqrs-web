"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { createBatchRunner, isBatchActive } from "@/lib/batch/batch-machine";
import { MODELS_QUERY_KEY } from "@/lib/models/use-models";

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Conecta el runner del lote con React. Los textos del CSV viven solo en este estado en memoria:
 * no se guardan en el navegador ni se registran.
 */
export function useBatchRunner() {
  const queryClient = useQueryClient();
  const [runner] = useState(() =>
    createBatchRunner({
      sendChunk: async (body, signal) => {
        try {
          return await unwrap(api.POST("/classify/batch", { body, signal }));
        } catch (error) {
          // Motor no disponible: se vuelve a consultar /models, pero la decisión es del usuario.
          if (error instanceof ApiError && error.status === 503) {
            void queryClient.invalidateQueries({ queryKey: MODELS_QUERY_KEY });
          }
          throw error;
        }
      },
      sleep,
      uuid: () => crypto.randomUUID(),
    }),
  );
  const state = useSyncExternalStore(runner.subscribe, runner.getState, runner.getState);

  useEffect(() => () => runner.cancel(), [runner]);

  // Aviso del navegador si se intenta salir con un lote en curso.
  const active = isBatchActive(state.phase);
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);

  return { state, runner };
}
