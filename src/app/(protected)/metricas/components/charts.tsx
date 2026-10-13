"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
} from "recharts";
import type { ChartRow } from "@/lib/metrics/summary";
import { NEUTRAL_SERIES_COLOR } from "@/lib/pqrs/category-colors";
import { formatNumber } from "@/lib/time/format";

// Los textos usan los tokens del tema; el color de la serie solo va en las marcas.
const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 };
const VALUE_LABEL = { fill: "var(--foreground)", fontSize: 12 };
const GRID_STROKE = "var(--border)";

function formatValue(value: unknown): string {
  return typeof value === "number" ? formatNumber(value) : String(value ?? "");
}

/** Cada barra con el color de su fila (o el neutro) y separación con la siguiente. */
function RowBar(props: BarShapeProps) {
  const row = props.payload as ChartRow | undefined;
  return <Rectangle {...props} fill={row?.color ?? NEUTRAL_SERIES_COLOR} />;
}

function ChartTooltip() {
  return (
    <Tooltip
      cursor={{ fill: "var(--muted)", opacity: 0.6 }}
      formatter={(value) => [formatValue(value), "Clasificaciones"]}
      labelFormatter={(_, payload) => (payload?.[0]?.payload as ChartRow | undefined)?.label ?? ""}
      contentStyle={{
        background: "var(--popover)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        color: "var(--popover-foreground)",
      }}
    />
  );
}

/** Barras verticales (categorías), con el valor encima de cada barra. */
export function ColumnChart({ rows }: { rows: readonly ChartRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={[...rows]} margin={{ top: 24, right: 8, bottom: 8, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} interval={0} />
        <YAxis
          allowDecimals={false}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={formatValue}
        />
        <ChartTooltip />
        <Bar
          dataKey="value"
          shape={RowBar}
          radius={[4, 4, 0, 0]}
          maxBarSize={64}
          isAnimationActive={false}
        >
          <LabelList dataKey="value" position="top" formatter={formatValue} style={VALUE_LABEL} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Barras horizontales (motor, origen), con el valor al final de cada barra. */
export function HorizontalBarChart({ rows }: { rows: readonly ChartRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, rows.length * 48 + 24)}>
      <BarChart
        data={[...rows]}
        layout="vertical"
        margin={{ top: 8, right: 48, bottom: 8, left: 8 }}
      >
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={120}
        />
        <ChartTooltip />
        <Bar
          dataKey="value"
          shape={RowBar}
          radius={[0, 4, 4, 0]}
          maxBarSize={28}
          isAnimationActive={false}
        >
          <LabelList dataKey="value" position="right" formatter={formatValue} style={VALUE_LABEL} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Serie temporal: una línea con un punto por período. */
export function TimeseriesChart({ rows }: { rows: readonly ChartRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={[...rows]} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis dataKey="shortLabel" tick={AXIS_TICK} tickLine={false} minTickGap={16} />
        <YAxis
          allowDecimals={false}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={formatValue}
        />
        <ChartTooltip />
        <Line
          type="monotone"
          dataKey="value"
          stroke={NEUTRAL_SERIES_COLOR}
          strokeWidth={2}
          dot={rows.length <= 62 ? { r: 3, fill: NEUTRAL_SERIES_COLOR } : false}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
