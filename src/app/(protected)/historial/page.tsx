import type { Metadata } from "next";
import { Suspense } from "react";
import { HistoryView } from "./components/history-view";

export const metadata: Metadata = { title: "Historial · Clasificador de PQRS" };

export default function HistoryPage() {
  return (
    <Suspense>
      <HistoryView />
    </Suspense>
  );
}
