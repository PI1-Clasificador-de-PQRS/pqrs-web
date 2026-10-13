"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  customRangeError,
  GRANULARITY_LABELS,
  PRESET_LABELS,
  PRESETS,
  type Granularity,
  type MetricsSearch,
  type Preset,
} from "@/lib/metrics/period";

/**
 * Selector de período y granularidad. Un período predefinido o la granularidad cambian la URL
 * en el acto; el rango personalizado se aplica con su botón, tras validar las fechas.
 */
export function PeriodSelector({
  search,
  granularityLocked,
  onChange,
}: {
  search: MetricsSearch;
  /** Con «Todo el historial» solo se puede ver por semana. */
  granularityLocked: boolean;
  onChange: (search: MetricsSearch) => void;
}) {
  const id = useId();
  const [preset, setPreset] = useState<Preset>(search.preset);
  const [dateFrom, setDateFrom] = useState(search.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(search.dateTo ?? "");
  const [error, setError] = useState<string | null>(null);

  function choosePreset(next: Preset) {
    setPreset(next);
    setError(null);
    if (next !== "custom") onChange({ preset: next, granularity: search.granularity });
  }

  function applyCustom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: MetricsSearch = {
      preset: "custom",
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      granularity: search.granularity,
    };
    const problem = customRangeError(next);
    setError(problem);
    if (!problem) onChange(next);
  }

  return (
    <form
      aria-label="Selector de período"
      onSubmit={applyCustom}
      className="flex flex-wrap items-end gap-3 rounded-lg border p-4"
      noValidate
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-preset`}>Período</Label>
        <NativeSelect
          id={`${id}-preset`}
          className="w-52"
          value={preset}
          onChange={(event) => choosePreset(event.target.value as Preset)}
        >
          {PRESETS.map((value) => (
            <option key={value} value={value}>
              {PRESET_LABELS[value]}
            </option>
          ))}
        </NativeSelect>
      </div>

      {preset === "custom" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-from`}>Desde</Label>
            <Input
              id={`${id}-from`}
              type="date"
              className="w-40"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setError(null);
              }}
              aria-invalid={error !== null}
              aria-describedby={error ? `${id}-error` : undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-to`}>Hasta</Label>
            <Input
              id={`${id}-to`}
              type="date"
              className="w-40"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setError(null);
              }}
              aria-invalid={error !== null}
              aria-describedby={error ? `${id}-error` : undefined}
            />
          </div>
          <Button type="submit">Aplicar</Button>
        </>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-granularity`}>Agrupar por</Label>
        <NativeSelect
          id={`${id}-granularity`}
          className="w-32"
          value={granularityLocked ? "week" : search.granularity}
          disabled={granularityLocked}
          onChange={(event) =>
            onChange({ ...search, granularity: event.target.value as Granularity })
          }
        >
          {(["day", "week"] as const).map((value) => (
            <option key={value} value={value}>
              {GRANULARITY_LABELS[value]}
            </option>
          ))}
        </NativeSelect>
      </div>

      {error && (
        <p id={`${id}-error`} role="alert" className="basis-full text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
