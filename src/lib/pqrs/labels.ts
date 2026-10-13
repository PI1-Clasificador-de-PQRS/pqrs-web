import type { Schemas } from "@/lib/api/client";

export type Category = Schemas["Category"];
export type Source = Schemas["Source"];
export type Engine = Schemas["Engine"];

/** Orden canónico de las categorías en filtros, tablas y gráficos. */
export const CATEGORIES: readonly Category[] = [
  "Petición",
  "Reclamo",
  "Denuncia",
  "Solicitud de información",
];

export const ENGINES: readonly Engine[] = ["llm", "classifier"];

export const ENGINE_LABELS: Record<Engine, string> = {
  llm: "LLM",
  classifier: "Clasificador local",
};

export const SOURCES: readonly Source[] = ["ui", "ui_batch", "api"];

export const SOURCE_LABELS: Record<Source, string> = {
  ui: "Individual",
  ui_batch: "Lote",
  api: "Sistema externo",
};

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

export function isEngine(value: string): value is Engine {
  return (ENGINES as readonly string[]).includes(value);
}

export function isSource(value: string): value is Source {
  return (SOURCES as readonly string[]).includes(value);
}
