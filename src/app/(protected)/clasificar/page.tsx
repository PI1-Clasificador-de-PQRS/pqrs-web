import type { Metadata } from "next";
import { ClassifyView } from "./components/classify-view";

export const metadata: Metadata = { title: "Clasificar · Clasificador de PQRS" };

export default function ClassifyPage() {
  return <ClassifyView />;
}
