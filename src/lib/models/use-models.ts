"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, unwrap, type Engine, type ModelInfo } from "@/lib/api/client";

export const MODELS_QUERY_KEY = ["models"] as const;
export const MODELS_REFRESH_MS = 60_000;

export function useModels() {
  return useQuery({
    queryKey: MODELS_QUERY_KEY,
    queryFn: ({ signal }) => unwrap(api.GET("/models", { signal })),
    refetchInterval: MODELS_REFRESH_MS,
  });
}

/** Preselección: el LLM si está disponible; si no, el clasificador (si lo está). */
export function preferredEngine(models: readonly ModelInfo[]): Engine | null {
  const available = (id: Engine) => models.some((model) => model.id === id && model.available);
  if (available("llm")) return "llm";
  if (available("classifier")) return "classifier";
  return null;
}

export function findModel(models: readonly ModelInfo[] | undefined, engine: Engine | null) {
  return engine ? models?.find((model) => model.id === engine) : undefined;
}

/**
 * Motor elegido. Se preselecciona una sola vez, con la primera respuesta de `/models`; después
 * solo lo cambia el usuario. El dashboard nunca cambia de motor por su cuenta, aunque el elegido
 * deje de estar disponible.
 */
export function useEngineSelection(models: readonly ModelInfo[] | undefined) {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [initialized, setInitialized] = useState(false);
  if (!initialized && models) {
    setInitialized(true);
    setEngine(preferredEngine(models));
  }
  return [engine, setEngine] as const;
}

export function unavailableReasonText(model: ModelInfo): string {
  switch (model.reason) {
    case "not_configured":
      return "No configurado";
    case "temporarily_unavailable":
      return model.retry_after != null
        ? `No disponible temporalmente, reintente en ${model.retry_after} s`
        : "No disponible temporalmente";
    case "not_loaded":
      return "No cargado";
    default:
      return "No disponible";
  }
}

const f1Format = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatF1(value: number | null): string {
  return value == null ? "sin dato" : f1Format.format(value);
}
