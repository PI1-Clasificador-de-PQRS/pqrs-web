"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { rangeError, type HistoryFilters as Filters } from "@/lib/history/filters";
import {
  CATEGORIES,
  ENGINE_LABELS,
  ENGINES,
  isCategory,
  isEngine,
  isSource,
  SOURCE_LABELS,
  SOURCES,
} from "@/lib/pqrs/labels";

/**
 * Formulario de filtros. Edita un borrador local y solo cambia la URL al pulsar «Filtrar»; se
 * vuelve a montar (con `key`) cuando la URL cambia, por ejemplo con el botón Atrás.
 */
export function HistoryFilters({
  initial,
  onApply,
  onClear,
}: {
  initial: Filters;
  onApply: (filters: Filters) => void;
  onClear: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<Filters>(initial);
  const [error, setError] = useState<string | null>(null);

  function update(patch: Partial<Filters>) {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = rangeError(draft);
    setError(problem);
    if (!problem) onApply({ ...draft, batchId: draft.batchId?.trim() || undefined });
  }

  return (
    <form
      aria-label="Filtros del historial"
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border p-4"
      noValidate
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-from`}>Desde</Label>
          <Input
            id={`${id}-from`}
            type="date"
            value={draft.dateFrom ?? ""}
            onChange={(event) => update({ dateFrom: event.target.value || undefined })}
            aria-invalid={error !== null}
            aria-describedby={error ? `${id}-error` : undefined}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-to`}>Hasta</Label>
          <Input
            id={`${id}-to`}
            type="date"
            value={draft.dateTo ?? ""}
            onChange={(event) => update({ dateTo: event.target.value || undefined })}
            aria-invalid={error !== null}
            aria-describedby={error ? `${id}-error` : undefined}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-category`}>Categoría</Label>
          <NativeSelect
            id={`${id}-category`}
            value={draft.category ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              update({ category: isCategory(value) ? value : undefined });
            }}
          >
            <option value="">Todas</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-model`}>Motor</Label>
          <NativeSelect
            id={`${id}-model`}
            value={draft.model ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              update({ model: isEngine(value) ? value : undefined });
            }}
          >
            <option value="">Todos</option>
            {ENGINES.map((engine) => (
              <option key={engine} value={engine}>
                {ENGINE_LABELS[engine]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-source`}>Origen</Label>
          <NativeSelect
            id={`${id}-source`}
            value={draft.source ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              update({ source: isSource(value) ? value : undefined });
            }}
          >
            <option value="">Todos</option>
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {SOURCE_LABELS[source]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-batch`}>Lote</Label>
          <Input
            id={`${id}-batch`}
            value={draft.batchId ?? ""}
            onChange={(event) => update({ batchId: event.target.value || undefined })}
            placeholder="Identificador del lote"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>
      <div aria-live="polite">
        {error && (
          <p id={`${id}-error`} className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Filtrar</Button>
        <Button type="button" variant="outline" onClick={onClear}>
          Limpiar filtros
        </Button>
      </div>
    </form>
  );
}
