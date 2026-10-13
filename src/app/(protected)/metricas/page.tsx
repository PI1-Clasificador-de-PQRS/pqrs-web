import type { Metadata } from "next";
import { Suspense } from "react";
import { MetricsView } from "./components/metrics-view";

export const metadata: Metadata = { title: "Métricas · Clasificador de PQRS" };

export default function MetricsPage() {
  return (
    <Suspense>
      <MetricsView />
    </Suspense>
  );
}
